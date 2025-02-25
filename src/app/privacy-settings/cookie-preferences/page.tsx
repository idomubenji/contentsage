"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Shield, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { useAuth } from '../../../lib/auth-context';
import { createClient } from '@supabase/supabase-js';

type CookieCategory = {
  id: string;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
  cookies: { name: string; purpose: string; duration: string }[];
};

// The stored value in localStorage/database can be 'all', 'necessary', or a JSON string
type CookieConsentStoredValue = 'all' | 'necessary' | string;

export default function CookiePreferencesPage() {
  const { user, isLoading } = useAuth();
  const [cookieCategories, setCookieCategories] = useState<CookieCategory[]>([
    {
      id: 'necessary',
      name: 'Strictly Necessary',
      description: 'These cookies are essential for the website to function and cannot be switched off in our systems.',
      required: true,
      enabled: true,
      cookies: [
        { name: 'sessionid', purpose: 'Used to maintain your authenticated session', duration: 'Session' },
        { name: 'supabase-auth-token', purpose: 'Authentication and session management', duration: '1 hour' },
        { name: 'cookieConsent', purpose: 'Stores your cookie consent preferences', duration: '1 year' },
      ]
    },
    {
      id: 'functional',
      name: 'Functional',
      description: 'These cookies enable the website to provide enhanced functionality and personalization.',
      required: false,
      enabled: false,
      cookies: [
        { name: 'ui_theme', purpose: 'Remembers your theme preferences', duration: '1 year' },
        { name: 'ui_settings', purpose: 'Stores your interface preferences', duration: '1 year' },
      ]
    },
    {
      id: 'analytics',
      name: 'Analytics',
      description: 'These cookies help us to understand how visitors interact with the website.',
      required: false,
      enabled: false,
      cookies: [
        { name: '_ga', purpose: 'Used by Google Analytics to distinguish users', duration: '2 years' },
        { name: '_gid', purpose: 'Used by Google Analytics to distinguish users', duration: '24 hours' },
      ]
    },
    {
      id: 'marketing',
      name: 'Marketing',
      description: 'These cookies help us to provide you with relevant advertisements and marketing campaigns.',
      required: false,
      enabled: false,
      cookies: [
        { name: '_fbp', purpose: 'Used by Facebook to deliver advertisements', duration: '3 months' },
        { name: 'ads_prefs', purpose: 'Stores your advertisement preferences', duration: '1 year' },
      ]
    }
  ]);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  
  // Memoize the Supabase client to prevent multiple instances
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
  }, []);

  // Helper function to parse stored consent value into cookie category states
  const parseStoredConsent = (storedValue: CookieConsentStoredValue): void => {
    // If stored value is 'all', enable all categories
    if (storedValue === 'all') {
      setCookieCategories(prev => 
        prev.map(category => ({
          ...category,
          enabled: true
        }))
      );
      return;
    }
    
    // If stored value is 'necessary', enable only required categories
    if (storedValue === 'necessary') {
      setCookieCategories(prev => 
        prev.map(category => ({
          ...category,
          enabled: category.required
        }))
      );
      return;
    }
    
    // Try to parse as JSON for granular consent
    try {
      const parsedPreferences = JSON.parse(storedValue);
      
      // Check if it has the expected shape
      if (
        typeof parsedPreferences === 'object' &&
        parsedPreferences !== null &&
        'necessary' in parsedPreferences
      ) {
        // Update each category based on the parsed preferences
        setCookieCategories(prev => 
          prev.map(category => ({
            ...category,
            enabled: category.required || !!parsedPreferences[category.id]
          }))
        );
        return;
      }
    } catch (e) {
      console.error('Error parsing cookie preferences:', e);
    }
    
    // Default fallback: only enable required categories
    setCookieCategories(prev => 
      prev.map(category => ({
        ...category,
        enabled: category.required
      }))
    );
  };

  // Helper function to serialize cookie categories for storage
  const serializePreferences = (): string => {
    // Check if all non-required categories are enabled
    const allNonRequiredEnabled = cookieCategories
      .filter(category => !category.required)
      .every(category => category.enabled);
      
    if (allNonRequiredEnabled) {
      return 'all';
    }
    
    // Check if all non-required categories are disabled
    const allNonRequiredDisabled = cookieCategories
      .filter(category => !category.required)
      .every(category => !category.enabled);
      
    if (allNonRequiredDisabled) {
      return 'necessary';
    }
    
    // Otherwise, create a preferences object for granular control
    const preferencesObj = cookieCategories.reduce((acc, category) => {
      acc[category.id] = category.enabled;
      return acc;
    }, {} as Record<string, boolean>);
    
    return JSON.stringify(preferencesObj);
  };

  // Fetch user preferences from database when component mounts
  useEffect(() => {
    // Skip if no user, no supabase, or not in browser
    if (!user || !supabase || typeof window === 'undefined') {
      setIsLoadingPreferences(false);
      return;
    }
    
    let isMounted = true;
    
    const fetchUserPreferences = async () => {
      if (!isMounted) return;
      
      setIsLoadingPreferences(true);
      
      try {
        // First check localStorage as a fallback
        const storedConsent = localStorage.getItem('cookieConsent');
        console.log('Stored consent from localStorage:', storedConsent);
        
        // Then try to get from database if user is logged in
        const { data, error } = await supabase
          .from('user_consents')
          .select('*')
          .eq('user_id', user.id)
          .eq('consent_type', 'cookies')
          .order('consented_at', { ascending: false })
          .limit(1);
          
        if (!isMounted) return;
        
        console.log('Database consent record:', data?.[0]);
        
        // If we have data from the database, use that (most recent consent)
        if (data && data.length > 0) {
          const dbConsentValue = data[0].consent_value;
          console.log('Using consent value from database:', dbConsentValue);
          // Parse the consent value into cookie category states
          parseStoredConsent(dbConsentValue);
          // Also update localStorage to keep them in sync
          localStorage.setItem('cookieConsent', dbConsentValue);
        } 
        // Otherwise fallback to localStorage if available
        else if (storedConsent) {
          console.log('Using consent value from localStorage:', storedConsent);
          // Parse the consent value into cookie category states
          parseStoredConsent(storedConsent);
        } else {
          console.log('No saved preferences found, using default values');
        }
      } catch (error) {
        console.error('Error fetching cookie preferences:', error);
        // Try localStorage as fallback
        const storedConsent = localStorage.getItem('cookieConsent');
        if (storedConsent && isMounted) {
          console.log('Error occurred, using localStorage fallback:', storedConsent);
          // Parse the consent value into cookie category states
          parseStoredConsent(storedConsent);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPreferences(false);
        }
      }
    };
    
    fetchUserPreferences();
    
    return () => {
      isMounted = false;
    };
  }, [user, supabase]); // Only depend on user and memoized supabase client

  // Apply consent preferences to the cookie categories
  const applyConsentPreferences = parseStoredConsent;

  if (isLoading || isLoadingPreferences) {
    return (
      <div className="p-8">
        <div className="text-center">Loading cookie preferences...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
          <div className="flex">
            <div className="flex-shrink-0">
              <Shield className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                You need to be signed in to update your cookie preferences.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const toggleCategory = (categoryId: string) => {
    setCookieCategories(prev => 
      prev.map(category => {
        if (category.id === categoryId && !category.required) {
          return {
            ...category,
            enabled: !category.enabled
          };
        }
        return category;
      })
    );
  };

  const savePreferences = async () => {
    // Serialize the current cookie category states for storage
    const consentValue = serializePreferences();
    
    console.log('Saving preferences with consent value:', consentValue);
    
    // Save to localStorage
    localStorage.setItem('cookieConsent', consentValue);

    // If necessary-only, remove non-essential cookies
    const isNecessaryOnly = cookieCategories
      .filter(category => !category.required)
      .every(category => !category.enabled);
      
    if (isNecessaryOnly) {
      // Get names of all cookies from non-necessary categories that are disabled
      const cookiesToRemove = cookieCategories
        .filter(category => !category.required && !category.enabled)
        .flatMap(category => category.cookies.map(cookie => cookie.name));
      
      // Remove those cookies
      for (const cookieName of cookiesToRemove) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    }

    // Use the memoized supabase client
    try {
      if (user && supabase) {
        await supabase
          .from('user_consents')
          .insert({
            user_id: user.id,
            consent_type: 'cookies',
            consent_value: consentValue,
            consent_version: '1.0',
            consented_at: new Date().toISOString()
          });
      }

      setSaveStatus({
        success: true,
        message: 'Your cookie preferences have been saved successfully.'
      });

      // Clear the status message after 3 seconds
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving cookie preferences:', error);
      setSaveStatus({
        success: false,
        message: 'There was an error saving your preferences. Please try again.'
      });
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      {/* Compact notification - modified to be more compact */}
      {saveStatus && (
        <div className="fixed bottom-4 right-4 z-50 flex justify-end">
          <Alert className={`max-w-md ${saveStatus.success ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'} shadow-lg py-3 px-4 rounded-md`}>
            <p className="text-sm font-medium">
              {saveStatus.success ? 'Success!' : 'Error'} {saveStatus.message}
            </p>
          </Alert>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">Cookie Preferences</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage how we use cookies on this website. Some cookies are essential for the site to function properly.
        </p>
      </div>

      <div className="space-y-6">
        {cookieCategories.map((category) => (
          <Card key={category.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 dark:bg-gray-800">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">{category.name} Cookies</CardTitle>
                <Switch 
                  checked={category.enabled} 
                  onCheckedChange={() => toggleCategory(category.id)} 
                  disabled={category.required}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
              <CardDescription className="text-sm mt-1">
                {category.description}
                {category.required && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 block mt-1">
                    These cookies cannot be disabled as they are required for the website to function.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm mb-2">Cookies in this category:</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Name</th>
                      <th className="text-left py-2 font-medium">Purpose</th>
                      <th className="text-left py-2 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.cookies.map((cookie, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 pr-4">{cookie.name}</td>
                        <td className="py-2 pr-4">{cookie.purpose}</td>
                        <td className="py-2">{cookie.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end mt-6">
          <Button onClick={savePreferences} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
} 