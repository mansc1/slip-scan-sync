
-- Create enums
CREATE TYPE public.transaction_status AS ENUM ('pending_confirmation', 'confirmed', 'ignored', 'editing');
CREATE TYPE public.transaction_type AS ENUM ('transfer', 'bill_payment', 'merchant_payment', 'qr_payment', 'other');
CREATE TYPE public.payment_status AS ENUM ('success', 'failed', 'pending', 'unknown');
CREATE TYPE public.expense_category AS ENUM ('food', 'transport', 'shopping', 'bills', 'health', 'entertainment', 'education', 'travel', 'home', 'family', 'transfer', 'other');
CREATE TYPE public.sync_status AS ENUM ('pending', 'synced', 'failed', 'not_applicable');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Users table
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  line_user_id TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own record" ON public.users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own record" ON public.users FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own record" ON public.users FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to users" ON public.users FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  line_user_id TEXT,
  line_message_id TEXT UNIQUE,
  image_hash TEXT,
  status public.transaction_status NOT NULL DEFAULT 'pending_confirmation',
  transaction_type public.transaction_type DEFAULT 'other',
  payment_status public.payment_status DEFAULT 'unknown',
  amount NUMERIC(12, 2),
  currency TEXT DEFAULT 'THB',
  date_display TEXT,
  time_display TEXT,
  transaction_datetime_iso TIMESTAMP WITH TIME ZONE,
  payer_name TEXT,
  receiver_name TEXT,
  merchant_name TEXT,
  bank_name TEXT,
  reference_no TEXT,
  merchant_code TEXT,
  transaction_code TEXT,
  fee NUMERIC(12, 2) DEFAULT 0,
  category_guess public.expense_category DEFAULT 'other',
  category_final public.expense_category,
  confidence_score NUMERIC(3, 2),
  raw_ocr_text TEXT,
  raw_provider_response JSONB,
  parsed_result JSONB,
  source_image_url TEXT,
  drive_file_url TEXT,
  sheets_sync_status public.sync_status DEFAULT 'not_applicable',
  drive_sync_status public.sync_status DEFAULT 'not_applicable',
  notes TEXT,
  source TEXT DEFAULT 'line',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to transactions" ON public.transactions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_line_user_id ON public.transactions(line_user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_datetime ON public.transactions(transaction_datetime_iso);
CREATE INDEX idx_transactions_image_hash ON public.transactions(image_hash);

-- Transaction images table
CREATE TABLE public.transaction_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT DEFAULT 'image/jpeg',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transaction images" ON public.transaction_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can insert own transaction images" ON public.transaction_images FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "Service role full access to transaction_images" ON public.transaction_images FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Export jobs table
CREATE TABLE public.export_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'excel',
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT,
  params JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export jobs" ON public.export_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own export jobs" ON public.export_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Processed LINE messages for idempotency
CREATE TABLE public.processed_messages (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to processed_messages" ON public.processed_messages FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Private storage bucket for slip images
INSERT INTO storage.buckets (id, name, public) VALUES ('slip-images', 'slip-images', false);

CREATE POLICY "Authenticated users can upload slip images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'slip-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can view own slip images" ON storage.objects FOR SELECT
  USING (bucket_id = 'slip-images' AND auth.role() = 'authenticated');
CREATE POLICY "Service role full access to slip storage" ON storage.objects FOR ALL
  USING (bucket_id = 'slip-images' AND auth.jwt() ->> 'role' = 'service_role');
