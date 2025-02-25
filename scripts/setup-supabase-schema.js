require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupSchema() {
  console.log('Setting up Supabase schema...');

  try {
    // Create users table
    const { data: usersData, error: usersError } = await supabase.from('users').select('id').limit(1);
    
    if (usersError) {
      console.log('Creating users table...');
      const { error } = await supabase.auth.admin.createUser({
        email: 'temp@example.com',
        password: 'temporary_password',
        user_metadata: { name: 'Temporary User' }
      });
      
      if (error) {
        console.error('Error creating temporary user:', error);
      } else {
        console.log('Temporary user created to initialize auth schema');
      }
    } else {
      console.log('Users table already exists');
    }

    // Create organizations table if it doesn't exist
    const { data: orgsData, error: orgsError } = await supabase.from('organizations').select('id').limit(1);
    
    if (orgsError) {
      console.log('Creating organizations table...');
      const { error } = await supabase
        .from('organizations')
        .insert([{ name: 'Default Organization' }]);
      
      if (error) {
        console.error('Error creating organizations table:', error);
      } else {
        console.log('Organizations table created successfully');
      }
    } else {
      console.log('Organizations table already exists');
    }

    // Create user_organizations table if it doesn't exist
    const { data: userOrgsData, error: userOrgsError } = await supabase.from('user_organizations').select('user_id').limit(1);
    
    if (userOrgsError) {
      console.log('Creating user_organizations table...');
      // We'll create this table after we have users and organizations
      console.log('Will create user_organizations table after users and organizations are set up');
    } else {
      console.log('User_organizations table already exists');
    }

    // Create posts table if it doesn't exist
    const { data: postsData, error: postsError } = await supabase.from('posts').select('id').limit(1);
    
    if (postsError) {
      console.log('Creating posts table...');
      const { error } = await supabase
        .from('posts')
        .insert([{ 
          url: 'https://example.com/sample-post',
          title: 'Sample Post',
          description: 'This is a sample post',
          status: 'SUGGESTED'
        }]);
      
      if (error) {
        console.error('Error creating posts table:', error);
      } else {
        console.log('Posts table created successfully');
      }
    } else {
      console.log('Posts table already exists');
    }

    console.log('Schema setup completed!');
    console.log('Note: For full schema setup including RLS policies and indexes, please use the Supabase dashboard or SQL editor.');
    console.log('The JavaScript API has limitations for schema management.');
  } catch (error) {
    console.error('Error setting up schema:', error);
  }
}

setupSchema(); 