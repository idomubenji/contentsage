import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  console.log("API: Organization creation request received");
  
  try {
    // Get the organization data and user ID from the request
    const body = await request.json();
    const { name, userId } = body;
    
    console.log("API: Request parameters", { name, userId, body });
    
    if (!name || !userId) {
      console.log("API: Missing required parameters");
      return NextResponse.json(
        { error: 'Organization name and user ID are required' },
        { status: 400 }
      );
    }
    
    // First, verify the user exists in the users table
    console.log("API: Verifying user exists", { userId });
    const { data: userExists, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (userError || !userExists) {
      console.error("API: User verification failed", { 
        error: userError, 
        userExists 
      });
      
      // If user doesn't exist, we need to create them first
      if (userError?.code === 'PGRST116') { // Row not found error
        console.log("API: User not found in database, cannot proceed");
        return NextResponse.json(
          { error: 'User does not exist in the database. Please refresh and try again.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: userError?.message || 'User verification failed' },
        { status: 500 }
      );
    }
    
    // Check if an organization with the same name already exists
    console.log("API: Checking for existing organization with name", { name });
    const { data: existingOrgs, error: checkError } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', name);
      
    if (checkError) {
      console.error("API: Error checking for existing organizations", checkError);
      return NextResponse.json(
        { error: 'Failed to check for existing organizations' },
        { status: 500 }
      );
    }
    
    if (existingOrgs && existingOrgs.length > 0) {
      console.log("API: Found existing organization with similar name", existingOrgs);
      
      // Check if the user is already a member of this organization
      const { data: membership, error: membershipError } = await supabase
        .from('user_organizations')
        .select('*')
        .eq('user_id', userId)
        .eq('organization_id', existingOrgs[0].id);
        
      if (membershipError) {
        console.error("API: Error checking membership", membershipError);
      }
      
      if (membership && membership.length > 0) {
        return NextResponse.json(
          { error: `You are already a member of "${existingOrgs[0].name}"` },
          { status: 400 }
        );
      }
      
      // Return information about the existing organization
      return NextResponse.json(
        { 
          error: `An organization named "${existingOrgs[0].name}" already exists.`,
          existingOrganization: existingOrgs[0]
        },
        { status: 409 } // Conflict status code
      );
    }
    
    // Create the organization
    console.log("API: Creating organization", { name });
    const { data: organization, error: createError } = await supabase
      .from('organizations')
      .insert([{ name }])
      .select()
      .single();
    
    if (createError) {
      console.error("API: Organization creation failed", { 
        error: createError,
        code: createError.code,
        message: createError.message,
        details: createError.details
      });
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }
    
    if (!organization) {
      console.error("API: No organization data returned but no error");
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }
    
    console.log("API: Organization created successfully", { 
      organization_id: organization.id 
    });
    
    // Add the user to the organization as admin - NEW APPROACH
    // Try the most basic insert possible
    console.log("API: Adding user to organization (basic approach)", { 
      user_id: userId, 
      organization_id: organization.id
    });
    
    try {
      // Insert without select, without returning, just the most basic insert
      const { error: joinError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          organization_id: organization.id,
          role: 'admin'
        });
      
      if (joinError) {
        throw joinError;
      }
      
      console.log("API: User added to organization successfully");
      
      // If we got here, success!
      return NextResponse.json({ 
        organization,
        message: 'Organization created successfully and you were added as admin'
      });
    } catch (joinError) {
      console.error("API: Failed to add user to organization", joinError);
      
      // Try a direct SQL approach
      try {
        console.log("API: Trying direct SQL approach");
        
        // Try to run this through the Postgres connection
        // Use the most basic form possible
        await supabase.rpc('insert_user_organization', {
          p_user_id: userId,
          p_org_id: organization.id,
          p_role: 'admin'
        });
        
        console.log("API: SQL approach succeeded");
        
        return NextResponse.json({ 
          organization,
          message: 'Organization created successfully and you were added as admin (SQL method)'
        });
      } catch (sqlError) {
        console.error("API: SQL approach failed", sqlError);
        
        // Even if this fails, we've already created the organization,
        // so return partial success
        return NextResponse.json({ 
          organization,
          warning: 'Organization created but failed to add you as admin. Please refresh the page to see if it worked, or contact support.'
        }, { status: 207 }); // 207 Multi-Status
      }
    }
  } catch (error) {
    console.error("API: Unhandled error in organization creation", error);
    let errorMessage = 'Internal server error';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = 'Unknown error object';
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the current user from the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return NextResponse.json(
        { error: 'Authentication error', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }
    
    if (!session?.user) {
      // For testing purposes, return all organizations if not authenticated
      const { data: allOrgs, error: allOrgsError } = await supabase
        .from('organizations')
        .select('id, name');
      
      if (allOrgsError) {
        console.error('Error fetching all organizations:', allOrgsError);
        return NextResponse.json(
          { error: 'Failed to fetch organizations', code: 'DB_ERROR' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ organizations: allOrgs || [] });
    }
    
    // Get organizations for the authenticated user
    const { data: userOrgs, error: userOrgsError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', session.user.id);
    
    if (userOrgsError) {
      console.error('Error fetching user organizations:', userOrgsError);
      return NextResponse.json(
        { error: 'Failed to fetch user organizations', code: 'DB_ERROR' },
        { status: 500 }
      );
    }
    
    if (!userOrgs || userOrgs.length === 0) {
      return NextResponse.json({ organizations: [] });
    }
    
    // Get organization details
    const organizationIds = userOrgs.map(org => org.organization_id);
    
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', organizationIds);
    
    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      return NextResponse.json(
        { error: 'Failed to fetch organization details', code: 'DB_ERROR' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ organizations: organizations || [] });
  } catch (error) {
    console.error('Error in organizations endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 