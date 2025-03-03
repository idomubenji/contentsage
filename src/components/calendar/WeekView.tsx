'use client';

import React, { useState } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addHours,
  isBefore,
  isAfter,
  parseISO,
  set
} from 'date-fns';
import { useCalendar, Post } from './CalendarContext';
import PostForm from './PostForm';
import { getPlatformColors, getFormatColors } from './colorUtils';
import { downloadWeekCalendar } from '@/utils/icsGenerator';

export default function WeekView() {
  const { currentDate, getPostsForDate } = useCalendar();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Get start and end of the week
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  
  // Get all days in the week
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: weekEnd,
  });

  // Time slots for the day (from 6 AM to 9 PM)
  const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);

  const handleTimeSlotClick = (day: Date, hour: number) => {
    const newDate = set(day, { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 });
    setSelectedDate(newDate);
    setSelectedPost(null);
    setShowPostForm(true);
  };

  const handlePostClick = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation(); // Prevent triggering the time slot click
    setSelectedPost(post);
    setShowPostForm(true);
  };

  const closePostForm = () => {
    setShowPostForm(false);
    setSelectedPost(null);
  };
  
  // Get all posts for the week
  const getPostsForWeek = () => {
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

  // We'll keep this function for reference, but use the CalendarExportMenu component instead
  const handleDownloadCalendar = () => {
    const uniquePosts = getPostsForWeek();
    downloadWeekCalendar(uniquePosts, currentDate);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full w-full flex flex-col">
      {/* Calendar header */}
      <div className="grid grid-cols-8 border-b dark:border-gray-700 w-full">
        <div className="p-2 border-r dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium"></div>
        {weekDays.map((day) => (
          <div 
            key={day.toString()} 
            className={`
              p-2 text-center border-r dark:border-gray-700
              ${isToday(day) ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}
            `}
          >
            <div className="font-medium text-gray-700 dark:text-gray-300">{format(day, 'EEE')}</div>
            <div className={`text-xl font-bold ${isToday(day) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-white'}`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>
      
      {/* Calendar content - scrollable area */}
      <div className="overflow-auto flex-1">
        {timeSlots.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b dark:border-gray-700 min-h-[70px] group hover:bg-gray-50 dark:hover:bg-gray-750 w-full">
            <div className="p-2 border-r dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium text-right pr-3 pt-1.5">
              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
            
            {weekDays.map((day) => {
              const timeSlotDate = set(day, { hours: hour });
              const posts = getPostsForDate(day);
              
              return (
                <div 
                  key={day.toString()} 
                  className={`
                    p-1 border-r dark:border-gray-700 relative
                    ${isToday(day) ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}
                    cursor-pointer
                  `}
                  onClick={() => handleTimeSlotClick(day, hour)}
                >
                  {posts.map((post) => (
                    <div 
                      key={post.id}
                      onClick={(e) => handlePostClick(e, post)}
                      className={`text-xs p-1.5 rounded mb-1 shadow-sm border-l-2 ${getPlatformColors(post.platform).bg} ${getPlatformColors(post.platform).darkBg} ${getFormatColors(post.format).border} ${getFormatColors(post.format).darkBorder}`}
                      title={`${post.title || 'Untitled'} - ${post.platform || 'Website'} - ${post.format || 'Article'}`}
                    >
                      <div className="font-medium truncate text-gray-800 dark:text-gray-100">{post.title || 'Untitled Post'}</div>
                      {post.description && (
                        <div className="truncate text-gray-700 dark:text-gray-300">{post.description}</div>
                      )}
                    </div>
                  ))}
                  
                  <div className="absolute inset-0 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 opacity-0 group-hover:opacity-10 pointer-events-none"></div>
                </div>
              );
            })}
          </div>
        ))}
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