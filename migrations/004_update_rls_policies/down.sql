-- Migration: update_rls_policies (revert)
-- Created at: 2023-07-14T00:00:00.000Z

-- Drop the policies we created
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Record this migration
INSERT INTO migration_history (migration_name, direction)
VALUES ('004_update_rls_policies', 'down'); 