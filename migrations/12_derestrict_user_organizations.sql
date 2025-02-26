-- Drop the restrictive policy
DROP POLICY IF EXISTS "Admins can manage organization memberships" ON user_organizations;

-- Create a more permissive policy for insertions
CREATE POLICY "Users can create their own organization membership" ON user_organizations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
  
-- Keep the admin-only policy for other operations
CREATE POLICY "Admins can manage existing memberships" ON user_organizations
  FOR UPDATE OR DELETE
  USING (user_id = auth.uid() AND role = 'admin');