import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import type { Transaction } from '@/types';

interface CancelTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCancel: () => void;
  cancelling?: boolean;
}

export function CancelTransactionDialog({ transaction, open, onOpenChange, onConfirmCancel, cancelling }: CancelTransactionDialogProps) {
  if (!transaction) return null;

  const amount = transaction.amount != null ? `${transaction.amount.toLocaleString()} ${transaction.currency || 'THB'}` : '-';
  const name = transaction.merchant_name || transaction.receiver_name || 'ไม่ระบุ';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยกเลิกรายการนี้?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>รายการจะถูกทำเครื่องหมายว่ายกเลิก และจะไม่ถูกนับในสรุปยอด</p>
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p>💰 {amount}</p>
                <p>🏪 {name}</p>
                {transaction.date_display && <p>📅 {transaction.date_display}</p>}
              </div>
              <p className="text-xs text-muted-foreground">ข้อมูลจะไม่ถูกลบ สามารถดูได้ในรายการที่ยกเลิก</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelling}>ไม่ใช่</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirmCancel(); }}
            disabled={cancelling}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {cancelling && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            ยืนยันยกเลิก
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
