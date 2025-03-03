import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { addDays, parse, format, setHours, setMinutes, getDay, isMonday, isTuesday, addHours } from 'date-fns';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { 
      timeFrame, 
      currentDate, 
      platformSettings, 
      customPrompt, 
      organizationId 
    } = await request.json();

    // Validate input
    if (!timeFrame || !currentDate || !platformSettings || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get organization preferences from the database
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('name, preferences')
      .eq('id', organizationId)
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Fetch recent posts for the organization (for context)
    const { data: recentPosts, error: postsError } = await supabase
      .from('posts')
      .select('title, description, platform, format, posted_date')
      .eq('organization_id', organizationId)
      .order('posted_date', { ascending: false })
      .limit(10);
    
    if (postsError) {
      console.error('Error fetching recent posts:', postsError);
      // Continue anyway, but log the error
    }

    // Prepare the messaging for OpenAI
    const platformRequests = platformSettings.map((p: { platform: string, count: number }) => 
      `${p.count} ${p.platform} posts${p.platform === 'Web' ? ' (blog format)' : ''}`
    ).join(', ');
    
    // Add scheduling guidance from Social Media Times
    const schedulingGuidance = `
    For X (formerly Twitter) posts:
    - MUST schedule on Mondays and Tuesdays between 10 AM and 1 PM for maximum engagement
    
    For LinkedIn posts:
    - MUST schedule on Tuesdays, Wednesdays, and Thursdays between 10 AM and 2 PM
    
    For Instagram posts:
    - MUST schedule on Tuesdays, Wednesdays, and Thursdays between 10 AM and 2 PM
    - For video content, consider early mornings (6-9 AM) or evenings (6-9 PM)
    
    For Facebook posts:
    - Prefer midweek posting
    
    IMPORTANT: These optimal posting times should ALWAYS be prioritized first. Only schedule outside these times if the optimal slots are already taken by other posts.
    `;
    
    const startDate = new Date(currentDate);
    const endDateMap = {
      day: addDays(startDate, 1),
      week: addDays(startDate, 7),
      month: addDays(startDate, 30),
      year: addDays(startDate, 365)
    };
    
    const endDate = endDateMap[timeFrame as keyof typeof endDateMap] || addDays(startDate, 30);
    
    // Call OpenAI API
    let responseContent;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4", // or whichever model you're using
        messages: [
          { 
            role: "system", 
            content: `You are a social media and content planning expert. 
            Your task is to generate EXACTLY the requested number of content suggestions for each platform. 
            Missing even a single post is NOT acceptable.
            
            CONTENT STRATEGY APPROACH:
            - Treat website/blog content as the PRIMARY content source
            - First, create compelling blog post ideas for the website
            - Then, derive social media posts from these blog posts
            - Each blog post can inspire multiple social media posts across different platforms
            - Intelligently determine how many social posts can be derived from each blog post
            
            REPURPOSING GUIDELINES:
            - For each blog post, suggest specific ways to repurpose it for different social platforms
            - Consider the unique strengths of each platform (e.g., professional tone for LinkedIn, conversational for X)
            - Identify which sections, quotes, statistics, or insights from each blog would work best on each platform
            - You may use similar themes across platforms, but NEVER repeat the exact same post on a single platform
            - Be explicit about which website content each social post is derived from
            
            REQUIRED POST COUNTS:
            ${platformRequests}.
            
            The content should be highly specific, actionable, and engaging - generic content will be rejected.
            
            Strictly follow these scheduling guidelines for optimal engagement:
            ${schedulingGuidance}
            
            DISTRIBUTION REQUIREMENTS:
            - For month or longer timeframes, evenly distribute posts across all weeks of the period
            - Do not cluster posts at the beginning or end of the timeframe
            - Aim for a balanced distribution throughout the entire period
            
            The content should be relevant to ${orgData.name}, a company in the ${
              orgData.preferences?.industry || 'technology'
            } industry. 
            The content tone should be ${orgData.preferences?.contentTone || 'professional'}.
            
            FORMAT REQUIREMENTS:
            Your response MUST be a valid JSON object containing an array called "suggestions".
            Each suggestion MUST include ALL of the following fields:
            1. title - A compelling, specific title for the post (NOT generic like "Platform Post 1")
            2. description - A detailed content summary or actual post content
            3. platform - The exact platform name from the user request
            4. date - A specific date between ${format(startDate, 'yyyy-MM-dd')} and ${format(endDate, 'yyyy-MM-dd')} with time in 24h format (YYYY-MM-DD HH:MM)
            5. reasonsData - An object with "reasons" array explaining why this content is suggested, and "aiConfidence" number between 0-1
            6. format - For Web content: "blog"; for social media: "social"
            7. derivedFrom - For social posts, include the title of the website content it's derived from; leave empty for original website content
            
            X POSTS SCHEDULING: Schedule only on Mondays and Tuesdays between 10:00 and 13:00.
            
            VERIFICATION: Before submitting your response, count the number of suggestions for each platform to verify you've met the exact requirements.`
          },
          {
            role: "user",
            content: `Please create a detailed content plan for the ${timeFrame} starting on ${format(startDate, 'yyyy-MM-dd')}. 
            
            I MUST have EXACTLY these posts (no more, no less):
            ${platformRequests}. 
            
            IMPORTANT: First create compelling website/blog content, then derive social media posts from that content. Each blog post can inspire multiple social posts across different platforms. Make sure to indicate which social posts are derived from which blog posts.
            
            ${customPrompt ? `Content focus or themes: ${customPrompt}` : ''}
            
            ${recentPosts && recentPosts.length > 0 ? `Recent posts for context to avoid duplication: ${JSON.stringify(recentPosts)}` : ''}
            
            IMPORTANT REQUIREMENTS:
            1. Distribute posts evenly across the entire ${timeFrame}
            2. Provide SPECIFIC and MEANINGFUL titles and descriptions for EVERY post
            3. Do NOT use generic titles like "X Post 1" or "Web Content 2"
            4. Follow platform-specific best practices for content
            5. Your response MUST be valid JSON with exactly the requested number of posts per platform
            6. For each social media post, specify which website content it's derived from
            
            Please verify your counts for each platform before finalizing your response.`
          }
        ],
        temperature: 0.7,
        // Remove the response_format parameter as it's not supported by the model you're using
      });
      
      responseContent = completion.choices[0].message.content;
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      return NextResponse.json({ 
        error: openaiError instanceof Error ? openaiError.message : 'Error connecting to AI service',
        details: openaiError 
      }, { status: 500 });
    }
    
    // Parse JSON from the response
    let suggestions;
    try {
      // Find JSON in the response if it's wrapped in ```json or just parse directly
      const jsonMatch = responseContent?.match(/```json\s*([\s\S]*?)\s*```/) || 
                      responseContent?.match(/```\s*([\s\S]*?)\s*```/);
      
      const jsonContent = jsonMatch ? jsonMatch[1] : responseContent;
      
      try {
        suggestions = JSON.parse(jsonContent || '{"suggestions":[]}');
      } catch (parseError) {
        console.error('Initial JSON parse error:', parseError);
        
        // Try a more aggressive approach to extract JSON
        const possibleJsonMatch = responseContent?.match(/\{[\s\S]*\}/);
        if (possibleJsonMatch) {
          try {
            suggestions = JSON.parse(possibleJsonMatch[0]);
            console.log('Successfully extracted JSON with second attempt');
          } catch (secondParseError) {
            console.error('Second JSON parse attempt failed:', secondParseError);
            suggestions = { suggestions: [] };
          }
        } else {
          suggestions = { suggestions: [] };
        }
      }
      
      // Ensure we have an array of suggestions
      if (!Array.isArray(suggestions.suggestions) && Array.isArray(suggestions)) {
        suggestions = { suggestions };
      } else if (!suggestions.suggestions) {
        suggestions = { suggestions: [] };
      }
      
      // Ensure each suggestion has required fields
      suggestions.suggestions = suggestions.suggestions.map((suggestion: any) => {
        return {
          title: suggestion.title || 'Untitled Post',
          description: suggestion.description || 'No description provided',
          platform: suggestion.platform || 'Web',
          date: suggestion.date || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
          status: 'SUGGESTED',
          format: suggestion.format || (suggestion.platform === 'Web' ? 'blog' : 'social'),
          derivedFrom: suggestion.derivedFrom || '',
          reasonsData: suggestion.reasonsData || {
            reasons: ['Generated based on your content plan'],
            aiConfidence: 0.8
          }
        };
      });
      
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.log('Raw response:', responseContent);
      return NextResponse.json({ 
        error: 'Failed to parse AI response', 
        rawResponse: responseContent 
      }, { status: 500 });
    }
    
    // Post-process to verify counts and scheduling
    const processedSuggestions = verifyAndAdjustSuggestions(
      suggestions.suggestions, 
      platformSettings,
      startDate,
      endDate
    );
    
    return NextResponse.json({ suggestions: processedSuggestions });
  } catch (error) {
    console.error('AI Planner API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}

// Helper function to verify and adjust suggestions
function verifyAndAdjustSuggestions(
  suggestions: any[], 
  platformSettings: Array<{ platform: string, count: number }>,
  startDate: Date,
  endDate: Date
) {
  // Count suggestions by platform
  const platformCounts: Record<string, number> = {};
  const platformRequestedCounts: Record<string, number> = {};
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Create a map of requested counts
  platformSettings.forEach(p => {
    platformRequestedCounts[p.platform] = p.count;
    platformCounts[p.platform] = 0;
  });
  
  // Get total posts count to evenly distribute
  const totalPostsCount = platformSettings.reduce((sum, p) => sum + p.count, 0);
  
  // Create day buckets for distributing posts
  // We'll divide the date range into segments based on the number of posts
  // This ensures posts are distributed evenly throughout the period
  const dayBuckets: Date[] = [];
  
  if (totalPostsCount > 0) {
    // Calculate how many days per post for even distribution
    const daysPerPost = Math.max(1, Math.floor(totalDays / totalPostsCount));
    
    // Create evenly spaced day buckets
    for (let i = 0; i < totalPostsCount; i++) {
      // Calculate the day within the range, ensuring more even distribution
      const dayOffset = Math.min(
        totalDays - 1, 
        Math.floor(i * totalDays / totalPostsCount) + 
        Math.floor(Math.random() * Math.min(daysPerPost, 3)) // Add small randomness within the bucket
      );
      
      dayBuckets.push(addDays(startDate, dayOffset));
    }
  }
  
  // Helper function to determine if a slot is optimal for a given platform
  const isOptimalTimeSlot = (date: Date, platform: string): boolean => {
    const day = getDay(date); // 0 = Sunday, 1 = Monday, ...
    const hour = date.getHours();
    
    switch(platform) {
      case 'X':
      case '𝕏':
        // X: Mondays and Tuesdays between 10 AM and 1 PM
        return (day === 1 || day === 2) && (hour >= 10 && hour < 13);
      
      case 'LinkedIn':
        // LinkedIn: Tuesdays, Wednesdays, and Thursdays between 10 AM and 2 PM
        return (day >= 2 && day <= 4) && (hour >= 10 && hour < 14);
      
      case 'Instagram':
        // Instagram: Tuesdays, Wednesdays, and Thursdays between 10 AM and 2 PM
        // Special case for video content handled elsewhere
        return (day >= 2 && day <= 4) && (hour >= 10 && hour < 14);
      
      case 'Facebook':
        // Facebook: Prefer midweek posting
        return (day >= 2 && day <= 4);
      
      default:
        return true; // No specific optimal time for other platforms
    }
  };
  
  // Helper function to find the next optimal time slot for a platform
  const findNextOptimalSlot = (fromDate: Date, platform: string, occupiedSlots: Set<string>): Date => {
    let candidateDate = new Date(fromDate);
    let attempts = 0;
    const maxAttempts = 14; // Try up to two weeks ahead
    
    while (attempts < maxAttempts) {
      // If we're already at an optimal day/time, check if it's occupied
      if (isOptimalTimeSlot(candidateDate, platform)) {
        const dateKey = format(candidateDate, "yyyy-MM-dd'T'HH");
        if (!occupiedSlots.has(dateKey)) {
          return candidateDate;
        }
      }
      
      // Move to next time slot (increment by 1 hour)
      candidateDate = addHours(candidateDate, 1);
      
      // If we've moved past end date, wrap back to start date
      if (candidateDate > endDate) {
        candidateDate = new Date(startDate);
      }
      
      attempts++;
    }
    
    // If no optimal slot found after max attempts, return original date
    return fromDate;
  };
  
  // Keep track of occupied time slots
  const occupiedTimeSlots = new Set<string>();
  
  // Process and validate each suggestion
  const processedSuggestions = suggestions.map((suggestion, index) => {
    // Ensure suggestion has all required fields
    const processed = {
      ...suggestion,
      title: suggestion.title || 'Untitled Post',
      description: suggestion.description || '',
      platform: suggestion.platform || 'Web',
      status: 'SUGGESTED',
      // Add format based on platform
      format: suggestion.format || (suggestion.platform === 'Web' ? 'blog' : 'social'),
      // Ensure derivedFrom field is present
      derivedFrom: suggestion.derivedFrom || ''
    };
    
    // Parse and validate date
    try {
      let postDate;
      if (typeof suggestion.date === 'string') {
        // Try to parse the date
        postDate = new Date(suggestion.date);
        
        // If the date is invalid, use evenly distributed date from buckets
        if (isNaN(postDate.getTime())) {
          // Get an appropriate day from our buckets if available
          if (dayBuckets.length > 0) {
            // Use modulo to cycle through available buckets if we have more posts than buckets
            const bucketIndex = index % dayBuckets.length;
            postDate = dayBuckets[bucketIndex];
          } else {
            // Fallback to evenly distributed dates if buckets aren't available
            const dayOffset = Math.min(
              totalDays - 1, 
              Math.floor(index * totalDays / Math.max(1, suggestions.length))
            );
            postDate = addDays(startDate, dayOffset);
          }
        }
      } else {
        // If no date provided, use evenly distributed date from buckets
        if (dayBuckets.length > 0) {
          const bucketIndex = index % dayBuckets.length;
          postDate = dayBuckets[bucketIndex];
        } else {
          // Fallback to evenly distributed dates
          const dayOffset = Math.min(
            totalDays - 1, 
            Math.floor(index * totalDays / Math.max(1, suggestions.length))
          );
          postDate = addDays(startDate, dayOffset);
        }
      }
      
      // Set time to a reasonable hour if not specified (9 AM)
      if (postDate.getHours() === 0 && postDate.getMinutes() === 0) {
        postDate = setHours(postDate, 9);
      }
      
      // Check if this is already an optimal time slot
      if (!isOptimalTimeSlot(postDate, processed.platform)) {
        // If not optimal, try to find an optimal slot
        postDate = findNextOptimalSlot(postDate, processed.platform, occupiedTimeSlots);
      } else {
        // It's optimal, but check if it's already occupied
        const dateKey = format(postDate, "yyyy-MM-dd'T'HH");
        if (occupiedTimeSlots.has(dateKey)) {
          // Slot is occupied, find another optimal slot
          postDate = findNextOptimalSlot(postDate, processed.platform, occupiedTimeSlots);
        }
      }
      
      // Special handling for X (Twitter) posts - enforce Monday/Tuesday schedule
      if (processed.platform === '𝕏' || processed.platform === 'X') {
        const day = getDay(postDate);
        
        // If not Monday or Tuesday, find the next Monday
        if (day !== 1 && day !== 2) {
          const daysUntilMonday = day === 0 ? 1 : 8 - day; // Sunday is 0
          postDate = addDays(postDate, daysUntilMonday);
        }
        
        // Set time between 10 AM and 1 PM
        const hour = 10 + Math.floor(Math.random() * 3); // 10, 11, or 12
        const minute = Math.floor(Math.random() * 60);
        postDate = setHours(setMinutes(postDate, minute), hour);
      }
      
      // Mark this time slot as occupied
      occupiedTimeSlots.add(format(postDate, "yyyy-MM-dd'T'HH"));
      
      // Ensure date is within range
      if (postDate < startDate) postDate = startDate;
      if (postDate > endDate) postDate = endDate;
      
      processed.date = format(postDate, "yyyy-MM-dd'T'HH:mm:ss");
      processed.posted_date = format(postDate, "yyyy-MM-dd'T'HH:mm:ss");
    } catch (error) {
      console.error('Error processing date:', error);
      // Use evenly distributed fallback date
      const dayOffset = Math.min(
        totalDays - 1, 
        Math.floor(index * totalDays / Math.max(1, suggestions.length))
      );
      const fallbackDate = addDays(startDate, dayOffset);
      processed.date = format(fallbackDate, "yyyy-MM-dd'T'HH:mm:ss");
      processed.posted_date = format(fallbackDate, "yyyy-MM-dd'T'HH:mm:ss");
    }
    
    // Ensure reasonsData exists
    if (!processed.reasonsData) {
      processed.reasonsData = {
        reasons: ['Generated based on your content plan'],
        aiConfidence: 0.8
      };
    }
    
    // Count this platform
    platformCounts[processed.platform] = (platformCounts[processed.platform] || 0) + 1;
    
    if (processed.platform === '𝕏' || processed.platform === 'X') {
      processed.platform = 'X'; // Normalize to 'X'
    }
    
    return processed;
  });
  
  // Add additional posts if we don't have enough for any platform
  const additionalSuggestions: any[] = [];
  
  // First, ensure we have enough web content to derive posts from
  const webPosts = processedSuggestions.filter(p => p.platform === 'Web');
  let additionalWebPosts: any[] = [];
  
  // If we need more web posts, create them first
  if (platformRequestedCounts['Web'] && (platformCounts['Web'] || 0) < platformRequestedCounts['Web']) {
    const webPostsNeeded = platformRequestedCounts['Web'] - (platformCounts['Web'] || 0);
    
    for (let i = 0; i < webPostsNeeded; i++) {
      // Calculate evenly distributed date for this additional post
      const dayOffset = Math.min(
        totalDays - 1, 
        Math.floor(i * totalDays / Math.max(1, webPostsNeeded))
      );
      let postDate = addDays(startDate, dayOffset);
      
      // Ensure date is within range
      if (postDate > endDate) postDate = endDate;
      
      // Create a web post with meaningful content
      const webPost = {
        title: `* ${['How to', 'The ultimate guide to', 'Top 10', '5 ways to'][i % 4]} improve ${['productivity', 'efficiency', 'results', 'performance'][Math.floor(Math.random() * 4)]}`,
        description: `Comprehensive blog post providing actionable advice and insights on industry best practices. Include subheadings, bullet points, and a clear call-to-action.`,
        platform: 'Web',
        date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
        posted_date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
        status: 'SUGGESTED',
        format: 'blog',
        derivedFrom: '',
        reasonsData: {
          reasons: ['Auto-generated to complete your content plan requirements', 'Based on platform best practices'],
          aiConfidence: 0.7
        }
      };
      
      additionalWebPosts.push(webPost);
    }
    
    // Add these to our processed suggestions
    additionalSuggestions.push(...additionalWebPosts);
  }
  
  // Now combine all web posts (original + additional)
  const allWebPosts = [...webPosts, ...additionalWebPosts];
  
  // Now handle social media posts, deriving them from web content
  Object.entries(platformRequestedCounts).forEach(([platform, requestedCount]) => {
    // Skip Web as we've already handled it
    if (platform === 'Web') return;
    
    const currentCount = platformCounts[platform] || 0;
    if (currentCount < requestedCount) {
      // Generate additional posts for this platform
      for (let i = 0; i < (requestedCount - currentCount); i++) {
        // Determine which web post to derive from (distribute evenly among available web posts)
        const webPostIndex = i % Math.max(1, allWebPosts.length);
        const sourceWebPost = allWebPosts[webPostIndex];
        const derivedFrom = sourceWebPost?.title || '';
        
        let postDate;
        
        // Determine proper spacing for additional posts
        const existingPlatformPosts = processedSuggestions.filter(p => p.platform === platform).length;
        const totalPlatformPosts = existingPlatformPosts + (requestedCount - currentCount);
        
        // Calculate evenly distributed date for this additional post
        const postIndex = existingPlatformPosts + i;
        const dayOffset = Math.min(
          totalDays - 1, 
          Math.floor(postIndex * totalDays / Math.max(1, totalPlatformPosts))
        );
        postDate = addDays(startDate, dayOffset);
        
        // If we have a source web post, schedule after it
        if (sourceWebPost) {
          const webPostDate = new Date(sourceWebPost.date);
          if (webPostDate > postDate) {
            // Ensure social post comes after the web post it's derived from
            postDate = addDays(webPostDate, 1 + (i % 3)); // Stagger by 1-3 days after web post
          }
        }
        
        // Find an optimal time slot for this platform if available
        if (!isOptimalTimeSlot(postDate, platform)) {
          postDate = findNextOptimalSlot(postDate, platform, occupiedTimeSlots);
        } else {
          // It's optimal, but check if it's already occupied
          const dateKey = format(postDate, "yyyy-MM-dd'T'HH");
          if (occupiedTimeSlots.has(dateKey)) {
            // Slot is occupied, find another optimal slot
            postDate = findNextOptimalSlot(postDate, platform, occupiedTimeSlots);
          }
        }
        
        // Special scheduling for X (Twitter)
        if (platform === '𝕏' || platform === 'X') {
          const day = getDay(postDate);
          
          // Find a Monday or Tuesday
          if (day !== 1 && day !== 2) {
            const daysUntilMonday = day === 0 ? 1 : 8 - day;
            postDate = addDays(postDate, daysUntilMonday);
          }
          
          // Set time between 10 AM and 1 PM
          const hour = 10 + Math.floor(Math.random() * 3);
          const minute = Math.floor(Math.random() * 60);
          postDate = setHours(setMinutes(postDate, minute), hour);
        }
        
        // Mark this time slot as occupied
        occupiedTimeSlots.add(format(postDate, "yyyy-MM-dd'T'HH"));
        
        // Ensure date is within range
        if (postDate > endDate) postDate = endDate;
        
        // Generate platform-specific derived content based on the web post
        let title = '';
        let description = '';
        
        // Get derived content based on platform
        const webPostTitle = sourceWebPost?.title?.replace(/^\*\s*/, '') || ''; // Remove the * if present
        const webPostDesc = sourceWebPost?.description || '';
        
        switch(platform) {
          case 'X':
          case '𝕏':
            title = `* Key insight from "${webPostTitle}"`;
            description = `Share a compelling statistic or quote from your blog post. Include relevant hashtags and a link back to the full article.`;
            break;
          case 'LinkedIn':
            title = `* Professional perspective: ${webPostTitle}`;
            description = `Share an industry insight from your blog post with your professional network. Include your expert commentary and a call for others to share their experiences.`;
            break;
          case 'Instagram':
            title = `* Visual highlight from "${webPostTitle}"`;
            description = `Create a visually appealing graphic featuring a key quote or statistic from your blog post. Use the caption to expand on the point and direct followers to the link in bio.`;
            break;
          case 'Facebook':
            title = `* Discussion topic: ${webPostTitle}`;
            description = `Share a thought-provoking question related to your blog post. Include a brief summary of the key points and invite your community to discuss in the comments.`;
            break;
          default:
            title = `* Repurposed content: ${webPostTitle}`;
            description = `Adapt your blog content for the ${platform} platform, focusing on the most relevant points for this audience.`;
        }
        
        additionalSuggestions.push({
          title: title,
          description: description,
          platform: platform,
          date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
          posted_date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
          status: 'SUGGESTED',
          format: 'social',
          derivedFrom: derivedFrom,
          reasonsData: {
            reasons: [
              'Auto-generated to complete your content plan requirements', 
              'Derived from website content to maintain consistent messaging',
              'Optimized for platform-specific engagement'
            ],
            aiConfidence: 0.7
          }
        });
      }
    }
    
    if (platform === '𝕏' || platform === 'X') {
      platform = 'X'; // Normalize to 'X'
    }
  });
  
  return [...processedSuggestions, ...additionalSuggestions];
} 