import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES, type Transaction, type ExpenseCategory } from '@/types';
import { Save, X, Ban } from 'lucide-react';

interface FormValues {
  amount: string;
  date_display: string;
  time_display: string;
  merchant_name: string;
  category_final: ExpenseCategory;
  notes: string;
}

interface TransactionEditFormProps {
  transaction: Transaction;
  onSave: (updates: Partial<Transaction>) => void;
  onCancel: () => void;
  onIgnore: () => void;
  saving?: boolean;
}

export function TransactionEditForm({ transaction, onSave, onCancel, onIgnore, saving }: TransactionEditFormProps) {
  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      amount: transaction.amount?.toString() || '',
      date_display: transaction.date_display || '',
      time_display: transaction.time_display || '',
      merchant_name: transaction.merchant_name || '',
      category_final: (transaction.category_final || transaction.category_guess || 'other') as ExpenseCategory,
      notes: transaction.notes || '',
    },
  });

  const selectedCategory = watch('category_final');

  const onSubmit = (data: FormValues) => {
    onSave({
      amount: parseFloat(data.amount) || null,
      date_display: data.date_display || null,
      time_display: data.time_display || null,
      merchant_name: data.merchant_name || null,
      category_final: data.category_final,
      notes: data.notes || null,
      status: 'confirmed',
      sheets_sync_status: 'pending',
      drive_sync_status: 'pending',
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>จำนวนเงิน (Amount)</Label>
          <Input type="number" step="0.01" {...register('amount')} />
        </div>
        <div className="space-y-2">
          <Label>หมวดหมู่ (Category)</Label>
          <Select value={selectedCategory} onValueChange={(v) => setValue('category_final', v as ExpenseCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.labelTh}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>วันที่ (Date)</Label>
          <Input {...register('date_display')} />
        </div>
        <div className="space-y-2">
          <Label>เวลา (Time)</Label>
          <Input {...register('time_display')} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>ร้านค้า (Merchant)</Label>
          <Input {...register('merchant_name')} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>บันทึก (Notes)</Label>
          <Textarea {...register('notes')} rows={2} />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          บันทึกและยืนยัน
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          ยกเลิก
        </Button>
        <Button type="button" variant="destructive" onClick={onIgnore}>
          <Ban className="h-4 w-4 mr-1" />
          ข้าม
        </Button>
      </div>
    </form>
  );
}
