'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { syncUserToDatabase } from '@/lib/user-utils';

export default function TestUserSync() {
  const { user, isLoading } = useAuth();
  const [dbUser, setDbUser] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);

  // Check if the user exists in the database
  const checkUserInDb = async () => {
    if (!user) return;
    
    setIsChecking(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error checking user in DB:', error);
        setDbUser(null);
      } else {
        setDbUser(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Force sync the user to the database
  const forceSync = async () => {
    setSyncStatus('Syncing...');
    try {
      const { error } = await syncUserToDatabase();
      if (error) {
        console.error('Error syncing user:', error);
        setSyncStatus(`Error: ${JSON.stringify(error)}`);
      } else {
        setSyncStatus('Sync successful!');
        // Check the user in the DB again
        await checkUserInDb();
      }
    } catch (error) {
      console.error('Error:', error);
      setSyncStatus(`Error: ${JSON.stringify(error)}`);
    }
  };

  useEffect(() => {
    if (user && !isLoading) {
      checkUserInDb();
    }
  }, [user, isLoading]);

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">User Sync Test</h1>
        <p>Please sign in to test user synchronization.</p>
        <a href="/auth/sign-in" className="text-blue-500 underline">Sign In</a>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">User Sync Test</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Auth User</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto max-w-full">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Database User</h2>
        {isChecking ? (
          <p>Checking...</p>
        ) : dbUser ? (
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-w-full">
            {JSON.stringify(dbUser, null, 2)}
          </pre>
        ) : (
          <p className="text-red-500">User not found in database!</p>
        )}
      </div>
      
      <div className="mb-6">
        <button
          onClick={checkUserInDb}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          disabled={isChecking}
        >
          Check Database
        </button>
        
        <button
          onClick={forceSync}
          className="bg-green-500 text-white px-4 py-2 rounded"
          disabled={isChecking}
        >
          Force Sync User
        </button>
        
        {syncStatus && (
          <p className="mt-2">{syncStatus}</p>
        )}
      </div>
    </div>
  );
} 