'use client';

import React, { useState } from 'react';
import { format, set, isToday } from 'date-fns';
import { useCalendar } from './CalendarContext';
import PostForm from './PostForm';

export default function DayView() {
  const { currentDate, getPostsForDate } = useCalendar();
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);

  // Time slots for the day (from 6 AM to 9 PM)
  const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);

  const handleTimeSlotClick = (hour: number) => {
    const newDate = set(currentDate, { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 });
    setSelectedTime(newDate);
    setShowPostForm(true);
  };

  const closePostForm = () => {
    setShowPostForm(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full flex flex-col w-full">
      <div className="p-3 border-b dark:border-gray-700 w-full">
        <div className="text-center">
          <div className="text-lg text-gray-700 dark:text-gray-300">{format(currentDate, 'EEEE')}</div>
          <div className={`text-3xl font-bold ${isToday(currentDate) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
            {format(currentDate, 'MMMM d, yyyy')}
          </div>
        </div>
      </div>
      
      <div className="overflow-auto flex-1 w-full">
        {timeSlots.map((hour) => {
          const timeSlotDate = set(currentDate, { hours: hour });
          const posts = getPostsForDate(timeSlotDate).filter(post => {
            const postHour = new Date(post.date).getHours();
            return postHour === hour;
          });
          
          return (
            <div 
              key={hour} 
              className="flex border-b dark:border-gray-700 py-2 px-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer w-full"
              onClick={() => handleTimeSlotClick(hour)}
            >
              <div className="w-20 pr-3 text-right text-gray-700 dark:text-gray-300 font-medium">
                {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
              </div>
              
              <div className="flex-1">
                {posts.length === 0 ? (
                  <div className="h-10 border border-dashed border-gray-300 dark:border-gray-600 rounded-md flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                    Click to add post
                  </div>
                ) : (
                  <div className="space-y-2">
                    {posts.map((post) => (
                      <div 
                        key={post.id}
                        className="p-2 rounded shadow-sm"
                        style={{ 
                          backgroundColor: `${post.color}20`, 
                          borderLeft: `3px solid ${post.color}` 
                        }}
                      >
                        <div className="font-medium" style={{ color: post.color }}>
                          {post.title}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                          {post.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showPostForm && selectedTime && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <PostForm date={selectedTime} onClose={closePostForm} />
        </div>
      )}
    </div>
  );
} 