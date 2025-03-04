'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCalendar } from './CalendarContext';

interface TimezoneSelectorProps {
  onClose: () => void;
}

// Common timezones to suggest, add more as needed
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',      // Eastern Time
  'America/Chicago',       // Central Time
  'America/Denver',        // Mountain Time
  'America/Los_Angeles',   // Pacific Time
  'America/Anchorage',     // Alaska Time
  'Pacific/Honolulu',      // Hawaii Time
  'Europe/London',         // GMT
  'Europe/Berlin',         // Central European Time
  'Europe/Moscow',         // Moscow Time
  'Asia/Tokyo',            // Japan Time
  'Asia/Shanghai',         // China Time
  'Australia/Sydney',      // Australia Eastern Time
];

export default function TimezoneSelector({ onClose }: TimezoneSelectorProps) {
  const { timezone, setTimezone } = useCalendar();
  const [searchQuery, setSearchQuery] = useState('');
  const [timezones, setTimezones] = useState<string[]>(COMMON_TIMEZONES);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Get all available browser timezones on mount
  useEffect(() => {
    // Create a method to get all available timezones in the browser
    // This is only possible with Intl API in modern browsers
    // Create a map to deduplicate timezones with same offsets
    try {
      const timezoneSet = new Set<string>();
      // Add common timezones first
      COMMON_TIMEZONES.forEach(tz => timezoneSet.add(tz));
      
      // Try to get all Intl timezones if available
      if (Intl && 'supportedValuesOf' in Intl) {
        // TypeScript might not recognize this API yet
        const allTimezones = (Intl as any).supportedValuesOf('timeZone');
        if (Array.isArray(allTimezones)) {
          allTimezones.forEach(tz => timezoneSet.add(tz));
        }
      }
      
      setTimezones(Array.from(timezoneSet).sort());
    } catch (e) {
      console.error('Error getting timezones:', e);
      // Fall back to common timezones
      setTimezones(COMMON_TIMEZONES);
    }
  }, []);
  
  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Filter timezones based on search query
  const filteredTimezones = timezones.filter(tz => 
    tz.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Handle timezone selection
  const handleSelectTimezone = (tz: string) => {
    setTimezone(tz);
    onClose();
  };
  
  // Format timezone for display
  const formatTimezone = (tz: string) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      // Get formatted string and extract time and timezone
      const formatted = formatter.format(now);
      const match = formatted.match(/(\d{1,2}:\d{2}(?: [AP]M)?) (.+)/);
      
      if (match) {
        const [_, time, abbreviation] = match;
        return `${tz.replace('_', ' ')} (${abbreviation}, ${time})`;
      }
      
      return tz;
    } catch (e) {
      return tz;
    }
  };
  
  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 w-80 max-w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50"
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Timezone</h3>
        <input
          type="text"
          placeholder="Search timezones..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200"
        />
      </div>
      
      <div className="max-h-60 overflow-y-auto">
        {filteredTimezones.length === 0 ? (
          <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
            No timezones found matching your search
          </div>
        ) : (
          <ul className="py-1">
            {filteredTimezones.map(tz => (
              <li key={tz}>
                <button
                  onClick={() => handleSelectTimezone(tz)}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    timezone === tz
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {formatTimezone(tz)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 