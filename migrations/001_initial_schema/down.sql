-- Drop policies
DROP POLICY IF EXISTS "Users can access their own posts" ON posts;
DROP POLICY IF EXISTS "Users can access organization posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update organization posts" ON posts;
DROP POLICY IF EXISTS "Users can insert posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete organization posts" ON posts;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations;

-- Drop indexes
DROP INDEX IF EXISTS idx_posts_url;
DROP INDEX IF EXISTS idx_posts_user_id;
DROP INDEX IF EXISTS idx_posts_organization_id;
DROP INDEX IF EXISTS idx_posts_status;
DROP INDEX IF EXISTS idx_posts_title;

-- Drop tables
DROP TABLE IF EXISTS user_organizations;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS users; 