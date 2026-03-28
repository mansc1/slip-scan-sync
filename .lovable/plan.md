SlipSync MVP — Full Implementation Plan

## Current State

- **Database**: Schema fully deployed (transactions, users, transaction_images, export_jobs, processed_messages tables + enums + RLS + storage bucket)
- **Frontend**: Dashboard, transaction detail/edit pages, filters, uploader components all exist with demo data
- **Edge Functions**: None created yet
- **Auth**: No login/signup pages
- **Missing**: All 6 edge functions, authentication pages, auth-aware routing

## What Needs to Be Built

### 1. Authentication (Login/Signup)

- Create `src/pages/Auth.tsx` — email/password login + signup form
- Create `src/hooks/useAuth.ts` — auth state hook using `onAuthStateChange`
- Add auth-aware routing in `App.tsx` — redirect unauthenticated users to `/auth`
- Update `AppSidebar.tsx` — show user info + logout button instead of "Demo Mode"
- Auto-create profile row in `users` table on signup via database trigger

### 2. Edge Function: `extract-slip`

- `supabase/functions/extract-slip/index.ts`
- Accepts `{ image: base64, mimeType, source }` 
- Provider pattern: `SlipExtractionProvider` interface with `LovableAIProvider` default
- LovableAI provider sends image to Lovable AI Gateway (`google/gemini-2.5-flash`) with structured extraction prompt for Thai slips
- Stores image in `slip-images` bucket, creates transaction as `pending_confirmation`, creates `transaction_images` record
- Returns extracted data + transaction ID
- Handles Buddhist year conversion, Thai date parsing, confidence scoring

### 3. Edge Function: `line-webhook`

- `supabase/functions/line-webhook/index.ts`
- Validates LINE signature (HMAC-SHA256)
- Handles image messages: fetch from LINE Content API → store → call extract-slip logic → reply with summary + Confirm/Edit/Ignore buttons
- Handles postback: confirm/ignore actions
- Handles text commands: monthly summary queries
- Idempotent via `processed_messages` table
- Duplicate detection via image hash

### 4. Edge Function: `line-reply`

- `supabase/functions/line-reply/index.ts`
- Helper to send LINE reply/push messages with text + template buttons

### 5. Edge Function: `export-excel`

- `supabase/functions/export-excel/index.ts`
- Query confirmed transactions by month
- Generate XLSX using a lightweight approach (build CSV or use a Deno-compatible xlsx library)
- Upload to storage, return signed URL
- Create `export_jobs` record

### 6. Edge Function: `sync-sheets`

- `supabase/functions/sync-sheets/index.ts`
- Append confirmed transaction to Google Sheet via Sheets API v4
- Uses service account JSON from secrets
- Update `sheets_sync_status` on transaction
- Dedup check before appending

### 7. Edge Function: `sync-drive`

- `supabase/functions/sync-drive/index.ts`
- Upload slip image to Google Drive folder
- Create year/month subfolder structure
- Rename file: `YYYY-MM-DD_amount_merchant_reference`
- Save Drive URL back to transaction, update `drive_sync_status`

### 8. Database Migration: Add trigger for profile auto-creation

- Create a trigger on `auth.users` — actually, create a DB function + trigger to auto-insert into `public.users` on new auth user signup

### 9. Wire Up Confirmation Flow

- Update `useConfirmTransaction` to also invoke `sync-sheets` and `sync-drive` asynchronously after marking confirmed
- Or better: trigger syncs from within the confirm mutation's `onSuccess` callback

## Technical Details

**Edge function CORS**: All functions called from frontend will include standard CORS headers.

**Auth flow**: Simple email/password. No auto-confirm (users verify email).

**Lovable AI extraction**: Use `google/gemini-2.5-flash` via the AI gateway with a structured system prompt that:

- Identifies Thai payment slip fields
- Converts Buddhist Era years (e.g., 2569 → 2026)
- Returns JSON matching `SlipExtractionResult` interface
- Includes confidence scoring

**LINE webhook secrets needed**: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`
**Google secrets needed**: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_FOLDER_ID`

**Excel generation**: Use `sheetjs` CDN import in Deno edge function for XLSX generation.

## Build Order (single implementation pass)

1. DB migration: auto-create user profile trigger
2. Auth pages + routing
3. `extract-slip` edge function (core AI extraction)
4. `line-webhook` + `line-reply` edge functions
5. `export-excel` edge function
6. `sync-sheets` edge function
7. `sync-drive` edge function
8. Update frontend to be auth-aware throughout
9. Wire confirmation flow to trigger syncs

## Files to Create/Edit (~15 files)

**New files:**

- `src/pages/Auth.tsx`
- `src/hooks/useAuth.ts`
- `supabase/functions/extract-slip/index.ts`
- `supabase/functions/line-webhook/index.ts`
- `supabase/functions/line-reply/index.ts`
- `supabase/functions/export-excel/index.ts`
- `supabase/functions/sync-sheets/index.ts`
- `supabase/functions/sync-drive/index.ts`

**Edited files:**

- `src/App.tsx` — add auth route + protected routing
- `src/components/layout/AppSidebar.tsx` — auth-aware sidebar
- `src/hooks/useTransactions.ts` — pass user context
- `src/components/dashboard/SlipUploader.tsx` — handle auth
- New DB migration for user profile trigger

**Secrets to request from user:**

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_SHEET_ID`
- `GOOGLE_DRIVE_FOLDER_ID`

All secrets will be requested only when the user is ready to configure each integration. The app works in demo mode without any secrets.  
  
This plan looks good. Before implementation, please make these adjustments:

1. Store slip images in a private Supabase Storage bucket only, and use signed URLs for display.

2. Keep responsibilities clean: image storage should happen in LINE/manual upload flow, while `extract-slip` should focus on extraction and normalized parsing only.

3. Do not block confirmation on Google sync. Confirm first, mark sync statuses as pending, then run Sheets/Drive sync asynchronously.

4. Store `raw_ocr_text`, `raw_provider_response`, `normalized_result_json`, and `image_hash` for debugging and provider migration.

5. Ensure LINE postback actions validate ownership: a transaction can only be confirmed/ignored/edited by the same LINE user who created it.

6. Add clear failure handling for extraction errors, including saving an `extraction_failed` status and replying to the user appropriately.

7. Support transaction statuses at least: `pending_confirmation`, `confirmed`, `ignored`, and `extraction_failed`.

8. Clarify auth and ownership model between Supabase auth users, public users table, and line_user_id, and keep RLS aligned with that model.

If these adjustments are accepted, proceed with implementation.