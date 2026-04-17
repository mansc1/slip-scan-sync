import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

interface MonthOption {
  value: string; // YYYY-MM
  count: number;
}

interface MonthSelectorProps {
  value: string;
  onChange: (v: string) => void;
  availableMonths: MonthOption[];
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** Format YYYY-MM -> "เมษายน 2569" (Buddhist year) */
function formatThaiMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

export function MonthSelector({ value, onChange, availableMonths }: MonthSelectorProps) {
  if (availableMonths.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-[200px]">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="เลือกเดือน" />
      </SelectTrigger>
      <SelectContent>
        {availableMonths.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            <span className="flex items-center justify-between gap-3 w-full">
              <span>{formatThaiMonth(m.value)}</span>
              <span className="text-xs text-muted-foreground">({m.count})</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
