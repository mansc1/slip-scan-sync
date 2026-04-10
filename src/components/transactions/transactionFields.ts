/**
 * Shared field schema for transaction editing and creation.
 * Used by both TransactionEditDialog (dashboard) and LiffTransaction (LIFF flow).
 *
 * MVP decision: Manual entries (`source = 'manual_entry'`) are saved as `confirmed`
 * immediately. A future iteration may introduce a draft/pending state for manual entries.
 */
import type { ExpenseCategory, TransactionType, PaymentMethod } from '@/types';

export interface TransactionEditValues {
  amount: string;
  date_display: string;
  time_display: string;
  merchant_name: string;
  category_final: ExpenseCategory;
  transaction_type: TransactionType;
  payment_method: PaymentMethod;
  notes: string;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'เงินสด' },
  { value: 'transfer', label: 'โอนเงิน' },
  { value: 'card', label: 'บัตร' },
  { value: 'other', label: 'อื่นๆ' },
];

export function getDefaultEditValues(tx: {
  amount?: number | null;
  date_display?: string | null;
  time_display?: string | null;
  merchant_name?: string | null;
  category_final?: ExpenseCategory | null;
  category_guess?: ExpenseCategory | null;
  transaction_type?: TransactionType | null;
  payment_method?: string | null;
  notes?: string | null;
}): TransactionEditValues {
  return {
    amount: tx.amount?.toString() || '',
    date_display: tx.date_display || '',
    time_display: tx.time_display || '',
    merchant_name: tx.merchant_name || '',
    category_final: (tx.category_final || tx.category_guess || 'other') as ExpenseCategory,
    transaction_type: (tx.transaction_type || 'other') as TransactionType,
    payment_method: (tx.payment_method || 'other') as PaymentMethod,
    notes: tx.notes || '',
  };
}

/** Returns blank values for create mode, pre-filled with today's date/time */
export function getBlankEditValues(): TransactionEditValues {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    amount: '',
    date_display: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear() + 543}`,
    time_display: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    merchant_name: '',
    category_final: 'other',
    transaction_type: 'other',
    payment_method: 'cash',
    notes: '',
  };
}

export function buildUpdatePayload(values: TransactionEditValues): Record<string, unknown> {
  return {
    amount: parseFloat(values.amount) || null,
    date_display: values.date_display || null,
    time_display: values.time_display || null,
    merchant_name: values.merchant_name || null,
    category_final: values.category_final,
    transaction_type: values.transaction_type,
    payment_method: values.payment_method,
    notes: values.notes || null,
  };
}

/**
 * Builds payload for creating a new manual transaction.
 * source is always 'manual_entry', status is 'confirmed' for MVP.
 */
export function buildCreatePayload(values: TransactionEditValues): Record<string, unknown> {
  return {
    ...buildUpdatePayload(values),
    source: 'manual_entry',
    status: 'confirmed',
    category_guess: values.category_final,
    currency: 'THB',
  };
}
