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
    
    // Return the full chain state for client-side processing
    // This supports our polling mechanism and lets the client decide how to handle different states
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