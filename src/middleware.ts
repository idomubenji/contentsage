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

// List of auth routes that should redirect to home if user is authenticated
const authRoutes = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/callback',
  '/auth/test'
];

// For development, set this to true to bypass authentication checks
const BYPASS_AUTH = process.env.NODE_ENV === 'development';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next') || 
      pathname.includes('favicon.ico') ||
      pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Debug: Log the request path
  console.log(`Middleware processing: ${pathname}`);

  // Create a response to modify its headers
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    // Create a Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            response.cookies.delete({ name, ...options });
          },
        },
      }
    );

    // Get the session without auto-refresh
    const { data: { session } } = await supabase.auth.getSession();
    
    // Debug: Log session information
    console.log('Middleware session check:', {
      hasSession: !!session,
      userId: session?.user?.id?.substring(0, 8),
      path: pathname,
      timestamp: new Date().toISOString(),
    });

    // If we're in development mode and bypassing auth, just continue
    if (BYPASS_AUTH) {
      console.log(`[DEV] Bypassing auth check for ${pathname}`);
      return response;
    }

    // If user is authenticated and trying to access auth routes, redirect to home
    if (session && authRoutes.some(route => pathname.startsWith(route))) {
      console.log(`Redirecting to home: User is authenticated and trying to access ${pathname}`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // If there's no session and not accessing public routes, redirect to sign in
    if (!session && !publicRoutes.some(route => pathname.startsWith(route))) {
      console.log(`Redirecting to sign-in: No session for ${pathname}`);
      const redirectUrl = new URL('/auth/sign-in', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (e) {
    console.error('Middleware error:', e);
    // On error, allow the request to continue
    return response;
  }
}

// Update matcher to exclude static files and API routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}; 