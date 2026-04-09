import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Transaction } from '@/types';

interface Props {
  transactions: Transaction[];
}

export function MonthlyExpenseChart({ transactions }: Props) {
  const chartData = useMemo(() => {
    const confirmed = transactions.filter(t => t.status === 'confirmed' && t.transaction_datetime_iso);
    const monthMap = new Map<string, number>();

    // Last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }

    confirmed.forEach(t => {
      const d = new Date(t.transaction_datetime_iso!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) || 0) + (t.amount || 0));
      }
    });

    const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    return Array.from(monthMap.entries()).map(([key, total]) => {
      const month = parseInt(key.split('-')[1]) - 1;
      return { name: thMonths[month], total: Math.round(total) };
    });
  }, [transactions]);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">ค่าใช้จ่ายรายเดือน</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.every(d => d.total === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีข้อมูล</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                formatter={(v: number) => [`฿${v.toLocaleString()}`, 'ยอดรวม']}
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
