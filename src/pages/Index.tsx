import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { TransactionFilters } from '@/components/dashboard/TransactionFilters';
import { SlipUploader } from '@/components/dashboard/SlipUploader';
import { MonthlyExpenseChart } from '@/components/dashboard/MonthlyExpenseChart';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { TransactionEditDialog } from '@/components/transactions/TransactionEditDialog';
import { DuplicateWarningDialog } from '@/components/transactions/DuplicateWarningDialog';
import { useMyTransactions } from '@/hooks/useMyTransactions';
import { useConfirmTransaction, useUpdateTransaction, useCancelTransaction, useCreateTransaction } from '@/hooks/useTransactions';
import { useLineAuth } from '@/contexts/LineAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getFreshLineIdToken } from '@/lib/line-token';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExpenseCategory, TransactionStatus } from '@/types';
import type { DuplicateCandidate } from '@/hooks/useDuplicateCheck';

/** Calls liff-action edge function for LINE user mutations */
function useLiffAction() {
  const { lineIdentity } = useLineAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, transactionId, updates, acknowledgeDuplicates }: { action: string; transactionId?: string; updates?: Record<string, unknown>; acknowledgeDuplicates?: boolean }) => {
      const idToken = getFreshLineIdToken(lineIdentity?.idToken);
      if (!idToken) throw new Error('No LINE token');
      const { data, error } = await supabase.functions.invoke('liff-action', {
        body: { action, transactionId, idToken, updates, acknowledgeDuplicates },
      });
      // Surface 409 duplicate payload through error
      if (error) {
        const errAny: any = error;
        // Try parse FunctionsHttpError context
        try {
          const ctx = await (error as any).context?.json?.();
          if (ctx?.duplicate) errAny.context = ctx;
        } catch { /* ignore */ }
        throw errAny;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-transactions'] });
    },
  });
}

