-- Migration: Add platform field to posts table
-- Description: Adds a platform field to the posts table to track where content is posted (website, Facebook, Instagram, LinkedIn, X)

-- Add platform column to posts table
ALTER TABLE posts
ADD COLUMN platform TEXT;

-- Update existing posts to have "website" as default platform (optional, remove if not needed)
UPDATE posts
SET platform = 'website'
WHERE platform IS NULL;

-- Create index for platform column for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);

-- Comment explaining the platform field
COMMENT ON COLUMN posts.platform IS 'The platform where the post is published (e.g., website, facebook, instagram, linkedin, x)'; 