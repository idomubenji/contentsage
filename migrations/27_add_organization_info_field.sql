-- Add info field to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS info JSONB DEFAULT '{}';

-- Add index for efficient querying (GIN index is appropriate for JSONB)
CREATE INDEX IF NOT EXISTS idx_organizations_info ON organizations USING GIN (info);

-- Update comment to document the change
COMMENT ON COLUMN organizations.info IS 'Stores analytical information about the organization including industry classification, description based on past posts, strategy understanding, and general tone';

-- Update migration history
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_history WHERE migration_name = '27_add_organization_info_field') THEN
        -- Record exists, do nothing
    ELSE
        -- Record doesn't exist, insert it
        INSERT INTO migration_history (migration_name, direction, applied_at) 
        VALUES ('27_add_organization_info_field', 'up', NOW());
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip migration history update
        RAISE NOTICE 'migration_history table does not exist, skipping migration history update';
END $$; 