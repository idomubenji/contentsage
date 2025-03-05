import { NextRequest, NextResponse } from 'next/server';
import { getChainProgress } from '../post-generation-chain/progress-store';

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
      console.log(`No chain state found for ID: ${chainId}, returning default initializing state`);
      // Return a default state instead of 404 to allow for background processing to catch up
      return NextResponse.json({
        success: true,
        chainId,
        chainState: {
          isGenerating: true,
          step: 'initializing',
          progress: 0,
          partialResults: {}
        }
      });
    }
    
    console.log(`Found chain state for ${chainId}. Step: ${chainState.step}, Progress: ${chainState.progress}, IsGenerating: ${chainState.isGenerating}`);
    
    // Return the full chain state for client-side processing
    return NextResponse.json({
      success: true,
      chainId,
      chainState
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