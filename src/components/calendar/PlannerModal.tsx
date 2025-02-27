'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarViewType, useCalendar } from './CalendarContext';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

interface PlatformSettings {
  platform: string;
  count: number;
  min: number;
  max: number;
  logo: string;
}

interface PostSuggestion {
  title: string;
  description: string;
  platform: string;
  date: Date | string;
  status: 'SUGGESTED';
  reasonsData: {
    reasons: string[];
    aiConfidence: number;
  };
  format?: string;
}

interface PlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeFrame: CalendarViewType;
  currentDate: Date;
}

interface Organization {
  id: string;
  name: string;
}

export default function PlannerModal({ isOpen, onClose, timeFrame, currentDate }: PlannerModalProps) {
  // Custom prompt state
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Get calendar context for refreshing posts
  const { refreshPosts } = useCalendar();
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Platform settings with default values
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings[]>([
    { platform: 'Web', count: 2, min: 0, max: 5, logo: '🌐' },
    { platform: '𝕏', count: 3, min: 0, max: 10, logo: '𝕏' },
    { platform: 'Instagram', count: 2, min: 0, max: 7, logo: '📸' },
    { platform: 'Facebook', count: 2, min: 0, max: 5, logo: '👍' },
    { platform: 'LinkedIn', count: 1, min: 0, max: 3, logo: '💼' },
  ]);
  
  // Preview suggestions
  const [suggestions, setSuggestions] = useState<PostSuggestion[]>([]);
  
  // Get the authenticated user
  const { user } = useAuth();
  
  // Organization state
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationLoading, setOrganizationLoading] = useState(true);
  
  // Fetch the user's organization when the component mounts
  useEffect(() => {
    const fetchUserOrganization = async () => {
      if (!user) {
        setOrganizationLoading(false);
        setError("You must be logged in to plan content");
        return;
      }
      
      try {
        setOrganizationLoading(true);
        setError(null);
        
        // First get the user's organization IDs and roles
        const { data: userOrgs, error: userOrgsError } = await supabase
          .from('user_organizations')
          .select('organization_id, role')
          .eq('user_id', user.id);
          
        if (userOrgsError) {
          console.error('PlannerModal: Error fetching user organizations', userOrgsError);
          throw new Error('Failed to fetch your organizations. Please try again.');
        }
        
        if (!userOrgs || userOrgs.length === 0) {
          setError("No organizations found. You need to be part of an organization to plan content.");
          setOrganizationLoading(false);
          return;
        }
        
        // Get the first organization (we could add a selector in the future)
        const firstOrgId = userOrgs[0].organization_id;
        
        // Now fetch the organization details
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', firstOrgId)
          .single();
          
        if (orgError) {
          console.error('PlannerModal: Error fetching organization details', orgError);
          throw new Error('Failed to fetch organization details. Please try again.');
        }
        
        if (!orgData) {
          setError("Organization not found. Please try refreshing the page.");
          setOrganizationLoading(false);
          return;
        }
        
        setOrganization({
          id: orgData.id,
          name: orgData.name
        });
        
      } catch (error) {
        console.error('Error in fetchUserOrganization:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setOrganizationLoading(false);
      }
    };
    
    fetchUserOrganization();
  }, [user]);
  
  // Format the title based on timeframe
  const getTitle = () => {
    switch (timeFrame) {
      case 'day':
        return `Plan for ${format(currentDate, 'MMMM d, yyyy')}`;
      case 'week':
        return `Plan for week of ${format(currentDate, 'MMMM d, yyyy')}`;
      case 'month':
        return `Plan for ${format(currentDate, 'MMMM yyyy')}`;
      default:
        return 'Content Planner';
    }
  };
  
  // Handle platform count changes
  const handleCountChange = (platform: string, newCount: number) => {
    setPlatformSettings(prev => 
      prev.map(p => 
        p.platform === platform 
          ? { ...p, count: Math.max(p.min, Math.min(p.max, newCount)) } 
          : p
      )
    );
  };
  
  // Handle generate plan button click
  const handleGeneratePlan = async () => {
    if (!organization) {
      setError("Please select an organization first");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Call our AI planner API
      const response = await fetch('/api/ai-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeFrame,
          currentDate: format(currentDate, 'yyyy-MM-dd'),
          platformSettings,
          customPrompt,
          organizationId: organization.id,
        }),
      });
      
      if (!response.ok) {
        // Safely handle both JSON and text error responses
        let errorMessage = `Failed to generate plan: ${response.status} ${response.statusText}`;
        
        try {
          // Try to parse as JSON first
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If JSON parsing fails, try to get the text content
          try {
            const textContent = await response.text();
            console.error('Non-JSON error response:', textContent);
            errorMessage = textContent || errorMessage;
          } catch (textError) {
            console.error('Failed to read error response:', textError);
          }
        }
        
        throw new Error(errorMessage);
      }
      
      // The response is OK, now try to parse the JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        throw new Error('Invalid response format from AI planner. Please try again.');
      }
      
      if (!data.suggestions || !Array.isArray(data.suggestions)) {
        throw new Error('Invalid response structure from AI planner');
      }
      
      setSuggestions(data.suggestions);
      setIsPreviewReady(true);
    } catch (err) {
      console.error('Error generating plan:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle saving the plan to the database
  const handleSavePlan = async () => {
    if (!organization) {
      setError("Organization not found");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Make sure each suggestion has the required fields
      const preparedSuggestions = suggestions.map(suggestion => {
        // Ensure reasonsData exists and has a reasons array
        const reasonsData = suggestion.reasonsData || {
          reasons: ['Generated based on your content plan'],
          aiConfidence: 0.8
        };
        
        return {
          ...suggestion,
          platform: suggestion.platform,  // Ensure platform is included
          // If format isn't already set in the AI response, add it here
          format: suggestion.format || (suggestion.platform === 'Web' ? 'blog' : 'social'),
          reasonsData
        };
      });
      
      // Call API to save suggestions to the database
      const response = await fetch('/api/posts/suggested', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestions: preparedSuggestions,
          organizationId: organization.id,
        }),
      });
      
      // Check if the response is OK
      if (!response.ok) {
        // Safely handle both JSON and text error responses
        let errorMessage = `Failed to save suggestions: ${response.status} ${response.statusText}`;
        
        try {
          // Try to parse as JSON first
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If JSON parsing fails, try to get the text content
          try {
            const textContent = await response.text();
            console.error('Non-JSON error response:', textContent);
            errorMessage = textContent || errorMessage;
          } catch (textError) {
            console.error('Failed to read error response:', textError);
          }
        }
        
        throw new Error(errorMessage);
      }
      
      // Now we know the response is OK, safely parse the JSON
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        throw new Error('Invalid response format. Please try again.');
      }
      
      if (result.success) {
        // Success case
        console.log(`Successfully saved ${result.count} suggestions`);
        
        // Refresh calendar posts to show new suggestions immediately
        await refreshPosts();
        
        // Close the modal after saving
        onClose();
      } else {
        // API returned success: false
        throw new Error(result.error || 'Unknown error while saving suggestions');
      }
    } catch (err) {
      console.error('Error saving plan:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">{getTitle()}</h2>
            {organization && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Organization: {organization.name}
              </span>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Loading state */}
          {organizationLoading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
              <p className="font-medium">Error: {error}</p>
            </div>
          )}
          
          {/* Only show content when organization is loaded and no errors */}
          {!organizationLoading && organization && !error && (
            <>
              {!isPreviewReady ? (
                <div className="space-y-6">
                  {/* Platform frequency settings */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                      How many posts do you want for each platform?
                    </h3>
                    
                    <div className="space-y-4">
                      {platformSettings.map((platform) => (
                        <div key={platform.platform} className="flex items-center">
                          <span className="w-8 text-center mr-2">{platform.logo}</span>
                          <span className="w-28 font-medium text-gray-700 dark:text-gray-300">
                            {platform.platform}
                          </span>
                          
                          <div className="flex-1 mx-4">
                            <input
                              type="range"
                              min={platform.min}
                              max={platform.max}
                              value={platform.count}
                              onChange={(e) => handleCountChange(platform.platform, parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          
                          <div className="w-16 flex items-center">
                            <input
                              type="number"
                              min={platform.min}
                              max={platform.max}
                              value={platform.count}
                              onChange={(e) => handleCountChange(platform.platform, parseInt(e.target.value))}
                              className="w-12 py-1 px-2 text-center border border-gray-300 dark:border-gray-600 rounded-md text-gray-800 dark:text-white dark:bg-gray-700"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom prompt */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                      Any specific themes or focus for this {timeFrame}?
                    </h3>
                    
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder={`E.g., "Cybersecurity month", "Product launch", or "Industry conference"`}
                      className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-md text-gray-800 dark:text-white dark:bg-gray-700 resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                    Preview of Suggested Content Plan
                  </h3>
                  
                  {suggestions.length > 0 ? (
                    <div className="space-y-4">
                      {suggestions.map((suggestion, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">{suggestion.title}</h4>
                              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">{suggestion.description}</p>
                            </div>
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                              {suggestion.platform}
                            </span>
                          </div>
                          
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Why this content:</p>
                            <ul className="list-disc list-inside text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {(suggestion.reasonsData?.reasons || ['Generated based on your content plan']).map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">
                      No suggestions generated. Try adjusting your settings.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer with buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          
          {!organizationLoading && organization && !error && (
            <>
              {!isPreviewReady ? (
                <button
                  onClick={handleGeneratePlan}
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    'Generate Plan'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSavePlan}
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Apply to Calendar'
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 