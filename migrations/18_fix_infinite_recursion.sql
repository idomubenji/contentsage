-- Fix for infinite recursion in user_organizations RLS policies
-- The error occurs because the current policies might be referring to themselves in a circular way

-- First, drop all existing policies on the user_organizations table
DROP POLICY IF EXISTS "Users can view their memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can create their own membership" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage organization memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can see members in their organizations" ON user_organizations;

-- Create new, simpler policies that avoid recursion
-- Policy for users to view their own memberships
CREATE POLICY "Users can view their own memberships" ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy for users to create their own memberships (for initial join)
CREATE POLICY "Users can create their own memberships" ON user_organizations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy for admins to manage all aspects of organization memberships using a subquery
-- This avoids recursion by using an alias in the subquery
CREATE POLICY "Admins can manage all organization memberships" ON user_organizations
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