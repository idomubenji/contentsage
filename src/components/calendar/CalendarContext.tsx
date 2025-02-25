'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type CalendarViewType = 'day' | 'week' | 'month' | 'year';

// Update Post interface to match our Supabase schema
export interface Post {
  id: string;
  url: string;
  title: string;
  description: string;
  posted_date: string;
  format: string;
  status: 'POSTED' | 'SCHEDULED' | 'SUGGESTED';
  platform?: string;
  color?: string;
}

interface CalendarContextType {
  currentDate: Date;
  view: CalendarViewType;
  posts: Post[];
  loading: boolean;
  error: string | null;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarViewType) => void;
  addPost: (post: Omit<Post, 'id'>) => void;
  deletePost: (id: string) => void;
  getPostsForDate: (date: Date) => Post[];
  getPostsForMonth: (date: Date) => Post[];
  refreshPosts: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>('month');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

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
      
      // Fetch posts for the current user
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
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
  }, [user]);

  const addPost = (post: Omit<Post, 'id'>) => {
    // For new posts created in the calendar, we'd handle that separately
    // This would involve inserting into Supabase
    console.log('Adding post would insert to Supabase:', post);
  };

  const deletePost = (id: string) => {
    // This would involve deleting from Supabase
    console.log('Deleting post would remove from Supabase:', id);
  };

  const getPostsForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return posts.filter(post => {
      // Handle both string dates and Date objects
      const postDate = post.posted_date 
        ? format(new Date(post.posted_date), 'yyyy-MM-dd') 
        : '';
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
        deletePost,
        getPostsForDate,
        getPostsForMonth,
        refreshPosts: fetchPosts
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
} 