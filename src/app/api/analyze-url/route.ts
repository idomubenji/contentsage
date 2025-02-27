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
  
  // Helper function to extract clean text from HTML
  const extractCleanText = (element: Element): string => {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as Element;
    
    // Remove script and style elements
    const scripts = clone.querySelectorAll('script, style, noscript');
    scripts.forEach((script: Element) => script.remove());
    
    // Get text content
    return clone.textContent || '';
  };
  
  // Extract title
  let title = document.querySelector('title')?.textContent || '';
  
  // If no title, try to find the first h1
  if (!title) {
    title = document.querySelector('h1')?.textContent || '';
  }
  
  // Determine platform first (needed for date extraction)
  let platform = 'website';
  const hostname = new URL(url).hostname;
  
  // Enhanced social media platform detection
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    platform = 'X';
  } else if (hostname.includes('instagram.com')) {
    platform = 'Instagram';
  } else if (hostname.includes('facebook.com')) {
    platform = 'Facebook';
  } else if (hostname.includes('linkedin.com')) {
    platform = 'LinkedIn';
  } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    platform = 'YouTube';
  } else if (hostname.includes('tiktok.com')) {
    platform = 'TikTok';
  } else if (hostname.includes('threads.net')) {
    platform = 'Threads';
  } else if (hostname.includes('vimeo.com')) {
    platform = 'Vimeo';
  } else if (hostname.includes('pinterest.com')) {
    platform = 'Pinterest';
  } else if (hostname.includes('medium.com')) {
    platform = 'Medium';
  }
  
  console.log('==== DATE EXTRACTION ====');
  console.log('Platform:', platform);
  console.log('URL:', url);
  
  // Try to find publication date
  let postedDate = null;
  
  // Special date extraction for social media platforms
  if (platform === 'X') {
    console.log('Using X-specific date extraction methods');
    
    // Method 1: Extract from time elements
    const timeElements = document.querySelectorAll('time, [datetime]');
    console.log(`Found ${timeElements.length} time elements`);
    
    for (const timeElement of timeElements) {
      const dateAttr = timeElement.getAttribute('datetime');
      if (dateAttr) {
        console.log(`Found time element with datetime: ${dateAttr}`);
        try {
          const date = new Date(dateAttr);
          if (!isNaN(date.getTime())) {
            postedDate = date.toISOString().split('T')[0];
            console.log(`Successfully parsed date from time element: ${postedDate}`);
            break;
          }
        } catch (e) {
          console.log('Error parsing date from time element:', e);
        }
      } else {
        console.log(`Time element without datetime attribute: ${timeElement.textContent}`);
      }
    }
    
    // Method 2: Try to extract from text that looks like a date
    if (!postedDate) {
      console.log('Trying to extract date from text that looks like a date');
      const possibleDateTexts = Array.from(document.querySelectorAll('span, div, a'))
        .map(el => el.textContent?.trim())
        .filter(text => text && (
          text.match(/\d{1,2}:\d{2} [AP]M · \w+ \d{1,2}, \d{4}/i) || // "7:30 PM · Sep 4, 2023"
          text.match(/\w+ \d{1,2}, \d{4}/i) || // "September 4, 2023"
          text.match(/\d{1,2} \w+ \d{4}/i)     // "4 September 2023"
        ));
      
      console.log(`Found ${possibleDateTexts.length} text elements that might be dates`);
      
      for (const dateText of possibleDateTexts) {
        console.log(`Potential date text: "${dateText}"`);
        try {
          // Try to parse various date formats
          let dateStr = dateText || '';
          
          // Extract just the date part if it contains time
          if (dateText && dateText.includes('·')) {
            dateStr = dateText.split('·')[1].trim();
          }
          
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            postedDate = date.toISOString().split('T')[0];
            console.log(`Successfully parsed date from text: ${postedDate}`);
            break;
          }
        } catch (e) {
          console.log(`Error parsing date from text "${dateText}":`, e);
        }
      }
    }
    
    // Method 3: Try to extract from structured data
    if (!postedDate) {
      console.log('Trying to extract date from structured data');
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      console.log(`Found ${scripts.length} JSON-LD script elements`);
      
      for (const script of scripts) {
        try {
          const jsonData = JSON.parse(script.textContent || '{}');
          console.log('Found JSON-LD data:', JSON.stringify(jsonData).substring(0, 200) + '...');
          
          // Look for datePublished or dateCreated
          const dateStr = jsonData.datePublished || jsonData.dateCreated || 
                         (jsonData.mainEntity && jsonData.mainEntity.datePublished) ||
                         (jsonData.mainEntity && jsonData.mainEntity.dateCreated);
          
          if (dateStr) {
            console.log(`Found date in JSON-LD: ${dateStr}`);
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              postedDate = date.toISOString().split('T')[0];
              console.log(`Successfully parsed date from JSON-LD: ${postedDate}`);
              break;
            }
          }
        } catch (e) {
          console.log('Error parsing JSON-LD:', e);
        }
      }
    }
    
    // Method 4: Try to extract date from URL/tweet ID
    if (!postedDate && url.includes('/status/')) {
      console.log('Trying to extract date from tweet ID');
      try {
        // Twitter IDs are timestamps with custom epoch
        const tweetId = url.split('/status/')[1].split('?')[0].trim();
        console.log(`Found tweet ID: ${tweetId}`);
        
        if (/^\d+$/.test(tweetId)) {
          // Convert Twitter snowflake ID to timestamp
          // Twitter's epoch is 1288834974657 (Nov 04 2010)
          const twitterEpoch = 1288834974657;
          // Use Number instead of BigInt for compatibility with lower ES versions
          const tweetIdNum = parseInt(tweetId);
          const timestamp = Math.floor(tweetIdNum / 4194304); // Equivalent to BigInt(tweetId) >> 22n
          const milliseconds = timestamp + twitterEpoch;
          
          console.log(`Converted tweet ID to timestamp: ${milliseconds}`);
          const dateObj = new Date(milliseconds);
          
          if (!isNaN(dateObj.getTime())) {
            // Ensure we use UTC consistently to avoid timezone issues
            // Format: YYYY-MM-DD in UTC
            postedDate = dateObj.toISOString().split('T')[0];
            console.log(`Successfully derived date from tweet ID: ${postedDate}`);
            console.log(`Date object: ${dateObj.toString()}`);
            console.log(`UTC string: ${dateObj.toUTCString()}`);
            console.log(`ISO string: ${dateObj.toISOString()}`);
          }
        }
      } catch (e) {
        console.log('Error extracting date from tweet ID:', e);
      }
    }
  } else if (platform === 'Instagram' || platform === 'Facebook') {
    // Similar specialized extraction for Instagram/Facebook
    // [implementation details would go here]
    console.log('Using Instagram/Facebook date extraction methods');
  } else {
    // Standard extraction methods for other platforms
    console.log('Using standard date extraction methods');
  }
  
  // If still no date, try common meta tags for publication date
  if (!postedDate) {
    console.log('Trying common meta tags for date extraction');
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
      const elements = document.querySelectorAll(selector);
      console.log(`Checking selector "${selector}": found ${elements.length} elements`);
      
      for (const element of elements) {
        const dateValue = element.getAttribute('content') || element.getAttribute('datetime');
        if (dateValue) {
          console.log(`Found date value: ${dateValue}`);
          try {
            // Try to parse the date
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              postedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
              console.log(`Successfully parsed standard date: ${postedDate}`);
              break;
            }
          } catch (e) {
            console.log('Error parsing standard date:', e);
          }
        }
      }
      if (postedDate) break;
    }
  }
  
  // If no date found, use current date
  if (!postedDate) {
    // Ensure current date is in UTC
    postedDate = new Date().toISOString().split('T')[0];
    console.log(`No date found, using current date: ${postedDate}`);
  }
  
  console.log(`FINAL selected date: ${postedDate}`);
  console.log('==== END DATE EXTRACTION ====');
  
  // Determine format based on content and platform
  let format = 'article';
  
  // Flag to determine if we need an AI-generated title
  let needsAiTitle = false;
  
  // New flag to track if a social post contains a video
  let hasVideo = false;
  
  // New flag to track if content contains infographics
  let hasInfographic = false;
  
  // New flag to track if content contains or is a podcast
  let hasPodcast = false;
  
  // Enhanced format detection logic
  // First check for social media posts based on platform
  if (
    platform === 'X' ||
    platform === 'Instagram' ||
    platform === 'Facebook' ||
    platform === 'LinkedIn' ||
    platform === 'Threads'
  ) {
    format = 'social';
    needsAiTitle = true;
    
    // Check if this social post contains a video
    if (
      // Check for video elements
      document.querySelectorAll('video').length > 0 ||
      // Check for video iframes (YouTube, Vimeo, etc.)
      document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="player"]').length > 0 ||
      // Check for video metadata
      document.querySelector('meta[property="og:video"]') !== null ||
      document.querySelector('meta[property="twitter:card"][content="player"]') !== null ||
      // Check for X/Twitter specific video indicators
      document.querySelectorAll('[data-testid="videoPlayer"], .tweet-video-container, .PlayableMedia').length > 0 ||
      // Check for Instagram/Facebook specific video indicators
      document.querySelectorAll('.video-container, ._5tmf, ._6ltg, .xitk5, .x1lliihq').length > 0 ||
      // Check for common video classes and attributes
      document.querySelectorAll('[data-media-type="video"], [data-component="Video"], .video-js').length > 0 ||
      // Check URL for video indicators
      url.includes('/video/') || 
      url.includes('?s=20') // X/Twitter video parameter
    ) {
      hasVideo = true;
      console.log('Detected video content in social post');
    }
    
    // Check if this social post contains podcast content
    if (
      // Check for audio elements
      document.querySelectorAll('audio').length > 0 ||
      // Check for podcast embeds
      document.querySelectorAll('iframe[src*="spotify.com/embed/episode"], iframe[src*="anchor.fm"], iframe[src*="podcasts.apple.com"]').length > 0 ||
      // Check post URL
      url.includes('podcast') || 
      url.includes('episode') ||
      // Check common podcast platform domains
      hostname.includes('anchor.fm') ||
      hostname.includes('spotify.com/episode') ||
      hostname.includes('podcasts.apple.com') ||
      hostname.includes('soundcloud.com') ||
      // Check for podcast players
      document.querySelector('.podcast-player') !== null
    ) {
      hasPodcast = true;
      console.log('Detected podcast content in social post');
    }
    
    // We'll check for infographics after socialContent is defined later in the code
  }
  // Then check for video content
  else if (
    platform === 'YouTube' || 
    platform === 'TikTok' || 
    platform === 'Vimeo' ||
    document.querySelectorAll('video').length > 0 ||
    document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0 ||
    document.querySelector('meta[property="og:video"]') !== null ||
    document.querySelector('meta[property="twitter:card"][content="player"]') !== null
  ) {
    format = 'video';
    hasVideo = true; // Always true for video format
  } 
  // Check for podcast content
  else if (
    document.querySelectorAll('audio').length > 0 ||
    document.querySelectorAll('iframe[src*="spotify.com/embed/episode"], iframe[src*="anchor.fm"], iframe[src*="podcasts.apple.com"]').length > 0 ||
    url.includes('podcast') || 
    url.includes('episode') ||
    hostname.includes('anchor.fm') ||
    hostname.includes('spotify.com/episode') ||
    hostname.includes('podcasts.apple.com') ||
    hostname.includes('soundcloud.com') ||
    document.querySelector('.podcast-player') !== null ||
    title.toLowerCase().includes('podcast') ||
    title.toLowerCase().includes('episode')
  ) {
    format = 'podcast';
    hasPodcast = true; // Always true for podcast format
  } 
  // Check for infographic content
  else if (
    // Explicit infographic mentions - higher confidence indicators
    document.querySelectorAll('.infographic, [class*="infographic"], img[alt*="infographic" i]').length > 0 ||
    url.toLowerCase().includes('infographic') ||
    title.toLowerCase().includes('infographic') ||
    document.querySelector('meta[property*="image"][content*="infographic"]') !== null ||
    
    // Secondary indicators - only count if content explicitly mentions infographics
    (document.querySelector('article, .post, .entry, .content') && 
     document.querySelector('article, .post, .entry, .content')?.textContent?.toLowerCase().includes('infographic') &&
     (
       // Look for data visualization elements with explicit infographic mention in content
       document.querySelectorAll('.data-viz, [class*="dataviz"], [class*="chart"], [class*="graph"], .visualization').length > 0 ||
       // Pinterest often contains infographics, but only mark as infographic if explicitly mentioned
       platform === 'Pinterest' ||
       // Check for SVG graphs within content that mentions infographics
       document.querySelectorAll('svg').length > 0 ||
       // Tall/narrow images only if content explicitly mentions infographics
       document.querySelectorAll('img[width][height]').length > 0 && Array.from(document.querySelectorAll('img[width][height]')).some(img => {
         const w = parseInt(img.getAttribute('width') || '0');
         const h = parseInt(img.getAttribute('height') || '0');
         return w > 0 && h > 0 && h > w * 2; // Stricter ratio: height more than double the width
       })
     )
    )
  ) {
    format = 'infographic';
    hasInfographic = true; // Always true for infographic format
  } 
  // Check for gallery or slideshow
  else if (
    document.querySelectorAll('.gallery, .slideshow, [class*="carousel"], [class*="slider"]').length > 0
  ) {
    format = 'gallery';
  } 
  // Check for PDF
  else if (
    url.toLowerCase().endsWith('.pdf') || 
    url.toLowerCase().includes('/pdf/') ||
    url.includes('viewdoc')
  ) {
    format = 'pdf';
  }
  
  // Get main content for OpenAI processing
  const articleContent = document.querySelector('article')?.textContent || document.body.textContent || '';
  const truncatedContent = articleContent.slice(0, 5000); // Limit content length
  
  // For social media posts, flag them as needing AI-generated titles
  if (format === 'social') {
    // For social posts, we'll use AI to generate a better title
    // We either don't have a meaningful title or the title is too generic
    needsAiTitle = true;
    
    console.log('==== SOCIAL POST CONTENT EXTRACTION ====');
    console.log('Platform:', platform);
    console.log('URL:', url);
    console.log('Original title:', title);
    console.log('Has video:', hasVideo);
    
    // For social posts, try to extract the post content directly
    // This gives the AI better context for generating a title
    let socialContent = '';
    
    try {
      if (platform === 'X') {
        console.log('Attempting to extract X (Twitter) post content...');
        // Print the entire document structure for debugging
        console.log('Document HTML structure (partial):', html.substring(0, 1000) + '...');
        
        // Extract tweet content with expanded selectors
        const possibleTweetSelectors = [
          '[data-testid="tweetText"]', 
          '.tweet-text',
          '.TweetTextSize',
          'article [lang]',
          'div[lang][dir="auto"]',
          '.css-901oao',
          '[data-testid="tweet"] div[dir="auto"]',
          'article div[dir="auto"]'
        ];
        
        console.log('Trying X selectors:');
        // Try each selector until we find content
        for (const selector of possibleTweetSelectors) {
          console.log(`  Trying selector: ${selector}`);
          const elements = document.querySelectorAll(selector);
          console.log(`  Found ${elements.length} elements with selector ${selector}`);
          
          for (const element of elements) {
            const text = extractCleanText(element);
            console.log(`  Element text (${text.length} chars): ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
            
            if (text.trim().length > 10) { // Only use if it has meaningful content
              socialContent = text;
              console.log(`  Found X content using selector: ${selector}`);
              console.log(`  FULL CONTENT: ${text}`);
              break;
            }
          }
          if (socialContent) break;
        }
        
        // If we can't find content with selectors, try to extract main text content
        if (!socialContent) {
          console.log('No content found with specific selectors, trying fallback methods...');
          
          // Try getting content from a direct meta tag or structured data first
          const metaDescription = document.querySelector('meta[name="description"], meta[property="og:description"]');
          if (metaDescription) {
            const content = metaDescription.getAttribute('content');
            if (content && content.length > 20) {
              socialContent = content;
              console.log('Extracted X content from meta description:');
              console.log(socialContent);
            }
          }
          
          // If no metadata, try to find the tweet in structured JSON data
          if (!socialContent) {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
              try {
                const jsonData = JSON.parse(script.textContent || '{}');
                // Look for articleBody or text fields in the JSON
                const tweetText = jsonData.articleBody || 
                                 (jsonData.mainEntity && jsonData.mainEntity.text) ||
                                 (jsonData.mainEntityOfPage && jsonData.mainEntityOfPage.text);
                
                if (tweetText && tweetText.length > 10) {
                  socialContent = tweetText;
                  console.log('Extracted X content from structured JSON data:');
                  console.log(socialContent);
                  break;
                }
              } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown parsing error';
                console.log('Error parsing JSON data:', errorMessage);
              }
            }
          }
          
          // Try getting article elements
          if (!socialContent) {
            const articles = document.querySelectorAll('article');
            console.log(`Found ${articles.length} article elements`);
            
            if (articles.length > 0) {
              // Use the shortest article that has meaningful content (often the main tweet)
              // Rather than just the first article
              let shortestLength = Infinity;
              let bestArticleText = '';
              
              for (const article of articles) {
                const text = extractCleanText(article);
                console.log(`Article text length: ${text.length}, preview: ${text.substring(0, 50)}...`);
                
                if (text.trim().length > 20 && text.length < shortestLength) {
                  shortestLength = text.length;
                  bestArticleText = text;
                }
              }
              
              if (bestArticleText) {
                socialContent = bestArticleText;
                console.log('Extracted X content from the shortest meaningful article element');
                console.log(`FULL CONTENT: ${socialContent}`);
              }
            }
          }
          
          // If still no content, try getting main element or body
          if (!socialContent) {
            const mainElement = document.querySelector('main');
            if (mainElement) {
              socialContent = extractCleanText(mainElement);
              console.log('Extracted X content from main element');
              console.log(`CONTENT PREVIEW: ${socialContent.substring(0, 100)}...`);
            } else {
              // Last resort: Try a very targeted extraction
              const tweetContainer = document.querySelector('[data-testid="tweet"]') || 
                                    document.querySelector('[data-testid="tweetDetail"]');
              
              if (tweetContainer) {
                socialContent = extractCleanText(tweetContainer);
                console.log('Extracted content from tweet container');
                console.log(`CONTENT PREVIEW: ${socialContent.substring(0, 100)}...`);
              } else {
                // Absolute last resort
                socialContent = extractCleanText(document.body);
                console.log('Extracted X content from body (last resort)');
                console.log(`CONTENT PREVIEW: ${socialContent.substring(0, 100)}...`);
              }
            }
          }
        }
        
        // Additional processing for X posts - clean up the content
        if (socialContent) {
          // Remove common UI elements text and noise from Twitter
          socialContent = socialContent
            .replace(/(?:^|\s)@(\w+)/g, ' @$1') // Normalize mentions
            .replace(/(?:^|\s)#(\w+)/g, ' #$1') // Normalize hashtags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\b(Like|Retweet|Reply|Share|Copy link to Tweet)\b/gi, '') // Remove UI actions
            .replace(/\b(Likes|Retweets|Replies|Views)\b/gi, '') // Remove metrics
            .replace(/\b\d+ (likes|replies|retweets|views)\b/gi, '') // Remove count phrases
            .replace(/https?:\/\/t\.co\/\w+/g, '') // Remove t.co links
            .trim();
          
          console.log('Cleaned X content:');
          console.log(socialContent);
        }
      } else if (platform === 'Instagram' || platform === 'Facebook') {
        // Extract post caption/content with expanded selectors
        const possibleCaptionSelectors = [
          '.caption', 
          '[data-testid="post-content"]',
          '.userContent',
          '.fbPhotosPhotoCaption',
          '._5rgt',
          '.xdj266r',
          '._a9zs'
        ];
        
        for (const selector of possibleCaptionSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent || '';
            if (text.trim().length > 5) {
              socialContent = text;
              console.log(`Found ${platform} content using selector: ${selector}`);
              break;
            }
          }
          if (socialContent) break;
        }
      } else if (platform === 'LinkedIn') {
        // Extract LinkedIn post content with expanded selectors
        const possibleLinkedInSelectors = [
          '.feed-shared-update-v2__description',
          '.feed-shared-text',
          '.update-components-text',
          '.share-update-card__update-text',
          '.share-body'
        ];
        
        for (const selector of possibleLinkedInSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent || '';
            if (text.trim().length > 5) {
              socialContent = text;
              console.log(`Found LinkedIn content using selector: ${selector}`);
              break;
            }
          }
          if (socialContent) break;
        }
      }
      
      console.log(`FINAL Extracted ${platform} content:`, socialContent ? socialContent : 'None found');
      console.log('==== END CONTENT EXTRACTION ====');
    } catch (error) {
      console.error(`Error extracting social content for ${platform}:`, error);
    }
    
    // Now check for infographics in social posts after we have socialContent
    if (
      // Explicit infographic mentions - high confidence indicators
      document.querySelectorAll('.infographic, [class*="infographic"], img[alt*="infographic" i]').length > 0 ||
      
      // Only consider these indicators if content explicitly mentions infographics
      (socialContent && socialContent.toLowerCase().includes('infographic') && 
       (
         // Look for data visualization elements
         document.querySelectorAll('.data-viz, [class*="dataviz"], [class*="chart"], [class*="graph"], .visualization').length > 0 ||
         // Look for SVG elements (common in infographics)
         document.querySelectorAll('svg[width][height]').length > 0 && Array.from(document.querySelectorAll('svg[width][height]')).some(svg => {
           const w = parseInt(svg.getAttribute('width') || '0');
           const h = parseInt(svg.getAttribute('height') || '0');
           return w > 100 && h > 100; // Meaningful size for a visualization
         }) ||
         // Check for Pinterest content
         platform === 'Pinterest'
       )
      ) ||
      
      // Check post content for very explicit infographic indicators
      (socialContent && (
        // Direct mention of infographic
        socialContent.toLowerCase().includes('infographic') &&
        // Must also be paired with relevant terms
        (socialContent.toLowerCase().includes('visual') || 
         socialContent.toLowerCase().includes('data visualization') ||
         socialContent.toLowerCase().includes('chart') ||
         socialContent.toLowerCase().includes('graph'))
      ))
    ) {
      hasInfographic = true;
      console.log('Detected infographic content in social post');
    }
    
    // Check for podcast mentions in social media post content
    if (!hasPodcast && socialContent) {
      if (
        socialContent.toLowerCase().includes('podcast') ||
        socialContent.toLowerCase().includes('episode') ||
        socialContent.toLowerCase().includes('listen to') ||
        socialContent.toLowerCase().includes('new episode') ||
        socialContent.toLowerCase().includes('spotify.com/episode') ||
        socialContent.toLowerCase().includes('apple.co/podcast') ||
        socialContent.toLowerCase().includes('anchor.fm')
      ) {
        hasPodcast = true;
        console.log('Detected podcast mention in social post content');
      }
    }
    
    // If we successfully extracted specific social content, use it instead
    if (socialContent.trim()) {
      return {
        title,
        postedDate,
        format,
        platform,
        content: socialContent.trim(),
        needsAiTitle,
        hasVideo,
        hasInfographic,
        hasPodcast
      };
    }
  }
  
  return {
    title,
    postedDate,
    format,
    platform,
    content: truncatedContent,
    needsAiTitle,
    hasVideo,
    hasInfographic,
    hasPodcast
  };
}

// Function to generate title using OpenAI
async function generateTitle(content: string, platform: string) {
  try {
    console.log('==== GENERATING TITLE ====');
    console.log('Platform:', platform);
    console.log('Content for title generation:', content);
    
    const prompt = `
      Generate a concise, catchy title (1-9 words) for this ${platform} post.
      The title should accurately represent the post's main point or message.
      Don't use hashtags or @mentions in the title.
      Don't use quotes around the title.
      
      Original ${platform} post content: 
      ${content.slice(0, 1000)}
      
      Title:
    `;
    
    console.log('Using prompt for title generation:', prompt);
    
    const response = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt,
      max_tokens: 30,
      temperature: 0.7
    });
    
    let generatedTitle = response.choices[0].text.trim();
    
    // Remove any quotation marks, hashtags, or unnecessary prefixes that might have been added
    generatedTitle = generatedTitle
      .replace(/["']/g, '')
      .replace(/^title:?\s*/i, '')
      .replace(/^["']|["']$/g, '')
      .replace(/#\w+/g, '')
      .trim();
    
    console.log('Generated title:', generatedTitle);
    console.log('==== END TITLE GENERATION ====');
    
    return generatedTitle;
  } catch (error) {
    console.error('Error generating title with OpenAI:', error);
    return `Post from ${platform}`;
  }
}

// Function to get description using OpenAI
async function generateDescription(title: string, content: string, format: string = 'article', platform: string = 'website') {
  try {
    console.log('==== GENERATING DESCRIPTION ====');
    console.log('Title:', title);
    console.log('Format:', format);
    console.log('Platform:', platform);
    console.log('Content preview for description:', content.substring(0, 100) + '...');
    
    let prompt;
    
    if (format === 'social') {
      // Special prompt for social media posts
      prompt = `
        Write a brief description (40-60 words) summarizing this ${platform} post.
        Focus on the key points or message of the post.
        Keep it factual and concise.
        
        Post title: ${title}
        
        Post content: ${content.slice(0, 2000)}
        
        Description:
      `;
    } else {
      // Original prompt for articles and other content
      prompt = `
        Please write a concise description (max 150 words) for this content based on the following information:
        
        Title: ${title}
        
        Content: ${content.slice(0, 3000)}
        
        Keep the description factual and informative. Focus on the main points and avoid subjective opinions.
      `;
    }
    
    console.log('Using prompt for description generation:', prompt);
    
    const response = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt,
      max_tokens: format === 'social' ? 100 : 250,
      temperature: format === 'social' ? 0.5 : 0.3
    });
    
    const description = response.choices[0].text.trim()
      .replace(/^description:?\s*/i, '')  // Remove any "Description:" prefix
      .replace(/^["']|["']$/g, '');       // Remove surrounding quotes
    
    console.log('Generated description:', description);
    console.log('==== END DESCRIPTION GENERATION ====');
    
    return description;
  } catch (error) {
    console.error('Error generating description with OpenAI:', error);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const { url, userId, organizationId, replace } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log('Processing URL:', url);
    
    // Fetch content from URL
    const htmlContent = await fetchUrlContent(url);
    
    // Extract information
    const extractedInfo = extractInfoFromHtml(htmlContent, url);
    const { title: extractedTitle, postedDate, format, platform, content, needsAiTitle, hasVideo, hasInfographic, hasPodcast } = extractedInfo;
    
    console.log('Detected format:', format);
    console.log('Detected platform:', platform);
    console.log('Needs AI title:', needsAiTitle);
    console.log('Has video:', hasVideo);
    console.log('Has infographic:', hasInfographic);
    console.log('Has podcast:', hasPodcast);
    console.log('Post date before database insertion:', postedDate);
    
    // Generate title for social posts if needed
    let title = extractedTitle;
    if (needsAiTitle) {
      console.log('Generating AI title for social post');
      title = await generateTitle(content, platform);
      console.log('Generated title:', title);
    }
    
    // Generate description using OpenAI
    const description = await generateDescription(title, content, format, platform);
    
    // Create post entry in database with optional organization_id
    const postData = {
      url,
      title,
      description,
      posted_date: postedDate, // This is the ISO string YYYY-MM-DD in UTC
      format,
      status: 'POSTED',
      platform,
      user_id: userId,
      // Only include organization_id if it was provided
      ...(organizationId && { organization_id: organizationId }),
      has_video: hasVideo || false, // Store the hasVideo flag in the database
      has_infographic: hasInfographic || false, // Store the hasInfographic flag in the database
      has_podcast: hasPodcast || false // Store the hasPodcast flag in the database
    };
    
    console.log('Final post data before database insertion:');
    console.log('Title:', postData.title);
    console.log('Date:', postData.posted_date);
    console.log('Format:', postData.format);
    console.log('Platform:', postData.platform);
    console.log('Has video:', postData.has_video);
    console.log('Has infographic:', postData.has_infographic);
    console.log('Has podcast:', postData.has_podcast);
    
    // Check if we should replace existing post
    if (replace) {
      // ... existing replace logic ...
    }
    
    // Create post entry in database
    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert([postData])
      .select();
    
    if (error) {
      console.error('Error inserting post into database:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log('Post inserted successfully, returned data:', data[0]);
    
    return NextResponse.json({ success: true, post: data[0] });
  } catch (error: any) {
    console.error('Error processing URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 