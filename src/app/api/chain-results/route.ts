import { NextRequest, NextResponse } from 'next/server';
import { getChainProgress } from '../post-generation-chain/route';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const chainId = url.searchParams.get('chainId');
  
  console.log(`Chain results request for chain ID: ${chainId}`);
  
  // Validate chain ID
  if (!chainId) {
    console.error('Missing chain ID in request');
    return NextResponse.json(
      { error: 'Missing chain ID' },
      { status: 400 }
    );
  }
  
  try {
    // Get the chain state from the store
    const chainState = getChainProgress(chainId);
    
    if (!chainState) {
      console.error(`No chain state found for ID: ${chainId}`);
      return NextResponse.json(
        { error: `No results found for chain ID ${chainId}` },
        { status: 404 }
      );
    }
    
    console.log(`Found chain state for ${chainId}. Step: ${chainState.step}, Progress: ${chainState.progress}, IsGenerating: ${chainState.isGenerating}`);
    
    // Check if the chain is complete
    if (chainState.step !== 'complete' && chainState.isGenerating) {
      console.log(`Chain ${chainId} is still processing.`);
      return NextResponse.json(
        { 
          error: 'Chain processing is not complete',
          status: chainState.step,
          progress: chainState.progress
        },
        { status: 202 } // Accepted but not complete
      );
    }
    
    // If there's an error, return it
    if (chainState.error) {
      console.error(`Chain ${chainId} ended with error: ${chainState.error}`);
      return NextResponse.json(
        { error: chainState.error },
        { status: 500 }
      );
    }
    
    // Log the available results
    console.log(`Chain ${chainId} results:`, {
      hasFinalPosts: !!chainState.partialResults.finalPosts,
      hasScheduledPosts: !!chainState.partialResults.scheduledPosts,
      hasSeoInfo: !!chainState.partialResults.postsWithSeo,
      hasElaborations: !!chainState.partialResults.elaboratedPosts,
      hasIdeas: !!chainState.partialResults.postIdeas
    });
    
    // Return any available results
    const posts = chainState.partialResults.finalPosts || 
                 chainState.partialResults.scheduledPosts || 
                 chainState.partialResults.postsWithSeo ||
                 chainState.partialResults.elaboratedPosts ||
                 chainState.partialResults.postIdeas || [];
    
    const postsCount = Array.isArray(posts) ? posts.length : 0;
    console.log(`Returning ${postsCount} posts for chain ${chainId}`);
    
    return NextResponse.json({
      success: true,
      chainId,
      status: chainState.step,
      progress: chainState.progress,
      posts
    });
  } catch (error) {
    console.error('Error fetching chain results:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        chainId
      },
      { status: 500 }
    );
  }
} 