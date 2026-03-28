import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransaction, useUpdateTransaction, useIgnoreTransaction } from '@/hooks/useTransactions';
import { TransactionEditForm } from '@/components/transactions/TransactionEditForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function TransactionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tx, isLoading } = useTransaction(id!);
  const updateMutation = useUpdateTransaction();
  const ignoreMutation = useIgnoreTransaction();

  if (isLoading) return <AppLayout><div className="flex items-center justify-center py-12 text-muted-foreground">กำลังโหลด...</div></AppLayout>;
  if (!tx) return <AppLayout><div className="flex items-center justify-center py-12 text-muted-foreground">ไม่พบรายการ</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">แก้ไขรายการ</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">แก้ไขข้อมูลก่อนยืนยัน</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionEditForm
              transaction={tx}
              saving={updateMutation.isPending}
              onSave={(updates) => {
                updateMutation.mutate(
                  { id: tx.id, updates },
                  {
                    onSuccess: () => {
                      toast.success('บันทึกและยืนยันแล้ว');
                      navigate(`/transactions/${tx.id}`);
                    },
                    onError: () => toast.error('เกิดข้อผิดพลาด'),
                  }
                );
              }}
              onCancel={() => navigate(-1)}
              onIgnore={() => {
                ignoreMutation.mutate(tx.id, {
                  onSuccess: () => {
                    toast.success('ข้ามรายการแล้ว');
                    navigate('/');
                  },
                });
              }}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
