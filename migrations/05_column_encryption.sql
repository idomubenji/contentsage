-- Migration: Column-Level Encryption for Sensitive Data
-- Description: Implements functions for encrypting/decrypting sensitive data at the column level

-- First, install the pgcrypto extension if not already installed
-- This is required for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a secure table to store encryption keys
-- This should ideally be in a separate database with restricted access
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_name TEXT UNIQUE NOT NULL,
  encryption_key TEXT NOT NULL, -- Store securely, consider using Vault or similar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  key_version INT NOT NULL DEFAULT 1,
  notes TEXT
);

-- RLS for encryption keys table
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only database admins should access this table (using the organization role)
CREATE POLICY "Only admins can access encryption keys" ON encryption_keys
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_organizations.user_id = auth.uid()
      AND user_organizations.role = 'admin'
    )
  );

-- Create a user_roles view based on user_organizations for access control
CREATE OR REPLACE VIEW user_roles AS
  SELECT user_id, organization_id, role FROM user_organizations;

-- Function to get the current active encryption key
CREATE OR REPLACE FUNCTION get_encryption_key(key_name TEXT)
RETURNS TEXT AS $$
DECLARE
  enc_key TEXT;
BEGIN
  SELECT encryption_key INTO enc_key
  FROM encryption_keys
  WHERE key_name = $1 AND active = TRUE
  ORDER BY key_version DESC
  LIMIT 1;
  
  IF enc_key IS NULL THEN
    RAISE EXCEPTION 'No active encryption key found for %', key_name;
  END IF;
  
  RETURN enc_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to encrypt data
