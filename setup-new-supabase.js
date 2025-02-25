#!/usr/bin/env node

require('dotenv').config({ path: '.env.migration' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Target Supabase credentials (new EU region project)
const TARGET_SUPABASE_URL = process.env.TARGET_SUPABASE_URL;
const TARGET_SUPABASE_SERVICE_KEY = process.env.TARGET_SUPABASE_SERVICE_KEY;

// Migration directory
const migrationDir = path.join(__dirname, 'supabase-migration');

// Create Supabase client
const supabase = createClient(TARGET_SUPABASE_URL, TARGET_SUPABASE_SERVICE_KEY);

async function executeSQL(sql) {
  try {
    const { data, error } = await supabase.rpc('pgclient_execute', { query: sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in executeSQL:', error);
    return false;
  }
}

async function createStorageBucket(bucketName) {
  try {
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024  // 50MB limit
    });
    
    if (error) {
      console.error(`Error creating bucket ${bucketName}:`, error);
      return false;
    }
    
    console.log(`Created storage bucket: ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Error in createStorageBucket for ${bucketName}:`, error);
    return false;
  }
}

async function uploadFile(bucketName, filePath, fileName) {
  try {
    const fileContent = fs.readFileSync(filePath);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileContent, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      console.error(`Error uploading file ${fileName}:`, error);
      return false;
    }
    
    console.log(`Uploaded file: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`Error in uploadFile for ${fileName}:`, error);
    return false;
  }
}

async function importData(table, dataFile) {
  try {
    if (!fs.existsSync(dataFile)) {
      console.log(`Data file for ${table} not found`);
      return false;
    }
    
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    if (!data || data.length === 0) {
      console.log(`No data to import for table ${table}`);
      return true;
    }
    
    // Split data into chunks to avoid request size limits
    const chunkSize = 1000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      const { error } = await supabase.from(table).insert(chunk);
      
      if (error) {
        console.error(`Error importing data chunk to ${table}:`, error);
        return false;
      }
    }
    
    console.log(`Successfully imported ${data.length} rows to ${table}`);
    return true;
  } catch (error) {
    console.error(`Error in importData for ${table}:`, error);
    return false;
  }
}

async function main() {
  console.log('Setting up new Supabase project...');
  
  if (!TARGET_SUPABASE_URL || !TARGET_SUPABASE_SERVICE_KEY) {
    console.error('Target Supabase credentials not found in environment variables');
    process.exit(1);
  }
  
  if (!fs.existsSync(migrationDir)) {
    console.error(`Migration directory not found: ${migrationDir}`);
    console.error('Please run migrate-supabase.js first');
    process.exit(1);
  }
  
  // Get all schema files
  const schemaFiles = fs.readdirSync(migrationDir)
    .filter(file => file.endsWith('-schema.sql'))
    .map(file => ({
      table: file.replace('-schema.sql', ''),
      path: path.join(migrationDir, file)
    }));
  
  // Create tables
  for (const { table, path } of schemaFiles) {
    console.log(`Creating table: ${table}`);
    const sql = fs.readFileSync(path, 'utf8');
    await executeSQL(sql);
  }
  
  // Import data
  for (const { table } of schemaFiles) {
    const dataPath = path.join(migrationDir, `${table}-data.json`);
    if (fs.existsSync(dataPath)) {
      console.log(`Importing data for table: ${table}`);
      await importData(table, dataPath);
    }
  }
  
  // Process storage buckets
  const storagePath = path.join(migrationDir, 'storage');
  if (fs.existsSync(storagePath)) {
    const buckets = fs.readdirSync(storagePath)
      .filter(dir => fs.statSync(path.join(storagePath, dir)).isDirectory());
    
    for (const bucket of buckets) {
      console.log(`Processing storage bucket: ${bucket}`);
      
      // Create bucket
      await createStorageBucket(bucket);
      
      // Read metadata
      const metadataPath = path.join(storagePath, bucket, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        // Upload files
        for (const file of metadata) {
          await uploadFile(bucket, file.path, file.name);
        }
      }
    }
  }
  
  console.log('New Supabase project setup completed');
}

main().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
}); 