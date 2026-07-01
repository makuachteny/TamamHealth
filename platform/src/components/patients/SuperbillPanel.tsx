'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { useDataScope } from '@/lib/hooks/useDataScope';
import type { PatientDoc } from '@/lib/db-types';
import type { FeeScheduleDoc } from '@/lib/db-types-billing';
import type { SuperbillSelection } from '@/lib/services/superbill-service';
import { Wallet, Plus, X } from '@/components/icons/lucide';
import { patientFullName } from '@/lib/patient-utils';

interface Line {
  fee: FeeScheduleDoc;
  quantity: number;
  nonCovered: boolean;
}

/**
 * Clinician-facing superbill / fee ticket (P2.3). The provider reviews the
 * services rendered (priced from the fee schedule), marks any non-covered items
 * (ABN), sees the total, and posts the charges — the Centricity checkout review.
 */
export default function SuperbillPanel({
  patient,
  encounterId,
  hospitalName,
}: {
  patient: PatientDoc;
  encounterId?: string;
  hospitalName?: string;
}) {
  const { currentUser } = useApp();
  const scope = useDataScope();
  const [fees, setFees] = useState<FeeScheduleDoc[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getActiveFees } = await import('@/lib/services/fee-schedule-service');
        const f = await getActiveFees(scope);
        if (!cancelled) setFees(f);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [scope]);

  const currency = fees[0]?.currency || 'SSP';
  const totals = useMemo(() => {
    const total = lines.reduce((s, l) => s + l.quantity * l.fee.unitPrice, 0);
    const nonCovered = lines.filter((l) => l.nonCovered).reduce((s, l) => s + l.quantity * l.fee.unitPrice, 0);
    return { total, nonCovered, covered: total - nonCovered };
  }, [lines]);

  function addLine(feeId: string) {
    const fee = fees.find((f) => f._id === feeId);
    if (!fee || lines.some((l) => l.fee._id === feeId)) return;
    setLines((ls) => [...ls, { fee, quantity: 1, nonCovered: false }]);
    setPicker('');
    setPosted(null);
  }

  async function post() {
    setBusy(true);
    setError(null);
    try {
      const { postSuperbill } = await import('@/lib/services/superbill-service');
      const selections: SuperbillSelection[] = lines.map((l) => ({
        category: l.fee.category,
        serviceCode: l.fee.serviceCode,
        description: l.fee.serviceName,
        quantity: l.quantity,
        unitPrice: l.fee.unitPrice,
        nonCovered: l.nonCovered,
      }));
      const result = await postSuperbill({
        patientId: patient._id,
        patientName: patientFullName(patient),
        facilityId: patient.registrationHospital,
        facilityName: hospitalName || patient.registrationHospital,
        facilityLevel: 'hospital',
        state: patient.state,
        orgId: patient.orgId,
        encounterId,
        generatedBy: currentUser?._id || '',
        generatedByName: currentUser?.name || currentUser?.username || 'Clinician',
        currency,
        scope,
      }, selections);
      setPosted(`Posted ${lines.length} charge${lines.length === 1 ? '' : 's'}${result.abnRecorded ? ` · ${result.abnRecorded} ABN recorded` : ''}.`);
      setLines([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post charges');
    } finally {
      setBusy(false);
    }
  }

  const money = (n: number) => `${currency} ${n.toLocaleString()}`;
  const available = fees.filter((f) => !lines.some((l) => l.fee._id === f._id));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm inline-flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Superbill / fee ticket
        </h3>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Review charges before checkout</span>
      </div>

      {fees.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No fee schedule configured for this facility.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <select value={picker} onChange={(e) => addLine(e.target.value)}
              className="flex-1 p-2 rounded-md text-[13px]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              <option value="">Add a service…</option>
              {available.map((f) => <option key={f._id} value={f._id}>{f.serviceName} — {money(f.unitPrice)} ({f.category})</option>)}
            </select>
          </div>

          {lines.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No services added yet.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left font-medium pb-1">Service</th>
                  <th className="text-center font-medium pb-1">Qty</th>
                  <th className="text-right font-medium pb-1">Amount</th>
                  <th className="text-center font-medium pb-1">ABN</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.fee._id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>{l.fee.serviceName}</td>
                    <td className="text-center">
                      <input type="number" min={1} value={l.quantity}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, quantity: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                        className="w-12 p-1 rounded text-center text-[12px]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
                    </td>
                    <td className="text-right" style={{ color: 'var(--text-primary)' }}>{money(l.quantity * l.fee.unitPrice)}</td>
                    <td className="text-center">
                      <input type="checkbox" checked={l.nonCovered}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, nonCovered: e.target.checked } : x))}
                        title="Non-covered — patient advised (ABN)" />
                    </td>
                    <td className="text-right">
                      <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} title="Remove">
                        <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {lines.length > 0 && (
            <div className="mt-3 pt-2 space-y-1 text-[12px]" style={{ borderTop: '1px solid var(--border-light)' }}>
              {totals.nonCovered > 0 && (
                <>
                  <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}><span>Covered</span><span>{money(totals.covered)}</span></div>
                  <div className="flex justify-between" style={{ color: '#B45309' }}><span>Non-covered (ABN)</span><span>{money(totals.nonCovered)}</span></div>
                </>
              )}
              <div className="flex justify-between font-bold" style={{ color: 'var(--text-primary)' }}><span>Total</span><span>{money(totals.total)}</span></div>
              {totals.nonCovered > 0 && (
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Posting records an ABN acknowledgement on the chart for each non-covered service.
                </p>
              )}
              <div className="pt-2">
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={post}>
                  <Plus className="w-3.5 h-3.5" /> Post charges
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {posted && <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--color-success)' }}>{posted}</p>}
      {error && <p className="mt-2 text-[11px]" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
