'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO, parse, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { hasBeenExported, resetExportedEvents } from '@/utils/icsGenerator';

export type CalendarViewType = 'day' | 'week' | 'month' | 'year';

// Update Post interface to match our Supabase schema
export interface Post {
  id: string;
  url: string;
  title: string;
  description: string;
  posted_date?: string;
  format: string;
  status: 'POSTED' | 'SCHEDULED' | 'SUGGESTED';
  platform?: string;
  color?: string;
  hasVideo?: boolean;
  hasInfographic?: boolean;
  hasPodcast?: boolean;
  derivedFrom?: string; // For social posts derived from web content
}

interface CalendarContextType {
  currentDate: Date;
  view: CalendarViewType;
  posts: Post[];
  loading: boolean;
  error: string | null;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarViewType) => void;
  addPost: (post: Omit<Post, 'id'>) => Promise<void>;
  updatePost: (id: string, postData: Partial<Post>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  getPostsForDate: (date: Date) => Post[];
  getPostsForMonth: (date: Date) => Post[];
  getPostsForWeek: (date: Date) => Post[];
  refreshPosts: () => Promise<void>;
  isExported: (postId: string) => boolean;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}

// Helper to get stored date from localStorage
const getStoredDate = (): Date => {
  // For server-side rendering, use a fixed date to prevent hydration errors
  if (typeof window === 'undefined') {
    // Use the first day of the current month to avoid date-specific issues
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  try {
    const storedDate = localStorage.getItem('calendarCurrentDate');
    if (storedDate) {
      return new Date(storedDate);
    }
  } catch (error) {
    console.error('Error reading date from localStorage:', error);
  }
  
  // For client-side with no stored date, use the first day of current month
  // to maintain consistency with server-side rendering
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// Helper to get stored view from localStorage
const getStoredView = (): CalendarViewType => {
  if (typeof window === 'undefined') return 'month';
  
  try {
    const storedView = localStorage.getItem('calendarViewType') as CalendarViewType;
    if (storedView && ['day', 'week', 'month', 'year'].includes(storedView)) {
      return storedView;
    }
  } catch (error) {
    console.error('Error reading view from localStorage:', error);
  }
  
  return 'month';
};

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [currentDate, setCurrentDateState] = useState<Date>(getStoredDate());
  const [view, setViewState] = useState<CalendarViewType>(getStoredView());
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const { user } = useAuth();

  // Handle hydration mismatch by waiting for client-side render
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Override setCurrentDate to also persist to localStorage
  const setCurrentDate = (date: Date) => {
    // Normalize date by setting it to midnight to avoid time-based issues
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    
    setCurrentDateState(normalizedDate);
    
    try {
      localStorage.setItem('calendarCurrentDate', normalizedDate.toISOString());
    } catch (error) {
      console.error('Error writing date to localStorage:', error);
    }
  };

  // Override setView to also persist to localStorage
  const setView = (newView: CalendarViewType) => {
    setViewState(newView);
    try {
      localStorage.setItem('calendarViewType', newView);
    } catch (error) {
      console.error('Error writing view to localStorage:', error);
    }
  };

  // Check if a post has been exported
  const isExported = (postId: string): boolean => {
    return hasBeenExported(postId);
  };

  // Fetch posts from Supabase
  const fetchPosts = async () => {
    if (!user) {
      setLoading(false);
      setError("Please sign in to view your content");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch posts for the current user AND from organizations they belong to
      // We don't need to manually filter by organization_id since Row Level Security
      // policies are already configured to handle this at the database level
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .or(`user_id.eq.${user.id},organization_id.not.is.null`)
        .order('posted_date', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Assign colors based on post status
      const postsWithColors = data?.map(post => ({
        ...post,
        color: post.status === 'POSTED' 
          ? '#10b981' // green for posted
          : post.status === 'SCHEDULED' 
            ? '#4f46e5' // indigo for scheduled
            : '#f59e0b' // amber for suggested
      })) || [];
      
      setPosts(postsWithColors);
      // Update last refresh timestamp
      setLastRefresh(Date.now());
    } catch (err: any) {
      console.error('Error fetching posts for calendar:', err);
      setError(err.message || 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch posts on initial load and when user changes
  useEffect(() => {
    fetchPosts();
    
    // Reset exported events tracking when view changes
    return () => {
      resetExportedEvents();
    };
  }, [user]);
  
  // Setup auto-refresh every 2 minutes to keep calendar in sync
  // But only refresh if not loading and no user interaction in the last 10 seconds
  useEffect(() => {
    let lastUserInteraction = Date.now();
    
    // Track user interactions
    const trackInteraction = () => {
      lastUserInteraction = Date.now();
    };
    
    // Add event listeners to track user activity
    window.addEventListener('mousemove', trackInteraction);
    window.addEventListener('click', trackInteraction);
    window.addEventListener('keydown', trackInteraction);
    
    const refreshInterval = setInterval(() => {
      if (!loading) {
        // Only refresh if user hasn't interacted in the last 10 seconds
        const inactiveTime = Date.now() - lastUserInteraction;
        if (inactiveTime > 10000) { // 10 seconds of inactivity
          fetchPosts();
        }
      }
    }, 120000); // 2 minutes
    
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('mousemove', trackInteraction);
      window.removeEventListener('click', trackInteraction);
      window.removeEventListener('keydown', trackInteraction);
    };
  }, [loading]);

  const addPost = async (post: Omit<Post, 'id'>) => {
    if (!user) {
      setError("Please sign in to add content");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Insert post into Supabase
      const { data, error: insertError } = await supabase
        .from('posts')
        .insert([{ ...post, user_id: user.id }])
        .select();
        
      if (insertError) {
        throw new Error(insertError.message);
      }
      
      if (data && data.length > 0) {
        // Add the new post to the local state with color
        const newPost = {
          ...data[0],
          color: getPostColor(data[0])
        };
        
        setPosts(prevPosts => [newPost, ...prevPosts]);
        console.log('Post added successfully:', newPost.id);
      }
    } catch (err: any) {
      console.error('Error adding post:', err);
      setError(err.message || 'Failed to add post');
      throw err; // Re-throw for the UI to handle
    } finally {
      setLoading(false);
    }
  };

  const updatePost = async (id: string, postData: Partial<Post>) => {
    if (!user) {
      setError("Please sign in to update content");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Update post in Supabase
      const { error: updateError } = await supabase
        .from('posts')
        .update(postData)
        .eq('id', id);
        
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      // Update local state
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === id 
            ? { ...post, ...postData, color: getPostColor({ ...post, ...postData }) } 
            : post
        )
      );
      
      console.log('Post updated successfully:', id);
    } catch (err: any) {
      console.error('Error updating post:', err);
      setError(err.message || 'Failed to update post');
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!user) {
      setError("Please sign in to delete content");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Delete post from Supabase
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);
        
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      
      // Remove from local state
      setPosts(prevPosts => prevPosts.filter(post => post.id !== id));
      console.log('Post deleted successfully:', id);
    } catch (err: any) {
      console.error('Error deleting post:', err);
      setError(err.message || 'Failed to delete post');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine post color based on status
  const getPostColor = (post: Post) => {
    return post.status === 'POSTED' 
      ? '#10b981' // green for posted
      : post.status === 'SCHEDULED' 
        ? '#4f46e5' // indigo for scheduled
        : '#f59e0b'; // amber for suggested
  };

  const getPostsForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return posts.filter(post => {
      if (!post.posted_date) return false;
      
      // Handle both string dates and Date objects
      const postDate = format(new Date(post.posted_date), 'yyyy-MM-dd');
      return postDate === dateString;
    });
  };

  const getPostsForMonth = (date: Date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    return posts.filter(post => {
      if (!post.posted_date) return false;
      
      const postDate = new Date(post.posted_date);
      return postDate >= monthStart && postDate <= monthEnd;
    });
  };

  const getPostsForWeek = (date: Date) => {
    // Get start and end of the week
    const weekStart = startOfWeek(date);
    const weekEnd = endOfWeek(date);
    
    // Get all days in the week
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: weekEnd,
    });
    
    // Get all posts for the week
    const weekPosts: Post[] = [];
    weekDays.forEach(day => {
      const dayPosts = getPostsForDate(day);
      weekPosts.push(...dayPosts);
    });
    
    // Remove duplicates (if any) by creating a Map with post id as key
    return Array.from(
      new Map(weekPosts.map(post => [post.id, post])).values()
    );
  };

  return (
    <CalendarContext.Provider
      value={{
        currentDate,
        view,
        posts,
        loading,
        error,
        setCurrentDate,
        setView,
        addPost,
        updatePost,
        deletePost,
        getPostsForDate,
        getPostsForMonth,
        getPostsForWeek,
        refreshPosts: fetchPosts,
        isExported
      }}
    >
      {hydrated ? (
        children
      ) : (
        <div suppressHydrationWarning>
          {/* This div will be replaced after hydration */}
          <div className="h-full w-full flex items-center justify-center p-10">
            <div className="animate-pulse flex space-x-4">
              <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </CalendarContext.Provider>
  );
} 