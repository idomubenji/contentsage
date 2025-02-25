'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { syncUserToDatabase } from './user-utils';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      console.log('AuthProvider: Getting initial session...');
      try {
        setIsLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setIsLoading(false);
          return;
        }
        
        console.log('AuthProvider: Session retrieved:', session ? 'exists' : 'null');
        setSession(session);
        setUser(session?.user ?? null);
        
        // If user is authenticated, sync to database
        if (session?.user) {
          console.log('AuthProvider: Syncing user to database...');
          try {
            await syncUserToDatabase();
            console.log('AuthProvider: User sync completed');
          } catch (syncError) {
            console.error('Error syncing user:', syncError);
            // Continue even if sync fails
          }
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        console.log('AuthProvider: Setting isLoading to false');
        setIsLoading(false);
      }
    };
    
    getInitialSession();
    
    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Sync user to database on sign in or sign up
        if (session?.user && (event === 'SIGNED_IN' || event === 'SIGNED_UP' as AuthChangeEvent)) {
          console.log('AuthProvider: Auth state changed, syncing user...');
          
          // Don't await the sync - let it run in the background
          // This prevents the auth flow from being blocked if sync hangs
          syncUserToDatabase()
            .then(() => {
              console.log('AuthProvider: User sync completed after auth change');
            })
            .catch((syncError) => {
              console.error('Error syncing user after auth change:', syncError);
              // Continue even if sync fails
            });
        }
        
        setIsLoading(false);
      }
    );
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('AuthProvider: Signing in...');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!error) {
        console.log('AuthProvider: Sign in successful, syncing user...');
        try {
          await syncUserToDatabase();
          console.log('AuthProvider: User sync completed after sign in');
        } catch (syncError) {
          console.error('Error syncing user after sign in:', syncError);
          // Continue even if sync fails
        }
      } else {
        console.error('Sign in error:', error);
      }
      
      return { error };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('AuthProvider: Signing up...');
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (!error) {
        console.log('AuthProvider: Sign up successful, syncing user...');
        try {
          await syncUserToDatabase();
          console.log('AuthProvider: User sync completed after sign up');
        } catch (syncError) {
          console.error('Error syncing user after sign up:', syncError);
          // Continue even if sync fails
        }
      } else {
        console.error('Sign up error:', error);
      }
      
      return { error };
    } catch (error) {
      console.error('Error signing up:', error);
      return { error };
    }
  };

  const signOut = async () => {
    console.log('AuthProvider: Signing out...');
    try {
      // Clear local session data first
      setUser(null);
      setSession(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
      }
      
      // Force a complete page reload to clear any stale state
      console.log('Redirecting to sign-in page after sign-out');
      window.location.replace('/auth/sign-in');
    } catch (error) {
      console.error('Error in signOut function:', error);
      // Even if there's an error, try to redirect
      window.location.replace('/auth/sign-in');
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export an alias for backward compatibility
export const useAuthContext = useAuth; 