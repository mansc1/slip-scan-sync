import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLiff } from '@/hooks/useLiff';
import { supabase } from '@/integrations/supabase/client';
import { getFreshLineIdToken } from '@/lib/line-token';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type TransactionType, type PaymentMethod } from '@/types';
import { CancelTransactionDialog } from '@/components/transactions/CancelTransactionDialog';
import { DuplicateWarningDialog } from '@/components/transactions/DuplicateWarningDialog';
import { type TransactionEditValues, getDefaultEditValues, buildUpdatePayload, PAYMENT_METHODS } from '@/components/transactions/transactionFields';
import type { DuplicateCandidate } from '@/hooks/useDuplicateCheck';
import { Check, X, Pencil, Loader2, AlertTriangle, ShieldX, CheckCircle2, Ban } from 'lucide-react';

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: 'transfer', label: 'โอนเงิน' },
  { value: 'bill_payment', label: 'ชำระบิล' },
  { value: 'merchant_payment', label: 'จ่ายร้านค้า' },
  { value: 'qr_payment', label: 'QR Payment' },
  { value: 'other', label: 'อื่นๆ' },
];

type ViewState = 'loading' | 'login_required' | 'not_found' | 'no_permission' | 'cancelled' | 'ready' | 'editing' | 'success' | 'error';

