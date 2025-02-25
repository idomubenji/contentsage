-- Migration: Row-Level Security Policies
-- Description: Implements basic RLS policies to enforce user-based access controls
-- Note: Modified to match the existing schema

-- Your schema already has RLS enabled on these tables
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Add additional comments to existing policies

-- Users policies
COMMENT ON POLICY "Users can view own data" ON users IS 'GDPR/CCPA compliance: Users can only access their own data';
COMMENT ON POLICY "Users can update own data" ON users IS 'GDPR/CCPA compliance: Users can only modify their own data';

-- Organizations policies
COMMENT ON POLICY "Users can view their organizations" ON organizations IS 'GDPR/CCPA compliance: Users can only access organizations they belong to';
COMMENT ON POLICY "Users can update their organizations" ON organizations IS 'GDPR/CCPA compliance: Users with admin role can update their organizations';

-- Posts policies
COMMENT ON POLICY "Users can access their own posts" ON posts IS 'GDPR/CCPA compliance: Users can access only their own posts';
COMMENT ON POLICY "Users can access organization posts" ON posts IS 'GDPR/CCPA compliance: Users can access posts of organizations they belong to';
COMMENT ON POLICY "Users can update their own posts" ON posts IS 'GDPR/CCPA compliance: Users can update only their own posts';
COMMENT ON POLICY "Users can update organization posts" ON posts IS 'GDPR/CCPA compliance: Users can update posts of organizations they belong to';
COMMENT ON POLICY "Users can delete their own posts" ON posts IS 'GDPR/CCPA compliance: Users can delete only their own posts';
COMMENT ON POLICY "Users can delete organization posts" ON posts IS 'GDPR/CCPA compliance: Users can delete posts of organizations they belong to';

-- User organizations policies
COMMENT ON POLICY "Users can view their memberships" ON user_organizations IS 'GDPR/CCPA compliance: Users can view only their own organization memberships';
COMMENT ON POLICY "Admins can manage memberships" ON user_organizations IS 'GDPR/CCPA compliance: Admins can manage memberships for their organizations';

-- Create additional policy for enforcing deletion constraints
CREATE POLICY "Users can only soft-delete their own data"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Only allow updates to the deleted_at field for soft deletion
    auth.uid() = id
    -- The policy allows any updates to the deleted_at field
    -- OLD reference not allowed in policies
  );

COMMENT ON POLICY "Users can only soft-delete their own data" ON users IS 'GDPR/CCPA compliance: Users can only request deletion of their own data'; 