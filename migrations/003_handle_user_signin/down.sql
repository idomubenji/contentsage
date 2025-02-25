-- Migration: handle_user_signin (revert)
-- Created at: 2023-07-14T00:00:00.000Z

-- Drop the policies
DROP POLICY IF EXISTS "Allow users to sync themselves" ON public.users;
DROP POLICY IF EXISTS "Allow users to update themselves" ON public.users;

-- Drop the functions
DROP FUNCTION IF EXISTS public.handle_user_signin();
DROP FUNCTION IF EXISTS public.sync_user_on_signin(); 