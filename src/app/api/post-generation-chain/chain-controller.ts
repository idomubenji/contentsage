// @ts-ignore - Fix import errors temporarily while module structure is being fixed
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { format, addDays, getDay, isSameMonth } from 'date-fns';

import { 
  ChainParams, 
  ChainState, 
  ChainStep, 
  ElaboratedPost, 
  FinalPost, 
  PostIdea, 
  PostWithSeo,
  ScheduledPost,
  PlatformSetting 
} from './types';

// @ts-ignore - Import exists but TypeScript can't resolve it
import { 
  generatePostIdeasStep,
  elaboratePostsStep,
  generateSeoInfoStep,
  schedulePostsStep 
} from './chain-steps';
import { CalendarViewType } from '@/components/calendar/CalendarContext';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define the Platform type based on available platforms
type Platform = 'x' | 'linkedin' | 'instagram' | 'facebook' | 'web';

// Define scheduling constraints interface
interface PlatformSchedulingConstraint {
  validDays: number[];   // 0 = Sunday, 1 = Monday, etc.
  validHours: { start: number; end: number };
}

/**
 * Gets platform-specific scheduling constraints
 */
function getPlatformSchedulingConstraints(platform: Platform): PlatformSchedulingConstraint {
  switch (platform) {
    case 'web':
      return {
        validDays: [0], // Sunday only
        validHours: { start: 9, end: 17 } // 9 AM to 5 PM
      };
    case 'x':
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
    default:
      return {
        validDays: [1, 2, 3, 4, 5], // Weekdays
        validHours: { start: 9, end: 17 } // 9 AM to 5 PM
      };
  }
}

/**
 * Gets available days within a time frame that match the valid days of the week
 */
