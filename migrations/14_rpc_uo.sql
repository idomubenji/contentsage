-- Function to safely insert a user-organization relationship
CREATE OR REPLACE FUNCTION insert_user_organization(
  p_user_id UUID,
  p_org_id UUID,
  p_role TEXT DEFAULT 'admin'
) RETURNS void AS $$
BEGIN
  -- Simple insert without any returns or selects to avoid trigger issues
  INSERT INTO user_organizations (user_id, organization_id, role)
  VALUES (p_user_id, p_org_id, p_role);
  
  -- No return needed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_user_organization TO authenticated;
GRANT EXECUTE ON FUNCTION insert_user_organization TO service_role;

-- Also check for and fix any problem triggers
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  -- Check if there are triggers on the user_organizations table
  FOR trigger_record IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'user_organizations'::regclass
  LOOP
    -- Log the trigger name
    RAISE NOTICE 'Found trigger: %', trigger_record.tgname;
    
    -- Optionally drop the trigger if it's causing issues
    -- EXECUTE 'DROP TRIGGER ' || trigger_record.tgname || ' ON user_organizations';
  END LOOP;
END $$;