import { ChainState } from './types';

interface TimestampedChainState extends ChainState {
  updatedAt: number; // Timestamp for cleanup
}

// Simple in-memory store for chain progress
// In a production app, this would use Redis or a database
export const chainProgressStore = new Map<string, TimestampedChainState>();

// Max age for chain progress data (5 minutes)
const MAX_AGE_MS = 5 * 60 * 1000;

// Helper to update and retrieve chain progress
export const updateChainProgress = (chainId: string, state: ChainState) => {
  console.log(`Chain ${chainId} progress update: ${state.step} - ${state.progress}%`);
  
  // Add timestamp for cleanup
  chainProgressStore.set(chainId, {
    ...state,
    updatedAt: Date.now()
  });
  
  // Run cleanup on update to prevent memory leaks
  cleanupOldEntries();
};

export const getChainProgress = (chainId: string): ChainState | undefined => {
  const timestampedState = chainProgressStore.get(chainId);
  
  if (!timestampedState) {
    return undefined;
  }
  
  // Return state without the timestamp
  const { updatedAt, ...state } = timestampedState;
  return state;
};

// Clean up old entries to prevent memory leaks in serverless environment
function cleanupOldEntries() {
  const now = Date.now();
  
  for (const [chainId, state] of chainProgressStore.entries()) {
    if (now - state.updatedAt > MAX_AGE_MS) {
      console.log(`Cleaning up stale chain state for ${chainId}`);
      chainProgressStore.delete(chainId);
    }
  }
} 