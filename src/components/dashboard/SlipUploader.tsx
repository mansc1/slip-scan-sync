import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, ImageIcon, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface SlipUploaderProps {
  onExtracted?: (result: any) => void;
}

export function SlipUploader({ onExtracted }: SlipUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('extract-slip', {
        body: { image: base64, mimeType: file.type, source: 'manual_upload' },
      });

      if (error) {
        if (data?.existing_transaction_id) {
          toast.error('สลิปซ้ำ — รายการนี้มีอยู่แล้ว');
          return;
        }
        throw error;
      }

      if (data?.created === false) {
        toast.info(data.message || 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการจริง');
        return;
      }

      toast.success(`สกัดข้อมูลสำเร็จ (ID: ${data?.transaction_id?.slice(0, 8)}…)`);
      onExtracted?.(data);
    } catch (err: any) {
      toast.error('ไม่สามารถสกัดข้อมูลได้: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [onExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          อัปโหลดสลิป
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">กำลังสกัดข้อมูลจากสลิป...</p>
            </div>
          ) : preview ? (
            <div className="flex flex-col items-center gap-3">
              <img src={preview} alt="Slip preview" className="max-h-40 rounded-lg" />
              <p className="text-sm text-muted-foreground">อัปโหลดสลิปใหม่?</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">ลากไฟล์มาวางหรือ</p>
                <p className="text-xs text-muted-foreground">รองรับ JPG, PNG</p>
              </div>
            </div>
          )}
          {isAuthenticated && (
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              disabled={loading}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
