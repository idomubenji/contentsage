-- Add preferences field to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Add index for efficient querying (GIN index is appropriate for JSONB)
CREATE INDEX IF NOT EXISTS idx_organizations_preferences ON organizations USING GIN (preferences);

-- Update comment to document the change
COMMENT ON COLUMN organizations.preferences IS 'Stores organization content preferences including content philosophy, best posting times, preferred content types, and tone for AI-assisted content planning';

-- Update migration history
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_history WHERE migration_name = '28_add_organization_preferences_field') THEN
        -- Record exists, do nothing
    ELSE
        -- Record doesn't exist, insert it
        INSERT INTO migration_history (migration_name, direction, applied_at) 
        VALUES ('28_add_organization_preferences_field', 'up', NOW());
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip migration history update
        RAISE NOTICE 'migration_history table does not exist, skipping migration history update';
END $$; 