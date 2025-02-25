-- Migration: Default Encryption Keys
-- Description: Inserts default encryption keys for testing purposes
-- WARNING: In production, use proper key management and generate secure random keys!

-- Only run this in development/testing environments!
-- In production, keys should be securely generated and managed

-- Insert default encryption key for phone numbers
INSERT INTO encryption_keys (key_name, encryption_key, notes)
VALUES (
  'phone_key', 
  'PhoneEncryptionKey2024!DevTest', -- Change this for production!
  'Default testing key for phone numbers - REPLACE IN PRODUCTION'
)
ON CONFLICT (key_name) 
DO UPDATE SET notes = 'Key already exists - no changes made';

-- Insert default encryption key for addresses
INSERT INTO encryption_keys (key_name, encryption_key, notes)
VALUES (
  'address_key', 
  'AddressEncryptionKey2024!DevTest', -- Change this for production!
  'Default testing key for address data - REPLACE IN PRODUCTION'
)
ON CONFLICT (key_name) 
DO UPDATE SET notes = 'Key already exists - no changes made';

-- Insert default encryption key for notes
INSERT INTO encryption_keys (key_name, encryption_key, notes)
VALUES (
  'notes_key', 
  'NotesEncryptionKey2024!DevTest', -- Change this for production!
  'Default testing key for notes data - REPLACE IN PRODUCTION'
)
ON CONFLICT (key_name) 
DO UPDATE SET notes = 'Key already exists - no changes made';

-- Default general purpose key
INSERT INTO encryption_keys (key_name, encryption_key, notes)
VALUES (
  'default', 
  'DefaultEncryptionKey2024!DevTest', -- Change this for production!
  'Default general purpose key - REPLACE IN PRODUCTION'
)
ON CONFLICT (key_name) 
DO UPDATE SET notes = 'Key already exists - no changes made';

-- Log message
DO $$
BEGIN
  RAISE NOTICE 'Default encryption keys created for testing. DO NOT USE THESE IN PRODUCTION!';
END $$; 