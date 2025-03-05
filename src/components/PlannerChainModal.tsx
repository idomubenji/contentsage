import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarViewType } from '@/components/calendar/CalendarContext';
import { ChainStep } from '@/app/api/post-generation-chain/types';

interface PlatformSetting {
  platform: string;
  count: number;
  min?: number;
  max?: number;
  logo?: string;
}

interface PlannerChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeFrame: CalendarViewType;
  currentDate: Date;
  organizationId: string;
}

interface ChainState {
  isGenerating: boolean;
  step: ChainStep;
  progress: number;
  error?: string;
}

export default function PlannerChainModal({ 
  isOpen, 
  onClose, 
  timeFrame, 
  currentDate,
  organizationId
}: PlannerChainModalProps) {
  const router = useRouter();
  
  // Platform settings state
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([
    { platform: 'Web', count: 1, min: 0, max: 10, logo: '/icons/web.svg' },
    { platform: 'LinkedIn', count: 2, min: 0, max: 10, logo: '/icons/linkedin.svg' },
    { platform: '𝕏', count: 3, min: 0, max: 10, logo: '/icons/twitter.svg' },
    { platform: 'Instagram', count: 1, min: 0, max: 10, logo: '/icons/instagram.svg' }
  ]);
  
  // Custom prompt state
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Chain state
  const [chainState, setChainState] = useState<ChainState>({
    isGenerating: false,
    step: 'initializing',
    progress: 0
  });
  
  // Generated posts
  const [generatedPosts, setGeneratedPosts] = useState<any[]>([]);
  
  // Handle count change for platforms
  const handleCountChange = (platform: string, newCount: number) => {
    setPlatformSettings(prev => 
      prev.map(p => p.platform === platform ? { ...p, count: newCount } : p)
    );
  };
  
  // Generate posts using the chain API
  const handleGeneratePlan = async () => {
    setChainState({
      isGenerating: true,
      step: 'initializing',
      progress: 0
    });
    
    try {
      // Validate inputs
      const activePlatforms = platformSettings
        .filter(p => p.count > 0)
        .map(p => ({ platform: p.platform, count: p.count }));
      
      if (activePlatforms.length === 0) {
        setChainState({
          isGenerating: false,
          step: 'error',
          progress: 0,
          error: 'No platforms selected'
        });
        return;
      }
      
      // Call the chain API
      const response = await fetch('/api/post-generation-chain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeFrame,
          currentDate: currentDate.toISOString(),
          platformSettings: activePlatforms,
          customPrompt: customPrompt || undefined,
          organizationId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate posts');
      }
      
      const data = await response.json();
      
      // Start polling for results using the chainId
      if (data.chainId) {
        startResultPolling(data.chainId);
      } else {
        throw new Error('No chain ID returned from API');
      }
    } catch (error) {
      console.error('Error generating plan:', error);
      
      setChainState({
        isGenerating: false,
        step: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
  
  // Poll for chain results
  const startResultPolling = (chainId: string) => {
    // Set up polling interval
    const pollInterval = setInterval(async () => {
      try {
        // Fetch current state from the chain-results endpoint
        const response = await fetch(`/api/chain-results?chainId=${chainId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch chain results');
        }
        
        const data = await response.json();
        
        if (data && data.chainState) {
          // Update local chain state
          setChainState({
            isGenerating: data.chainState.isGenerating,
            step: data.chainState.step,
            progress: data.chainState.progress,
            error: data.chainState.error
          });
          
          // If we have final results, update posts and stop polling
          if (data.chainState.step === 'complete' && 
              data.chainState.partialResults?.finalPosts) {
            setGeneratedPosts(data.chainState.partialResults.finalPosts);
            clearInterval(pollInterval);
          }
          
          // If there's an error, stop polling
          if (data.chainState.step === 'error') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Error polling for results:', error);
        
        // Stop polling on error
        clearInterval(pollInterval);
        
        setChainState({
          isGenerating: false,
          step: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Failed to fetch results'
        });
      }
    }, 2000); // Poll every 2 seconds
    
    // Clean up interval on component unmount
    return () => clearInterval(pollInterval);
  };
  
  // Save generated posts to the database
  const handleSavePlan = async () => {
    try {
      // Call the API to save posts
      const response = await fetch('/api/posts/suggested', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          suggestions: generatedPosts,
          organizationId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save posts');
      }
      
      // Close modal and refresh data
      onClose();
      router.refresh();
      
    } catch (error) {
      console.error('Error saving posts:', error);
      alert('Failed to save posts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };
  
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
        return 'Generation complete!';
      case 'error':
        return 'Error generating posts';
      default:
        return 'Processing...';
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 dark:text-white">
          Generate Content Plan for {timeFrame}
        </h2>
        
        {/* Platform selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">How many posts do you want?</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {platformSettings.map((platform) => (
              <div key={platform.platform} className="border dark:border-gray-700 rounded-lg p-3 dark:bg-gray-700">
                <div className="flex items-center mb-2">
                  {platform.logo && (
                    <img 
                      src={platform.logo} 
                      alt={platform.platform} 
                      className="w-6 h-6 mr-2" 
                    />
                  )}
                  <span className="font-medium dark:text-white">{platform.platform}</span>
                </div>
                <input
                  type="number"
                  min={platform.min || 0}
                  max={platform.max || 10}
                  value={platform.count}
                  onChange={(e) => handleCountChange(platform.platform, parseInt(e.target.value) || 0)}
                  className="w-full border dark:border-gray-600 rounded p-2 dark:bg-gray-600 dark:text-white"
                  disabled={chainState.isGenerating}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Custom prompt */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 dark:text-white">Any specific focus or themes?</h3>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="E.g., product launch, industry trends, customer success stories..."
            className="w-full border dark:border-gray-600 rounded p-2 h-24 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            disabled={chainState.isGenerating}
          />
        </div>
        
        {/* Progress indicator */}
        {chainState.isGenerating && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 dark:text-white">
              {getStepLabel(chainState.step)}
            </h3>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${chainState.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {chainState.progress}% complete
            </p>
          </div>
        )}
        
        {/* Error message */}
        {chainState.error && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300">
            {chainState.error}
          </div>
        )}
        
        {/* Generated posts preview */}
        {generatedPosts.length > 0 && chainState.step === 'complete' && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 dark:text-white">Generated Posts</h3>
            <div className="max-h-60 overflow-y-auto border dark:border-gray-700 rounded p-3 dark:bg-gray-700">
              {generatedPosts.map((post, index) => (
                <div key={index} className="mb-3 pb-3 border-b dark:border-gray-600 last:border-b-0">
                  <div className="flex justify-between">
                    <span className="font-medium dark:text-white">{post.title}</span>
                    <span className="text-sm bg-gray-200 dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded">
                      {post.platform}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {post.description.substring(0, 100)}
                    {post.description.length > 100 ? '...' : ''}
                  </p>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(post.posted_date).toLocaleDateString()} at {new Date(post.posted_date).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            disabled={chainState.isGenerating}
          >
            Cancel
          </button>
          
          {generatedPosts.length === 0 || chainState.step !== 'complete' ? (
            <button
              onClick={handleGeneratePlan}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={chainState.isGenerating}
            >
              {chainState.isGenerating ? 'Generating...' : 'Generate Plan'}
            </button>
          ) : (
            <button
              onClick={handleSavePlan}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Save Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 