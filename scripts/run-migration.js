#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get migration number and direction from command line arguments
const args = process.argv.slice(2);
const migrationNumber = args[0];
const direction = args[1] || 'up';

if (!migrationNumber) {
  console.error('Please provide a migration number (e.g., 001)');
  process.exit(1);
}

// Find the migration folder
const migrationsDir = path.join(__dirname, '..', 'migrations');
const migrationFolders = fs.readdirSync(migrationsDir)
  .filter(folder => folder.startsWith(migrationNumber) && fs.statSync(path.join(migrationsDir, folder)).isDirectory());

if (migrationFolders.length === 0) {
  console.error(`No migration found with number ${migrationNumber}`);
  process.exit(1);
}

const migrationFolder = migrationFolders[0];
const sqlFile = path.join(migrationsDir, migrationFolder, `${direction}.sql`);

if (!fs.existsSync(sqlFile)) {
  console.error(`${direction}.sql not found in migration ${migrationFolder}`);
  process.exit(1);
}

// Read the SQL file
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log(`Running ${direction} migration for ${migrationFolder}...`);
console.log('SQL to execute:');
console.log(sql);
console.log('\nThis script cannot directly execute SQL in Supabase.');
console.log('Please copy the SQL above and run it in the Supabase SQL Editor.');
console.log('\nAlternatively, you can run the following command to copy the SQL to your clipboard:');
console.log(`cat ${sqlFile} | pbcopy  # On macOS`);
console.log(`cat ${sqlFile} | xclip -selection clipboard  # On Linux with xclip installed`);
console.log(`type ${sqlFile} | clip  # On Windows`);

// Create a migration_history table if it doesn't exist
async function setupMigrationHistory() {
  try {
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS migration_history (
          id SERIAL PRIMARY KEY,
          migration_name TEXT NOT NULL,
          direction TEXT NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (error) {
      console.error('Error creating migration_history table:', error);
      console.log('You may need to create this table manually in the Supabase SQL Editor.');
    }
  } catch (error) {
    console.error('Error setting up migration history:', error);
  }
}

// Record the migration in the history
async function recordMigration() {
  try {
    const { error } = await supabase
      .from('migration_history')
      .insert([
        { 
          migration_name: migrationFolder,
          direction: direction
        }
      ]);

    if (error) {
      console.error('Error recording migration in history:', error);
    } else {
      console.log(`Migration ${migrationFolder} (${direction}) recorded in history.`);
    }
  } catch (error) {
    console.error('Error recording migration:', error);
  }
}

// Try to set up migration history table
setupMigrationHistory(); 