-- Allow any authenticated user to create a new organization
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Alternatively, if you want to limit organization creation to users with specific roles or attributes
-- you can modify the policy like this (commented out as an example):
-- CREATE POLICY "Users can create organizations" ON organizations
--   FOR INSERT
--   WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE some_attribute = true)); 