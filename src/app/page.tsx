'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// Add Organization type
type Organization = {
  id: string;
  name: string;
  role: string;
};

export default function Home() {
  // Using useState and useEffect to handle hydration
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Add state for CSV file upload
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvPrepared, setCsvPrepared] = useState(false);
  
  // Add state for organizations and selected organization
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false);
  
  // Add state for duplicate URLs tracking and confirmation dialog
  const [urlsToProcess, setUrlsToProcess] = useState<string[]>([]);
  const [duplicateUrls, setDuplicateUrls] = useState<string[]>([]);
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState<number>(-1);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [urlErrors, setUrlErrors] = useState<Record<string, string>>({});
  const [processedResults, setProcessedResults] = useState<Record<string, {success: boolean; message: string; title?: string}>>({});
  const [replaceUrlMap, setReplaceUrlMap] = useState<Record<string, boolean>>({});
  const [showBrokenLinkError, setShowBrokenLinkError] = useState<{url: string; error: string} | null>(null);
  
  // Ref to store file reader between renders
  const fileReaderRef = useRef<FileReader | null>(null);
  
  // Get user information for saving posts
  const { user } = useAuth();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Add effect to fetch user's organizations
  useEffect(() => {
    if (!user) return;
    
    const fetchOrganizations = async () => {
      setIsLoadingOrganizations(true);
      
      try {
        console.log("Home: Fetching user organizations with user ID:", user.id);
        
        // Get the user's organization IDs and roles
        const { data: userOrgs, error: userOrgsError } = await supabase
          .from('user_organizations')
          .select('organization_id, role')
          .eq('user_id', user.id);

        if (userOrgsError) {
          console.error('Home: Error fetching user organization links', userOrgsError);
          return;
        }

        // Handle case where userOrgs is null or empty (new user with no organizations)
        if (!userOrgs || userOrgs.length === 0) {
          console.log('Home: User has no organizations');
          setOrganizations([]);
          return;
        }
        
        // Now fetch the organization details
        const orgIds = userOrgs.map(org => org.organization_id);
        
        const { data: orgsData, error: orgsDataError } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
          
        if (orgsDataError) {
          console.error('Home: Error fetching organization details', orgsDataError);
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
        
        console.log('Home: Transformed organization data:', transformedOrgs);
        setOrganizations(transformedOrgs);
        
        // Set the first organization as default selected if available
        if (transformedOrgs.length > 0) {
          setSelectedOrganizationId(transformedOrgs[0].id);
        }
      } catch (error) {
        console.error('Home: Error fetching organizations:', error);
      } finally {
        setIsLoadingOrganizations(false);
      }
    };

    fetchOrganizations();
  }, [user]);

  // Handle single URL submission or CSV batch processing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous messages
    setMessage(null);
    
    // Check if user is logged in
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to analyze URLs' });
      return;
    }
    
    // Check if we're processing a prepared CSV or a single URL
    if (csvPrepared && urlsToProcess.length > 0) {
      // Process the prepared CSV file
      processBatchUrls(urlsToProcess, replaceUrlMap as Record<string, boolean>);
      // Reset CSV states after processing
      setCsvFileName(null);
      setCsvPrepared(false);
    } else {
      // Process a single URL
      // Validate URL format
      if (!url.trim()) {
        setMessage({ type: 'error', text: 'Please enter a URL' });
        return;
      }
      
      try {
        // Simple URL validation
        new URL(url); // Will throw if invalid
      } catch (error) {
        setMessage({ type: 'error', text: 'Please enter a valid URL' });
        return;
      }
      
      setIsLoading(true);
      
      try {
        const result = await processUrl(url);
        
        if (result.success) {
          setMessage({
            type: 'success',
            text: result.message,
          });
        } else {
          setMessage({
            type: 'error',
            text: result.message,
          });
        }
        
        // Clear input after submission
        setUrl('');
      } catch (error: any) {
        setMessage({
          type: 'error',
          text: error.message || 'An error occurred while analyzing the URL',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // Process a single URL with the API
  const processUrl = async (url: string, replace: boolean = false): Promise<{success: boolean; message: string; title?: string}> => {
    try {
      // Call the API to analyze the URL
      const response = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          userId: user?.id,
          organizationId: selectedOrganizationId === '' ? null : selectedOrganizationId,
          replace,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          message: data.error || 'Failed to analyze URL',
        };
      }
      
      return {
        success: true,
        message: `Successfully analyzed and saved "${data.post.title}"`,
        title: data.post.title,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'An error occurred while analyzing the URL',
      };
    }
  };
  
  // Process all URLs in the batch
  const processBatchUrls = async (urlsToProcess: string[], replaceMap: Record<string, boolean> = {}) => {
    setIsProcessingCSV(true);
    setProcessingProgress(0);
    
    const results: Record<string, {success: boolean; message: string; title?: string}> = {};
    let currentProgress = 0;
    
    // Process URLs one by one
    for (const url of urlsToProcess) {
      // Check if this URL should replace an existing one
      const shouldReplace = replaceMap[url] || false;
      
      // Process the URL
      const result = await processUrl(url, shouldReplace);
      results[url] = result;
      
      // Update progress
      currentProgress++;
      setProcessingProgress(Math.floor((currentProgress / urlsToProcess.length) * 100));
      
      // If there was an error and it's a broken link, show the dialog
      if (!result.success && result.message.includes('Failed to analyze URL')) {
        setShowBrokenLinkError({url, error: result.message});
        
        // Wait for user to dismiss the error before continuing
        await new Promise<void>((resolve) => {
          const handleDismiss = () => {
            setShowBrokenLinkError(null);
            resolve();
          };
          
          // Store the handler in a ref to access it later
          window.dismissBrokenLinkError = handleDismiss;
        });
      }
    }
    
    // Update results state
    setProcessedResults(results);
    
    // Determine overall status to display appropriate message
    const totalSuccess = Object.values(results).filter(r => r.success).length;
    
    setMessage({
      type: totalSuccess > 0 ? 'success' : 'error',
      text: totalSuccess === urlsToProcess.length
        ? `Successfully processed all ${totalSuccess} URLs`
        : `Processed ${totalSuccess} of ${urlsToProcess.length} URLs successfully`
    });
    
    setIsProcessingCSV(false);
    setProcessingProgress(0);
  };
  
  // Handle CSV file upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear previous messages and states
    setMessage(null);
    setCsvError(null);
    setUrlsToProcess([]);
    setDuplicateUrls([]);
    setCurrentDuplicateIndex(-1);
    setShowDuplicateDialog(false);
    setProcessingProgress(0);
    setUrlErrors({});
    setCsvPrepared(false);
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if file is CSV
    if (!file.name.endsWith('.csv')) {
      setCsvError('CSV files only, please');
      // Reset file input
      e.target.value = '';
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      setCsvError('You must be logged in to analyze URLs');
      e.target.value = '';
      return;
    }
    
    // Store the file name
    setCsvFileName(file.name);
    
    // Set loading state
    setIsProcessingCSV(true);
    
    // Create a FileReader to read the CSV file
    const reader = new FileReader();
    fileReaderRef.current = reader;
    
    reader.onload = async (event) => {
      try {
        const csvContent = event.target?.result as string;
        if (!csvContent) {
          throw new Error('Could not read file');
        }
        
        // Parse CSV content to extract URLs
        // We support both comma-separated and newline-separated formats
        let extractedUrls: string[] = [];
        
        // First try splitting by newlines
        const linesSplit = csvContent.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        
        if (linesSplit.length > 0) {
          // If we have lines, check if any contain commas
          const hasCommas = linesSplit.some(line => line.includes(','));
          
          if (hasCommas) {
            // Parse as comma-separated values
            extractedUrls = csvContent
              .split(/\r?\n/)
              .flatMap(line => line.split(','))
              .map(url => url.trim())
              .filter(Boolean);
          } else {
            // Use the line-split result
            extractedUrls = linesSplit;
          }
        }
        
        // Validate URLs and remove duplicates within the file
        const validatedUrls: string[] = [];
        const invalidUrls: Record<string, string> = {};
        const seenUrls = new Set<string>();
        
        for (const rawUrl of extractedUrls) {
          try {
            // Try to create a URL object to validate
            new URL(rawUrl);
            
            // Check for duplicates within the file
            if (!seenUrls.has(rawUrl)) {
              seenUrls.add(rawUrl);
              validatedUrls.push(rawUrl);
            }
          } catch (error) {
            invalidUrls[rawUrl] = 'Invalid URL format';
          }
        }
        
        // Limit to 100 URLs
        const limitedUrls = validatedUrls.slice(0, 100);
        
        // Set a message if we had to limit the URLs
        if (validatedUrls.length > 100) {
          setMessage({
            type: 'success',
            text: 'First 100 URLs processed :)'
          });
        }
        
        // Set the URLs to process
        setUrlsToProcess(limitedUrls);
        
        // Set any validation errors
        setUrlErrors(invalidUrls);
        
        // Check for duplicates against existing URLs in the system
        // This would normally involve checking against the database
        // For now, we'll simulate this with a sample list
        const sampleExistingUrls = [
          'https://example.com/article1',
          'https://example.com/article2'
        ];
        
        // In a real implementation, you'd query the database here
        const foundDuplicates = limitedUrls.filter(url => 
          sampleExistingUrls.includes(url)
        );
        
        if (foundDuplicates.length > 0) {
          // We found duplicates, set them up for confirmation
          setDuplicateUrls(foundDuplicates);
          setCurrentDuplicateIndex(0);
          setShowDuplicateDialog(true);
        } else {
          // No duplicates, mark as ready to process but don't process yet
          setCsvPrepared(true);
        }
        
      } catch (error) {
        console.error('Error parsing CSV:', error);
        setCsvError('Failed to parse CSV file. Please check the format.');
        setCsvFileName(null);
      } finally {
        setIsProcessingCSV(false);
        // Reset file input
        e.target.value = '';
      }
    };
    
    reader.onerror = () => {
      setCsvError('Error reading file');
      setIsProcessingCSV(false);
      setCsvFileName(null);
      e.target.value = '';
    };
    
    // Start reading the file
    reader.readAsText(file);
  };
  
  // Handle duplicate URL confirmation
  const handleDuplicateConfirmation = (replace: boolean) => {
    if (currentDuplicateIndex >= 0 && currentDuplicateIndex < duplicateUrls.length) {
      const currentUrl = duplicateUrls[currentDuplicateIndex];
      
      // Update the replace map
      setReplaceUrlMap(prev => ({
        ...prev,
        [currentUrl]: replace
      }));
      
      // Move to the next duplicate URL or finish if we're done
      if (currentDuplicateIndex < duplicateUrls.length - 1) {
        setCurrentDuplicateIndex(currentDuplicateIndex + 1);
      } else {
        // No more duplicates to check
        setShowDuplicateDialog(false);
        setCurrentDuplicateIndex(-1);
        
        // Mark as ready to process but don't process yet
        setCsvPrepared(true);
      }
    }
  };

  // Handle dismissing broken link error
  const handleDismissBrokenLink = () => {
    if (window.dismissBrokenLinkError) {
      window.dismissBrokenLinkError();
      window.dismissBrokenLinkError = undefined;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
        {mounted && (
          <div className="glowing-sphere-container mb-10">
            <div className="glowing-sphere"></div>
          </div>
        )}
        <h1 className="text-4xl font-bold dark:text-white">
          Welcome to ContentSage
        </h1>
        
        <p className="mt-6 text-xl dark:text-gray-300 mb-8">
          Your intelligent content management solution
        </p>

        {/* URL Input Form */}
        <div className="w-full max-w-2xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Analyze Content</h2>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Paste a URL to analyze and save the content to your library
          </p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {/* URL input and CSV upload in the same row */}
              <div className="flex gap-2 items-center">
                {/* Show CSV file info or URL input */}
                {csvFileName ? (
                  <div className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-between">
                    <div className="truncate">
                      <span className="text-blue-600 dark:text-blue-400 font-medium mr-2">CSV:</span>
                      {csvFileName}
                      {csvPrepared && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          ({urlsToProcess.length} URLs ready)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCsvFileName(null);
                        setCsvPrepared(false);
                        setUrlsToProcess([]);
                      }}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="https://example.com/blog-post"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={isLoading || isProcessingCSV}
                  />
                )}
                
                {/* CSV Upload Button */}
                <label
                  className={`px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 
                    ${(isLoading || isProcessingCSV) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span>Upload CSV</span>
                  <input 
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCsvUpload}
                    disabled={isLoading || isProcessingCSV}
                  />
                </label>
              </div>
              
              {/* Display CSV error if any */}
              {csvError && (
                <div className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {csvError}
                </div>
              )}
              
              {/* Display CSV progress if processing */}
              {isProcessingCSV && (
                <div className="mt-2 p-3 bg-blue-100 dark:bg-blue-900 rounded-md">
                  <div className="mb-2 text-blue-800 dark:text-blue-200">
                    Processing URLs: {processingProgress}%
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${processingProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Display URL validation errors if any */}
              {Object.keys(urlErrors).length > 0 && (
                <div className="mt-2 p-3 bg-red-100 dark:bg-red-900 rounded-md">
                  <div className="font-medium text-red-800 dark:text-red-200 mb-2">
                    Some URLs could not be processed:
                  </div>
                  <ul className="text-sm text-red-700 dark:text-red-300 list-disc pl-5 space-y-1">
                    {Object.entries(urlErrors).slice(0, 5).map(([url, error]) => (
                      <li key={url}>{url}: {error}</li>
                    ))}
                    {Object.keys(urlErrors).length > 5 && (
                      <li>And {Object.keys(urlErrors).length - 5} more...</li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Duplicate URL confirmation dialog */}
              {showDuplicateDialog && currentDuplicateIndex >= 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Duplicate URL Detected
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Hey, I notice we already have:
                      <br />
                      <span className="font-mono text-sm break-all bg-gray-100 dark:bg-gray-700 p-1 rounded mt-2 block">
                        {duplicateUrls[currentDuplicateIndex]}
                      </span>
                      <br />
                      Do you want to replace the current article?
                    </p>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => handleDuplicateConfirmation(false)}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-gray-800 dark:text-gray-200"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => handleDuplicateConfirmation(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
                      >
                        Replace
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Broken Link Error Dialog */}
              {showBrokenLinkError && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Broken Link
                      </h3>
                      <button
                        onClick={handleDismissBrokenLink}
                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                      >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      Unable to process URL:
                      <br />
                      <span className="font-mono text-sm break-all bg-gray-100 dark:bg-gray-700 p-1 rounded mt-2 block">
                        {showBrokenLinkError.url}
                      </span>
                      <br />
                      Error: {showBrokenLinkError.error}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Add Organization Dropdown */}
              {user && (
                <div className="w-full">
                  <select
                    value={selectedOrganizationId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedOrganizationId(value === '' ? null : value);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={isLoading || isLoadingOrganizations}
                  >
                    {isLoadingOrganizations ? (
                      <option value="">Loading organizations...</option>
                    ) : organizations.length === 0 ? (
                      <option value="">No organizations available</option>
                    ) : (
                      <>
                        <option value="">-- Select an organization (optional) --</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}
              
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isLoading || isProcessingCSV || !!(csvFileName && !csvPrepared)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading || isProcessingCSV ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      {isProcessingCSV ? 'Processing...' : 'Analyzing...'}
                    </div>
                  ) : (
                    'Analyze'
                  )}
                </button>
              </div>
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
            
            {!user && (
              <div className="mt-2 text-amber-600 dark:text-amber-400 text-sm">
                You need to sign in to analyze and save content
              </div>
            )}
          </form>
        </div>

        <style jsx>{`
          .glowing-sphere-container {
            perspective: 1200px;
            height: 160px;
            width: 160px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          
          .glowing-sphere {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, 
              rgba(255, 255, 255, 0.9) 0%, 
              rgba(225, 240, 255, 0.8) 20%, 
              rgba(96, 165, 250, 0.7) 50%, 
              rgba(59, 130, 246, 0.8) 100%);
            box-shadow: 0 0 10px 3px rgba(96, 165, 250, 0.4),
                       0 0 20px 5px rgba(96, 165, 250, 0.2);
            animation: glow 3s ease-in-out infinite alternate;
            position: relative;
            transform-style: preserve-3d;
            transform: rotateY(15deg) rotateX(10deg);
          }
          
          /* Enhance highlight reflection */
          .glowing-sphere::before {
            content: '';
            position: absolute;
            top: 15%;
            left: 15%;
            width: 35%;
            height: 35%;
            border-radius: 50%;
            background: radial-gradient(ellipse, 
              rgba(255, 255, 255, 1) 0%, 
              rgba(255, 255, 255, 0.7) 30%, 
              transparent 70%);
            z-index: 2;
            filter: blur(1px);
          }
          
          /* Enhanced shadow beneath the sphere */
          .glowing-sphere::after {
            content: '';
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            width: 110%;
            height: 25px;
            background: radial-gradient(ellipse, 
              rgba(0, 0, 0, 0.4) 0%, 
              rgba(0, 0, 0, 0.2) 50%,
              transparent 80%);
            border-radius: 50%;
            z-index: -1;
            filter: blur(6px);
          }
          
          @keyframes glow {
            from { 
              box-shadow: 0 0 10px 3px rgba(96, 165, 250, 0.4),
                         0 0 20px 5px rgba(96, 165, 250, 0.2); 
            }
            to { 
              box-shadow: 0 0 15px 5px rgba(96, 165, 250, 0.5),
                         0 0 30px 8px rgba(96, 165, 250, 0.3); 
            }
          }
        `}</style>
      </main>
    </div>
  );
}

// Add global declaration for dismissBrokenLinkError
declare global {
  interface Window {
    dismissBrokenLinkError?: () => void;
  }
}
