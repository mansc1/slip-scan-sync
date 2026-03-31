
-- Make user_id nullable on users table (LINE users won't have a Supabase Auth ID)
ALTER TABLE public.users ALTER COLUMN user_id DROP NOT NULL;

-- Add unique partial index on line_user_id for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS users_line_user_id_unique 
ON public.users (line_user_id) WHERE line_user_id IS NOT NULL;
