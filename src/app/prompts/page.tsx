'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// Define types for organization and preferences
type Organization = {
  id: string;
  name: string;
  role: string;
};

type Preferences = {
  contentPhilosophy?: string;
  bestPostingTimes?: string[];
  preferredContentTypes?: string[];
  contentTone?: string;
  targetAudience?: string;
  customPrompts?: {
    [key: string]: string;
  };
};

export default function PromptsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customPromptKey, setCustomPromptKey] = useState('');
  const [customPromptValue, setCustomPromptValue] = useState('');

  // Fetch user's organizations
  useEffect(() => {
    if (!user) return;
    
    const fetchOrganizations = async () => {
      try {
        // Get the user's organization IDs and roles
        const { data: userOrgs, error: userOrgsError } = await supabase
          .from('user_organizations')
          .select('organization_id, role')
          .eq('user_id', user.id);

        if (userOrgsError) {
          console.error('Error fetching user organization links', userOrgsError);
          return;
        }

        if (!userOrgs || userOrgs.length === 0) {
          setIsLoading(false);
          return;
        }
        
        // Now fetch the organization details
        const orgIds = userOrgs.map(org => org.organization_id);
        
        const { data: orgsData, error: orgsDataError } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
          
        if (orgsDataError) {
          console.error('Error fetching organization details', orgsDataError);
          setIsLoading(false);
          return;
        }
        
        // Combine the two datasets
        const transformedOrgs = userOrgs.map(userOrg => {
          const orgData = orgsData?.find(org => org.id === userOrg.organization_id);
          if (!orgData) return null;
          
          return {
            id: orgData.id,
            name: orgData.name,
            role: userOrg.role
          };
        }).filter(org => org !== null) as Organization[];
        
        setOrganizations(transformedOrgs);
        
        // Set the first organization as default selected if available
        if (transformedOrgs.length > 0) {
          setSelectedOrganizationId(transformedOrgs[0].id);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizations();
  }, [user]);

  // Fetch organization preferences when selected organization changes
  useEffect(() => {
    if (!selectedOrganizationId || !user) return;
    
    const fetchPreferences = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/organizations/preferences?organizationId=${selectedOrganizationId}&userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }
        
        const data = await response.json();
        setPreferences(data.preferences || {});
      } catch (error) {
        console.error('Error fetching preferences:', error);
        setMessage({
          type: 'error',
          text: 'Failed to load organization preferences'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPreferences();
  }, [selectedOrganizationId, user]);

  // Handle saving preferences
  const handleSavePreferences = async () => {
    if (!selectedOrganizationId || !user) {
      setMessage({
        type: 'error',
        text: 'Please select an organization first'
      });
      return;
    }
    
    setIsSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/organizations/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: selectedOrganizationId,
          userId: user.id,
          preferences
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update preferences');
      }
      
      setMessage({
        type: 'success',
        text: 'Preferences saved successfully'
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save preferences'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle adding a custom prompt
  const handleAddCustomPrompt = () => {
    if (!customPromptKey.trim() || !customPromptValue.trim()) {
      setMessage({
        type: 'error',
        text: 'Both prompt name and value are required'
      });
      return;
    }
    
    setPreferences(prev => ({
      ...prev,
      customPrompts: {
        ...(prev.customPrompts || {}),
        [customPromptKey]: customPromptValue
      }
    }));
    
    // Clear the input fields
    setCustomPromptKey('');
    setCustomPromptValue('');
  };

  // Handle removing a custom prompt
  const handleRemoveCustomPrompt = (key: string) => {
    if (!preferences.customPrompts) return;
    
    const newCustomPrompts = { ...preferences.customPrompts };
    delete newCustomPrompts[key];
    
    setPreferences(prev => ({
      ...prev,
      customPrompts: newCustomPrompts
    }));
  };

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 dark:text-white">Prompts</h1>
        <div className="bg-amber-100 dark:bg-amber-900 p-4 rounded-md">
          <p className="text-amber-800 dark:text-amber-200">
            Please sign in to manage organization prompts and preferences.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">Prompts & Preferences</h1>
      
      {/* Organization selector */}
      <div className="mb-6">
        <label htmlFor="organization" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Organization
        </label>
        <select
          id="organization"
          value={selectedOrganizationId || ''}
          onChange={(e) => setSelectedOrganizationId(e.target.value || null)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          disabled={isLoading}
        >
          <option value="">-- Select an organization --</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.role})
            </option>
          ))}
        </select>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : selectedOrganizationId ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Organization Preferences</h2>
          
          {/* Content Philosophy and Target Audience side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Content Philosophy */}
            <div>
              <label htmlFor="contentPhilosophy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Philosophy
              </label>
              <textarea
                id="contentPhilosophy"
                value={preferences.contentPhilosophy || ''}
                onChange={(e) => setPreferences(prev => ({ ...prev, contentPhilosophy: e.target.value }))}
                className="w-full h-60 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white overflow-y-auto resize-none"
                placeholder="Describe your organization's content philosophy and approach..."
              />
            </div>
            
            {/* Target Audience */}
            <div>
              <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Audience
              </label>
              <textarea
                id="targetAudience"
                value={preferences.targetAudience || ''}
                onChange={(e) => setPreferences(prev => ({ ...prev, targetAudience: e.target.value }))}
                className="w-full h-60 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white overflow-y-auto resize-none"
                placeholder="Describe your target audience in detail..."
              />
            </div>
          </div>
          
          {/* Content Tone */}
          <div className="mb-6">
            <label htmlFor="contentTone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content Tone
            </label>
            <select
              id="contentTone"
              value={preferences.contentTone || ''}
              onChange={(e) => setPreferences(prev => ({ ...prev, contentTone: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">-- Select a tone --</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="friendly">Friendly</option>
              <option value="authoritative">Authoritative</option>
              <option value="technical">Technical</option>
              <option value="conversational">Conversational</option>
            </select>
          </div>
          
          {/* Preferred Content Types */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred Content Types
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {['Blog Posts', 'Case Studies', 'Whitepapers', 'Tutorials', 'News', 'Reviews', 'Interviews', 'Podcasts'].map((type) => (
                <label key={type} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={(preferences.preferredContentTypes || []).includes(type)}
                    onChange={(e) => {
                      const currentTypes = preferences.preferredContentTypes || [];
                      if (e.target.checked) {
                        setPreferences(prev => ({
                          ...prev,
                          preferredContentTypes: [...currentTypes, type]
                        }));
                      } else {
                        setPreferences(prev => ({
                          ...prev,
                          preferredContentTypes: currentTypes.filter(t => t !== type)
                        }));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{type}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Custom Prompts */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Custom Prompts</h3>
            
            {/* Add new prompt */}
            <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="promptName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prompt Name
                  </label>
                  <input
                    id="promptName"
                    type="text"
                    value={customPromptKey}
                    onChange={(e) => setCustomPromptKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Blog Introduction"
                  />
                </div>
                <div>
                  <label htmlFor="promptValue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prompt Template
                  </label>
                  <textarea
                    id="promptValue"
                    value={customPromptValue}
                    onChange={(e) => setCustomPromptValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    rows={3}
                    placeholder="Write a compelling introduction for a blog post about..."
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleAddCustomPrompt}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors duration-200"
                >
                  Add Prompt
                </button>
              </div>
            </div>
            
            {/* List of existing prompts */}
            {preferences.customPrompts && Object.keys(preferences.customPrompts).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(preferences.customPrompts).map(([key, value]) => (
                  <div key={key} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">{key}</h4>
                      <button
                        onClick={() => handleRemoveCustomPrompt(key)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-md">
                <p className="text-gray-500 dark:text-gray-400">No custom prompts added yet</p>
              </div>
            )}
          </div>
          
          {/* Save button */}
          <div className="flex justify-end mt-6">
            <button
              onClick={handleSavePreferences}
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="flex items-center">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
          
          {/* Message display */}
          {message && (
            <div className={`mt-4 p-3 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Please select an organization to manage its prompts and preferences.
          </p>
        </div>
      )}
    </div>
  );
} 