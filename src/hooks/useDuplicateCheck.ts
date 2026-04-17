import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DuplicateCandidate {
  match_type: 'hard_hash' | 'hard_reference' | 'probable';
  transaction_id: string;
  amount: number | null;
  merchant_name: string | null;
  receiver_name: string | null;
  payer_name: string | null;
  transaction_datetime_iso: string | null;
  date_display: string | null;
  time_display: string | null;
  status: string;
  source: string | null;
  reference_no: string | null;
}

export interface DuplicateCheckResult {
  hardMatch: DuplicateCandidate | null;
  probableMatches: DuplicateCandidate[];
}

export interface DuplicateCheckInput {
  amount?: number | null;
  datetime?: string | null;
  merchant?: string | null;
  reference_no?: string | null;
  image_hash?: string | null;
  exclude_id?: string | null;
  idToken?: string | null;
}

/**
 * Shared duplicate-check hook.
 * Calls `check-duplicate` edge function which scopes results to the verified owner.
 * Demo mode (no auth & no LINE token) returns empty results.
 */
export function useDuplicateCheck() {
  const [isChecking, setIsChecking] = useState(false);

  const check = useCallback(async (input: DuplicateCheckInput): Promise<DuplicateCheckResult> => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-duplicate', {
        body: {
          idToken: input.idToken || undefined,
          amount: input.amount ?? null,
          datetime: input.datetime ?? null,
          merchant: input.merchant ?? null,
          reference_no: input.reference_no ?? null,
          image_hash: input.image_hash ?? null,
          exclude_id: input.exclude_id ?? null,
        },
      });
      if (error) {
        console.error('check-duplicate failed:', error);
        return { hardMatch: null, probableMatches: [] };
      }
      return {
        hardMatch: data?.hardMatch || null,
        probableMatches: data?.probableMatches || [],
      };
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { check, isChecking };
}

/** Build a display-friendly datetime from candidate fields */
export function formatCandidateDatetime(c: DuplicateCandidate): string {
  if (c.date_display || c.time_display) {
    return `${c.date_display || ''} ${c.time_display || ''}`.trim();
  }
  if (c.transaction_datetime_iso) {
    try {
      return new Date(c.transaction_datetime_iso).toLocaleString('th-TH');
    } catch {
      return c.transaction_datetime_iso;
    }
  }
  return '—';
}
