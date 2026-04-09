import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLineAuth } from '@/contexts/LineAuthContext';
import { getFreshLineIdToken } from '@/lib/line-token';
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
  /** Set when a token/auth error occurs — distinguishes from empty data */
  tokenError?: string;
}

export function useMyTransactions(filters?: {
  search?: string;
  category?: ExpenseCategory;
  status?: TransactionStatus;
}) {
  const { session } = useAuth();
  const { lineIdentity, isLineUser } = useLineAuth();

  const mode: DashboardRole = isLineUser ? 'line_user' : 'admin';

  return useQuery<DashboardData>({
    queryKey: ['my-transactions', mode, lineIdentity?.lineUserId, session?.user?.id, filters],
    queryFn: async (): Promise<DashboardData> => {
      if (mode === 'line_user' && lineIdentity) {
        // Get fresh token — never rely solely on cached token
        const freshToken = getFreshLineIdToken(lineIdentity.idToken);
        if (!freshToken) {
          return {
            transactions: [],
            stats: { monthlyTotal: 0, yearlyTotal: 0, slipCountMonth: 0, pendingCount: 0 },
            role: 'line_user',
            displayName: lineIdentity.displayName,
            tokenError: 'ไม่สามารถรับ ID Token ได้ กรุณาเข้าสู่ระบบใหม่',
          };
        }

        const { data, error } = await supabase.functions.invoke('my-transactions', {
          body: { idToken: freshToken },
        });

        if (error) {
          // supabase.functions.invoke returns error (not data) for non-2xx responses.
          // In LINE user mode, this is almost always a token expiry (401).
          // Return tokenError so the UI shows a re-login prompt instead of empty data.
          return {
            transactions: [],
            stats: { monthlyTotal: 0, yearlyTotal: 0, slipCountMonth: 0, pendingCount: 0 },
            role: 'line_user' as DashboardRole,
            displayName: lineIdentity.displayName,
            tokenError: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบ LINE ใหม่',
          };
        }

        // Distinguish auth/token errors from empty data
        if (data?.error) {
          const errMsg = data.error as string;
          if (errMsg.includes('Invalid LINE identity') || errMsg.includes('expired') || errMsg.includes('idToken')) {
            return {
              transactions: [],
              stats: { monthlyTotal: 0, yearlyTotal: 0, slipCountMonth: 0, pendingCount: 0 },
              role: 'line_user',
              displayName: lineIdentity.displayName,
              tokenError: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบ LINE ใหม่',
            };
          }
          throw new Error(errMsg);
        }

        let transactions = (data.transactions || []) as Transaction[];

        // Client-side filters
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

      // Admin mode
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
