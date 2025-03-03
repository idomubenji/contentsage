// @ts-ignore - Fix import errors temporarily while module structure is being fixed
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

import { ChainParams, FinalPost, ChainState } from './types';
import { executePostGenerationChain } from './chain-controller';
import { updateChainProgress, getChainProgress } from './progress-store';

// Re-export for use in other API routes
export { getChainProgress };

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to update the chain state with final posts results
const updateChainWithResults = (chainId: string, posts: FinalPost[]) => {
  const existingState = getChainProgress(chainId);
  if (existingState) {
    updateChainProgress(chainId, {
      ...existingState,
      isGenerating: false,
      step: 'complete',
      progress: 100,
      partialResults: {
        ...existingState.partialResults,
        finalPosts: posts
      }
    });
  }
};

export async function POST(request: NextRequest) {
  let chainId = '';
  try {
    // Generate a unique chain ID - this MUST be used for both the SSE connection and the chain execution
    chainId = Date.now().toString();
    
    // Parse request body
    const body = await request.json();
    const { 
      timeFrame, 
      currentDate, 
      platformSettings, 
      customPrompt, 
      organizationId,
      clientChainId  // Get the chainId from the client if provided
    } = body;

    // Use the client's chainId if provided (for SSE connections that are already established)
    if (clientChainId) {
      chainId = clientChainId;
      console.log(`Using client-provided chainId: ${chainId}`);
    }
    
    console.log('==== POST GENERATION CHAIN API ====');
    console.log(`Request received for timeFrame: ${timeFrame}, organization: ${organizationId}, chainId: ${chainId}`);
    console.log(`Client-provided currentDate: ${currentDate} (type: ${typeof currentDate})`);
    
    // Validate input
    if (!timeFrame || !currentDate || !platformSettings || !organizationId) {
      const missingParams = [];
      if (!timeFrame) missingParams.push('timeFrame');
      if (!currentDate) missingParams.push('currentDate');
      if (!platformSettings) missingParams.push('platformSettings');
      if (!organizationId) missingParams.push('organizationId');
      
      console.error('Missing required parameters:', missingParams.join(', '));
      return NextResponse.json(
        { error: `Missing required parameters: ${missingParams.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate currentDate format
    let validatedDate: Date;
    try {
      validatedDate = new Date(currentDate);
      
      // Check if the date is valid
      if (isNaN(validatedDate.getTime())) {
        console.error(`Invalid date format provided: ${currentDate}`);
        return NextResponse.json(
          { error: `Invalid date format for currentDate: ${currentDate}` },
          { status: 400 }
        );
      }
      
      // Log the parsed date for verification
      const parsedMonth = validatedDate.getMonth() + 1; // +1 because getMonth is 0-indexed
      const parsedYear = validatedDate.getFullYear();
      const parsedDay = validatedDate.getDate();
      console.log(`Parsed date: ${parsedYear}-${parsedMonth}-${parsedDay}`);
      
      // Check if the date is reasonable (not too far in the past or future)
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const threeYearsFromNow = new Date(now);
      threeYearsFromNow.setFullYear(now.getFullYear() + 3);
      
      if (validatedDate < oneYearAgo || validatedDate > threeYearsFromNow) {
        console.warn(`Date outside of reasonable range: ${currentDate}. Allowing but logging warning.`);
      }
    } catch (dateError) {
      console.error('Error parsing currentDate:', dateError);
      return NextResponse.json(
        { error: 'Invalid date format for currentDate' },
        { status: 400 }
      );
    }
    
    // Validate timeFrame
    if (!['day', 'week', 'month', 'year'].includes(timeFrame)) {
      console.error(`Invalid timeFrame value: ${timeFrame}`);
      return NextResponse.json(
        { error: `Invalid timeFrame value. Must be one of: day, week, month, year` },
        { status: 400 }
      );
    }
    
    // Initialize chain progress in the store
    updateChainProgress(chainId, {
      isGenerating: true,
      step: 'initializing',
      progress: 0,
      partialResults: {}
    });
    
    // Get user ID from auth header or use admin client
    let userId = 'system';
    
    // Check for auth header
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data, error } = await supabase.auth.getUser(token);
      
      if (!error && data.user) {
        userId = data.user.id;
      } else {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    // Prepare chain parameters
    const chainParams: ChainParams = {
      timeFrame,
      currentDate: validatedDate,
      platformSettings,
      customPrompt,
      organizationId
    };
    
    // Execute the chain with proper error handling
    try {
      console.log('Starting chain execution with params:', JSON.stringify({
        timeFrame,
        currentDate,
        platformCount: platformSettings.length,
        organizationId,
        hasCustomPrompt: !!customPrompt
      }));
      
      // Execute the chain with progress callback
      const finalPosts = await executePostGenerationChain(
        chainParams, 
        (state) => updateChainProgress(chainId, state)
      );
      
      console.log(`Chain execution successful, generated ${finalPosts.length} posts`);
      
      // Store the final posts in the chain state
      updateChainWithResults(chainId, finalPosts);
      
      // Return the chain ID and generated posts
      return NextResponse.json({ 
        success: true, 
        chainId, // Return chain ID for client to fetch updates
        posts: finalPosts 
      });
    } catch (chainError) {
      console.error('Chain execution error:', chainError);
      
      // Update chain state to error
      updateChainProgress(chainId, {
        isGenerating: false,
        step: 'error',
        progress: 0,
        error: chainError instanceof Error ? chainError.message : 'Unknown error',
        partialResults: {}
      });
      
      const errorMessage = chainError instanceof Error 
        ? chainError.message
        : 'Failed to generate post ideas';
        
      const errorCode = errorMessage.includes('Organization') ? 'ORG_ERROR' : 'GENERATION_ERROR';
      
      return NextResponse.json({ 
        error: errorMessage,
        code: errorCode,
        chainId, // Return chain ID for client to fetch error updates
        details: chainError
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in post generation chain API:', error);
    
    // Set error state in chain progress if chainId exists
    if (chainId) {
      updateChainProgress(chainId, {
        isGenerating: false,
        step: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        partialResults: {}
      });
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? 
        `Failed to process request: ${error.message}` : 
        'Unknown error during post generation',
      code: 'API_ERROR',
      chainId,
      details: error
    }, { status: 500 });
  }
}

// For streaming progress updates (Server-Sent Events)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const chainId = url.searchParams.get('chainId');
  
  console.log(`SSE: Connection request for chain ID: ${chainId}`);
  
  if (!chainId) {
    console.error('SSE: Missing chain ID in request');
    return NextResponse.json(
      { error: 'Missing chain ID' },
      { status: 400 }
    );
  }
  
  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // Disables buffering in Nginx
  });
  
  // Add CORS headers if needed
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  // Shared state to track stream status
  let streamEnded = false;
  
  const stream = new ReadableStream({
    start(controller) {
      try {
        console.log(`SSE: Starting stream for chain ${chainId}`);
        
        // Check if chain exists in progress store
        const initialState = getChainProgress(chainId);
        if (!initialState) {
          console.log(`SSE: No chain state found for ${chainId}, sending default initializing`);
          // If no state exists, create a default one
          updateChainProgress(chainId, {
            isGenerating: true,
            step: 'initializing',
            progress: 0,
            partialResults: {}
          });
        }
        
        // Optimize the SSE stream logic to prevent trying to send after controller is closed
        // Look for the section handling the SSE connection closing and ensure we properly handle controller state

        const safeEnqueue = (data: string): boolean => {
          if (!controller) {
            console.log(`SSE: Cannot enqueue data, controller is null`);
            return false;
          }
          
          try {
            // Check if controller is already closed
            if ((controller as any)._state === 'closed') {
              console.log(`SSE: Cannot enqueue data, controller is already closed`);
              return false;
            }
            
            controller.enqueue(data);
            return true;
          } catch (error) {
            console.error('Failed to enqueue data:', error);
            
            // If we get "Controller is already closed" error, clean up
            if (error instanceof TypeError && error.message.includes('Controller is already closed')) {
              console.log(`SSE: Controller was already closed when trying to enqueue data`);
              // No need to call controller.close() again if it's already closed
            }
            
            return false;
          }
        };
        
        const safeClose = () => {
          try {
            if (controller && (controller as any)._state !== 'closed') {
              controller.close();
            }
          } catch (error) {
            console.error('Error closing controller:', error);
          }
        };
        
        // Send initial message with current chain state
        try {
          const currentState = getChainProgress(chainId) || {
            chainId,
            step: 'initializing',
            progress: 0,
            isGenerating: true
          };
          
          safeEnqueue(`data: ${JSON.stringify({
            chainId,
            ...currentState
          })}\n\n`);
          console.log(`SSE: Sent initial state for chain ${chainId}: ${currentState.step} - ${currentState.progress}%`);
        } catch (err) {
          console.error(`SSE: Error sending initial message for chain ${chainId}:`, err);
          streamEnded = true;
          return;
        }
        
        // Send a keep-alive message immediately
        safeEnqueue(`: keep-alive\n\n`);
        
        // Poll for updates
        let lastProgress = -1;
        let lastStep = '';
        let completionCounter = 0;
        
        // Create a timer function that sends periodic keep-alive comments
        const keepAliveInterval = setInterval(() => {
          if (streamEnded) {
            clearInterval(keepAliveInterval);
            return;
          }
          
          // Send a comment as keep-alive
          safeEnqueue(`: keep-alive ${new Date().toISOString()}\n\n`);
        }, 15000); // Every 15 seconds
        
        const interval = setInterval(() => {
          // Don't proceed if the stream is already ended
          if (streamEnded) {
            console.log(`SSE: Stream already ended for chain ${chainId}, clearing interval`);
            clearInterval(interval);
            return;
          }
          
          // Get current state
          const currentState = getChainProgress(chainId);
          if (!currentState) {
            console.log(`SSE: No state found for chain ${chainId} during polling`);
            return;
          }
          
          // Only send update if there's a change
          if (currentState.progress !== lastProgress || currentState.step !== lastStep) {
            console.log(`SSE: Change detected for chain ${chainId}: ${currentState.step} - ${currentState.progress}%`);
            
            let messageData = {
              chainId,
              ...currentState
            };
            
            // For complete or final states, ensure posts are included if available
            if (currentState.step === 'complete' || currentState.step === 'error' || !currentState.isGenerating) {
              // For complete states with final posts, include them in the message
              if ((currentState.step === 'complete' || !currentState.isGenerating) && 
                  (currentState.partialResults.finalPosts?.length || 
                   currentState.partialResults.scheduledPosts?.length)) {
                
                const posts = currentState.partialResults.finalPosts || 
                             currentState.partialResults.scheduledPosts || [];
                
                // Add posts to the message data
                messageData = {
                  ...messageData,
                  posts
                } as any; // Use simple type assertion to fix TypeScript error
                
                console.log(`SSE: Sending final results with ${posts.length} posts`);
              }
            }
            
            // Send the update
            const success = safeEnqueue(`data: ${JSON.stringify(messageData)}\n\n`);
            
            if (!success) {
              console.log(`SSE: Failed to send update for chain ${chainId}, clearing interval`);
              clearInterval(interval);
              clearInterval(keepAliveInterval);
              return;
            }
            
            lastProgress = currentState.progress;
            lastStep = currentState.step;
            
            // Handle completion states
            if (currentState.step === 'complete' || currentState.step === 'error' || !currentState.isGenerating) {
              completionCounter++;
              
              // Close after sending a few more updates to ensure client receives completion
              if (completionCounter >= 3) {
                console.log(`SSE: Chain ${chainId} complete, clearing intervals`);
                clearInterval(interval);
                clearInterval(keepAliveInterval);
                safeClose();
                
                // Clean up store after a delay
                setTimeout(() => {
                  const state = getChainProgress(chainId);
                  if (state) {
                    updateChainProgress(chainId, {
                      ...state,
                      isGenerating: false,
                      step: 'complete',
                      progress: 100
                    });
                  }
                  console.log(`Cleaned up chain ${chainId} from progress store`);
                }, 60000); // Keep for 1 minute for any retry attempts
              }
            }
          }
        }, 500); // Poll every 500ms
        
        // Cleanup function when the stream is cancelled/closed
        return () => {
          console.log(`SSE: Client disconnected from chain ${chainId}`);
          streamEnded = true;
          clearInterval(interval);
          clearInterval(keepAliveInterval);
        };
      } catch (topLevelError) {
        console.error(`SSE: Fatal error in stream for chain ${chainId}:`, topLevelError);
        streamEnded = true;
        try {
          controller.error(topLevelError);
        } catch (finalError) {
          console.error(`SSE: Could not send error to client for chain ${chainId}:`, finalError);
        }
      }
    }
  });
  
  return new Response(stream, { headers });
} 