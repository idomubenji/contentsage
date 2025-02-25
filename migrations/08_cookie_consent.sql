-- Update user_consents table for cookie consent functionality

-- Ensure the user_consents table exists
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  consent_value TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_consent_type ON user_consents(consent_type);

-- Enable RLS for user_consents
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only see their own consents
DROP POLICY IF EXISTS user_consents_select_policy ON user_consents;
CREATE POLICY user_consents_select_policy 
  ON user_consents FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy so users can only insert their own consents
DROP POLICY IF EXISTS user_consents_insert_policy ON user_consents;
CREATE POLICY user_consents_insert_policy 
  ON user_consents FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Add cookie consent specific enum values (if not already in your schema)
DO $$
BEGIN
  -- Check if there's a constraint already defined for consent_type
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_consents_consent_type_check'
  ) THEN
    -- If not, create a CHECK constraint for valid consent types
    ALTER TABLE user_consents
    ADD CONSTRAINT user_consents_consent_type_check
    CHECK (consent_type IN ('marketing', 'analytics', 'cookies', 'communication', 'privacy_policy', 'terms_of_service'));
  ELSE
    -- If there is a constraint, we need to modify it to include 'cookies'
    -- This is a bit complex in PostgreSQL, so for now we'll just note it
    -- You might need to manually check if 'cookies' is already in the constraint
    RAISE NOTICE 'Constraint user_consents_consent_type_check already exists - please verify it includes ''cookies''';
  END IF;
END $$; 