# Fix Manual Upload → Transaction Creation Flow

## Problem Analysis

The `extract-slip` edge function **already has the code** to create transaction and transaction_images records (lines 246-290). The function uses the service role key, so RLS is not blocking inserts. The actual issues are:

1. **Dashboard never refreshes** — `Index.tsx` line 72 just shows a toast on `onExtracted`, never invalidates the React Query cache, so the new transaction doesn't appear
2. **Source mismatch** — frontend sends `source: 'manual'` but the plan specifies `manual_upload` as the source value
3. **Unauthenticated uploads** — if no user is logged in, `user_id` is null, and the RLS SELECT policy (`auth.uid() = user_id`) won't return the transaction on the dashboard

## Changes

### 1. `src/pages/Index.tsx` — Refresh dashboard after upload

- Import `useQueryClient` from `@tanstack/react-query`
- In the `onExtracted` callback, call `queryClient.invalidateQueries({ queryKey: ['transactions'] })` so the new pending transaction appears immediately

### 2. `src/components/dashboard/SlipUploader.tsx` — Fix source value + better error handling

- Change `source: 'manual'` → `source: 'manual_upload'` to match the documented source convention
- Surface the `transaction_id` from the response in the success toast
- Handle 409 duplicate response gracefully (show "duplicate detected" instead of generic error)

### 3. `supabase/functions/extract-slip/index.ts` — Minor logging improvements

- Add `console.log` before and after the transaction insert so we can see in edge function logs whether the insert succeeded or failed
- The function already handles both authenticated (dashboard) and LINE identity correctly

### 4. No RLS changes needed

- The edge function uses the **service role key** for all DB operations, which bypasses RLS entirely
- Dashboard queries go through the anon client with RLS — for authenticated users, `user_id` matches `auth.uid()` so transactions are visible
- For unauthenticated "demo mode" users, `useTransactions` already returns `DEMO_TRANSACTIONS` (line 18 of useTransactions.ts), so they won't see real DB data anyway — this is correct behavior

## Summary of Root Cause

The extraction and DB insert are working. The dashboard just never refreshes its cached query after upload. One line of query invalidation fixes the core issue.  
  
Approve, with two small additions:

1. After upload success, invalidate both the transactions list query and any dashboard summary/stat queries, not just `['transactions']`, so the overview cards also refresh immediately.

2. In the success path, verify that the edge function response always returns `transaction_id`, `status`, and `source`, and log them clearly in the frontend so we can confirm the created record matches the expected `pending_confirmation` + `manual_upload` flow.