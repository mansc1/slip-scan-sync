-- Function: find_duplicate_candidates
CREATE OR REPLACE FUNCTION public.find_duplicate_candidates(
  _owner_user_id uuid,
  _owner_line_user_id text,
  _amount numeric,
  _datetime timestamptz,
  _merchant text,
  _reference_no text,
  _image_hash text,
  _exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (
  match_type text,
  transaction_id uuid,
  amount numeric,
  merchant_name text,
  receiver_name text,
  payer_name text,
  transaction_datetime_iso timestamptz,
  date_display text,
  time_display text,
  status transaction_status,
  source text,
  reference_no text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owner_filter AS (
    SELECT t.*
    FROM public.transactions t
    WHERE t.status <> 'cancelled'
      AND (_exclude_id IS NULL OR t.id <> _exclude_id)
      AND (
        (_owner_user_id IS NOT NULL AND t.user_id = _owner_user_id)
        OR
        (_owner_line_user_id IS NOT NULL AND t.line_user_id = _owner_line_user_id)
      )
  ),
  hard_hash AS (
    SELECT 'hard_hash'::text AS match_type, t.* FROM owner_filter t
    WHERE _image_hash IS NOT NULL AND _image_hash <> '' AND t.image_hash = _image_hash
  ),
  hard_ref AS (
    SELECT 'hard_reference'::text AS match_type, t.* FROM owner_filter t
    WHERE _reference_no IS NOT NULL AND _reference_no <> '' AND t.reference_no = _reference_no
      AND NOT EXISTS (SELECT 1 FROM hard_hash h WHERE h.id = t.id)
  ),
  probable AS (
    SELECT 'probable'::text AS match_type, t.* FROM owner_filter t
    WHERE _amount IS NOT NULL
      AND t.amount = _amount
      AND _datetime IS NOT NULL
      AND t.transaction_datetime_iso IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (t.transaction_datetime_iso - _datetime))) <= 600
      AND (
        _merchant IS NULL OR _merchant = ''
        OR LOWER(COALESCE(t.merchant_name, '')) LIKE '%' || LOWER(_merchant) || '%'
        OR LOWER(COALESCE(t.receiver_name, '')) LIKE '%' || LOWER(_merchant) || '%'
        OR LOWER(COALESCE(t.payer_name, '')) LIKE '%' || LOWER(_merchant) || '%'
        OR LOWER(_merchant) LIKE '%' || LOWER(COALESCE(t.merchant_name, 'zzzzz')) || '%'
      )
      AND NOT EXISTS (SELECT 1 FROM hard_hash h WHERE h.id = t.id)
      AND NOT EXISTS (SELECT 1 FROM hard_ref r WHERE r.id = t.id)
  ),
  combined AS (
    SELECT * FROM hard_hash
    UNION ALL SELECT * FROM hard_ref
    UNION ALL SELECT * FROM probable
  )
  SELECT
    c.match_type,
    c.id AS transaction_id,
    c.amount,
    c.merchant_name,
    c.receiver_name,
    c.payer_name,
    c.transaction_datetime_iso,
    c.date_display,
    c.time_display,
    c.status,
    c.source,
    c.reference_no
  FROM combined c
  ORDER BY
    CASE c.match_type
      WHEN 'hard_hash' THEN 1
      WHEN 'hard_reference' THEN 2
      ELSE 3
    END,
    c.created_at DESC
  LIMIT 10;
$$;

-- Audit table for duplicate overrides
CREATE TABLE IF NOT EXISTS public.duplicate_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  new_transaction_id uuid,
  matched_transaction_id uuid,
  duplicate_type text NOT NULL,
  owner_user_id uuid,
  owner_line_user_id text,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.duplicate_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to duplicate_overrides"
ON public.duplicate_overrides
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Users can view own duplicate overrides"
ON public.duplicate_overrides
FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_overrides_new_tx ON public.duplicate_overrides(new_transaction_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_overrides_owner ON public.duplicate_overrides(owner_user_id);
