-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Admins can manage organization memberships" ON user_organizations;

-- Allow users to create their own memberships
CREATE POLICY "Users can create their own membership" ON user_organizations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to manage existing memberships in their organizations
CREATE POLICY "Admins can manage user memberships" ON user_organizations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_organizations 
    WHERE user_id = auth.uid() 
    AND organization_id = user_organizations.organization_id 
    AND role = 'admin'
  ));

-- Allow users to view memberships in their organizations
CREATE POLICY "Users can see members in their organizations" ON user_organizations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_organizations 
    WHERE user_id = auth.uid() 
    AND organization_id = user_organizations.organization_id
  ));