export default function LiffTransaction() {
  const { id } = useParams<{ id: string }>();
  const { isReady, isLoggedIn, lineUserId, displayName, pictureUrl, idToken, error: liffError, login } = useLiff();

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [transaction, setTransaction] = useState<any>(null);
  const [finalStatus, setFinalStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [dupDialog, setDupDialog] = useState<{ type: 'hard' | 'probable'; candidates: DuplicateCandidate[] } | null>(null);

  // Edit form state — uses shared schema
  const [editValues, setEditValues] = useState<TransactionEditValues>({
    amount: '', date_display: '', time_display: '', merchant_name: '',
    category_final: 'other', transaction_type: 'other', payment_method: 'other', notes: '',
  });

  useEffect(() => {
    if (!isReady) return;
    if (liffError) { setErrorMsg(liffError); setViewState('error'); return; }
    if (!isLoggedIn || !idToken) { setViewState('login_required'); return; }
    fetchTransaction();
  }, [isReady, isLoggedIn, idToken, id]);

  async function fetchTransaction() {
    const freshToken = getFreshLineIdToken(idToken);
    if (!freshToken) { setErrorMsg('เซสชันหมดอายุ กรุณาเข้าสู่ระบบ LINE ใหม่'); setViewState('error'); return; }

    try {
      const { data, error } = await supabase.functions.invoke('liff-transaction', {
        body: { transactionId: id, idToken: freshToken },
      });

      if (error) { setErrorMsg('ไม่สามารถโหลดรายการได้'); setViewState('error'); return; }
      if (data.error) {
        if (data.error.includes('not found')) setViewState('not_found');
        else if (data.error.includes('สิทธิ์')) setViewState('no_permission');
        else { setErrorMsg(data.error); setViewState('error'); }
        return;
      }

      const tx = data.transaction;
      setTransaction(tx);

      if (tx.status === 'cancelled') {
        setViewState('cancelled');
      } else {
        setEditValues(getDefaultEditValues(tx));
        setViewState('ready');
      }
    } catch (e: any) { setErrorMsg(e.message); setViewState('error'); }
  }

  async function handleAction(action: 'confirm' | 'update' | 'cancel', acknowledgeDuplicates = false) {
    if (!id) return;
    const freshToken = getFreshLineIdToken(idToken);
    if (!freshToken) { setErrorMsg('เซสชันหมดอายุ กรุณาเข้าสู่ระบบ LINE ใหม่'); setViewState('error'); return; }
    
    if (action === 'cancel') setCancelling(true);
    else setSaving(true);

    try {
      const body: any = { action, transactionId: id, idToken: freshToken, acknowledgeDuplicates };
      if (action === 'update') {
        body.updates = buildUpdatePayload(editValues);
      }

      const { data, error } = await supabase.functions.invoke('liff-action', { body });

      // Handle 409 duplicate response
      if (error) {
        let dupCtx: any = null;
        try { dupCtx = await (error as any).context?.json?.(); } catch { /* ignore */ }
        if (dupCtx?.duplicate) {
          setDupDialog({
            type: dupCtx.duplicate === 'hard' ? 'hard' : 'probable',
            candidates: dupCtx.hardMatch ? [dupCtx.hardMatch] : (dupCtx.probableMatches || []),
          });
          return;
        }
      }

      if (error || data?.error) {
        setErrorMsg(data?.error || 'เกิดข้อผิดพลาด');
        setViewState('error');
        return;
      }

      setTransaction(data.transaction);
      setFinalStatus(action === 'cancel' ? 'cancelled' : 'confirmed');
      setViewState('success');
    } catch (e: any) { setErrorMsg(e.message); setViewState('error'); }
    finally { setSaving(false); setCancelling(false); setCancelOpen(false); }
  }

  // --- Render states ---

  if (viewState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (viewState === 'login_required') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-xs">
          <ShieldX className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">กรุณาเข้าสู่ระบบ LINE</h1>
          <p className="text-sm text-muted-foreground">เพื่อดูและจัดการรายการของคุณ</p>
          <Button onClick={login} className="w-full bg-[#06C755] hover:bg-[#05b34d] text-white">
            เข้าสู่ระบบด้วย LINE
          </Button>
        </div>
      </div>
    );
  }

  if (viewState === 'not_found') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-accent mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">ไม่พบรายการ</h1>
          <p className="text-sm text-muted-foreground">ลิงก์อาจหมดอายุหรือรายการถูกลบแล้ว</p>
        </div>
      </div>
    );
  }

  if (viewState === 'no_permission') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <ShieldX className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-sm text-muted-foreground">รายการนี้ไม่ใช่ของคุณ</p>
        </div>
      </div>
    );
  }

  if (viewState === 'cancelled') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <Ban className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">รายการนี้ถูกยกเลิกแล้ว</h1>
          {transaction && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>💰 {transaction.amount?.toLocaleString() || '?'} {transaction.currency || 'THB'}</p>
              {transaction.merchant_name && <p>🏪 {transaction.merchant_name}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (viewState === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">
            {finalStatus === 'cancelled' ? 'ยกเลิกรายการแล้ว' : 'บันทึกสำเร็จ!'}
          </h1>
          {transaction && finalStatus !== 'cancelled' && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>💰 {transaction.amount?.toLocaleString() || '?'} {transaction.currency || 'THB'}</p>
              {transaction.merchant_name && <p>🏪 {transaction.merchant_name}</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-2">สามารถปิดหน้านี้ได้</p>
        </div>
      </div>
    );
  }

  if (viewState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">เกิดข้อผิดพลาด</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // --- Ready / Editing state ---
  const tx = transaction;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        {pictureUrl && <img src={pictureUrl} alt="" className="h-8 w-8 rounded-full" />}
        <div>
          <p className="text-sm font-medium">{displayName || 'LINE User'}</p>
          <p className="text-xs opacity-80">SlipSync</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Summary card */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">
              {tx?.amount?.toLocaleString() || '?'}
            </span>
            <span className="text-sm text-muted-foreground">{tx?.currency || 'THB'}</span>
          </div>
          {tx?.merchant_name && <p className="text-sm text-muted-foreground">🏪 {tx.merchant_name}</p>}
          {tx?.receiver_name && <p className="text-sm text-muted-foreground">👤 {tx.receiver_name}</p>}
          {tx?.bank_name && <p className="text-sm text-muted-foreground">🏦 {tx.bank_name}</p>}
          {tx?.date_display && (
            <p className="text-sm text-muted-foreground">📅 {tx.date_display} {tx.time_display || ''}</p>
          )}
          {tx?.category_guess && (
            <p className="text-sm text-muted-foreground">
              📁 {EXPENSE_CATEGORIES.find(c => c.value === tx.category_guess)?.labelTh || tx.category_guess}
            </p>
          )}
        </div>

        {viewState === 'editing' ? (
          /* Edit form — uses shared field schema */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">จำนวนเงิน</Label>
              <Input type="number" step="0.01" value={editValues.amount} onChange={e => setEditValues(v => ({ ...v, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ร้านค้า</Label>
              <Input value={editValues.merchant_name} onChange={e => setEditValues(v => ({ ...v, merchant_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">หมวดหมู่</Label>
              <Select value={editValues.category_final} onValueChange={val => setEditValues(v => ({ ...v, category_final: val as ExpenseCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.labelTh}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ประเภท</Label>
              <Select value={editValues.transaction_type} onValueChange={val => setEditValues(v => ({ ...v, transaction_type: val as TransactionType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">วันที่</Label>
                <Input value={editValues.date_display} onChange={e => setEditValues(v => ({ ...v, date_display: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">เวลา</Label>
                <Input value={editValues.time_display} onChange={e => setEditValues(v => ({ ...v, time_display: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">วิธีชำระ</Label>
              <Select value={editValues.payment_method} onValueChange={val => setEditValues(v => ({ ...v, payment_method: val as PaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">บันทึก</Label>
              <Textarea value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} rows={2} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleAction('update')} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                บันทึก
              </Button>
              <Button variant="outline" onClick={() => setViewState('ready')} className="flex-1">
                ยกเลิก
              </Button>
            </div>
          </div>
        ) : (
          /* Action buttons */
          <div className="space-y-2">
            {tx?.status === 'pending_confirmation' && (
              <Button onClick={() => handleAction('confirm')} disabled={saving} className="w-full h-12 text-base">
                {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
                ✅ ยืนยัน
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewState('editing')} className="w-full h-12 text-base">
              <Pencil className="h-5 w-5 mr-2" />
              ✏️ แก้ไข
            </Button>
            <Button variant="destructive" onClick={() => setCancelOpen(true)} className="w-full h-12 text-base">
              <Ban className="h-5 w-5 mr-2" />
              🚫 ยกเลิกรายการ
            </Button>
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      {transaction && (
        <CancelTransactionDialog
          transaction={transaction}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onConfirmCancel={() => handleAction('cancel')}
          cancelling={cancelling}
        />
      )}
    </div>
  );
}
