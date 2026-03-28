# SlipSync MVP — Personal Expense Tracker via LINE Bot

## What We're Building

A React + Supabase app that receives payment slip images (via LINE bot or manual upload), extracts expense data using Lovable AI, lets users confirm/edit, and exports to Google Sheets, Google Drive, and Excel. The OCR+AI extraction layer is provider-based and swappable.

## Architecture

┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  LINE Bot   │────▶│  Supabase Edge Fns   │────▶│  Supabase DB    │
│  (webhook)  │     │  - line-webhook      │     │  (Postgres)     │
└─────────────┘     │  - extract-slip      │     └─────────────────┘
                    │  - sync-sheets       │     ┌─────────────────┐
┌─────────────┐     │  - sync-drive        │────▶│  Supabase       │
│  React SPA  │────▶│  - export-excel      │     │  Storage        │
│  (Dashboard)│     │  - line-reply        │     └─────────────────┘
└─────────────┘     └──────────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Lovable AI  │  (swappable provider)
                    │ Gateway     │
                    └─────────────┘

## Implementation Phases

### Phase 1: Foundation (Database + Types + Storage)

**Database migrations:**

- `users` table (id, line_user_id, display_name, created_at)
- `transactions` table (all fields from spec including status enum, sync statuses)
- `transaction_images` table
- `export_jobs` table
- RLS policies for authenticated access
- Storage bucket `slip-images` for uploaded slip files

**Frontend types:**

- TypeScript types mirroring all DB tables
- Enum types for transaction_status, transaction_type, payment_status, category, sync_status

### Phase 2: Swappable Extraction Service

**Edge function `extract-slip`:**

- Accepts base64 image
- Uses a provider pattern internally:
  - `LovableAIProvider` (default) — sends image to Lovable AI Gateway with a structured prompt + tool calling to extract the 18+ fields (Thai date handling, Buddhist→Gregorian conversion, confidence scoring)
  - Provider interface: `{ extract(imageBase64: string): Promise<SlipExtractionResult> }`
  - Provider selected via env var `SLIP_EXTRACTION_PROVIDER` (default: `lovable-ai`)
- Returns structured JSON matching the spec's field list
- Stores raw OCR text alongside parsed result

### Phase 3: LINE Bot Integration

**Edge function `line-webhook`:**

- Validates LINE webhook signature
- Handles image messages: fetches binary from LINE, stores in Supabase Storage, calls `extract-slip`, saves transaction as `pending_confirmation`, replies with Thai summary + Confirm/Edit/Ignore buttons (quick reply or postback)
- Handles postback actions: confirm → mark confirmed + trigger syncs; ignore → mark ignored
- Handles text commands: เดือนนี้ใช้ไปเท่าไร, สรุปรายจ่ายเดือนนี้, etc. → query DB and reply
- Idempotent via message deduplication (store processed message IDs)

**Edge function `line-reply`:**

- Helper to send LINE reply messages (text + buttons)

### Phase 4: Dashboard UI

**Pages:**

- `/` — Dashboard overview with cards (monthly total, yearly total, slip count) + transaction list
- `/transactions/:id` — Detail view with slip image, extracted fields, raw OCR, confidence, sync status
- `/transactions/:id/edit` — Edit form (also usable as LIFF page for LINE in-app editing)
- `/settings` — Admin settings (LINE credentials, Google config, categories)

**Components:**

- `DashboardOverview` — summary cards using recharts
- `TransactionTable` — sortable/filterable table with columns: date, type, merchant, amount, category, status, actions
- `TransactionFilters` — month picker, category select, merchant search, status filter
- `TransactionDetail` — image viewer + field display + sync status badges
- `TransactionEditForm` — editable fields (amount, date, time, merchant, category, notes) with save/cancel/ignore
- `SlipUploader` — manual upload for demo/testing (drag-and-drop image → extract)

**Layout:**

- Sidebar navigation with: Dashboard, Transactions, Export, Settings
- Responsive design with mobile support

### Phase 5: Demo Mode

- Toggle in settings or auto-detect when no LINE credentials configured
- 5-6 sample Thai payment slip mock results pre-loaded
- Mock extraction that returns realistic JSON without calling AI
- Allows full dashboard preview without any external integration

### Phase 6: Export Features

**Edge function `export-excel`:**

- Query confirmed transactions by month or date range
- Generate .xlsx with summary sheet + detailed transactions sheet
- Return download URL from Supabase Storage
- Filename: `personal-expenses-YYYY-MM.xlsx`

**Edge function `sync-sheets`:**

- Append confirmed transaction row to Google Sheet
- Track sync_status per transaction (pending, synced, failed)
- Deduplication check before appending
- Retry on failure with error logging

**Edge function `sync-drive`:**

- Upload slip image to Google Drive
- Organize in year/month folders
- Rename: `YYYY-MM-DD_amount_merchant_reference`
- Save Drive URL back to transaction record

### Phase 7: Settings & Configuration

- Admin auth via simple Supabase email/password
- Settings page for LINE channel credentials (stored as secrets)
- Google Sheets spreadsheet ID configuration
- Google Drive folder ID configuration
- Category management (view/edit default categories)

## Technical Details

**Extraction provider interface (in edge function):**

```typescript
interface SlipExtractionProvider {
  extract(imageBase64: string, mimeType: string): Promise<SlipExtractionResult>;
}
// Implementations: LovableAIProvider, GoogleVisionProvider (future), etc.
```

**Lovable AI provider approach:**

- Send image as base64 in user message content (multimodal)
- Use tool calling with a schema matching all 18 extraction fields
- System prompt handles Thai-specific parsing rules (Buddhist year, masked names, Thai month abbreviations)

**LINE webhook flow:**

- Verify `x-line-signature` header using channel secret HMAC-SHA256
- Parse events array, handle `message` (type: image) and `postback` events
- Use LINE Content API to fetch image binary
- Store in `slip-images` bucket, get public URL

**Google integrations:**

- Google Sheets: use service account JSON key, googleapis REST API
- Google Drive: same service account, upload via multipart
- Credentials stored as Supabase secrets

**Required secrets (to be added by user):**

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (for Sheets + Drive)
- `GOOGLE_SHEET_ID`
- `GOOGLE_DRIVE_FOLDER_ID`

**File count estimate:** ~25 new files (6 edge functions, 8-10 page/component files, types, hooks, utils, migrations)

## Build Order

- Enable Lovable Cloud / Supabase connection
- Database schema + types
- Extract-slip edge function with Lovable AI provider
- Dashboard UI with demo mode (manual upload + mock data)
- LINE webhook + reply edge functions
- Transaction confirm/edit/ignore flow
- Excel export
- Google Sheets sync
- Google Drive sync

Settings page + admin auth

&nbsp;

This architecture looks good. Please proceed, but make these adjustments:

1. Store slip images in a private Supabase Storage bucket, not public. Use signed URLs or authenticated access only.

2. For Google Sheets and Google Drive MVP integration, use a service account only if the target sheet and folder are explicitly shared with that service account. Document this setup clearly.

3. Do not block LINE webhook or confirm flow on Google sync. Mark syncs as pending and process Sheets/Drive asynchronously after confirmation.

4. Store raw OCR text, raw provider response, and normalized parsed JSON for debugging.

5. Add duplicate slip detection using image hash in addition to LINE message ID deduplication.

6. Keep manual slip upload in the dashboard for testing before LINE is fully configured.

Please keep the MVP focused on:

- personal expense tracking

- pending confirmation flow

- confirm / edit / ignore

- dashboard

- LINE bot ingestion

- swappable extraction provider