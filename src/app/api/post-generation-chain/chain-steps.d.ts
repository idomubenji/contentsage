import { 
  PostIdea, 
  ElaboratedPost, 
  PostWithSeo, 
  ScheduledPost,
  PlatformSetting
} from './types';
import { CalendarViewType } from '@/components/calendar/CalendarContext';

/**
 * Step 1: Generate post ideas based on platform settings
 */
export declare function generatePostIdeasStep(
  platformSettings: PlatformSetting[],
  industry: string,
  contentTone: string,
  customPrompt?: string,
  recentPosts?: any[]
): Promise<PostIdea[]>;

/**
 * Step 2: Elaborate posts with detailed content
 */
export declare function elaboratePostsStep(
  postIdeas: PostIdea[],
  contentTone: string
): Promise<ElaboratedPost[]>;

/**
 * Step 3: Generate SEO information for posts
 */
export declare function generateSeoInfoStep(
  elaboratedPosts: ElaboratedPost[]
): Promise<PostWithSeo[]>;

/**
 * Step 4: Schedule posts based on timeframe
 */
export declare function schedulePostsStep(
  posts: PostWithSeo[],
  timeFrame: CalendarViewType,
  startDate: Date
): Promise<ScheduledPost[]>; 