import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// GET organization preferences
export async function GET(request: NextRequest) {
  try {
    // Get the organization ID from the URL
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const userId = searchParams.get('userId');
    
    if (!organizationId || !userId) {
      return NextResponse.json(
        { error: 'Organization ID and user ID are required' },
        { status: 400 }
      );
    }
    
    // Verify the user has access to this organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('user_organizations')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();
      
    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }
    
    // Get the organization preferences
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('preferences')
      .eq('id', organizationId)
      .single();
      
    if (orgError) {
      return NextResponse.json(
        { error: 'Failed to fetch organization preferences' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ preferences: organization.preferences || {} });
  } catch (error) {
    console.error('Error fetching organization preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH to update organization preferences
export async function PATCH(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    const { organizationId, userId, preferences } = body;
    
    console.log('[API] PATCH /api/organizations/preferences - Request body:', body);
    
    if (!organizationId || !userId || !preferences) {
      console.log('[API] Missing required fields:', {
        hasOrgId: !!organizationId,
        hasUserId: !!userId,
        hasPreferences: !!preferences
      });
      return NextResponse.json(
        { error: 'Organization ID, user ID, and preferences are required' },
        { status: 400 }
      );
    }
    
    // Verify the user has access to this organization and is an admin
    console.log('[API] Verifying user membership:', { userId, organizationId });
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('user_organizations')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();
      
    if (membershipError) {
      console.error('[API] Membership check error:', membershipError);
      return NextResponse.json(
        { error: 'Failed to verify organization membership: ' + membershipError.message },
        { status: 500 }
      );
    }
    
    if (!membership) {
      console.log('[API] User is not a member of this organization');
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }
    
    console.log('[API] User role:', membership.role);
    // Only admins can update preferences
    if (membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only organization admins can update preferences' },
        { status: 403 }
      );
    }
    
    // Skip RPC attempt and go directly to update method
    console.log('[API] Fetching current preferences');
    const { data: currentOrg, error: getError } = await supabaseAdmin
      .from('organizations')
      .select('preferences')
      .eq('id', organizationId)
      .single();
      
    if (getError) {
      console.error('[API] Error fetching current preferences:', getError);
      return NextResponse.json(
        { error: 'Failed to fetch current preferences: ' + getError.message },
        { status: 500 }
      );
    }
    
    // Merge current preferences with new ones
    const mergedPreferences = {
      ...(currentOrg.preferences || {}),
      ...preferences
    };
    
    console.log('[API] Merged preferences:', mergedPreferences);
    
    // Update with merged preferences
    console.log('[API] Performing direct update with merged preferences');
    const { data: updatedOrg, error: directUpdateError } = await supabaseAdmin
      .from('organizations')
      .update({ preferences: mergedPreferences })
      .eq('id', organizationId)
      .select('preferences')
      .single();
      
    if (directUpdateError) {
      console.error('[API] Direct update error:', directUpdateError);
      return NextResponse.json(
        { error: 'Failed to update organization preferences: ' + directUpdateError.message },
        { status: 500 }
      );
    }
    
    console.log('[API] Direct update successful:', updatedOrg);
    return NextResponse.json({ 
      preferences: updatedOrg.preferences,
      message: 'Preferences updated successfully' 
    });
    
  } catch (error) {
    console.error('[API] Unhandled exception in PATCH /api/organizations/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
} 