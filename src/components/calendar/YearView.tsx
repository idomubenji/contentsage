'use client';

import React from 'react';
import { 
  format, 
  addMonths, 
  startOfYear,
  endOfMonth,
  startOfMonth,
  getMonth,
  isSameMonth,
  isSameDay,
  isToday,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { useCalendar } from './CalendarContext';

export default function YearView() {
  const { currentDate, setCurrentDate, setView, getPostsForMonth } = useCalendar();
  
  const year = currentDate.getFullYear();
  const firstDayOfYear = startOfYear(currentDate);
  
  // Generate all 12 months
  const months = Array.from({ length: 12 }, (_, i) => {
    return addMonths(firstDayOfYear, i);
  });

  const handleMonthClick = (date: Date) => {
    setCurrentDate(date);
    setView('month');
  };

  // Generate mini calendar for each month
  const generateMiniCalendar = (date: Date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    const daysInCalendar = eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });
    
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    return (
      <div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekDays.map((day, index) => (
            <div key={index} className="text-[9px] text-center text-gray-600 dark:text-gray-400 font-medium">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-0.5">
          {daysInCalendar.map((day) => {
            const isCurrentMonth = isSameMonth(day, date);
            const isTodayDate = isToday(day);
            
            return (
              <div
                key={day.toString()}
                className={`
                  text-[9px] text-center rounded-full w-5 h-5 flex items-center justify-center font-medium
                  ${isCurrentMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600 opacity-60'}
                  ${isTodayDate ? 'bg-indigo-500 text-white dark:bg-indigo-600' : ''}
                `}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-full w-full overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full">
        {months.map((month) => {
          const postsCount = getPostsForMonth(month).length;
          
          return (
            <div 
              key={month.toString()}
              className="border dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => handleMonthClick(month)}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-lg text-gray-900 dark:text-white">
                  {format(month, 'MMMM')}
                </h3>
                {postsCount > 0 && (
                  <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    {postsCount} {postsCount === 1 ? 'post' : 'posts'}
                  </span>
                )}
              </div>
              
              {generateMiniCalendar(month)}
            </div>
          );
        })}
      </div>
    </div>
  );
} 