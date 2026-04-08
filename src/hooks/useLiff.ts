import { useState, useEffect, useCallback } from 'react';
import liff from '@line/liff';
import { LIFF_ID } from '@/config/liff';

export function useLiff(): LiffState {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!LIFF_ID) {
      setError('LIFF_ID is not configured');
      setIsReady(true);
      return;
    }

    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        setIsInClient(liff.isInClient());

        if (!liff.isLoggedIn()) {
          setIsReady(true);
          return;
        }

        setIsLoggedIn(true);
        setIdToken(liff.getIDToken());

        try {
          const profile = await liff.getProfile();
          setLineUserId(profile.userId);
          setDisplayName(profile.displayName);
          setPictureUrl(profile.pictureUrl || null);
        } catch (e: any) {
          console.error('LIFF getProfile error:', e);
          setError('ไม่สามารถดึงข้อมูลโปรไฟล์ LINE ได้');
        }

        setIsReady(true);
      })
      .catch((e: any) => {
        console.error('LIFF init error:', e);
        setError('ไม่สามารถเชื่อมต่อ LINE ได้');
        setIsReady(true);
      });
  }, []);

  const login = useCallback(() => {
    if (LIFF_ID && !liff.isLoggedIn()) {
      liff.login();
    }
  }, []);

  const logout = useCallback(() => {
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
    }
  }, []);

  return { isReady, isLoggedIn, isInClient, lineUserId, displayName, pictureUrl, idToken, error, login, logout };
}
