-- First, list all policies on the user_organizations table to see what exists
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'user_organizations';

-- Drop ALL existing policies on the user_organizations table by name
-- We're being explicit with each policy that might exist to ensure complete cleanup
DROP POLICY IF EXISTS "Users can view their memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can view their own memberships" ON user_organizations; 
DROP POLICY IF EXISTS "Users can create their own membership" ON user_organizations;
DROP POLICY IF EXISTS "Users can create their own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage organization memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can see members in their organizations" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage all organization memberships" ON user_organizations;

-- List policies again to confirm all are gone
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'user_organizations';

-- Create new policies with unique names to avoid conflicts
-- Policy for SELECT operations - different name to avoid conflicts
CREATE POLICY "user_org_select_policy" ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy for INSERT operations with a unique name
CREATE POLICY "user_org_insert_policy" ON user_organizations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy for admins to manage organization memberships using a subquery to avoid recursion
CREATE POLICY "admin_org_management_policy" ON user_organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM user_organizations AS uo
      WHERE uo.user_id = auth.uid()
        AND uo.role = 'admin'
        AND uo.organization_id = user_organizations.organization_id
    )
  );

-- List all policies to confirm the new ones are in place
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'user_organizations';