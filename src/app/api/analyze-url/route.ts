import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { JSDOM } from 'jsdom';
import { parse } from 'date-fns';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Function to fetch URL content
async function fetchUrlContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ContentSage Bot/1.0 (https://contentsage.app)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    return content;
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw error;
  }
}

// Function to extract information from HTML content
function extractInfoFromHtml(html: string, url: string) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Extract title
  let title = document.querySelector('title')?.textContent || '';
  
  // If no title, try to find the first h1
  if (!title) {
    title = document.querySelector('h1')?.textContent || '';
  }
  
  // Try to find publication date
  let postedDate = null;
  
  // Common meta tags for publication date
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="publication_date"]',
    'meta[name="date"]',
    'meta[name="DC.date.issued"]',
    'time[datetime]',
    'meta[property="og:published_time"]',
    'meta[itemprop="datePublished"]'
  ];
  
  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const dateValue = element.getAttribute('content') || element.getAttribute('datetime');
      if (dateValue) {
        try {
          // Try to parse the date
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            postedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            break;
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }
    }
  }
  
  // If no date found, use current date
  if (!postedDate) {
    postedDate = new Date().toISOString().split('T')[0];
  }
  
  // Determine platform
  let platform = 'website';
  const hostname = new URL(url).hostname;
  
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    platform = 'X';
  } else if (hostname.includes('instagram.com')) {
    platform = 'Instagram';
  } else if (hostname.includes('facebook.com')) {
    platform = 'Facebook';
  } else if (hostname.includes('linkedin.com')) {
    platform = 'LinkedIn';
  } else if (hostname.includes('youtube.com')) {
    platform = 'YouTube';
  } else if (hostname.includes('tiktok.com')) {
    platform = 'TikTok';
  }
  
  // Determine format based on content
  let format = 'article';
  
  if (document.querySelectorAll('video').length > 0) {
    format = 'video';
  } else if (document.querySelectorAll('audio').length > 0) {
    format = 'podcast';
  } else if (document.querySelectorAll('.gallery, .slideshow').length > 0) {
    format = 'gallery';
  } else if (url.includes('pdf')) {
    format = 'pdf';
  }
  
  // Get main content for OpenAI processing
  const articleContent = document.querySelector('article')?.textContent || document.body.textContent || '';
  const truncatedContent = articleContent.slice(0, 5000); // Limit content length
  
  return {
    title,
    postedDate,
    format,
    platform,
    content: truncatedContent
  };
}

// Function to get description using OpenAI
async function generateDescription(title: string, content: string) {
  try {
    const prompt = `
      Please write a concise description (max 150 words) for a blog post based on the following information:
      
      Title: ${title}
      
      Content: ${content.slice(0, 3000)}
      
      Keep the description factual and informative. Focus on the main points and avoid subjective opinions.
    `;
    
    const response = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt,
      max_tokens: 250,
      temperature: 0.3
    });
    
    return response.choices[0].text.trim();
  } catch (error) {
    console.error('Error generating description with OpenAI:', error);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const { url, userId, organizationId } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Fetch content from URL
    const htmlContent = await fetchUrlContent(url);
    
    // Extract information
    const { title, postedDate, format, platform, content } = extractInfoFromHtml(htmlContent, url);
    
    // Generate description using OpenAI
    const description = await generateDescription(title, content);
    
    // Create post entry in database with optional organization_id
    const postData = {
      url,
      title,
      description,
      posted_date: postedDate,
      format,
      status: 'POSTED',
      platform,
      user_id: userId,
      // Only include organization_id if it was provided
      ...(organizationId && { organization_id: organizationId })
    };
    
    // Create post entry in database
    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert([postData])
      .select();
    
    if (error) {
      console.error('Error inserting post into database:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, post: data[0] });
  } catch (error: any) {
    console.error('Error processing URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 