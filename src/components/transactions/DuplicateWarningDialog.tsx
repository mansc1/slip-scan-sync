import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldAlert, Eye, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type DuplicateCandidate, formatCandidateDatetime } from '@/hooks/useDuplicateCheck';

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'hard' = block by default (hash or reference dup); 'probable' = warn, allow continue */
  type: 'hard' | 'probable' | null;
  candidates: DuplicateCandidate[];
  /** If true, allow override even for hard matches (rare). Default false. */
  allowHardOverride?: boolean;
  onContinue?: () => void;
  onCancel?: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  manual_entry: 'บันทึกเอง',
  manual_upload: 'อัปโหลดสลิป',
  line: 'LINE Bot',
};

const MATCH_REASON: Record<string, string> = {
  hard_hash: 'รูปสลิปเดียวกัน (image hash ตรง)',
  hard_reference: 'หมายเลขอ้างอิงเดียวกัน',
  probable: 'จำนวนเงินและช่วงเวลาใกล้เคียงกัน',
};

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  type,
  candidates,
  allowHardOverride = false,
  onContinue,
  onCancel,
}: DuplicateWarningDialogProps) {
  const navigate = useNavigate();

  if (!type) return null;

  const isHard = type === 'hard';
  const canContinue = !isHard || allowHardOverride;

  const title = isHard ? 'พบรายการซ้ำ' : 'อาจเป็นรายการซ้ำ';
  const description = isHard
    ? 'รายการนี้ตรงกับรายการที่มีอยู่แล้ว ไม่สามารถบันทึกซ้ำได้'
    : 'พบรายการที่อาจซ้ำกัน ตรวจสอบก่อนบันทึกต่อ';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isHard ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {candidates.map((c) => {
            const merchant = c.merchant_name || c.receiver_name || c.payer_name || '—';
            const sourceLabel = c.source ? SOURCE_LABEL[c.source] || c.source : '—';
            return (
              <div key={c.transaction_id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold">
                    {c.amount?.toLocaleString() || '—'} ฿
                  </span>
                  <Badge variant="outline" className="text-xs">{sourceLabel}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>🏪 {merchant}</p>
                  <p>📅 {formatCandidateDatetime(c)}</p>
                  <p className="text-[10px] italic">⚠️ {MATCH_REASON[c.match_type] || c.match_type}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/transactions/${c.transaction_id}`);
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  ดูรายการเดิม
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            ยกเลิก
          </Button>
          {canContinue && onContinue && (
            <Button
              type="button"
              variant={isHard ? 'destructive' : 'default'}
              className="flex-1"
              onClick={() => {
                onContinue();
                onOpenChange(false);
              }}
            >
              <Save className="h-4 w-4 mr-1" />
              บันทึกต่อ
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
