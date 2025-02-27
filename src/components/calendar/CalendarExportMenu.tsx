'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Post, useCalendar } from './CalendarContext';
import { 
  downloadICS, 
  downloadPostCalendar, 
  downloadDayCalendar, 
  downloadWeekCalendar, 
  downloadMonthCalendar,
  generateGoogleCalendarUrl,
  generateGoogleCalendarUrlForPosts
} from '@/utils/icsGenerator';

interface CalendarExportMenuProps {
  type: 'day' | 'week' | 'month' | 'post';
  date: Date;
  posts: Post[] | Post;
  className?: string;
}

export default function CalendarExportMenu({ type, date, posts, className = '' }: CalendarExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { refreshPosts } = useCalendar();
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  const showNotification = (message: string) => {
    setNotification(message);
    // Refresh posts to ensure calendar is updated in real-time
    refreshPosts();
  };
  
  const handleDownload = () => {
    try {
      if (type === 'post' && !Array.isArray(posts)) {
        downloadPostCalendar(posts);
        showNotification('Event successfully exported to .ics file');
      } else if (type === 'day' && Array.isArray(posts)) {
        downloadDayCalendar(posts, date);
        showNotification('Day events successfully exported to .ics file');
      } else if (type === 'week' && Array.isArray(posts)) {
        downloadWeekCalendar(posts, date);
        showNotification('Week events successfully exported to .ics file');
      } else if (type === 'month' && Array.isArray(posts)) {
        downloadMonthCalendar(posts, date);
        showNotification('Month events successfully exported to .ics file');
      }
    } catch (error) {
      setNotification('Error exporting calendar');
      console.error('Error exporting calendar:', error);
    }
    
    setIsOpen(false);
  };
  
  const handleGoogleCalendar = () => {
    try {
      let url = '';
      
      if (type === 'post' && !Array.isArray(posts)) {
        url = generateGoogleCalendarUrl(posts);
      } else if (Array.isArray(posts)) {
        url = generateGoogleCalendarUrlForPosts(posts, date);
      }
      
      if (url) {
        window.open(url, '_blank');
        showNotification('Opening in Google Calendar');
      }
    } catch (error) {
      setNotification('Error opening Google Calendar');
      console.error('Error opening Google Calendar:', error);
    }
    
    setIsOpen(false);
  };
  
  const handleAppleCalendar = () => {
    // Apple Calendar uses .ics files, so this is the same as download
    handleDownload();
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800/30 transition-colors"
        title="Export calendar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        Export Calendar
        <svg className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Success notification */}
      {notification && (
        <div className="absolute top-full left-0 mt-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-3 py-2 rounded-md text-sm z-20 shadow-md flex items-center gap-2 min-w-[220px]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {notification}
        </div>
      )}
      
      {isOpen && (
        <div className="absolute left-0 mt-1 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 z-10 border border-gray-200 dark:border-gray-700">
          <div className="py-1">
            <button
              onClick={handleDownload}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download .ics file
            </button>
            
            <button
              onClick={handleGoogleCalendar}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 488 512" fill="currentColor">
                <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"/>
              </svg>
              Add to Google Calendar
            </button>
            
            <button
              onClick={handleAppleCalendar}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              Add to Apple Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 