-- Allow authenticated dashboard users (admins) to view ALL transactions including LINE-created ones with user_id=null
CREATE POLICY "Admins can view all transactions"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (true);
