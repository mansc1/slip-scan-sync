/**
 * Get the freshest available LINE ID token.
 * Tries liff.getIDToken() first (which may return a refreshed token),
 * falls back to a cached token if provided.
 */
export function getFreshLineIdToken(cachedToken?: string | null): string | null {
  try {
    // Dynamic import avoided — liff is a singleton; if initialized, getIDToken works
    const liff = (window as any).__liff || require('@line/liff').default;
    const fresh = liff?.getIDToken?.();
    if (fresh) return fresh;
  } catch {
    // LIFF SDK not available or not initialized
  }
  return cachedToken || null;
}