const Index = () => {
  const queryClient = useQueryClient();
  const { isLineUser, lineIdentity } = useLineAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<Record<string, unknown> | null>(null);
  const [dupDialog, setDupDialog] = useState<{ type: 'hard' | 'probable'; candidates: DuplicateCandidate[] } | null>(null);

  const { data, isLoading } = useMyTransactions({
    search: search || undefined,
    category: category !== 'all' ? (category as ExpenseCategory) : undefined,
    status: status !== 'all' ? (status as TransactionStatus) : undefined,
  });

  const allTransactions = data?.transactions || [];
  const stats = data?.stats || { monthlyTotal: 0, yearlyTotal: 0, slipCountMonth: 0, pendingCount: 0 };
  const role = data?.role || (isLineUser ? 'line_user' : 'admin');
  const tokenError = data?.tokenError;

  // Exclude cancelled from default view unless explicitly filtered
  const transactions = status === 'cancelled'
    ? allTransactions
    : allTransactions.filter(t => t.status !== 'cancelled');

  // Charts should only use non-cancelled confirmed transactions
  const chartTransactions = allTransactions.filter(t => t.status !== 'cancelled');

  // Show re-login prompt when token is expired/invalid
  if (tokenError && isLineUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-xs">
          <p className="text-destructive font-medium">⚠️ {tokenError}</p>
          <button
            onClick={() => { window.location.href = '/liff/dashboard'; }}
            className="inline-flex items-center rounded-md bg-[#06C755] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#05b34d]"
          >
            เข้าสู่ระบบ LINE ใหม่
          </button>
        </div>
      </div>
    );
  }

  const confirmMutation = useConfirmTransaction();
  const updateMutation = useUpdateTransaction();
  const cancelMutation = useCancelTransaction();
  const createMutation = useCreateTransaction();
  const liffAction = useLiffAction();

  const handleConfirm = (id: string) => {
    if (isLineUser) {
      liffAction.mutate(
        { action: 'confirm', transactionId: id },
        {
          onSuccess: () => toast.success('ยืนยันรายการแล้ว'),
          onError: () => toast.error('เกิดข้อผิดพลาด'),
        }
      );
      return;
    }
    const tx = allTransactions.find(t => t.id === id);
    confirmMutation.mutate(
      { id, categoryFinal: tx?.category_guess || undefined },
      {
        onSuccess: () => {
          toast.success('ยืนยันรายการแล้ว');
          queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
        },
        onError: () => toast.error('เกิดข้อผิดพลาด'),
      }
    );
  };

  const handleEdit = (id: string, updates: Record<string, unknown>) => {
    if (isLineUser) {
      liffAction.mutate(
        { action: 'update', transactionId: id, updates },
        {
          onSuccess: () => toast.success('บันทึกแล้ว'),
          onError: () => toast.error('เกิดข้อผิดพลาด'),
        }
      );
      return;
    }
    updateMutation.mutate(
      { id, updates: updates as any },
      {
        onSuccess: () => {
          toast.success('บันทึกแล้ว');
          queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
        },
        onError: () => toast.error('เกิดข้อผิดพลาด'),
      }
    );
  };

  const handleCancel = (id: string) => {
    if (isLineUser) {
      liffAction.mutate(
        { action: 'cancel', transactionId: id },
        {
          onSuccess: () => toast.success('ยกเลิกรายการแล้ว'),
          onError: () => toast.error('เกิดข้อผิดพลาด'),
        }
      );
      return;
    }
    cancelMutation.mutate(id, {
      onSuccess: () => {
        toast.success('ยกเลิกรายการแล้ว');
        queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
      },
      onError: () => toast.error('เกิดข้อผิดพลาด'),
    });
  };

  const handleCreate = (payload: Record<string, unknown>, acknowledgeDuplicates = false) => {
    if (isLineUser) {
      liffAction.mutate(
        { action: 'create', updates: payload, acknowledgeDuplicates },
        {
          onSuccess: () => {
            toast.success('เพิ่มรายจ่ายสำเร็จ');
            setCreateOpen(false);
            setPendingCreatePayload(null);
          },
          onError: (err: any) => {
            const msg = err?.message || '';
            // liff edge function returns 409 with duplicate payload — surfaced via err.context
            const ctx = err?.context;
            if (ctx?.duplicate || msg.includes('Duplicate')) {
              setPendingCreatePayload(payload);
              setDupDialog({
                type: ctx?.duplicate === 'hard' ? 'hard' : 'probable',
                candidates: ctx?.hardMatch ? [ctx.hardMatch] : (ctx?.probableMatches || []),
              });
              return;
            }
            toast.error('เกิดข้อผิดพลาด');
          },
        }
      );
      return;
    }
    createMutation.mutate(
      { ...payload, acknowledgeDuplicates },
      {
        onSuccess: () => {
          toast.success('เพิ่มรายจ่ายสำเร็จ');
          setCreateOpen(false);
          setPendingCreatePayload(null);
          queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
        },
        onError: (err: any) => {
          if (err?.code === 'DUPLICATE') {
            setPendingCreatePayload(payload);
            setDupDialog({
              type: err.details.type,
              candidates: err.details.hardMatch
                ? [err.details.hardMatch]
                : err.details.probableMatches,
            });
            return;
          }
          toast.error('เกิดข้อผิดพลาด');
        },
      }
    );
  };

  const isMutating = isLineUser ? liffAction.isPending : false;
  const isAdmin = role === 'admin';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isAdmin ? 'Dashboard' : `สวัสดี, ${lineIdentity?.displayName || 'คุณ'}`}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAdmin ? 'ภาพรวมรายจ่ายทั้งหมด (Admin)' : 'ภาพรวมรายจ่ายส่วนตัว'}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            เพิ่มรายจ่าย
          </Button>
        </div>

        <OverviewCards {...stats} />

        {chartTransactions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <MonthlyExpenseChart transactions={chartTransactions} />
            <CategoryBreakdown transactions={chartTransactions} />
          </div>
        )}

        <div className={isAdmin ? 'grid gap-6 lg:grid-cols-3' : ''}>
          <div className={isAdmin ? 'lg:col-span-2 space-y-4' : 'space-y-4'}>
            <TransactionFilters
              search={search}
              onSearchChange={setSearch}
              category={category}
              onCategoryChange={setCategory}
              status={status}
              onStatusChange={setStatus}
            />
            <TransactionTable
              transactions={transactions}
              onConfirm={handleConfirm}
              onEdit={handleEdit}
              onCancel={handleCancel}
              editSaving={isLineUser ? liffAction.isPending : updateMutation.isPending}
              cancelSaving={isLineUser ? liffAction.isPending : cancelMutation.isPending}
              hideSystemColumns={!isAdmin}
            />
          </div>
          {isAdmin && (
            <div>
              <SlipUploader
                onExtracted={(result) => {
                  console.log('Extract-slip response:', result);
                  toast.success(`สกัดข้อมูลสำเร็จ (ID: ${result?.transaction_id?.slice(0, 8)}… status: ${result?.status}, source: manual_upload)`);
                  queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create transaction dialog */}
      <TransactionEditDialog
        mode="create"
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setPendingCreatePayload(null);
        }}
        onSave={(payload) => handleCreate(payload)}
        saving={isLineUser ? liffAction.isPending : createMutation.isPending}
      />

      {/* Duplicate warning dialog (shared) */}
      <DuplicateWarningDialog
        open={!!dupDialog}
        onOpenChange={(v) => { if (!v) setDupDialog(null); }}
        type={dupDialog?.type || null}
        candidates={dupDialog?.candidates || []}
        onContinue={() => {
          if (pendingCreatePayload) handleCreate(pendingCreatePayload, true);
          setDupDialog(null);
        }}
        onCancel={() => {
          setDupDialog(null);
          setPendingCreatePayload(null);
        }}
      />
    </AppLayout>
  );
};

export default Index;
