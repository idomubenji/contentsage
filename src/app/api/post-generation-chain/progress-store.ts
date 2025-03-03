import { ChainState } from './types';

// Simple in-memory store for chain progress
// In a production app, this would be a Redis or other external store
export const chainProgressStore = new Map<string, ChainState>();

// Helper to update and retrieve chain progress
export const updateChainProgress = (chainId: string, state: ChainState) => {
  console.log(`Chain ${chainId} progress update: ${state.step} - ${state.progress}%`);
  chainProgressStore.set(chainId, {...state});
};

export const getChainProgress = (chainId: string): ChainState | undefined => {
  return chainProgressStore.get(chainId);
}; 