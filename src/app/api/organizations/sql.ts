import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This endpoint can be called to fix the RLS policies
export async function GET() {
  console.log("Attempting to fix RLS policies for user_organizations table");
  
  try {
    // First try to drop the existing policy if it exists
    try {
      console.log("Dropping existing policy on user_organizations if it exists");
      await supabaseAdmin.rpc('drop_policy_if_exists', {
        table_name: 'user_organizations',
        policy_name: 'Users can only see user_organizations they created or belong to their organizations'
      });
    } catch (error) {
      console.log("Error dropping policy (may not exist):", error);
    }
    
    // Create policy to allow users to create their own membership
    console.log("Creating policy to allow users to create their own membership");
    await supabaseAdmin.from('policies').insert({
      name: 'Users can create their own membership',
      table: 'user_organizations',
      operation: 'INSERT',
      check: 'auth.uid() = user_id'
    });
    
    // Create policy to allow admins to manage memberships in their organizations
    console.log("Creating policy for admins to manage user memberships");
    await supabaseAdmin.from('policies').insert({
      name: 'Admins can manage user memberships',
      table: 'user_organizations',
      operation: 'ALL',
      check: 'EXISTS (SELECT 1 FROM user_organizations WHERE user_id = auth.uid() AND organization_id = user_organizations.organization_id AND role = \'admin\')'
    });
    
    // Create policy to allow users to see memberships in their organizations
    console.log("Creating policy for users to view members in their organizations");
    await supabaseAdmin.from('policies').insert({
      name: 'Users can see members in their organizations',
      table: 'user_organizations',
      operation: 'SELECT',
      check: 'EXISTS (SELECT 1 FROM user_organizations WHERE user_id = auth.uid() AND organization_id = user_organizations.organization_id)'
    });
    
    return NextResponse.json({
      success: true,
      message: "RLS policies have been updated",
      sqlCommands: [
        "DROP POLICY IF EXISTS \"Users can only see user_organizations they created or belong to their organizations\" ON \"user_organizations\";",
        "CREATE POLICY \"Users can create their own membership\" ON \"user_organizations\" FOR INSERT WITH CHECK (auth.uid() = user_id);",
        "CREATE POLICY \"Admins can manage user memberships\" ON \"user_organizations\" FOR ALL USING (EXISTS (SELECT 1 FROM user_organizations WHERE user_id = auth.uid() AND organization_id = user_organizations.organization_id AND role = 'admin'));",
        "CREATE POLICY \"Users can see members in their organizations\" ON \"user_organizations\" FOR SELECT USING (EXISTS (SELECT 1 FROM user_organizations WHERE user_id = auth.uid() AND organization_id = user_organizations.organization_id));"
      ]
    });
  } catch (error) {
    console.error("Failed to fix RLS policies:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
} 