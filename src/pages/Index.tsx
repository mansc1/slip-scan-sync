import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { TransactionTable } from '@/components/dashboard/TransactionTable';
import { TransactionFilters } from '@/components/dashboard/TransactionFilters';
import { SlipUploader } from '@/components/dashboard/SlipUploader';
import { useTransactions, useDashboardStats, useConfirmTransaction, useIgnoreTransaction } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import type { ExpenseCategory, TransactionStatus } from '@/types';

const Index = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');

  const { data: transactions = [], isLoading } = useTransactions({
    search: search || undefined,
    category: category !== 'all' ? (category as ExpenseCategory) : undefined,
    status: status !== 'all' ? (status as TransactionStatus) : undefined,
  });

  const stats = useDashboardStats(transactions);
  const confirmMutation = useConfirmTransaction();
  const ignoreMutation = useIgnoreTransaction();

  const handleConfirm = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    confirmMutation.mutate(
      { id, categoryFinal: tx?.category_guess || undefined },
      {
        onSuccess: () => toast.success('ยืนยันรายการแล้ว'),
        onError: () => toast.error('เกิดข้อผิดพลาด'),
      }
    );
  };

  const handleIgnore = (id: string) => {
    ignoreMutation.mutate(id, {
      onSuccess: () => toast.success('ข้ามรายการแล้ว'),
      onError: () => toast.error('เกิดข้อผิดพลาด'),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">ภาพรวมรายจ่ายส่วนตัว</p>
        </div>

        <OverviewCards {...stats} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
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
            />
          </div>
          <div>
            <SlipUploader
              onExtracted={(result) => {
                toast.success('สกัดข้อมูลจากสลิปสำเร็จ');
              }}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
