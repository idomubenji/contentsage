import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { post, organizationId } = body;

    console.log('==== POST REGENERATION API ====');
    console.log(`Request received to regenerate post: ${post.title}`);
    console.log(`Organization ID: ${organizationId}`);

    if (!post) {
      return NextResponse.json({ 
        error: 'Post data is required' 
      }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ 
        error: 'Organization ID is required' 
      }, { status: 400 });
    }

    // Fetch organization info for context
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('name, preferences, info')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('Organization lookup error:', orgError);
      return NextResponse.json({ 
        error: `Organization lookup failed: ${orgError.message}` 
      }, { status: 500 });
    }
    
    if (!orgData) {
      console.error('Organization not found:', organizationId);
      return NextResponse.json({ 
        error: 'Organization not found' 
      }, { status: 404 });
    }

    // Extract organization context
    const orgIntent = orgData.info?.description || '';
    const orgStrategy = orgData.info?.strategy || '';
    const orgVoice = orgData.info?.voice || '';
    const orgKeywords = orgData.info?.keywords || [];
    const orgSeoStrategy = orgData.info?.seoStrategy || '';
    const contentTone = orgData.preferences?.contentTone || 'professional';
    const industry = orgData.preferences?.industry || 'technology';

    // Create organization context
    let organizationContext = '';
    if (orgData.info && Object.keys(orgData.info).length > 0) {
      organizationContext = `
      ORGANIZATION CONTEXT:
      ${orgIntent ? `Description: ${orgIntent}` : ''}
      ${orgStrategy ? `Content Strategy: ${orgStrategy}` : ''}
      ${orgVoice ? `Brand Voice: ${orgVoice}` : ''}
      ${orgKeywords.length > 0 ? `Target Keywords: ${orgKeywords.join(', ')}` : ''}
      ${orgSeoStrategy ? `SEO Strategy: ${orgSeoStrategy}` : ''}
      
      Ensure the content aligns with the organization's intent, strategy, brand voice and SEO strategy.
      `;
    }

    // Determine if this is a Web post or social media post
    const platformType = post.platform === 'Web' ? 'article' : 'social post';
    
    // Create prompt for regenerating content
    const prompt = `
      Regenerate better quality content for this ${platformType}:
      
      Platform: ${post.platform}
      Current Title: ${post.title}
      Current Description: ${post.description || 'None provided'}
      ${post.format ? `Format: ${post.format}` : ''}
      
      Industry: ${industry}
      Content tone: ${contentTone}
      
      ${organizationContext}
      
      INSTRUCTIONS:
      1. Create a more engaging, specific title
      2. Write a compelling, detailed description appropriate for the platform
      3. For Web content: Include SEO analysis and recommendations
      4. For social media: Include hashtag suggestions if appropriate
      
      FORMAT REQUIREMENTS:
      Return a valid JSON object with the following structure:
      {
        "title": "New engaging title",
        "description": "New compelling description",
        "seo_info": {
          "reasonsData": {
            "reasons": ["SEO reason 1", "SEO reason 2", "SEO reason 3"],
            "aiConfidence": 0.85
          }
        },
        "hashtags": ["#tag1", "#tag2"]
      }
    `;
    
    console.log('Sending regeneration request to OpenAI...');
    
    // Call OpenAI to regenerate content
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system", 
          content: "You are a content creation expert who specializes in creating engaging, platform-specific content. Always return valid JSON."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.7,
    });
    
    // Parse the response
    const content = response.choices[0].message.content;
    let regeneratedContent;
    
    try {
      regeneratedContent = JSON.parse(content || '{}');
      console.log('Successfully parsed regenerated content');
    } catch (parseError) {
      console.error('Failed to parse regenerated content as JSON:', parseError);
      console.log('Raw response:', content);
      
      return NextResponse.json({ 
        error: 'Failed to parse AI response' 
      }, { status: 500 });
    }
    
    // Prepare the final regenerated post
    const regeneratedPost = {
      ...post,
      title: regeneratedContent.title || post.title,
      description: regeneratedContent.description || post.description,
      seo_info: regeneratedContent.seo_info || post.seo_info,
      // For social media posts, add hashtags to description if they exist and aren't already there
      ...(post.platform !== 'Web' && regeneratedContent.hashtags && 
          regeneratedContent.hashtags.length > 0 && {
            description: regeneratedContent.description + 
              (regeneratedContent.description.includes('#') ? '' : 
                '\n\n' + regeneratedContent.hashtags.join(' '))
          })
    };
    
    console.log('Successfully regenerated post content');
    console.log('Old title:', post.title);
    console.log('New title:', regeneratedPost.title);
    
    return NextResponse.json({ 
      success: true, 
      regeneratedPost
    });
    
  } catch (error) {
    console.error('Error in post regeneration API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 