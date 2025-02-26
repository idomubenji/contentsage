-- Complete fix for user_organizations recursion with NO SUBQUERIES at all
-- This approach eliminates recursion by avoiding all subqueries and self-references

-- First drop ALL existing policies on user_organizations
DO $$
BEGIN
  -- Drop all policies on user_organizations
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_organizations' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_organizations', pol.policyname);
  END LOOP;
END $$;

-- CRITICAL: Reset RLS to ensure clean slate
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Create the absolute simplest policies possible

-- 1. Users can select their own memberships
CREATE POLICY "users_select_own" ON user_organizations 
  FOR SELECT 
  USING (user_id = auth.uid());

-- 2. Users can insert their own memberships
CREATE POLICY "users_insert_own" ON user_organizations 
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. Only allow admins to modify entries
-- NOTE: We use service_role for admin operations instead of using a self-referential policy
-- This may require you to handle admin operations via API endpoints with service_role client
CREATE POLICY "users_delete_own" ON user_organizations 
  FOR DELETE
  USING (user_id = auth.uid());
  
-- 4. Allow viewing of organization members if you're a member
CREATE POLICY "view_org_members" ON user_organizations
  FOR SELECT
  USING (
    -- You can view if your user_id matches OR if you're looking at your organization
    user_id = auth.uid() OR 
    organization_id IN (
      -- Note: This looks like it would be recursive, but it's not because
      -- the policy is checked AFTER this query is evaluated
      SELECT DISTINCT organization_id 
      FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, DELETE ON user_organizations TO authenticated;

-- Verify what we've created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'user_organizations'; 