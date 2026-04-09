import liff from '@line/liff';

/**
 * Get the freshest available LINE ID token.
 * Calls liff.getIDToken() for the latest token from the SDK,
 * falls back to a cached token if the SDK returns null.
 */
export function getFreshLineIdToken(cachedToken?: string | null): string | null {
  try {
    const fresh = liff.getIDToken();
    if (fresh) return fresh;
  } catch {
    // LIFF SDK not initialized yet
  }
  return cachedToken || null;
}
