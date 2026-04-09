import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { LIFF_ID } from '@/config/liff';
import { Loader2 } from 'lucide-react';

const TIMEOUT_MS = 15_000;

/**
 * Handles the LIFF OAuth callback at the root URL.
 *
 * After LINE login, the browser lands on `/?liff.state=<encoded-target>`.
 * React Router matches "/" → ProtectedRoute detects `liff.state` → renders
 * this component instead of checking auth.
 *
 * We call `liff.init()` which internally reads `liff.state`, restores the
 * target path, and performs a client-side navigation (replaceState).
 * If the SDK doesn't navigate within TIMEOUT_MS, we extract the target
 * from `liff.state` ourselves and redirect manually.
 */
export default function LiffCallbackHandler() {
  const [error, setError] = useState('');

  useEffect(() => {
    // Extract target path from liff.state before LIFF SDK might clear it
    const params = new URLSearchParams(window.location.search);
    const liffState = params.get('liff.state') || '/liff/dashboard';

    // Timeout: if LIFF SDK doesn't navigate, do it manually
    const timer = setTimeout(() => {
      console.warn('[LiffCallbackHandler] Timeout – navigating manually to', liffState);
      window.location.replace(liffState);
    }, TIMEOUT_MS);

    liff
      .init({ liffId: LIFF_ID })
      .then(() => {
        clearTimeout(timer);
        // LIFF SDK should have already navigated via liff.state.
        // If we're still mounted, navigate manually.
        window.location.replace(liffState);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.error('[LiffCallbackHandler] LIFF init failed:', err);
        setError('ไม่สามารถเชื่อมต่อ LINE ได้');
      });

    return () => clearTimeout(timer);
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <p className="text-destructive font-medium">❌ {error}</p>
          <p className="text-muted-foreground text-sm">กรุณาลองเปิดใหม่จาก LINE</p>
          <button
            onClick={() => window.location.replace('/liff/dashboard')}
            className="mt-2 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground text-sm">กำลังเชื่อมต่อ LINE...</p>
      </div>
    </div>
  );
}
