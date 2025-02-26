-- Option 1: Modify the audit trigger function to handle tables without 'id' field
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  record_id TEXT;
BEGIN
  -- Check if NEW has an 'id' field and use it if available, otherwise create a composite key
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Try to get id, or use a fallback for tables with composite keys
    BEGIN
      record_id := NEW.id::TEXT;
    EXCEPTION WHEN undefined_column THEN
      -- For user_organizations table, create a composite ID
      IF TG_TABLE_NAME = 'user_organizations' THEN
        record_id := NEW.user_id::TEXT || '-' || NEW.organization_id::TEXT;
      ELSE
        record_id := 'unknown';
      END IF;
    END;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      record_id := OLD.id::TEXT;
    EXCEPTION WHEN undefined_column THEN
      -- For user_organizations table, create a composite ID
      IF TG_TABLE_NAME = 'user_organizations' THEN
        record_id := OLD.user_id::TEXT || '-' || OLD.organization_id::TEXT;
      ELSE
        record_id := 'unknown';
      END IF;
    END;
  END IF;

  -- Rest of your audit function logic
  -- Insert audit records, etc.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Option 2: If you prefer, simply disable the trigger for this table
-- DROP TRIGGER IF EXISTS audit_trigger ON user_organizations;

-- Now try to insert the relationship again
INSERT INTO user_organizations (user_id, organization_id, role)
VALUES (
    '4ff0bfb3-7fa8-4a16-a4d6-699d686c8bc3', 
    'c8c60937-4648-448e-a141-2498e0834b3d', 
    'admin'
)
ON CONFLICT (user_id, organization_id) DO NOTHING;