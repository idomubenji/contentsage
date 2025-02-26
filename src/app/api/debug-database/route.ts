import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with the service role key for admin access
// This ensures we can bypass RLS while maintaining security
const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or service role key');
    throw new Error('Missing Supabase configuration');
  }
  
  console.log('Creating admin Supabase client with URL:', supabaseUrl);
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function GET(request: Request) {
  try {
    console.log('=== DEBUG DATABASE START ===');
    
    // Step 1: Get server Supabase client
    console.log('Initializing server-side Supabase client with admin privileges');
    const supabaseAdmin = createServerSupabaseClient();
    
    // Step 2: Get schema information to verify table existence
    console.log('Checking database schema...');
    const { data: tables, error: schemaError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .eq('table_schema', 'public');
    
    if (schemaError) {
      console.error('Error accessing schema information:', schemaError);
    } else {
      console.log('Schema information:', { 
        tableCount: tables?.length || 0,
        tables: tables?.map(t => `${t.table_schema}.${t.table_name}`)
      });
    }
    
    // Step 3: Try a generic query that doesn't use table names
    console.log('Running generic query...');
    const { data: genericData, error: genericError } = await supabaseAdmin
      .rpc('get_current_timestamp');
    
    console.log('Generic query result:', {
      success: !genericError,
      data: genericData,
      error: genericError ? genericError.message : null
    });
    
    // Step 4: Check if the organizations table exists
    console.log('Checking organizations table directly...');
    const { count, error: countError } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true });
    
    console.log('Organizations count check:', {
      count,
      error: countError ? countError.message : null
    });
    
    // Step 5: Check RLS policies that might be affecting access
    console.log('Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabaseAdmin
      .from('information_schema.policies')
      .select('*')
      .eq('table_name', 'organizations');
    
    console.log('RLS policies for organizations:', {
      count: policies?.length || 0,
      policies: policies?.map(p => ({ 
        name: p.policyname, 
        roles: p.roles,
        cmd: p.cmd, 
        using: p.using,
        with_check: p.with_check
      })),
      error: policiesError ? policiesError.message : null
    });
    
    // Step 6: Try to query the organizations table with different approaches
    console.log('Attempting different query approaches...');
    
    // 6.1: Try without a filter
    const { data: allOrgs, error: allOrgsError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .limit(10);
    
    console.log('Query without filter:', {
      count: allOrgs?.length || 0,
      organizations: allOrgs?.map(o => ({ id: o.id, name: o.name })),
      error: allOrgsError ? allOrgsError.message : null
    });
    
    // 6.2: Try with auth context if available
    console.log('Checking auth context...');
    const { data: authData } = await supabaseAdmin.auth.getSession();
    
    console.log('Auth session:', {
      exists: !!authData?.session,
      user: authData?.session?.user?.id ? 'Authenticated' : 'Not authenticated'
    });
    
    // Step 7: Check direct access to a specific organization ID
    const testId = 'b00816b8-b5d1-46f3-a135-ac4d52a407f2'; // The ID from your logs
    console.log(`Testing direct access to organization ID: ${testId}`);
    
    const { data: specificOrg, error: specificError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', testId)
      .maybeSingle();
    
    console.log('Direct ID query result:', {
      found: !!specificOrg,
      organization: specificOrg ? { id: specificOrg.id, name: specificOrg.name } : null,
      error: specificError ? specificError.message : null
    });
    
    // Step 8: Test if the table structure matches what we expect
    console.log('Checking table structure...');
    const { data: columns, error: columnsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'organizations')
      .eq('table_schema', 'public');
    
    console.log('Table structure:', {
      columns: columns?.map(c => ({ name: c.column_name, type: c.data_type })),
      error: columnsError ? columnsError.message : null
    });
    
    console.log('=== DEBUG DATABASE END ===');

    // Return all the debug information
    return NextResponse.json({
      success: true,
      diagnostics: {
        schema: {
          tableCount: tables?.length || 0,
          tables: tables?.map(t => `${t.table_schema}.${t.table_name}`)
        },
        counts: {
          organizations: count
        },
        directQuery: {
          found: !!specificOrg,
          organization: specificOrg
        },
        tableStructure: {
          columns: columns?.map(c => ({ name: c.column_name, type: c.data_type }))
        },
        authentication: {
          hasSession: !!authData?.session
        }
      }
    });
    
  } catch (error) {
    console.error('Error in debug-database API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 