-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create organizations table (if not exists)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create user_organizations junction table (if not exists)
CREATE TABLE IF NOT EXISTS user_organizations (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, organization_id)
);

-- Create posts table (if not exists)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  posted_date DATE,
  format TEXT,
  seo_info JSONB,
  seo_score JSONB,
  status TEXT CHECK (status IN ('POSTED', 'SCHEDULED', 'SUGGESTED')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
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

-- Create RLS policies for posts

-- Users can access their own posts
CREATE POLICY "Users can access their own posts" ON posts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can access organization posts
CREATE POLICY "Users can access organization posts" ON posts
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

-- Users can update their own posts
CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can update organization posts if they belong to the organization
CREATE POLICY "Users can update organization posts" ON posts
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

-- Users can insert posts for themselves or their organizations
CREATE POLICY "Users can insert posts" ON posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own posts (soft delete via application logic)
CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users can delete organization posts if they belong to the organization
CREATE POLICY "Users can delete organization posts" ON posts
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_url ON posts(url);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_organization_id ON posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_title ON posts(title);

-- Create RLS policies for users

-- Users can only see their own user data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own user data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Create RLS policies for organizations

-- Users can view organizations they belong to
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

-- Users can update organizations they belong to with admin role (future enhancement)
CREATE POLICY "Users can update their organizations" ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for user_organizations

-- Users can view their own organization memberships
CREATE POLICY "Users can view their memberships" ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- Replace the recursive policy with a simpler one
-- Users with admin role can manage their own organization memberships
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations;
CREATE POLICY "Admins can manage organization memberships" ON user_organizations
  FOR ALL
  USING (user_id = auth.uid() AND role = 'admin');

-- Create RLS policies for posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own posts
CREATE POLICY "Users can manage their own posts" ON posts
  FOR ALL
  USING (user_id = auth.uid());

-- Grant necessary privileges on posts and other tables
GRANT ALL ON posts TO postgres;
GRANT ALL ON posts TO anon;
GRANT ALL ON posts TO authenticated;
GRANT ALL ON posts TO service_role; 