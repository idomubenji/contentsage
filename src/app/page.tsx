'use client';

import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, isLoading, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold mt-20">
          Welcome to ContentSage
        </h1>
        
        <div className="mt-8 p-6 border rounded-lg bg-white shadow-md max-w-md w-full">
          <h2 className="text-2xl font-semibold mb-4">Authentication Status</h2>
          
          {isLoading ? (
            <p>Loading authentication state...</p>
          ) : user ? (
            <div className="text-left">
              <p className="text-green-600 font-medium mb-2">✅ Authenticated</p>
              <div className="bg-gray-50 p-3 rounded text-sm mb-4">
                <p><span className="font-medium">User ID:</span> {user.id}</p>
                <p><span className="font-medium">Email:</span> {user.email}</p>
                <p><span className="font-medium">Last Sign In:</span> {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-600 font-medium mb-2">❌ Not authenticated</p>
              <p className="mb-4">You are not signed in.</p>
              <a
                href="/auth/sign-in"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded"
              >
                Go to Sign In
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
