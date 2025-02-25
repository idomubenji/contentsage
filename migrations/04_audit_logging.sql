-- Migration: Audit Logging for GDPR/CCPA Compliance
-- Description: Implements comprehensive audit logging for sensitive data access and modifications

-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID, -- Can be NULL for system operations or when auth.uid() is not available
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'SELECT', etc.
  table_name TEXT NOT NULL,
  record_id TEXT, -- Primary key of the affected record
  old_data JSONB, -- Previous state for updates/deletes
  new_data JSONB, -- New state for inserts/updates
  ip_address TEXT, -- IP address if available
  user_agent TEXT, -- User agent if available
  app_context TEXT, -- Context of the operation (e.g., 'admin-panel', 'api', 'mobile-app')
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);

-- Function to get client information
CREATE OR REPLACE FUNCTION get_client_info()
RETURNS JSONB AS $$
DECLARE
  client_info JSONB;
BEGIN
  -- Get available client info from current_setting if possible
  BEGIN
    client_info := jsonb_build_object(
      'ip_address', current_setting('request.headers')::jsonb->>'x-forwarded-for',
      'user_agent', current_setting('request.headers')::jsonb->>'user-agent'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback when not available
    client_info := jsonb_build_object(
      'ip_address', NULL,
      'user_agent', NULL
    );
  END;
  
  RETURN client_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  client_info JSONB;
  record_id TEXT;
  masked_old_data JSONB := NULL;
  masked_new_data JSONB := NULL;
BEGIN
  -- Get client information
  client_info := get_client_info();
  
  -- Determine the record ID (assumes 'id' is the PK column - adjust if needed)
  IF TG_OP = 'DELETE' THEN
    record_id := OLD.id::TEXT;
  ELSE
    record_id := NEW.id::TEXT;
  END IF;
  
  -- Mask sensitive data in JSON representations
  -- This is a simple example - expand based on your data model
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    masked_old_data := to_jsonb(OLD);
    
    -- Mask sensitive fields if present
    IF masked_old_data ? 'password' THEN
      masked_old_data := masked_old_data - 'password' || jsonb_build_object('password', '********');
    END IF;
    
    IF masked_old_data ? 'email' THEN
      masked_old_data := masked_old_data - 'email' || 
                         jsonb_build_object('email', substring(masked_old_data->>'email', 1, 2) || '***@' || 
                                           split_part(masked_old_data->>'email', '@', 2));
    END IF;
  END IF;
  
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    masked_new_data := to_jsonb(NEW);
    
    -- Mask sensitive fields if present
    IF masked_new_data ? 'password' THEN
      masked_new_data := masked_new_data - 'password' || jsonb_build_object('password', '********');
    END IF;
    
    IF masked_new_data ? 'email' THEN
      masked_new_data := masked_new_data - 'email' || 
                         jsonb_build_object('email', substring(masked_new_data->>'email', 1, 2) || '***@' || 
                                           split_part(masked_new_data->>'email', '@', 2));
    END IF;
  END IF;

  -- Insert into audit log
  INSERT INTO audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent,
    app_context
  ) VALUES (
    auth.uid(), -- Current user ID from Supabase auth
    TG_OP,
    TG_TABLE_NAME,
    record_id,
    masked_old_data,
    masked_new_data,
    client_info->>'ip_address',
    client_info->>'user_agent',
    current_setting('app.context', true)
  );
  
  RETURN NULL; -- For AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Special audit trigger function for sensitive operations (like password changes)
CREATE OR REPLACE FUNCTION sensitive_audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  client_info JSONB;
  record_id TEXT;
BEGIN
  -- Get client information
  client_info := get_client_info();
  
  -- Determine the record ID
  IF TG_OP = 'DELETE' THEN
    record_id := OLD.id::TEXT;
  ELSE
    record_id := NEW.id::TEXT;
  END IF;

  -- For sensitive operations, we store minimal data
  -- We don't store old_data or new_data at all
  INSERT INTO audit_logs (
    user_id, 
    action, 
    table_name, 
    record_id,
    ip_address,
    user_agent,
    app_context
  ) VALUES (
    auth.uid(),
    TG_OP || '_SENSITIVE', -- Mark as sensitive operation
    TG_TABLE_NAME,
    record_id,
    client_info->>'ip_address',
    client_info->>'user_agent',
    current_setting('app.context', true)
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create stored procedure to apply audit triggers to a table
CREATE OR REPLACE PROCEDURE apply_audit_triggers(
  target_table TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql AS $$
DECLARE
  trigger_function TEXT;
BEGIN
  -- Choose appropriate trigger function based on sensitivity
  IF is_sensitive THEN
    trigger_function := 'sensitive_audit_trigger_function()';
  ELSE
    trigger_function := 'audit_trigger_function()';
  END IF;

  -- Create the trigger
  EXECUTE format('
    DROP TRIGGER IF EXISTS audit_trigger ON %I;
    CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON %I
    FOR EACH ROW EXECUTE FUNCTION %s;
  ', target_table, target_table, trigger_function);
  
  RAISE NOTICE 'Audit trigger applied to table: %', target_table;
END;
$$;

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own audit logs (with admin exceptions)
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_organizations.user_id = auth.uid()
      AND user_organizations.role = 'admin'
    )
  );

-- Apply audit triggers to relevant tables in the actual schema
CALL apply_audit_triggers('users');
CALL apply_audit_triggers('organizations');
CALL apply_audit_triggers('user_organizations');
CALL apply_audit_triggers('posts');
CALL apply_audit_triggers('user_consent');
CALL apply_audit_triggers('user_consent_history');
CALL apply_audit_triggers('data_deletion_log');
CALL apply_audit_triggers('data_deletion_requests');
CALL apply_audit_triggers('user_settings');

-- Create a function to set application context
-- This can be called at the start of an API request
CREATE OR REPLACE FUNCTION set_app_context(context TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.context', context, FALSE);
END;
$$ LANGUAGE plpgsql; 