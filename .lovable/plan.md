# LINE Login + LIFF Integration Plan

## Overview

Add LIFF (LINE Front-end Framework) as the primary end-user authentication path. LINE users who send slips via the bot can tap "แก้ไข" (Edit) to open a LIFF page showing the transaction detail/edit form — authenticated via their LINE identity, no email required. Admin dashboard keeps email/password auth separately.

## Architecture

```text
LINE Bot (slip image)
  → extract-slip → transaction created
  → Reply: Confirm | Edit (LIFF URL) | Ignore
                        ↓
              LIFF page (/liff/transaction/:id)
              Authenticated via liff.getProfile()
              Shows detail + edit form
              Confirm/Edit/Ignore actions
              Calls edge function with line_user_id
```

## Changes

### 1. Install LIFF SDK

- Add `@line/liff` npm dependency

### 2. New Edge Function: `liff-action`

- Accepts `{ action, transactionId, lineUserId, updates? }`
- Validates ownership: `transaction.line_user_id === lineUserId`
- Performs confirm/update/ignore using service role
- Returns updated transaction
- No JWT required (uses LINE identity validation)

### 3. New Frontend Pages

- `**/liff/transaction/:id**` — Mobile-optimized transaction detail + confirm/edit/ignore
  - On mount: call `liff.init()` → `liff.getProfile()` to get LINE userId
  - Fetch transaction via `liff-action` edge function (passing lineUserId for ownership)
  - Show transaction summary with action buttons
  - No AppLayout/sidebar — clean mobile-first UI
  - If not in LIFF context, call `liff.login()` to redirect through LINE Login

### 4. New Hook: `useLiff`

- Initializes LIFF SDK with the LIFF ID from env
- Returns `{ lineUserId, displayName, pictureUrl, isInClient, isReady, login }`
- Handles both in-app (LINE browser) and external browser cases

### 5. Update `line-webhook` Reply Messages

- Change the "Edit" postback button to a URI action pointing to the LIFF URL:
  ```json
  { "type": "uri", "label": "✏️ แก้ไข", "uri": "https://liff.line.me/{LIFF_ID}/transaction/{txId}" }
  ```
- Keep Confirm and Ignore as postback buttons (fast one-tap actions)

### 6. New Edge Function: `liff-transaction`

- GET-style function to fetch a single transaction by ID + lineUserId
- Validates ownership before returning data
- Used by the LIFF page to load transaction details

### 7. Add Route in App.tsx

- `/liff/transaction/:id` → new `LiffTransaction` page (no ProtectedRoute wrapper)

### 8. Environment / Secrets

- Need `LIFF_ID` — user must create a LIFF app in LINE Developers Console
- Store as a Vite env var (`VITE_LIFF_ID`) since it's a public client-side ID
- Also store as edge function secret for the webhook to construct LIFF URLs

## Files to Create/Modify


| File                                           | Action                                         |
| ---------------------------------------------- | ---------------------------------------------- |
| `src/hooks/useLiff.ts`                         | Create — LIFF SDK init + profile               |
| `src/pages/LiffTransaction.tsx`                | Create — Mobile confirm/edit page              |
| `src/App.tsx`                                  | Add `/liff/transaction/:id` route              |
| `supabase/functions/liff-action/index.ts`      | Create — Confirm/edit/ignore via LINE identity |
| `supabase/functions/liff-transaction/index.ts` | Create — Fetch transaction for LIFF page       |
| `supabase/functions/line-webhook/index.ts`     | Update reply to include LIFF edit URL          |
| `package.json`                                 | Add `@line/liff` dependency                    |


## Secrets Needed

- `**LIFF_ID**`: The LIFF app ID from LINE Developers Console. Will be requested via the secrets tool. Also needs to be set as `VITE_LIFF_ID` in the frontend (added to code as a constant or env var).

## What Does NOT Change

- Admin dashboard auth (email/password via Supabase Auth)
- Existing postback Confirm/Ignore flow (still works as fast one-tap)
- Database schema (no migration needed)
- RLS policies (LIFF edge functions use service role)
- `extract-slip` edge function
- Demo mode behavior

## Security

- LIFF pages validate LINE identity via `liff.getProfile()` — the `userId` from LIFF SDK is cryptographically verified by LINE
- Edge functions validate that `line_user_id` on the transaction matches the requesting user
- No transaction data is exposed without ownership validation  
  
1. Do not trust `lineUserId` from the frontend alone.
     For LIFF-based requests, verify identity on the backend using a signed ID token or another LINE-supported verification method, instead of relying only on a client-passed userId.
  &nbsp;
  2. Prefer one transaction read/write endpoint family for LIFF:
     - fetch transaction by transactionId + verified LINE identity
     - confirm / edit / ignore with the same verified LINE identity
     Keep ownership validation centralized and consistent.
  &nbsp;
  3. Add explicit handling for expired, missing, or already-finalized transactions.
     The LIFF page should show clear states such as:
     - transaction not found
     - not owned by this LINE user
     - already confirmed
     - already ignored
     - expired link
  &nbsp;
  4. Make the LIFF page mobile-first and minimal:
     - summary at top
     - edit fields only where needed
     - large Confirm / Save / Ignore buttons
     - fast loading, no dashboard UI elements
  &nbsp;
  5. Keep the edit URL generation configurable:
     - use a single frontend base URL config
     - generate LIFF URLs consistently in one helper
     - avoid hardcoding hostnames in the webhook function