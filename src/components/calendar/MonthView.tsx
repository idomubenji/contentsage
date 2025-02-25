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
import { useCalendar } from './CalendarContext';
import PostForm from './PostForm';

export default function MonthView() {
  const { currentDate, setCurrentDate, getPostsForDate } = useCalendar();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);

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
    setShowPostForm(true);
  };

  const closePostForm = () => {
    setShowPostForm(false);
  };

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
                  {dayPosts.slice(0, 4).map((post) => (
                    <div 
                      key={post.id}
                      className="text-xs p-1 rounded truncate"
                      style={{ 
                        backgroundColor: `${post.color}20`, 
                        color: post.color 
                      }}
                    >
                      {post.title}
                    </div>
                  ))}
                  
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

      {showPostForm && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <PostForm date={selectedDate} onClose={closePostForm} />
        </div>
      )}
    </div>
  );
} 