import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    console.log('Testing analyze-organization API...');
    
    // Create a simple test payload
    const testPayload = {
      organizationId: 'b00816b8-b5d1-46f3-a135-ac4d52a407f2',
      organizationName: 'Contently',
      skipOpenAI: true, // Skip OpenAI call to avoid quota issues
      posts: [
        {
          title: 'Test Post 1',
          description: 'This is a test post for verification.',
          date: new Date().toISOString(),
          url: 'https://example.com/test-1',
          format: 'article'
        },
        {
          title: 'Test Post 2',
          description: 'Another test post to provide minimal test data.',
          date: new Date().toISOString(),
          url: 'https://example.com/test-2',
          format: 'article'
        }
      ]
    };
    
    console.log('Making request to analyze-organization API...');
    
    // Call our API endpoint
    const response = await fetch('http://localhost:3000/api/analyze-organization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });
    
    // Get result as JSON
    const data = await response.json();
    
    // Return the result
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data
    });
    
  } catch (error) {
    console.error('Error testing analyze-organization API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 