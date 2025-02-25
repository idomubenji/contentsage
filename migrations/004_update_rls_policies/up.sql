-- Migration: update_rls_policies
-- Created at: 2023-07-14T00:00:00.000Z

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow users to sync themselves" ON users;
DROP POLICY IF EXISTS "Allow users to update themselves" ON users;

-- Create more permissive policies for users table
-- Allow users to select their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to insert their own data
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Create a migration_history table to track migrations
CREATE TABLE IF NOT EXISTS migration_history (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL,
  direction TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration
INSERT INTO migration_history (migration_name, direction)
VALUES ('004_update_rls_policies', 'up'); 