ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'other';

COMMENT ON COLUMN public.transactions.payment_method IS 'Payment method: cash, transfer, card, other';