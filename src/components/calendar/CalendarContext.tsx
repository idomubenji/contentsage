'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

export type CalendarViewType = 'day' | 'week' | 'month' | 'year';

export interface Post {
  id: string;
  date: Date;
  title: string;
  content: string;
  color?: string;
}

interface CalendarContextType {
  currentDate: Date;
  view: CalendarViewType;
  posts: Post[];
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarViewType) => void;
  addPost: (post: Omit<Post, 'id'>) => void;
  deletePost: (id: string) => void;
  getPostsForDate: (date: Date) => Post[];
  getPostsForMonth: (date: Date) => Post[];
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

  // Sample posts for demonstration
  useEffect(() => {
    const demoData: Post[] = [
      {
        id: '1',
        date: new Date(),
        title: 'Today\'s Post',
        content: 'This is a sample post for today',
        color: '#4f46e5' // indigo
      },
      {
        id: '2',
        date: new Date(new Date().setDate(new Date().getDate() + 2)),
        title: 'Upcoming Post',
        content: 'This is a sample post for the near future',
        color: '#10b981' // emerald
      }
    ];
    setPosts(demoData);
  }, []);

  const addPost = (post: Omit<Post, 'id'>) => {
    const newPost = {
      ...post,
      id: Math.random().toString(36).substring(2, 9)
    };
    setPosts([...posts, newPost]);
  };

  const deletePost = (id: string) => {
    setPosts(posts.filter(post => post.id !== id));
  };

  const getPostsForDate = (date: Date) => {
    return posts.filter(post => 
      format(post.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  const getPostsForMonth = (date: Date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    return posts.filter(post => {
      const postDate = new Date(post.date);
      return postDate >= monthStart && postDate <= monthEnd;
    });
  };

  return (
    <CalendarContext.Provider
      value={{
        currentDate,
        view,
        posts,
        setCurrentDate,
        setView,
        addPost,
        deletePost,
        getPostsForDate,
        getPostsForMonth,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
} 