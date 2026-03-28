import { AppLayout } from '@/components/layout/AppLayout';
import { SlipUploader } from '@/components/dashboard/SlipUploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Upload() {
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Upload Slip</h1>
          <p className="text-muted-foreground text-sm">อัปโหลดสลิปด้วยตนเอง เพื่อทดสอบหรือบันทึกรายจ่าย</p>
        </div>

        <SlipUploader
          onExtracted={(result) => {
            toast.success('สกัดข้อมูลจากสลิปสำเร็จ กรุณาตรวจสอบที่ Dashboard');
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">วิธีใช้งาน</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. ลากไฟล์รูปสลิปมาวาง หรือคลิกเพื่อเลือกไฟล์</p>
            <p>2. ระบบจะสกัดข้อมูลจากสลิปอัตโนมัติ (OCR + AI)</p>
            <p>3. ตรวจสอบข้อมูลที่สกัดได้ แก้ไขถ้าจำเป็น</p>
            <p>4. กดยืนยันเพื่อบันทึกรายการ</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
