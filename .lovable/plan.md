## Goal

Add a month filter scoped **only** to the transaction list section. Summary cards and charts remain global/unchanged.

## Approach

### 1. Add month selector state in `Index.tsx`

- New state: `selectedMonth: string` in `YYYY-MM` format
- Default: latest month that has at least one non-cancelled transaction (computed from `allTransactions`)
- If no data, fall back to current month

### 2. Compute available months

Derive from `allTransactions` (all loaded data, excluding cancelled):

- Group by `YYYY-MM` of `transaction_datetime_iso` (fallback to `created_at`)
- Sort descending (latest first)
- Use this list to populate the selector dropdown

### 3. Filter list only

Add a new derived array `monthFilteredTransactions`:

- Start from existing `transactions` (already respects search/category/status filters and cancelled-exclusion logic)
- Further filter by `selectedMonth` matching the transaction's year-month
- Pass this to `<TransactionTable />` instead of `transactions`

**Untouched:**

- `stats` (passed to `OverviewCards`) — still global
- `chartTransactions` (passed to `MonthlyExpenseChart` + `CategoryBreakdown`) — still global

### 4. New component: `MonthSelector`

Location: `src/components/dashboard/MonthSelector.tsx`

- Props: `value`, `onChange`, `availableMonths: string[]`
- Renders a shadcn `Select` with Thai month labels (e.g. "เมษายน 2569" using Buddhist year, matching existing date_display style) plus transaction count per month
- Place it inside `TransactionFilters` row OR directly above the table — preferred: render it next to the existing `TransactionFilters` so all list-scoped controls sit together

### 5. Layout placement in `Index.tsx`

```text
[Header + เพิ่มรายจ่าย button]   ← unchanged
[OverviewCards — global]          ← unchanged
[Charts — global]                 ← unchanged
[TransactionFilters + MonthSelector]   ← month selector added here
[TransactionTable — month-filtered]    ← receives monthFilteredTransactions
[SlipUploader — admin only]            ← unchanged
```

### 6. Edge cases

- Empty `availableMonths` → hide selector, show table's existing empty state
- User selects a month then changes other filters → keep selected month sticky; if filter combination yields zero rows in that month, table shows its normal empty state (do NOT auto-jump to another month — avoids surprise)
- New transaction created in a month not currently selected → after invalidation, recompute `availableMonths`; if `selectedMonth` no longer exists in data, reset to latest

### 7. Out of scope

- LIFF dashboard (`LiffDashboard.tsx`) — only `Index.tsx` per request
- Summary cards behavior
- Chart behavior
- Server-side month filtering (client-side is sufficient given existing query loads user's transactions)

## Files


| File                                         | Change                                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/components/dashboard/MonthSelector.tsx` | New — month dropdown with Thai labels                                                                                        |
| `src/pages/Index.tsx`                        | Add `selectedMonth` state, compute available months + month-filtered list, render selector, pass filtered list to table only |


Additions:

1. Exclude `cancelled` transactions both from the available-month calculation and from the month-filtered list consistently.

2. Keep the month selector list sorted by latest month first, and show transaction counts per month in the dropdown.

3. Use the same transaction datetime source everywhere for month grouping/filtering:

   - prefer `transaction_datetime_iso`

   - fallback to `created_at`

   so the selector and the list always agree.

4. If a user creates a new manual entry in a different month, recompute available months after refresh and keep the current selected month unless it no longer exists.

5. Make the month selector mobile-friendly and compact, since it belongs to the list/filter area only.  
  
Also keep the month selector scoped only to the transaction list UX.

It must not affect:

- overview cards

- global charts

- global stats

Only the table/list section should change by selected month.

&nbsp;

&nbsp;

&nbsp;

