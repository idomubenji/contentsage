import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { format, addDays } from 'date-fns';
import { 
  PostIdea, 
  ElaboratedPost, 
  PostWithSeo, 
  ScheduledPost,
  PlatformSetting
} from './types';
import { CalendarViewType } from '@/components/calendar/CalendarContext';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Step 1: Generate post ideas based on platform settings
 */
export async function generatePostIdeasStep(
  platformSettings: PlatformSetting[],
  industry: string,
  contentTone: string,
  customPrompt?: string,
  recentPosts: any[] = [],
  organizationInfo?: any
): Promise<PostIdea[]> {
  // Create focused prompt for just generating titles and basic concepts
  const platformRequests = platformSettings
    .map(p => `${p.count} ${p.platform} posts${p.platform === 'Web' ? ' (blog format)' : ''}`)
    .join(', ');
  
  // Extract organization's intent and goals from the info
  const orgIntent = organizationInfo?.description || '';
  const orgStrategy = organizationInfo?.strategy || '';
  const orgInterests = organizationInfo?.interests || [];
  const orgTargetAudience = organizationInfo?.targetAudience || '';
  
  // Build an organization intent section if we have the data
  let organizationIntentSection = '';
  if (organizationInfo && Object.keys(organizationInfo).length > 0) {
    organizationIntentSection = `
    ORGANIZATION CONTEXT:
    ${orgIntent ? `Description: ${orgIntent}` : ''}
    ${orgStrategy ? `Content Strategy: ${orgStrategy}` : ''}
    ${orgInterests.length > 0 ? `Key Interests: ${orgInterests.join(', ')}` : ''}
    ${orgTargetAudience ? `Target Audience: ${orgTargetAudience}` : ''}
    
    Ensure all content ideas align with the organization's intent, strategy, and target audience.
    `;
  }
  
  // Safely prepare platform requests summary with type checking
  let requestSummary = "";
  
  // Check if platformRequests is an array
  if (Array.isArray(platformRequests)) {
    requestSummary = platformRequests
      .map((req) => `${req.count} ${req.platform} posts${req.platform === "Web" ? " (blog format)" : ""}`)
      .join(", ");
  } else {
    // Handle the case when platformRequests is not an array
    console.error("platformRequests is not an array:", platformRequests);
    // Fallback to some default or extract data differently based on actual structure
    requestSummary = "requested posts";
  }

  // Construct organization context with inconsistency handling
  let organizationContext = "";
  if (organizationInfo && Object.keys(organizationInfo).length > 0) {
    organizationContext = `
    Organization information:
    - Industry: ${organizationInfo.industry || "Not specified"}
    - Brand voice: ${organizationInfo.voice || "Not specified"}
    - Key focus areas: ${organizationInfo.interests?.join(", ") || "Not specified"}
    - Target audience: ${organizationInfo.targetAudience || "Not specified"}
    
    IMPORTANT: If there appears to be any inconsistency between the Content Focus below and the organization information above, PRIORITIZE the Content Focus. Otherwise, use both to inform your suggestions harmoniously. Furthermore, Unless otherwise specified, Content Focus should only be applied to 2-4 posts. Any more is overkill. User can override this instruction by specifying a number of posts. If the user specifies a specific time, you should also honor that.
    `;
  }

  // Content focus description
  const contentFocusDescription = customPrompt
    ? `Content Focus: ${customPrompt}`
    : "No specific content focus provided.";

  // Recent posts context
  let recentPostsContext = "";
  if (recentPosts && recentPosts.length > 0) {
    recentPostsContext = `
    Avoid duplicating or being too similar to these recent posts:
    ${recentPosts.map((p) => `- ${p.title}`).join("\n")}
    `;
  }

  const prompt = `
    Generate compelling content ideas for the following platforms:
    ${requestSummary}
    
    For each post idea, provide:
    1. Title - A catchy, specific title (not generic)
    2. Target platform (${platformSettings.map((r) => r.platform).join(", ")})
    3. Brief concept - A clear description of what the post will cover
    4. Format - "blog" for Web platform, "social" for social media platforms
    5. DerivedFrom - For social posts that promote a blog post, reference the blog post's title here
    
    IMPORTANT GUIDELINES:
    - PRIORITIZE fulfilling the requested number of posts for each platform (e.g., if 10 X posts are requested, generate all 10)
    - Make X posts and other social posts concise and engaging (especially X which has character limits)
    - NOT ALL social posts need to be derived from blog content - only derive when it makes sense
    - If there are more social posts requested than blog posts, create original social posts that aren't derived from blogs
    - Ensure a diverse mix of topics across all platforms
    
    ${organizationContext}
    
    ${contentFocusDescription}
    
    ${recentPostsContext}
    
    IMPORTANT: Your response MUST be a valid JSON object with an array called "ideas" containing all suggested post ideas.
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4", 
      messages: [
        {
          role: "system", 
          content: "You are a content strategy expert focusing on generating compelling content ideas. You MUST respond with a valid JSON object containing an 'ideas' array."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.8,
    });
    
    // Parse the response
    const content = response.choices[0].message.content;
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(content || '{"ideas": []}');
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      console.log('Raw response:', content);
      
      // Fall back to a simple array if parsing fails
      parsedResponse = { ideas: [] };
    }
    
    // Transform to PostIdea format and add IDs
    return (parsedResponse.ideas || []).map((idea: any) => ({
      id: uuidv4(),
      title: idea.title || 'Untitled post',
      platform: idea.platform || 'Web',
      concept: idea.concept || 'Content idea generated by AI',
      format: idea.format || (idea.platform === 'Web' ? 'blog' : 'social'),
      derivedFrom: idea.derivedFrom || ''
    }));
  } catch (error) {
    console.error('Error generating post ideas:', error);
    throw new Error('Failed to generate post ideas');
  }
}

/**
 * Step 2: Elaborate posts with detailed content
 */
export async function elaboratePostsStep(
  postIdeas: PostIdea[],
  contentTone: string,
  organizationInfo?: any
): Promise<ElaboratedPost[]> {
  // Process in batches to avoid overloading the API
  const batchSize = 3;
  const results: ElaboratedPost[] = [];
  
  // Extract organization's intent and goals from the info
  const orgIntent = organizationInfo?.description || '';
  const orgStrategy = organizationInfo?.strategy || '';
  const orgVoice = organizationInfo?.voice || '';
  
  // Process posts in batches
  for (let i = 0; i < postIdeas.length; i += batchSize) {
    const batch = postIdeas.slice(i, i + batchSize);
    
    // Process each post in the batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (idea) => {
        const platformType = idea.platform === 'Web' ? 'article' : 'social post';
        
        // Build organization context section
        let organizationContext = '';
        if (organizationInfo && Object.keys(organizationInfo).length > 0) {
          organizationContext = `
          ORGANIZATION CONTEXT:
          ${orgIntent ? `Description: ${orgIntent}` : ''}
          ${orgStrategy ? `Content Strategy: ${orgStrategy}` : ''}
          ${orgVoice ? `Brand Voice: ${orgVoice}` : ''}
          
          Ensure the content aligns with the organization's intent, strategy, and brand voice.
          `;
        }
        
        // Get platform-specific instructions
        let platformSpecificInstructions = "";
        if (idea.platform === "X") {
          platformSpecificInstructions = "Keep the content VERY CONCISE - under 280 characters for the main content.";
        } else if (idea.platform !== "Web") {
          platformSpecificInstructions = "Keep the content concise and engaging for social media.";
        }
        
        // Create focused prompt for elaborating content
        const prompt = `
          Elaborate on this ${platformType} idea:
          Title: ${idea.title}
          Platform: ${idea.platform}
          Basic concept: ${idea.concept}
          
          Content tone: ${contentTone}
          
          ${platformSpecificInstructions}
          
          ${organizationContext}
          
          Provide the following ${idea.platform === "Web" ? "for this blog post" : "for this social media post"}:
          ${
            idea.platform === "Web"
              ? `
          - bulletPoints: A list of 3-5 key points the article should cover
          - outline: A brief outline of the article structure
          - targetKeywords: 3-5 SEO-friendly keywords or phrases
          - estimatedWordCount: Suggested word count (between 500-2000)
          - callToAction: A clear call-to-action for the end of the article
          `
              : `
          - content: ${idea.platform === "X" ? "BRIEF content (under 280 characters)" : "The suggested caption"} for the ${idea.platform} post
          - visualIdea: A brief description of what image or video would work well
          ${idea.platform === "LinkedIn" ? "- estimatedWordCount: Suggested word count (between 100-300)" : ""}
          `
          }
          
          Return this data as valid JSON. DO NOT include any additional text or explanation outside the JSON structure.
        `;
        
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system", 
                content: "You are a content creator expert who elaborates on content ideas with detailed outlines and suggestions. Always return valid JSON."
              },
              {
                role: "user", 
                content: prompt
              }
            ],
            temperature: 0.7,
          });
          
          // Parse response
          const content = response.choices[0].message.content;
          let elaboration;
          
          try {
            elaboration = JSON.parse(content || '{}');
          } catch (parseError) {
            console.error('Failed to parse elaboration as JSON:', parseError);
            console.log('Raw response:', content);
            
            // Fall back to a basic structure
            elaboration = {
              bulletPoints: ["Failed to generate bullet points"],
              structure: "Basic structure",
              content: content || "Content elaboration failed",
              hashtags: [],
              visualSuggestion: ""
            };
          }
          
          return {
            ...idea,
            elaboration
          } as ElaboratedPost;
        } catch (error) {
          console.error(`Error elaborating post "${idea.title}":`, error);
          return {
            ...idea,
            elaboration: {
              content: "Failed to elaborate on this content. Please try again later."
            },
            needsRetry: true
          } as ElaboratedPost;
        }
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Step 3: Generate SEO information for posts
 */
export async function generateSeoInfoStep(
  elaboratedPosts: ElaboratedPost[],
  organizationInfo?: any
): Promise<PostWithSeo[]> {
  const postsWithSeo: PostWithSeo[] = [];
  
  // Extract organization's intent and goals from the info
  const orgKeywords = organizationInfo?.keywords || [];
  const orgSeoStrategy = organizationInfo?.seoStrategy || '';
  
  for (const post of elaboratedPosts) {
    try {
      // Skip SEO analysis for non-Web posts
      if (post.platform !== 'Web') {
        postsWithSeo.push({
          ...post,
          reasonsData: {
            reasons: ['Social media post - standard SEO not applicable'],
            aiConfidence: 0.8
          }
        });
        continue;
      }
      
      // Build organization SEO context section
      let organizationSeoContext = '';
      if (organizationInfo && Object.keys(organizationInfo).length > 0) {
        organizationSeoContext = `
        ORGANIZATION SEO CONTEXT:
        ${orgKeywords.length > 0 ? `Target Keywords: ${orgKeywords.join(', ')}` : ''}
        ${orgSeoStrategy ? `SEO Strategy: ${orgSeoStrategy}` : ''}
        
        Ensure SEO analysis considers the organization's target keywords and SEO strategy.
        `;
      }
      
      const prompt = `
        Analyze this blog post for SEO potential:
        
        Title: ${post.title}
        Topic: ${post.concept}
        Key points: ${post.elaboration.bulletPoints?.join(', ') || 'Not provided'}
        
        ${organizationSeoContext}
        
        Provide 3-5 specific reasons why this content would perform well in search, and 
        provide a confidence score (0.0-1.0) indicating how confident you are that this 
        content idea has good SEO potential.
        
        FORMAT REQUIREMENTS:
        Return a valid JSON object with the following structure:
        {
          "reasons": ["Reason 1", "Reason 2", ...],
          "aiConfidence": 0.85,
          "seoSuggestions": ["Suggestion 1", "Suggestion 2", ...]
        }
      `;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system", 
            content: "You are an SEO specialist analyzing content ideas for search potential. Always return valid JSON."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.4,
      });
      
      // Parse the response
      const content = response.choices[0].message.content;
      let seoData;
      
      try {
        seoData = JSON.parse(content || '{}');
      } catch (parseError) {
        console.error('Failed to parse SEO data as JSON:', parseError);
        console.log('Raw response:', content);
        
        // Fall back to basic structure
        seoData = {
          reasons: ['Unable to parse SEO analysis'],
          aiConfidence: 0.5,
          seoSuggestions: []
        };
      }
      
      postsWithSeo.push({
        ...post,
        reasonsData: {
          reasons: seoData.reasons || [],
          aiConfidence: seoData.aiConfidence || 0.5
        },
        seoSuggestions: seoData.seoSuggestions || []
      });
    } catch (error) {
      console.error(`Error generating SEO info for "${post.title}":`, error);
      
      // Add with default SEO info
      postsWithSeo.push({
        ...post,
        reasonsData: {
          reasons: ['Error analyzing SEO potential'],
          aiConfidence: 0.5
        }
      });
    }
  }
  
  return postsWithSeo;
}

/**
 * Step 4: Schedule posts based on timeframe
 */
export async function schedulePostsStep(
  posts: PostWithSeo[],
  timeFrame: CalendarViewType,
  currentDate: Date
): Promise<ScheduledPost[]> {
  console.log("SCHEDULING DEBUG - Input currentDate:", currentDate);
  console.log("SCHEDULING DEBUG - Input currentDate type:", typeof currentDate);
  console.log("SCHEDULING DEBUG - Input currentDate ISO:", currentDate.toISOString());
  console.log("SCHEDULING DEBUG - Posts count:", posts.length);
  
  try {
    // Ensure currentDate is properly handled
    let safeCurrentDate: Date;
    
    // Handle the case when currentDate might be a string
    if (typeof currentDate === 'string') {
      safeCurrentDate = new Date(currentDate);
      console.log("SCHEDULING DEBUG - Converted string date:", safeCurrentDate.toISOString());
    } else if (currentDate instanceof Date) {
      safeCurrentDate = new Date(currentDate.getTime()); // Clone the date
      console.log("SCHEDULING DEBUG - Cloned Date object:", safeCurrentDate.toISOString());
    } else {
      // Fallback to today if date is invalid
      safeCurrentDate = new Date();
      console.log("SCHEDULING DEBUG - Using fallback current date:", safeCurrentDate.toISOString());
    }
    
    // Force the date to noon UTC to avoid timezone issues
    safeCurrentDate.setUTCHours(12, 0, 0, 0);
    
    const result = schedulePostsEvenly(posts, timeFrame, safeCurrentDate);
    console.log("SCHEDULING DEBUG - Successfully scheduled posts:", result.length);
    
    if (result.length > 0) {
      console.log("SCHEDULING DEBUG - First post scheduled at:", result[0].posted_date);
      console.log("SCHEDULING DEBUG - First post title:", result[0].title);
      console.log("SCHEDULING DEBUG - Last post scheduled at:", result[result.length-1].posted_date);
    }
    
    return result;
  } catch (error) {
    console.error("CRITICAL ERROR in schedulePostsStep:", error);
    // Fallback to a simple scheduling approach if the main one fails
    return fallbackScheduling(posts, timeFrame, currentDate);
  }
}

// Fallback scheduling function in case the main one fails
function fallbackScheduling(
  posts: PostWithSeo[],
  timeFrame: CalendarViewType,
  currentDate: Date
): ScheduledPost[] {
  console.log("USING FALLBACK SCHEDULING");
  
  // Simple scheduling logic that just spaces posts evenly
  const result: ScheduledPost[] = [];
  const safeDate = new Date(currentDate);
  
  // Use first day of the month for month planning
  if (timeFrame === "month") {
    safeDate.setDate(1);
  }
  
  // Determine number of days to distribute posts over
  const daysToDistribute = timeFrame === "month" ? 28 : (timeFrame === "week" ? 7 : 14);
  
  // Distribute posts evenly
  for (let i = 0; i < posts.length; i++) {
    const dayOffset = Math.floor((i / posts.length) * daysToDistribute);
    const postDate = new Date(safeDate);
    postDate.setDate(postDate.getDate() + dayOffset);
    
    // Set a reasonable time (between 9AM and 5PM)
    postDate.setHours(9 + (i % 8), 0, 0, 0);
    
    result.push({
      ...posts[i], // Preserve ALL properties, including title
      posted_date: postDate.toISOString(), // Convert Date to string
      status: 'SCHEDULED' // Add default status
    });
  }
  
  // Sort by date (first convert strings back to Date objects for comparison)
  return result.sort((a, b) => new Date(a.posted_date).getTime() - new Date(b.posted_date).getTime());
}

export function schedulePostsEvenly(
  posts: PostWithSeo[],
  timeFrame: CalendarViewType,
  currentDate: Date
): ScheduledPost[] {
  console.log("SCHEDULING EVENLY - Start date:", currentDate.toISOString());
  
  // Group posts by platform
  const groupedPosts: Record<string, PostWithSeo[]> = {};
  
  for (const post of posts) {
    if (!groupedPosts[post.platform]) {
      groupedPosts[post.platform] = [];
    }
    groupedPosts[post.platform].push(post);
  }
  
  // Platform scheduling configurations
  const platformDays: Record<string, number[]> = {
    Web: [0], // Sunday
    LinkedIn: [1, 3], // Monday, Wednesday
    Facebook: [2, 4], // Tuesday, Thursday
    Instagram: [1, 5], // Monday, Friday
    X: [2, 3], // Tuesday, Wednesday
  };
  
  // Start and end dates for the planning period
  let startDate = new Date(currentDate);
  const endDate = new Date(startDate);
  
  // Fix the dates for the time frame
  if (timeFrame === "month") {
    // Set to first day of the month
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    // Set to last day of the month
    endDate.setFullYear(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  } else if (timeFrame === "week") {
    endDate.setDate(startDate.getDate() + 6); // 7 days
  } else {
    endDate.setDate(startDate.getDate() + 13); // 14 days
  }
  
  console.log(`SCHEDULING EVENLY - Planning from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const scheduledPosts: ScheduledPost[] = [];
  const usedPosts = new Set<string>(); // Track which posts have been scheduled to avoid duplicates
  
  // For each platform, find valid dates and schedule posts
  Object.keys(groupedPosts).forEach(platform => {
    const platformType = platform as string;
    const platformPosts = groupedPosts[platform];
    console.log(`Platform ${platform} has ${platformPosts.length} posts to schedule`);
    
    // Get valid days for this platform
    const validDays = platformDays[platformType] || [0, 1, 2, 3, 4, 5, 6]; // Default to all days
    
    // Find all valid dates in the range
    const validDates: Date[] = [];
    const currentDay = new Date(startDate);
    
    while (currentDay <= endDate) {
      if (validDays.includes(currentDay.getDay())) {
        validDates.push(new Date(currentDay));
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    console.log(`Platform ${platform} has ${validDates.length} valid dates in range`);
    
    if (validDates.length === 0) {
      console.log(`WARNING: No valid dates for platform ${platform} - using all days instead`);
      // Fallback: use all days if no valid dates
      const currentDay = new Date(startDate);
      while (currentDay <= endDate) {
        validDates.push(new Date(currentDay));
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }
    
    // Process each post exactly once
    for (let i = 0; i < platformPosts.length; i++) {
      const post = platformPosts[i];
      
      // Skip if this exact post has already been scheduled
      const postId = `${post.id || post.title}`; // Use ID if available, otherwise title
      if (usedPosts.has(postId)) {
        console.log(`Skipping duplicate post: ${post.title}`);
        continue;
      }
      
      // Mark this post as used
      usedPosts.add(postId);
      
      // Calculate which date to use - distribute evenly across available dates
      const dateIndex = i % validDates.length;
      const postDate = new Date(validDates[dateIndex]);
      
      // Set a time between 9 AM and 5 PM
      postDate.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
      
      // Create scheduled post
      scheduledPosts.push({
        ...post,
        posted_date: postDate.toISOString(), // Convert Date to string
        status: 'SCHEDULED' // Add default status
      });
      
      console.log(`Scheduled "${post.title}" for ${postDate.toISOString()}`);
    }
  });
  
  // Sort by date (first convert strings back to Date objects for comparison)
  return scheduledPosts.sort((a, b) => new Date(a.posted_date).getTime() - new Date(b.posted_date).getTime());
}

/**
 * Gets platform-specific scheduling constraints
 */
function getPlatformSchedulingConstraints(platform: string): {
  validDays: number[];
  validHours: { start: number; end: number };
} {
  switch (platform.toLowerCase()) {
    case 'web':
    case 'blog':
      return {
        validDays: [0], // Sunday only
        validHours: { start: 9, end: 17 } // 9 AM to 5 PM
      };
    case 'x':
    case 'twitter':
      return {
        validDays: [1, 2], // Monday and Tuesday
        validHours: { start: 10, end: 12 } // 10 AM to 12 PM
      };
    case 'linkedin':
      return {
        validDays: [2, 3, 4], // Tuesday, Wednesday, Thursday
        validHours: { start: 10, end: 15 } // 10 AM to 3 PM
      };
    case 'instagram':
      return {
        validDays: [2, 3], // Tuesday and Wednesday
        validHours: { start: 10, end: 16 } // 10 AM to 4 PM
      };
    case 'facebook':
      return {
        validDays: [1, 3, 5], // Monday, Wednesday, Friday
        validHours: { start: 9, end: 17 } // 9 AM to 5 PM
      };
    default:
      return {
        validDays: [1, 2, 3, 4, 5], // Weekdays
        validHours: { start: 9, end: 17 } // 9 AM to 5 PM
      };
  }
}

/**
 * Gets available days within a date range that match the valid days of the week
 */
function getAvailableDaysInTimeFrame(
  startDate: Date,
  endDate: Date,
  validDays: number[]
): Date[] {
  const availableDays: Date[] = [];
  
  // Create a copy of the start date to avoid modifying the original
  const currentDay = new Date(startDate);
  
  // Ensure we're starting from the 1st day of the month for 'month' timeframe
  // This is critical to distribute across the full month
  if (startDate.getMonth() === endDate.getMonth() && 
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getDate() > 1) {
    // We're in a month timeframe - make sure we include the full month
    // by resetting to the 1st day of the month
    currentDay.setDate(1);
    console.log(`Resetting start day to beginning of month: ${format(currentDay, 'yyyy-MM-dd')}`);
  }
  
  // Log the range we're checking
  console.log(`Finding available days from ${format(currentDay, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')} for days: ${validDays.join(', ')}`);
  
  // Iterate through each day in the time frame
  while (currentDay <= endDate) {
    // Check if the day of the week is in our valid days array
    if (validDays.includes(getDay(currentDay))) {
      availableDays.push(new Date(currentDay));
    }
    // Move to the next day
    currentDay.setDate(currentDay.getDate() + 1);
  }
  
  return availableDays;
}

/**
 * Gets a time appropriate for the platform and position in the day
 */
function getTimeForPlatformAndPosition(
  platform: string, 
  position: number,
  validHours: { start: number; end: number }
): string {
  const { start, end } = validHours;
  const hoursRange = end - start;
  
  // If we have more positions than hours, we'll need to use minutes to stagger
  if (position < hoursRange) {
    // Simple case: just add the position to the start hour
    const hour = start + position;
    return `${hour.toString().padStart(2, '0')}:00`;
  } else {
    // Complex case: need to use the same hours but different minutes
    const innerPosition = position % hoursRange;
    const hour = start + innerPosition;
    
    // Use different minute increments based on how many times we've cycled through the hours
    const cycleCount = Math.floor(position / hoursRange);
    const minute = (cycleCount * 15) % 60;
    
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
}

/**
 * Validates the distribution of posts and logs statistics
 */
function validateDistribution(scheduledPosts: ScheduledPost[]): void {
  // Count posts per day
  const postsPerDay = new Map<string, number>();
  const postsPerPlatformPerDay = new Map<string, Map<string, number>>();
  
  for (const post of scheduledPosts) {
    const day = post.posted_date;
    const platform = post.platform.toLowerCase();
    
    // Count total posts per day
    postsPerDay.set(day, (postsPerDay.get(day) || 0) + 1);
    
    // Count posts per platform per day
    if (!postsPerPlatformPerDay.has(day)) {
      postsPerPlatformPerDay.set(day, new Map<string, number>());
    }
    const platformCounts = postsPerPlatformPerDay.get(day)!;
    platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
  }
  
  // Log distribution statistics
  console.log(`Distribution statistics for ${scheduledPosts.length} posts:`);
  console.log(`- Distributed across ${postsPerDay.size} unique days`);
  
  // Find the maximum posts scheduled on any day
  let maxPostsOnAnyDay = 0;
  let dayWithMostPosts = '';
  
  for (const [day, count] of postsPerDay.entries()) {
    if (count > maxPostsOnAnyDay) {
      maxPostsOnAnyDay = count;
      dayWithMostPosts = day;
    }
  }
  
  console.log(`- Maximum posts on any day: ${maxPostsOnAnyDay} (on ${dayWithMostPosts})`);
  
  // Log days with multiple posts
  const daysWithMultiplePosts = Array.from(postsPerDay.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([day, count]) => `${day}: ${count} posts`);
  
  if (daysWithMultiplePosts.length > 0) {
    console.log(`- Days with multiple posts: ${daysWithMultiplePosts.join(', ')}`);
    
    // Show platform breakdown for days with multiple posts
    for (const [day, platformCounts] of postsPerPlatformPerDay.entries()) {
      if (postsPerDay.get(day)! > 1) {
        const breakdown = Array.from(platformCounts.entries())
          .map(([platform, count]) => `${platform}: ${count}`)
          .join(', ');
        console.log(`  - ${day} breakdown: ${breakdown}`);
      }
    }
  }
}

/**
 * Gets the end date for a given time frame and start date
 */
function getEndDateForTimeFrame(startDate: Date, timeFrame: CalendarViewType): Date {
  let endDate: Date;
  
  if (timeFrame === 'week') {
    // For week view, add 6 days to get a 7-day range
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (timeFrame === 'month') {
    // For month view:
    // If we're in the middle of a month, we want to include the full month
    // Get the last day of the month
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    
    // Last day of current month
    endDate = new Date(year, month + 1, 0);
    
    console.log(`Month timeframe: Using end date ${format(endDate, 'yyyy-MM-dd')} for start date ${format(startDate, 'yyyy-MM-dd')}`);
  } else {
    // Default to 30 days ahead
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 29);
  }
  
  return endDate;
}

// Helper function to get the day of the week (0 = Sunday, 1 = Monday, etc.)
function getDay(date: Date): number {
  return date.getDay();
}

/**
 * Divides a date range into weeks
 */
function groupDaysByWeek(startDate: Date, endDate: Date): { start: Date; end: Date }[] {
  const weeks: { start: Date; end: Date }[] = [];
  
  // Create a copy of the start date
  let currentDate = new Date(startDate);
  
  // Get to the start of the week (Sunday)
  while (getDay(currentDate) !== 0 && currentDate > new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) {
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // If we went to previous month, reset to the first day of the month
  if (currentDate.getMonth() !== startDate.getMonth()) {
    currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  }
  
  // Create week boundaries
  while (currentDate <= endDate) {
    const weekStart = new Date(currentDate);
    
    // End of week is 6 days after start (or the end date if that comes first)
    let weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    // If week end is beyond the end date, cap it
    if (weekEnd > endDate) {
      weekEnd = new Date(endDate);
    }
    
    weeks.push({ start: weekStart, end: weekEnd });
    
    // Move to the next week
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
}

/**
 * Calculates how many posts to schedule in each week
 * Uses the one-per-week-until-last-week strategy
 */
function calculateWeeklyPostDistribution(
  totalPosts: number,
  daysByWeek: Map<number, Date[]>,
  totalWeeks: number
): Map<number, number> {
  const distribution = new Map<number, number>();
  
  // First, ensure every week gets at least one post
  // but only if there are enough posts
  let remainingPosts = totalPosts;
  
  // Initialize distribution with zeros
  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
    distribution.set(weekIndex, 0);
  }
  
  // One post per week from the beginning, until we run out
  for (let weekIndex = 0; weekIndex < totalWeeks && remainingPosts > 0; weekIndex++) {
    const daysInWeek = daysByWeek.get(weekIndex) || [];
    if (daysInWeek.length > 0) {
      distribution.set(weekIndex, 1);
      remainingPosts--;
    }
  }
  
  // If we still have posts, distribute them starting from the last week
  // and working backwards
  if (remainingPosts > 0) {
    for (let weekIndex = totalWeeks - 1; weekIndex >= 0 && remainingPosts > 0; weekIndex--) {
      const daysInWeek = daysByWeek.get(weekIndex) || [];
      const currentPostCount = distribution.get(weekIndex) || 0;
      
      // Calculate how many more posts we can put in this week
      // Limited by either remaining posts or available days
      const maxAdditionalPosts = Math.min(
        remainingPosts,
        Math.max(daysInWeek.length - currentPostCount, 0)
      );
      
      if (maxAdditionalPosts > 0) {
        distribution.set(weekIndex, currentPostCount + maxAdditionalPosts);
        remainingPosts -= maxAdditionalPosts;
      }
    }
  }
  
  // If we still have posts, we need to add more than one post per day
  // in some weeks, starting from the last week
  if (remainingPosts > 0) {
    for (let weekIndex = totalWeeks - 1; weekIndex >= 0 && remainingPosts > 0; weekIndex--) {
      const daysInWeek = daysByWeek.get(weekIndex) || [];
      if (daysInWeek.length > 0) {
        // Add remaining posts to this week (up to a reasonable limit per day)
        const currentPostCount = distribution.get(weekIndex) || 0;
        // Allow up to 3 posts per day in worst case
        const maxPostsThisWeek = daysInWeek.length * 3;
        const additionalPosts = Math.min(remainingPosts, maxPostsThisWeek - currentPostCount);
        
        if (additionalPosts > 0) {
          distribution.set(weekIndex, currentPostCount + additionalPosts);
          remainingPosts -= additionalPosts;
        }
      }
    }
  }
  
  return distribution;
} 