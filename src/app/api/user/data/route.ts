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

    // Log this access request for compliance/auditing
    await supabaseAdmin
      .from('data_access_logs')
      .insert({
        user_id: userId,
        request_type: 'data_access',
        requested_at: new Date().toISOString()
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

    // Fetch user's encryption key data (metadata only, not the actual keys)
    const { data: encryptionData, error: encryptionError } = await supabaseAdmin
      .from('user_encryption_keys')
      .select('created_at, key_id, active')
      .eq('user_id', userId);

    if (encryptionError) {
      console.error('Error fetching encryption data:', encryptionError);
    }

    // Collect any other user data tables you need to include
    // ...

    // Return compiled user data
    return NextResponse.json({
      userData: {
        profile: profileData || null,
        consents: consentData || [],
        encryptionKeys: encryptionData || [],
        // Add other data categories as needed
      },
      requestDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing data access request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
} 