"use client";

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../lib/auth-context';

type CookieConsentOption = 'all' | 'necessary' | null;

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [consentOption, setConsentOption] = useState<CookieConsentOption>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    const fetchUserConsent = async () => {
      // First check localStorage
      const storedConsent = localStorage.getItem('cookieConsent');
      
      if (storedConsent) {
        setConsentOption(storedConsent as CookieConsentOption);
        setIsVisible(false);
        return;
      }
      
      // If no localStorage consent and user is logged in, try fetching from database
      if (user) {
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          );
          
          const { data, error } = await supabase
            .from('user_consents')
            .select('*')
            .eq('user_id', user.id)
            .eq('consent_type', 'cookies')
            .order('consented_at', { ascending: false })
            .limit(1);
            
          if (data && data.length > 0) {
            // User has consent stored in database
            const dbConsent = data[0].consent_value as CookieConsentOption;
            setConsentOption(dbConsent);
            // Update localStorage for future visits
            localStorage.setItem('cookieConsent', dbConsent as string);
            setIsVisible(false);
          } else {
            // No consent found in database, show banner after a delay
            setTimeout(() => {
              setIsVisible(true);
            }, 1000);
          }
        } catch (error) {
          console.error('Error fetching cookie consent:', error);
          // Show banner in case of error
          setTimeout(() => {
            setIsVisible(true);
          }, 1000);
        }
      }
    };
    
    fetchUserConsent();
  }, [user]);

  const handleConsentChoice = async (choice: CookieConsentOption) => {
    if (!choice) return;
    
    setConsentOption(choice);
    setIsVisible(false);
    
    // Store user's choice in localStorage
    localStorage.setItem('cookieConsent', choice);

    // If user is logged in, also store their preference in the database
    if (user) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );

        // Log this consent for compliance tracking
        await supabase
          .from('user_consents')
          .insert({
            user_id: user.id,
            consent_type: 'cookies',
            consent_value: choice,
            consent_version: '1.0',
            consented_at: new Date().toISOString()
          });
      } catch (error) {
        console.error('Error saving cookie consent to database:', error);
      }
    }

    // Implement cookie management based on choice
    if (choice === 'necessary') {
      // Remove non-essential cookies
      removeNonEssentialCookies();
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