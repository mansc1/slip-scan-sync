import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLineAuth } from '@/contexts/LineAuthContext';
import type { Transaction, ExpenseCategory, TransactionStatus } from '@/types';

export type DashboardRole = 'admin' | 'line_user';

export interface DashboardData {
  transactions: Transaction[];
  stats: {
    monthlyTotal: number;
    yearlyTotal: number;
    slipCountMonth: number;
    pendingCount: number;
  };
  role: DashboardRole;
  displayName?: string;
}

/**
 * Unified data hook for the dashboard.
 * - LINE user mode: sends idToken to my-transactions edge function for server-side verification
 * - Admin mode: queries Supabase directly via authenticated session
 *
 * Response shape is identical regardless of mode.
 */
export function useMyTransactions(filters?: {
  search?: string;
  category?: ExpenseCategory;
  status?: TransactionStatus;
}) {
  const { session } = useAuth();
  const { lineIdentity, isLineUser } = useLineAuth();

  // Determine mode — LINE user takes explicit precedence when both exist
  const mode: DashboardRole = isLineUser ? 'line_user' : 'admin';

  return useQuery<DashboardData>({
    queryKey: ['my-transactions', mode, lineIdentity?.lineUserId, session?.user?.id, filters],
    queryFn: async (): Promise<DashboardData> => {
      if (mode === 'line_user' && lineIdentity) {
        // LINE user mode — every request sends idToken for server-side verification
        const { data, error } = await supabase.functions.invoke('my-transactions', {
          body: { idToken: lineIdentity.idToken },
        });

        if (error) throw new Error(error.message || 'Failed to fetch transactions');
        if (data?.error) throw new Error(data.error);

        let transactions = (data.transactions || []) as Transaction[];

        // Apply client-side filters on the already-filtered response
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          transactions = transactions.filter(t =>
            t.merchant_name?.toLowerCase().includes(s) ||
            t.payer_name?.toLowerCase().includes(s) ||
            t.receiver_name?.toLowerCase().includes(s)
          );
        }
        if (filters?.category) {
          transactions = transactions.filter(t =>
            t.category_guess === filters.category || t.category_final === filters.category
          );
        }
        if (filters?.status) {
          transactions = transactions.filter(t => t.status === filters.status);
        }

        return {
          transactions,
          stats: data.stats,
          role: 'line_user',
          displayName: data.displayName,
        };
      }

      // Admin mode — direct Supabase query with authenticated session
      if (!session) {
        return { transactions: [], stats: { monthlyTotal: 0, yearlyTotal: 0, slipCountMonth: 0, pendingCount: 0 }, role: 'admin' };
      }

      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.category) {
        query = query.or(`category_guess.eq.${filters.category},category_final.eq.${filters.category}`);
      }
      if (filters?.search) {
        query = query.or(`merchant_name.ilike.%${filters.search}%,payer_name.ilike.%${filters.search}%,receiver_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const txs = (data as unknown as Transaction[]) || [];

      // Compute stats
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const confirmed = txs.filter(t => t.status === 'confirmed');
      const thisMonth = confirmed.filter(t => {
        if (!t.transaction_datetime_iso) return false;
        const d = new Date(t.transaction_datetime_iso);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const thisYear = confirmed.filter(t => {
        if (!t.transaction_datetime_iso) return false;
        return new Date(t.transaction_datetime_iso).getFullYear() === currentYear;
      });

      return {
        transactions: txs,
        stats: {
          monthlyTotal: thisMonth.reduce((sum, t) => sum + (t.amount || 0), 0),
          yearlyTotal: thisYear.reduce((sum, t) => sum + (t.amount || 0), 0),
          slipCountMonth: thisMonth.length,
          pendingCount: txs.filter(t => t.status === 'pending_confirmation').length,
        },
        role: 'admin',
      };
    },
    enabled: isLineUser ? !!lineIdentity?.idToken : !!session,
  });
}
