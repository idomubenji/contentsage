// @ts-ignore - Fix import errors temporarily while module structure is being fixed
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { 
  ChainParams, 
  ChainState, 
  PostIdea, 
  ElaboratedPost, 
  PostWithSeo, 
  ScheduledPost
} from '../post-generation-chain/types';
import { 
  generatePostIdeasStep, 
  elaboratePostsStep, 
  generateSeoInfoStep, 
  schedulePostsStep
} from '../post-generation-chain/chain-steps';
import { updateChainProgress, getChainProgress } from '../post-generation-chain/progress-store';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define our internal FinalPost interface to match our database schema
interface ChainFinalPost {
  id: string;
  title: string;
  description: string;
  platform: string;
  posted_date: string;
  status: string;
  organization_id: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// Function to transform scheduled post to final post format
function transformToFinalPost(post: ScheduledPost, organizationId: string): ChainFinalPost {
  // Get SEO data safely
  let seoTitle = post.title;
  let seoDescription = '';
  let seoKeywords = '';
  
  if (post.seoSuggestions && post.seoSuggestions.length > 0) {
    const seo = post.seoSuggestions[0];
    if (seo && typeof seo === 'object') {
      if (seo.title && typeof seo.title === 'string') {
        seoTitle = seo.title;
      }
      
      if (seo.description && typeof seo.description === 'string') {
        seoDescription = seo.description;
      }
      
      if (seo.keywords && Array.isArray(seo.keywords)) {
        seoKeywords = seo.keywords.join(',');
      }
    }
  }
  
  // Create a final post from a scheduled post
  return {
    id: post.id,
    title: post.title,
    description: post.elaboration?.content || post.concept,
    platform: post.platform,
    posted_date: post.posted_date,
    status: post.status,
    organization_id: organizationId,
    seo_title: seoTitle,
    seo_description: seoDescription,
    seo_keywords: seoKeywords,
    is_published: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * API endpoint to process a specific step in the chain
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { 
      chainId,
      step, 
      timeFrame, 
      currentDate, 
      organizationId,
      platformSettings,
      customPrompt
    } = body;
    
    if (!chainId || !step || !organizationId) {
      return NextResponse.json(
        { error: `Missing required parameters: chainId, step, and organizationId are required` },
        { status: 400 }
      );
    }
    
    console.log(`Processing chain step: ${step} for chain ${chainId}`);
    
    // Get current chain state
    const currentState = await getChainProgress(chainId);
    if (!currentState) {
      return NextResponse.json(
        { error: `Chain not found with ID: ${chainId}` },
        { status: 404 }
      );
    }
    
    // Parse date if provided
    let validatedDate: Date = new Date();
    if (currentDate) {
      validatedDate = new Date(currentDate);
      if (isNaN(validatedDate.getTime())) {
        return NextResponse.json(
          { error: `Invalid currentDate format` },
          { status: 400 }
        );
      }
    }
    
    // Handle different steps
    switch (step) {
      case 'generate-ideas': {
        // Update progress to indicate we're generating ideas
        await updateChainProgress(chainId, {
          isGenerating: true,
          step: 'generating-ideas',
          progress: 15,
          partialResults: currentState.partialResults
        });
        
        // Fetch the organization data
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('name, preferences, info')
          .eq('id', organizationId)
          .single();

        if (orgError) {
          console.error('Organization lookup error:', orgError);
          throw new Error(`Organization lookup failed: ${orgError.message}`);
        }
        
        if (!orgData) {
          console.error('Organization not found:', organizationId);
          throw new Error('Organization not found');
        }
        
        // Fetch recent posts for context
        const { data: recentPosts, error: postsError } = await supabase
          .from('posts')
          .select('title, description, platform')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(10);

        const orgCustomPrompts = orgData.preferences?.customPrompts || {};
        // Use provided platform settings or fall back to state (if available)
        const platformSettingsToUse = platformSettings || 
          (currentState.partialResults as any).platformSettings || [];
        const customPromptToUse = customPrompt || 
          (currentState.partialResults as any).customPrompt || '';
          
        if (!platformSettingsToUse || platformSettingsToUse.length === 0) {
          return NextResponse.json(
            { error: `Missing platform settings. Provide platformSettings in the request.` },
            { status: 400 }
          );
        }
        
        // Generate post ideas
        const postIdeas = await generatePostIdeasStep(
          platformSettingsToUse, 
          orgData.preferences?.industry || 'technology',
          orgData.preferences?.contentTone || 'professional',
          customPromptToUse,
          recentPosts || [],
          {
            ...orgData.info || {},
            customPrompts: orgCustomPrompts
          }
        );
        
        // Store simplified post ideas in the chain state to reduce data size
        const simplifiedPostIdeas = postIdeas.map((idea: PostIdea) => ({
          id: idea.id,
          title: idea.title,
          concept: idea.concept,
          platform: idea.platform,
          format: idea.format
        }));
        
        // Use type assertion to update with extended data
        await updateChainProgress(chainId, {
          isGenerating: true,
          step: 'generating-ideas',
          progress: 30,
          partialResults: {
            ...currentState.partialResults,
            postIdeas: simplifiedPostIdeas as PostIdea[],
            platformSettings: platformSettingsToUse,
            customPrompt: customPromptToUse,
            orgInfo: {
              preferences: orgData.preferences,
              info: orgData.info
            }
          } as any // Use type assertion to bypass type checking
        });
        
        // Return with the next step
        return NextResponse.json({ 
          success: true, 
          chainId,
          step: 'generate-ideas',
          nextStep: 'elaborate-posts',
          message: 'Post ideas generated successfully.',
          count: simplifiedPostIdeas.length
        });
      }
      
      case 'elaborate-posts': {
        // We'll use type assertion for the state
        const enhancedState = currentState as any;
        
        // Update progress
        await updateChainProgress(chainId, {
          isGenerating: true,
          step: 'elaborating-content',
          progress: 35,
          partialResults: currentState.partialResults
        });
        
        // Check for post ideas
        if (!enhancedState.partialResults.postIdeas || 
            enhancedState.partialResults.postIdeas.length === 0) {
          return NextResponse.json(
            { error: `No post ideas found. Run the generate-ideas step first.` },
            { status: 400 }
          );
        }
        
        const orgInfo = enhancedState.partialResults.orgInfo || {};
        const orgCustomPrompts = orgInfo.preferences?.customPrompts || {};
        
        // Elaborate the posts
        const elaboratedPosts = await elaboratePostsStep(
          enhancedState.partialResults.postIdeas, 
          orgInfo.preferences?.contentTone || 'professional',
          {
            ...orgInfo.info || {},
            customPrompts: orgCustomPrompts
          }
        );
        
        // Store simplified elaborated posts to reduce data size
        const simplifiedElaboratedPosts = elaboratedPosts.map((post: ElaboratedPost) => ({
          id: post.id,
          title: post.title,
          platform: post.platform,
          concept: post.concept,
          format: post.format,
          elaboration: {
            content: post.elaboration?.content ? 
              post.elaboration.content.substring(0, 100) + '...' : 
              'Content preview not available'
          }
        }));
        
        // Update progress
        await updateChainProgress(chainId, {
          isGenerating: true,
          step: 'elaborating-content',
          progress: 55,
          partialResults: {
            ...enhancedState.partialResults,
            elaboratedPosts: simplifiedElaboratedPosts as ElaboratedPost[]
          }
        });
        
        // Return with the next step
        return NextResponse.json({
          success: true,
          chainId,
          step: 'elaborate-posts',
          nextStep: 'generate-seo',
          message: 'Posts elaborated successfully.',
          count: simplifiedElaboratedPosts.length
        });
      }
      
      case 'generate-seo': {
        // We'll use type assertion for the state
        const enhancedState = currentState as any;
        
        // Update progress
        await updateChainProgress(chainId, {
          isGenerating: true,
          step: 'generating-seo',
          progress: 60,
          partialResults: currentState.partialResults
        });
        
        // Check for elaborated posts
        if (!enhancedState.partialResults.elaboratedPosts || 
            enhancedState.partialResults.elaboratedPosts.length === 0) {
          return NextResponse.json(
            { error: `No elaborated posts found. Run the elaborate-posts step first.` },
            { status: 400 }
          );
        }
        
        const orgInfo = enhancedState.partialResults.orgInfo || {};
        
        // Generate SEO info
        const postsWithSeo = await generateSeoInfoStep(
          enhancedState.partialResults.elaboratedPosts,
          {
            ...orgInfo.info || {},
            customPrompts: orgInfo.preferences?.customPrompts || {}
          }
        );
        
        // Update progress
        await updateChainProgress(chainId, {
          isGenerating: true,
          step: 'generating-seo',
          progress: 75,
          partialResults: {
            ...enhancedState.partialResults,
            postsWithSeo
          }
        });
        
        // Return with the next step
        return NextResponse.json({
          success: true,
          chainId,
          step: 'generate-seo',
          nextStep: 'schedule-posts',
          message: 'SEO information generated successfully.',
          count: postsWithSeo.length
        });
      }
      
      case 'schedule-posts': {
        // We'll use type assertion for the state
        const enhancedState = currentState as any;
        
        // Update progress
        await updateChainProgress(chainId, {
          isGenerating: true,
          step: 'scheduling-posts',
          progress: 80,
          partialResults: currentState.partialResults
        });
        
        // Check for posts with SEO
        if (!enhancedState.partialResults.postsWithSeo || 
            enhancedState.partialResults.postsWithSeo.length === 0) {
          return NextResponse.json(
            { error: `No posts with SEO found. Run the generate-seo step first.` },
            { status: 400 }
          );
        }
        
        // Validate timeFrame
        const chainTimeFrame = timeFrame || enhancedState.partialResults.timeFrame;
        if (!chainTimeFrame || !['day', 'week', 'month', 'year'].includes(chainTimeFrame)) {
          return NextResponse.json(
            { error: `Invalid or missing timeFrame. Must be one of: day, week, month, year` },
            { status: 400 }
          );
        }
        
        // Schedule posts
        const scheduledPosts = await schedulePostsStep(
          enhancedState.partialResults.postsWithSeo,
          chainTimeFrame,
          validatedDate,
          []
        );
        
        // Transform to final posts
        const finalPosts = scheduledPosts.map((post: ScheduledPost) => 
          transformToFinalPost(post, organizationId)
        );
        
        // Update progress with completion
        await updateChainProgress(chainId, {
          isGenerating: false,
          step: 'complete',
          progress: 100,
          partialResults: {
            ...enhancedState.partialResults,
            scheduledPosts,
            finalPosts: finalPosts as any, // Type assertion
            timeFrame: chainTimeFrame
          }
        });
        
        // Return with completion
        return NextResponse.json({
          success: true,
          chainId,
          step: 'schedule-posts',
          nextStep: 'complete',
          message: 'Posts scheduled successfully.',
          posts: finalPosts
        });
      }
      
      default:
        return NextResponse.json({
          error: `Unknown step: ${step}`,
          validSteps: ['generate-ideas', 'elaborate-posts', 'generate-seo', 'schedule-posts']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error processing chain step:', error);
    
    return NextResponse.json({ 
      error: error instanceof Error ? 
        `Failed to process step: ${error.message}` : 
        'Unknown error during step processing',
      code: 'API_ERROR',
      details: error
    }, { status: 500 });
  }
} 