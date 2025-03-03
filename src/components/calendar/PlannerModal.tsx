'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarViewType, useCalendar } from './CalendarContext';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { ChainStep } from '@/app/api/post-generation-chain/types';
import { Modal } from '../../components/ui/modal';

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
  posted_date: string;
  format?: string;
  status: 'POSTED' | 'SCHEDULED' | 'SUGGESTED';
  derivedFrom?: string; // For social posts derived from web content
  seo_info?: { 
    reasonsData: {
      reasons: string[];
      aiConfidence: number;
    }
  };
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

interface ChainState {
  isGenerating: boolean;
  step: ChainStep;
  progress: number;
  error?: string;
}

export default function PlannerModal({ isOpen, onClose, timeFrame, currentDate }: PlannerModalProps) {
  // Custom prompt state
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Get calendar context for refreshing posts
  const { refreshPosts } = useCalendar();
  
  // Loading and error states
  const [error, setError] = useState<string | null>(null);
  
  // Chain state for progress tracking
  const [chainState, setChainState] = useState<ChainState>({
    isGenerating: false,
    step: 'initializing',
    progress: 0
  });
  
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
  
  // Organization state - updated to handle multiple organizations
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [organizationLoading, setOrganizationLoading] = useState(true);
  
  // Add a debug state to help with troubleshooting
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  
  // Add state for regeneration
  const [regeneratingPostIndex, setRegeneratingPostIndex] = useState<number | null>(null);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  
  // Helper function to add debug messages
  const addDebug = (message: string) => {
    console.log('[DEBUG]', message);
    setDebugMessages(prev => [...prev.slice(-9), message]);
  };
  
  // Fetch the user's organizations when the component mounts
  useEffect(() => {
    const fetchUserOrganizations = async () => {
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
        
        // Get all organization IDs
        const orgIds = userOrgs.map(org => org.organization_id);
        
        // Now fetch all organizations' details
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
          
        if (orgsError) {
          console.error('PlannerModal: Error fetching organizations details', orgsError);
          throw new Error('Failed to fetch organization details. Please try again.');
        }
        
        if (!orgsData || orgsData.length === 0) {
          setError("Organizations not found. Please try refreshing the page.");
          setOrganizationLoading(false);
          return;
        }
        
        // Set all available organizations
        setOrganizations(orgsData.map(org => ({
          id: org.id,
          name: org.name
        })));
        
        // Set the first organization as the default selection
        if (orgsData.length > 0) {
          setSelectedOrganization({
            id: orgsData[0].id,
            name: orgsData[0].name
          });
        }
        
      } catch (error) {
        console.error('Error in fetchUserOrganizations:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setOrganizationLoading(false);
      }
    };
    
    fetchUserOrganizations();
  }, [user]);
  
  // Function to handle organization change
  const handleOrganizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setSelectedOrganization(org);
    }
  };
  
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
  
  // Handle generate plan button click - updated to use our chain-based API
  const handleGeneratePlan = async () => {
    if (!selectedOrganization) {
      setError("Please select an organization first");
      return;
    }
    
    try {
      // Filter out platforms with count = 0
      const activePlatforms = platformSettings
        .filter(p => p.count > 0)
        .map(p => ({
          platform: p.platform,
          count: p.count
        }));
      
      if (activePlatforms.length === 0) {
        setError("Please select at least one platform with a post count greater than 0");
        setChainState({
          isGenerating: false,
          step: 'error',
          progress: 0
        });
        return;
      }
      
      // Clear any previous suggestions and errors
      setSuggestions([]);
      setError(null);
      
      // Start by showing the loading UI immediately
      setChainState({
        isGenerating: true,
        step: 'initializing',
        progress: 5
      });
      
      // Generate a unique chainId that will be used for both SSE and the API request
      const chainId = Date.now().toString();
      addDebug(`Generated chainId: ${chainId}`);
      
      // Establish SSE connection first, before making the POST request
      addDebug('Setting up SSE connection for post generation...');
      
      // Create EventSource with our generated chainId
      const eventSource = new EventSource(`/api/post-generation-chain?chainId=${chainId}`);
      
      // Add an open event handler
      eventSource.onopen = () => {
        addDebug(`SSE connection opened successfully for chainId: ${chainId}`);
      };
      
      // Enhanced message event handler with debugging
      eventSource.onmessage = (event) => {
        try {
          addDebug(`SSE message received: ${event.data.slice(0, 100)}...`);
          const data = JSON.parse(event.data);
          
          // Verify this is for our chain
          if (data.chainId && data.chainId !== chainId) {
            addDebug(`Warning: Received update for wrong chain: ${data.chainId}, expected: ${chainId}`);
            return;
          }
          
          addDebug(`Chain update: ${data.step} - ${data.progress}%`);
          
          // Update chain state in UI with a callback to ensure it's applied
          setChainState(prevState => {
            const newState = {
              isGenerating: data.isGenerating !== false,
              step: data.step || prevState.step,
              progress: typeof data.progress === 'number' ? data.progress : prevState.progress,
              error: data.error
            };
            
            addDebug(`UI state updated: ${newState.step} - ${newState.progress}%`);
            return newState;
          });
          
          // If we have posts directly in the update, save them
          if (data.posts && Array.isArray(data.posts) && data.posts.length > 0) {
            addDebug(`Received ${data.posts.length} posts in SSE update`);
            
            // Process posts to ensure all object properties are stringified
            const processedPosts = data.posts.map((post: PostSuggestion) => ({
              ...post,
              description: typeof post.description === 'object' 
                ? safeStringify(post.description) 
                : post.description || ''
            }));
            
            setSuggestions(processedPosts);
          }
          
          // Handle completion
          if (data.step === 'complete' || !data.isGenerating) {
            addDebug('Chain process complete, closing SSE connection');
            
            // Close the connection
            eventSource.close();
            
            // Make sure the UI reflects completion
            setChainState({
              isGenerating: false,
              step: 'complete',
              progress: 100
            });
            
            // If we still don't have posts, make a final check with the API
            if (!suggestions.length) {
              addDebug('No posts received yet, fetching from API');
              fetchFinalPosts(chainId);
            }
          }
          
          // Handle error
          if (data.step === 'error' || data.error) {
            addDebug(`Error in chain: ${data.error || 'Unknown error'}`);
            setError(data.error || 'An error occurred during post generation');
            eventSource.close();
          }
        } catch (error) {
          console.error('Error processing SSE message:', error, event.data);
          addDebug(`Error processing SSE: ${error}`);
        }
      };
      
      // Enhanced error event handler
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        addDebug(`SSE connection error: ${(error as any)?.message || 'Unknown error'}`);
        
        // Only handle serious errors (e.g., when the connection fails completely)
        if ((error as any).target?.readyState === EventSource.CLOSED) {
          setError('Connection to server lost. Please try again.');
          setChainState({
            isGenerating: false,
            step: 'error',
            progress: 0
          });
          eventSource.close();
        }
      };
      
      // Now make the POST request to start the chain process, passing our chainId
      addDebug(`Making POST request with chainId: ${chainId}`);
      const response = await fetch('/api/post-generation-chain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeFrame,
          currentDate: format(currentDate, 'yyyy-MM-dd'),
          platformSettings: activePlatforms,
          customPrompt: customPrompt || undefined,
          organizationId: selectedOrganization.id,
          clientChainId: chainId // Pass the same chainId we're using for SSE
        }),
      });
      
      let responseData;
      
      try {
        responseData = await response.json();
        addDebug(`API response received: ${response.status}`);
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        throw new Error('Failed to parse server response');
      }
      
      if (!response.ok) {
        // Handle API error
        const errorMessage = responseData.error || `Failed to start post generation: ${response.status} ${response.statusText}`;
        console.error('API error response:', responseData);
        throw new Error(errorMessage);
      }
      
      // If we have an immediate response with posts, use them
      if (responseData.posts && Array.isArray(responseData.posts) && responseData.posts.length > 0) {
        addDebug(`Using ${responseData.posts.length} posts from initial response`);
        
        const processedPosts = responseData.posts.map((post: PostSuggestion) => ({
          ...post,
          description: typeof post.description === 'object' 
            ? safeStringify(post.description) 
            : post.description || ''
        }));
        
        setSuggestions(processedPosts);
        
        // Update chain state to complete if we have posts immediately
        setChainState({
          isGenerating: false,
          step: 'complete',
          progress: 100
        });
        
        // Close the SSE connection since we're done
        eventSource.close();
      }
    } catch (err) {
      console.error('Error generating plan:', err);
      addDebug(`Error: ${err}`);
      setError(err instanceof Error ? err.message : 'Failed to generate post ideas');
      
      // Update chain state to error
      setChainState({
        isGenerating: false,
        step: 'error',
        progress: 0
      });
    }
  };
  
  // Helper function to fetch posts for a chain ID if they weren't received via SSE
  const fetchFinalPosts = async (chainId: string) => {
    try {
      addDebug(`Fetching final posts for chain ${chainId} from API`);
      const response = await fetch(`/api/chain-results?chainId=${chainId}`);
      
      let data;
      try {
        data = await response.json();
        addDebug(`Chain results API response received`);
      } catch (parseError) {
        console.error('Error parsing chain results response:', parseError);
        addDebug(`Error parsing API response: ${parseError}`);
        setError('Failed to parse response from server');
        return;
      }
      
      if (!response.ok) {
        console.error('Failed to fetch final posts:', response.status, response.statusText, data);
        addDebug(`API error: ${response.status} - ${data?.error || 'Unknown error'}`);
        setError(data?.error || `Failed to fetch posts: ${response.status}`);
        return;
      }
      
      if (data.posts && Array.isArray(data.posts)) {
        if (data.posts.length > 0) {
          addDebug(`Setting ${data.posts.length} posts from API response`);
          
          // Process posts to ensure all object properties are stringified
          const processedPosts = data.posts.map((post: PostSuggestion) => ({
            ...post,
            description: typeof post.description === 'object' 
              ? safeStringify(post.description) 
              : post.description || ''
          }));
          
          setSuggestions(processedPosts);
          
          // Update chain state to complete
          setChainState({
            isGenerating: false,
            step: 'complete',
            progress: 100
          });
        } else {
          addDebug('API returned empty posts array');
          setError('No posts were generated. Please try again.');
        }
      } else {
        console.error('Invalid or missing posts in API response:', data);
        addDebug(`Invalid API response: missing posts array`);
        setError('Invalid response from server. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching final posts:', error);
      addDebug(`Error fetching posts: ${error}`);
      setError('Failed to retrieve generated posts. Please try again.');
    }
  };
  
  // Clean up any event sources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any EventSource connections when component unmounts
      if (typeof window !== 'undefined') {
        addDebug("Component unmounting, ensuring connections are closed");
      }
    };
  }, []);
  
  // Get step label for display
  const getStepLabel = (step: ChainStep): string => {
    switch (step) {
      case 'initializing':
        return 'Initializing...';
      case 'generating-ideas':
        return 'Generating post ideas...';
      case 'elaborating-content':
        return 'Elaborating content...';
      case 'generating-seo':
        return 'Analyzing SEO factors...';
      case 'scheduling-posts':
        return 'Optimizing posting schedule...';
      case 'complete':
        return 'Complete!';
      case 'error':
        return 'Error';
      default:
        return 'Processing...';
    }
  };
  
  const getStepDescription = (step: ChainStep): string => {
    switch (step) {
      case 'initializing':
        return 'Setting up and preparing to generate content...';
      case 'generating-ideas':
        return 'Creating engaging post ideas based on your requirements...';
      case 'elaborating-content':
        return 'Developing detailed content outlines and structure...';
      case 'generating-seo':
        return 'Analyzing content for search optimization opportunities...';
      case 'scheduling-posts':
        return 'Creating an optimal posting schedule for maximum engagement...';
      case 'complete':
        return 'All posts have been generated successfully!';
      case 'error':
        return 'An error occurred during content generation.';
      default:
        return 'Processing your content request...';
    }
  };
  
  // Handle saving the plan to the database
  const handleSavePlan = async () => {
    if (!selectedOrganization) {
      setError("Organization not found");
      return;
    }
    
    setChainState({
      ...chainState,
      isGenerating: true
    });
    
    setError(null);
    
    try {
      // Call API to save suggestions to the database
      const response = await fetch('/api/posts/suggested', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestions,
          organizationId: selectedOrganization.id,
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
      
      // Refresh the calendar
      await refreshPosts();
      
      // Close the modal
      onClose();
    } catch (err) {
      console.error('Error saving plan:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setChainState({
        ...chainState,
        isGenerating: false
      });
    }
  };
  
  // Helper function to safely stringify any object for rendering
  const safeStringify = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'object') {
      try {
        // If it's an array, join the elements
        if (Array.isArray(value)) {
          return value.map(item => safeStringify(item)).join(', ');
        }
        
        // Otherwise, stringify the object
        return JSON.stringify(value);
      } catch (e) {
        console.error('Error stringifying object:', e);
        return '[Object]';
      }
    }
    
    return String(value);
  };
  
  // Add new function to handle regeneration
  const handleRegeneratePost = async (postIndex: number) => {
    if (!selectedOrganization) {
      setError("Organization not found");
      return;
    }
    
    // Set regenerating state
    setRegeneratingPostIndex(postIndex);
    setRegenerationError(null);
    
    try {
      // Get the post to regenerate
      const postToRegenerate = suggestions[postIndex];
      
      // Call API to regenerate just this post
      const response = await fetch('/api/post-regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post: postToRegenerate,
          organizationId: selectedOrganization.id,
        }),
      });
      
      // Check if the response is OK
      if (!response.ok) {
        let errorMessage = `Failed to regenerate post: ${response.status} ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      // Parse the response
      const data = await response.json();
      
      if (data.success && data.regeneratedPost) {
        // Update the suggestions with the regenerated post
        const updatedSuggestions = [...suggestions];
        updatedSuggestions[postIndex] = data.regeneratedPost;
        setSuggestions(updatedSuggestions);
        addDebug(`Successfully regenerated post: ${data.regeneratedPost.title}`);
      } else {
        throw new Error('Regeneration response missing data');
      }
    } catch (error) {
      console.error('Error regenerating post:', error);
      setRegenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
      addDebug(`Error regenerating post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear regenerating state
      setRegeneratingPostIndex(null);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      size="5xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {/* Organization Selection Section - Always visible */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-2">Select Organization</h3>
          {organizationLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-gray-500">Loading organizations...</span>
            </div>
          ) : (
            <div className="max-w-md">
              <select
                value={selectedOrganization?.id || ''}
                onChange={handleOrganizationChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={organizations.length <= 1 || chainState.isGenerating}
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
                {organizations.length === 0 && (
                  <option value="" disabled>No organizations available</option>
                )}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Select the organization you want to generate content for
              </p>
            </div>
          )}
        </div>
        
        {/* Main content - Conditionally show inputs or progress */}
        {chainState.isGenerating ? (
          // Progress UI
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {/* Progress indicator */}
            <div className="flex flex-col items-center justify-center py-6">
              {/* Progress bar */}
              <div className="w-full max-w-md mb-8">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{
                      width: `${chainState.progress}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Status label and description */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-medium mb-2">
                  {getStepLabel(chainState.step)}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  {getStepDescription(chainState.step)}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {Math.round(chainState.progress)}% complete
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Creating content for {selectedOrganization?.name}
                </p>
              </div>
              
              {/* Step progress indicators */}
              <div className="w-full max-w-md space-y-2 mt-2 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800">
                {['initializing', 'generating-ideas', 'elaborating-content', 'generating-seo', 'scheduling-posts', 'complete'].map((step) => {
                  const stepName = step as ChainStep;
                  const isActive = stepName === chainState.step;
                  const isCompleted = 
                    (stepName === 'initializing' && chainState.progress > 10) ||
                    (stepName === 'generating-ideas' && chainState.progress > 30) ||
                    (stepName === 'elaborating-content' && chainState.progress > 55) ||
                    (stepName === 'generating-seo' && chainState.progress > 75) ||
                    (stepName === 'scheduling-posts' && chainState.progress > 95) ||
                    (stepName === 'complete' && chainState.progress === 100);
                    
                  return (
                    <div key={step} className={`flex items-center p-2 rounded ${
                      isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        isActive ? 'bg-blue-100 text-blue-600 border-2 border-blue-600 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-400' : 
                        isCompleted ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 
                        'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      }`}>
                        {isCompleted ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="text-sm font-medium">{step === 'initializing' ? '1' : 
                            step === 'generating-ideas' ? '2' : 
                            step === 'elaborating-content' ? '3' : 
                            step === 'generating-seo' ? '4' : 
                            step === 'scheduling-posts' ? '5' : '✓'}
                          </span>
                        )}
                      </div>
                      <span className={`text-sm ${
                        isActive ? 'font-medium text-blue-600 dark:text-blue-300' : 
                        isCompleted ? 'text-green-600 dark:text-green-300' : 
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {getStepLabel(stepName)}
                      </span>
                      {isActive && (
                        <div className="ml-auto animate-pulse">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 mr-1"></span>
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-500 mr-1 animation-delay-100"></span>
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-600 animation-delay-200"></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Loading spinner */}
              <div className="relative w-16 h-16 mt-6">
                <svg className="animate-spin w-16 h-16 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          </div>
        ) : suggestions.length > 0 ? (
          // Show suggestions when generation is complete
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              <p>Created {suggestions.length} post ideas for {selectedOrganization?.name}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {suggestions.map((post, index) => (
                <div key={index} className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium">{post.title}</h3>
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          post.platform === 'Web' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                          post.platform === '𝕏' || post.platform === 'X' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                          post.platform === 'Instagram' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300' :
                          post.platform === 'Facebook' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                          post.platform === 'LinkedIn' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {post.platform === '𝕏' ? 'X' : post.platform}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
                    {safeStringify(post.description)}
                  </p>
                  
                  {post.seo_info?.reasonsData?.reasons && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium mb-1">SEO Factors:</h4>
                      <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
                        {post.seo_info.reasonsData.reasons.slice(0, 2).map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {post.posted_date && (
                        <span>
                          Scheduled: {format(new Date(post.posted_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Format: {post.format || 'Standard post'}
                    </div>
                  </div>
                  
                  {post.derivedFrom && (
                    <div className="mt-2 text-xs text-blue-500 dark:text-blue-400 italic">
                      Derived from blog post: "{post.derivedFrom}"
                    </div>
                  )}
                  
                  {/* Add regenerate button */}
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleRegeneratePost(index)}
                      disabled={regeneratingPostIndex !== null}
                      className={`text-xs px-2 py-1 rounded flex items-center ${
                        regeneratingPostIndex === index
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 cursor-wait'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {regeneratingPostIndex === index ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Regenerate Content
                        </>
                      )}
                    </button>
                  </div>
                  
                  {regenerationError && regeneratingPostIndex === index && (
                    <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                      Error: {regenerationError}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Input form for initial state
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="space-y-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-3">1. Choose content quantity by platform</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {platformSettings.map((platform, index) => (
                    <div key={index} className="bg-white dark:bg-gray-700 rounded-lg shadow p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">{platform.logo}</span>
                          <h4 className="font-medium">{platform.platform}</h4>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center focus:outline-none"
                            onClick={() => handleCountChange(platform.platform, Math.max(platform.count - 1, platform.min || 0))}
                            disabled={platform.count <= (platform.min || 0) || chainState.isGenerating}
                          >
                            <span>-</span>
                          </button>
                          <span className="w-6 text-center">{platform.count}</span>
                          <button
                            className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center focus:outline-none"
                            onClick={() => handleCountChange(platform.platform, Math.min(platform.count + 1, platform.max || 10))}
                            disabled={platform.count >= (platform.max || 10) || chainState.isGenerating}
                          >
                            <span>+</span>
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(platform.count / (platform.max || 10)) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">2. Content focus (optional)</h3>
                <textarea
                  placeholder="Describe what you want your content to focus on. For example: 'Content about our new product launch' or 'Focus on sustainability initiatives'"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 min-h-[100px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={chainState.isGenerating}
                ></textarea>
              </div>
            </div>
          </div>
        )}
        
        {/* Debug messages in development */}
        {process.env.NODE_ENV === 'development' && debugMessages.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono overflow-auto max-h-32 bg-gray-50 dark:bg-gray-800">
            <h4 className="font-semibold mb-1">Debug Messages:</h4>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              {debugMessages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Footer with action buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={chainState.isGenerating}
          >
            {suggestions.length > 0 ? 'Close' : 'Cancel'}
          </button>
          
          {!organizationLoading && selectedOrganization && !error && (
            <>
              {!chainState.isGenerating && chainState.step !== 'complete' ? (
                <button
                  onClick={handleGeneratePlan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={organizationLoading}
                >
                  Generate Content Plan
                </button>
              ) : chainState.step === 'complete' && suggestions.length > 0 ? (
                <button
                  onClick={handleSavePlan}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Save to Calendar
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
} 