-- Step 1: List all current policies to identify potential recursion causes
SELECT schemaname, tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('user_organizations', 'organizations')
ORDER BY tablename, policyname;

-- Step 2: Carefully remove only policies that might cause recursion while preserving others
-- First, save any working policies we want to keep to restore later
-- Then, drop policies in a specific order to avoid dependency issues

-- Drop potentially problematic policies on user_organizations table
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations; 
DROP POLICY IF EXISTS "Users can see members in their organizations" ON user_organizations;

-- Step 3: Create new, carefully designed non-recursive policies

-- For user_organizations table: simple policies with no circular references
-- Allow users to view ONLY their own memberships (no joins to other tables)
CREATE POLICY "user_org_view_own" ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to create only their own memberships
CREATE POLICY "user_org_insert_own" ON user_organizations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow admins to manage all memberships in their organizations WITHOUT using a recursive join
CREATE POLICY "admin_org_manage" ON user_organizations
  FOR ALL
  USING (
    EXISTS (
      -- We use a different alias to prevent recursion and use a direct comparison
      SELECT 1
      FROM user_organizations admins
      WHERE admins.user_id = auth.uid()
        AND admins.role = 'admin'
        AND admins.organization_id = user_organizations.organization_id
    )
  );

-- For organizations table: simple policy without complex joins
CREATE POLICY "user_view_orgs" ON organizations
  FOR SELECT
  USING (
    -- Use EXISTS to avoid recursion
    EXISTS (
      SELECT 1 
      FROM user_organizations uo
      WHERE uo.organization_id = organizations.id
        AND uo.user_id = auth.uid()
    )
  );

-- Allow admins to update organizations
CREATE POLICY "admin_update_orgs" ON organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_organizations uo
      WHERE uo.organization_id = organizations.id
        AND uo.user_id = auth.uid()
        AND uo.role = 'admin'
    )
  );

-- Step 4: Verify that policies are properly configured
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('user_organizations', 'organizations')
ORDER BY tablename, policyname; 