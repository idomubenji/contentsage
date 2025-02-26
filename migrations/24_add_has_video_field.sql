-- Add hasVideo field to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_posts_has_video ON posts(has_video);

-- Update comment to document the change
COMMENT ON COLUMN posts.has_video IS 'Indicates if the content (especially social media posts) contains a video';

-- Update migration history - without ON CONFLICT
-- Check if record already exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_history WHERE migration_name = '24_add_has_video_field') THEN
        -- Record exists, do nothing
    ELSE
        -- Record doesn't exist, insert it
        INSERT INTO migration_history (migration_name, direction, applied_at) 
        VALUES ('24_add_has_video_field', 'up', NOW());
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip migration history update
        RAISE NOTICE 'migration_history table does not exist, skipping migration history update';
END $$;