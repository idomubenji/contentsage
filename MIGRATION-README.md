# Supabase Migration for GDPR Compliance

This document outlines the process for migrating your Supabase project to a European region for GDPR compliance.

## Prerequisites

- Node.js installed
- Access to both your current Supabase project and the ability to create a new one
- Supabase service role keys for both projects

## Migration Steps

### 1. Create a New Supabase Project in Europe

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click on "New Project"
3. Fill in the project details
4. For "Region", select one of the European regions:
   - `eu-central-1` (Frankfurt)
   - `eu-west-1` (London)
   - `eu-west-2` (Ireland)
5. Complete the project creation

### 2. Set Up Environment Variables

1. Copy the `.env.migration` template file:
   ```
   cp .env.migration .env.migration.local
   ```

2. Edit `.env.migration.local` with your Supabase project details:
   - Current (source) project URL and service role key
   - New EU (target) project URL and service role key

### 3. Install Dependencies

```
npm install dotenv @supabase/supabase-js
```

### 4. Export Data from Your Current Project

```
node migrate-supabase.js
```

This script will:
- Export schemas and data for all tables
- Download storage bucket files
- Save everything to a `supabase-migration` directory

### 5. Import Data to Your New EU Project

```
node setup-new-supabase.js
```

This script will:
- Create tables in your new EU Supabase project
- Import data from the exported files
- Create storage buckets and upload files

### 6. Update Your Application

Update your environment variables with the new Supabase project details:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-new-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-new-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
```

### 7. Deploy Your Updated Application

Deploy your application with the new environment variables.

## Troubleshooting

- **RPC Function Errors**: If you encounter errors with the `pgclient_execute` RPC function, you may need to create this function in your new Supabase project. Use the SQL Editor to run:

```sql
CREATE OR REPLACE FUNCTION pgclient_execute(query text)
RETURNS json AS $$
BEGIN
    RETURN json_build_object('result', query);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- **Storage Bucket Permissions**: After migration, review the permissions on your storage buckets to ensure they match your security requirements.

- **Auth Settings**: Double-check your authentication settings in the new Supabase project, including email templates, OAuth providers, and other auth-related configurations.

## Migration Verification

After migration, perform the following checks:

1. Verify user authentication works
2. Confirm data access permissions are correctly set
3. Test all features that use Supabase storage
4. Validate that any external integrations are working correctly 