function getAvailableDaysInTimeFrame(
  startDate: Date,
  timeFrame: CalendarViewType,
  validDays: number[]
): Date[] {
  const availableDays: Date[] = [];
  const currentDate = new Date(startDate);
  const endDate = timeFrame === 'week' 
    ? addDays(startDate, 7) 
    : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day of current month
  
  // Iterate through each day in the time frame
  const currentDay = new Date(currentDate);
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
 * Generates a random time within the valid hours range
 */
function getRandomTimeInRange(validHours: { start: number; end: number }): string {
  const { start, end } = validHours;
  const hour = Math.floor(Math.random() * (end - start + 1)) + start;
  const minute = Math.random() < 0.5 ? 0 : 30; // Either 00 or 30 minutes
  
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Main function to execute the post generation chain
 */
export async function executePostGenerationChain(
  params: ChainParams,
  onProgressUpdate?: (state: ChainState) => void
): Promise<FinalPost[]> {
  // Initialize chain state
  let chainState: ChainState = {
    isGenerating: true,
    step: 'initializing',
    progress: 0,
    partialResults: {}
  };
  
  // Helper to update progress with logging
  const updateProgress = (step: ChainStep, progress: number) => {
    console.log(`Chain progress: ${step} - ${progress}%`);
    chainState.step = step;
    chainState.progress = progress;
    if (onProgressUpdate) {
      onProgressUpdate({...chainState});
    }
  };
  
  try {
    // Initial progress update
    updateProgress('initializing', 5);
    
    // Validate organization
    console.log('Validating organization:', params.organizationId);
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('name, preferences, info')
        .eq('id', params.organizationId)
        .single();

      if (orgError) {
        console.error('Organization lookup error:', orgError);
        throw new Error(`Organization lookup failed: ${orgError.message}`);
      }
      
      if (!orgData) {
        console.error('Organization not found:', params.organizationId);
        throw new Error('Organization not found');
      }
      
      console.log('Organization found:', orgData.name);
      updateProgress('initializing', 10);
      
      // Fetch recent posts for context to avoid duplication
      const { data: recentPosts, error: postsError } = await supabase
        .from('posts')
        .select('title, description, platform')
        .eq('organization_id', params.organizationId)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (postsError) {
        console.warn('Failed to fetch recent posts:', postsError);
        // Non-fatal error, continue with empty array
      }
      
      // Step 1: Generate post ideas
      updateProgress('generating-ideas', 15);
      console.log('Starting post idea generation');
      let postIdeas: PostIdea[] = [];
      try {
        postIdeas = await generatePostIdeasStep(
          params.platformSettings, 
          orgData.preferences?.industry || 'technology',
          orgData.preferences?.contentTone || 'professional',
          params.customPrompt, 
          recentPosts || [],
          orgData.info || {} // Pass the organization info for intent-based generation
        );
        
        if (!postIdeas || postIdeas.length === 0) {
          console.error('No post ideas were generated');
          throw new Error('No post ideas were generated');
        }
        
        console.log(`Generated ${postIdeas.length} post ideas`);
        chainState.partialResults.postIdeas = postIdeas;
        updateProgress('generating-ideas', 30);
      } catch (ideasError) {
        console.error('Error generating post ideas:', ideasError);
        throw new Error(ideasError instanceof Error ? 
          `Failed to generate post ideas: ${ideasError.message}` : 
          'Failed to generate post ideas');
      }
      
      // Step 2: Elaborate with content
      updateProgress('elaborating-content', 35);
      console.log('Elaborating post content');
      let elaboratedPosts: ElaboratedPost[] = [];
      try {
        elaboratedPosts = await elaboratePostsStep(
          postIdeas, 
          orgData.preferences?.contentTone || 'professional',
          orgData.info || {} // Pass the organization info for intent-based elaboration
        );
        
        if (!elaboratedPosts || elaboratedPosts.length === 0) {
          throw new Error('Failed to elaborate on post ideas');
        }
        
        console.log(`Elaborated ${elaboratedPosts.length} posts`);
        chainState.partialResults.elaboratedPosts = elaboratedPosts;
        updateProgress('elaborating-content', 55);
      } catch (elaborationError) {
        console.error('Error elaborating posts:', elaborationError);
        // If we have post ideas, we can return simplified posts even if elaboration failed
        if (postIdeas.length > 0) {
          const simplifiedPosts = postIdeas.map(idea => transformToFinalPost({
            ...idea,
            posted_date: format(new Date(), 'yyyy-MM-dd'),
            status: 'SUGGESTED' as const,
            reasonsData: { reasons: [], aiConfidence: 0 },
            elaboration: {
              content: idea.concept
            },
            seoSuggestions: []
          } as ScheduledPost, params.organizationId));
          
          updateProgress('complete', 100);
          chainState.partialResults.finalPosts = simplifiedPosts;
          return simplifiedPosts;
        }
        throw new Error('Failed to create post content');
      }
      
      // Step 3: Generate SEO information
      updateProgress('generating-seo', 60);
      console.log('Generating SEO information');
      let postsWithSeo: PostWithSeo[] = [];
      try {
        postsWithSeo = await generateSeoInfoStep(
          elaboratedPosts,
          orgData.info || {} // Pass the organization info for intent-based SEO
        );
        console.log(`Added SEO info to ${postsWithSeo.length} posts`);
        chainState.partialResults.postsWithSeo = postsWithSeo;
        updateProgress('generating-seo', 75);
      } catch (seoError) {
        console.error('Error generating SEO info:', seoError);
        // Fall back to posts without SEO
        postsWithSeo = elaboratedPosts.map(post => ({
          ...post,
          reasonsData: { 
            reasons: ['SEO analysis not available'],
            aiConfidence: 0.5
          }
        }));
      }
      
      // Step 4: Schedule posts
      updateProgress('scheduling-posts', 80);
      console.log('Scheduling posts');
      let scheduledPosts: ScheduledPost[] = [];
      try {
        // Ensure we have a valid date object for scheduling
        let schedulingDate: Date;
        
        if (typeof params.currentDate === 'string') {
          // Parse the date string into a Date object
          try {
            schedulingDate = new Date(params.currentDate);
            
            // Verify the date is valid
            if (isNaN(schedulingDate.getTime())) {
              console.warn(`Invalid date string provided: ${params.currentDate}, using current date`);
              schedulingDate = new Date();
            } else {
              // Log the parsed date for debugging
              console.log(`Using parsed date for scheduling: ${format(schedulingDate, 'yyyy-MM-dd')} (Month: ${schedulingDate.getMonth() + 1})`);
            }
          } catch (dateError) {
            console.error('Error parsing date string:', dateError);
            schedulingDate = new Date();
          }
        } else if (params.currentDate instanceof Date) {
          schedulingDate = params.currentDate;
          console.log(`Using Date object for scheduling: ${format(schedulingDate, 'yyyy-MM-dd')} (Month: ${schedulingDate.getMonth() + 1})`);
        } else {
          console.warn('No valid date provided, using current date');
          schedulingDate = new Date();
        }
        
        // Execute scheduling with validated date
        scheduledPosts = await schedulePostsStep(
          postsWithSeo, 
          params.timeFrame, 
          schedulingDate
        );
        console.log(`Scheduled ${scheduledPosts.length} posts starting from date: ${format(schedulingDate, 'yyyy-MM-dd')}`);
        chainState.partialResults.scheduledPosts = scheduledPosts;
        updateProgress('scheduling-posts', 95);
      } catch (schedulingError) {
        console.error('Error scheduling posts:', schedulingError);
        // Use simple scheduling as fallback
        scheduledPosts = postsWithSeo.map(post => ({
          ...post,
          posted_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'SUGGESTED' as const
        }));
      }
      
      // Transform to final format
      const finalPosts = scheduledPosts.map(post => transformToFinalPost(
        post, 
        params.organizationId
      ));
      
      // Mark as complete
      updateProgress('complete', 100);
      chainState.partialResults.finalPosts = finalPosts;
      
      return finalPosts;
    } catch (orgError) {
      console.error('Organization validation error:', orgError);
      updateProgress('error', 0);
      throw orgError instanceof Error ? orgError : new Error('Failed to validate organization details');
    }
  } catch (error) {
    console.error('Chain execution error:', error);
    chainState.isGenerating = false;
    chainState.step = 'error';
    chainState.error = error instanceof Error ? error.message : 'Unknown error';
    
    if (onProgressUpdate) {
      onProgressUpdate({...chainState});
    }
    
    // Return any partial results if available
    if (chainState.partialResults.scheduledPosts?.length) {
      return chainState.partialResults.scheduledPosts.map(post => 
        transformToFinalPost(post, params.organizationId)
      );
    }
    
    throw error;
  }
}

// Helper function to update progress - keeping for compatibility but not using directly
function updateProgress(
  state: ChainState, 
  callback?: (state: ChainState) => void
) {
  if (callback) {
    // Clone the state to avoid reference issues
    callback({...state});
  }
}

// Function to transform to final post format
// @ts-ignore - Parameter type issues will be fixed in a separate PR
function transformToFinalPost(
  post: ScheduledPost, 
  organizationId: string
): FinalPost {
  // Add debug logging for the incoming post
  console.log('DEBUG - transformToFinalPost INPUT:', {
    id: post.id,
    title: post.title,
    hasReasons: !!post.reasonsData?.reasons,
    reasonsCount: post.reasonsData?.reasons?.length || 0,
    reasonsData: post.reasonsData,
    aiConfidence: post.reasonsData?.aiConfidence
  });
  
  // Extract scheduled time if present in the description
  let scheduledTime: string | undefined;
  let cleanDescription = post.description || '';
  
  // Check if description has a scheduled time marker
  const timeMatch = cleanDescription.match(/\[Scheduled at (\d{1,2}:\d{2})\]/);
  if (timeMatch) {
    scheduledTime = timeMatch[1];
    // Remove the time marker from the description
    cleanDescription = cleanDescription.replace(/\[Scheduled at \d{1,2}:\d{2}\]\s*/, '');
  }
  
  // If no description is provided, generate one from elaboration data
  if (!post.description) {
    cleanDescription = post.elaboration.content || 
      (post.elaboration.bulletPoints ? post.elaboration.bulletPoints.join('\n') : '') ||
      post.concept;
  }
  
  // Create metadata object
  const metadata = {
    scheduledTime: scheduledTime || '12:00', // Default to noon if no time specified
    seoReasons: post.reasonsData?.reasons || [],
    seoConfidence: post.reasonsData?.aiConfidence || 0,
    // Add other metadata as needed
  };
  
  // Format the final description without metadata comment
  const finalDescription = cleanDescription.trim();
  
  // Use the original reasonsData and add the scheduled time and confidence as additional reasons
  const seoInfo = {
    reasonsData: {
      reasons: [
        ...(post.reasonsData?.reasons || []),
        `Scheduled Time: ${metadata.scheduledTime}`,
        `SEO Confidence: ${(metadata.seoConfidence * 100).toFixed(0)}%`,
      ],
      aiConfidence: post.reasonsData?.aiConfidence || 0.5
    }
  };
  
  // Debug log the created seo_info object
  console.log('DEBUG - transformToFinalPost seoInfo:', {
    reasonsCount: seoInfo.reasonsData.reasons.length,
    reasons: seoInfo.reasonsData.reasons,
    aiConfidence: seoInfo.reasonsData.aiConfidence
  });
  
  const finalPost = {
    title: post.title,
    description: finalDescription,
    platform: post.platform,
    format: post.format,
    url: post.url || `https://example.com/posts/${post.id}`, // Placeholder URL
    user_id: post.user_id || 'system', // This would be replaced with actual user ID
    organization_id: organizationId,
    status: post.status || 'SUGGESTED',
    posted_date: post.posted_date,
    seo_info: seoInfo,
    derivedFrom: post.derivedFrom
  };
  
  // Debug log the final post object
  console.log('DEBUG - transformToFinalPost OUTPUT:', {
    title: finalPost.title,
    platform: finalPost.platform,
    hasSeoInfo: !!finalPost.seo_info,
    seoReasonCount: finalPost.seo_info?.reasonsData?.reasons?.length || 0
  });
  
  return finalPost;
}

function schedulePostsForPlatform(
  posts: PostWithSeo[],
  platform: Platform,
  timeFrame: CalendarViewType,
  currentDate: Date
): PostWithSeo[] {
  if (!posts.length) return [];

  // Define platform-specific scheduling constraints
  const platformConstraints = getPlatformSchedulingConstraints(platform);
  const { validDays, validHours } = platformConstraints;

  // Calculate available days within the time frame
  const availableDays = getAvailableDaysInTimeFrame(
    currentDate,
    timeFrame,
    validDays
  );

  if (availableDays.length === 0) {
    console.warn(`No valid days found for ${platform} in the selected time frame`);
    return posts; // Return unscheduled posts
  }

  console.log(`Platform ${platform} has ${availableDays.length} valid days in the ${timeFrame}`);
  
  // Track which days have already been used for scheduling
  const usedDates = new Map<string, number>();
  
  return posts.map((post, index) => {
    // Convert availableDays to a list of formatted dates
    const availableDateStrings = availableDays.map(day => 
      format(day, 'yyyy-MM-dd')
    );
    
    // Find dates that have been used the least
    let prioritizedDates = [...availableDateStrings];
    
    // Sort by usage count (less used dates first)
    prioritizedDates.sort((a, b) => {
      const countA = usedDates.get(a) || 0;
      const countB = usedDates.get(b) || 0;
      return countA - countB;
    });
    
    // Select the least used date
    const selectedDate = prioritizedDates[0];
    
    // Update usage count
    const currentCount = usedDates.get(selectedDate) || 0;
    usedDates.set(selectedDate, currentCount + 1);
    
    // Log distribution info
    if (index === 0) {
      console.log(`Starting distribution for ${platform} posts`);
    }
    
    // Select an appropriate time within the valid hours
    const selectedTime = getRandomTimeInRange(validHours);
    
    // Add time to description for now (later this will be in the database)
    const updatedDescription = post.elaboration.content || post.concept;
    const descriptionWithTime = `[Scheduled at ${selectedTime}] ${updatedDescription}`;
    
    return {
      ...post,
      posted_date: selectedDate,
      description: descriptionWithTime,
      status: 'SUGGESTED'
    };
  });
} 