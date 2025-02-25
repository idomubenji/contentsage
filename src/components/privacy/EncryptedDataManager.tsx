"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Eye, EyeOff, Save, Trash } from "lucide-react";

interface EncryptedData {
  id: string;
  phone_encrypted: string | null;
  address_encrypted: string | null;
  notes_encrypted: string | null;
}

export default function EncryptedDataManager() {
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [decryptedData, setDecryptedData] = useState({
    id: "",
    phone: "",
    address: "",
    notes: ""
  });
  
  const [showPhone, setShowPhone] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  
  // Fetch user's encrypted data
  useEffect(() => {
    async function fetchEncryptedData() {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Use the decrypted view to get data
        const { data, error } = await supabase
          .from('user_decrypted_data')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error("Error fetching encrypted data:", error);
          throw new Error(error.message);
        }
        
        if (data) {
          setDecryptedData({
            id: data.id || "",
            phone: data.phone_encrypted || "",
            address: data.address_encrypted || "",
            notes: data.notes_encrypted || ""
          });
        }
      } catch (err: any) {
        console.error("Failed to fetch encrypted data:", err);
        setError(err.message || "Failed to fetch encrypted data");
      } finally {
        setLoading(false);
      }
    }
    
    fetchEncryptedData();
  }, [user, supabase]);
  
  const handleInputChange = (field: string, value: string) => {
    setDecryptedData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const saveEncryptedData = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      const dataToSave = {
        user_id: user.id,
        phone_encrypted: decryptedData.phone || null,
        address_encrypted: decryptedData.address || null,
        notes_encrypted: decryptedData.notes || null,
      };
      
      let result;
      
      if (decryptedData.id) {
        // Update existing record
        result = await supabase
          .from('user_encrypted_data')
          .update(dataToSave)
          .eq('id', decryptedData.id);
      } else {
        // Insert new record
        result = await supabase
          .from('user_encrypted_data')
          .insert(dataToSave);
      }
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      setSuccess(true);
      
    } catch (err: any) {
      console.error("Failed to save encrypted data:", err);
      setError(err.message || "Failed to save encrypted data");
    } finally {
      setSaving(false);
    }
  };
  
  const clearEncryptedData = async () => {
    if (!user || !decryptedData.id) return;
    
    const confirmed = window.confirm("Are you sure you want to delete all your encrypted personal data? This cannot be undone.");
    if (!confirmed) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      const { error } = await supabase
        .from('user_encrypted_data')
        .delete()
        .eq('id', decryptedData.id);
      
      if (error) {
        throw new Error(error.message);
      }
      
      setDecryptedData({
        id: "",
        phone: "",
        address: "",
        notes: ""
      });
      
      setSuccess(true);
      
    } catch (err: any) {
      console.error("Failed to delete encrypted data:", err);
      setError(err.message || "Failed to delete encrypted data");
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return <div className="p-4">Loading your encrypted data...</div>;
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Manage Encrypted Personal Data</h2>
      
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        This information is encrypted for your privacy. 
        Only you can view and manage this data - even our administrators cannot access it.
      </p>
      
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="phone" className="block text-gray-700 dark:text-gray-300 font-medium">
              Phone Number
            </label>
            <button 
              type="button"
              onClick={() => setShowPhone(!showPhone)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              aria-label={showPhone ? "Hide phone number" : "Show phone number"}
            >
              {showPhone ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showPhone ? "text" : "password"}
              id="phone"
              value={decryptedData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your phone number"
            />
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="address" className="block text-gray-700 dark:text-gray-300 font-medium">
              Address
            </label>
            <button 
              type="button"
              onClick={() => setShowAddress(!showAddress)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              aria-label={showAddress ? "Hide address" : "Show address"}
            >
              {showAddress ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showAddress ? "text" : "password"}
              id="address"
              value={decryptedData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your address"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="notes" className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
            Private Notes
          </label>
          <textarea
            id="notes"
            value={decryptedData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            rows={4}
            placeholder="Enter any private notes you'd like to securely store"
          />
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
            Your encrypted data has been updated successfully.
          </div>
        )}
        
        <div className="flex space-x-4">
          <button
            onClick={saveEncryptedData}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} className="mr-2" />
            {saving ? "Saving..." : "Save Data"}
          </button>
          
          {decryptedData.id && (
            <button
              onClick={clearEncryptedData}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              <Trash size={16} className="mr-2" />
              Delete All Data
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        <p>This data is encrypted using industry-standard AES-256 encryption.</p>
        <p className="mt-1">Last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
} 