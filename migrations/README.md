# Database Migrations

This folder contains database migrations for the Supabase schema.

## Migration Structure

Each migration is stored in a numbered folder (e.g., `001_initial_schema`) and contains:

- `up.sql`: SQL statements to apply the migration
- `down.sql`: SQL statements to revert the migration

## How to Apply Migrations

To apply a migration:

1. Go to the [Supabase dashboard](https://app.supabase.io)
2. Select your project
3. Go to the SQL Editor
4. Copy and paste the contents of the `up.sql` file for the migration you want to apply
5. Run the SQL script

## How to Revert Migrations

To revert a migration:

1. Go to the [Supabase dashboard](https://app.supabase.io)
2. Select your project
3. Go to the SQL Editor
4. Copy and paste the contents of the `down.sql` file for the migration you want to revert
5. Run the SQL script

## Migration History

- `001_initial_schema`: Initial database schema with users, organizations, posts, and their relationships
  - Creates tables: users, organizations, user_organizations, posts
  - Sets up Row Level Security (RLS) policies
  - Creates indexes for performance optimization 