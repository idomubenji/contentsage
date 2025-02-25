#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Create output directory for migration files
const outputDir = path.join(__dirname, 'supabase-migration');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Tables to export based on your application
const tables = [
  'users',
  'user_consents',
  'profiles',
  'organizations',
  'user_organizations',
  'posts',
  'encrypted_user_data',
  'data_deletion_requests',
  'data_access_logs',
  'user_encryption_keys',
  'user_decrypted_data',
  'user_encrypted_data',
  'migration_history'
];

// Source Supabase credentials
const SOURCE_SUPABASE_URL = process.env.SOURCE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SOURCE_SUPABASE_SERVICE_KEY = process.env.SOURCE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Target Supabase credentials (new EU region project)
const TARGET_SUPABASE_URL = process.env.TARGET_SUPABASE_URL;
const TARGET_SUPABASE_SERVICE_KEY = process.env.TARGET_SUPABASE_SERVICE_KEY;

// Create Supabase clients
const sourceSupabase = createClient(SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_KEY);
const targetSupabase = TARGET_SUPABASE_URL && TARGET_SUPABASE_SERVICE_KEY ? 
  createClient(TARGET_SUPABASE_URL, TARGET_SUPABASE_SERVICE_KEY) : null;

async function getTableSchema(table) {
  try {
    // Get table schema using Supabase's internal RPC functions
    const { data, error } = await sourceSupabase.rpc('get_table_ddl', { table_name: table });
    
    if (error) {
      console.error(`Error fetching schema for ${table}:`, error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Error in getTableSchema for ${table}:`, error);
    return null;
  }
}

async function exportData(table) {
  try {
    // Export data from the source table
    const { data, error } = await sourceSupabase.from(table).select('*');
    
    if (error) {
      console.error(`Error exporting data from ${table}:`, error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log(`No data found in table ${table}`);
      return [];
    }
    
    console.log(`Exported ${data.length} rows from ${table}`);
    return data;
  } catch (error) {
    console.error(`Error in exportData for ${table}:`, error);
    return null;
  }
}

async function importData(table, data) {
  if (!targetSupabase) {
    console.log('Target Supabase not configured. Skipping import.');
    return false;
  }
  
  try {
    if (!data || data.length === 0) {
      console.log(`No data to import for table ${table}`);
      return true;
    }
    
    // Import data to the target table
    const { error } = await targetSupabase.from(table).insert(data);
    
    if (error) {
      console.error(`Error importing data to ${table}:`, error);
      return false;
    }
    
    console.log(`Successfully imported ${data.length} rows to ${table}`);
    return true;
  } catch (error) {
    console.error(`Error in importData for ${table}:`, error);
    return false;
  }
}

async function getStorageBuckets() {
  try {
    // List all storage buckets
    const { data, error } = await sourceSupabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing storage buckets:', error);
      return [];
    }
    
    return data.map(bucket => bucket.name);
  } catch (error) {
    console.error('Error in getStorageBuckets:', error);
    return [];
  }
}

async function exportStorageBucket(bucketName) {
  try {
    const bucketDir = path.join(outputDir, 'storage', bucketName);
    fs.mkdirSync(bucketDir, { recursive: true });
    
    // List all files in the bucket
    const { data, error } = await sourceSupabase.storage.from(bucketName).list();
    
    if (error) {
      console.error(`Error listing files in bucket ${bucketName}:`, error);
      return [];
    }
    
    console.log(`Found ${data.length} files in bucket ${bucketName}`);
    
    // Export each file's metadata
    const fileMetadata = [];
    for (const file of data) {
      fileMetadata.push({
        name: file.name,
        bucket: bucketName,
        contentType: file.metadata?.mimetype || 'application/octet-stream',
        path: path.join(bucketDir, file.name)
      });
      
      // Download the file
      const { data: fileData, error: fileError } = await sourceSupabase.storage
        .from(bucketName)
        .download(file.name);
      
      if (fileError) {
        console.error(`Error downloading file ${file.name}:`, fileError);
        continue;
      }
      
      // Convert Blob to Buffer and save to disk
      const buffer = Buffer.from(await fileData.arrayBuffer());
      fs.writeFileSync(path.join(bucketDir, file.name), buffer);
      console.log(`Downloaded file ${file.name}`);
    }
    
    // Save metadata
    fs.writeFileSync(
      path.join(bucketDir, 'metadata.json'),
      JSON.stringify(fileMetadata, null, 2)
    );
    
    return fileMetadata;
  } catch (error) {
    console.error(`Error in exportStorageBucket for ${bucketName}:`, error);
    return [];
  }
}

async function main() {
  console.log('Starting Supabase migration...');
  
  if (!SOURCE_SUPABASE_URL || !SOURCE_SUPABASE_SERVICE_KEY) {
    console.error('Source Supabase credentials not found in environment variables');
    process.exit(1);
  }
  
  // Export table schemas and data
  for (const table of tables) {
    console.log(`Processing table: ${table}`);
    
    // Get table schema
    const schema = await getTableSchema(table);
    if (schema) {
      fs.writeFileSync(
        path.join(outputDir, `${table}-schema.sql`),
        schema
      );
      console.log(`Saved schema for ${table}`);
    }
    
    // Export data
    const data = await exportData(table);
    if (data) {
      fs.writeFileSync(
        path.join(outputDir, `${table}-data.json`),
        JSON.stringify(data, null, 2)
      );
      console.log(`Saved data for ${table}`);
    }
    
    // Import data to target if configured
    if (data && TARGET_SUPABASE_URL && TARGET_SUPABASE_SERVICE_KEY) {
      await importData(table, data);
    }
  }
  
  // Export storage buckets
  const buckets = await getStorageBuckets();
  console.log('Storage buckets found:', buckets);
  
  for (const bucket of buckets) {
    console.log(`Processing storage bucket: ${bucket}`);
    await exportStorageBucket(bucket);
  }
  
  console.log(`Migration completed. Files saved to ${outputDir}`);
  
  // Instructions for the next steps
  console.log('\nNext steps:');
  console.log('1. Update your environment variables with the new Supabase project details:');
  console.log('   - NEXT_PUBLIC_SUPABASE_URL');
  console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('2. Import your data into the new Supabase project (if not already done automatically)');
  console.log('3. Create storage buckets in your new project and upload the exported files');
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 