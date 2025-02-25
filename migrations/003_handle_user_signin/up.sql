-- Migration: handle_user_signin
-- Created at: 2023-07-14T00:00:00.000Z

-- Create a function to handle user sign-ins
CREATE OR REPLACE FUNCTION public.handle_user_signin()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user exists in our public.users table
  -- If not, insert them
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    auth.uid(),
    auth.email(),
    COALESCE(auth.email(), 'User'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function that can be called from client code
CREATE OR REPLACE FUNCTION public.sync_user_on_signin()
RETURNS void AS $$
BEGIN
  -- Insert the current user into our public.users table
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    auth.uid(),
    auth.email(),
    COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = auth.uid()), auth.email()),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a policy to allow users to call this function
DROP POLICY IF EXISTS "Allow users to sync themselves" ON public.users;
CREATE POLICY "Allow users to sync themselves" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Create a policy to allow users to update themselves
DROP POLICY IF EXISTS "Allow users to update themselves" ON public.users;
CREATE POLICY "Allow users to update themselves" ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid()); 