-- Migration: User Consent Management
-- Description: Creates tables and functions for tracking user consent for GDPR/CCPA compliance

-- Create a table to store user consent records
CREATE TABLE IF NOT EXISTS user_consent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  marketing_emails BOOLEAN DEFAULT FALSE,
  data_analytics BOOLEAN DEFAULT FALSE,
  third_party_sharing BOOLEAN DEFAULT FALSE,
  consent_version TEXT NOT NULL, -- Track which version of your privacy policy they consented to
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add index for quick lookups by user
CREATE INDEX IF NOT EXISTS user_consent_user_id_idx ON user_consent(user_id);

-- Enable Row Level Security on consent table
ALTER TABLE user_consent ENABLE ROW LEVEL SECURITY;

-- Create policies for user_consent table
CREATE POLICY "Users can view their own consent" 
  ON user_consent
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own consent" 
  ON user_consent
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent" 
  ON user_consent
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create a function to update the consent timestamp whenever it changes
CREATE OR REPLACE FUNCTION update_user_consent_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update timestamps
CREATE TRIGGER update_user_consent_timestamp
BEFORE UPDATE ON user_consent
FOR EACH ROW
EXECUTE FUNCTION update_user_consent_timestamp();

-- Create a table to track consent history for auditing purposes
CREATE TABLE IF NOT EXISTS user_consent_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  consent_id UUID NOT NULL REFERENCES user_consent(id) ON DELETE CASCADE,
  marketing_emails BOOLEAN,
  data_analytics BOOLEAN,
  third_party_sharing BOOLEAN,
  consent_version TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for consent history
CREATE INDEX IF NOT EXISTS user_consent_history_user_id_idx ON user_consent_history(user_id);

-- Create a function to record consent changes
CREATE OR REPLACE FUNCTION log_user_consent_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO user_consent_history(
      user_id, consent_id, marketing_emails, data_analytics, 
      third_party_sharing, consent_version, change_type
    ) VALUES (
      NEW.user_id, NEW.id, NEW.marketing_emails, NEW.data_analytics,
      NEW.third_party_sharing, NEW.consent_version, 'CREATE'
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO user_consent_history(
      user_id, consent_id, marketing_emails, data_analytics, 
      third_party_sharing, consent_version, change_type
    ) VALUES (
      NEW.user_id, NEW.id, NEW.marketing_emails, NEW.data_analytics,
      NEW.third_party_sharing, NEW.consent_version, 'UPDATE'
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO user_consent_history(
      user_id, consent_id, marketing_emails, data_analytics, 
      third_party_sharing, consent_version, change_type
    ) VALUES (
      OLD.user_id, OLD.id, OLD.marketing_emails, OLD.data_analytics,
      OLD.third_party_sharing, OLD.consent_version, 'DELETE'
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to log all consent changes
CREATE TRIGGER log_user_consent_changes
AFTER INSERT OR UPDATE OR DELETE ON user_consent
FOR EACH ROW EXECUTE FUNCTION log_user_consent_changes();

-- Enable RLS on consent history
ALTER TABLE user_consent_history ENABLE ROW LEVEL SECURITY;

-- Create policy for consent history
CREATE POLICY "Users can view their own consent history" 
  ON user_consent_history
  FOR SELECT 
  USING (auth.uid() = user_id); 