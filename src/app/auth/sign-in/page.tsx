'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect_to') || '/';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDebugInfo('Starting sign-in process...');

    try {
      // Log the sign-in attempt
      console.log(`Attempting to sign in with email: ${email.substring(0, 3)}...`);
      
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        setDebugInfo(`Auth error: ${error.message}`);
        throw error;
      }

      // Log successful sign-in
      console.log("Sign-in successful:", data);
      setDebugInfo('Sign-in successful, preparing to redirect...');
      
      // Check if we have a session
      if (!data.session) {
        throw new Error('No session returned after successful sign-in');
      }
      
      // Force redirect after a short delay, regardless of user sync completion
      // This ensures we don't get stuck if user sync hangs
      const forceRedirectTimer = setTimeout(() => {
        console.log("Force redirecting to home page after timeout...");
        window.location.href = '/';
      }, 3000); // Force redirect after 3 seconds
      
      // Try normal redirect first
      setTimeout(() => {
        console.log("Redirecting to home page...");
        // Use router.push for client-side navigation
        router.push('/');
        
        // As a fallback, also use window.location after a short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      }, 500);
      
    } catch (error: any) {
      console.error('Sign-in error:', error);
      setError(error.message || 'An error occurred during sign in');
      setDebugInfo(`Error during sign-in: ${error.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  // Add an effect to check the auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        console.log("Current auth state:", data.session ? "Authenticated" : "Not authenticated");
        
        if (data.session) {
          console.log("User is already authenticated, redirecting to home...");
          router.push('/');
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
      }
    };
    
    checkAuth();
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Simple gradient background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="smoke-background"></div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 overflow-hidden rounded-3xl shadow-lg">
            <Image
              src="/contentsage.jpg"
              alt="ContentSage Logo"
              width={150}
              height={150}
              className="object-cover"
              priority
            />
          </div>
          <h1 className="text-4xl font-bold text-white text-center mb-2 drop-shadow-lg">
            Welcome to ContentSage
          </h1>
          <p className="text-gray-200 text-center max-w-sm">
            Your intelligent content management solution
          </p>
        </div>
        
        {/* Sign-in form */}
        <div className="w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-8 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center">
            Sign in to your account
          </h2>
          
          <form className="space-y-6" onSubmit={handleSignIn}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            {debugInfo && process.env.NODE_ENV === 'development' && (
              <div className="rounded-md bg-blue-50 p-4">
                <p className="text-xs text-blue-700 font-mono">{debugInfo}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm py-2 px-3 bg-white/80 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm py-2 px-3 bg-white/80 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="text-sm text-center">
              <Link href="/auth/sign-up" className="font-medium text-indigo-600 hover:text-indigo-500">
                Don't have an account? Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 