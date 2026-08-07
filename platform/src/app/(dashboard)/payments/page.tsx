'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Wallet, Activity, AlertCircle, ChevronRight, ChevronDown, ExternalLink, Receipt, Shield, Clock, Banknote,
  RotateCcw, Ban, AlertTriangle, Search,
} from '@/components/icons/lucide';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SearchInput } from '@/components/filters';
import { computePlanKpis } from '@/components/payments/PlanKpiCards';
import Modal from '@/components/Modal';
import { tooltipStyle, axisTick } from '@/components/ChartCard';
import { toIsoDate, addDays } from '@/components/ehr/EhrMiniCalendar';
import PaymentPanel from '@/components/payments/PaymentPanel';
import { getMethodConfig } from '@/lib/payment-method-config';
import type { PaymentDoc, ClaimDoc, PaymentPlanDoc, PaymentMethodType } from '@/lib/db-types-payments';
import type { BillingDoc, ChargeCategory } from '@/lib/db-types-billing';
import type { EncounterDoc } from '@/lib/db-types';
import { formatMoney } from '@/lib/format-utils';
import '@/components/billing/billing.css';

// Encounter statuses that represent a clinically-finished visit — used to spot
// visits that closed out without ever generating a bill (see `unbilledEncounters`).
const ENCOUNTER_COMPLETION_STATUSES = new Set([
  'discharged', 'discharged_with_referral', 'discharged_with_pending_items',
]);

const CHARGE_CATEGORY_LABELS: Record<ChargeCategory, string> = {
  consultation: 'Consultation',
  laboratory: 'Laboratory',
  pharmacy: 'Pharmacy',
  radiology: 'Radiology',
  procedure: 'Procedure',
  bed_charge: 'Bed Charge',
  surgery: 'Surgery',
  ambulance: 'Ambulance',
  other: 'Other',
};

