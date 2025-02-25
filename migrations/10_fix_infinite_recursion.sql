-- Fix infinite recursion in user_organizations policies
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organizations;

-- Create a simpler policy that avoids recursion
CREATE POLICY "Admins can manage organization memberships" ON user_organizations
  FOR ALL
  USING (user_id = auth.uid() AND role = 'admin');

-- Ensure posts table has proper RLS
-- First check if the policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'posts' AND policyname = 'Users can manage their own posts'
  ) THEN
    -- Create a simpler direct policy for posts
    CREATE POLICY "Users can manage their own posts" ON posts
      FOR ALL
      USING (user_id = auth.uid());
  END IF;
END
$$;

-- Ensure proper privileges
GRANT ALL ON posts TO postgres;
GRANT ALL ON posts TO anon;
GRANT ALL ON posts TO authenticated;
GRANT ALL ON posts TO service_role;