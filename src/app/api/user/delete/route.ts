import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with the Admin key for server-side operations
// We use the Admin key because we need to perform operations that require elevated permissions
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

export async function POST(request: NextRequest) {
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

    // Parse request body
    const { reason, additionalInfo } = await request.json();

    // Create a deletion request record (track deletion requests for compliance/auditing)
    const { data: deletionRequest, error: insertError } = await supabaseAdmin
      .from('user_deletion_requests')
      .insert({
        user_id: userId,
        status: 'pending',
        reason: reason,
        additional_info: additionalInfo,
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create deletion request', details: insertError },
        { status: 500 }
      );
    }

    // Return success response with the deletion request details
    return NextResponse.json({
      message: 'Deletion request submitted successfully',
      requestId: deletionRequest.id,
      status: deletionRequest.status,
      estimatedCompletionTime: '30 days',
      nextSteps: 'Your request has been recorded. You will receive an email confirmation when the deletion process is complete.'
    });
  } catch (error) {
    console.error('Error processing deletion request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
} 