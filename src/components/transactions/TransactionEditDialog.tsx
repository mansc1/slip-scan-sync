import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES, type Transaction, type ExpenseCategory, type TransactionType, type PaymentMethod } from '@/types';
import { Save, Loader2, Plus } from 'lucide-react';
import {
  type TransactionEditValues,
  getDefaultEditValues,
  getBlankEditValues,
  buildUpdatePayload,
  buildCreatePayload,
  PAYMENT_METHODS,
} from './transactionFields';

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'transfer', label: 'โอนเงิน' },
  { value: 'bill_payment', label: 'ชำระบิล' },
  { value: 'merchant_payment', label: 'จ่ายร้านค้า' },
  { value: 'qr_payment', label: 'QR Payment' },
  { value: 'other', label: 'อื่นๆ' },
];

interface TransactionEditDialogProps {
  /** Pass transaction for edit mode; omit for create mode */
  transaction?: Transaction;
  mode?: 'edit' | 'create';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: Record<string, unknown>) => void;
  saving?: boolean;
}

export function TransactionEditDialog({ transaction, mode = 'edit', open, onOpenChange, onSave, saving }: TransactionEditDialogProps) {
  const isCreate = mode === 'create';

  const { register, handleSubmit, setValue, watch, reset } = useForm<TransactionEditValues>({
    defaultValues: isCreate ? getBlankEditValues() : getDefaultEditValues(transaction || {}),
  });

  const selectedCategory = watch('category_final');
  const selectedType = watch('transaction_type');
  const selectedPayment = watch('payment_method');

  const onSubmit = (data: TransactionEditValues) => {
    if (!data.amount || parseFloat(data.amount) <= 0) return;
    onSave(isCreate ? buildCreatePayload(data) : buildUpdatePayload(data));
  };

  const handleClose = (v: boolean) => {
    if (!v) reset(isCreate ? getBlankEditValues() : getDefaultEditValues(transaction || {}));
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'เพิ่มรายจ่าย' : 'แก้ไขรายการ'}</DialogTitle>
          <DialogDescription>{isCreate ? 'บันทึกรายจ่ายใหม่ด้วยตนเอง' : 'แก้ไขข้อมูลธุรกรรม'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>จำนวนเงิน *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('amount', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>หมวดหมู่</Label>
              <Select value={selectedCategory} onValueChange={(v) => setValue('category_final', v as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.labelTh}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>วันที่</Label>
              <Input {...register('date_display')} placeholder="DD/MM/YYYY" />
            </div>
            <div className="space-y-2">
              <Label>เวลา</Label>
              <Input {...register('time_display')} placeholder="HH:MM" />
            </div>
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select value={selectedType} onValueChange={(v) => setValue('transaction_type', v as TransactionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>วิธีชำระ</Label>
              <Select value={selectedPayment} onValueChange={(v) => setValue('payment_method', v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>ร้านค้า / ผู้รับ</Label>
              <Input {...register('merchant_name')} placeholder="ชื่อร้านค้าหรือรายละเอียด" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>บันทึก</Label>
              <Textarea {...register('notes')} rows={2} placeholder="หมายเหตุเพิ่มเติม" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : isCreate ? <Plus className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {isCreate ? 'เพิ่มรายจ่าย' : 'บันทึก'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
