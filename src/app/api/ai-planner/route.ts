import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { addDays, parse, format, setHours, setMinutes, getDay, isMonday, isTuesday } from 'date-fns';

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
    - Schedule on Mondays and Tuesdays between 10 AM and 1 PM for maximum engagement
    
    For LinkedIn posts:
    - Schedule on Tuesdays, Wednesdays, and Thursdays between 10 AM and 2 PM
    
    For Instagram posts:
    - Schedule on Tuesdays, Wednesdays, and Thursdays between 10 AM and 2 PM
    - For video content, consider early mornings (6-9 AM) or evenings (6-9 PM)
    
    For Facebook posts:
    - Prefer midweek posting
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
            Generate exactly the requested number of content suggestions for each platform:
            ${platformRequests}.
            
            Strictly follow these scheduling guidelines for optimal engagement:
            ${schedulingGuidance}
            
            IMPORTANT DISTRIBUTION GUIDELINE:
            - For month or longer timeframes, evenly distribute posts across all weeks of the period
            - Do not cluster posts at the beginning or end of the timeframe
            - Aim for a balanced distribution throughout the entire period
            
            The content should be relevant to ${orgData.name}, a company in the ${
              orgData.preferences?.industry || 'technology'
            } industry. 
            The content tone should be ${orgData.preferences?.contentTone || 'professional'}.
            
            Format your response as a valid JSON structure with an array of suggestions, each containing:
            1. title - A compelling title for the post
            2. description - A brief description or content summary
            3. platform - The exact platform name from the user request
            4. date - A specific date between ${format(startDate, 'yyyy-MM-dd')} and ${format(endDate, 'yyyy-MM-dd')} with time in 24h format (YYYY-MM-DD HH:MM)
            5. reasonsData - An object with "reasons" array explaining why this content is suggested, and "aiConfidence" number between 0-1
            
            FOR X POSTS: Schedule only on Mondays and Tuesdays between 10:00 and 13:00.`
          },
          {
            role: "user",
            content: `Please create a content plan for the ${timeFrame} starting on ${format(startDate, 'yyyy-MM-dd')}. 
            I need exactly: ${platformRequests}. 
            ${customPrompt ? `Focus on these themes or topics: ${customPrompt}` : ''}
            ${recentPosts && recentPosts.length > 0 ? `Recent posts for context: ${JSON.stringify(recentPosts)}` : ''}
            
            IMPORTANT: Please evenly distribute the posts across the entire ${timeFrame}, not clustering them at the beginning or end.
            
            Response should be valid JSON. Ensure each platform has exactly the number of posts specified.`
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
      suggestions = JSON.parse(jsonContent || '{"suggestions":[]}');
      
      // Ensure we have an array of suggestions
      if (!Array.isArray(suggestions.suggestions) && Array.isArray(suggestions)) {
        suggestions = { suggestions };
      } else if (!suggestions.suggestions) {
        suggestions = { suggestions: [] };
      }
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
      format: suggestion.format || (suggestion.platform === 'Web' ? 'blog' : 'social')
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
      
      // Special handling for X (Twitter) posts - enforce Monday/Tuesday schedule
      if (processed.platform === '𝕏' || processed.platform === 'X') {
        // If not Monday or Tuesday, find the next Monday
        if (!isMonday(postDate) && !isTuesday(postDate)) {
          const dayOfWeek = getDay(postDate);
          const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Sunday is 0
          postDate = addDays(postDate, daysUntilMonday);
        }
        
        // Set time between 10 AM and 1 PM
        const hour = 10 + Math.floor(Math.random() * 3); // 10, 11, or 12
        const minute = Math.floor(Math.random() * 60);
        postDate = setHours(setMinutes(postDate, minute), hour);
      }
      
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
    
    return processed;
  });
  
  // Add additional posts if we don't have enough for any platform
  const additionalSuggestions: any[] = [];
  
  Object.entries(platformRequestedCounts).forEach(([platform, requestedCount]) => {
    const currentCount = platformCounts[platform] || 0;
    if (currentCount < requestedCount) {
      // Generate additional posts for this platform
      for (let i = 0; i < (requestedCount - currentCount); i++) {
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
        
        // Special scheduling for X (Twitter)
        if (platform === '𝕏' || platform === 'X') {
          // Find a Monday or Tuesday
          if (!isMonday(postDate) && !isTuesday(postDate)) {
            const dayOfWeek = getDay(postDate);
            const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
            postDate = addDays(postDate, daysUntilMonday);
          }
          
          // Set time between 10 AM and 1 PM
          const hour = 10 + Math.floor(Math.random() * 3);
          const minute = Math.floor(Math.random() * 60);
          postDate = setHours(setMinutes(postDate, minute), hour);
        }
        
        // Ensure date is within range
        if (postDate > endDate) postDate = endDate;
        
        additionalSuggestions.push({
          title: `${platform} Content ${i + 1}`,
          description: `Suggested content for ${platform}`,
          platform: platform,
          date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
          posted_date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
          status: 'SUGGESTED',
          format: platform === 'Web' ? 'blog' : 'social',
          reasonsData: {
            reasons: ['Added to fulfill your requested content plan'],
            aiConfidence: 0.7
          }
        });
      }
    }
  });
  
  return [...processedSuggestions, ...additionalSuggestions];
} 