import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with the Admin key for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function GET(request: NextRequest) {
  try {
    // Get the session to identify the user making the request
    const supabaseAuthClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized or invalid token', details: authError },
        { status: 401 }
      );
    }

    const userId = user.id;
    const format = request.nextUrl.searchParams.get('format') || 'json'; // Default to JSON format
    
    // Log this export request for compliance/auditing
    await supabaseAdmin
      .from('data_access_logs')
      .insert({
        user_id: userId,
        request_type: 'data_export',
        requested_at: new Date().toISOString(),
        format: format
      });

    // Fetch user profile data
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile data:', profileError);
    }

    // Fetch user's consent data
    const { data: consentData, error: consentError } = await supabaseAdmin
      .from('user_consents')
      .select('*')
      .eq('user_id', userId);

    if (consentError) {
      console.error('Error fetching consent data:', consentError);
    }

    // Fetch user's encrypted data (excluding sensitive fields)
    const { data: encryptedData, error: encryptedError } = await supabaseAdmin
      .from('encrypted_user_data')
      .select('created_at, updated_at, data_type, id')
      .eq('user_id', userId);

    if (encryptedError) {
      console.error('Error fetching encrypted data:', encryptedError);
    }

    // Compile all user data
    const userData = {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: profileData || null,
      consents: consentData || [],
      encrypted_data_summary: encryptedData || [],
      // Add additional data categories here
      export_date: new Date().toISOString(),
      format_version: '1.0'
    };

    // Process based on requested format
    if (format === 'csv') {
      // Implementation for CSV export would go here
      // For now, we'll just return JSON with a note
      return NextResponse.json({
        message: 'CSV export not yet implemented. Using JSON format.',
        data: userData
      });
    } else {
      // Default: Return JSON
      return new NextResponse(JSON.stringify(userData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="user_data_export_${userId.slice(0, 8)}.json"`
        }
      });
    }
  } catch (error) {
    console.error('Error processing data export request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
} 