'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  X, Wallet, Activity, AlertCircle, ChevronRight, ExternalLink, Receipt, Shield, Clock, Banknote,
  RotateCcw, Ban, AlertTriangle,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SearchInput, FilterMenu } from '@/components/filters';
import { computePlanKpis } from '@/components/payments/PlanKpiCards';
import DataTile from '@/components/DataTile';
import Modal from '@/components/Modal';
import PaymentPanel from '@/components/payments/PaymentPanel';
import { getMethodConfig } from '@/lib/payment-method-config';
import type { PaymentDoc, ClaimDoc, PaymentPlanDoc } from '@/lib/db-types-payments';
import type { BillingDoc } from '@/lib/db-types-billing';
import { formatMoney } from '@/lib/format-utils';

// Shared grid template for the patient-account list so the column header row and
// every data row line up: Patient | Payments | Claims | Plans | Last activity | Balance | ›
const PAYMENTS_COLS = 'minmax(0, 1fr) 120px 90px 80px 80px 130px 120px 110px 24px';

interface PatientLine {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  totalCharged: number;
  totalCollected: number;
  outstanding: number;
  lastActivity?: string;       // ISO timestamp
  paymentCount: number;
  openClaims: number;
  activePlans: number;
}

interface PaymentsData {
  payments: PaymentDoc[];
  claims: ClaimDoc[];
  plans: PaymentPlanDoc[];
  bills: BillingDoc[];
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser, globalSearch } = useApp();
  const [data, setData] = useState<PaymentsData>({ payments: [], claims: [], plans: [], bills: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Text search comes from the shared global search bar (TopBar).
  const search = globalSearch;
  const [balanceFilter, setBalanceFilter] = useState('all');
  const activeFilterCount = balanceFilter !== 'all' ? 1 : 0;
  const clearFilters = () => setBalanceFilter('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [payingLine, setPayingLine] = useState<PatientLine | null>(null);
  // Inline "Collect payment" launcher: a header button opens a patient picker,
  // and choosing a patient drops straight into the record-payment panel.
  const [collectPickerOpen, setCollectPickerOpen] = useState(false);
  const [collectSearch, setCollectSearch] = useState('');
  // Installment recording for a payment plan (folded in from the old Plans page).
  const [recordPlanFor, setRecordPlanFor] = useState<PaymentPlanDoc | null>(null);
  const [planAmount, setPlanAmount] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  // Undo a recorded payment — Void (reverse) or Refund. Money is sensitive, so
  // both go through a confirm dialog and the existing audited services.
  const [reverseFor, setReverseFor] = useState<{ payment: PaymentDoc; mode: 'void' | 'refund' } | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const scope = useMemo(() => (
    currentUser ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role } : undefined
  ), [currentUser]);

  const loadData = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setError('');
    try {
      const [{ getAllPayments, getAllClaims, getAllPaymentPlans }, { getAllBills }] = await Promise.all([
        import('@/lib/services/payment-service'),
        import('@/lib/services/billing-service'),
      ]);
      const [payments, claims, plans, bills] = await Promise.all([
        getAllPayments(scope),
        getAllClaims(scope),
        getAllPaymentPlans(scope),
        getAllBills(scope),
      ]);
      setData({ payments: payments || [], claims: claims || [], plans: plans || [], bills: bills || [] });
    } catch (err) {
      console.error('Error loading payments data:', err);
      setError(t('payments.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Aggregate by patient ───────────────────────────────────────────
  const patientLines: PatientLine[] = useMemo(() => {
    const byPatient = new Map<string, PatientLine>();

    const ensure = (id: string, name: string, hospitalNumber?: string): PatientLine => {
      if (!byPatient.has(id)) {
        byPatient.set(id, {
          patientId: id,
          patientName: name,
          hospitalNumber,
          totalCharged: 0,
          totalCollected: 0,
          outstanding: 0,
          paymentCount: 0,
          openClaims: 0,
          activePlans: 0,
        });
      }
      return byPatient.get(id)!;
    };

    // Bills give us the canonical totals
    for (const b of data.bills) {
      const line = ensure(b.patientId, b.patientName, b.hospitalNumber);
      line.totalCharged += b.totalAmount || 0;
      line.totalCollected += b.amountPaid || 0;
      line.outstanding += b.balanceDue || 0;
      const t = b.encounterDate || b.updatedAt || b.createdAt;
      if (!line.lastActivity || (t && t > line.lastActivity)) line.lastActivity = t;
    }

    for (const p of data.payments) {
      if (p.status !== 'posted') continue;
      const line = ensure(p.patientId, p.patientName);
      line.paymentCount += 1;
      const t = p.processedAt;
      if (!line.lastActivity || (t && t > line.lastActivity)) line.lastActivity = t;
      // If we have no bill totals at all for this patient, surface payments
      // as collected so the row isn't blank.
      if (line.totalCollected === 0 && line.totalCharged === 0) {
        line.totalCollected = p.amount;
      }
    }

    for (const c of data.claims) {
      if (c.status === 'paid' || c.status === 'denied') continue;
      const line = ensure(c.patientId, c.patientName);
      line.openClaims += 1;
    }

    for (const pl of data.plans) {
      if (pl.status !== 'active') continue;
      const line = ensure(pl.patientId, pl.patientName);
      line.activePlans += 1;
    }

    return Array.from(byPatient.values()).sort((a, b) => {
      // Outstanding patients first, then by recent activity
      if ((b.outstanding > 0 ? 1 : 0) !== (a.outstanding > 0 ? 1 : 0)) {
        return (b.outstanding > 0 ? 1 : 0) - (a.outstanding > 0 ? 1 : 0);
      }
      if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
      return (b.lastActivity || '').localeCompare(a.lastActivity || '');
    });
  }, [data.bills, data.payments, data.claims, data.plans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patientLines.filter(l => {
      if (balanceFilter === 'outstanding' && !(l.outstanding > 0)) return false;
      if (balanceFilter === 'paid' && l.outstanding > 0) return false;
      if (!q) return true;
      return l.patientName.toLowerCase().includes(q) ||
        (l.hospitalNumber || '').toLowerCase().includes(q);
    });
  }, [patientLines, search, balanceFilter]);

  // A/R aging buckets — days since the encounter, over every bill still carrying
  // a balance. Relocated from the old Billing cockpit so the biller sees how old
  // the receivables are right on the bills screen.
  const aging = useMemo(() => {
    const buckets = { current: 0, d31: 0, d61: 0, d91: 0, d120: 0 };
    const now = Date.now();
    for (const b of data.bills) {
      if ((b.balanceDue ?? 0) <= 0 || b.status === 'waived' || b.status === 'cancelled') continue;
      const dateStr = b.encounterDate || b.createdAt;
      const days = Math.floor((now - new Date(dateStr).getTime()) / 86_400_000);
      if (days <= 30) buckets.current += b.balanceDue;
      else if (days <= 60) buckets.d31 += b.balanceDue;
      else if (days <= 90) buckets.d61 += b.balanceDue;
      else if (days <= 120) buckets.d91 += b.balanceDue;
      else buckets.d120 += b.balanceDue;
    }
    return buckets;
  }, [data.bills]);

  // Derive the open patient's line from the live aggregates so the drawer's
  // balance/totals refresh automatically after a payment is recorded.
  const selectedLine = useMemo(
    () => (selectedPatientId ? patientLines.find(l => l.patientId === selectedPatientId) || null : null),
    [selectedPatientId, patientLines],
  );

  // Record an installment against a payment plan (folded in from the old
  // standalone Plans page so the cashier manages plans from the same screen).
  const handleRecordPlanPayment = async () => {
    if (!recordPlanFor) return;
    const amount = parseFloat(planAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSavingPlan(true);
    try {
      const { recordPlanPayment } = await import('@/lib/services/payment-service');
      const installmentNumber = recordPlanFor.monthlyAmount > 0
        ? Math.floor(recordPlanFor.paidToDate / recordPlanFor.monthlyAmount) + 1
        : 1;
      const paymentId = `PAY-${Date.now()}`;
      await recordPlanPayment(recordPlanFor._id, installmentNumber, paymentId, amount);
      setRecordPlanFor(null);
      setPlanAmount('');
      setPlanNotes('');
      loadData();
    } catch (err) {
      console.error('Failed to record plan payment:', err);
    } finally {
      setSavingPlan(false);
    }
  };

  // Confirm + perform a payment reversal. Void uses reversePayment (status →
  // reversed); Refund uses issueRefund. Both write an audit trail in-service.
  const handleConfirmReverse = async () => {
    if (!reverseFor) return;
    const reason = reverseReason.trim();
    if (!reason) return;
    setReversing(true);
    try {
      const { reversePayment, issueRefund } = await import('@/lib/services/payment-service');
      const p = reverseFor.payment;
      if (reverseFor.mode === 'void') {
        await reversePayment(p._id, reason, currentUser?._id || 'system', currentUser?.name || 'System');
      } else {
        await issueRefund({
          paymentId: p._id,
          patientId: p.patientId,
          patientName: p.patientName,
          amount: p.amount,
          currency: p.currency,
          method: p.method,
          reason,
          processedBy: currentUser?._id || 'system',
          processedByName: currentUser?.name || 'System',
          facilityId: p.facilityId || currentUser?.hospitalId || '',
          orgId: p.orgId ?? currentUser?.orgId,
        });
      }
      setReverseFor(null);
      setReverseReason('');
      loadData();
    } catch (err) {
      console.error('Failed to reverse payment:', err);
    } finally {
      setReversing(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar title={t('payments.title')} />
        <main className="page-container page-enter">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: 'var(--text-muted)' }}>
            <Activity size={44} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
            <span>{t('payments.loading')}</span>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('payments.title')} searchTrailing={
            <FilterMenu activeCount={activeFilterCount} onClear={clearFilters}>
              <FilterMenu.Field label="All Accounts">
                <select className="w-full text-sm" value={balanceFilter} onChange={e => setBalanceFilter(e.target.value)}>
                  <option value="all">All Accounts</option>
                  <option value="outstanding">Has Balance</option>
                  <option value="paid">Paid Up</option>
                </select>
              </FilterMenu.Field>
            </FilterMenu>
          } actions={
            <button onClick={() => { setCollectSearch(''); setCollectPickerOpen(true); }} className="btn btn-primary">
              <Banknote className="w-4 h-4" /> {t('billing.collectPayment')}
            </button>
          } />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {error && (
          <div style={{
            background: 'rgba(196, 69, 54, 0.08)', borderLeft: '4px solid #C44536',
            borderRadius: 'var(--card-radius)', padding: '14px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertCircle size={16} style={{ color: '#C44536', flexShrink: 0 }} />
            <span style={{ color: '#8B2E24', fontSize: '0.8125rem' }}>{error}</span>
          </div>
        )}

        {/* Payment Plans + A/R Aging — side by side, styled like the front-desk
            Quick Actions / Appointments cards (dash-card + uppercase header). */}
        {(() => {
          const k = computePlanKpis(data.plans);
          // Compact, neutral tiles (no colour tints) so the two cards stay short.
          const tile = { minHeight: 56, padding: '7px 12px' } as const;
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4 lg:items-start">
              {/* Payment plans */}
              <div className="dash-card p-2.5 flex flex-col lg:self-start">
                <h3 className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('plans.title')}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <DataTile style={tile} label={t('plans.kpiActivePlans')} value={k.activePlans} />
                  <DataTile style={tile} label={t('plans.kpiTotalOutstanding')} value={formatMoney(k.totalOutstanding)} />
                  <DataTile style={tile} label={t('plans.kpiDelinquentPlans')} value={k.delinquentPlans} />
                  <DataTile style={tile} label={t('plans.kpiCompletedThisMonth')} value={k.completedThisMonth} />
                </div>
              </div>

              {/* A/R aging — how old the outstanding receivables are. */}
              <div className="dash-card p-2.5 flex flex-col lg:self-start">
                <h3 className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('billing.arAging')}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <DataTile style={tile} label={t('billing.agingCurrent')} value={formatMoney(aging.current)} />
                  <DataTile style={tile} label={t('billing.agingFollowUp')} value={formatMoney(aging.d61)} />
                  <DataTile style={tile} label={t('billing.agingAtRisk')} value={formatMoney(aging.d91)} />
                  <DataTile style={tile} label={t('billing.agingCollections')} value={formatMoney(aging.d120)} />
                </div>
              </div>
            </div>
          );
        })()}

        {/* People list — fills the remaining viewport height; rows scroll inside. */}
        <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <Wallet className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              {search ? t('payments.noPatientsMatch') : t('payments.noBillingActivity')}
            </div>
          ) : (
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
              <div style={{ minWidth: 900 }}>
                {/* Column headers */}
                <div
                  className="grid items-center gap-3 px-4 py-2.5"
                  style={{
                    gridTemplateColumns: PAYMENTS_COLS,
                    position: 'sticky', top: 0, zIndex: 1,
                    background: 'var(--bg-card-solid)',
                    borderBottom: '1px solid var(--border-light)',
                  }}
                >
                  {[
                    { label: t('payments.colPatient'), align: 'left' as const },
                    { label: 'Patient ID', align: 'left' as const },
                    { label: t('payments.colPayments'), align: 'right' as const },
                    { label: t('payments.colClaims'), align: 'right' as const },
                    { label: t('payments.colPlans'), align: 'right' as const },
                    { label: t('payments.colLastActivity'), align: 'left' as const },
                    { label: t('payments.colBalance'), align: 'right' as const },
                    { label: 'Status', align: 'right' as const },
                    { label: '', align: 'left' as const },
                  ].map((h, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: 'var(--text-muted)', textAlign: h.align }}
                    >
                      {h.label}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {filtered.map(line => {
                  const owing = line.outstanding > 0;
                  return (
                    <button
                      key={line.patientId}
                      onClick={() => setSelectedPatientId(line.patientId)}
                      className="w-full text-left grid items-center gap-3 px-4 py-3 border-b hover:opacity-95 transition-opacity"
                      style={{
                        gridTemplateColumns: PAYMENTS_COLS,
                        borderColor: 'var(--border-light)',
                        ...(owing ? { background: 'rgba(196, 69, 54, 0.04)' } : {}),
                      }}
                    >
                      {/* Patient */}
                      <div className="min-w-0">
                        {line.patientId && !line.patientId.startsWith('demo-') && !line.patientId.includes('_demo') ? (
                          <span
                            role="link"
                            tabIndex={0}
                            onClick={e => { e.stopPropagation(); router.push(`/patients/${line.patientId}`); }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); router.push(`/patients/${line.patientId}`); } }}
                            className="font-semibold text-sm truncate block hover:underline"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {line.patientName}
                          </span>
                        ) : (
                          <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{line.patientName}</div>
                        )}
                      </div>

                      {/* Patient ID */}
                      <div className="font-mono text-[12px] truncate" style={{ color: line.hospitalNumber ? '#2191D0' : 'var(--text-muted)', fontWeight: 600 }}>
                        {line.hospitalNumber || '—'}
                      </div>

                      {/* Payments */}
                      <div className="text-right text-[13px]" style={{ color: line.paymentCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {line.paymentCount > 0 ? line.paymentCount : '—'}
                      </div>

                      {/* Open claims */}
                      <div className="text-right text-[13px]" style={{ color: line.openClaims > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {line.openClaims > 0 ? line.openClaims : '—'}
                      </div>

                      {/* Active plans */}
                      <div className="text-right text-[13px]" style={{ color: line.activePlans > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {line.activePlans > 0 ? line.activePlans : '—'}
                      </div>

                      {/* Last activity */}
                      <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {line.lastActivity ? new Date(line.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </div>

                      {/* Balance */}
                      <div className="text-right font-bold text-sm" style={{ color: owing ? '#8B2E24' : '#15795C', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(owing ? line.outstanding : line.totalCollected)}
                      </div>

                      {/* Status */}
                      <div className="text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: owing ? '#C44536' : '#15795C' }}>
                        {owing ? t('billing.kpiOutstanding') : t('payments.paid')}
                      </div>

                      <ChevronRight className="w-4 h-4 flex-shrink-0 justify-self-end" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Account detail — centered modal */}
      {selectedLine && (
        <PatientBillingDetail
          line={selectedLine}
          payments={data.payments.filter(p => p.patientId === selectedLine.patientId)}
          claims={data.claims.filter(c => c.patientId === selectedLine.patientId)}
          plans={data.plans.filter(p => p.patientId === selectedLine.patientId)}
          bills={data.bills.filter(b => b.patientId === selectedLine.patientId)}
          onClose={() => setSelectedPatientId(null)}
          onRecordPayment={() => setPayingLine(selectedLine)}
          onRecordPlanPayment={(plan) => { setRecordPlanFor(plan); setPlanAmount(''); setPlanNotes(''); }}
          onReversePayment={(payment, mode) => { setReverseFor({ payment, mode }); setReverseReason(''); }}
        />
      )}

      {/* Confirm a payment reversal (Void or Refund) — money is sensitive, so the
          biller must state a reason; the action runs through the audited service. */}
      {reverseFor && (
        <Modal onClose={() => { if (!reversing) setReverseFor(null); }} width={420}>
          <div className="card-elevated" style={{ background: 'var(--bg-card-solid)', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--border-light)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: '#C44536' }} />
              </div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {reverseFor.mode === 'void' ? t('action.reverse') : t('action.undo')}
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{reverseFor.payment.patientName}</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                    {getMethodConfig(reverseFor.payment.method).label}
                    {reverseFor.payment.reference && <span className="font-mono"> · {reverseFor.payment.reference}</span>}
                  </div>
                </div>
                <div className="text-[14px] font-bold font-mono" style={{ color: '#8B2E24', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(reverseFor.payment.amount)}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('billing.reason')}</label>
                <textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  rows={2}
                  autoFocus
                  className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-input, var(--bg-card-solid))', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border-light)' }}>
              <button onClick={() => setReverseFor(null)} disabled={reversing} className="btn btn-secondary">{t('action.cancel')}</button>
              <button
                onClick={handleConfirmReverse}
                disabled={!reverseReason.trim() || reversing}
                className="btn inline-flex items-center gap-1.5 text-white"
                style={{ background: '#C44536' }}
              >
                {reverseFor.mode === 'void' ? <Ban className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                {t('action.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Collect-payment patient picker (opened from the header button) */}
      {collectPickerOpen && (
        <Modal onClose={() => setCollectPickerOpen(false)} width={460}>
          <div className="card-elevated" style={{ background: 'var(--bg-card-solid)', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('billing.collectPayment')}</h2>
              </div>
              <button onClick={() => setCollectPickerOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3">
              <SearchInput value={collectSearch} onChange={setCollectSearch} placeholder={t('payments.searchPlaceholder')} />
              <div className="mt-2 space-y-1" style={{ maxHeight: 360, overflowY: 'auto' }}>
                {(() => {
                  const q = collectSearch.trim().toLowerCase();
                  const list = patientLines
                    .filter(l => l.outstanding > 0)
                    .filter(l => !q || l.patientName.toLowerCase().includes(q) || (l.hospitalNumber || '').toLowerCase().includes(q))
                    .sort((a, b) => b.outstanding - a.outstanding);
                  if (list.length === 0) {
                    return <p className="text-center text-[12px] py-8" style={{ color: 'var(--text-muted)' }}>{t('payments.noOutstanding')}</p>;
                  }
                  return list.map(line => (
                    <button
                      key={line.patientId}
                      onClick={() => { setPayingLine(line); setCollectPickerOpen(false); }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-[var(--overlay-subtle)]"
                      style={{ border: '1px solid var(--border-light)' }}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{line.patientName}</div>
                        {line.hospitalNumber && <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{line.hospitalNumber}</div>}
                      </div>
                      <div className="text-[13px] font-bold flex-shrink-0" style={{ color: '#8B2E24', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(line.outstanding)}</div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Record-payment form (cash / mobile money / card / insurance) */}
      {payingLine && (
        <PaymentPanel
          patientId={payingLine.patientId}
          patientName={payingLine.patientName}
          amountDue={payingLine.outstanding}
          onCancel={() => setPayingLine(null)}
          onSuccess={() => { setPayingLine(null); loadData(); }}
        />
      )}

      {/* Record an installment against a payment plan */}
      {recordPlanFor && (
        <Modal onClose={() => setRecordPlanFor(null)} width={440}>
          <div className="card-elevated" style={{ background: 'var(--bg-card-solid)', borderRadius: 16, padding: 0, overflow: 'hidden' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('plans.recordPayment')}</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{recordPlanFor.patientName}</p>
                </div>
              </div>
              <button onClick={() => setRecordPlanFor(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('plans.paymentAmountLabel')}</label>
                <input
                  type="number"
                  value={planAmount}
                  onChange={(e) => setPlanAmount(e.target.value)}
                  placeholder={t('plans.paymentAmountPlaceholder')}
                  autoFocus
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-input, var(--bg-card-solid))', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('plans.notesLabel')}</label>
                <textarea
                  value={planNotes}
                  onChange={(e) => setPlanNotes(e.target.value)}
                  placeholder={t('plans.notesPlaceholder')}
                  rows={3}
                  className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-input, var(--bg-card-solid))', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border-light)' }}>
              <button onClick={() => setRecordPlanFor(null)} className="btn btn-secondary">{t('action.cancel')}</button>
              <button
                onClick={handleRecordPlanPayment}
                disabled={!planAmount || savingPlan}
                className="btn btn-primary inline-flex items-center gap-1.5"
              >
                <Receipt className="w-4 h-4" />
                {t('plans.recordPayment')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ═══ Detail drawer ═══════════════════════════════════════════════════

function PatientBillingDetail({ line, payments, claims, plans, bills, onClose, onRecordPayment, onRecordPlanPayment, onReversePayment }: {
  line: PatientLine;
  payments: PaymentDoc[];
  claims: ClaimDoc[];
  plans: PaymentPlanDoc[];
  bills: BillingDoc[];
  onClose: () => void;
  onRecordPayment: () => void;
  onRecordPlanPayment: (plan: PaymentPlanDoc) => void;
  onReversePayment: (payment: PaymentDoc, mode: 'void' | 'refund') => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  // Saved payment methods (loaded on demand)
  const [methods, setMethods] = useState<{ id: string; label: string; type: string; brand?: string; isDefault: boolean }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getDB } = await import('@/lib/db');
        const db = getDB('tamamhealth_saved_payment_methods');
        const all = await db.allDocs({ include_docs: true });
        if (cancelled) return;
        const docs = all.rows
          .map(r => r.doc as { _id: string; type?: string; patientId?: string; methodType?: string; label?: string; cardBrand?: string; isDefault?: boolean })
          .filter(d => d && d.type === 'saved_payment_method' && d.patientId === line.patientId);
        setMethods(docs.map(d => ({
          id: d._id,
          label: d.label || (d.methodType || t('payments.methodFallback')),
          type: d.methodType || 'unknown',
          brand: d.cardBrand,
          isDefault: !!d.isDefault,
        })));
      } catch {
        if (!cancelled) setMethods([]);
      }
    })();
    return () => { cancelled = true; };
  }, [line.patientId]);

  const sortedPayments = [...payments].sort((a, b) => (b.processedAt || '').localeCompare(a.processedAt || ''));
  const owing = line.outstanding > 0;

  return (
    <Modal onClose={onClose} width={600} labelledBy="billing-detail-name">
      <div
        className="card-elevated"
        style={{
          background: 'var(--bg-card-solid)',
          overflow: 'hidden',
          borderRadius: 16,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-3">
            <div>
              <button
                onClick={() => router.push(`/patients/${line.patientId}`)}
                className="text-left hover:underline"
                title={t('payments.openPatientRecord')}
              >
                <h2 id="billing-detail-name" className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{line.patientName}</h2>
              </button>
              {line.hospitalNumber && (
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(33, 145, 208, 0.10)', color: '#2191D0', fontWeight: 600 }}>
                  {line.hospitalNumber}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance hero */}
        <div className="px-5 py-4" style={{
          background: owing
            ? 'linear-gradient(135deg, rgba(196, 69, 54, 0.08) 0%, rgba(228, 168, 75, 0.06) 100%)'
            : 'linear-gradient(135deg, rgba(27, 158, 119, 0.08) 0%, rgba(33, 145, 208, 0.04) 100%)',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: owing ? '#8B2E24' : '#15795C' }}>
                {owing ? t('billing.outstandingBalance') : t('billing.accountStatus')}
              </div>
              <div className="text-2xl font-extrabold" style={{ letterSpacing: -0.5, color: owing ? '#8B2E24' : '#15795C', fontVariantNumeric: 'tabular-nums' }}>
                {owing ? formatMoney(line.outstanding) : t('billing.paidInFull')}
              </div>
            </div>
            <div className="text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <div>{t('payments.charged')}: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{formatMoney(line.totalCharged)}</span></div>
              <div>{t('payments.collected')}: <span className="font-mono" style={{ color: '#15795C' }}>{formatMoney(line.totalCollected)}</span></div>
            </div>
          </div>
        </div>

        {/* Scrollable account sections */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

        {/* Saved payment methods */}
        <Section title={t('payments.paymentMethods')} icon={<Shield className="w-4 h-4" />} count={methods.length}>
          {methods.length === 0 ? (
            <Empty>{t('payments.noSavedMethods')}</Empty>
          ) : (
            <div className="space-y-2">
              {methods.map(m => (
                <div key={m.id} className="data-row" style={{ borderBottom: 'none', background: 'var(--overlay-subtle)', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="data-row__icon" style={{ width: 30, height: 30 }}>
                    {(() => {
                      const cfg = getMethodConfig(m.type as Parameters<typeof getMethodConfig>[0]);
                      const MIcon = cfg.icon;
                      return <MIcon size={16} style={{ color: cfg.color }} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="data-row__value">{m.label}</div>
                    {m.brand && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.brand}</div>}
                  </div>
                  {m.isDefault && (
                    <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(33, 145, 208, 0.14)', color: '#15795C', border: '1px solid rgba(33, 145, 208, 0.30)' }}>
                      {t('payments.default')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Bills */}
        <Section title={t('payments.invoices')} icon={<Receipt className="w-4 h-4" />} count={bills.length}>
          {bills.length === 0 ? (
            <Empty>{t('payments.noInvoices')}</Empty>
          ) : (
            <div className="space-y-1.5">
              {bills.map(b => (
                <div key={b._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{b.invoiceNumber || b._id.slice(-8)}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                      {(b.encounterDate || b.createdAt).slice(0, 10)} · {b.facilityName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{formatMoney(b.totalAmount)}</div>
                    <div className="text-[10px]" style={{ color: b.balanceDue > 0 ? '#C44536' : '#15795C' }}>
                      {b.balanceDue > 0 ? t('payments.amountDue', { amount: formatMoney(b.balanceDue) }) : t('payments.paid')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payment history */}
        <Section title={t('payments.paymentHistory')} icon={<Clock className="w-4 h-4" />} count={sortedPayments.length}>
          {sortedPayments.length === 0 ? (
            <Empty>{t('payments.noPaymentsYet')}</Empty>
          ) : (
            <div className="space-y-1.5">
              {sortedPayments.map(p => {
                const cfg = getMethodConfig(p.method);
                const MIcon = cfg.icon;
                const reversed = p.status === 'reversed' || p.status === 'refunded';
                return (
                  <div key={p._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{
                    background: reversed ? 'rgba(196, 69, 54, 0.06)' : 'var(--overlay-subtle)',
                    border: reversed ? '1px solid rgba(196, 69, 54, 0.25)' : 'none',
                  }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'transparent' }}>
                      <MIcon size={15} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        {cfg.label}
                        {reversed && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(196, 69, 54, 0.14)', color: '#8B2E24' }}>{p.status}</span>}
                      </div>
                      <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                        {p.reference && <span className="font-mono">{p.reference} · </span>}
                        {new Date(p.processedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {(p.mobileMoneyPhone || p.cardLast4) && (
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {p.mobileMoneyPhone && <span>{p.mobileMoneyPhone}</span>}
                          {p.cardLast4 && <span>•••• {p.cardLast4}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className={`text-[13px] font-bold font-mono`} style={{ color: reversed ? '#8B2E24' : '#15795C', fontVariantNumeric: 'tabular-nums', textDecoration: reversed ? 'line-through' : 'none' }}>
                        {formatMoney(p.amount)}
                      </div>
                      {/* Undo a recorded payment — Void reverses it, Refund gives money
                          back. Both go through a confirm dialog + audited service. */}
                      {!reversed && p.status === 'posted' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onReversePayment(p, 'void')}
                            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                            style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
                          >
                            <Ban className="w-3 h-3" /> {t('action.reverse')}
                          </button>
                          <button
                            onClick={() => onReversePayment(p, 'refund')}
                            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                            style={{ border: '1px solid rgba(196, 69, 54, 0.30)', color: '#C44536' }}
                          >
                            <RotateCcw className="w-3 h-3" /> {t('action.undo')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Insurance claims */}
        <Section title={t('billing.insuranceClaims')} icon={<Shield className="w-4 h-4" />} count={claims.length}>
          {claims.length === 0 ? (
            <Empty>{t('payments.noClaims')}</Empty>
          ) : (
            <div className="space-y-1.5">
              {claims.map(c => (
                <div key={c._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{c.payerName}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                      {c.claimNumber && <span className="font-mono">{c.claimNumber} · </span>}
                      {c.submittedDate ? t('payments.submittedOn', { date: c.submittedDate.slice(0, 10) }) : t('payments.draft')}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{
                    background: c.status === 'paid' ? 'rgba(33, 145, 208, 0.14)' : c.status === 'denied' ? 'rgba(196, 69, 54, 0.14)' : 'rgba(228, 168, 75, 0.14)',
                    color: c.status === 'paid' ? '#15795C' : c.status === 'denied' ? '#8B2E24' : '#B8741C',
                    border: c.status === 'paid' ? '1px solid rgba(33, 145, 208, 0.30)' : c.status === 'denied' ? '1px solid rgba(196, 69, 54, 0.30)' : '1px solid rgba(228, 168, 75, 0.30)',
                  }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payment plans */}
        <Section title={t('billing.paymentPlans')} icon={<Wallet className="w-4 h-4" />} count={plans.length}>
          {plans.length === 0 ? (
            <Empty>{t('payments.noPaymentPlans')}</Empty>
          ) : (
            <div className="space-y-1.5">
              {plans.map(p => {
                const planOutstanding = Math.max(0, p.totalBalance - p.paidToDate);
                return (
                  <div key={p._id} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {t('payments.planMonthly', { amount: formatMoney(p.monthlyAmount), months: p.termMonths })}
                        </div>
                        <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                          {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)} · {p.apr === 0 ? t('payments.interestFree') : t('payments.aprValue', { apr: p.apr })}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{
                        background: p.status === 'active' ? 'rgba(33, 145, 208, 0.14)' : p.status === 'completed' ? 'rgba(33, 145, 208, 0.14)' : 'rgba(228, 168, 75, 0.14)',
                        color: p.status === 'active' ? '#15795C' : p.status === 'completed' ? '#2191D0' : '#B8741C',
                      }}>
                        {p.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                      <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                        {t('payments.paid')}: <span className="font-mono" style={{ color: '#15795C' }}>{formatMoney(p.paidToDate)}</span>
                        {' · '}{t('billing.kpiOutstanding')}: <span className="font-mono" style={{ color: planOutstanding > 0 ? '#C44536' : 'var(--text-secondary)' }}>{formatMoney(planOutstanding)}</span>
                      </div>
                      {p.status === 'active' && (
                        <button
                          onClick={() => onRecordPlanPayment(p)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 whitespace-nowrap transition-opacity hover:opacity-90 text-white"
                          style={{ background: 'var(--accent-primary)' }}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          {t('plans.recordPayment')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        </div>{/* /scrollable account sections */}

        {/* Footer actions */}
        <div className="px-5 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={() => router.push(`/patients/${line.patientId}`)} className="btn btn-secondary flex-1 inline-flex items-center justify-center gap-2">
            {t('payments.openPatientRecord')} <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRecordPayment}
            className="btn btn-primary flex-1 inline-flex items-center justify-center gap-2"
          >
            <Banknote className="w-4 h-4" /> {t('billing.collectPayment')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'transparent', color: 'var(--accent-primary)' }}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] py-3 px-2" style={{ color: 'var(--text-muted)' }}>{children}</div>
  );
}
