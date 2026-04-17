# Plan: Duplicate Expense Protection (Slip + Manual)

## Overview

Add a two-tier duplicate detection layer that runs before any new transaction is persisted, covering slip uploads, manual entries, and cross-overlaps between them. Hard duplicates are blocked (with explicit override available); probable duplicates surface a warning dialog with the existing transaction.

## Detection Tiers

**Hard duplicates** (block by default):

- Same `image_hash` (already enforced for slips via `extract-slip` 409 path — extend to be consistent everywhere)
- Same `reference_no` for the same owner (when reference_no is non-empty)
- Same `line_message_id` (already deduped via `processed_messages`)

**Probable duplicates** (warn, allow continue):

- Same owner (`user_id` OR `line_user_id`)
- Same `amount` (exact match within currency)
- Date/time within ±10 minutes of `transaction_datetime_iso`
- Similar merchant/payee (case-insensitive substring match on `merchant_name` / `receiver_name` / `payer_name`)
- Same `transaction_type` (when known)
- Excludes `cancelled` status from comparison

## Backend

### 1. New RPC: `find_duplicate_candidates`

Postgres function (SECURITY DEFINER, search_path=public) that takes:

- `_owner_user_id uuid`, `_owner_line_user_id text`
- `_amount numeric`, `_datetime timestamptz`
- `_merchant text`, `_reference_no text`, `_image_hash text`
- `_exclude_id uuid` (optional, for edits)

Returns:

- `match_type text` — `'hard_hash' | 'hard_reference' | 'probable'`
- `transaction_id uuid`, `amount`, `merchant_name`, `transaction_datetime_iso`, `status`, `source`

Filters out `cancelled` rows. Owner scoping uses `(user_id = _owner_user_id) OR (line_user_id = _owner_line_user_id)`. Probable matches require amount match + ±10 min window + (merchant similarity OR same datetime).

### 2. Edge function: `check-duplicate`

Thin wrapper that:

- Verifies LINE ID token (when provided) and resolves `line_user_id`, OR uses authenticated `user_id`
- Calls the RPC with verified owner identity
- Returns `{ hardMatch?: {...}, probableMatches: [...] }`

### 3. `liff-action` (`create` + `update`) updates

- Before insert/update, run the same duplicate check server-side
- Accept an `acknowledgeDuplicates: true` flag from the client
- If `hardMatch` and not acknowledged → return `409` with payload `{ duplicate: 'hard', existing }`
- If `probableMatches` and not acknowledged → return `409` with `{ duplicate: 'probable', candidates }`
- If acknowledged, proceed as normal

### 4. `extract-slip` adjustments

- Already returns `existing_transaction_id` on hash collision — formalize the response shape to `{ duplicate: 'hard', match_type: 'hard_hash', existing }` for consistency
- After OCR, also call the probable-duplicate check using extracted amount/datetime/merchant before creating the row, and surface that to the client

## Frontend

### 5. New shared hook: `useDuplicateCheck`

- Takes a draft payload (amount, datetime, merchant, reference_no, image_hash, ownerContext)
- Calls `check-duplicate` (or local Supabase query for admin)
- Returns `{ hardMatch, probableMatches, isChecking }`

### 6. New shared component: `DuplicateWarningDialog`

Reusable for slip + manual flows. Props:

- `open`, `onOpenChange`
- `match: { type: 'hard' | 'probable', existing: Transaction[] }`
- `onViewExisting(id)` — navigates to detail
- `onContinue()` — proceeds with save (for probable; for hard, only shown if explicit override is allowed)
- `onCancel()` — closes without saving

Layout: shows each candidate's amount, merchant, datetime, source badge (slip/manual), status. Three buttons: **ดูรายการเดิม**, **บันทึกต่อ** (hidden/disabled for hard duplicates without override), **ยกเลิก**.

### 7. Wire into flows

**Manual entry (`Index.tsx` create flow)**:

- On submit, call `useDuplicateCheck` first
- If `hardMatch` → open dialog without continue option
- If `probableMatches` → open dialog with all three buttons; "บันทึกต่อ" calls create with `acknowledgeDuplicates: true`
- If clean → proceed directly

**Slip upload (`SlipUploader.tsx`)**:

- `extract-slip` already handles hard hash collisions; surface the new structured response in a `DuplicateWarningDialog`
- For probable matches surfaced post-extraction, show the same dialog before final save

**LIFF (`LiffTransaction.tsx` create + edit)**:

- Same pattern — call check before `liff-action` mutation
- Reuse `DuplicateWarningDialog`

**Edit flows**: skip duplicate check when amount/datetime unchanged; pass `_exclude_id` when checking edits.

### 8. Edge cases

- Demo mode (no auth/no LINE token): skip duplicate check entirely
- Cancelled transactions never count as duplicates
- Cross-source overlap works because the check is owner-scoped, not source-scoped
- Reference number match only triggers when both sides have non-empty reference_no

## File Summary


| File                                                     | Action                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `supabase/migrations/<new>.sql`                          | Create `find_duplicate_candidates` RPC                 |
| `supabase/functions/check-duplicate/index.ts`            | New edge function                                      |
| `supabase/functions/liff-action/index.ts`                | Add duplicate check + `acknowledgeDuplicates` flag     |
| `supabase/functions/extract-slip/index.ts`               | Standardize duplicate response, add probable check     |
| `supabase/config.toml`                                   | Register `check-duplicate` if needed                   |
| `src/hooks/useDuplicateCheck.ts`                         | New shared hook                                        |
| `src/components/transactions/DuplicateWarningDialog.tsx` | New shared dialog                                      |
| `src/components/transactions/TransactionEditDialog.tsx`  | Hook in pre-save check for create mode                 |
| `src/components/dashboard/SlipUploader.tsx`              | Handle structured duplicate responses                  |
| `src/pages/Index.tsx`                                    | Wire dialog into manual create flow                    |
| `src/pages/LiffTransaction.tsx`                          | Wire dialog into LIFF create/edit                      |
| `src/hooks/useTransactions.ts`                           | `useCreateTransaction` accepts `acknowledgeDuplicates` |


## Out of Scope (for this iteration)

- Fuzzy merchant matching beyond substring (no trigram/Levenshtein yet)
- User-tunable thresholds (window size, similarity)
- Bulk duplicate cleanup tooling  
  
Additions:
  1. Keep the owner scope strict and explicit in every duplicate check.
     Never compare across different users, even if amount/time/merchant are identical.
  2. Treat duplicate detection as a save-time guard, not a background side effect.
     The final create/update endpoint must always re-check duplicates server-side, even if the client already checked first.
  3. For probable duplicates, do not block by default.
     Show a warning dialog and allow explicit continue with `acknowledgeDuplicates: true`.
  4. For hard duplicates, define override behavior clearly:
     - hash duplicate: block by default
     - reference number duplicate: block by default
     - only allow override if there is a clear product reason, and log it
  5. Make the duplicate dialog easy to understand:
     - show amount
     - merchant/details
     - date/time
     - source
     - status
     and clearly explain why it is considered a duplicate.
  6. Keep cancelled transactions excluded everywhere:
     - duplicate checks
     - default dashboard stats
     - normal summaries
  7. Add minimal auditability:
     - if a user saves despite a probable duplicate warning, store that decision or at least log it
     - if a hard duplicate override is ever allowed, record it explicitly  
    
  Also keep the duplicate response contract consistent across all flows:
  - slip upload
  - manual create
  - LIFF create/update
  So the frontend can always handle:
  - no duplicate
  - hard duplicate
  - probable duplicate
  with the same dialog and same decision flow.