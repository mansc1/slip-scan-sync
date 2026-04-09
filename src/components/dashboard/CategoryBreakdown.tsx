import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, type ExpenseCategory } from '@/types';
import type { Transaction } from '@/types';

interface Props {
  transactions: Transaction[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(220 70% 55%)',
  'hsl(160 60% 45%)',
  'hsl(30 80% 55%)',
  'hsl(340 65% 50%)',
  'hsl(270 55% 55%)',
  'hsl(45 80% 50%)',
  'hsl(190 60% 45%)',
  'hsl(10 70% 55%)',
  'hsl(130 50% 45%)',
  'hsl(290 45% 50%)',
  'hsl(200 40% 55%)',
];

export function CategoryBreakdown({ transactions }: Props) {
  const data = useMemo(() => {
    const confirmed = transactions.filter(t => t.status === 'confirmed');
    const catMap = new Map<ExpenseCategory, number>();

    confirmed.forEach(t => {
      const cat = t.category_final || t.category_guess || 'other';
      catMap.set(cat, (catMap.get(cat) || 0) + (t.amount || 0));
    });

    return Array.from(catMap.entries())
      .map(([cat, total]) => {
        const info = EXPENSE_CATEGORIES.find(c => c.value === cat);
        return {
          name: info?.labelTh || cat,
          value: Math.round(total),
          icon: CATEGORY_ICONS[cat] || '📌',
          category: cat,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const grandTotal = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">สรุปตามหมวดหมู่</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`฿${v.toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="flex-1 space-y-1.5 w-full">
              {data.slice(0, 6).map((d, i) => (
                <div key={d.category} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate flex-1">
                    {d.icon} {d.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums text-xs">
                    {grandTotal > 0 ? Math.round((d.value / grandTotal) * 100) : 0}%
                  </span>
                  <span className="font-medium tabular-nums text-xs">
                    ฿{d.value.toLocaleString()}
                  </span>
                </div>
              ))}
              {data.length > 6 && (
                <p className="text-xs text-muted-foreground pl-4">+{data.length - 6} หมวดหมู่อื่น</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
