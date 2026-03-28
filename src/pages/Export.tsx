import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Export() {
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(false);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i);
    return {
      value: `2026-${String(i + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' }),
    };
  });

  const handleExport = async () => {
    if (!month) {
      toast.error('กรุณาเลือกเดือน');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-excel', {
        body: { month },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('ดาวน์โหลดไฟล์สำเร็จ');
      }
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด: ' + (err.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Export</h1>
          <p className="text-muted-foreground text-sm">ดาวน์โหลดข้อมูลรายจ่ายเป็นไฟล์ Excel</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Excel Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">เลือกเดือน</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเดือน..." />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} disabled={loading || !month} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              ดาวน์โหลด Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
