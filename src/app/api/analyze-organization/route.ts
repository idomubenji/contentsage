import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create a Supabase client with the service role key for admin access
// This ensures we can bypass RLS while maintaining security
const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or service role key');
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { organizationId, organizationName, posts, skipOpenAI } = body;

    console.log('=== ANALYZE ORGANIZATION DEBUG START ===');
    console.log('analyze-organization API called with:', { 
      organizationId, 
      organizationName,
      postsCount: posts?.length || 0,
      skipOpenAI: !!skipOpenAI
    });
    
    // Get the server-side supabase client with admin privileges
    // This allows us to read/write to the database securely
    const supabaseAdmin = createServerSupabaseClient();
    console.log('Created server-side Supabase client with admin privileges');
    
    // DEBUG: Check if organizationId is properly formatted (if provided)
    if (organizationId) {
      console.log(`organizationId type: ${typeof organizationId}, value: ${organizationId}`);
      // If it's a string that contains only numbers, it might need conversion to a number
      if (typeof organizationId === 'string' && /^\d+$/.test(organizationId)) {
        console.log(`organizationId appears to be a numeric string. Consider if it needs conversion.`);
      }
    }

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Posts array is required.' },
        { status: 400 }
      );
    }

    if (!organizationId && !organizationName) {
      return NextResponse.json(
        { error: 'Invalid request. Either organization ID or name is required.' },
        { status: 400 }
      );
    }

    // Add more detailed logging before organization lookup
    console.log(`Looking up organization with ${organizationName ? 'name: ' + organizationName : 'ID: ' + organizationId}`);
    
    // DEBUG: Check database connection and configuration
    console.log('Checking if database connection is working...');
    
    // Verify we can access the organizations table
    const { data: orgsCheck, error: orgsCheckError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .limit(5);
      
    // Log results of this check with more details
    console.log('Organizations table check results:', { 
      hasData: !!orgsCheck && orgsCheck.length > 0,
      count: orgsCheck?.length || 0,
      error: orgsCheckError ? orgsCheckError.message : null,
      firstFewOrgs: orgsCheck?.slice(0, 3).map(o => ({ id: o.id, name: o.name }))
    });
    
    if (orgsCheckError) {
      console.error('Error accessing organizations table:', orgsCheckError);
      return NextResponse.json(
        { error: 'Database access error', details: orgsCheckError.message },
        { status: 500 }
      );
    }

    // Try to find the organization - first by name if provided, then by ID
    let organization = null;
    
    // If name is provided, search by name
    if (organizationName) {
      console.log(`Searching for organization by name: "${organizationName}"`);
      const searchTerm = `%${organizationName}%`;
      console.log(`Using ILIKE search with pattern: "${searchTerm}"`);
      
      const { data: nameResults, error: nameError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .ilike('name', searchTerm)
        .limit(5);
        
      if (nameError) {
        console.error('Error searching organization by name:', nameError);
      } else {
        console.log(`Name search returned ${nameResults?.length || 0} results:`, 
          nameResults?.map(o => ({ id: o.id, name: o.name })));
        
        if (nameResults && nameResults.length > 0) {
          organization = nameResults[0];
          console.log(`Found organization by name: ${organization.name} (${organization.id})`);
        } else {
          console.log(`No organization found with name containing: "${organizationName}"`);
          
          // DEBUG: Try an exact match search instead of ILIKE
          console.log(`Trying exact match search for name: "${organizationName}"`);
          const { data: exactResults, error: exactError } = await supabaseAdmin
            .from('organizations')
            .select('id, name')
            .eq('name', organizationName)
            .limit(5);
            
          if (exactError) {
            console.error('Error with exact name search:', exactError);
          } else {
            console.log(`Exact name search returned ${exactResults?.length || 0} results:`, 
              exactResults?.map(o => ({ id: o.id, name: o.name })));
            
            if (exactResults && exactResults.length > 0) {
              organization = exactResults[0];
              console.log(`Found organization by exact name: ${organization.name} (${organization.id})`);
            }
          }
        }
      }
    }
    
    // If we didn't find by name or only ID was provided, try by ID
    if (!organization && organizationId) {
      console.log(`Searching for organization by ID: ${organizationId}`);
      
      // DEBUG: Try both string and number types for ID search
      const idValue = organizationId;
      console.log(`Using ID value (original): ${idValue}, type: ${typeof idValue}`);
      
      const { data: idResult, error: idError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .eq('id', idValue)
        .maybeSingle();  // Using maybeSingle instead of single to avoid errors
        
      if (idError) {
        console.log('Error finding organization by ID:', {
          code: idError.code,
          message: idError.message,
          details: idError.details
        });
        
        // DEBUG: If the ID might be a number but was passed as string, try the alternative
        if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
          const numericId = parseInt(idValue, 10);
          console.log(`Trying numeric conversion of ID: ${numericId}`);
          
          const { data: numIdResult, error: numIdError } = await supabaseAdmin
            .from('organizations')
            .select('id, name')
            .eq('id', numericId)
            .maybeSingle();
            
          if (numIdError) {
            console.log('Error finding organization by numeric ID:', {
              code: numIdError.code,
              message: numIdError.message,
              details: numIdError.details
            });
          } else if (numIdResult) {
            organization = numIdResult;
            console.log(`Found organization by numeric ID: ${organization.name} (${organization.id})`);
          }
        }
      } else if (idResult) {
        organization = idResult;
        console.log(`Found organization by ID: ${organization.name} (${organization.id})`);
      } else {
        console.log(`No organization found with ID: ${idValue}`);
      }
    }
    
    // DEBUG: As a last resort, try listing all organizations to see what's actually there
    if (!organization) {
      console.log('No organization found through ID or name searches. Checking full organizations table...');
      const { data: allOrgs, error: allOrgsError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .limit(10);
        
      if (allOrgsError) {
        console.error('Error fetching all organizations:', allOrgsError);
      } else {
        console.log(`Found ${allOrgs?.length || 0} organizations in the database:`, 
          allOrgs?.map(o => ({ id: o.id, name: o.name })));
      }
    }
    
    // If still not found, try creating a temporary organization object for analysis
    if (!organization && organizationName) {
      console.log(`Creating temporary organization with name: ${organizationName}`);
      organization = {
        id: 'temp-' + Date.now(),
        name: organizationName
      };
    }
    
    // Final check if we have an organization to analyze
    if (!organization) {
      console.log('=== ANALYZE ORGANIZATION DEBUG END (Organization not found) ===');
      return NextResponse.json(
        { error: 'Organization not found', details: 'Could not find organization by provided ID or name' },
        { status: 404 }
      );
    }

    console.log(`Organization found: ${organization.name} (${organization.id})`);

    // If skipOpenAI flag is set, return early with success
    if (skipOpenAI) {
      console.log('Skipping OpenAI analysis as requested');
      console.log('=== ANALYZE ORGANIZATION DEBUG END (Success - OpenAI Skipped) ===');
      return NextResponse.json({
        success: true,
        organization,
        message: 'Organization found successfully. OpenAI analysis skipped.'
      });
    }

    // Prepare the content for OpenAI analysis
    console.log(`Preparing analysis for organization: ${organization.name}`);
    const postSummaries = posts.map((post: any, index: number) => 
      `Post ${index + 1}:
      Title: ${post.title || 'Untitled'}
      Description: ${post.description || 'No description'}
      Date: ${post.date || 'Unknown date'}
      URL: ${post.url || 'No URL'}
      Format: ${post.format || 'Unknown format'}`
    ).join('\n\n');

    // Create the prompt for OpenAI
    const prompt = `
      Analyze the following posts from an organization named "${organization.name}". 
      These posts represent the organization's content and communications.
      
      ${postSummaries}
      
      Based on these posts, provide the following analysis:
      1. What industry does this organization likely operate in?
      2. Write a concise description of the organization based on their content.
      3. What appears to be their content strategy or focus?
      4. What is the general tone of their communications?
      
      Format your response as a JSON object with the following structure:
      {
        "industry": "The industry classification",
        "description": "A concise description of the organization",
        "strategy": "Their apparent content strategy or focus",
        "tone": "The general tone of their communications"
      }
      
      Provide only the JSON object in your response, with no additional text.
    `;

    // Call OpenAI API
    console.log('Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Use an appropriate model
      messages: [
        { role: "system", content: "You are an expert content and business analyst. Analyze the provided posts and extract insights about the organization." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the OpenAI response
    const analysisText = completion.choices[0]?.message?.content || '{}';
    console.log('Received OpenAI response');
    let analysis;
    
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.log('Raw response:', analysisText);
      
      // Attempt to extract JSON if the response contains additional text
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch (secondParseError) {
          console.error('Second attempt to parse JSON failed:', secondParseError);
          analysis = {
            industry: "Could not determine",
            description: "Analysis failed to parse response",
            strategy: "Unknown",
            tone: "Unknown"
          };
        }
      } else {
        analysis = {
          industry: "Could not determine",
          description: "Analysis failed to parse response",
          strategy: "Unknown",
          tone: "Unknown"
        };
      }
    }

    // Update the organization's info field in the database if it's a real organization
    if (organization.id && !organization.id.startsWith('temp-')) {
      console.log('Updating organization info in database...');
      const { error: updateError } = await supabaseAdmin
        .from('organizations')
        .update({
          info: analysis,
          updated_at: new Date().toISOString()
        })
        .eq('id', organization.id);

      if (updateError) {
        console.error('Error updating organization info:', updateError);
        return NextResponse.json(
          { error: 'Failed to update organization info', details: updateError.message },
          { status: 500 }
        );
      }
    } else {
      console.log('Skipping database update for temporary organization');
    }

    console.log('=== ANALYZE ORGANIZATION DEBUG END (Success) ===');
    // Return the analysis
    return NextResponse.json({
      success: true,
      analysis,
      message: 'Organization analysis completed successfully'
    });

  } catch (error) {
    console.error('Error in analyze-organization API:', error);
    console.log('=== ANALYZE ORGANIZATION DEBUG END (Error) ===');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 