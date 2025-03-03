import { CalendarViewType } from '@/components/calendar/CalendarContext';

// Base types for the chain operation
export type ChainStep = 
  | 'initializing' 
  | 'generating-ideas' 
  | 'elaborating-content' 
  | 'generating-seo' 
  | 'scheduling-posts' 
  | 'complete'
  | 'error';

export interface ChainState {
  isGenerating: boolean;
  step: ChainStep;
  progress: number;
  error?: string;
  partialResults: {
    postIdeas?: PostIdea[];
    elaboratedPosts?: ElaboratedPost[];
    postsWithSeo?: PostWithSeo[];
    scheduledPosts?: ScheduledPost[];
    finalPosts?: FinalPost[];
  };
}

// Platform configuration
export interface PlatformSetting {
  platform: string;
  count: number;
  min?: number;
  max?: number;
  logo?: string;
}

// Chain input parameters
export interface ChainParams {
  timeFrame: CalendarViewType;
  currentDate: string | Date;
  platformSettings: PlatformSetting[];
  customPrompt?: string;
  organizationId: string;
}

// Step 1: Post ideas generation
export interface PostIdea {
  id: string;
  title: string;
  platform: string;
  concept: string;
  format: string;
  derivedFrom?: string; // For social posts derived from web content
}

// Step 2: Content elaboration
export interface ElaboratedPost extends PostIdea {
  elaboration: {
    bulletPoints?: string[];
    structure?: string;
    content?: string;
    hashtags?: string[];
    visualSuggestion?: string;
  };
  needsRetry?: boolean;
}

// Step 3: SEO Information
export interface PostWithSeo extends ElaboratedPost {
  reasonsData: {
    reasons: string[];
    aiConfidence: number;
  };
  seoSuggestions?: string[];
}

// Step 4: Scheduled Posts
export interface ScheduledPost extends PostWithSeo {
  posted_date: string;
  url?: string;
  description?: string;
  status: 'POSTED' | 'SCHEDULED' | 'SUGGESTED';
  user_id?: string;
  organization_id?: string;
  // derivedFrom is inherited from PostIdea via PostWithSeo, but we'll document it here for clarity
  // derivedFrom?: string;
}

// Final output ready for database
export interface FinalPost {
  id?: string;
  title: string;
  description: string;
  platform: string;
  format: string;
  url?: string;
  user_id: string;
  organization_id: string;
  status: 'POSTED' | 'SCHEDULED' | 'SUGGESTED';
  posted_date: string;
  seo_info?: { reasonsData: PostWithSeo['reasonsData'] };
  derivedFrom?: string; // For social posts derived from web content
} 