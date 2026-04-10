import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Check, X, Eye, Pencil, Ban } from 'lucide-react';
import type { Transaction, TransactionStatus } from '@/types';
import { CATEGORY_ICONS } from '@/types';
import { TransactionEditDialog } from '@/components/transactions/TransactionEditDialog';
import { CancelTransactionDialog } from '@/components/transactions/CancelTransactionDialog';

function StatusBadge({ status }: { status: TransactionStatus }) {
  const map: Record<TransactionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending_confirmation: { label: 'รอยืนยัน', variant: 'outline' },
    confirmed: { label: 'ยืนยันแล้ว', variant: 'default' },
    ignored: { label: 'ข้าม', variant: 'secondary' },
    editing: { label: 'แก้ไข', variant: 'outline' },
    extraction_failed: { label: 'อ่านไม่ได้', variant: 'destructive' },
    cancelled: { label: 'ยกเลิก', variant: 'destructive' },
  };
  const { label, variant } = map[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={variant}>{label}</Badge>;
}

interface TransactionTableProps {
  transactions: Transaction[];
  onConfirm?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onEdit?: (id: string, updates: Record<string, unknown>) => void;
  onCancel?: (id: string) => void;
  editSaving?: boolean;
  cancelSaving?: boolean;
  /** Hide source/debug columns for end users */
  hideSystemColumns?: boolean;
}

export function TransactionTable({ transactions, onConfirm, onIgnore, onEdit, onCancel, editSaving, cancelSaving, hideSystemColumns = false }: TransactionTableProps) {
  const navigate = useNavigate();
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [cancelTx, setCancelTx] = useState<Transaction | null>(null);

  const fmt = (n: number | null) =>
    n != null ? new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n) : '-';

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>ร้าน/ผู้รับ</TableHead>
              <TableHead className="text-right">จำนวน</TableHead>
              <TableHead>หมวด</TableHead>
              <TableHead>สถานะ</TableHead>
              {!hideSystemColumns && <TableHead>ที่มา</TableHead>}
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={hideSystemColumns ? 7 : 8} className="text-center text-muted-foreground py-8">
                  ไม่พบรายการ
                </TableCell>
              </TableRow>
            )}
            {transactions.map((tx) => {
              const cat = tx.category_final || tx.category_guess || 'other';
              const isCancelled = tx.status === 'cancelled';
              return (
                <TableRow key={tx.id} className={`cursor-pointer ${isCancelled ? 'opacity-50' : ''}`} onClick={() => navigate(`/transactions/${tx.id}`)}>
                  <TableCell className="whitespace-nowrap">
                    <div className="text-sm">{tx.date_display || '-'}</div>
                    <div className="text-xs text-muted-foreground">{tx.time_display}</div>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{tx.transaction_type?.replace('_', ' ') || '-'}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{tx.merchant_name || tx.receiver_name || '-'}</div>
                    <div className="text-xs text-muted-foreground">{tx.bank_name}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {fmt(tx.amount)} {tx.currency}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{CATEGORY_ICONS[cat]} {cat}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={tx.status} /></TableCell>
                  {!hideSystemColumns && <TableCell className="text-xs capitalize">{tx.source}</TableCell>}
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/transactions/${tx.id}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {!isCancelled && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTx(tx)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {tx.status === 'pending_confirmation' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => onConfirm?.(tx.id)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCancelTx(tx)}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editTx && (
        <TransactionEditDialog
          transaction={editTx}
          open={!!editTx}
          onOpenChange={(v) => { if (!v) setEditTx(null); }}
          onSave={(updates) => {
            onEdit?.(editTx.id, updates);
            setEditTx(null);
          }}
          saving={editSaving}
        />
      )}

      <CancelTransactionDialog
        transaction={cancelTx}
        open={!!cancelTx}
        onOpenChange={(v) => { if (!v) setCancelTx(null); }}
        onConfirmCancel={() => {
          if (cancelTx) {
            onCancel?.(cancelTx.id);
            setCancelTx(null);
          }
        }}
        cancelling={cancelSaving}
      />
    </>
  );
}
