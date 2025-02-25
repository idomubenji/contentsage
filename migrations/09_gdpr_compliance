-- Migration file: audit_logging_system_fix.sql

-- 1. Create the audit_logs table with all required columns
CREATE TABLE IF NOT EXISTS auth.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  action text,
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  app_context text
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON auth.audit_logs (user_id);

-- 2. Create the client info function (required for logging)
CREATE OR REPLACE FUNCTION auth.get_client_info()
RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'ip_address', current_setting('request.headers')::jsonb->>'x-forwarded-for',
    'user_agent', current_setting('request.headers')::jsonb->>'user-agent'
  );
EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'ip_address', null,
      'user_agent', null
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the audit log function
CREATE OR REPLACE FUNCTION auth.add_audit_log(
  user_id uuid,
  payload jsonb,
  ip_address text DEFAULT NULL,
  user_agent text DEFAULT NULL,
  action text DEFAULT NULL,
  table_name text DEFAULT NULL,
  record_id text DEFAULT NULL,
  old_data jsonb DEFAULT NULL,
  new_data jsonb DEFAULT NULL,
  app_context text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO auth.audit_logs (
    user_id, payload, ip_address, user_agent, action, 
    table_name, record_id, old_data, new_data, app_context
  )
  VALUES (
    user_id, payload, ip_address, user_agent, 
    COALESCE(action, payload->>'action'), table_name, 
    record_id, old_data, new_data, app_context
  );
EXCEPTION 
  WHEN others THEN
    -- Log but don't fail if audit logging fails
    RAISE NOTICE 'Failed to add audit log: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the user sign-in handler function
CREATE OR REPLACE FUNCTION auth.handle_user_sign_in()
RETURNS trigger AS $$
DECLARE
  old_user_data jsonb;
  new_user_data jsonb;
  app_ctx text;
  user_id_val uuid;
BEGIN
  -- Get user ID safely
  user_id_val := auth.uid();
  
  -- Get the old user data before update
  SELECT to_jsonb(u) INTO old_user_data 
  FROM auth.users u
  WHERE id = user_id_val;

  -- Update the user's last sign-in timestamp
  UPDATE auth.users
  SET last_sign_in_at = now()
  WHERE id = user_id_val;
  
  -- Get the new user data after update
  SELECT to_jsonb(u) INTO new_user_data 
  FROM auth.users u
  WHERE id = user_id_val;
  
  -- Create application context info as text
  app_ctx := '{"timestamp":"' || now() || '","service":"auth","method":"user_sign_in"}';
  
  -- Try to add audit log
  BEGIN
    PERFORM auth.add_audit_log(
      user_id_val,
      jsonb_build_object('action', 'sign_in'),
      (auth.get_client_info()->>'ip_address'),
      (auth.get_client_info()->>'user_agent'),
      'sign_in',
      'auth.users',
      user_id_val::text,
      old_user_data,
      new_user_data,
      app_ctx
    );
  EXCEPTION WHEN others THEN
    -- Just log the error
    RAISE NOTICE 'Failed to log user sign-in: %', SQLERRM;
  END;
  
  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Failed to update user sign-in: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure triggers are properly set up
DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION auth.handle_user_sign_in();