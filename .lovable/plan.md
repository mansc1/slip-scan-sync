# Fix: Web LIFF Dashboard Shows Zero Data Due to Expired ID Token

## Root Cause

The `LiffDashboard` component captures `liff.getIDToken()` **once** during initialization and stores it in `LineAuthContext`. LINE ID tokens expire in ~10 minutes.

- **Mobile (in-client)**: The LIFF SDK manages token refresh internally. `liff.getIDToken()` returns a valid token on each call.
- **Web (external browser)**: The cached token in `LineAuthContext` expires. When `useMyTransactions` sends this stale token, the backend returns `"IdToken expired"` → the edge function returns an error → the hook gets zero results or throws.

Evidence from edge function logs:

```
"LINE token verify failed: 400 {"error":"invalid_request","error_description":"IdToken expired."}"
```

This happens repeatedly in the web flow, while the mobile flow shows successful verification with the same `lineUserId`.

## Fix (2 files)

### 1. `useMyTransactions.ts` — Get fresh token before each request

Instead of using the cached `lineIdentity.idToken`, call `liff.getIDToken()` at request time to get the freshest available token. Fall back to the cached token if the SDK call fails.

```typescript
// Before each API call:
const freshToken = liff.getIDToken() || lineIdentity.idToken;
```

### 2. `LiffDashboard.tsx` — No structural change needed

The initial token capture is fine for bootstrapping. The fix is in the data-fetching layer.

## Files


| File                             | Change                                                              |
| -------------------------------- | ------------------------------------------------------------------- |
| `src/hooks/useMyTransactions.ts` | Call `liff.getIDToken()` fresh before each edge function invocation |


## Why This Works

- `liff.getIDToken()` in the web external browser returns the current token from the SDK's internal state. If the SDK has refreshed it (e.g., after re-init), it returns the new one.
- In-client, the SDK always manages refresh automatically.
- The cached token in context remains as a fallback and for display name / profile info.
- No backend changes needed — the same verification logic works with a fresh token.  


Approve, with these additions:

1. If `liff.getIDToken()` returns null or an expired/invalid token response still happens, show a clear re-login / retry state instead of silently showing empty data.

2. Do not treat token verification failure as “zero transactions”; distinguish:

   - empty data

   - auth/token error

3. Reuse the same fresh-token logic for all LINE-user edge-function calls, not only `my-transactions`, so dashboard and transaction-detail flows stay consistent.