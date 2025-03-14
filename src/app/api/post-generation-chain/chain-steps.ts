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
    
  // Debug logging for platform requests
  console.log('DEBUG - Platform Settings:', platformSettings);
  console.log('DEBUG - Individual Platform Requests:');
  platformSettings.forEach(p => {
    console.log(`  - Platform: ${p.platform}, Count: ${p.count}`);
  });
  console.log('DEBUG - Combined Platform Requests:', platformRequests);
  
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
  
  // Add debug logging for request summary preparation
  console.log('DEBUG - Starting request summary preparation');
  console.log('DEBUG - Platform requests type:', typeof platformRequests);
  console.log('DEBUG - Platform requests value:', platformRequests);

  // Check if platformRequests is an array
  if (Array.isArray(platformRequests)) {
    console.log('DEBUG - Platform requests is an array, mapping...');
    requestSummary = platformRequests
      .map((req) => {
        console.log('DEBUG - Processing request:', req);
        return `${req.count} ${req.platform} posts${req.platform === "Web" ? " (blog format)" : ""}`;
      })
      .join(", ");
  } else {
    console.log('DEBUG - Platform requests is not an array, using as is');
    requestSummary = platformRequests;
  }
  
  console.log('DEBUG - Final request summary:', requestSummary);

  // Construct organization context with inconsistency handling
  let organizationContext = "";
  if (organizationInfo && Object.keys(organizationInfo).length > 0) {
    organizationContext = `
    Organization information:
    - Industry: ${organizationInfo.industry || "Not specified"}
    - Brand voice: ${organizationInfo.voice || "Not specified"}
    - Key focus areas: ${organizationInfo.interests?.join(", ") || "Not specified"}
    - Target audience: ${organizationInfo.targetAudience || "Not specified"}
    
    IMPORTANT: If there appears to be any inconsistency between the Content Focus below and the organization information above, PRIORITIZE the Content Focus. Otherwise, use both to inform your suggestions harmoniously. Furthermore, Unless otherwise specified, Content Focus should only be applied to 3 posts. Any more is overkill. User can only override this instruction by specifying a number of posts. If the user specifies a specific time, you should also honor that.
    `;
  }

  // Content focus description
  let contentFocusDescription = customPrompt
    ? `Content Focus: ${customPrompt}`
    : "No specific content focus provided.";

  // Add organization's custom prompts if available
  if (organizationInfo?.customPrompts && Object.keys(organizationInfo.customPrompts).length > 0) {
    const customPromptsText = Object.entries(organizationInfo.customPrompts)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    contentFocusDescription += `\n\nOrganization Custom Prompts to follow: \n${customPromptsText}\n\nYou MUST apply these custom prompt requirements to ALL generated content.`;
  }

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
    2. TargetPlatform - MUST be exactly one of: [${platformSettings.map((r) => `"${r.platform}"`).join(", ")}] - DO NOT use alternative names like "Twitter" for "𝕏"
    3. BriefConcept - A clear description of what the post will cover
    4. Format - "blog" for Web platform, "social" for social media platforms
    5. DerivedFrom - For social posts that promote a blog post, reference the blog post's title here
    
    IMPORTANT GUIDELINES:
    - PRIORITIZE fulfilling the requested number of posts for each platform (e.g., if ${platformSettings[0].count} ${platformSettings[0].platform} posts are requested, generate exactly ${platformSettings[0].count})
    - Make ${platformSettings[0].platform} posts concise and engaging (especially ${platformSettings[0].platform} which has character limits)
    - NOT ALL social posts need to be derived from blog content - only derive when it makes sense
    - If there are more social posts requested than blog posts, create original social posts that aren't derived from blogs
    - Ensure a diverse mix of topics across all platforms
    - DO NOT generate posts for platforms that weren't requested
    - NEVER use hashtags. They are outdated.
    
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
      console.log('DEBUG - Parsed AI Response:', parsedResponse);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      console.log('Raw response:', content);
      
      // Fall back to a simple array if parsing fails
      parsedResponse = { ideas: [] };
    }
    
    // Transform to PostIdea format and add IDs
    console.log('DEBUG - Before transformation - Ideas count:', parsedResponse.ideas?.length);
    console.log('DEBUG - Before transformation - Platform types:', parsedResponse.ideas?.map((idea: any) => idea.TargetPlatform || idea.platform));
    
    const transformedPosts = (parsedResponse.ideas || []).map((idea: any) => {
      const transformedPost = {
        id: uuidv4(),
        title: idea.Title || idea.title || 'Untitled post',
        platform: idea.TargetPlatform || idea.platform || 'Web',
        concept: idea.BriefConcept || idea.concept || 'Content idea generated by AI',
        format: idea.Format || idea.format || (idea.TargetPlatform === 'Web' ? 'blog' : 'social'),
        derivedFrom: idea.DerivedFrom || idea.derivedFrom || ''
      };
      console.log('DEBUG - Transformed post:', {
        title: transformedPost.title,
        platform: transformedPost.platform,
        originalPlatform: idea.TargetPlatform || idea.platform
      });
      return transformedPost;
    });

    console.log('DEBUG - After transformation - Posts count:', transformedPosts.length);
    console.log('DEBUG - After transformation - Platform types:', transformedPosts.map((post: PostIdea) => post.platform));
    
    return transformedPosts;
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
  
  // Extract custom prompts if available
  let customPromptsText = '';
  if (organizationInfo?.customPrompts && Object.keys(organizationInfo.customPrompts).length > 0) {
    customPromptsText = Object.entries(organizationInfo.customPrompts)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
  
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
          
          ${customPromptsText ? `CUSTOM PROMPTS TO FOLLOW:\n${customPromptsText}\n\nYou MUST apply these custom prompt requirements to the content.` : ''}
          `;
        }
        
        // Get platform-specific instructions
        let platformSpecificInstructions = "";
        if (idea.platform === "X" || idea.platform === "𝕏") {
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
          - content: ${(idea.platform === "X" || idea.platform === "𝕏") ? "BRIEF content (under 280 characters)" : "The suggested caption"} for the ${idea.platform} post
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
  
  // Extract custom prompts if available
  let customPromptsText = '';
  if (organizationInfo?.customPrompts && Object.keys(organizationInfo.customPrompts).length > 0) {
    customPromptsText = Object.entries(organizationInfo.customPrompts)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
  
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
        
        ${customPromptsText ? `CUSTOM PROMPTS TO FOLLOW:\n${customPromptsText}\n\nYou MUST apply these custom prompt requirements when suggesting SEO improvements.` : ''}
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
  currentDate: Date,
  existingPosts: PostWithSeo[] = []
): Promise<ScheduledPost[]> {
  console.log("SCHEDULING DEBUG - Input currentDate:", currentDate);
  console.log("SCHEDULING DEBUG - Input currentDate type:", typeof currentDate);
  console.log("SCHEDULING DEBUG - Input currentDate ISO:", currentDate.toISOString());
  console.log("SCHEDULING DEBUG - Posts count:", posts.length);
  console.log("SCHEDULING DEBUG - Existing posts count:", existingPosts.length);
  
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
    
    const result = schedulePostsEvenly(posts, timeFrame, safeCurrentDate, existingPosts);
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
  
  // Simple scheduling logic that respects platform constraints
  const result: ScheduledPost[] = [];
  const safeDate = new Date(currentDate);
  
  // Use first day of the month for month planning
  if (timeFrame === "month") {
    safeDate.setDate(1);
  }
  
  // Determine number of days to distribute posts over
  const daysToDistribute = timeFrame === "month" ? 28 : (timeFrame === "week" ? 7 : 14);
  
  // Group posts by platform
  const groupedPosts: Record<string, PostWithSeo[]> = {};
  
  for (const post of posts) {
    if (!groupedPosts[post.platform]) {
      groupedPosts[post.platform] = [];
    }
    groupedPosts[post.platform].push(post);
  }
  
  // Schedule posts for each platform
  Object.keys(groupedPosts).forEach(platform => {
    const platformPosts = groupedPosts[platform];
    const { validDays, validHours } = getPlatformSchedulingConstraints(platform);
    
    // Find valid days within the time frame
    const validDates: Date[] = [];
    const currentDay = new Date(safeDate);
    const endDate = new Date(safeDate);
    endDate.setDate(endDate.getDate() + daysToDistribute - 1);
    
    while (currentDay <= endDate) {
      if (validDays.includes(currentDay.getDay())) {
        validDates.push(new Date(currentDay));
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    // If no valid dates found, use all days as fallback
    if (validDates.length === 0) {
      const currentDay = new Date(safeDate);
      while (currentDay <= endDate) {
        validDates.push(new Date(currentDay));
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }
    
    // Schedule each post
    for (let i = 0; i < platformPosts.length; i++) {
      // Distribute posts evenly across valid dates
      const dateIndex = i % validDates.length;
      const postDate = new Date(validDates[dateIndex]);
      
      // Set time within valid hours for the platform
      const hour = validHours.start + Math.floor(Math.random() * (validHours.end - validHours.start));
      const minute = Math.floor(Math.random() * 60);
      postDate.setHours(hour, minute, 0, 0);
      
      result.push({
        ...platformPosts[i],
        posted_date: postDate.toISOString(),
        status: 'SCHEDULED'
      });
    }
  });
  
  // Sort by date
  return result.sort((a, b) => new Date(a.posted_date).getTime() - new Date(b.posted_date).getTime());
}

export function schedulePostsEvenly(
  posts: PostWithSeo[],
  timeFrame: CalendarViewType,
  currentDate: Date,
  existingPosts: PostWithSeo[] = []
): ScheduledPost[] {
  console.log("SCHEDULING EVENLY - Start date:", currentDate.toISOString());
  console.log("DEBUG - Posts to schedule:", posts.map(p => ({
    title: p.title,
    platform: p.platform,
    format: p.format
  })));
  
  // Group posts by platform
  const groupedPosts: Record<string, PostWithSeo[]> = {};
  
  for (const post of posts) {
    if (!groupedPosts[post.platform]) {
      groupedPosts[post.platform] = [];
    }
    groupedPosts[post.platform].push(post);
    console.log(`DEBUG - Grouping post "${post.title}" under platform: ${post.platform}`);
  }
  
  console.log('DEBUG - Grouped posts by platform:', Object.keys(groupedPosts).map(platform => ({
    platform,
    count: groupedPosts[platform].length
  })));
  
  // Get constraints for each platform directly from getPlatformSchedulingConstraints
  const platformConstraints: Record<string, {
    validDays: number[],
    validHours: { start: number, end: number }
  }> = {};
  
  Object.keys(groupedPosts).forEach(platform => {
    platformConstraints[platform] = getPlatformSchedulingConstraints(platform);
  });
  
  // Start and end dates for the planning period - make a proper copy of the date
  let startDate = new Date(currentDate.getTime());
  let endDate = getEndDateForTimeFrame(startDate, timeFrame);
  
  console.log(`SCHEDULING EVENLY - Planning from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const scheduledPosts: ScheduledPost[] = [];
  const usedPosts = new Set<string>(); // Track which posts have been scheduled to avoid duplicates
  
  // Group existing posts by platform and week
  const existingPostsByPlatformAndWeek: Record<string, Record<number, PostWithSeo[]>> = {};
  
  // Process existing posts if available
  if (existingPosts && existingPosts.length > 0) {
    console.log(`Processing ${existingPosts.length} existing posts for scheduling consideration`);
    
    for (const existingPost of existingPosts) {
      const platform = existingPost.platform;
      // Use type assertion to access posted_date, with a fallback
      const postDate = new Date((existingPost as any).posted_date || currentDate);
      const weekNumber = getWeekNumberInTimeFrame(postDate, startDate);
      
      if (!existingPostsByPlatformAndWeek[platform]) {
        existingPostsByPlatformAndWeek[platform] = {};
      }
      
      if (!existingPostsByPlatformAndWeek[platform][weekNumber]) {
        existingPostsByPlatformAndWeek[platform][weekNumber] = [];
      }
      
      existingPostsByPlatformAndWeek[platform][weekNumber].push(existingPost);
    }
  }
  
  // Divide the time frame into weeks
  const weeks = groupDaysByWeek(startDate, endDate);
  const totalWeeks = weeks.length;
  console.log(`Time frame divided into ${totalWeeks} weeks`);
  
  // For each platform, schedule posts
  Object.keys(groupedPosts).forEach(platform => {
    const platformType = platform as string;
    const platformPosts = groupedPosts[platform];
    const { validDays, validHours } = platformConstraints[platform];
    
    console.log(`Platform ${platform} has ${platformPosts.length} posts to schedule`);
    console.log(`Valid days for ${platform}: ${validDays.join(', ')}`);
    
    // Track which weeks already have posts for this platform
    const postsPerWeek: Record<number, number> = {};
    const daysWithPostsInWeek: Record<number, Set<number>> = {};
    
    // Initialize tracking arrays
    for (let i = 0; i < totalWeeks; i++) {
      postsPerWeek[i] = 0;
      daysWithPostsInWeek[i] = new Set<number>();
      
      // Account for existing posts
      if (existingPostsByPlatformAndWeek[platform] && 
          existingPostsByPlatformAndWeek[platform][i]) {
        postsPerWeek[i] = existingPostsByPlatformAndWeek[platform][i].length;
        
        for (const existingPost of existingPostsByPlatformAndWeek[platform][i]) {
          // Use type assertion to access posted_date
          const existingDate = new Date((existingPost as any).posted_date || currentDate);
          daysWithPostsInWeek[i].add(existingDate.getDay());
        }
      }
    }
    
    // Process each post
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
      
      // Find the earliest week that doesn't have a post for this platform yet
      let targetWeek = -1;
      for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
        if (postsPerWeek[weekIndex] === 0) {
          targetWeek = weekIndex;
          break;
        }
      }
      
      // If all weeks have at least one post, find the week with the fewest posts
      if (targetWeek === -1) {
        let minPosts = Infinity;
        for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
          if (postsPerWeek[weekIndex] < minPosts) {
            minPosts = postsPerWeek[weekIndex];
            targetWeek = weekIndex;
          }
        }
      }
      
      // Determine which day to use within the target week
      const weekStart = weeks[targetWeek].start;
      const weekEnd = weeks[targetWeek].end;
      
      // Find all valid days in this week that match platform constraints
      const validDatesInWeek: Date[] = [];
      const currentDay = new Date(weekStart);
      
      while (currentDay <= weekEnd) {
        const dayOfWeek = getDay(currentDay);
        if (validDays.includes(dayOfWeek) && !daysWithPostsInWeek[targetWeek].has(dayOfWeek)) {
          validDatesInWeek.push(new Date(currentDay));
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }
      
      let selectedDate: Date;
      
      if (validDatesInWeek.length > 0) {
        // Choose the first available valid date
        selectedDate = validDatesInWeek[0];
      } else if (validDays.length > 0) {
        // If no valid dates are available in this week (all taken), 
        // choose the next day after the current latest scheduled day
        const latestDayInWeek = Array.from(daysWithPostsInWeek[targetWeek])
          .sort((a, b) => a - b)
          .pop() || validDays[0];
        
        // Find the next valid day after the latest day
        let nextDay = latestDayInWeek + 1;
        while (!validDays.includes(nextDay % 7)) {
          nextDay++;
        }
        nextDay = nextDay % 7;
        
        // Create a date for this day in the target week
        selectedDate = new Date(weekStart);
        while (getDay(selectedDate) !== nextDay) {
          selectedDate.setDate(selectedDate.getDate() + 1);
          if (selectedDate > weekEnd) {
            // Wrap around to the beginning of the week if necessary
            selectedDate = new Date(weekStart);
          }
        }
      } else {
        // Fallback to any day in the week if no valid days specified
        selectedDate = new Date(weekStart);
      }
      
      // Set a time based on platform's valid hours
      const hour = validHours.start + Math.floor(Math.random() * (validHours.end - validHours.start));
      const minute = Math.floor(Math.random() * 60);
      selectedDate.setHours(hour, minute, 0, 0);
      
      // Update tracking for this week
      postsPerWeek[targetWeek]++;
      daysWithPostsInWeek[targetWeek].add(getDay(selectedDate));
      
      // Create scheduled post
      scheduledPosts.push({
        ...post,
        posted_date: selectedDate.toISOString(), // Convert Date to string
        status: 'SCHEDULED' // Add default status
      });
      
      console.log(`Scheduled "${post.title}" for ${selectedDate.toISOString()} (Week ${targetWeek + 1})`);
    }
  });
  
  // Sort by date (first convert strings back to Date objects for comparison)
  return scheduledPosts.sort((a, b) => new Date(a.posted_date).getTime() - new Date(b.posted_date).getTime());
}

