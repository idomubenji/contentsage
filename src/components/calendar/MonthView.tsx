'use client';

import React, { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth,
  isSameDay,
  addDays,
  startOfWeek,
  endOfWeek,
  isToday
} from 'date-fns';
import { useCalendar, Post } from './CalendarContext';
import PostForm from './PostForm';

export default function MonthView() {
  const { 
    currentDate, 
    setCurrentDate, 
    getPostsForDate, 
    loading,
    error 
  } = useCalendar();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Get the first day of the month
  const monthStart = startOfMonth(currentDate);
  
  // Get the last day of the month
  const monthEnd = endOfMonth(currentDate);
  
  // Get the start of the week for the first day of the month
  const calendarStart = startOfWeek(monthStart);
  
  // Get the end of the week for the last day of the month
  const calendarEnd = endOfWeek(monthEnd);
  
  // All days that will be displayed in the calendar grid
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedPost(null);
    setShowPostForm(true);
  };

  const handlePostClick = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation(); // Prevent triggering the day click
    setSelectedPost(post);
    setShowPostForm(true);
  };

  const closePostForm = () => {
    setShowPostForm(false);
    setSelectedPost(null);
  };

  // Function to get status badge styles
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'POSTED':
        return { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' };
      case 'SCHEDULED':
        return { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' };
      case 'SUGGESTED':
        return { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' };
      default:
        return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-200' };
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading calendar data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full w-full flex items-center justify-center p-4">
        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-md max-w-md text-center">
          <p className="text-red-800 dark:text-red-200 font-medium">Error loading calendar</p>
          <p className="text-red-700 dark:text-red-300 mt-2">{error}</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-3">Try refreshing the page or sign in if you haven't already.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full w-full flex flex-col">
      <div className="p-2 flex-grow flex flex-col w-full">
        <div className="grid grid-cols-7 gap-1 mb-1 w-full">
          {weekDays.map((day) => (
            <div key={day} className="text-center font-medium text-gray-700 dark:text-gray-300 py-1">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1 flex-grow h-full grid-rows-6 w-full">
          {calendarDays.map((day) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const dayPosts = getPostsForDate(day);
            
            return (
              <div
                key={day.toString()}
                onClick={() => handleDateClick(day)}
                className={`
                  p-1 border rounded-md cursor-pointer transition-colors h-full flex flex-col
                  ${isCurrentMonth 
                    ? 'bg-white dark:bg-gray-800' 
                    : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-500'
                  } 
                  ${isSelected ? 'ring-2 ring-indigo-400 dark:ring-indigo-500' : ''}
                  ${isTodayDate 
                    ? 'border-indigo-300 dark:border-indigo-500' 
                    : 'border-gray-200 dark:border-gray-700'
                  }
                  hover:bg-gray-50 dark:hover:bg-gray-700
                `}
              >
                <div className={`
                  mb-1 font-semibold text-center py-1
                  ${isTodayDate 
                    ? 'text-indigo-600 dark:text-indigo-400 text-base' 
                    : isCurrentMonth 
                      ? 'text-gray-900 dark:text-gray-100 text-sm' 
                      : 'text-gray-500 dark:text-gray-500 text-sm'
                  }
                `}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1 overflow-y-auto flex-grow">
                  {dayPosts.slice(0, 4).map((post) => {
                    const statusStyles = getStatusStyles(post.status);
                    
                    return (
                      <div 
                        key={post.id}
                        onClick={(e) => handlePostClick(e, post)}
                        className={`text-xs p-1 rounded truncate cursor-pointer ${statusStyles.bg} ${statusStyles.text} hover:brightness-95 dark:hover:brightness-110`}
                      >
                        {post.title || 'Untitled Post'}
                      </div>
                    );
                  })}
                  
                  {dayPosts.length > 4 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium text-center">
                      +{dayPosts.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showPostForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <PostForm 
            date={selectedDate} 
            post={selectedPost}
            onClose={closePostForm} 
          />
        </div>
      )}
    </div>
  );
} 