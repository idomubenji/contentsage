'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DebugPage() {
  const [status, setStatus] = useState<string>('Loading...');
  const [authUser, setAuthUser] = useState<any>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        setStatus('Checking auth...');
        
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          setError(`Auth error: ${authError.message}`);
          setStatus('Error');
          return;
        }
        
        setAuthUser(user);
        
        if (!user) {
          setStatus('Not authenticated');
          return;
        }
        
        setStatus('Authenticated, checking database...');
        
        // Check if user exists in database
        const { data: dbUserData, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (dbError) {
          if (dbError.code === 'PGRST116') {
            setStatus('User not found in database');
          } else {
            setError(`Database error: ${dbError.message}`);
            setStatus('Error');
          }
          return;
        }
        
        setDbUser(dbUserData);
        setStatus('User found in database');
        
      } catch (error: any) {
        setError(`Unexpected error: ${error.message}`);
        setStatus('Error');
      }
    }
    
    checkAuth();
  }, []);

  const createUser = async () => {
    if (!authUser) {
      setError('Not authenticated');
      return;
    }
    
    try {
      setStatus('Creating user in database...');
      
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.name || authUser.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);
      
      if (insertError) {
        setError(`Error creating user: ${insertError.message}`);
        setStatus('Error');
        return;
      }
      
      setStatus('User created, refreshing...');
      
      // Refresh the user data
      const { data: dbUserData, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (dbError) {
        setError(`Error fetching user: ${dbError.message}`);
        setStatus('Error');
        return;
      }
      
      setDbUser(dbUserData);
      setStatus('User created successfully');
      
    } catch (error: any) {
      setError(`Unexpected error: ${error.message}`);
      setStatus('Error');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      
      <div className="mb-4">
        <p className="font-semibold">Status: <span className="font-normal">{status}</span></p>
        {error && (
          <p className="text-red-500 mt-2">{error}</p>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Auth User</h2>
          {authUser ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(authUser, null, 2)}
            </pre>
          ) : (
            <p>Not authenticated</p>
          )}
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Database User</h2>
          {dbUser ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(dbUser, null, 2)}
            </pre>
          ) : (
            <p>Not found in database</p>
          )}
        </div>
      </div>
      
      <div className="mb-6">
        {authUser && !dbUser && (
          <button
            onClick={createUser}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Create User in Database
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-500 text-white px-4 py-2 rounded ml-2"
        >
          Refresh Page
        </button>
        
        <a 
          href="/auth/sign-in" 
          className="bg-gray-500 text-white px-4 py-2 rounded ml-2 inline-block"
        >
          Go to Sign In
        </a>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">RLS Policies</h2>
        <p>If you're having issues with database access, make sure you've applied the RLS policies:</p>
        <pre className="bg-gray-100 p-4 rounded overflow-auto mt-2">
{`-- Allow users to select their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to insert their own data
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = id);`}
        </pre>
      </div>
    </div>
  );
} 