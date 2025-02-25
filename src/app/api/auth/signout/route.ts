import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Sign-out API route called (GET)');
    
    // Create a new supabase server client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
    } else {
      console.log('Supabase sign-out successful');
    }
    
    // Create a new response that redirects to the sign-in page
    const response = NextResponse.redirect(new URL('/auth/sign-in', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
    
    // Clear all known Supabase auth cookies
    response.cookies.delete('supabase-auth-token');
    response.cookies.delete('sb-refresh-token');
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-auth-token');
    response.cookies.delete('sb-provider-token');
    response.cookies.delete('sb-auth-event');
    
    console.log('All auth cookies cleared, redirecting to sign-in page');
    
    return response;
  } catch (error) {
    console.error('Error in sign-out API route:', error);
    // Redirect to sign-in page even if there's an error
    return NextResponse.redirect(new URL('/auth/sign-in', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  }
}

export async function POST() {
  try {
    console.log('Sign-out API route called (POST)');
    
    const supabase = createRouteHandlerClient({ cookies });
    
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
    
    console.log('Supabase sign-out successful (POST)');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in sign-out API route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 