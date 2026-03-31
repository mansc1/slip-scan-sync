# LINE-First Product Optimization

## Product Model Shift

The current app treats email/password as the primary auth path and the dashboard as the main UI. The user wants to flip this:

- **LINE bot = primary interface** for end users
- `**line_user_id` = primary identity** — no email signup required for regular use
- **Dashboard = admin/testing tool** — kept but de-emphasized
- **Email auth = optional** — only for dashboard access, not required for LINE users

## What Changes

### 1. Identity Model: LINE Users as First-Class Citizens

**Database migration:**

- The `users` table already has `line_user_id` column
- Transactions already have `line_user_id` column
- Need to adjust: LINE webhook should auto-create a `users` row keyed by `line_user_id` (without requiring `user_id` from Supabase Auth)
- RLS stays the same for dashboard (Supabase Auth users). LINE transactions are created via service role by the webhook

**No changes to Supabase Auth itself** — it remains for dashboard login only.

### 2. Update `line-webhook` Edge Function

Current flow already works well. Additions:

- Auto-create `users` record with `line_user_id` on first interaction (upsert)
- Store LINE display name via LINE Profile API (`GET https://api.line.me/v2/bot/profile/{userId}`)
- Ownership validation already exists for postback actions (confirmed in current code)

### 3. Update `extract-slip` Edge Function — Decouple from Auth

Currently `extract-slip` tries to get `userId` from the JWT auth header. When called from `line-webhook`, it uses service role key. This already works, but:

- Accept optional `lineUserId` parameter so the webhook can pass it through
- Set `user_id` to null and `line_user_id` to the LINE user ID for LINE-sourced transactions
- This means LINE transactions won't have a `user_id` (Supabase Auth ID) unless the user later links their account

### 4. Frontend: De-emphasize Email Auth

- **Dashboard stays as-is** — it's an admin/testing tool
- **Remove auth gate from dashboard** — keep demo mode as default (already works this way since `ProtectedRoute` allows unauthenticated access)
- **Sidebar**: Change "Demo Mode" label to something like "Admin Login" to reflect the dashboard's secondary role
- **Auth page**: Keep it but label it as "Admin / Dashboard Login"
- **SlipUploader**: Allow upload without login (for testing) — currently works since extract-slip handles null userId

### 5. LINE Webhook Enhancements for Mobile-First UX

- Fetch LINE user profile on first message to get display name
- Improve reply messages for mobile readability (shorter text, clear action buttons)
- Add a "📊 ดูสรุป" (view summary) quick action
- Ensure postback buttons use clear Thai labels

### 6. Optional Future: Account Linking

Add a mechanism for LINE users to optionally link to a Supabase Auth account (for dashboard access). This is NOT part of this change — just noting it as a future path.

## Files to Change


| File                                       | Change                                                        |
| ------------------------------------------ | ------------------------------------------------------------- |
| `supabase/functions/line-webhook/index.ts` | Auto-create `users` row with LINE profile, fetch display name |
| `supabase/functions/extract-slip/index.ts` | Accept `lineUserId` param, set on transaction                 |
| `src/components/layout/AppSidebar.tsx`     | Change "Demo Mode" → "Admin Login", de-emphasize auth         |
| `src/pages/Auth.tsx`                       | Update copy to "Admin / Dashboard Login"                      |
| `src/App.tsx`                              | No change needed (already allows unauthenticated access)      |
| New migration                              | Update `users` table: make `user_id` nullable if not already  |


## Database Migration

```sql
-- Make user_id nullable on users table (LINE users won't have one)
ALTER TABLE public.users ALTER COLUMN user_id DROP NOT NULL;

-- Add unique constraint on line_user_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS users_line_user_id_unique 
ON public.users (line_user_id) WHERE line_user_id IS NOT NULL;
```

## No Breaking Changes

- Dashboard continues to work exactly as before for email-authenticated users
- LINE webhook flow continues to work but now also creates user records
- Manual upload continues to work for testing
- All existing RLS policies remain valid  


This direction looks right, but please make these clarifications before implementation:

1. Clarify the identity model explicitly:

   - `users.id` should remain the internal primary key

   - if there is a Supabase Auth foreign key, name it clearly as `auth_user_id` and allow that to be nullable

   - `line_user_id` should be a separate unique identity field for LINE users

2. Do not overload `user_id` with multiple meanings. Keep internal user ID, auth user ID, and line_user_id clearly separated.

3. For LINE-ingested transactions, require `line_user_id` as the owner field. For dashboard/manual uploads, use `auth_user_id` when available. Do not create real transactions without a clear owner identity.

4. Clarify the dashboard access model:

   - either single-admin can view all transactions

   - or authenticated users can only view transactions tied to their own identity

   Keep RLS aligned with this choice.

5. Ensure all postback confirm/edit/ignore actions validate the same `line_user_id` as the transaction owner.

6. Keep `source` explicit for all transactions, such as `line`, `manual_upload`, and `demo`.

7. Since the product is now LINE-first, prepare the architecture for LIFF / LINE-authenticated confirm-edit pages, even if the first version still uses simple postback actions.