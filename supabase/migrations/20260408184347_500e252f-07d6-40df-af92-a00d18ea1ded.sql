
-- Reset password for mansc@hotmail.com to 'Admin1234!'
-- Using crypt with bf algorithm
UPDATE auth.users 
SET encrypted_password = crypt('Admin1234!', gen_salt('bf'))
WHERE email = 'mansc@hotmail.com';
