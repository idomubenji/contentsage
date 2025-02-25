import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Log the environment variables for debugging
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Key (first few chars):', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 5) + '...');

// Helper function to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith(name + '=')) {
      return cookie.substring(name.length + 1);
    }
  }
  return null;
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Using localStorage primarily, but also store a marker cookie
      // to help the middleware identify auth state
      storage: {
        getItem: (key) => {
          if (typeof window === 'undefined') {
            return null;
          }
          
          return window.localStorage.getItem(key);
        },
        setItem: (key, value) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
            console.log(`Auth: Stored ${key} in localStorage`);
            
            // Also set a simple marker cookie for middleware
            if (typeof document !== 'undefined') {
              document.cookie = `sb-auth-token=true; path=/; max-age=2592000; SameSite=Lax`;
              console.log(`Auth: Also stored marker cookie sb-auth-token`);
            }
          }
        },
        removeItem: (key) => {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(key);
            console.log(`Auth: Removed ${key} from localStorage`);
            
            // Also remove the marker cookie
            if (typeof document !== 'undefined') {
              document.cookie = "sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              console.log(`Auth: Also removed marker cookie sb-auth-token`);
            }
          }
        },
      },
    },
  }
); 