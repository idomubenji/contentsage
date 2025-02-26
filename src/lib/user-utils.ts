import { supabase } from './supabase';

// Add a variable to track recent sync attempts to prevent duplicate calls
let lastSyncAttempt = 0;
const SYNC_THROTTLE_MS = 5000; // Only allow one sync every 5 seconds

/**
 * Syncs the authenticated user to the public users table
 * This should be called after a user signs in or signs up
 */
export async function syncUserToDatabase() {
  const now = Date.now();
  
  // Check if a sync was attempted recently to prevent duplicate calls
  if (now - lastSyncAttempt < SYNC_THROTTLE_MS) {
    console.log(`[${new Date().toISOString()}] syncUserToDatabase: Skipping sync, last attempt was ${now - lastSyncAttempt}ms ago`);
    return { success: true, skipped: true };
  }
  
  // Update the last sync attempt timestamp
  lastSyncAttempt = now;
  
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] syncUserToDatabase: Starting user sync...`);
  
  // Create a promise that rejects after a timeout - increased to 15 seconds
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const elapsed = Date.now() - startTime;
      console.warn(`[${new Date().toISOString()}] TIMEOUT: User sync timed out after ${elapsed}ms (15 second limit)`);
      reject(new Error('User sync timed out after 15 seconds'));
    }, 15000); // Increased from 5000 to 15000
  });
  
  try {
    // Race the sync process against the timeout
    await Promise.race([
      syncUserToDatabaseInternal(startTime),
      timeoutPromise
    ]);
    
    const elapsed = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] syncUserToDatabase: User sync completed successfully in ${elapsed}ms`);
    return { success: true };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] syncUserToDatabase: Error or timeout syncing user to database after ${elapsed}ms:`, error);
    // Return success anyway to prevent blocking the auth flow
    return { success: true, warning: 'Sync may not have completed but auth flow will continue' };
  }
}

/**
 * Internal implementation of user sync without timeout
 */
async function syncUserToDatabaseInternal(startTime = Date.now()) {
  try {
    console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Starting internal sync process...`);
    
    // Get the current user
    const getUserStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Getting current user...`);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const getUserElapsed = Date.now() - getUserStartTime;
    console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: getUser completed in ${getUserElapsed}ms`);
    
    if (userError) {
      console.error(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Error getting user:`, userError);
      throw userError;
    }
    
    if (!user) {
      console.error(`[${new Date().toISOString()}] syncUserToDatabaseInternal: No authenticated user found`);
      throw new Error('No authenticated user found');
    }
    
    console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Syncing user to database:`, user.id);
    
    // Check if the user exists in the public users table
    const checkStartTime = Date.now();
    console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Checking if user exists in database...`);
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();
    const checkElapsed = Date.now() - checkStartTime;
    console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Check for existing user completed in ${checkElapsed}ms`);
    
    if (checkError) {
      if (checkError.code === 'PGRST116') { // PGRST116 is "no rows returned"
        console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: User not found in database, will create`);
      } else {
        console.error(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Error checking if user exists:`, checkError);
        throw checkError;
      }
    }
    
    if (!existingUser) {
      // User doesn't exist in the public users table, so create them
      const createStartTime = Date.now();
      console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Creating user in database...`);
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);
      const createElapsed = Date.now() - createStartTime;
      console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: User creation attempt completed in ${createElapsed}ms`);
      
      if (insertError) {
        console.error(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Error creating user in database:`, insertError);
        throw insertError;
      }
      
      console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: User created in database:`, user.id);
    } else {
      // User exists, update their information
      const updateStartTime = Date.now();
      console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Updating user in database...`);
      const { error: updateError } = await supabase
        .from('users')
        .update({
          email: user.email,
          name: user.user_metadata?.name || user.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      const updateElapsed = Date.now() - updateStartTime;
      console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: User update attempt completed in ${updateElapsed}ms`);
      
      if (updateError) {
        console.error(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Error updating user in database:`, updateError);
        throw updateError;
      }
      
      console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: User updated in database:`, user.id);
    }
    
    const totalElapsed = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Internal sync completed successfully in ${totalElapsed}ms`);
    return { success: true };
  } catch (error) {
    const totalElapsed = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] syncUserToDatabaseInternal: Error in internal sync function after ${totalElapsed}ms:`, error);
    throw error;
  }
} 