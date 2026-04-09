
-- 1. Create admin_users table
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only service role can manage admin_users
CREATE POLICY "Service role full access to admin_users"
  ON public.admin_users FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- Admins can read their own record (to check if they are admin)
CREATE POLICY "Users can check own admin status"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Helper function to check admin status (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = _user_id
  )
$$;

-- 3. Fix transactions RLS: replace the overly permissive policy
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4. Fix storage policies: scope to owner path
DROP POLICY IF EXISTS "Users can view own slip images" ON storage.objects;
CREATE POLICY "Users can view own slip images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'slip-images'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (auth.jwt() ->> 'role') = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload slip images" ON storage.objects;
CREATE POLICY "Authenticated users can upload slip images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'slip-images'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (auth.jwt() ->> 'role') = 'service_role'
    )
  );