// Compact axis-tick formatter for money charts (full precision stays in the
// tooltip via formatMoney) — keeps narrow chart columns from crowding.
function compactAmount(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
}

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
  // Used only to derive the "unbilled encounters" tile below — completed
  // encounters that never produced a bill.
  encounters: EncounterDoc[];
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser, globalSearch, setGlobalSearch } = useApp();
  const [data, setData] = useState<PaymentsData>({ payments: [], claims: [], plans: [], bills: [], encounters: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Text search comes from the shared global search state, surfaced as the
  // patient-accounts table's own search box.
  const search = globalSearch;
  // Balance filter retained for the bills list logic; the header filter UI was
  // removed, so it stays at 'all'.
  const [balanceFilter] = useState('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [payingLine, setPayingLine] = useState<PatientLine | null>(null);
  // Inline "Collect payment" launcher: a header button opens a patient picker,
  // and choosing a patient drops straight into the record-payment panel.
  const [collectPickerOpen, setCollectPickerOpen] = useState(false);
  const [collectSearch, setCollectSearch] = useState('');
  // Line/bar toggle for the daily-collections chart.
  const [collectionsChartType, setCollectionsChartType] = useState<'line' | 'bar'>('line');
  // Deeper financial analytics (service-line breakdown, plans, A/R aging) live
  // behind a toggle so the bill queue — the page's actual work — keeps the
  // viewport. Collapsed by default.
  const [showAnalytics, setShowAnalytics] = useState(false);
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
      const [{ getAllPayments, getAllClaims, getAllPaymentPlans }, { getAllBills }, { getAllEncounters }] = await Promise.all([
        import('@/lib/services/payment-service'),
        import('@/lib/services/billing-service'),
        import('@/lib/services/encounter-service'),
      ]);
      const [payments, claims, plans, bills, encounters] = await Promise.all([
        getAllPayments(scope),
        getAllClaims(scope),
        getAllPaymentPlans(scope),
        getAllBills(scope),
        getAllEncounters(scope),
      ]);
      setData({ payments: payments || [], claims: claims || [], plans: plans || [], bills: bills || [], encounters: encounters || [] });
    } catch (err) {
      console.error('Error loading payments data:', err);
      setError(t('payments.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Pending verification queue ─────────────────────────────────────
  // Pay-by-link (cash/bank) and patient-portal payments are written with
  // status 'pending' awaiting finance review. Card/mobile-money pendings are
  // normally reconciled by the provider webhook — anything still here needs a
  // human decision. Approve posts it (and credits the patient ledger); reject
  // marks it failed with a note.
  const { showToast } = useToast();
  const pendingPayments = useMemo(
    () => data.payments.filter(p => p.status === 'pending')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [data.payments],
  );
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);

  const resolvePending = useCallback(async (p: PaymentDoc, approve: boolean) => {
    if (!p.reference) {
      showToast('This payment has no reference and cannot be transitioned — contact support', 'error');
      return;
    }
    setPendingBusy(p._id);
    try {
      const { updatePaymentStatus } = await import('@/lib/services/payment-service');
      const updated = await updatePaymentStatus(
        p.reference,
        approve ? 'posted' : 'failed',
        approve ? undefined : { reason: `Rejected in verification by ${currentUser?.name || 'finance'}` },
      );
      if (!updated) throw new Error('Payment not found by reference');
      showToast(approve ? `Payment ${p.reference} approved and posted` : `Payment ${p.reference} rejected`, 'success');
      await loadData();
    } catch (err) {
      console.error('Pending payment resolution failed:', err);
      showToast('Could not update the payment — try again', 'error');
    } finally {
      setPendingBusy(null);
    }
  }, [currentUser?.name, loadData, showToast]);

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

  // Header stat chips — invoice counts from the bills already loaded on this page.
  const invoiceStats = useMemo(() => {
    const pending = data.bills.filter(b => (b.balanceDue ?? 0) > 0).length;
    return {
      total: data.bills.length,
      pending,
      paid: data.bills.length - pending,
      outstandingPatients: patientLines.filter(l => l.outstanding > 0).length,
    };
  }, [data.bills, patientLines]);

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

  // ── Today's collections by payment method ──────────────────────────
  // Real posted payments only, grouped by method, for the local calendar day
  // (matches the cashier's shift, not UTC — see date-conventions memory).
  const todayCollections = useMemo(() => {
    const todayIso = toIsoDate(new Date());
    const byMethod = new Map<PaymentMethodType, number>();
    let total = 0;
    for (const p of data.payments) {
      if (p.status !== 'posted' || !p.processedAt) continue;
      if (toIsoDate(new Date(p.processedAt)) !== todayIso) continue;
      byMethod.set(p.method, (byMethod.get(p.method) || 0) + p.amount);
      total += p.amount;
    }
    return { byMethod, total };
  }, [data.payments]);

  // Daily posted-collections total for the last 14 days (today inclusive).
  const dailyCollections = useMemo(() => {
    const byIso = new Map<string, number>();
    for (const p of data.payments) {
      if (p.status !== 'posted' || !p.processedAt) continue;
      const iso = toIsoDate(new Date(p.processedAt));
      byIso.set(iso, (byIso.get(iso) || 0) + p.amount);
    }
    const today = new Date();
    const days: { iso: string; label: string; amount: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const iso = toIsoDate(d);
      days.push({ iso, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), amount: byIso.get(iso) || 0 });
    }
    return days;
  }, [data.payments]);

  // Revenue by service line — sum of every bill line item's totalPrice,
  // grouped by charge category, sorted descending, with a running
  // cumulative-% series (rendered as a Pareto-style meter list below).
  const revenueByCategory = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const b of data.bills) {
      for (const item of b.items || []) {
        byCategory.set(item.category, (byCategory.get(item.category) || 0) + (item.totalPrice || 0));
      }
    }
    const rows = Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category: CHARGE_CATEGORY_LABELS[category as ChargeCategory] || category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const grandTotal = rows.reduce((sum, r) => sum + r.amount, 0);
    let running = 0;
    return rows.map(r => {
      running += r.amount;
      return { ...r, cumulativePct: grandTotal > 0 ? Math.round((running / grandTotal) * 100) : 0 };
    });
  }, [data.bills]);

  // Unbilled encounters — clinically-completed visits (discharged, in the
  // last 30 days) whose encounter id never shows up on any bill. Best-effort:
  // facilities that don't bill per-encounter (fee-free public sites) will
  // just show 0 here rather than a misleading count.
  const unbilledEncounters = useMemo(() => {
    const billedEncounterIds = new Set(data.bills.map(b => b.encounterId).filter(Boolean) as string[]);
    const cutoff = Date.now() - 30 * 86_400_000;
    return data.encounters.filter(e => {
      if (!ENCOUNTER_COMPLETION_STATUSES.has(e.status)) return false;
      const closed = e.closedAt || e.startedAt;
      if (!closed || new Date(closed).getTime() < cutoff) return false;
      return !billedEncounterIds.has(e._id);
    }).length;
  }, [data.encounters, data.bills]);

  // Derive the open patient's line from the live aggregates so the drawer's
  // balance/totals refresh automatically after a payment is recorded.
  const selectedLine = useMemo(
    () => (selectedPatientId ? patientLines.find(l => l.patientId === selectedPatientId) || null : null),
    [selectedPatientId, patientLines],
  );

  // Deep link: front-desk checkout routes here with ?patientId= to open that
  // patient's billing drawer directly instead of the unfiltered ledger.
  const patientIdParamRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || patientIdParamRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');
    if (!patientId) return;
    if (!patientLines.some(l => l.patientId === patientId)) return;
    patientIdParamRef.current = true;
    setSelectedPatientId(patientId);
    params.delete('patientId');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [patientLines]);

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
      <main className="page-container page-enter">
        <div className="bl-root">
          <div className="bl-loading">
            <Activity size={30} style={{ animation: 'spin 1s linear infinite' }} />
            <span>{t('payments.loading')}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* The page scrolls rather than pinning itself to the viewport: the
          accounts table used to be squeezed to nothing whenever the analytics
          panel was expanded on a short screen, with no way to scroll it back. */}
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
        <div className="bl-root" style={{ flex: 1, minHeight: 0 }}>
          {error && (
            <div className="bl-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={16} style={{ color: 'var(--color-danger, #DA1E28)', flexShrink: 0 }} />
              <span className="bl-danger" style={{ fontSize: 13 }}>{error}</span>
            </div>
          )}

          {/* ── Page head ── */}
          <div className="bl-home-head" style={{ justifyContent: 'space-between' }}>
            <div className="flex items-center gap-3.5">
              <div className="bl-home-icon"><Wallet size={24} /></div>
              <div>
                <p className="bl-eyebrow">Payments</p>
                <h1 className="bl-title">{t('payments.title')}</h1>
              </div>
            </div>
            <div className="bl-actions">
              <button
                type="button"
                onClick={() => { setCollectSearch(''); setCollectPickerOpen(true); }}
                className="bl-btn bl-btn--primary"
              >
                <Banknote size={16} /> {t('billing.collectPayment')}
              </button>
            </div>
          </div>

          {/* ── Stat strip — today's collections by method, unbilled encounters,
              and the invoice counts that used to live in the header. Label
              above value, no fills: every figure that was on the old grey
              tiles/dot-chips is still here. ── */}
          <div className="bl-stats">
            <div>
              <span className="bl-stat-label">Total collected today</span>
              <span className={`bl-stat-value${todayCollections.total > 0 ? ' bl-stat-value--good' : ''}`}>
                {formatMoney(todayCollections.total)}
              </span>
            </div>
            {Array.from(todayCollections.byMethod.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([method, amount]) => (
                <div key={method}>
                  <span className="bl-stat-label">{getMethodConfig(method).shortLabel}</span>
                  <span className="bl-stat-value">{formatMoney(amount)}</span>
                </div>
              ))}
            <div>
              <span className="bl-stat-label">Unbilled encounters (30d)</span>
              <span className={`bl-stat-value${unbilledEncounters > 0 ? ' bl-stat-value--danger' : ''}`}>{unbilledEncounters}</span>
            </div>
            <div>
              <span className="bl-stat-label">Invoices</span>
              <span className="bl-stat-value">{invoiceStats.total}</span>
            </div>
            <div>
              <span className="bl-stat-label">Pending</span>
              <span className="bl-stat-value">{invoiceStats.pending}</span>
            </div>
            <div>
              <span className="bl-stat-label">Paid</span>
              <span className={`bl-stat-value${invoiceStats.paid > 0 ? ' bl-stat-value--good' : ''}`}>{invoiceStats.paid}</span>
            </div>
            <div>
              <span className="bl-stat-label">Outstanding patients</span>
              <span className={`bl-stat-value${invoiceStats.outstandingPatients > 0 ? ' bl-stat-value--danger' : ''}`}>
                {invoiceStats.outstandingPatients}
              </span>
            </div>
          </div>

          {/* ── Daily collections — real posted-payment data, so it stays a
              chart (per the restyle brief) rather than becoming a meter. ── */}
          <div className="bl-section">
            <div className="bl-section-head">
              <div>
                <h2 className="bl-section-title">Daily collections</h2>
                <p className="bl-card-sub" style={{ margin: '2px 0 0' }}>Posted payments · last 14 days</p>
              </div>
              <div className="bl-actions">
                {(['line', 'bar'] as const).map(ct => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setCollectionsChartType(ct)}
                    className="bl-btn bl-btn--ghost"
                    style={{
                      padding: '5px 12px', fontSize: 12,
                      ...(collectionsChartType === ct ? { borderColor: 'var(--bl-teal)', color: 'var(--bl-teal)' } : {}),
                    }}
                  >
                    {ct === 'line' ? 'Line' : 'Bar'}
                  </button>
                ))}
              </div>
            </div>
            {dailyCollections.every(d => d.amount === 0) ? (
              <p className="bl-muted" style={{ fontSize: 13, margin: 0 }}>No collections in the last 14 days</p>
            ) : collectionsChartType === 'bar' ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={dailyCollections} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ehr-border-soft, #E7EEF5)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compactAmount} width={44} />
                  <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [formatMoney(v ?? 0), 'Collected']} />
                  <Bar dataKey="amount" fill="var(--bl-teal)" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={dailyCollections} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ehr-border-soft, #E7EEF5)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compactAmount} width={44} />
                  <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [formatMoney(v ?? 0), 'Collected']} />
                  <Line type="monotone" dataKey="amount" stroke="var(--bl-teal)" strokeWidth={2} dot={{ r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Deeper analytics, collapsed by default so the bill queue below gets
              the viewport. */}
          <button
            type="button"
            onClick={() => setShowAnalytics(s => !s)}
            aria-expanded={showAnalytics}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              fontSize: 12.5, fontWeight: 600, color: 'var(--ehr-text-body, #39536B)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            {showAnalytics ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Financial analytics
            <span style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--ehr-muted, #8395A8)' }}>
              Revenue by service line · payment plans · A/R aging
            </span>
          </button>

          {/* Revenue by service line — a proportion of total billed, so it
              becomes a meter rather than a bar chart. */}
          {showAnalytics && (() => {
            const revenueTotal = revenueByCategory.reduce((sum, r) => sum + r.amount, 0);
            return (
              <div className="bl-section">
                <h2 className="bl-section-title">Revenue by service line</h2>
                <p className="bl-card-sub" style={{ margin: '2px 0 12px' }}>All bills · sorted by total billed</p>
                {revenueByCategory.length === 0 ? (
                  <p className="bl-muted" style={{ fontSize: 13, margin: 0 }}>No billed service lines yet</p>
                ) : (
                  <div className="bl-meter">
                    {revenueByCategory.map(r => (
                      <div className="bl-meter-row" key={r.category}>
                        <span>{r.category}</span>
                        <span className="bl-meter-track">
                          <span
                            className="bl-meter-fill"
                            style={{ width: `${revenueTotal > 0 ? Math.round((r.amount / revenueTotal) * 100) : 0}%` }}
                          />
                        </span>
                        <span className="bl-meter-value">{formatMoney(r.amount)} · {r.cumulativePct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Payment plans + A/R aging — side by side, both flat bl-section
              cards now: plan KPIs as a stat strip, aging buckets as a meter. */}
          {showAnalytics && (() => {
            const k = computePlanKpis(data.plans);
            const agingRows: { label: string; value: number; tone?: 'warn' | 'danger' }[] = [
              { label: t('billing.agingCurrent'), value: aging.current },
              { label: t('billing.agingFollowUp'), value: aging.d61, tone: 'warn' },
              { label: t('billing.agingAtRisk'), value: aging.d91, tone: 'danger' },
              { label: t('billing.agingCollections'), value: aging.d120, tone: 'danger' },
            ];
            const agingTotal = agingRows.reduce((sum, r) => sum + r.value, 0);
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bl-section">
                  <h2 className="bl-section-title">{t('plans.title')}</h2>
                  <div className="bl-stats" style={{ border: 'none', padding: '14px 0 0' }}>
                    <div>
                      <span className="bl-stat-label">{t('plans.kpiActivePlans')}</span>
                      <span className="bl-stat-value">{k.activePlans}</span>
                    </div>
                    <div>
                      <span className="bl-stat-label">{t('plans.kpiTotalOutstanding')}</span>
                      <span className="bl-stat-value bl-stat-value--danger">{formatMoney(k.totalOutstanding)}</span>
                    </div>
                    <div>
                      <span className="bl-stat-label">{t('plans.kpiDelinquentPlans')}</span>
                      <span className={`bl-stat-value${k.delinquentPlans > 0 ? ' bl-stat-value--danger' : ''}`}>{k.delinquentPlans}</span>
                    </div>
                    <div>
                      <span className="bl-stat-label">{t('plans.kpiCompletedThisMonth')}</span>
                      <span className="bl-stat-value bl-stat-value--good">{k.completedThisMonth}</span>
                    </div>
                  </div>
                </div>

                <div className="bl-section">
                  <h2 className="bl-section-title">{t('billing.arAging')}</h2>
                  {agingTotal === 0 ? (
                    <p className="bl-muted" style={{ fontSize: 13, marginTop: 12 }}>No outstanding receivables</p>
                  ) : (
                    <div className="bl-meter" style={{ marginTop: 12 }}>
                      {agingRows.map(r => (
                        <div className="bl-meter-row" key={r.label}>
                          <span>{r.label}</span>
                          <span className="bl-meter-track">
                            <span
                              className="bl-meter-fill"
                              style={{
                                width: `${agingTotal > 0 ? Math.round((r.value / agingTotal) * 100) : 0}%`,
                                background: r.tone === 'danger' ? '#B3251E' : r.tone === 'warn' ? '#8A5A00' : undefined,
                              }}
                            />
                          </span>
                          <span className="bl-meter-value">{formatMoney(r.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Pending verification queue — payments awaiting a finance decision.
              Rendered only when something needs review, so the page stays clean. */}
          {pendingPayments.length > 0 && (
            <div className="bl-card">
              <div className="bl-card-head">
                <h2 className="bl-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} style={{ color: '#8A5A00' }} />
                  Pending verification
                  <span className="bl-chip bl-chip--partial">{pendingPayments.length}</span>
                </h2>
                <p className="bl-card-sub">Approving posts the payment and credits the patient&rsquo;s balance.</p>
                <span className="bl-underline" />
              </div>
              <div className="bl-table-wrap">
                <table className="bl-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Reference</th>
                      <th>Method</th>
                      <th>Submitted</th>
                      <th className="bl-right">Amount</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPayments.map(p => (
                      <tr key={p._id}>
                        <td style={{ fontWeight: 600 }}>{p.patientName}</td>
                        <td className="bl-muted" style={{ fontFamily: 'monospace' }}>{p.reference}</td>
                        <td>{getMethodConfig(p.method).label}</td>
                        <td className="bl-muted" style={{ whiteSpace: 'nowrap' }}>
                          {p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}
                        </td>
                        <td className="bl-num bl-right" style={{ fontWeight: 700 }}>{formatMoney(p.amount)} {p.currency}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => resolvePending(p, true)}
                              disabled={pendingBusy === p._id}
                              className="bl-btn bl-btn--primary"
                              style={{ padding: '5px 12px', fontSize: 12 }}
                            >
                              <Banknote size={14} /> {pendingBusy === p._id ? 'Working…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => resolvePending(p, false)}
                              disabled={pendingBusy === p._id}
                              className="bl-btn bl-btn--outline"
                              style={{ padding: '5px 12px', fontSize: 12, borderColor: '#B3251E', color: '#B3251E' }}
                            >
                              <Ban size={14} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Patient accounts — fills the remaining viewport height; rows
              scroll inside the card. ── */}
          {/* A floor rather than a share of the viewport — the table always has
              room for a useful number of rows, and the page scrolls past it. */}
          <div className="bl-card" style={{ flex: 1, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
            <div className="bl-card-head">
              <h2 className="bl-card-title">Patient accounts</h2>
              <span className="bl-underline" />
            </div>
            <div className="bl-search">
              <Search size={16} />
              <input
                type="text"
                value={search}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder={t('payments.searchPlaceholder')}
                aria-label={t('payments.searchPlaceholder')}
              />
            </div>
            {filtered.length === 0 ? (
              <div className="bl-empty">
                <Wallet size={34} />
                <h3>{search ? t('payments.noPatientsMatch') : t('payments.noBillingActivity')}</h3>
              </div>
            ) : (
              <div style={{ overflow: 'auto', flex: 1, minHeight: 0, marginTop: 12 }}>
                <table className="bl-table" style={{ minWidth: 880 }}>
                  <thead>
                    <tr>
                      {[
                        { label: t('payments.colPatient'), align: 'left' as const },
                        { label: 'Patient ID', align: 'left' as const },
                        { label: t('payments.colPayments'), align: 'right' as const },
                        { label: t('payments.colClaims'), align: 'right' as const },
                        { label: t('payments.colPlans'), align: 'right' as const },
                        { label: t('payments.colLastActivity'), align: 'left' as const },
                        { label: t('payments.colBalance'), align: 'right' as const },
                        { label: 'Status', align: 'left' as const },
                      ].map(h => (
                        <th
                          key={h.label}
                          className={h.align === 'right' ? 'bl-right' : undefined}
                          style={{ position: 'sticky', top: 0, zIndex: 1 }}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(line => {
                      const owing = line.outstanding > 0;
                      const isRealPatient = line.patientId && !line.patientId.startsWith('demo-') && !line.patientId.includes('_demo');
                      return (
                        <tr
                          key={line.patientId}
                          onClick={() => setSelectedPatientId(line.patientId)}
                          tabIndex={0}
                          aria-label={`Open account for ${line.patientName}`}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPatientId(line.patientId); } }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            {isRealPatient ? (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); router.push(`/patients/${line.patientId}`); }}
                                className="bl-link"
                                style={{ fontWeight: 600 }}
                              >
                                {line.patientName}
                              </button>
                            ) : (
                              <span style={{ fontWeight: 600 }}>{line.patientName}</span>
                            )}
                          </td>
                          <td>
                            {isRealPatient && line.hospitalNumber ? (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); router.push(`/patients/${line.patientId}`); }}
                                className="bl-link"
                              >
                                {line.hospitalNumber}
                              </button>
                            ) : (
                              <span className="bl-muted">{line.hospitalNumber || '—'}</span>
                            )}
                          </td>
                          <td className="bl-num bl-right">{line.paymentCount > 0 ? line.paymentCount : '—'}</td>
                          <td className="bl-num bl-right">{line.openClaims > 0 ? line.openClaims : '—'}</td>
                          <td className="bl-num bl-right">{line.activePlans > 0 ? line.activePlans : '—'}</td>
                          <td className="bl-muted" style={{ whiteSpace: 'nowrap' }}>
                            {line.lastActivity ? new Date(line.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="bl-num bl-right" style={{ fontWeight: 700, color: owing ? '#B3251E' : '#14713A' }}>
                            {formatMoney(owing ? line.outstanding : line.totalCollected)}
                          </td>
                          <td>
                            <span className={`bl-chip ${owing ? 'bl-chip--unpaid' : 'bl-chip--paid'}`}>
                              {owing ? t('billing.kpiOutstanding') : t('payments.paid')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
        <Modal onClose={() => { if (!reversing) setReverseFor(null); }} width={420} labelledBy="bl-reverse-title">
          <div className="bl-root bl-modal-body">
            <h3 className="bl-modal-title" id="bl-reverse-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: '#B3251E' }} />
              {reverseFor.mode === 'void' ? t('action.reverse') : t('action.undo')}
            </h3>
            <div className="bl-fee-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
              <div className="bl-fee-row">
                <div className="min-w-0">
                  <div className="bl-fee-name">{reverseFor.payment.patientName}</div>
                  <div className="bl-fee-cat">
                    {getMethodConfig(reverseFor.payment.method).label}
                    {reverseFor.payment.reference && <span style={{ fontFamily: 'monospace' }}> · {reverseFor.payment.reference}</span>}
                  </div>
                </div>
                <span className="bl-num" style={{ fontWeight: 700, color: '#B3251E' }}>{formatMoney(reverseFor.payment.amount)}</span>
              </div>
            </div>
            <div className="bl-field">
              <label htmlFor="bl-reverse-reason">{t('billing.reason')}</label>
              <textarea
                id="bl-reverse-reason"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                rows={2}
                autoFocus
              />
            </div>
            <div className="bl-modal-actions">
              <button type="button" onClick={() => setReverseFor(null)} disabled={reversing} className="bl-btn bl-btn--ghost">{t('action.cancel')}</button>
              <button
                type="button"
                onClick={handleConfirmReverse}
                disabled={!reverseReason.trim() || reversing}
                className="bl-btn bl-btn--dark"
                style={{ background: '#DA1E28' }}
              >
                {reverseFor.mode === 'void' ? <Ban size={16} /> : <RotateCcw size={16} />}
                {t('action.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Collect-payment patient picker (opened from the header button) */}
      {collectPickerOpen && (
        <Modal onClose={() => setCollectPickerOpen(false)} width={460}>
          <div className="bl-root" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--ehr-border, #D8E3EC)' }}>
              <div className="flex items-center gap-2">
                <Banknote size={18} style={{ color: 'var(--bl-teal)' }} />
                <h2 className="bl-modal-title">{t('billing.collectPayment')}</h2>
              </div>
              <button
                type="button"
                onClick={() => setCollectPickerOpen(false)}
                aria-label="Close"
                style={{
                  background: 'transparent', border: '1px solid var(--ehr-border, #D8E3EC)', borderRadius: 6,
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3">
              <SearchInput value={collectSearch} onChange={setCollectSearch} placeholder={t('payments.searchPlaceholder')} />
              <div className="mt-2" style={{ maxHeight: 360, overflowY: 'auto' }}>
                {(() => {
                  const q = collectSearch.trim().toLowerCase();
                  const list = patientLines
                    .filter(l => l.outstanding > 0)
                    .filter(l => !q || l.patientName.toLowerCase().includes(q) || (l.hospitalNumber || '').toLowerCase().includes(q))
                    .sort((a, b) => b.outstanding - a.outstanding);
                  if (list.length === 0) {
                    return <p className="bl-muted" style={{ textAlign: 'center', fontSize: 12.5, padding: '32px 0' }}>{t('payments.noOutstanding')}</p>;
                  }
                  return (
                    <div className="bl-fee-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
                      {list.map(line => (
                        <button
                          key={line.patientId}
                          type="button"
                          onClick={() => { setPayingLine(line); setCollectPickerOpen(false); }}
                          className="bl-fee-row"
                          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                        >
                          <div className="min-w-0">
                            <div className="bl-fee-name">{line.patientName}</div>
                            {line.hospitalNumber && <div className="bl-fee-cat" style={{ fontFamily: 'monospace' }}>{line.hospitalNumber}</div>}
                          </div>
                          <span className="bl-num" style={{ fontWeight: 700, color: '#B3251E' }}>{formatMoney(line.outstanding)}</span>
                        </button>
                      ))}
                    </div>
                  );
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
          <div className="bl-root bl-modal-body">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt size={18} style={{ color: 'var(--bl-teal)' }} />
                <div>
                  <h3 className="bl-modal-title">{t('plans.recordPayment')}</h3>
                  <p className="bl-card-sub" style={{ margin: '2px 0 0' }}>{recordPlanFor.patientName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecordPlanFor(null)}
                aria-label="Close"
                style={{
                  background: 'transparent', border: '1px solid var(--ehr-border, #D8E3EC)', borderRadius: 6,
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="bl-field">
              <label htmlFor="bl-plan-amount">{t('plans.paymentAmountLabel')}</label>
              <input
                id="bl-plan-amount"
                type="number"
                value={planAmount}
                onChange={(e) => setPlanAmount(e.target.value)}
                placeholder={t('plans.paymentAmountPlaceholder')}
                autoFocus
              />
            </div>
            <div className="bl-field">
              <label htmlFor="bl-plan-notes">{t('plans.notesLabel')}</label>
              <textarea
                id="bl-plan-notes"
                value={planNotes}
                onChange={(e) => setPlanNotes(e.target.value)}
                placeholder={t('plans.notesPlaceholder')}
                rows={3}
              />
            </div>
            <div className="bl-modal-actions">
              <button type="button" onClick={() => setRecordPlanFor(null)} className="bl-btn bl-btn--ghost">{t('action.cancel')}</button>
              <button
                type="button"
                onClick={handleRecordPlanPayment}
                disabled={!planAmount || savingPlan}
                className="bl-btn bl-btn--primary"
              >
                <Receipt size={16} />
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
        className="bl-root"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--ehr-border, #D8E3EC)' }}>
          <div>
            <button
              onClick={() => router.push(`/patients/${line.patientId}`)}
              className="bl-link"
              style={{ fontSize: 16 }}
              title={t('payments.openPatientRecord')}
            >
              <span id="billing-detail-name">{line.patientName}</span>
            </button>
            {line.hospitalNumber && (
              <div className="bl-id-tag" style={{ marginTop: 4, display: 'inline-block' }}>{line.hospitalNumber}</div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: '1px solid var(--ehr-border, #D8E3EC)', borderRadius: 6,
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance summary — flat, no gradient tint; colour carries the state. */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--ehr-border, #D8E3EC)' }}>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <span className="bl-stat-label" style={{ color: owing ? '#B3251E' : '#14713A' }}>
                {owing ? t('billing.outstandingBalance') : t('billing.accountStatus')}
              </span>
              <span className="bl-stat-value" style={{ fontSize: 22, color: owing ? '#B3251E' : '#14713A' }}>
                {owing ? formatMoney(line.outstanding) : t('billing.paidInFull')}
              </span>
            </div>
            <div className="bl-muted" style={{ fontSize: 11, textAlign: 'right' }}>
              <div>{t('payments.charged')}: <span style={{ color: 'var(--ehr-text, #102634)', fontFamily: 'monospace' }}>{formatMoney(line.totalCharged)}</span></div>
              <div>{t('payments.collected')}: <span style={{ color: '#14713A', fontFamily: 'monospace' }}>{formatMoney(line.totalCollected)}</span></div>
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
            <div className="bl-fee-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
              {methods.map(m => {
                const cfg = getMethodConfig(m.type as Parameters<typeof getMethodConfig>[0]);
                const MIcon = cfg.icon;
                return (
                  <div key={m.id} className="bl-fee-row">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MIcon size={16} style={{ color: cfg.color, flexShrink: 0 }} />
                      <div className="min-w-0">
                        <div className="bl-fee-name">{m.label}</div>
                        {m.brand && <div className="bl-fee-cat">{m.brand}</div>}
                      </div>
                    </div>
                    {m.isDefault && <span className="bl-chip bl-chip--ontime">{t('payments.default')}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Bills */}
        <Section title={t('payments.invoices')} icon={<Receipt className="w-4 h-4" />} count={bills.length}>
          {bills.length === 0 ? (
            <Empty>{t('payments.noInvoices')}</Empty>
          ) : (
            <div className="bl-fee-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
              {bills.map(b => (
                <div key={b._id} className="bl-fee-row">
                  <div className="min-w-0">
                    <div className="bl-fee-name">{b.invoiceNumber || b._id.slice(-8)}</div>
                    <div className="bl-fee-cat">{(b.encounterDate || b.createdAt).slice(0, 10)} · {b.facilityName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="bl-num" style={{ fontWeight: 600, color: 'var(--ehr-text, #102634)' }}>{formatMoney(b.totalAmount)}</div>
                    <div style={{ fontSize: 10.5, color: b.balanceDue > 0 ? '#B3251E' : '#14713A' }}>
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
            <div className="bl-fee-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
              {sortedPayments.map(p => {
                const cfg = getMethodConfig(p.method);
                const MIcon = cfg.icon;
                const reversed = p.status === 'reversed' || p.status === 'refunded';
                return (
                  <div key={p._id} className="bl-fee-row" style={{ alignItems: 'flex-start' }}>
                    <div className="flex items-start gap-2.5 min-w-0">
                      <MIcon size={15} style={{ color: cfg.color, marginTop: 2, flexShrink: 0 }} />
                      <div className="min-w-0">
                        <div className="bl-fee-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cfg.label}
                          {reversed && <span className="bl-chip bl-chip--cancelled">{p.status}</span>}
                        </div>
                        <div className="bl-fee-cat">
                          {p.reference && <span style={{ fontFamily: 'monospace' }}>{p.reference} · </span>}
                          {new Date(p.processedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {(p.mobileMoneyPhone || p.cardLast4) && (
                          <div className="bl-fee-cat">
                            {p.mobileMoneyPhone && <span>{p.mobileMoneyPhone}</span>}
                            {p.cardLast4 && <span>•••• {p.cardLast4}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className="bl-num"
                        style={{ fontWeight: 700, color: reversed ? '#B3251E' : '#14713A', textDecoration: reversed ? 'line-through' : 'none' }}
                      >
                        {formatMoney(p.amount)}
                      </span>
                      {/* Undo a recorded payment — Void reverses it, Refund gives money
                          back. Both go through a confirm dialog + audited service. */}
                      {!reversed && p.status === 'posted' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onReversePayment(p, 'void')}
                            className="bl-btn bl-btn--ghost"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            <Ban className="w-3 h-3" /> {t('action.reverse')}
                          </button>
                          <button
                            onClick={() => onReversePayment(p, 'refund')}
                            className="bl-btn bl-btn--outline"
                            style={{ padding: '3px 8px', fontSize: 11, borderColor: '#B3251E', color: '#B3251E' }}
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
            <div className="bl-fee-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
              {claims.map(c => (
                <div key={c._id} className="bl-fee-row">
                  <div className="min-w-0">
                    <div className="bl-fee-name">{c.payerName}</div>
                    <div className="bl-fee-cat">
                      {c.claimNumber && <span style={{ fontFamily: 'monospace' }}>{c.claimNumber} · </span>}
                      {c.submittedDate ? t('payments.submittedOn', { date: c.submittedDate.slice(0, 10) }) : t('payments.draft')}
                    </div>
                  </div>
                  <span className={`bl-chip ${c.status === 'paid' ? 'bl-chip--paid' : c.status === 'denied' ? 'bl-chip--unpaid' : 'bl-chip--partial'}`}>
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
            <div className="bl-fee-list" style={{ maxHeight: 'none', overflow: 'visible' }}>
              {plans.map((p, idx) => {
                const planOutstanding = Math.max(0, p.totalBalance - p.paidToDate);
                return (
                  <div
                    key={p._id}
                    style={{ padding: '9px 12px', borderBottom: idx === plans.length - 1 ? 'none' : '1px solid var(--ehr-border-soft, #E7EEF5)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="bl-fee-name">
                          {t('payments.planMonthly', { amount: formatMoney(p.monthlyAmount), months: p.termMonths })}
                        </div>
                        <div className="bl-fee-cat">
                          {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)} · {p.apr === 0 ? t('payments.interestFree') : t('payments.aprValue', { apr: p.apr })}
                        </div>
                      </div>
                      <span className={`bl-chip ${p.status === 'completed' ? 'bl-chip--paid' : p.status === 'active' ? 'bl-chip--partial' : 'bl-chip--unpaid'}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--ehr-border-soft, #E7EEF5)' }}>
                      <div className="bl-fee-cat">
                        {t('payments.paid')}: <span style={{ color: '#14713A' }}>{formatMoney(p.paidToDate)}</span>
                        {' · '}{t('billing.kpiOutstanding')}: <span style={{ color: planOutstanding > 0 ? '#B3251E' : 'var(--ehr-text-body, #39536B)' }}>{formatMoney(planOutstanding)}</span>
                      </div>
                      {p.status === 'active' && (
                        <button
                          onClick={() => onRecordPlanPayment(p)}
                          className="bl-btn bl-btn--outline"
                          style={{ padding: '4px 10px', fontSize: 11.5 }}
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
        <div className="px-5 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--ehr-border, #D8E3EC)' }}>
          <button onClick={() => router.push(`/patients/${line.patientId}`)} className="bl-btn bl-btn--outline" style={{ flex: 1 }}>
            {t('payments.openPatientRecord')} <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRecordPayment}
            className="bl-btn bl-btn--primary"
            style={{ flex: 1 }}
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
    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--ehr-border, #D8E3EC)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'transparent', color: 'var(--bl-teal)' }}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ehr-text-title, #132C44)' }}>{title}</h3>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ehr-muted, #8395A8)' }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] py-3 px-2" style={{ color: 'var(--ehr-muted, #8395A8)' }}>{children}</div>
  );
}
