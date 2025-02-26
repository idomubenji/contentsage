import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase admin client with the service role key
// This client bypasses RLS policies
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
    const { data: userExists, error: userError } = await supabaseAdmin
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
    const { data: existingOrgs, error: checkError } = await supabaseAdmin
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
      const { data: membership, error: membershipError } = await supabaseAdmin
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
    const { data: organization, error: createError } = await supabaseAdmin
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
      const { error: joinError } = await supabaseAdmin
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
        await supabaseAdmin.rpc('insert_user_organization', {
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