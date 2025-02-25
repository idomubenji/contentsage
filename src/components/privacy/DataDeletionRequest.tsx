"use client";

import { useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function DataDeletionRequest() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  
  const [requestType, setRequestType] = useState<'ANONYMIZE' | 'DELETE'>('ANONYMIZE');
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const handleSubmitRequest = async () => {
    if (!user) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Check if user already has a pending request
      const { data: existingRequests, error: checkError } = await supabase
        .from('data_deletion_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['PENDING', 'PROCESSING'])
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw new Error("Error checking existing requests");
      }
      
      if (existingRequests) {
        throw new Error("You already have a pending data deletion request. Please wait for it to be processed.");
      }
      
      // Submit new request
      const { error: insertError } = await supabase
        .from('data_deletion_requests')
        .insert({
          user_id: user.id,
          request_type: requestType,
          notes: reason || null
        });
      
      if (insertError) {
        throw new Error(insertError.message);
      }
      
      setSuccess(true);
      setReason("");
      setShowConfirmation(false);
      
    } catch (err: any) {
      console.error("Failed to submit deletion request:", err);
      setError(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };
  
  const confirmDeletion = () => {
    setShowConfirmation(true);
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mt-6">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Request Data Deletion</h2>
      
      {!showConfirmation ? (
        <>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Under GDPR and CCPA regulations, you have the right to request deletion of your personal data.
            You can choose to either anonymize your data (keeping your content but removing personal identifiers)
            or completely delete all your data from our systems.
          </p>
          
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Deletion Option</label>
            <div className="space-y-2">
              <div className="flex items-start">
                <input
                  type="radio"
                  id="anonymize"
                  name="deletion-type"
                  className="mt-1"
                  checked={requestType === 'ANONYMIZE'}
                  onChange={() => setRequestType('ANONYMIZE')}
                />
                <label htmlFor="anonymize" className="ml-2 block">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Anonymize my data</span>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Your name and contact details will be anonymized, but your content will remain.
                  </p>
                </label>
              </div>
              
              <div className="flex items-start">
                <input
                  type="radio"
                  id="delete"
                  name="deletion-type"
                  className="mt-1"
                  checked={requestType === 'DELETE'}
                  onChange={() => setRequestType('DELETE')}
                />
                <label htmlFor="delete" className="ml-2 block">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Completely delete my data</span>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    All your data will be permanently removed from our systems.
                  </p>
                </label>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="reason" className="block text-gray-700 dark:text-gray-300 mb-2">
              Reason (optional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Please tell us why you're requesting deletion (optional)"
            />
          </div>
          
          <button
            onClick={confirmDeletion}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Continue with Request
          </button>
        </>
      ) : (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-300 dark:border-red-700">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">
            Confirm Data Deletion Request
          </h3>
          
          <p className="text-red-700 dark:text-red-400 mb-4">
            {requestType === 'ANONYMIZE' 
              ? "Are you sure you want to anonymize your personal data? Your account will remain but personal identifiers will be removed."
              : "Are you sure you want to completely delete all your data? This action cannot be undone."}
          </p>
          
          <div className="flex space-x-4">
            <button
              onClick={() => setShowConfirmation(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Confirm Request"}
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Your data deletion request has been submitted successfully. We will process your request within 30 days 
          as required by data protection regulations.
        </div>
      )}
    </div>
  );
} 