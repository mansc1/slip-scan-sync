export type TransactionStatus = 'pending_confirmation' | 'confirmed' | 'ignored' | 'editing' | 'extraction_failed';
export type TransactionType = 'transfer' | 'bill_payment' | 'merchant_payment' | 'qr_payment' | 'other';
export type PaymentStatus = 'success' | 'failed' | 'pending' | 'unknown';
export type ExpenseCategory = 'food' | 'transport' | 'shopping' | 'bills' | 'health' | 'entertainment' | 'education' | 'travel' | 'home' | 'family' | 'transfer' | 'other';
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'not_applicable';

export interface Transaction {
  id: string;
  user_id: string | null;
  line_user_id: string | null;
  line_message_id: string | null;
  image_hash: string | null;
  status: TransactionStatus;
  transaction_type: TransactionType | null;
  payment_status: PaymentStatus | null;
  amount: number | null;
  currency: string | null;
  date_display: string | null;
  time_display: string | null;
  transaction_datetime_iso: string | null;
  payer_name: string | null;
  receiver_name: string | null;
  merchant_name: string | null;
  bank_name: string | null;
  reference_no: string | null;
  merchant_code: string | null;
  transaction_code: string | null;
  fee: number | null;
  category_guess: ExpenseCategory | null;
  category_final: ExpenseCategory | null;
  confidence_score: number | null;
  raw_ocr_text: string | null;
  raw_provider_response: Record<string, unknown> | null;
  parsed_result: Record<string, unknown> | null;
  source_image_url: string | null;
  drive_file_url: string | null;
  sheets_sync_status: SyncStatus | null;
  drive_sync_status: SyncStatus | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionImage {
  id: string;
  transaction_id: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
}

export interface ExportJob {
  id: string;
  user_id: string;
  type: string;
  status: string;
  file_url: string | null;
  params: Record<string, unknown> | null;
  created_at: string;
}

export interface SlipExtractionResult {
  transaction_type: TransactionType | null;
  payment_status: PaymentStatus | null;
  amount: number | null;
  currency: string | null;
  date_display: string | null;
  time_display: string | null;
  transaction_datetime_iso: string | null;
  payer_name: string | null;
  receiver_name: string | null;
  merchant_name: string | null;
  bank_name: string | null;
  reference_no: string | null;
  merchant_code: string | null;
  transaction_code: string | null;
  fee: number | null;
  category_guess: ExpenseCategory | null;
  confidence_score: number | null;
  raw_ocr_text: string | null;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; labelTh: string }[] = [
  { value: 'food', label: 'Food', labelTh: 'อาหาร' },
  { value: 'transport', label: 'Transport', labelTh: 'เดินทาง' },
  { value: 'shopping', label: 'Shopping', labelTh: 'ช้อปปิ้ง' },
  { value: 'bills', label: 'Bills', labelTh: 'ค่าบิล' },
  { value: 'health', label: 'Health', labelTh: 'สุขภาพ' },
  { value: 'entertainment', label: 'Entertainment', labelTh: 'บันเทิง' },
  { value: 'education', label: 'Education', labelTh: 'การศึกษา' },
  { value: 'travel', label: 'Travel', labelTh: 'ท่องเที่ยว' },
  { value: 'home', label: 'Home', labelTh: 'บ้าน' },
  { value: 'family', label: 'Family', labelTh: 'ครอบครัว' },
  { value: 'transfer', label: 'Transfer', labelTh: 'โอนเงิน' },
  { value: 'other', label: 'Other', labelTh: 'อื่นๆ' },
];

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: '🍜',
  transport: '🚗',
  shopping: '🛍️',
  bills: '📄',
  health: '💊',
  entertainment: '🎬',
  education: '📚',
  travel: '✈️',
  home: '🏠',
  family: '👨‍👩‍👧‍👦',
  transfer: '💸',
  other: '📌',
};

export const STATUS_COLORS: Record<TransactionStatus, string> = {
  pending_confirmation: 'warning',
  confirmed: 'success',
  ignored: 'muted',
  editing: 'accent',
};
