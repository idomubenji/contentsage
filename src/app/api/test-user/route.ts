import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    console.log('==== TEST USER API ====');
    
    // Initialize auth client with cookies
    const cookieStore = cookies();
    const cookieHeader = request.headers.get('cookie') || '';
    console.log('Test User API - Cookie header present:', !!cookieHeader);
    
    // Create Supabase client with cookies 
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            cookie: cookieHeader
          }
        }
      }
    );
    
    // Try to get the session from Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Get all available users for reference
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .limit(5);
      
    // Get available organizations
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(5);
      
    // Get user organizations - if we have a current user
    let userOrganizations: any[] = [];
    if (sessionData?.session?.user?.id) {
      const { data: userOrgs } = await supabase
        .from('user_organizations')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', sessionData.session.user.id);
        
      userOrganizations = userOrgs || [];
    }
    
    const result = {
      currentUser: sessionData?.session?.user || null,
      sessionError: sessionError ? sessionError.message : null,
      hasSession: !!sessionData?.session,
      availableUsers: users || [],
      availableOrganizations: organizations || [],
      userOrganizations: userOrganizations
    };
    
    console.log('Test User API - Result:', JSON.stringify(result));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in test-user endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 