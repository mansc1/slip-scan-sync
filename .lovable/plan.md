Findings with evidence:

1. `extract-slip` is creating database records.
  - DB row exists for the uploaded slip:
  - A newer manual-upload row also exists:
    ```text
    transactions.id = 5083fd03-7a8c-4bb3-a22a-0d44c27f9232
    status = pending_confirmation
    source = manual_upload
    user_id = null
    line_user_id = null
    ```
2. `transaction_images` is also being inserted.
  - For `a7a7701e-19fd-42dd-8ea5-c2a85a940845`, there is a related image row:
  - Latest manual-upload rows also show `image_rows = 1`.
3. Actual response payload from `extract-slip` currently is:
  ```json
   {
     "transaction_id": "a7a7701e-19fd-42dd-8ea5-c2a85a940845",
     "status": "pending_confirmation",
     "source": "manual_upload",
     "extraction": { ... },
     "extraction_failed": false,
     "error_message": null
   }
  ```
   Missing field: `created`.
4. Edge logs confirm insert execution:
  ```text
   Inserting transaction: {
     userId: null,
     lineUserId: undefined,
     source: "manual_upload",
     extractionFailed: false
   }
  ```
   and prior logs already showed:

Exact root cause:

- This is not a failed insert.
- The manual upload happened while unauthenticated. The network request used the anon token, not a logged-in user token.
- In `extract-slip`, that means:
  - `userId = null`
  - `lineUserId = null`
  - transaction is inserted with no owner identity
- In the dashboard, `useTransactions()` does this:
  - if no auth session → returns `DEMO_TRANSACTIONS`
  - it does not query the real database at all
- So the new row exists in the database, but the dashboard never loads it in demo mode.
- Even if it did query the DB, current RLS would not expose rows with `user_id = null`.

What is not causing the issue in the observed run:

- Not invalid enum: row saved with `status = pending_confirmation`, `source = manual_upload`
- Not null constraint: row inserted successfully
- Not foreign key: image row inserted too
- Not source filtering: dashboard query does not filter by `source`
- Not month filtering: dashboard query does not filter by month
- Not default status filtering: default is `all`
- Not cache invalidation alone: cache can refresh, but demo mode still returns hardcoded demo data

Implementation plan:

1. Fix the ownership model first
  - Do not create persistent transactions with both `user_id` and `line_user_id` empty
  - For manual upload:
    - logged-in admin → save with `user_id`
    - LINE flow → save with `line_user_id`
    - demo/testing mode → use an explicit `demo_session_id` ownership model, or block persistence
  - This is the real fix
2. Fix `extract-slip` response and logs
  - Always return:
  - Add logs for:
    - before insert
    - full insert payload
    - insert result
    - inserted transaction id
    - image insert result
    - any Supabase error
  - Also fix fallback `source` to `manual_upload` instead of `manual`
3. Fix demo-mode visibility path
  - Current demo mode is read-only fake data
  - If you want demo uploads to create visible test transactions, add:
    - `demo_session_id` column
    - browser-persisted demo session id
    - backend read path for that session’s transactions
  - If you want the simpler safe version, require admin login before saving manual uploads
4. Keep authenticated admin flow working
  - When logged in, manual upload should save with `user_id = auth.uid()`
  - Existing RLS then allows the dashboard query to see the row
  - Cache invalidation can remain, but it is secondary
5. Frontend query behavior to keep/adjust
  - `useTransactions()` currently hides all DB data in unauthenticated mode
  - Change it to:
    - authenticated admin → query DB directly
    - demo session → fetch demo-session-owned rows through backend
    - otherwise → show static demo data only

Files to change:

- `supabase/functions/extract-slip/index.ts`
- `src/components/dashboard/SlipUploader.tsx`
- `src/hooks/useTransactions.ts`
- `src/pages/Index.tsx`
- new migration if implementing `demo_session_id`

Recommended implementation order:

1. Fix `extract-slip` owner validation + response shape + logs
2. Decide demo-mode persistence model
3. Update dashboard data loading for that model
4. Keep cache invalidation after upload

Bottom line:

- The database insert path is working.
- The visible failure is caused by ownerless rows being created during unauthenticated manual upload, combined with demo-mode dashboard logic that never loads real DB rows.  
  
1. Do not persist real transactions when both `user_id` and `line_user_id` are empty, unless there is an explicit demo-session ownership model.
  2. Prefer the simpler MVP path first: require admin login for persistent manual-upload transactions, and keep unauthenticated users on static demo data only.
  3. If a manual upload is attempted while unauthenticated, show a clear UI message such as:
     "Manual upload in demo mode does not save real transactions. Please use Admin Login to test real persistence."
  &nbsp;
  Also:
  - return `created: true/false` in every `extract-slip` response
  - keep `source` normalized to `manual_upload`
  - preserve the current cache invalidation after successful upload