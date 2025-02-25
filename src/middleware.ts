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

    const isAuthenticated = !!session;
    const isAuthPath = pathname.startsWith('/auth');

    // Rule 1: Unauthenticated users can only access /auth/* paths
    if (!isAuthenticated && !isAuthPath) {
      console.log(`Unauthenticated user attempted to access ${pathname}, redirecting to sign-in`);
      const redirectUrl = new URL('/auth/sign-in', request.url);
      redirectUrl.searchParams.set('redirect_to', pathname);
      console.log(`==== MIDDLEWARE END: ${pathname} (REDIRECTED) ====\n`);
      return NextResponse.redirect(redirectUrl);
    }

    // Rule 2: Authenticated users can only access non-/auth/* paths
    if (isAuthenticated && isAuthPath) {
      console.log(`Authenticated user attempted to access ${pathname}, redirecting to home`);
      console.log(`==== MIDDLEWARE END: ${pathname} (REDIRECTED) ====\n`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // If rules are satisfied, allow the request
    console.log(`Access allowed for ${isAuthenticated ? 'authenticated' : 'unauthenticated'} user to ${pathname}`);
    console.log(`==== MIDDLEWARE END: ${pathname} (ALLOWED) ====\n`);
    return response;

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