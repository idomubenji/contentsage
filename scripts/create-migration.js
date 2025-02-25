#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Get migration name from command line arguments
const args = process.argv.slice(2);
const migrationName = args[0];

if (!migrationName) {
  console.error('Please provide a migration name (e.g., add_user_fields)');
  process.exit(1);
}

// Find the next migration number
const migrationsDir = path.join(__dirname, '..', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

const existingMigrations = fs.readdirSync(migrationsDir)
  .filter(folder => /^\d{3}_/.test(folder) && fs.statSync(path.join(migrationsDir, folder)).isDirectory())
  .sort();

let nextNumber = '001';
if (existingMigrations.length > 0) {
  const lastMigration = existingMigrations[existingMigrations.length - 1];
  const lastNumber = parseInt(lastMigration.substring(0, 3), 10);
  nextNumber = (lastNumber + 1).toString().padStart(3, '0');
}

// Create the migration folder and files
const migrationFolder = `${nextNumber}_${migrationName}`;
const migrationPath = path.join(migrationsDir, migrationFolder);

if (fs.existsSync(migrationPath)) {
  console.error(`Migration ${migrationFolder} already exists`);
  process.exit(1);
}

fs.mkdirSync(migrationPath);

// Create up.sql
const upSql = `-- Migration: ${migrationName}
-- Created at: ${new Date().toISOString()}

-- Add your SQL statements here

`;
fs.writeFileSync(path.join(migrationPath, 'up.sql'), upSql);

// Create down.sql
const downSql = `-- Migration: ${migrationName} (revert)
-- Created at: ${new Date().toISOString()}

-- Add your SQL statements here to revert the migration

`;
fs.writeFileSync(path.join(migrationPath, 'down.sql'), downSql);

console.log(`Migration ${migrationFolder} created successfully`);
console.log(`- ${path.join(migrationPath, 'up.sql')}`);
console.log(`- ${path.join(migrationPath, 'down.sql')}`);
console.log('\nEdit these files to add your migration SQL statements.');
console.log('Then run the migration with:');
console.log(`node scripts/run-migration.js ${nextNumber}`); 