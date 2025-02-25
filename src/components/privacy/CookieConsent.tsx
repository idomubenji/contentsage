"use client";

import { useEffect, useState, useMemo } from 'react';
import { Button } from '../../components/ui/button';
import { X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../lib/auth-context';

// Modified to support granular consent
type CookiePreferences = {
  necessary: boolean;  // Always true, can't be toggled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

// The stored value in localStorage/database can be 'all', 'necessary', or a JSON string
type CookieConsentStoredValue = 'all' | 'necessary' | string;

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  // Use a more detailed state for preferences
  const [consentPreferences, setConsentPreferences] = useState<CookiePreferences>({
    necessary: true, // Always required
    functional: false,
    analytics: false,
    marketing: false
  });
  const { user } = useAuth();
  
  // Memoize the Supabase client to prevent multiple instances
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
  }, []);

  // Helper function to parse stored consent into preferences object
  const parseStoredConsent = (storedValue: CookieConsentStoredValue): CookiePreferences => {
    // Default preferences (only necessary)
    const defaultPreferences: CookiePreferences = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    };
    
    // If stored value is 'all', enable all categories
    if (storedValue === 'all') {
      return {
        necessary: true,
        functional: true,
        analytics: true,
        marketing: true
      };
    }
    
    // If stored value is 'necessary', use default (only necessary)
    if (storedValue === 'necessary') {
      return defaultPreferences;
    }
    
    // Try to parse as JSON (for granular preferences)
    try {
      const parsedPreferences = JSON.parse(storedValue);
      // Validate that it has the right shape
      if (
        typeof parsedPreferences === 'object' &&
        parsedPreferences !== null &&
        'necessary' in parsedPreferences
      ) {
        // Always ensure necessary is true regardless of stored value
        return {
          ...parsedPreferences,
          necessary: true
        };
      }
    } catch (e) {
      // If parsing fails, use default
      console.error('Error parsing cookie preferences:', e);
    }
    
    return defaultPreferences;
  };

  // Helper function to serialize preferences for storage
  const serializePreferences = (prefs: CookiePreferences): string => {
    // If all non-necessary are enabled, use 'all' shorthand
    if (prefs.functional && prefs.analytics && prefs.marketing) {
      return 'all';
    }
    
    // If all non-necessary are disabled, use 'necessary' shorthand
    if (!prefs.functional && !prefs.analytics && !prefs.marketing) {
      return 'necessary';
    }
    
    // Otherwise, store the full JSON for granular control
    return JSON.stringify(prefs);
  };

  // Fetch consent only once on mount or when user changes
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !supabase) return;

    // Use a flag to track component mount state
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const fetchUserConsent = async () => {
      // First check localStorage
      const storedConsent = localStorage.getItem('cookieConsent');
      
      if (storedConsent) {
        // Parse the stored consent into preferences
        const preferences = parseStoredConsent(storedConsent);
        if (isMounted) {
          setConsentPreferences(preferences);
          setIsVisible(false);
        }
        return;
      }
      
      // If no localStorage consent and user is logged in, try fetching from database
      if (user && supabase) {
        try {
          const { data, error } = await supabase
            .from('user_consents')
            .select('*')
            .eq('user_id', user.id)
            .eq('consent_type', 'cookies')
            .order('consented_at', { ascending: false })
            .limit(1);
            
          if (!isMounted) return;
            
          if (data && data.length > 0) {
            // User has consent stored in database
            const dbConsent = data[0].consent_value as string;
            // Parse the stored consent into preferences
            const preferences = parseStoredConsent(dbConsent);
            setConsentPreferences(preferences);
            // Update localStorage for future visits
            localStorage.setItem('cookieConsent', dbConsent);
            setIsVisible(false);
            return;
          }
          
          // No valid consent found in database, show banner after a delay
          if (isMounted) {
            timeoutId = setTimeout(() => {
              if (isMounted) setIsVisible(true);
            }, 1000);
          }
        } catch (error) {
          console.error('Error fetching cookie consent:', error);
          // Show banner in case of error
          if (isMounted) {
            timeoutId = setTimeout(() => {
              if (isMounted) setIsVisible(true);
            }, 1000);
          }
        }
      } else {
        // No user logged in and no valid localStorage consent, show the banner
        if (isMounted) {
          timeoutId = setTimeout(() => {
            if (isMounted) setIsVisible(true);
          }, 1000);
        }
      }
    };
    
    fetchUserConsent();
    
    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, supabase]);

  const handleConsentChoice = async (choice: 'all' | 'necessary') => {
    // Convert the simple choice to preferences
    const newPreferences: CookiePreferences = {
      necessary: true,
      functional: choice === 'all',
      analytics: choice === 'all',
      marketing: choice === 'all'
    };
    
    setConsentPreferences(newPreferences);
    setIsVisible(false);
    
    // Serialize and store user's choice in localStorage
    const serialized = serializePreferences(newPreferences);
    localStorage.setItem('cookieConsent', serialized);

    try {
      // If user is logged in, also store their preference in the database
      if (user && supabase) {
        // Log this consent for compliance tracking
        await supabase
          .from('user_consents')
          .insert({
            user_id: user.id,
            consent_type: 'cookies',
            consent_value: serialized,
            consent_version: '1.0',
            consented_at: new Date().toISOString()
          });
      }

      // After database operations complete, handle cookie management
      if (choice === 'necessary') {
        // Remove non-essential cookies
        removeNonEssentialCookies();
      }
    } catch (error) {
      console.error('Error saving cookie consent to database:', error);
      // Still implement cookie preferences even if database save fails
      if (choice === 'necessary') {
        removeNonEssentialCookies();
      }
    }
  };

  const removeNonEssentialCookies = () => {
    // List of cookies that are considered non-essential
    // This is just a placeholder - you'll need to adapt this to your actual cookies
    const nonEssentialCookies = ['_ga', '_gid', '_fbp', 'ads', 'analytics'];
    
    // Get all cookies
    const cookies = document.cookie.split(';');
    
    // Remove non-essential cookies
    for (let cookie of cookies) {
      const cookieName = cookie.split('=')[0].trim();
      if (nonEssentialCookies.includes(cookieName)) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg p-4 z-50">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium dark:text-white">Cookie Preferences</h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleConsentChoice('necessary')}
            className="text-xs"
          >
            Necessary Only
          </Button>
          <Button
            size="sm"
            onClick={() => handleConsentChoice('all')}
            className="text-xs"
          >
            Accept All
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVisible(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
} 