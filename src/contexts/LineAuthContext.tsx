import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface LineIdentity {
  displayName: string;
  lineUserId: string;
  pictureUrl?: string;
  /** Raw LIFF ID token — sent to backend on every request for server-side verification */
  idToken: string;
}

interface LineAuthContextType {
  lineIdentity: LineIdentity | null;
  setLineIdentity: (identity: LineIdentity | null) => void;
  clearLineIdentity: () => void;
  isLineUser: boolean;
}

const LineAuthContext = createContext<LineAuthContextType | null>(null);

export function LineAuthProvider({ children }: { children: ReactNode }) {
  const [lineIdentity, setLineIdentityState] = useState<LineIdentity | null>(null);

  const setLineIdentity = useCallback((identity: LineIdentity | null) => {
    setLineIdentityState(identity);
  }, []);

  const clearLineIdentity = useCallback(() => {
    setLineIdentityState(null);
  }, []);

  return (
    <LineAuthContext.Provider value={{
      lineIdentity,
      setLineIdentity,
      clearLineIdentity,
      isLineUser: !!lineIdentity,
    }}>
      {children}
    </LineAuthContext.Provider>
  );
}

export function useLineAuth() {
  const ctx = useContext(LineAuthContext);
  if (!ctx) throw new Error('useLineAuth must be used within LineAuthProvider');
  return ctx;
}
