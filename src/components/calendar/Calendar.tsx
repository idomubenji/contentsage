'use client';

import React, { useState, useEffect } from 'react';
import { 
  addMonths, 
  subMonths, 
  addYears, 
  subYears, 
  addWeeks, 
  subWeeks, 
  addDays,
  subDays,
  format 
} from 'date-fns';
import { useCalendar, CalendarViewType } from './CalendarContext';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';
import YearView from './YearView';
import PlannerModal from './PlannerModal';
import CalendarExportMenu from './CalendarExportMenu';

export default function Calendar() {
  const { currentDate, setCurrentDate, view, setView, getPostsForDate, getPostsForMonth, getPostsForWeek } = useCalendar();
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  
  // Effect to sync with URL params (optional enhancement for sharable links)
  useEffect(() => {
    // Only update document title on the client-side
    if (typeof window !== 'undefined') {
      document.title = `Calendar - ${format(currentDate, 'MMMM yyyy')} - ContentSage`;
    }
  }, [currentDate, view]);
  
  const navigateCalendar = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      switch (view) {
        case 'day':
          setCurrentDate(subDays(currentDate, 1));
          break;
        case 'week':
          setCurrentDate(subWeeks(currentDate, 1));
          break;
        case 'month':
          setCurrentDate(subMonths(currentDate, 1));
          break;
        case 'year':
          setCurrentDate(subYears(currentDate, 1));
          break;
      }
    } else {
      switch (view) {
        case 'day':
          setCurrentDate(addDays(currentDate, 1));
          break;
        case 'week':
          setCurrentDate(addWeeks(currentDate, 1));
          break;
        case 'month':
          setCurrentDate(addMonths(currentDate, 1));
          break;
        case 'year':
          setCurrentDate(addYears(currentDate, 1));
          break;
      }
    }
  };
  
  const resetToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Format the header title based on the current view
  const getHeaderTitle = () => {
    // Use consistent options object to ensure consistent formatting between server and client
    const formatOptions = { locale: undefined };
    
    switch (view) {
      case 'day':
        return format(currentDate, 'MMMM d, yyyy', formatOptions);
      case 'week':
        return `Week of ${format(currentDate, 'MMMM d, yyyy', formatOptions)}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', formatOptions);
      case 'year':
        return format(currentDate, 'yyyy', formatOptions);
      default:
        return '';
    }
  };
  
  // Function to get the appropriate time period label for the planner button
  const getPlannerTimeLabel = () => {
    switch (view) {
      case 'day':
        return 'day';
      case 'week':
        return 'week';
      case 'month':
        return 'month';
      case 'year':
        return 'year';
      default:
        return 'period';
    }
  };
  
  // Function to get posts for current view
  const getCurrentViewPosts = () => {
    switch (view) {
      case 'day':
        return getPostsForDate(currentDate);
      case 'week':
        return getPostsForWeek ? getPostsForWeek(currentDate) : [];
      case 'month':
        return getPostsForMonth ? getPostsForMonth(currentDate) : [];
      default:
        return [];
    }
  };
  
  // Render the appropriate view component
  const renderView = () => {
    switch (view) {
      case 'day':
        return <DayView />;
      case 'week':
        return <WeekView />;
      case 'month':
        return <MonthView />;
      case 'year':
        return <YearView />;
      default:
        return <MonthView />;
    }
  };
  
  const viewOptions: { label: string; value: CalendarViewType }[] = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
  ];

  return (
    <div className="flex flex-col h-full w-full">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-3 p-3 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* View options nav */}
          <div className="sm:w-1/4 flex justify-start">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-md">
              {viewOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setView(option.value)}
                  className={`
                    px-3 py-1 text-sm font-medium rounded-md transition-colors
                    ${view === option.value 
                      ? 'bg-white dark:bg-gray-900 shadow-sm text-indigo-600 dark:text-indigo-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Center navigation controls */}
          <div className="flex items-center gap-2 sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2">
            <button 
              onClick={() => navigateCalendar('prev')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              aria-label="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <h2 className="text-xl font-semibold mx-2 w-52 text-center text-gray-800 dark:text-white" suppressHydrationWarning>
              {getHeaderTitle()}
            </h2>
            
            <button 
              onClick={() => navigateCalendar('next')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
              aria-label="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <button 
              onClick={resetToToday}
              className="ml-2 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Today
            </button>
          </div>
          
          {/* Right action buttons */}
          <div className="sm:w-1/4 flex justify-end items-center gap-2">
            {view !== 'year' && (
              <button
                onClick={() => setIsPlannerOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Plan my {getPlannerTimeLabel()}
              </button>
            )}
            
            <CalendarExportMenu
              type={view === 'day' ? 'day' : view === 'week' ? 'week' : 'month'}
              date={currentDate}
              posts={getCurrentViewPosts()}
            />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden flex w-full">
        {renderView()}
      </div>
      
      {/* AI Planner Modal */}
      {isPlannerOpen && (
        <PlannerModal
          isOpen={isPlannerOpen}
          onClose={() => setIsPlannerOpen(false)}
          timeFrame={view}
          currentDate={currentDate}
        />
      )}
    </div>
  );
} 