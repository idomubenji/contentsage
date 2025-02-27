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
import { getPlatformColors, getFormatColors } from './colorUtils';

export default function YearView() {
  const { currentDate, setCurrentDate, setView, getPostsForMonth, getPostsForDate } = useCalendar();
  
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
      <div className="w-full h-full flex flex-col">
        <div className="grid grid-cols-7 gap-x-0.5 mb-1">
          {weekDays.map((day, index) => (
            <div key={index} className="text-sm text-center text-gray-600 dark:text-gray-400 font-medium py-1">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 grid-rows-6 gap-x-0.5 gap-y-1 flex-grow">
          {daysInCalendar.map((day) => {
            const isCurrentMonth = isSameMonth(day, date);
            const isTodayDate = isToday(day);
            const dayPosts = getPostsForDate(day);
            const hasPost = dayPosts.length > 0;
            
            // Use the first post's platform and format for the indicator if there are posts
            const platformColors = hasPost && dayPosts[0].platform 
              ? getPlatformColors(dayPosts[0].platform) 
              : { opacity: '', darkOpacity: '' };
              
            const formatColors = hasPost && dayPosts[0].format 
              ? getFormatColors(dayPosts[0].format) 
              : { border: '', darkBorder: '' };
            
            return (
              <div
                key={day.toString()}
                className={`
                  text-center flex items-center justify-center relative h-8
                  ${isCurrentMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600 opacity-60'}
                `}
              >
                {hasPost && isCurrentMonth && (
                  <div 
                    className={`absolute rounded-md w-8 h-8 mx-auto border ${formatColors.border} ${platformColors.opacity}`} 
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  ></div>
                )}
                {isTodayDate && (
                  <div className="absolute rounded-md opacity-70 z-5 w-8 h-8 mx-auto bg-indigo-500" 
                       style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}></div>
                )}
                <span className={`z-10 text-sm ${isCurrentMonth ? 'font-semibold' : ''} ${isTodayDate ? 'text-white' : ''}`}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full w-full flex flex-col">
      {/* Scrollable content container - auto overflow on smaller screens, hidden on lg */}
      <div className="overflow-auto h-full lg:overflow-hidden w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full p-3 auto-rows-fr lg:h-full">
          {months.map((month) => {
            const postsCount = getPostsForMonth(month).length;
            
            return (
              <div 
                key={month.toString()}
                className="border dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer flex flex-col h-full min-h-[280px]"
                onClick={() => handleMonthClick(month)}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-base sm:text-lg text-gray-900 dark:text-white">
                    {format(month, 'MMMM')}
                  </h3>
                  {postsCount > 0 && (
                    <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full font-medium">
                      {postsCount} {postsCount === 1 ? 'post' : 'posts'}
                    </span>
                  )}
                </div>
                
                <div className="flex-grow flex w-full h-full">
                  {generateMiniCalendar(month)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 