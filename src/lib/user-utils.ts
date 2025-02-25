import { supabase } from './supabase';

/**
 * Syncs the authenticated user to the public users table
 * This should be called after a user signs in or signs up
 */
export async function syncUserToDatabase() {
  console.log('syncUserToDatabase: Starting user sync...');
  
  // Create a promise that rejects after a timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('User sync timed out after 5 seconds'));
    }, 5000);
  });
  
  try {
    // Race the sync process against the timeout
    await Promise.race([
      syncUserToDatabaseInternal(),
      timeoutPromise
    ]);
    
    console.log('syncUserToDatabase: User sync completed successfully');
    return { success: true };
  } catch (error) {
    console.error('syncUserToDatabase: Error or timeout syncing user to database:', error);
    // Return success anyway to prevent blocking the auth flow
    return { success: true, warning: 'Sync may not have completed but auth flow will continue' };
  }
}

/**
 * Internal implementation of user sync without timeout
 */
async function syncUserToDatabaseInternal() {
  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('syncUserToDatabase: Error getting user:', userError);
      throw userError;
    }
    
    if (!user) {
      console.error('syncUserToDatabase: No authenticated user found');
      throw new Error('No authenticated user found');
    }
    
    console.log('syncUserToDatabase: Syncing user to database:', user.id);
    
    // Check if the user exists in the public users table
    console.log('syncUserToDatabase: Checking if user exists in database...');
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (checkError) {
      if (checkError.code === 'PGRST116') { // PGRST116 is "no rows returned"
        console.log('syncUserToDatabase: User not found in database, will create');
      } else {
        console.error('syncUserToDatabase: Error checking if user exists:', checkError);
        throw checkError;
      }
    }
    
    if (!existingUser) {
      // User doesn't exist in the public users table, so create them
      console.log('syncUserToDatabase: Creating user in database...');
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
      
      if (insertError) {
        console.error('syncUserToDatabase: Error creating user in database:', insertError);
        throw insertError;
      }
      
      console.log('syncUserToDatabase: User created in database:', user.id);
    } else {
      // User exists, update their information
      console.log('syncUserToDatabase: Updating user in database...');
      const { error: updateError } = await supabase
        .from('users')
        .update({
          email: user.email,
          name: user.user_metadata?.name || user.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('syncUserToDatabase: Error updating user in database:', updateError);
        throw updateError;
      }
      
      console.log('syncUserToDatabase: User updated in database:', user.id);
    }
    
    return { success: true };
  } catch (error) {
    console.error('syncUserToDatabase: Error in internal sync function:', error);
    throw error;
  }
} 