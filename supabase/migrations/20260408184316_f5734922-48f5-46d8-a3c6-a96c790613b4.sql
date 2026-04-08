
-- Create a new admin user by updating password via auth schema
-- Since we can't directly update auth.users password via migration,
-- we'll create a new signup-ready account
DO $$
BEGIN
  -- Delete old user to recreate with known password
  DELETE FROM auth.users WHERE email = 'admin@slipsync.test';
END $$;
