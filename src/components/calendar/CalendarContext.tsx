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
  posted_date?: string;
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
  addPost: (post: Omit<Post, 'id'>) => Promise<void>;
  updatePost: (id: string, postData: Partial<Post>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
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
        updatePost,
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