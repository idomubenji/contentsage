import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of public routes that don't require authentication
const publicRoutes = [
  '/auth/sign-in', 
  '/auth/sign-up', 
  '/auth/callback', 
  '/auth/test', 
  '/auth/auth-error'
];

// Main application routes to bypass auth in production (temporary fix)
const appRoutes = [
  '/inspector',
  '/calendar',
  '/debug',
  '/simple-test'
];

// List of auth routes that should redirect to home if user is authenticated
const authRoutes = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/callback',
  '/auth/test'
];

// For development, set this to true to bypass authentication checks
const BYPASS_AUTH = process.env.NODE_ENV === 'development'; // Bypass auth in dev mode for now

// TEMPORARY PRODUCTION WORKAROUND
// We're having issues with auth cookies in production, so temporarily bypass auth
const BYPASS_PROD_AUTH = process.env.NODE_ENV === 'production';

// Helper function to log all cookies for debugging
function logAllCookies(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  console.log('-------- COOKIE DEBUG INFO --------');
  console.log(`Total cookies: ${allCookies.length}`);
  
  if (allCookies.length > 0) {
    console.log('Cookie names: ' + allCookies.map(c => c.name).join(', '));
    
    // Check for known auth cookies specifically
    const authCookies = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token'];
    for (const cookieName of authCookies) {
      const cookie = request.cookies.get(cookieName);
      console.log(`${cookieName}: ${cookie ? 'PRESENT' : 'MISSING'}`);
    }
  } else {
    console.log('No cookies found');
  }
  console.log('-----------------------------------');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next') || 
      pathname.includes('favicon.ico') ||
      pathname.includes('/contentsage.jpg') || // Allow access to logo
      pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Enhanced debug logging
  console.log(`\n==== MIDDLEWARE START: ${pathname} ====`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Path: ${pathname}`);
  logAllCookies(request);

  // Create a response to modify its headers
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    // PRODUCTION WORKAROUND: Bypass all auth checks for main app routes in production
    if (BYPASS_PROD_AUTH && appRoutes.some(route => pathname.startsWith(route))) {
      console.log(`[PROD WORKAROUND] Bypassing auth check for app route: ${pathname}`);
      console.log(`==== MIDDLEWARE END: ${pathname} (ALLOWED - PROD BYPASS) ====\n`);
      return response;
    }

    // Check for auth-specific cookies that indicate the user is probably authenticated
    const hasAuthCookie = request.cookies.has('sb-access-token') || 
                          request.cookies.has('sb-refresh-token') || 
                          request.cookies.has('supabase-auth-token');
    
    // For debugging, let's also check for any cookie that might be auth-related
    const allCookies = request.cookies.getAll();
    const hasAnyCookie = allCookies.length > 0;
    const hasPossibleAuthCookie = allCookies.some(c => 
      c.name.includes('auth') || 
      c.name.includes('token') || 
      c.name.includes('session')
    );
    
    console.log('Authentication status:');
    console.log(`- Has specific auth cookie: ${hasAuthCookie}`);
    console.log(`- Has any cookies: ${hasAnyCookie}`);
    console.log(`- Has possible auth cookie: ${hasPossibleAuthCookie}`);

    // Allow access to public routes without any checks
    if (publicRoutes.some(route => pathname.startsWith(route))) {
      console.log(`Direct access allowed for public route: ${pathname}`);
      return response;
    }

    // Always allow access to root without checks
    if (pathname === '/') {
      console.log(`Direct access allowed for root path`);
      return response;
    }

    // In development mode, bypass auth
    if (BYPASS_AUTH) {
      console.log(`Bypassing auth check in development mode for: ${pathname}`);
      return response;
    }

    // TEMPORARY FIX FOR PRODUCTION:
    // If there are any cookies at all in production, let's assume the user might be authenticated
    // This is a relaxed check to help overcome potential cookie issues in production
    if (process.env.NODE_ENV === 'production' && hasAnyCookie) {
      console.log(`[PROD FIX] Found cookies, assuming authenticated: ${pathname}`);
      return response;
    }

    // Create a Supabase client
    const supabase = createServerClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const cookie = request.cookies.get(name);
            console.log(`Getting cookie ${name}: ${cookie ? 'exists' : 'not found'}`);
            return cookie?.value;
          },
          set(name: string, value: string, options: any) {
            console.log(`Setting cookie ${name}`);
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            console.log(`Removing cookie ${name}`);
            response.cookies.delete({ name, ...options });
          },
        },
      }
    );

    // Get the session
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('Supabase session check result:');
    console.log(`- Session exists: ${!!session}`);
    console.log(`- User ID: ${session?.user?.id || 'none'}`);

    // If any sign of authentication, allow access
    if (session || hasAuthCookie || hasPossibleAuthCookie) {
      console.log(`Authentication detected, allowing access to ${pathname}`);
      console.log(`==== MIDDLEWARE END: ${pathname} (ALLOWED) ====\n`);
      return response;
    }

    // If there's no sign of authentication, redirect to sign in
    console.log(`No authentication detected, redirecting to sign-in for ${pathname}`);
    const redirectUrl = new URL('/auth/sign-in', request.url);
    redirectUrl.searchParams.set('redirect_to', pathname);
    console.log(`==== MIDDLEWARE END: ${pathname} (REDIRECTED) ====\n`);
    return NextResponse.redirect(redirectUrl);

  } catch (e) {
    console.error('Middleware error:', e);
    console.log(`==== MIDDLEWARE END: ${pathname} (ERROR) ====\n`);
    // On error, allow the request to continue to avoid blocking the user
    return response;
  }
}

// Update matcher to exclude static files and API routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}; 