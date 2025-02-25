import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Helper function to log all cookies for debugging
function logAllCookies(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  console.log('-------- COOKIE DEBUG INFO --------');
  console.log(`Total cookies: ${allCookies.length}`);
  
  if (allCookies.length > 0) {
    console.log('Cookie names: ' + allCookies.map(c => c.name).join(', '));
    console.log('Cookie details:');
    allCookies.forEach(cookie => {
      console.log(`- ${cookie.name}: ${cookie.value.substring(0, 20)}${cookie.value.length > 20 ? '...' : ''}`);
    });
    
    // Check for known auth cookies specifically
    const authCookies = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token', 'sb-auth-token'];
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
  const { pathname, search } = request.nextUrl;
  const url = new URL(request.url);
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next') || 
      pathname.includes('favicon.ico') ||
      pathname.includes('/contentsage.jpg') || 
      pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Special debug parameter to force access to any page
  if (url.searchParams.has('_bypass_auth')) {
    console.log(`Auth check bypassed due to _bypass_auth parameter`);
    return NextResponse.next();
  }

  // Enhanced debug logging
  console.log(`\n==== MIDDLEWARE START: ${pathname} ====`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Path: ${pathname}`);
  console.log(`Query: ${search}`);
  logAllCookies(request);

  // Create a response to modify its headers
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    // Check for our marker cookie - this is the simplest and most reliable way
    // to detect if a user is logged in
    const hasMarkerCookie = request.cookies.has('sb-auth-token');
    let isAuthenticated = hasMarkerCookie;
    
    console.log(`Auth marker cookie check: ${hasMarkerCookie ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}`);
    
    // If no marker cookie, try server-side Supabase check
    if (!isAuthenticated) {
      console.log('No marker cookie found, falling back to Supabase server check');
      
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
      
      // Update authenticated status based on session
      isAuthenticated = isAuthenticated || !!session;
    }
    
    console.log(`Final auth determination: ${isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}`);
    
    const isAuthPath = pathname.startsWith('/auth');
    const isRootPath = pathname === '/';

    // Check if we're already in a redirect to prevent loops
    const isRedirect = url.searchParams.has('_mw_redir');
    if (isRedirect) {
      console.log(`Already in a redirect (_mw_redir parameter detected), preventing loop`);
      return response;
    }

    // For auth paths
    if (isAuthPath) {
      if (!isAuthenticated) {
        // Unauthenticated users can access auth paths
        console.log(`Unauthenticated user accessing auth path, allowing access.`);
        return response;
      } else {
        // Authenticated users should be redirected away from auth paths
        const redirectTo = url.searchParams.get('redirect_to') || '/';
        
        console.log(`Authenticated user attempted to access ${pathname}, redirecting to ${redirectTo}`);
        const redirectUrl = new URL(redirectTo, request.url);
        redirectUrl.searchParams.set('_mw_redir', '1');
        console.log(`==== MIDDLEWARE END: ${pathname} (REDIRECTED TO ${redirectTo}) ====\n`);
        return NextResponse.redirect(redirectUrl);
      }
    }
    
    // For non-auth paths (including root)
    if (!isAuthPath) {
      if (isAuthenticated) {
        // Authenticated users can access non-auth paths
        console.log(`Authenticated user accessing non-auth path ${pathname}, allowing access.`);
        return response;
      } else {
        // Unauthenticated users should be redirected to sign-in
        console.log(`Unauthenticated user attempted to access ${pathname}, redirecting to sign-in`);
        
        const redirectUrl = new URL('/auth/sign-in', request.url);
        redirectUrl.searchParams.set('redirect_to', pathname);
        redirectUrl.searchParams.set('_mw_redir', '1');
        console.log(`==== MIDDLEWARE END: ${pathname} (REDIRECTED TO SIGN-IN) ====\n`);
        return NextResponse.redirect(redirectUrl);
      }
    }

    // This code should not be reached, but just in case
    console.log(`Unhandled path pattern. Allowing access by default.`);
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