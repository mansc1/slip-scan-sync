# SlipSync — Integration & Testing Checklist

This is a step-by-step testing guide. No code changes needed — this documents what to do, what to configure, and what success looks like at each stage.

---

## Step 1: Verify Auth and Demo Mode

**Secrets/config needed:** None

**How to test:**
1. Open the app at the preview URL
2. Verify the dashboard loads with 6 demo transactions
3. Click "เข้าสู่ระบบ" in the sidebar bottom — should navigate to `/auth`
4. Switch to "สมัครสมาชิก" mode, enter an email and password (min 6 chars), submit
5. Check email inbox for verification link, click it
6. Return to `/auth`, log in with the same credentials
7. After login, dashboard should load but show **no transactions** (empty state — demo data only shows when unauthenticated)
8. Sidebar should show your email instead of "Demo Mode"
9. Click logout — should return to demo mode with sample data

**What success looks like:**
- Demo mode: 6 sample transactions visible, no login required
- Auth: signup → email verification → login → empty dashboard (real DB)
- Logout returns to demo mode

**Common failures:**
- "Email not confirmed" error → check spam folder for verification email
- Blank screen after login → check browser console for RLS or session errors
- Demo data still showing after login → `useTransactions` may not be detecting the session

---

## Step 2: Manual Upload → extract-slip → pending_confirmation

**Secrets/config needed:** None (LOVABLE_API_KEY is already configured)

**How to test:**
1. Log in with your verified account
2. On the dashboard, use the "อัปโหลดสลิป" uploader or navigate to "/upload"
3. Upload a Thai payment slip image (JPG or PNG)
4. Wait for the spinner — the `extract-slip` edge function will:
   - Store the image in the **private** `slip-images` bucket (not public)
   - Send it to Gemini 2.5 Flash for extraction
   - Create a `pending_confirmation` transaction
5. After extraction, the transaction should appear in the dashboard table with status "รอยืนยัน"
6. Click the eye icon to view transaction detail — verify extracted fields (amount, merchant, date, category, confidence)
7. **Verify debug fields are present:** `raw_ocr_text`, `raw_provider_response`, `normalized_result_json`, and `image_hash`
8. **Verify slip image is displayed via signed URL** (not a public URL) — check the image src in browser dev tools
9. Click the edit icon to modify fields if needed
10. Click the confirm (✓) button — status should change to "ยืนยันแล้ว"
11. Click the ignore (✗) button on another pending transaction — status should change to "ข้าม"

**What success looks like:**
- Image uploads without error
- AI extracts amount, merchant name, date, bank name from the slip
- Transaction appears as `pending_confirmation` with correct Thai date
- Debug fields (`raw_ocr_text`, `raw_provider_response`, `image_hash`) are populated
- Slip image viewed only through signed URLs (private bucket)
- Confirm/ignore/edit all work
- Duplicate upload of same image returns a 409 conflict

