-- Migration: Revert addition of platform field to posts table
-- Description: Removes the platform field from the posts table

-- Drop index for platform column
DROP INDEX IF EXISTS idx_posts_platform;

-- Remove platform column from posts table
ALTER TABLE posts DROP COLUMN IF EXISTS platform; 