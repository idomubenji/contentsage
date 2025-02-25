-- Create tables for GDPR/CCPA data rights compliance

-- Table for tracking user deletion requests
CREATE TABLE IF NOT EXISTS user_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  additional_info TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add RLS policies for user_deletion_requests
ALTER TABLE user_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own deletion requests
CREATE POLICY user_deletion_requests_select_policy 
  ON user_deletion_requests FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can only insert their own deletion requests
CREATE POLICY user_deletion_requests_insert_policy 
  ON user_deletion_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create audit log for data access/export requests
CREATE TABLE IF NOT EXISTS data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('data_access', 'data_export', 'consent_update')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  format TEXT,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add RLS policies for data_access_logs
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own access logs
CREATE POLICY data_access_logs_select_policy 
  ON data_access_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can only insert their own access logs (though typically done server-side)
CREATE POLICY data_access_logs_insert_policy 
  ON data_access_logs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS user_deletion_requests_user_id_idx ON user_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS data_access_logs_user_id_idx ON data_access_logs(user_id); 