-- Migration: Data Retention and Automated Deletion
-- Description: Implements functions and procedures for handling data retention in compliance with GDPR/CCPA

-- First, install the pg_cron extension if not already installed
-- NOTE: This requires appropriate permissions and may require DB admin intervention
-- UNCOMMENT THE FOLLOWING LINE IF YOU HAVE PERMISSION TO CREATE EXTENSIONS
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add missing columns to the users table for anonymization support
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- Function to anonymize user data instead of hard deletion
CREATE OR REPLACE FUNCTION anonymize_user_data(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  random_email TEXT;
  random_name TEXT;
BEGIN
  -- Generate a random identifier for anonymization
  random_email := 'anonymized_' || uuid_generate_v4() || '@anonymous.com';
  random_name := 'Anonymized User';
  
  -- Update user table with anonymized data
  UPDATE users
  SET 
    email = random_email,
    name = random_name,
    is_anonymized = TRUE,
    anonymized_at = NOW()
  WHERE id = user_uuid;
  
  -- Record that the user has been anonymized
  INSERT INTO data_deletion_log (user_id, deletion_type, deleted_at)
  VALUES (user_uuid, 'ANONYMIZED', NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to completely delete user data
CREATE OR REPLACE FUNCTION delete_user_data_completely(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Record the deletion before deleting the user
  INSERT INTO data_deletion_log (user_id, deletion_type, deleted_at)
  VALUES (user_uuid, 'COMPLETE', NOW());

  -- Delete the user's posts
  DELETE FROM posts WHERE user_id = user_uuid;
  
  -- Delete the user's organization memberships
  DELETE FROM user_organizations WHERE user_id = user_uuid;
  
  -- Delete the user's consent records
  DELETE FROM user_consent WHERE user_id = user_uuid;
  
  -- Finally, delete the user record
  DELETE FROM users WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create a table to log data deletion for compliance purposes
CREATE TABLE IF NOT EXISTS data_deletion_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  deletion_type TEXT NOT NULL, -- 'COMPLETE' or 'ANONYMIZED'
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_reference TEXT, -- Optional reference to a deletion request
  performed_by TEXT -- Who performed the deletion (system or admin name)
);

-- Create a table to track deletion requests
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL, -- 'ANONYMIZE' or 'DELETE'
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'
  notes TEXT,
  UNIQUE (user_id, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create an index to enforce our business logic - only one pending/processing request per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pending_processing_requests 
ON data_deletion_requests (user_id) 
WHERE status IN ('PENDING', 'PROCESSING');

-- Create table for user settings (including auto cleanup preferences)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enable_auto_cleanup BOOLEAN DEFAULT FALSE,
  data_retention_days INTEGER DEFAULT 730, -- 2 years in days
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on the new tables
ALTER TABLE data_deletion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for the new tables
CREATE POLICY "Users can view their own deletion logs" 
  ON data_deletion_log
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own deletion requests" 
  ON data_deletion_requests
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deletion requests" 
  ON data_deletion_requests
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own settings" 
  ON user_settings
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
  ON user_settings
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
  ON user_settings
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Function to update the last_active_at timestamp
CREATE OR REPLACE FUNCTION update_last_active_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET last_active_at = NOW() WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the trigger to update last_active_at on user activity
CREATE TRIGGER update_user_last_active
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION update_last_active_timestamp();

-- Function to cleanup inactive user data automatically (based on user settings)
CREATE OR REPLACE FUNCTION cleanup_inactive_users()
RETURNS VOID AS $$
DECLARE
  inactive_user_record RECORD;
BEGIN
  -- Find users inactive for 2+ years with auto cleanup enabled
  FOR inactive_user_record IN 
    SELECT u.id 
    FROM users u
    JOIN user_settings s ON u.id = s.user_id
    WHERE 
      u.last_active_at < NOW() - INTERVAL '2 year' AND
      u.is_anonymized = FALSE AND
      s.enable_auto_cleanup = TRUE
  LOOP
    PERFORM anonymize_user_data(inactive_user_record.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired data based on retention policies
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS VOID AS $$
BEGIN
  -- Soft delete posts older than the retention period
  UPDATE posts
  SET deleted_at = NOW()
  WHERE created_at < NOW() - INTERVAL '2 years'
    AND deleted_at IS NULL;
  
  -- Mark deleted users as anonymized after a certain period
  UPDATE users
  SET 
    email = 'anonymized_' || id || '@anonymous.com',
    name = 'Anonymized User',
    is_anonymized = TRUE,
    anonymized_at = NOW()
  WHERE 
    deleted_at IS NOT NULL AND 
    deleted_at < NOW() - INTERVAL '30 days' AND
    is_anonymized = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Set up the cron jobs (requires pg_cron extension)
-- UNCOMMENT THESE WHEN READY TO IMPLEMENT SCHEDULED JOBS

-- Daily cleanup job at midnight
-- SELECT cron.schedule('0 0 * * *', 'SELECT cleanup_expired_data()');

-- Weekly inactive user check on Sundays at 1 AM
-- SELECT cron.schedule('0 1 * * 0', 'SELECT cleanup_inactive_users()');

COMMENT ON FUNCTION anonymize_user_data IS 'GDPR/CCPA compliant user data anonymization';
COMMENT ON FUNCTION delete_user_data_completely IS 'Complete user data deletion for GDPR/CCPA compliance';
COMMENT ON FUNCTION cleanup_inactive_users IS 'Automatic cleanup of long-inactive users';
COMMENT ON FUNCTION cleanup_expired_data IS 'Automatic deletion of expired data based on retention policies'; 