CREATE OR REPLACE FUNCTION encrypt_data(data TEXT, key_name TEXT DEFAULT 'default')
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Return NULL if data is NULL
  IF data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the encryption key
  encryption_key := get_encryption_key(key_name);
  
  -- Encrypt the data
  RETURN encode(
    pgp_sym_encrypt(
      data,
      encryption_key,
      'cipher-algo=aes256'
    )::bytea, 
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt data
CREATE OR REPLACE FUNCTION decrypt_data(encrypted_data TEXT, key_name TEXT DEFAULT 'default')
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- Return NULL if encrypted_data is NULL
  IF encrypted_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the encryption key
  encryption_key := get_encryption_key(key_name);
  
  -- Decrypt the data
  RETURN pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure (consider a proper error logging mechanism)
    RAISE WARNING 'Failed to decrypt data: %', SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to re-encrypt data with a new key
CREATE OR REPLACE FUNCTION reencrypt_data(encrypted_data TEXT, old_key_name TEXT, new_key_name TEXT)
RETURNS TEXT AS $$
DECLARE
  decrypted_data TEXT;
BEGIN
  -- Decrypt with old key
  decrypted_data := decrypt_data(encrypted_data, old_key_name);
  
  -- Encrypt with new key
  RETURN encrypt_data(decrypted_data, new_key_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a view with automatically decrypted columns
CREATE OR REPLACE PROCEDURE create_decrypted_view(
  table_name TEXT,
  view_name TEXT,
  encrypted_columns TEXT[], -- Array of column names that are encrypted
  key_names TEXT[] DEFAULT NULL -- Array of key names, one per encrypted column
)
LANGUAGE plpgsql AS $$
DECLARE
  sql_query TEXT := 'CREATE OR REPLACE VIEW ' || view_name || ' AS SELECT ';
  column_list TEXT := '';
  col_name TEXT;
  key_name TEXT;
  i INT;
BEGIN
  -- Get list of all columns
  FOR col_name IN 
    SELECT column_name FROM information_schema.columns 
    WHERE information_schema.columns.table_name = create_decrypted_view.table_name
  LOOP
    -- Check if this column is encrypted
    i := array_position(encrypted_columns, col_name);
    
    IF i IS NOT NULL THEN
      -- This is an encrypted column
      IF key_names IS NOT NULL AND i <= array_length(key_names, 1) THEN
        key_name := key_names[i];
      ELSE
        key_name := 'default';
      END IF;
      
      -- Add decryption function
      column_list := column_list || 'decrypt_data(' || col_name || ', ''' || key_name || ''') AS ' || col_name || ', ';
    ELSE
      -- This is a regular column
      column_list := column_list || col_name || ', ';
    END IF;
  END LOOP;
  
  -- Remove trailing comma and space
  column_list := substring(column_list, 1, length(column_list) - 2);
  
  -- Complete the query
  sql_query := sql_query || column_list || ' FROM ' || table_name || ';';
  
  -- Execute the query
  EXECUTE sql_query;
  
  RAISE NOTICE 'Created view % for table % with decrypted columns: %', view_name, table_name, encrypted_columns;
END;
$$;

-- Create a table for storing encrypted user data
CREATE TABLE IF NOT EXISTS user_encrypted_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_encrypted TEXT, -- Will store encrypted data
  address_encrypted TEXT, -- Will store encrypted data
  notes_encrypted TEXT, -- Will store encrypted data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create RLS policy for the table
ALTER TABLE user_encrypted_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view only their own encrypted data"
  ON user_encrypted_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update only their own encrypted data"
  ON user_encrypted_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own encrypted data"
  ON user_encrypted_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create a view that automatically decrypts the data
CALL create_decrypted_view(
  'user_encrypted_data',
  'user_decrypted_data',
  ARRAY['phone_encrypted', 'address_encrypted', 'notes_encrypted'],
  ARRAY['phone_key', 'address_key', 'notes_key']
);

-- Create an INSERT trigger to automatically encrypt data
CREATE OR REPLACE FUNCTION encrypt_user_data_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any of the sensitive fields need encryption
  IF NEW.phone_encrypted IS NOT NULL AND NOT NEW.phone_encrypted LIKE 'LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0t%' THEN
    NEW.phone_encrypted := encrypt_data(NEW.phone_encrypted, 'phone_key');
  END IF;
  
  IF NEW.address_encrypted IS NOT NULL AND NOT NEW.address_encrypted LIKE 'LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0t%' THEN
    NEW.address_encrypted := encrypt_data(NEW.address_encrypted, 'address_key');
  END IF;
  
  IF NEW.notes_encrypted IS NOT NULL AND NOT NEW.notes_encrypted LIKE 'LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0t%' THEN
    NEW.notes_encrypted := encrypt_data(NEW.notes_encrypted, 'notes_key');
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER encrypt_user_data
BEFORE INSERT OR UPDATE ON user_encrypted_data
FOR EACH ROW EXECUTE FUNCTION encrypt_user_data_trigger();

-- Procedure to rotate encryption keys
CREATE OR REPLACE PROCEDURE rotate_encryption_key(old_key_name TEXT, new_key_value TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  old_key TEXT;
  table_record RECORD;
  column_record RECORD;
  update_sql TEXT;
  new_key_version INT;
  new_key_id UUID;
BEGIN
  -- Get the old key
  SELECT encryption_key INTO old_key
  FROM encryption_keys
  WHERE key_name = old_key_name AND active = TRUE
  ORDER BY key_version DESC
  LIMIT 1;
  
  IF old_key IS NULL THEN
    RAISE EXCEPTION 'No active encryption key found for %', old_key_name;
  END IF;
  
  -- Create a new key with incremented version
  SELECT COALESCE(MAX(key_version), 0) + 1 INTO new_key_version
  FROM encryption_keys
  WHERE key_name = old_key_name;
  
  -- Insert the new key
  INSERT INTO encryption_keys (key_name, encryption_key, key_version)
  VALUES (old_key_name, new_key_value, new_key_version)
  RETURNING id INTO new_key_id;
  
  -- Mark old key as inactive
  UPDATE encryption_keys
  SET active = FALSE
  WHERE key_name = old_key_name AND id != new_key_id;
  
  -- Re-encrypt data in all tables that use this key
  -- This part requires knowledge of which tables/columns use this key
  -- For each table and column, we'll need to update with reencrypted data
  
  -- This is just an example - you would need to populate a table that tracks
  -- which tables and columns use which encryption keys
  FOR table_record IN 
    SELECT table_name, column_name
    FROM encrypted_columns_registry
    WHERE key_name = old_key_name
  LOOP
    update_sql := 'UPDATE ' || table_record.table_name || 
                  ' SET ' || table_record.column_name || ' = reencrypt_data(' ||
                  table_record.column_name || ', ''' || old_key_name || ''', ''' || old_key_name || ''')' ||
                  ' WHERE ' || table_record.column_name || ' IS NOT NULL';
    
    EXECUTE update_sql;
  END LOOP;
  
  RAISE NOTICE 'Rotated encryption key: % (old version deactivated, new version %)', old_key_name, new_key_version;
END;
$$;

-- Create a registry table to track which columns are encrypted with which keys
CREATE TABLE IF NOT EXISTS encrypted_columns_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  key_name TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (table_name, column_name)
);

-- Enable RLS on registry
ALTER TABLE encrypted_columns_registry ENABLE ROW LEVEL SECURITY;

-- Only admins can view encryption registry
CREATE POLICY "Only admins can view encryption registry" ON encrypted_columns_registry
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_organizations.user_id = auth.uid()
      AND user_organizations.role = 'admin'
    )
  );

-- Function to register an encrypted column
CREATE OR REPLACE FUNCTION register_encrypted_column(
  p_table_name TEXT,
  p_column_name TEXT,
  p_key_name TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO encrypted_columns_registry (table_name, column_name, key_name)
  VALUES (p_table_name, p_column_name, p_key_name)
  ON CONFLICT (table_name, column_name) 
  DO UPDATE SET key_name = p_key_name;
END;
$$ LANGUAGE plpgsql;

-- Register our encrypted columns
SELECT register_encrypted_column('user_encrypted_data', 'phone_encrypted', 'phone_key');
SELECT register_encrypted_column('user_encrypted_data', 'address_encrypted', 'address_key');
SELECT register_encrypted_column('user_encrypted_data', 'notes_encrypted', 'notes_key'); 