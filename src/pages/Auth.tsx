import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send, BarChart3, ExternalLink, QrCode, ArrowRight } from 'lucide-react';
import { LINE_OA_URL } from '@/config/liff';

const steps = [
  { icon: MessageCircle, title: 'เพิ่มเพื่อน LINE bot', desc: 'แอดเพื่อน SlipSync bot ใน LINE' },
  { icon: Send, title: 'ส่งสลิป', desc: 'ถ่ายรูปหรือส่งสลิปให้ bot' },
  { icon: BarChart3, title: 'ดู Dashboard', desc: 'ดูรายจ่ายและสรุปยอดได้ทันที' },
];

export default function Auth() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-16 pb-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl mb-4 shadow-lg">
          S
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          SlipSync
        </h1>
        <p className="mt-3 text-lg font-medium text-foreground/80 max-w-md">
          บันทึกรายจ่ายจากสลิปอัตโนมัติผ่าน LINE
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          ส่งสลิปใน LINE → ยืนยันรายการ → ดู Dashboard ได้ทันที
        </p>
      </section>

      {/* New User */}
      <section className="px-4 pb-8 max-w-md mx-auto w-full">
        <h2 className="text-base font-semibold text-foreground mb-4">ผู้ใช้งานใหม่</h2>

        <div className="grid gap-3 mb-6">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  <span className="text-primary mr-1">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile CTA */}
        <Button
          asChild
          className="w-full bg-[#06C755] hover:bg-[#05b04c] text-white font-medium h-12 text-base sm:hidden"
        >
          <a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer">
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            เริ่มใช้งานผ่าน LINE
          </a>
        </Button>

        {/* Desktop: QR + button */}
        <Card className="hidden sm:block">
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/50">
              <div className="text-center text-muted-foreground">
                <QrCode className="h-10 w-10 mx-auto mb-1" />
                <span className="text-xs">QR Code<br />LINE Official</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">สแกน QR เพื่อเพิ่มเพื่อน LINE bot</p>
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer">
                เพิ่มเพื่อน LINE bot
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Existing User */}
      <section className="px-4 pb-8 max-w-md mx-auto w-full">
        <h2 className="text-base font-semibold text-foreground mb-4">ผู้ใช้งานเดิม</h2>
        <div className="grid gap-3">
          <Button asChild className="w-full h-12 text-base" variant="default">
            <Link to="/liff/dashboard">
              <BarChart3 className="h-5 w-5 mr-2" />
              เปิด My Dashboard
              <ArrowRight className="h-4 w-4 ml-auto" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={LINE_OA_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              เปิด LINE bot
              <ExternalLink className="h-3.5 w-3.5 ml-auto" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center">
        <Link
          to="/admin/login"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          สำหรับผู้ดูแลระบบ →
        </Link>
      </footer>
    </div>
  );
}
