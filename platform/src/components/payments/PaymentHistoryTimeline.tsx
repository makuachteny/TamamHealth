'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft } from '@/components/icons/lucide';
import { getMethodConfig } from '@/lib/payment-method-config';

interface PaymentHistoryTimelineProps {
  patientId: string;
  limit?: number;
}

interface LedgerEntry {
  _id: string;
  entryType: string;
  amount: number;
  runningBalance: number;
  description: string;
  method?: string;
  currency: string;
  createdAt: string;
}


export default function PaymentHistoryTimeline({ patientId, limit = 20 }: PaymentHistoryTimelineProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { getPatientLedger } = await import('@/lib/services/ledger-service');
        const data = await getPatientLedger(patientId, limit);
        setEntries(data);
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, [patientId, limit]);

  if (loading) return <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Loading history...</div>;
  if (entries.length === 0) return <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>No financial history yet.</div>;

  return (
    <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {entries.map((entry, i) => {
        const isCredit = entry.amount < 0;
        const methodConfig = getMethodConfig(entry.method || '');
        const Icon = methodConfig.icon || (isCredit ? ArrowDownLeft : ArrowUpRight);
        const color = entry.entryType === 'refund' ? 'var(--warning)' : isCredit ? 'var(--success)' : 'var(--text-primary)';
        const date = new Date(entry.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return (
          <div key={entry._id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
            borderBottom: i < entries.length - 1 ? '1px solid var(--border-medium)' : 'none',
          }}>
            <span className="icon-box-sm" style={{ color, flexShrink: 0 }}>
              <Icon size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {entry.description}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dateStr} at {timeStr}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color }}>
                {isCredit ? '-' : '+'}{Math.abs(entry.amount).toLocaleString()} {entry.currency}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Bal: {entry.runningBalance.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
