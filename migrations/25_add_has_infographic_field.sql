-- Add hasInfographic field to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS has_infographic BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_posts_has_infographic ON posts(has_infographic);

-- Update comment to document the change
COMMENT ON COLUMN posts.has_infographic IS 'Indicates if the content contains infographics or visual data representations';

-- Update migration history
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_history WHERE migration_name = '25_add_has_infographic_field') THEN
        -- Record exists, do nothing
    ELSE
        -- Record doesn't exist, insert it
        INSERT INTO migration_history (migration_name, direction, applied_at) 
        VALUES ('25_add_has_infographic_field', 'up', NOW());
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip migration history update
        RAISE NOTICE 'migration_history table does not exist, skipping migration history update';
END $$; 