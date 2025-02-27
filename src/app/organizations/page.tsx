"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
// Remove the createClient import
// import { createClient } from "@supabase/supabase-js";
// Import the shared supabase client instead
import { supabase } from "../../lib/supabase";
import { syncUserToDatabase } from "../../lib/user-utils";
// Remove the supabaseAdmin import as we're using the API now
// import { supabaseAdmin } from "../../lib/supabase-admin";

// Add a type for the organizations data
type OrganizationJoin = {
  organization_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
  } | null;
};

type Organization = {
  id: string;
  name: string;
  role: string;
  info?: {
    industry?: string;
    description?: string;
    strategy?: string;
    tone?: string;
    lastAnalyzed?: string;
  } | null;
};

// Add a type for post data
type Post = {
  id: string;
  url: string;
  title: string;
  description: string;
  posted_date: string;
  format: string;
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [myOrganizations, setMyOrganizations] = useState<Organization[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [joinRequestsToApprove, setJoinRequestsToApprove] = useState<any[]>([]);
  const [error, setError] = useState("");
  // Add success message state
  const [successMessage, setSuccessMessage] = useState("");
  // Add states for organization analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgDetailsOpen, setOrgDetailsOpen] = useState<string | null>(null);

  // Remove the Supabase client initialization
  // const supabase = createClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  // );

  // Fetch user's organizations and pending requests
  useEffect(() => {
    if (!user) return;
    
    const fetchOrganizations = async () => {
      setIsLoading(true);
      
      try {
        // Attempt to ensure user is synchronized to the database - simplified
        try {
          console.log("Organizations: Ensuring user is synchronized to database...");
          await syncUserToDatabase();
          console.log("Organizations: User sync completed or was skipped");
        } catch (syncError) {
          console.warn("Organizations: User sync warning (continuing anyway):", syncError);
          // We'll continue anyway since the sync function now has better error handling
        }

        // Fetch organizations the user belongs to
        try {
          console.log("Organizations: Fetching user organizations with user ID:", user.id);
          
          // CHANGE: Split this into two separate queries instead of using a join
          // First get the user's organization IDs and roles
          const { data: userOrgs, error: userOrgsError } = await supabase
            .from('user_organizations')
            .select('organization_id, role')
            .eq('user_id', user.id);

          console.log("Organizations: User organizations query response", { data: userOrgs, error: userOrgsError });

          if (userOrgsError) {
            // Check if this is a permissions error (could indicate the user isn't in the users table)
            if (userOrgsError.code === '42501' || userOrgsError.message?.includes('permission')) {
              console.error('Organizations: Possible permissions issue - user may not be properly synced', {
                code: userOrgsError.code,
                message: userOrgsError.message,
                details: userOrgsError.details
              });
              throw new Error(
                'You may not have the correct permissions. Please try refreshing the page.'
              );
            }
            throw userOrgsError;
          }

          // Handle case where userOrgs is null or empty (new user with no organizations)
          if (!userOrgs || userOrgs.length === 0) {
            console.log('Organizations: User has no organizations');
            setMyOrganizations([]);
          } else {
            // Now fetch the organization details in a separate query
            const orgIds = userOrgs.map(org => org.organization_id);
            console.log('Organization IDs from user_organizations:', orgIds);
            
            const { data: orgsData, error: orgsDataError } = await supabase
              .from('organizations')
              .select('id, name')
              .in('id', orgIds);
              
            if (orgsDataError) {
              console.error('Organizations: Error fetching organization details', orgsDataError);
              throw orgsDataError;
            }
            
            console.log('Organizations data from database:', orgsData);
            
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
            
            console.log('Organizations: Transformed organization data:', transformedOrgs);
            setMyOrganizations(transformedOrgs);
          }
        } catch (fetchError) {
          // Improved error handling with detailed logging
          console.error('Organizations: Error fetching organizations:', fetchError);
          
          // Add more detailed logging to see what's in the error
          if (fetchError instanceof Error) {
            console.error('Error details:', {
              name: fetchError.name,
              message: fetchError.message,
              stack: fetchError.stack
            });
          } else {
            console.error('Non-Error object received:', typeof fetchError, JSON.stringify(fetchError));
          }
          
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load organizations. Try refreshing the page.');
          
          // Still set empty organizations to make the page usable
          setMyOrganizations([]);
        }

        // Fetch pending join requests (could be stored in a separate table in the future)
        // This is a placeholder for now
        setPendingRequests([]);
        
        // Fetch join requests waiting for approval (for admins)
        // This is a placeholder for now
        setJoinRequestsToApprove([]);
      } catch (error) {
        console.error('Organizations: Error fetching organizations:', error);
        setError(error instanceof Error ? error.message : 'Failed to load organizations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizations();
  }, [user]); // Remove userSyncRetried from dependencies

  const searchOrganization = async () => {
    if (!organizationName.trim()) {
      return;
    }
    
    try {
      setError("");
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .ilike('name', `%${organizationName}%`);
      
      if (error) throw error;
      
      // Filter out organizations the user already belongs to
      const filteredResults = data.filter(org => 
        !myOrganizations.some(myOrg => myOrg.id === org.id)
      );
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching organizations:', error);
      setError('Failed to search organizations');
    }
  };

  const handleCreateOrganization = async () => {
    if (!organizationName.trim() || !user) {
      setError("Organization name cannot be empty");
      return;
    }
    
    // Define a type for organization data
    type OrganizationData = {
      id: string;
      name: string;
      created_at?: string;
      updated_at?: string;
      deleted_at?: string | null;
    };
    
    let newOrgData: OrganizationData | null = null;
    
    try {
      setError("");
      
      // First check if an organization with this name already exists
      console.log("Checking if organization already exists:", organizationName);
      const { data: existingOrgs, error: searchError } = await supabase
        .from('organizations')
        .select('*')
        .ilike('name', organizationName);
        
      if (searchError) {
        console.error("Error searching for existing organizations:", searchError);
        throw new Error("Failed to check for existing organizations");
      }
      
      // Check if user already belongs to an organization with this name
      if (existingOrgs && existingOrgs.length > 0) {
        const userAlreadyInOrg = myOrganizations.some(org => 
          org.name.toLowerCase() === organizationName.toLowerCase()
        );
        
        if (userAlreadyInOrg) {
          setError(`You are already a member of an organization named "${organizationName}"`);
          return;
        }
        
        // Ask if user wants to request to join instead
        if (confirm(`An organization named "${organizationName}" already exists. Would you like to request to join instead of creating a new one?`)) {
          // Find the organization from search results
          const orgToJoin = existingOrgs[0];
          handleRequestJoin(orgToJoin.id);
          return;
        } else {
          // User chose not to join, we'll continue with creation with a slightly modified name
          console.log("User chose to create a new organization anyway");
        }
      }
      
      console.log("Creating organization: Step 1 - Preparing to insert organization", { name: organizationName });
      
      // Use the API endpoint to create the organization
      try {
        console.log("Calling API to create organization", {
          name: organizationName,
          userId: user.id
        });
        
        const response = await fetch('/api/organizations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: organizationName,
            userId: user.id
          }),
        });
        
        const result = await response.json();
        console.log("Creating organization: Step 2 - API response", result);
        
        // Check for warnings in partial success case
        if (result.warning) {
          console.warn("API returned warning:", result.warning);
        }
        
        // Handle both complete and partial success (207)
        if (!response.ok && response.status !== 207) {
          console.error("Creating organization: Step 2 Error", {
            status: response.status,
            statusText: response.statusText,
            error: result.error
          });
          throw new Error(result.error || `API returned ${response.status}: ${response.statusText}`);
        }
        
        if (!result.organization) {
          console.error("Creating organization: Step 2 Error - No organization returned");
          throw new Error("No organization data returned from API");
        }
        
        // If there's a warning, show it to the user but continue
        if (result.warning) {
          // Set a warning but don't block execution
          console.warn("Warning during organization creation:", result.warning);
          setError(`Note: ${result.warning}`);
        }
        
        // Save this for later use outside the try block
        newOrgData = result.organization;
        
        console.log("Creating organization: Step 3 - Organization created successfully", newOrgData);
        
        // Skip the user_organizations insert since the API handles it
        
        // Update local state
        console.log("Creating organization: Step 4 - Updating UI state");
      } catch (innerError) {
        console.error("Creating organization: Inner try-catch error", innerError);
        throw innerError;
      }
      
      // Move UI updates outside the inner try/catch to avoid silent failures
      if (newOrgData) {
        try {
          // Ensure newOrgData conforms to the Organization type
          const newOrganization: Organization = {
            id: newOrgData.id,
            name: newOrgData.name,
            role: 'admin'
          };
          setMyOrganizations(prev => [...prev, newOrganization]);
          setIsModalOpen(false);
          setOrganizationName("");
          setSearchResults([]);
          console.log("Creating organization: Complete");
        } catch (uiError) {
          console.error("Creating organization: Error updating UI", uiError);
          // Still consider the operation successful even if UI update fails
          // Just show a warning
          console.warn("Organization was created successfully, but UI may not reflect the change immediately.");
        }
      }
    } catch (error) {
      // More detailed error logging
      console.error('Error creating organization:', error);
      
      // Try to extract more useful information from the error
      let errorMessage;
      
      if (error instanceof Error) {
        errorMessage = `${error.name}: ${error.message}`;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (jsonError) {
          errorMessage = 'Cannot stringify error object';
          console.error('Error stringifying error object:', jsonError);
          console.error('Original error object:', error);
        }
      } else {
        errorMessage = 'Unknown error';
      }
          
      console.error('Error details:', errorMessage);
      setError(`Failed to create organization: ${errorMessage}`);
    }
  };

  const handleRequestJoin = async (orgId: string) => {
    if (!user) return;
    
    try {
      setError("");
      console.log(`Requesting to join organization ${orgId}`);
      
      // In a real implementation, this would create a pending request in a separate table
      // For this demo, we'll just add to the user_organizations table directly with "pending" role
      const { error: joinError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: orgId,
          role: 'pending' // This would require additional handling in a real app
        });
      
      if (joinError) {
        console.error("Error joining organization:", joinError);
        throw new Error("Failed to join organization");
      }
      
      // Add to pending requests in UI
      const org = searchResults.find(o => o.id === orgId);
      if (org) {
        setPendingRequests(prev => [...prev, org]);
        
        // Remove from search results
        setSearchResults(prev => prev.filter(o => o.id !== orgId));
        
        // Show success message
        setError("Join request sent successfully. Waiting for approval.");
      }
      
      // Close the modal
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error requesting to join:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit join request');
    }
  };

  const openModal = () => {
    console.log("Opening modal");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    console.log("Closing modal");
    setIsModalOpen(false);
    setOrganizationName("");
    setSearchResults([]);
    setError("");
  };

  // Add function to save analysis results to preferences
  const saveAnalysisToPreferences = async (orgId: string, analysisInfo: any) => {
    console.log("saveAnalysisToPreferences called with:", { orgId, analysisInfo });
    
    if (!user) {
      console.error("saveAnalysisToPreferences: No user found");
      setError('Note: Analysis completed but failed to save to preferences (no user)');
      return;
    }
    
    if (!analysisInfo) {
      console.error("saveAnalysisToPreferences: No analysis info provided");
      setError('Note: Analysis completed but failed to save to preferences (no analysis data)');
      return;
    }
    
    try {
      // Map analysis data to preferences format
      const mappedPreferences = {
        contentPhilosophy: analysisInfo.strategy || '',
        contentTone: analysisInfo.tone || '',
        targetAudience: analysisInfo.description ? `${analysisInfo.industry || ''} audiences interested in ${analysisInfo.description}`.trim() : '',
      };
      
      console.log("saveAnalysisToPreferences: Mapped preferences:", mappedPreferences);
      
      // Call the preferences API to update the JSONB
      console.log("saveAnalysisToPreferences: Calling API with payload:", {
        organizationId: orgId,
        userId: user.id,
        preferences: mappedPreferences
      });
      
      const response = await fetch('/api/organizations/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: orgId,
          userId: user.id,
          preferences: mappedPreferences
        }),
      });
      
      console.log("saveAnalysisToPreferences: API response status:", response.status);
      
      // Get the response text first to debug any issues
      const responseText = await response.text();
      console.log("saveAnalysisToPreferences: Raw response text:", responseText);
      
      // Try to parse the response as JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log("saveAnalysisToPreferences: Parsed response data:", responseData);
      } catch (parseError) {
        console.error("saveAnalysisToPreferences: Error parsing response as JSON:", parseError);
        throw new Error("Invalid JSON response from server: " + responseText);
      }
      
      if (!response.ok) {
        const errorMessage = responseData?.error || `API returned ${response.status}: ${response.statusText}`;
        console.error("Error saving preferences:", {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });
        throw new Error(errorMessage);
      }
      
      console.log("Analysis saved to preferences successfully", responseData);
      setSuccessMessage(prev => `${prev} and saved to organization preferences`);
      setError(""); // Clear any previous error message
      
    } catch (error) {
      console.error('Error saving analysis to preferences:', error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      // Don't override the main success message, just add a note about the preferences issue
      setError('Note: Analysis completed but failed to save to preferences');
    }
  };

  // Add function to analyze organization posts
  const analyzeOrganization = async (orgId: string) => {
    if (!user) return;
    
    try {
      setIsAnalyzing(true);
      setSelectedOrgId(orgId); // Make sure we're setting the selected org ID
      setError("");
      setSuccessMessage(""); // Clear any previous success message
      console.log(`Starting analysis for organization ${orgId} (type: ${typeof orgId})`);
      
      // Verify the organization exists in our local state first
      const organization = myOrganizations.find(org => org.id === orgId);
      if (!organization) {
        console.error(`Organization with ID ${orgId} not found in local state`);
        setError(`Organization not found in your list. Please refresh the page.`);
        setIsAnalyzing(false);
        setSelectedOrgId(null);
        return;
      }
      
      console.log(`Analyzing organization: ${organization.name} (${organization.id})`);
      
      // Step 1: Fetch all posts for this organization
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, url, title, description, posted_date, format')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('posted_date', { ascending: false });
      
      if (postsError) {
        console.error("Error fetching organization posts:", postsError);
        throw new Error("Failed to fetch organization posts: " + postsError.message);
      }
      
      if (!posts || posts.length === 0) {
        setError("No posts found for this organization. Analysis requires at least one post.");
        setIsAnalyzing(false);
        setSelectedOrgId(null); // Reset selected org ID
        return;
      }
      
      console.log(`Found ${posts.length} posts for analysis`);
      
      // Step 2: Prepare data for OpenAI analysis
      const postData = posts.map(post => ({
        title: post.title || 'Untitled',
        description: post.description || '',
        date: post.posted_date,
        url: post.url,
        format: post.format
      }));
      
      // Step 3: Call API endpoint to perform analysis with OpenAI
      console.log("Calling analyze-organization API with organization:", {
        id: orgId,
        name: organization.name
      });
      
      const response = await fetch('/api/analyze-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: orgId,
          organizationName: organization.name, // Send the name as well
          posts: postData
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error("API error response:", result);
        throw new Error(result.error || result.details || `API returned ${response.status}: ${response.statusText}`);
      }
      
      console.log("Analysis result:", result);
      
      // Step 4: Update the organization's info in our local state
      setMyOrganizations(prev => prev.map(org => {
        if (org.id === orgId) {
          return {
            ...org,
            info: {
              ...result.analysis,
              lastAnalyzed: new Date().toISOString()
            }
          };
        }
        return org;
      }));
      
      // Show success message instead of using the error state
      setSuccessMessage(`Analysis completed successfully for ${organization.name}`);
      
      // Step 5: Save analysis results to preferences JSONB
      await saveAnalysisToPreferences(orgId, result.analysis);
      
    } catch (error) {
      console.error('Error analyzing organization:', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze organization');
    } finally {
      setIsAnalyzing(false);
      setSelectedOrgId(null); // Reset selected org ID
    }
  };
  
  // Function to view organization details
  const toggleOrgDetails = (orgId: string) => {
    if (orgDetailsOpen === orgId) {
      setOrgDetailsOpen(null);
    } else {
      setOrgDetailsOpen(orgId);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white">My Organizations</h1>
        <button 
          onClick={openModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add Organization
        </button>
      </div>
      
      {/* Display success message */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">My Organizations</h2>
        
        {isLoading ? (
          <div className="flex justify-center my-6">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : myOrganizations.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {myOrganizations.map((org) => (
              <div key={org.id} className="py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium dark:text-white">{org.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Role: {org.role}</p>
                    {org.info?.lastAnalyzed && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last analyzed: {new Date(org.info.lastAnalyzed).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => toggleOrgDetails(org.id)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {orgDetailsOpen === org.id ? 'Hide Details' : 'View Details'}
                    </button>
                    <button 
                      onClick={() => analyzeOrganization(org.id)}
                      disabled={isAnalyzing && selectedOrgId === org.id}
                      className={`px-3 py-1 rounded-md text-sm ${
                        isAnalyzing && selectedOrgId === org.id
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {isAnalyzing && selectedOrgId === org.id ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analyzing...
                        </span>
                      ) : (
                        'Analyze Posts'
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Organization details section */}
                {orgDetailsOpen === org.id && (
                  <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    {org.info ? (
                      <div className="space-y-3">
                        {org.info.industry && (
                          <div>
                            <h4 className="font-semibold dark:text-white">Industry</h4>
                            <p className="text-gray-700 dark:text-gray-300">{org.info.industry}</p>
                          </div>
                        )}
                        
                        {org.info.description && (
                          <div>
                            <h4 className="font-semibold dark:text-white">Description</h4>
                            <p className="text-gray-700 dark:text-gray-300">{org.info.description}</p>
                          </div>
                        )}
                        
                        {org.info.strategy && (
                          <div>
                            <h4 className="font-semibold dark:text-white">Strategy</h4>
                            <p className="text-gray-700 dark:text-gray-300">{org.info.strategy}</p>
                          </div>
                        )}
                        
                        {org.info.tone && (
                          <div>
                            <h4 className="font-semibold dark:text-white">Tone</h4>
                            <p className="text-gray-700 dark:text-gray-300">{org.info.tone}</p>
                          </div>
                        )}
                        
                        {/* Add button to save analysis to preferences */}
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => saveAnalysisToPreferences(org.id, org.info)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                          >
                            Save Analysis to Preferences
                          </button>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            This will update the organization's content preferences based on this analysis.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-600 dark:text-gray-400">No analysis data available yet.</p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Click "Analyze Posts" to generate insights about this organization.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-300">No organizations found.</p>
        )}
      </div>
      
      {pendingRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Pending Join Requests</h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pendingRequests.map((org) => (
              <div key={org.id} className="py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium dark:text-white">{org.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status: Pending</p>
                </div>
                <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  Cancel Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {joinRequestsToApprove.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Join Requests to Approve</h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {joinRequestsToApprove.map((request) => (
              <div key={request.id} className="py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium dark:text-white">{request.user_name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Organization: {request.organization_name}</p>
                </div>
                <div className="space-x-2">
                  <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm">
                    Approve
                  </button>
                  <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Add Organization</h2>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">Organization Name</label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                placeholder="Enter organization name"
              />
            </div>
            
            <div className="flex justify-between mb-4">
              <button
                onClick={searchOrganization}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Search
              </button>
              <button
                onClick={handleCreateOrganization}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Create New
              </button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2 dark:text-white">Existing Organizations</h3>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {searchResults.map((org) => (
                    <li key={org.id} className="py-3 flex justify-between items-center">
                      <span className="dark:text-white">{org.name}</span>
                      <button
                        onClick={() => handleRequestJoin(org.id)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Request to Join
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={closeModal}
                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 