/**
 * Gets the week number within a time frame
 */
function getWeekNumberInTimeFrame(date: Date, startDate: Date): number {
  const diffTime = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
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
      return {
        validDays: [1, 2], // Monday and Tuesday
        validHours: { start: 10, end: 13 } // 10 AM to 1 PM
      };
      case '𝕏':
        return {
          validDays: [1, 2], // Monday and Tuesday
          validHours: { start: 10, end: 13 } // 10 AM to 1 PM
        };
    case 'twitter':
      return {
        validDays: [1, 2], // Monday and Tuesday
        validHours: { start: 10, end: 13 } // 10 AM to 1 PM
      };
    case 'linkedin':
      return {
        validDays: [2, 3, 4], // Tuesday, Wednesday, Thursday
        validHours: { start: 10, end: 14 } // 10 AM to 2 PM
      };
    case 'instagram':
      return {
        validDays: [2, 3, 4], // Tuesday, Wednesday, Thursday
        validHours: { start: 10, end: 14 } // 10 AM to 2 PM
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
  
  // Note: We no longer need to adjust the start day here since 
  // getEndDateForTimeFrame now properly sets the date range for the entire month
  
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
    // Always include the full month - first set to the first day of the month
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    
    // Start from the first day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    
    // Last day of current month
    endDate = new Date(year, month + 1, 0);
    
    // Update the startDate reference to be the first day of the month
    startDate.setDate(1);
    
    console.log(`Month timeframe: Using full month from ${format(firstDayOfMonth, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
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