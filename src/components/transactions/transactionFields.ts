/**
 * Shared field schema for transaction editing.
 * Used by both TransactionEditDialog (dashboard) and LiffTransaction (LIFF flow).
 */
import type { ExpenseCategory, TransactionType } from '@/types';

export interface TransactionEditValues {
  amount: string;
  date_display: string;
  time_display: string;
  merchant_name: string;
  category_final: ExpenseCategory;
  transaction_type: TransactionType;
  notes: string;
}

export function getDefaultEditValues(tx: {
  amount?: number | null;
  date_display?: string | null;
  time_display?: string | null;
  merchant_name?: string | null;
  category_final?: ExpenseCategory | null;
  category_guess?: ExpenseCategory | null;
  transaction_type?: TransactionType | null;
  notes?: string | null;
}): TransactionEditValues {
  return {
    amount: tx.amount?.toString() || '',
    date_display: tx.date_display || '',
    time_display: tx.time_display || '',
    merchant_name: tx.merchant_name || '',
    category_final: (tx.category_final || tx.category_guess || 'other') as ExpenseCategory,
    transaction_type: (tx.transaction_type || 'other') as TransactionType,
    notes: tx.notes || '',
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
    notes: values.notes || null,
  };
}
