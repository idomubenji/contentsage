require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('Checking Supabase schema...');

  try {
    // Check users table
    const { data: usersData, error: usersError } = await supabase.from('users').select('id').limit(1);
    console.log('Users table:', usersError ? 'Does not exist or not accessible' : 'Exists');
    
    // Check organizations table
    const { data: orgsData, error: orgsError } = await supabase.from('organizations').select('id').limit(1);
    console.log('Organizations table:', orgsError ? 'Does not exist or not accessible' : 'Exists');
    
    // Check user_organizations table
    const { data: userOrgsData, error: userOrgsError } = await supabase.from('user_organizations').select('user_id').limit(1);
    console.log('User_organizations table:', userOrgsError ? 'Does not exist or not accessible' : 'Exists');
    
    // Check posts table
    const { data: postsData, error: postsError } = await supabase.from('posts').select('id').limit(1);
    console.log('Posts table:', postsError ? 'Does not exist or not accessible' : 'Exists');

    console.log('\nTo set up the complete schema with all tables, indexes, and RLS policies:');
    console.log('1. Go to the Supabase dashboard: https://app.supabase.io');
    console.log('2. Select your project');
    console.log('3. Go to the SQL Editor');
    console.log('4. Copy and paste the contents of scripts/supabase-schema.sql');
    console.log('5. Run the SQL script');
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema(); 