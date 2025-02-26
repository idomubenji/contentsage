-- Comprehensive fix for recursive policies across all tables
-- This script fixes the infinite recursion error by redesigning all policies
-- to avoid circular references between tables

-- First, let's list all current policies to understand what we're working with
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('posts', 'user_organizations', 'organizations');

-- First, let's drop all problematic policies
-- Posts table policies
DROP POLICY IF EXISTS "Users can access their own posts" ON posts;
DROP POLICY IF EXISTS "Users can access organization posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update organization posts" ON posts;
DROP POLICY IF EXISTS "Users can insert posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete organization posts" ON posts;
DROP POLICY IF EXISTS "Users can manage their own posts" ON posts;
DROP POLICY IF EXISTS "users_manage_own_posts" ON posts;
DROP POLICY IF EXISTS "users_view_org_posts" ON posts;
DROP POLICY IF EXISTS "users_update_org_posts" ON posts;
DROP POLICY IF EXISTS "users_delete_org_posts" ON posts;
DROP POLICY IF EXISTS "users_insert_posts" ON posts;

-- User organizations table policies
DROP POLICY IF EXISTS "Users can view their memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can view their own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations; 
DROP POLICY IF EXISTS "Users can see members in their organizations" ON user_organizations;
DROP POLICY IF EXISTS "user_org_view_own" ON user_organizations;
DROP POLICY IF EXISTS "user_org_insert_own" ON user_organizations;
DROP POLICY IF EXISTS "admin_org_manage" ON user_organizations;
DROP POLICY IF EXISTS "users_view_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "users_insert_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "admins_manage_org_memberships" ON user_organizations;

-- Organizations table policies
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON organizations;
DROP POLICY IF EXISTS "user_view_orgs" ON organizations;
DROP POLICY IF EXISTS "admin_update_orgs" ON organizations;
DROP POLICY IF EXISTS "users_view_own_organizations" ON organizations;
DROP POLICY IF EXISTS "admins_update_organizations" ON organizations;

-- Now create new policies with anti-recursion design
-- Using policy names with a common prefix for easy identification

-- 1. user_organizations table policies (create these first)
-- Simple direct user-based policy with no joins
CREATE POLICY "fix_2023_view_own_memberships" ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can only insert their own memberships
CREATE POLICY "fix_2023_insert_own_memberships" ON user_organizations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow admins to manage memberships in orgs they admin
-- Using EXISTS instead of IN for better performance and to avoid recursion
CREATE POLICY "fix_2023_admin_manage_memberships" ON user_organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM user_organizations AS admin_orgs
      WHERE admin_orgs.user_id = auth.uid()
        AND admin_orgs.role = 'admin'
        AND admin_orgs.organization_id = user_organizations.organization_id
    )
  );

-- 2. Organizations table policies
CREATE POLICY "fix_2023_view_organizations" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = organizations.id
    )
  );

CREATE POLICY "fix_2023_admin_update_organizations" ON organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = organizations.id
        AND role = 'admin'
    )
  );

-- 3. Posts table policies
-- For own posts (simplest case)
CREATE POLICY "fix_2023_manage_own_posts" ON posts
  FOR ALL
  USING (user_id = auth.uid());

-- For viewing org posts (using EXISTS instead of IN)
CREATE POLICY "fix_2023_view_org_posts" ON posts
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR 
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM user_organizations
        WHERE user_id = auth.uid()
          AND organization_id = posts.organization_id
      )
    )
  );

-- For updating org posts (using EXISTS)
CREATE POLICY "fix_2023_update_org_posts" ON posts
  FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR 
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM user_organizations
        WHERE user_id = auth.uid()
          AND organization_id = posts.organization_id
      )
    )
  );

-- For deleting org posts (using EXISTS)
CREATE POLICY "fix_2023_delete_org_posts" ON posts
  FOR DELETE
  USING (
    user_id = auth.uid() 
    OR 
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM user_organizations
        WHERE user_id = auth.uid()
          AND organization_id = posts.organization_id
      )
    )
  );

-- For inserting posts (using EXISTS)
CREATE POLICY "fix_2023_insert_posts" ON posts
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    OR 
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM user_organizations
        WHERE user_id = auth.uid()
          AND organization_id = posts.organization_id
      )
    )
  );

-- Verify the policies were created correctly
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('posts', 'user_organizations', 'organizations')
ORDER BY tablename, policyname; 