**Common failures:**
- "LOVABLE_API_KEY not configured" → check secrets list (it's already there)
- "AI extraction failed" → check edge function logs; may be rate limiting (429) or image too large
- Transaction not appearing → RLS issue; ensure `user_id` matches `auth.uid()`
- Duplicate detection too aggressive → different crops produce different hashes (expected)
- Image displayed via public URL instead of signed URL → storage bucket misconfigured

---

## Step 3: Configure LINE Webhook

**Secrets needed:**

| Secret | Where to get it |
|--------|----------------|
| `LINE_CHANNEL_SECRET` | LINE Developers Console → your Messaging API channel → Basic settings → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console → your channel → Messaging API tab → Channel access token (long-lived) → Issue |

**LINE Developers Console setup:**
1. Go to https://developers.line.biz/console/
2. Create a Provider (if not exists) → Create a Messaging API channel
3. In Messaging API settings, set the Webhook URL to:
   `https://jkkafjdyesntgxzpahtw.supabase.co/functions/v1/line-webhook`
4. Enable "Use webhook"
5. Disable "Auto-reply messages" and "Greeting messages"

**How to test:**
1. Add the LINE bot as a friend (scan QR code from LINE Developers Console)
2. Send a Thai payment slip image to the bot
3. Bot should reply with extracted summary + Confirm/Ignore buttons
4. Tap "✅ ยืนยัน" → bot replies with confirmation
5. Tap "❌ ข้าม" on another slip → bot replies with skip confirmation
6. **Verify ownership validation:** postback confirm/ignore must validate that the `line_user_id` on the transaction matches the user performing the action — a different LINE user should not be able to confirm/ignore someone else's transaction
7. Type "สรุปเดือนนี้" → bot replies with monthly spending summary
8. Check the dashboard — LINE-ingested transactions should appear

**What success looks like:**
- Bot receives image, extracts data, replies with summary within ~10 seconds
- Confirm/Ignore buttons work and validate `line_user_id` ownership
- Transaction shows `source: line` in dashboard
- Duplicate slip sends warning message instead of re-processing
- Monthly summary returns correct totals

**Common failures:**
- "Invalid signature" (403) → channel secret is wrong or webhook URL has a typo
- Bot doesn't respond at all → webhook URL not set correctly, or "Use webhook" is off
- "LINE credentials not configured" → secrets not added yet
- Ownership bypass → another LINE user can confirm someone else's transaction (security bug)

---

## Step 4: Configure Google Sheets Sync

**Secrets needed:**

| Secret | Where to get it |
|--------|----------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud Console → IAM & Admin → Service Accounts → Create key (JSON) — paste the entire JSON content |
| `GOOGLE_SHEET_ID` | From the Google Sheet URL: `https://docs.google.com/spreadsheets/d/{THIS_PART}/edit` |

**Setup steps:**
1. Create a Google Cloud project (or use existing)
2. Enable the Google Sheets API
3. Create a Service Account → download JSON key
4. Create a new Google Sheet
5. **Share the sheet** with the service account email — give Editor access
6. Add column headers in row 1: Date, Time, Type, Merchant, Amount, Currency, Category, Bank, Reference, Payer, Notes, TransactionID

**How to test:**
1. Confirm a pending transaction in the dashboard (click ✓)
2. **Confirmation should succeed immediately** regardless of Sheets sync result (non-blocking)
3. Check the Google Sheet — a new row should appear within a few seconds
4. Check the transaction detail — `sheets_sync_status` should show "synced"
5. Try confirming the same transaction again — should not create a duplicate row

**What success looks like:**
- Transaction confirmation succeeds even if Sheets sync fails (non-blocking)
- Row appended to Sheet1 with correct data
- `sheets_sync_status` updates to `synced`
- No duplicate rows on re-confirm

**Common failures:**
- "Google Sheets not configured" → secrets not added; function returns `{skipped: true}` which is non-blocking
- "Failed to get Google access token" → service account JSON is malformed or missing `private_key`
- "Sheets API error: 403" → sheet not shared with the service account email
- "Sheets API error: 404" → wrong `GOOGLE_SHEET_ID`
- Confirmation blocked by sync failure → this is a bug; sync must be non-blocking

---

## Step 5: Configure Google Drive Sync

**Secrets needed:**

| Secret | Where to get it |
|--------|----------------|
| `GOOGLE_DRIVE_FOLDER_ID` | Create a folder in Google Drive → get the ID from the URL: `https://drive.google.com/drive/folders/{THIS_PART}` |

**Setup steps:**
1. Uses the **same service account** as Google Sheets (no new key needed)
2. Enable the Google Drive API in Google Cloud Console
3. Create a folder in Google Drive for slip storage
4. **Share the folder** with the service account email — give Editor access

**How to test:**
1. Confirm a pending transaction that has a slip image
2. **Confirmation should succeed immediately** regardless of Drive sync result (non-blocking)
3. Check the Google Drive folder — should see a `YYYY/MM/` subfolder structure
4. Inside the month folder, file should be named like `2026-03-28_110_merchant_ref.jpg`
5. **Verify the slip image was downloaded from the private bucket via signed URL**, not a public URL
6. Check the transaction detail — `drive_sync_status` should show "synced" and `drive_file_url` should have a Google Drive link

**What success looks like:**
- Transaction confirmation succeeds even if Drive sync fails (non-blocking)
- Image uploaded to correct year/month folder from private storage (signed URL)
- File named with date, amount, merchant, reference
- `drive_sync_status` = synced
- `drive_file_url` links to the uploaded file

**Common failures:**
- "Google Drive not configured" → `GOOGLE_DRIVE_FOLDER_ID` not set; non-blocking
- "Failed to download image from storage" → `source_image_url` path is wrong or file doesn't exist in bucket
- "Drive upload failed: 403" → folder not shared with service account
- Confirmation blocked by sync failure → this is a bug; sync must be non-blocking

---

## Step 6: Test Excel Export

**Secrets/config needed:** None

**How to test:**
1. Ensure you have at least 1 confirmed transaction
2. Navigate to `/export`
3. Select a month from the dropdown
4. Click "ดาวน์โหลด Excel"
5. Browser should open/download an `.xlsx` file
6. Open the file — should have two sheets:
   - **Summary**: totals by category
   - **Transactions**: all confirmed transactions for the month

**What success looks like:**
- File downloads successfully
- Filename format: `personal-expenses-2026-03.xlsx`
- Summary sheet shows category breakdown
- Transactions sheet has all fields (date, amount, merchant, category, etc.)
- Empty month returns a file with headers but no data rows

**Common failures:**
- "No month selected" → pick a month first
- Download URL doesn't work → signed URL may have expired (60 min TTL); try again
- File is corrupted → check edge function logs for SheetJS errors
- No data in file → no confirmed transactions for the selected month

---

## Recommended Testing Order

- **Step 1** — test now (no config needed)
- **Step 2** — test now (no config needed)
- **Step 3** — I'll request LINE secrets from you
- **Step 4** — I'll request Google secrets from you
- **Step 5** — I'll request the Drive folder ID
- **Step 6** — test now (no config needed)
