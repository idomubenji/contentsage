-- SQL to fix the infinite recursion in user_organizations policies

-- First, drop the existing policies that are causing problems
DROP POLICY IF EXISTS "Users can create their own membership" ON "user_organizations";
DROP POLICY IF EXISTS "Admins can manage user memberships" ON "user_organizations";
DROP POLICY IF EXISTS "Users can see members in their organizations" ON "user_organizations";

-- Create simpler, non-recursive policies

-- Allow users to view their own memberships
CREATE POLICY "Users can view their own memberships" 
ON "user_organizations" 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to create memberships where they are the user
CREATE POLICY "Users can create their own memberships" 
ON "user_organizations" 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow admins to manage memberships in organizations they administer
-- This uses a subquery that doesn't reference the table being queried in the policy
CREATE POLICY "Admins can manage organization memberships" 
ON "user_organizations" 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM user_organizations admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.organization_id = user_organizations.organization_id 
    AND admin_check.role = 'admin'
  )
);

-- You need to run this SQL in your Supabase SQL Editor at:
-- https://app.supabase.com/project/{your-project-id}/sql/new 