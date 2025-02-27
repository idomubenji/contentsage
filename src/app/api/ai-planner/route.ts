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
          
          Response should be valid JSON. Ensure each platform has exactly the number of posts specified.`
        }
      ],
      temperature: 0.7,
      // Remove the response_format parameter as it's not supported by the model you're using
    });
    
    const responseContent = completion.choices[0].message.content;
    
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
  
  // Create a map of requested counts
  platformSettings.forEach(p => {
    platformRequestedCounts[p.platform] = p.count;
    platformCounts[p.platform] = 0;
  });
  
  // Process and validate each suggestion
  const processedSuggestions = suggestions.map(suggestion => {
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
        
        // If the date is invalid, set a fallback
        if (isNaN(postDate.getTime())) {
          postDate = addDays(startDate, Math.floor(Math.random() * 30));
        }
      } else {
        // If no date provided, set a fallback
        postDate = addDays(startDate, Math.floor(Math.random() * 30));
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
      processed.date = format(addDays(startDate, Math.floor(Math.random() * 30)), "yyyy-MM-dd'T'HH:mm:ss");
      processed.posted_date = format(addDays(startDate, Math.floor(Math.random() * 30)), "yyyy-MM-dd'T'HH:mm:ss");
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
  Object.entries(platformRequestedCounts).forEach(([platform, requestedCount]) => {
    const currentCount = platformCounts[platform] || 0;
    if (currentCount < requestedCount) {
      // Generate additional posts for this platform
      for (let i = 0; i < (requestedCount - currentCount); i++) {
        let postDate;
        
        // Special scheduling for X (Twitter)
        if (platform === '𝕏' || platform === 'X') {
          // Find a Monday or Tuesday
          const baseDate = addDays(startDate, i * 2); // Spread them out
          const dayOfWeek = getDay(baseDate);
          
          if (dayOfWeek === 1 || dayOfWeek === 2) { // Monday or Tuesday
            postDate = baseDate;
          } else {
            const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
            postDate = addDays(baseDate, daysUntilMonday);
          }
          
          // Set time between 10 AM and 1 PM
          const hour = 10 + Math.floor(Math.random() * 3);
          const minute = Math.floor(Math.random() * 60);
          postDate = setHours(setMinutes(postDate, minute), hour);
        } else {
          // For other platforms, just space them out
          postDate = addDays(startDate, i * 3 + Math.floor(Math.random() * 3));
        }
        
        // Ensure date is within range
        if (postDate > endDate) postDate = endDate;
        
        processedSuggestions.push({
          title: `${platform} Content ${i + 1}`,
          description: `Suggested content for ${platform}`,
          platform: platform,
          date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
          posted_date: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
          status: 'SUGGESTED',
          format: platform === 'Web' ? 'blog' : 'social',
          seo_info: {
            reasonsData: {
              reasons: ['Added to fulfill your requested content plan'],
              aiConfidence: 0.7
            }
          }
        });
      }
    }
  });
  
  return processedSuggestions;
} 