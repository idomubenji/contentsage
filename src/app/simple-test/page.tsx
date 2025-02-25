'use client';

import { useEffect, useState } from 'react';
import { SimpleAuthProvider, useSimpleAuth } from '@/lib/simple-auth-context';
import { supabase } from '@/lib/supabase';

function SimpleTestContent() {
  const { user, isLoading } = useSimpleAuth();
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

  // Create the user in the database
  const createUser = async () => {
    if (!user) return;
    
    setSyncStatus('Creating user...');
    try {
      const { error } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);
      
      if (error) {
        console.error('Error creating user:', error);
        setSyncStatus(`Error: ${JSON.stringify(error)}`);
      } else {
        setSyncStatus('User created successfully!');
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
        <h1 className="text-2xl font-bold mb-4">Simple Auth Test</h1>
        <p>Please sign in to test user synchronization.</p>
        <a href="/auth/sign-in" className="text-blue-500 underline">Sign In</a>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Simple Auth Test</h1>
      
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
        
        {!dbUser && (
          <button
            onClick={createUser}
            className="bg-green-500 text-white px-4 py-2 rounded"
            disabled={isChecking}
          >
            Create User in Database
          </button>
        )}
        
        {syncStatus && (
          <p className="mt-2">{syncStatus}</p>
        )}
      </div>
    </div>
  );
}

export default function SimpleTestPage() {
  return (
    <SimpleAuthProvider>
      <SimpleTestContent />
    </SimpleAuthProvider>
  );
} 