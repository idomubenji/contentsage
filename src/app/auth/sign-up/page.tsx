'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      // Check if auto-confirm worked (if email confirmation is disabled in Supabase)
      if (data.session) {
        setSuccess(true);
        setHasSession(true);
        // Redirect to home after a delay
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        // Email confirmation required
        setSuccess(true);
        setHasSession(false);
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Simple gradient background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="smoke-background"></div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="glowing-sphere-container mb-6">
            <div className="glowing-sphere"></div>
          </div>
          <h1 className="text-4xl font-bold text-white text-center mb-2 drop-shadow-lg">
            Welcome to ContentSage
          </h1>
          <p className="text-gray-200 text-center max-w-sm">
            Your intelligent content management solution
          </p>
        </div>
        
        {/* Sign-up form */}
        <div className="w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-8 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center">
            Create your account
          </h2>
          
          <form className="space-y-6" onSubmit={handleSignUp}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-700">
                  Account created successfully! {hasSession ? 'Redirecting to home...' : 'Check your email for confirmation.'}
                </p>
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
                disabled={loading || success}
                className="group relative flex w-full justify-center rounded-md bg-indigo-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {loading ? 'Creating account...' : success ? 'Account created!' : 'Sign up'}
              </button>
            </div>

            <div className="text-sm text-center">
              <Link href="/auth/sign-in" className="font-medium text-indigo-600 hover:text-indigo-500">
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
      <GlobalStyles />
    </div>
  );
}

// Add global styles for the glowing sphere
export function GlobalStyles() {
  return (
    <style jsx global>{`
      .glowing-sphere-container {
        perspective: 1200px;
        height: 160px;
        width: 160px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      
      .glowing-sphere {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, 
          rgba(255, 255, 255, 0.9) 0%, 
          rgba(225, 240, 255, 0.8) 20%, 
          rgba(96, 165, 250, 0.7) 50%, 
          rgba(59, 130, 246, 0.8) 100%);
        box-shadow: 0 0 10px 3px rgba(96, 165, 250, 0.4),
                   0 0 20px 5px rgba(96, 165, 250, 0.2);
        animation: glow 3s ease-in-out infinite alternate;
        position: relative;
        transform-style: preserve-3d;
        transform: rotateY(15deg) rotateX(10deg);
      }
      
      /* Enhance highlight reflection */
      .glowing-sphere::before {
        content: '';
        position: absolute;
        top: 15%;
        left: 15%;
        width: 35%;
        height: 35%;
        border-radius: 50%;
        background: radial-gradient(ellipse, 
          rgba(255, 255, 255, 1) 0%, 
          rgba(255, 255, 255, 0.7) 30%, 
          transparent 70%);
        z-index: 2;
        filter: blur(1px);
      }
      
      /* Enhanced shadow beneath the sphere */
      .glowing-sphere::after {
        content: '';
        position: absolute;
        bottom: -25px;
        left: 50%;
        transform: translateX(-50%);
        width: 110%;
        height: 25px;
        background: radial-gradient(ellipse, 
          rgba(0, 0, 0, 0.4) 0%, 
          rgba(0, 0, 0, 0.2) 50%,
          transparent 80%);
        border-radius: 50%;
        z-index: -1;
        filter: blur(6px);
      }
      
      @keyframes glow {
        from { 
          box-shadow: 0 0 10px 3px rgba(96, 165, 250, 0.4),
                     0 0 20px 5px rgba(96, 165, 250, 0.2); 
        }
        to { 
          box-shadow: 0 0 15px 5px rgba(96, 165, 250, 0.5),
                     0 0 30px 8px rgba(96, 165, 250, 0.3); 
        }
      }
    `}</style>
  );
} 