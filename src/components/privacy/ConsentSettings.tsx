"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface ConsentSettings {
  marketing_emails: boolean;
  data_analytics: boolean;
  third_party_sharing: boolean;
  consent_version: string;
}

const CURRENT_PRIVACY_POLICY_VERSION = "1.0"; // Update this when privacy policy changes

export default function ConsentSettings() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [consent, setConsent] = useState<ConsentSettings>({
    marketing_emails: false,
    data_analytics: false,
    third_party_sharing: false,
    consent_version: CURRENT_PRIVACY_POLICY_VERSION
  });

  // Fetch user's current consent settings
  useEffect(() => {
    async function fetchUserConsent() {
      if (!user) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('user_consent')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          setError(`Failed to fetch consent settings: ${error.message}`);
          return;
        }
        
        if (data) {
          setConsent({
            marketing_emails: data.marketing_emails,
            data_analytics: data.data_analytics,
            third_party_sharing: data.third_party_sharing,
            consent_version: data.consent_version
          });
        }
      } catch (err: any) {
        setError(`An unexpected error occurred: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserConsent();
  }, [user, supabase]);
  
  const handleConsentChange = (field: keyof ConsentSettings) => {
    setConsent(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };
  
  const saveConsentSettings = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      // Check if user already has consent record
      const { data: existingConsent } = await supabase
        .from('user_consent')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      let result;
      
      if (existingConsent) {
        // Update existing consent
        result = await supabase
          .from('user_consent')
          .update({
            marketing_emails: consent.marketing_emails,
            data_analytics: consent.data_analytics,
            third_party_sharing: consent.third_party_sharing,
            consent_version: CURRENT_PRIVACY_POLICY_VERSION,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } else {
        // Insert new consent record
        result = await supabase
          .from('user_consent')
          .insert({
            user_id: user.id,
            marketing_emails: consent.marketing_emails,
            data_analytics: consent.data_analytics,
            third_party_sharing: consent.third_party_sharing,
            consent_version: CURRENT_PRIVACY_POLICY_VERSION
          });
      }
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      setSuccess(true);
      
    } catch (err: any) {
      setError(err.message || "Failed to save consent settings");
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return <div className="p-4">Loading your privacy settings...</div>;
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Privacy & Consent Settings</h2>
      
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="marketing-consent" className="font-medium dark:text-white">
              Marketing Communications
            </label>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Receive updates about new features, promotions, and news
            </p>
          </div>
          <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
            <input
              type="checkbox"
              id="marketing-consent"
              className="opacity-0 w-0 h-0"
              checked={consent.marketing_emails}
              onChange={() => handleConsentChange('marketing_emails')}
            />
            <label
              htmlFor="marketing-consent"
              className={`absolute top-0 left-0 right-0 bottom-0 rounded-full cursor-pointer transition-colors duration-200 ${
                consent.marketing_emails 
                ? 'bg-blue-600' 
                : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span 
                className={`absolute left-1 bottom-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform ${
                  consent.marketing_emails ? 'translate-x-6' : 'translate-x-0'
                }`} 
              />
            </label>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="analytics-consent" className="font-medium dark:text-white">
              Data Analytics
            </label>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Allow us to analyze how you use our services to improve user experience
            </p>
          </div>
          <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
            <input
              type="checkbox"
              id="analytics-consent"
              className="opacity-0 w-0 h-0"
              checked={consent.data_analytics}
              onChange={() => handleConsentChange('data_analytics')}
            />
            <label
              htmlFor="analytics-consent"
              className={`absolute top-0 left-0 right-0 bottom-0 rounded-full cursor-pointer transition-colors duration-200 ${
                consent.data_analytics 
                ? 'bg-blue-600' 
                : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span 
                className={`absolute left-1 bottom-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform ${
                  consent.data_analytics ? 'translate-x-6' : 'translate-x-0'
                }`} 
              />
            </label>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="third-party-consent" className="font-medium dark:text-white">
              Third-Party Data Sharing
            </label>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Allow sharing data with trusted partners to improve services
            </p>
          </div>
          <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
            <input
              type="checkbox"
              id="third-party-consent"
              className="opacity-0 w-0 h-0"
              checked={consent.third_party_sharing}
              onChange={() => handleConsentChange('third_party_sharing')}
            />
            <label
              htmlFor="third-party-consent"
              className={`absolute top-0 left-0 right-0 bottom-0 rounded-full cursor-pointer transition-colors duration-200 ${
                consent.third_party_sharing 
                ? 'bg-blue-600' 
                : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span 
                className={`absolute left-1 bottom-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 transform ${
                  consent.third_party_sharing ? 'translate-x-6' : 'translate-x-0'
                }`} 
              />
            </label>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            Your privacy settings have been updated successfully.
          </div>
        )}
        
        <button
          onClick={saveConsentSettings}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
      
      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        <p>Privacy Policy Version: {CURRENT_PRIVACY_POLICY_VERSION}</p>
        <p className="mt-1">Last Updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
} 