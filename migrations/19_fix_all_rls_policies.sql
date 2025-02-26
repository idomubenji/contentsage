-- First, disable RLS temporarily to ensure policies are not causing issues during update
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Clear all policies on both tables
DROP POLICY IF EXISTS "Users can view their memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can view their own memberships" ON user_organizations; 
DROP POLICY IF EXISTS "Users can create their own membership" ON user_organizations;
DROP POLICY IF EXISTS "Users can create their own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage organization memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can see members in their organizations" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage all organization memberships" ON user_organizations;
DROP POLICY IF EXISTS "user_org_select_policy" ON user_organizations;
DROP POLICY IF EXISTS "user_org_insert_policy" ON user_organizations;
DROP POLICY IF EXISTS "admin_org_management_policy" ON user_organizations;

-- Check and drop any policies on organizations table that might be causing recursion
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON organizations;
DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_update_policy" ON organizations;

-- Re-enable RLS
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies for user_organizations

-- Allow users to SELECT from user_organizations with simple condition
CREATE POLICY "simple_user_org_select" ON user_organizations
  FOR SELECT
  TO authenticated
  USING (true);  -- Allow all SELECTs for authenticated users temporarily

-- Allow users to INSERT their own memberships
CREATE POLICY "simple_user_org_insert" ON user_organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to UPDATE/DELETE their own memberships only
CREATE POLICY "simple_user_org_update" ON user_organizations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "simple_user_org_delete" ON user_organizations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create simplified policies for organizations table
CREATE POLICY "simple_org_select" ON organizations
  FOR SELECT
  TO authenticated
  USING (true);  -- Allow all SELECTs for authenticated users

-- List all policies to confirm
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename IN ('user_organizations', 'organizations')
ORDER BY tablename, policyname; 