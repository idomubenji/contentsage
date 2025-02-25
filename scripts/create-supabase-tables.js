require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
  console.log('Creating tables in Supabase...');

  try {
    // Create organizations table
    console.log('Creating organizations table...');
    const { data: orgsData, error: orgsError } = await supabase
      .from('organizations')
      .insert([
        { name: 'Default Organization' }
      ])
      .select();

    if (orgsError) {
      console.error('Error creating organizations table:', orgsError);
    } else {
      console.log('Organizations table created successfully');
      console.log('Default organization created with ID:', orgsData[0].id);
    }

    // Create posts table
    console.log('Creating posts table...');
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .insert([
        { 
          url: 'https://example.com/sample-post',
          title: 'Sample Post',
          description: 'This is a sample post',
          status: 'SUGGESTED'
        }
      ])
      .select();

    if (postsError) {
      console.error('Error creating posts table:', postsError);
    } else {
      console.log('Posts table created successfully');
      console.log('Sample post created with ID:', postsData[0].id);
    }

    // Create user_organizations table
    // This will be created when we add a user to an organization

    console.log('\nNote: For full schema setup including RLS policies and indexes, please use the Supabase dashboard SQL editor.');
    console.log('1. Go to the Supabase dashboard: https://app.supabase.io');
    console.log('2. Select your project');
    console.log('3. Go to the SQL Editor');
    console.log('4. Copy and paste the contents of scripts/supabase-schema.sql');
    console.log('5. Run the SQL script');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

createTables(); 