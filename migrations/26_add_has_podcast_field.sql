-- Add hasPodcast field to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS has_podcast BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_posts_has_podcast ON posts(has_podcast);

-- Update comment to document the change
COMMENT ON COLUMN posts.has_podcast IS 'Indicates if the content is or contains a podcast';

-- Update migration history
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_history WHERE migration_name = '26_add_has_podcast_field') THEN
        -- Record exists, do nothing
    ELSE
        -- Record doesn't exist, insert it
        INSERT INTO migration_history (migration_name, direction, applied_at) 
        VALUES ('26_add_has_podcast_field', 'up', NOW());
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip migration history update
        RAISE NOTICE 'migration_history table does not exist, skipping migration history update';
END $$; 