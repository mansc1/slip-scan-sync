import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { LIFF_ID } from '@/config/liff';
import { useLineAuth } from '@/contexts/LineAuthContext';
import Index from './Index';
import { Loader2 } from 'lucide-react';

/**
 * LIFF entry point for /liff/dashboard.
 * Initializes LIFF, obtains ID token, sets LINE identity,
 * then renders the shared dashboard in LINE-user mode.
 */
export default function LiffDashboard() {
  const { setLineIdentity } = useLineAuth();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!LIFF_ID) {
      setErrorMsg('LIFF_ID is not configured');
      setState('error');
      return;
    }

    // Detect if we already came back from LINE login
    const urlParams = new URLSearchParams(window.location.search);
    const isRedirected = urlParams.get('from') === 'line';

    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          if (isRedirected) {
            // We already redirected once — login failed, don't loop
            setErrorMsg('LINE login ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
            setState('error');
            return;
          }
          // First attempt — redirect to LINE login with marker
          const redirectUri = `${window.location.origin}/liff/dashboard?from=line`;
          liff.login({ redirectUri });
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) {
          setErrorMsg('ไม่สามารถรับ ID Token จาก LINE ได้');
          setState('error');
          return;
        }

        try {
          const profile = await liff.getProfile();
          setLineIdentity({
            displayName: profile.displayName,
            lineUserId: profile.userId,
            pictureUrl: profile.pictureUrl,
            idToken,
          });
          setState('ready');
        } catch (e: any) {
          console.error('LIFF getProfile error:', e);
          setErrorMsg('ไม่สามารถดึงข้อมูลโปรไฟล์ LINE ได้');
          setState('error');
        }
      })
      .catch((e: any) => {
        console.error('LIFF init error:', e);
        setErrorMsg('ไม่สามารถเชื่อมต่อ LINE ได้');
        setState('error');
      });
  }, [setLineIdentity]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground text-sm">กำลังเชื่อมต่อ LINE...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <p className="text-destructive font-medium">❌ {errorMsg}</p>
          <p className="text-muted-foreground text-sm">กรุณาลองเปิดใหม่จาก LINE</p>
        </div>
      </div>
    );
  }

  return <Index />;
}
