-- Complete fix for user_organizations recursion with NO SUBQUERIES at all
-- This approach eliminates recursion by avoiding all subqueries and self-references

-- First drop ALL existing policies on user_organizations by name
DROP POLICY IF EXISTS "users_view_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "users_insert_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "admins_manage_org_memberships" ON user_organizations;
DROP POLICY IF EXISTS "fix_2023_view_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "fix_2023_insert_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "fix_2023_admin_manage_memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can view their memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can view their own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations; 
DROP POLICY IF EXISTS "Users can see members in their organizations" ON user_organizations;
DROP POLICY IF EXISTS "Users can create their own membership" ON user_organizations;
DROP POLICY IF EXISTS "user_org_view_own" ON user_organizations;
DROP POLICY IF EXISTS "user_org_insert_own" ON user_organizations;
DROP POLICY IF EXISTS "admin_org_manage" ON user_organizations;
DROP POLICY IF EXISTS "simple_user_org_select" ON user_organizations;
DROP POLICY IF EXISTS "simple_user_org_insert" ON user_organizations;
DROP POLICY IF EXISTS "simple_user_org_update" ON user_organizations;
DROP POLICY IF EXISTS "simple_user_org_delete" ON user_organizations;
DROP POLICY IF EXISTS "users_create_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "users_view_org_members" ON user_organizations;
DROP POLICY IF EXISTS "basic_view_own_membership" ON user_organizations;
DROP POLICY IF EXISTS "basic_insert_own_membership" ON user_organizations;
DROP POLICY IF EXISTS "basic_admin_all_operations" ON user_organizations;
DROP POLICY IF EXISTS "users_select_own" ON user_organizations;
DROP POLICY IF EXISTS "users_insert_own" ON user_organizations;
DROP POLICY IF EXISTS "users_delete_own" ON user_organizations;
DROP POLICY IF EXISTS "view_org_members" ON user_organizations;

-- CRITICAL: Reset RLS to ensure clean slate
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Create the absolute simplest policies possible - ONE policy for each operation type

-- 1. Users can view their own entries
CREATE POLICY "policy_select_own" ON user_organizations 
  FOR SELECT 
  USING (user_id = auth.uid());

-- 2. Users can insert only their own entries
CREATE POLICY "policy_insert_own" ON user_organizations 
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. Users can delete their own entries
CREATE POLICY "policy_delete_own" ON user_organizations 
  FOR DELETE
  USING (user_id = auth.uid());

-- 4. Users can update their own entries
CREATE POLICY "policy_update_own" ON user_organizations
  FOR UPDATE
  USING (user_id = auth.uid());

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON user_organizations TO authenticated;

-- Verify what we've created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'user_organizations';
