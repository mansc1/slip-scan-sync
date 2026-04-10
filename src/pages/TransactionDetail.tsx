import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransaction, useConfirmTransaction, useUpdateTransaction, useCancelTransaction } from '@/hooks/useTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Pencil, Ban } from 'lucide-react';
import { CATEGORY_ICONS } from '@/types';
import { toast } from 'sonner';
import { TransactionEditDialog } from '@/components/transactions/TransactionEditDialog';
import { CancelTransactionDialog } from '@/components/transactions/CancelTransactionDialog';

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tx, isLoading } = useTransaction(id!);
  const confirmMutation = useConfirmTransaction();
  const updateMutation = useUpdateTransaction();
  const cancelMutation = useCancelTransaction();

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isLoading) return <AppLayout><div className="flex items-center justify-center py-12 text-muted-foreground">กำลังโหลด...</div></AppLayout>;
  if (!tx) return <AppLayout><div className="flex items-center justify-center py-12 text-muted-foreground">ไม่พบรายการ</div></AppLayout>;

  const cat = tx.category_final || tx.category_guess || 'other';
  const isCancelled = tx.status === 'cancelled';

  const handleConfirm = () => {
    confirmMutation.mutate({ id: tx.id, categoryFinal: tx.category_guess || undefined }, {
      onSuccess: () => toast.success('ยืนยันแล้ว'),
    });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{tx.merchant_name || tx.receiver_name || 'รายการ'}</h1>
            <p className="text-sm text-muted-foreground">{tx.date_display} {tx.time_display}</p>
          </div>
          {!isCancelled && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> แก้ไข
              </Button>
              {tx.status === 'pending_confirmation' && (
                <Button size="sm" onClick={handleConfirm}>
                  <Check className="h-3.5 w-3.5 mr-1" /> ยืนยัน
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>
                <Ban className="h-3.5 w-3.5 mr-1" /> ยกเลิก
              </Button>
            </div>
          )}
          {isCancelled && (
            <Badge variant="destructive">ยกเลิกแล้ว</Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">ข้อมูลธุรกรรม</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="จำนวน" value={tx.amount != null ? `${tx.amount.toLocaleString()} ${tx.currency}` : '-'} />
              <Row label="ประเภท" value={tx.transaction_type?.replace('_', ' ') || '-'} />
              <Row label="สถานะชำระ" value={tx.payment_status || '-'} />
              <Row label="หมวด" value={`${CATEGORY_ICONS[cat]} ${cat}`} />
              <Row label="ค่าธรรมเนียม" value={tx.fee != null ? `${tx.fee} ${tx.currency}` : '-'} />
              <Row label="ความมั่นใจ" value={tx.confidence_score != null ? `${(tx.confidence_score * 100).toFixed(0)}%` : '-'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">รายละเอียด</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="ผู้จ่าย" value={tx.payer_name || '-'} />
              <Row label="ผู้รับ" value={tx.receiver_name || '-'} />
              <Row label="ร้านค้า" value={tx.merchant_name || '-'} />
              <Row label="ธนาคาร" value={tx.bank_name || '-'} />
              <Row label="Ref" value={tx.reference_no || '-'} />
              <Row label="บันทึก" value={tx.notes || '-'} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">สถานะ Sync</CardTitle></CardHeader>
          <CardContent className="flex gap-4">
            <SyncBadge label="Google Sheets" status={tx.sheets_sync_status} />
            <SyncBadge label="Google Drive" status={tx.drive_sync_status} />
          </CardContent>
        </Card>

        {tx.raw_ocr_text && (
          <Card>
            <CardHeader><CardTitle className="text-base">Raw OCR Text</CardTitle></CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded-md font-mono">{tx.raw_ocr_text}</pre>
            </CardContent>
          </Card>
        )}
      </div>

      <TransactionEditDialog
        transaction={tx}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(updates) => {
          updateMutation.mutate(
            { id: tx.id, updates: updates as any },
            {
              onSuccess: () => { toast.success('บันทึกแล้ว'); setEditOpen(false); },
              onError: () => toast.error('เกิดข้อผิดพลาด'),
            }
          );
        }}
        saving={updateMutation.isPending}
      />

      <CancelTransactionDialog
        transaction={tx}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirmCancel={() => {
          cancelMutation.mutate(tx.id, {
            onSuccess: () => { toast.success('ยกเลิกรายการแล้ว'); setCancelOpen(false); },
            onError: () => toast.error('เกิดข้อผิดพลาด'),
          });
        }}
        cancelling={cancelMutation.isPending}
      />
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SyncBadge({ label, status }: { label: string; status: string | null }) {
  const variant = status === 'synced' ? 'default' : status === 'failed' ? 'destructive' : 'outline';
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Badge variant={variant as any}>{status || 'N/A'}</Badge>
    </div>
  );
}
