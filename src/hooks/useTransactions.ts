import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEMO_TRANSACTIONS } from '@/lib/demo-data';
import type { Transaction, TransactionStatus, ExpenseCategory } from '@/types';

export function useTransactions(filters?: {
  month?: string;
  category?: ExpenseCategory;
  status?: TransactionStatus;
  search?: string;
}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async (): Promise<Transaction[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return DEMO_TRANSACTIONS;
      }

      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.or(`category_guess.eq.${filters.category},category_final.eq.${filters.category}`);
      }
      if (filters?.search) {
        query = query.or(`merchant_name.ilike.%${filters.search}%,payer_name.ilike.%${filters.search}%,receiver_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Transaction[]) || [];
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: async (): Promise<Transaction | null> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return DEMO_TRANSACTIONS.find(t => t.id === id) || null;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as Transaction;
    },
    enabled: !!id,
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transaction'] });
    },
  });
}

export function useConfirmTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, categoryFinal }: { id: string; categoryFinal?: ExpenseCategory }) => {
      const updates: any = {
        status: 'confirmed',
        sheets_sync_status: 'pending',
        drive_sync_status: 'pending',
      };
      if (categoryFinal) updates.category_final = categoryFinal;

      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transaction'] });

      // Trigger async syncs (fire and forget)
      const txId = data.id;
      supabase.functions.invoke('sync-sheets', { body: { transaction_id: txId } })
        .catch(e => console.error('sync-sheets error:', e));
      supabase.functions.invoke('sync-drive', { body: { transaction_id: txId } })
        .catch(e => console.error('sync-drive error:', e));
    },
  });
}

export function useIgnoreTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'ignored' as any })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDashboardStats(transactions: Transaction[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const confirmed = transactions.filter(t => t.status === 'confirmed');

  const thisMonth = confirmed.filter(t => {
    if (!t.transaction_datetime_iso) return false;
    const d = new Date(t.transaction_datetime_iso);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const thisYear = confirmed.filter(t => {
    if (!t.transaction_datetime_iso) return false;
    return new Date(t.transaction_datetime_iso).getFullYear() === currentYear;
  });

  const pendingCount = transactions.filter(t => t.status === 'pending_confirmation').length;

  return {
    monthlyTotal: thisMonth.reduce((sum, t) => sum + (t.amount || 0), 0),
    yearlyTotal: thisYear.reduce((sum, t) => sum + (t.amount || 0), 0),
    slipCountMonth: thisMonth.length,
    pendingCount,
  };
}
