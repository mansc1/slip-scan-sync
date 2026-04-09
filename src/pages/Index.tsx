import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { TransactionFilters } from '@/components/dashboard/TransactionFilters';
import { SlipUploader } from '@/components/dashboard/SlipUploader';
import { MonthlyExpenseChart } from '@/components/dashboard/MonthlyExpenseChart';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { useMyTransactions } from '@/hooks/useMyTransactions';
import { useConfirmTransaction, useIgnoreTransaction } from '@/hooks/useTransactions';
import { useLineAuth } from '@/contexts/LineAuthContext';
import { toast } from 'sonner';
import type { ExpenseCategory, TransactionStatus } from '@/types';

const Index = () => {
  const queryClient = useQueryClient();
  const { isLineUser, lineIdentity } = useLineAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');

  const { data, isLoading } = useMyTransactions({
    search: search || undefined,
    category: category !== 'all' ? (category as ExpenseCategory) : undefined,
    status: status !== 'all' ? (status as TransactionStatus) : undefined,
  });

  const transactions = data?.transactions || [];
  const stats = data?.stats || { monthlyTotal: 0, yearlyTotal: 0, slipCountMonth: 0, pendingCount: 0 };
  const role = data?.role || (isLineUser ? 'line_user' : 'admin');
  const tokenError = data?.tokenError;

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
  const ignoreMutation = useIgnoreTransaction();

  const handleConfirm = (id: string) => {
    const tx = transactions.find(t => t.id === id);
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

  const handleIgnore = (id: string) => {
    ignoreMutation.mutate(id, {
      onSuccess: () => {
        toast.success('ข้ามรายการแล้ว');
        queryClient.invalidateQueries({ queryKey: ['my-transactions'] });
      },
      onError: () => toast.error('เกิดข้อผิดพลาด'),
    });
  };

  const isAdmin = role === 'admin';

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isAdmin ? 'Dashboard' : `สวัสดี, ${lineIdentity?.displayName || 'คุณ'}`}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? 'ภาพรวมรายจ่ายทั้งหมด (Admin)' : 'ภาพรวมรายจ่ายส่วนตัว'}
          </p>
        </div>

        <OverviewCards {...stats} />

        {/* Charts — shown for LINE users; admins get them too */}
        {transactions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <MonthlyExpenseChart transactions={transactions} />
            <CategoryBreakdown transactions={transactions} />
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
              onIgnore={handleIgnore}
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
    </AppLayout>
  );
};

export default Index;
