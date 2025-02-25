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
import { useCalendar } from './CalendarContext';
import PostForm from './PostForm';

export default function WeekView() {
  const { currentDate, getPostsForDate } = useCalendar();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);

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
    setShowPostForm(true);
  };

  const closePostForm = () => {
    setShowPostForm(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-auto h-full w-full flex-1">
      <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 w-full">
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
      </div>
      
      <div className="w-full">
        {timeSlots.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b dark:border-gray-700 min-h-[70px] group hover:bg-gray-50 dark:hover:bg-gray-750 w-full">
            <div className="p-2 border-r dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium text-right pr-3 pt-1.5">
              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
            
            {weekDays.map((day) => {
              const timeSlotDate = set(day, { hours: hour });
              const posts = getPostsForDate(timeSlotDate).filter(post => {
                const postHour = new Date(post.date).getHours();
                return postHour === hour;
              });
              
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
                      className="text-xs p-1.5 rounded mb-1 shadow-sm"
                      style={{ backgroundColor: `${post.color}20`, color: post.color, borderLeft: `3px solid ${post.color}` }}
                    >
                      <div className="font-medium truncate">{post.title}</div>
                      <div className="truncate">{post.content}</div>
                    </div>
                  ))}
                  
                  <div className="absolute inset-0 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 opacity-0 group-hover:opacity-10 pointer-events-none"></div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {showPostForm && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <PostForm date={selectedDate} onClose={closePostForm} />
        </div>
      )}
    </div>
  );
} 