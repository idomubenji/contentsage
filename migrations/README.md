# Supabase GDPR and CCPA Compliance Migrations

This directory contains SQL migrations to implement GDPR and CCPA compliance features in your Supabase database. These migrations have been adapted to work with your existing schema and are designed to be run in sequence through the Supabase SQL Editor.

## Migration Files Overview

1. **01_row_level_security.sql**
   - Updates existing Row-Level Security policies with GDPR/CCPA compliance comments
   - Creates additional policies for soft deletion

2. **02_user_consent.sql**
   - Creates tables for tracking explicit user consent
   - Implements history tracking for consent changes
   - Sets up RLS policies for consent management

3. **03_data_retention.sql**
   - Implements automated data deletion based on retention periods
   - Creates functions for anonymizing user data
   - Sets up user settings for data retention preferences

4. **04_audit_logging.sql**
   - Creates comprehensive audit logging for all data operations
   - Implements different handling for sensitive operations
   - Sets up audit triggers for all tables in your schema

5. **05_column_encryption.sql**
   - Implements column-level encryption for sensitive data
   - Creates a new `user_encrypted_data` table for storing encrypted personal information
   - Sets up key rotation capabilities

6. **06_default_encryption_keys.sql**
   - Inserts default encryption keys for testing
   - **WARNING:** Replace these keys in production!

26. **26_add_has_podcast_field.sql**
   - Adds a `has_podcast` boolean field to the posts table
   - Creates an index for efficient querying
   - Adds documentation explaining the field's purpose

27. **27_add_organization_info_field.sql**
   - Adds an `info` JSONb field to the organizations table for storing analytical information
   - Creates a GIN index for efficient querying of the JSONb content
   - Stores data about industry classification, descriptions from posts, strategy insights, and tone analysis

## How to Apply Migrations

1. Log in to your Supabase project
2. Go to the SQL Editor
3. Apply each migration file in numerical order
4. Review any errors or warnings and adjust as needed

### Important Notes

- **Test first**: Always test these migrations in a development environment before applying to production
- **Backup**: Make a database backup before applying migrations to production
- **Keys**: The default encryption keys provided in migration #6 are for testing only - generate secure keys for production

## Usage After Migration

### User Consent

Track user consent with:

```sql
-- Store consent when user agrees to terms
INSERT INTO user_consent (
  user_id, 
  marketing_emails, 
  data_analytics, 
  third_party_sharing, 
  consent_version
) VALUES (
  'user-uuid', 
  TRUE, 
  TRUE, 
  FALSE, 
  '1.0'
);

-- Check if user has given consent
SELECT * FROM user_consent WHERE user_id = 'user-uuid';

-- Update consent if user changes preferences
UPDATE user_consent 
SET marketing_emails = FALSE, updated_at = NOW() 
WHERE user_id = 'user-uuid';
```

### Encrypted Data

Store and retrieve encrypted data with:

```sql
-- Store encrypted data
INSERT INTO user_encrypted_data (
  user_id, 
  phone_encrypted, 
  address_encrypted, 
  notes_encrypted
) VALUES (
  'user-uuid', 
  '+1234567890', -- Will be automatically encrypted
  '123 Main St, City, Country', -- Will be automatically encrypted
  'Some private notes' -- Will be automatically encrypted
);

-- Retrieve decrypted data (using the view)
SELECT * FROM user_decrypted_data WHERE user_id = 'user-uuid';
```

### Data Deletion

To delete or anonymize user data:

```sql
-- Request anonymization
SELECT anonymize_user_data('user-uuid');

-- Complete deletion (more thorough)
SELECT delete_user_data_completely('user-uuid');

-- Or use the request system
INSERT INTO data_deletion_requests (
  user_id, 
  request_type, 
  notes
) VALUES (
  'user-uuid', 
  'ANONYMIZE', 
  'User requested account deletion via support ticket #12345'
);
```

### Organization Info Field

Store and retrieve organization analytical information with:

```sql
-- Add or update organization info
UPDATE organizations 
SET info = jsonb_set(
  COALESCE(info, '{}'::jsonb),
  '{industry}',
  '"Technology"'
)
WHERE id = 'org-uuid';

-- Add multiple fields at once
UPDATE organizations 
SET info = info || 
  '{
    "description": "A leading provider of cloud computing solutions...",
    "strategy": "Focuses on enterprise clients with emphasis on security...",
    "tone": "Professional, technical, and authoritative"
  }'::jsonb
WHERE id = 'org-uuid';

-- Query organizations by industry
SELECT * FROM organizations 
WHERE info->>'industry' = 'Technology';

-- Find organizations with specific keywords in description
SELECT * FROM organizations 
WHERE info->>'description' ILIKE '%cloud%';
```

## Maintenance Procedures

Follow these maintenance procedures:

1. Regularly monitor audit logs for unusual activity
2. Periodically rotate encryption keys
3. Review and process data deletion requests
4. Check for inactive users that should be anonymized

For any questions or issues, please review the SQL files for detailed comments on how each component works. 