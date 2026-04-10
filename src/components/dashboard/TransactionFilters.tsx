import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type TransactionStatus } from '@/types';
import { Search } from 'lucide-react';

interface TransactionFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
}

export function TransactionFilters({
  search, onSearchChange,
  category, onCategoryChange,
  status, onStatusChange,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ค้นหาร้าน, ชื่อผู้รับ..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="หมวดหมู่" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกหมวด</SelectItem>
          {EXPENSE_CATEGORIES.map(c => (
            <SelectItem key={c.value} value={c.value}>{c.labelTh}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="สถานะ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกสถานะ</SelectItem>
          <SelectItem value="pending_confirmation">รอยืนยัน</SelectItem>
          <SelectItem value="confirmed">ยืนยันแล้ว</SelectItem>
          <SelectItem value="ignored">ข้าม</SelectItem>
          <SelectItem value="extraction_failed">อ่านไม่ได้</SelectItem>
          <SelectItem value="cancelled">ยกเลิก</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
