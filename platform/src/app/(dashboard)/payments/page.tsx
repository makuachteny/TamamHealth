'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import {
  Search, X, Wallet, Activity, AlertCircle, ChevronRight, ExternalLink, ArrowRight, Receipt, Shield, Clock,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { getMethodConfig } from '@/lib/payment-method-config';
import type { PaymentDoc, ClaimDoc, PaymentPlanDoc } from '@/lib/db-types-payments';
import type { BillingDoc } from '@/lib/db-types-billing';

const fmt = (n: number) => 'SSP ' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
  const { currentUser } = useApp();
  const [data, setData] = useState<PaymentsData>({ payments: [], claims: [], plans: [], bills: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientLine | null>(null);

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
      setError('Failed to load billing data');
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
    if (!q) return patientLines;
    return patientLines.filter(l =>
      l.patientName.toLowerCase().includes(q) ||
      (l.hospitalNumber || '').toLowerCase().includes(q)
    );
  }, [patientLines, search]);

  if (loading) {
    return (
      <>
        <TopBar title="Bills" />
        <main className="page-container page-enter">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: 'var(--text-muted)' }}>
            <Activity size={44} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
            <span>Loading billing data...</span>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Bills" />
      <main className="page-container page-enter">
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

        {/* Page header */}
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: -0.3 }}>Bills</h1>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
              {filtered.length} {filtered.length === 1 ? 'patient' : 'patients'}
              {filtered.filter(l => l.outstanding > 0).length > 0 && (
                <> · <span style={{ color: '#C44536', fontWeight: 600 }}>{filtered.filter(l => l.outstanding > 0).length} with outstanding balance</span></>
              )}
            </p>
          </div>
          <div className="relative" style={{ minWidth: 280 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              className="pl-9 search-icon-input w-full"
              placeholder="Search by patient name or hospital number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'var(--overlay-subtle)' }}
            />
          </div>
        </div>

        {/* People list */}
        <div className="dash-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <Wallet className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              {search ? 'No patients match your search.' : 'No billing activity recorded yet.'}
            </div>
          ) : (
            <div>
              {filtered.map(line => {
                const initials = line.patientName.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                const owing = line.outstanding > 0;
                return (
                  <button
                    key={line.patientId}
                    onClick={() => setSelectedPatient(line)}
                    className="w-full text-left data-row hover:opacity-95 transition-opacity"
                    style={owing ? { background: 'rgba(196, 69, 54, 0.04)' } : undefined}
                  >
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
                      style={{
                        background: owing
                          ? 'linear-gradient(135deg, #D96E59 0%, #C44536 100%)'
                          : 'linear-gradient(135deg, #1B9AAA 0%, #1A3A3A 100%)',
                      }}
                    >
                      {initials || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{line.patientName}</div>
                        {line.hospitalNumber && (
                          <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(27, 154, 170, 0.10)', color: '#1B9AAA', fontWeight: 600 }}>
                            {line.hospitalNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5" style={{ color: 'var(--text-muted)' }}>
                        {line.paymentCount > 0 && <span>{line.paymentCount} {line.paymentCount === 1 ? 'payment' : 'payments'}</span>}
                        {line.openClaims > 0 && <span>· {line.openClaims} open {line.openClaims === 1 ? 'claim' : 'claims'}</span>}
                        {line.activePlans > 0 && <span>· {line.activePlans} active plan{line.activePlans === 1 ? '' : 's'}</span>}
                        {line.lastActivity && <span>· last {new Date(line.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {owing ? (
                        <>
                          <div className="font-bold text-sm" style={{ color: '#8B2E24', fontVariantNumeric: 'tabular-nums' }}>{fmt(line.outstanding)}</div>
                          <div className="text-[10px] font-bold uppercase" style={{ color: '#C44536' }}>Outstanding</div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold text-sm" style={{ color: '#15795C', fontVariantNumeric: 'tabular-nums' }}>{fmt(line.totalCollected)}</div>
                          <div className="text-[10px] font-bold uppercase" style={{ color: '#15795C' }}>Paid</div>
                        </>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Detail drawer */}
      {selectedPatient && (
        <PatientBillingDetail
          line={selectedPatient}
          payments={data.payments.filter(p => p.patientId === selectedPatient.patientId)}
          claims={data.claims.filter(c => c.patientId === selectedPatient.patientId)}
          plans={data.plans.filter(p => p.patientId === selectedPatient.patientId)}
          bills={data.bills.filter(b => b.patientId === selectedPatient.patientId)}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </>
  );
}

// ═══ Detail drawer ═══════════════════════════════════════════════════

function PatientBillingDetail({ line, payments, claims, plans, bills, onClose }: {
  line: PatientLine;
  payments: PaymentDoc[];
  claims: ClaimDoc[];
  plans: PaymentPlanDoc[];
  bills: BillingDoc[];
  onClose: () => void;
}) {
  // Lock body scroll while drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
          label: d.label || (d.methodType || 'Method'),
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
  const initials = line.patientName.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const owing = line.outstanding > 0;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div
        className="card-elevated"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 100vw)',
          height: '100vh',
          background: 'var(--bg-card-solid)',
          overflow: 'auto',
          borderRadius: 0,
          padding: 0,
          animation: 'modalSlideUp 0.25s ease-out',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
              style={{
                background: owing
                  ? 'linear-gradient(135deg, #D96E59 0%, #C44536 100%)'
                  : 'linear-gradient(135deg, #1B9AAA 0%, #1A3A3A 100%)',
              }}
            >
              {initials || '?'}
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{line.patientName}</h2>
              {line.hospitalNumber && (
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(27, 154, 170, 0.10)', color: '#1B9AAA', fontWeight: 600 }}>
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
            : 'linear-gradient(135deg, rgba(27, 158, 119, 0.08) 0%, rgba(27, 154, 170, 0.04) 100%)',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: owing ? '#8B2E24' : '#15795C' }}>
                {owing ? 'Outstanding Balance' : 'Account Status'}
              </div>
              <div className="text-2xl font-extrabold" style={{ letterSpacing: -0.5, color: owing ? '#8B2E24' : '#15795C', fontVariantNumeric: 'tabular-nums' }}>
                {owing ? fmt(line.outstanding) : 'Paid in Full'}
              </div>
            </div>
            <div className="text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <div>Charged: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{fmt(line.totalCharged)}</span></div>
              <div>Collected: <span className="font-mono" style={{ color: '#15795C' }}>{fmt(line.totalCollected)}</span></div>
            </div>
          </div>
        </div>

        {/* Saved payment methods */}
        <Section title="Payment Methods" icon={<Shield className="w-4 h-4" />} count={methods.length}>
          {methods.length === 0 ? (
            <Empty>No saved payment methods on file.</Empty>
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
                    <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(27, 154, 170, 0.14)', color: '#15795C', border: '1px solid rgba(27, 154, 170, 0.30)' }}>
                      Default
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Bills */}
        <Section title="Invoices" icon={<Receipt className="w-4 h-4" />} count={bills.length}>
          {bills.length === 0 ? (
            <Empty>No invoices on file.</Empty>
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
                    <div className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(b.totalAmount)}</div>
                    <div className="text-[10px]" style={{ color: b.balanceDue > 0 ? '#C44536' : '#15795C' }}>
                      {b.balanceDue > 0 ? `${fmt(b.balanceDue)} due` : 'Paid'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payment history */}
        <Section title="Payment History" icon={<Clock className="w-4 h-4" />} count={sortedPayments.length}>
          {sortedPayments.length === 0 ? (
            <Empty>No payments recorded yet.</Empty>
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
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}1A` }}>
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
                    <div className={`text-[13px] font-bold font-mono`} style={{ color: reversed ? '#8B2E24' : '#15795C', fontVariantNumeric: 'tabular-nums', textDecoration: reversed ? 'line-through' : 'none' }}>
                      {fmt(p.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Insurance claims */}
        <Section title="Insurance Claims" icon={<Shield className="w-4 h-4" />} count={claims.length}>
          {claims.length === 0 ? (
            <Empty>No claims submitted for this patient.</Empty>
          ) : (
            <div className="space-y-1.5">
              {claims.map(c => (
                <div key={c._id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{c.payerName}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                      {c.claimNumber && <span className="font-mono">{c.claimNumber} · </span>}
                      {c.submittedDate ? `submitted ${c.submittedDate.slice(0, 10)}` : 'draft'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{
                    background: c.status === 'paid' ? 'rgba(27, 154, 170, 0.14)' : c.status === 'denied' ? 'rgba(196, 69, 54, 0.14)' : 'rgba(228, 168, 75, 0.14)',
                    color: c.status === 'paid' ? '#15795C' : c.status === 'denied' ? '#8B2E24' : '#B8741C',
                    border: c.status === 'paid' ? '1px solid rgba(27, 154, 170, 0.30)' : c.status === 'denied' ? '1px solid rgba(196, 69, 54, 0.30)' : '1px solid rgba(228, 168, 75, 0.30)',
                  }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Payment plans */}
        <Section title="Payment Plans" icon={<Wallet className="w-4 h-4" />} count={plans.length}>
          {plans.length === 0 ? (
            <Empty>No payment plans for this patient.</Empty>
          ) : (
            <div className="space-y-1.5">
              {plans.map(p => (
                <div key={p._id} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmt(p.monthlyAmount)} / mo · {p.termMonths} months
                      </div>
                      <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                        {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)} · {p.apr === 0 ? 'Interest-free' : `${p.apr}% APR`}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{
                      background: p.status === 'active' ? 'rgba(27, 154, 170, 0.14)' : p.status === 'completed' ? 'rgba(27, 154, 170, 0.14)' : 'rgba(228, 168, 75, 0.14)',
                      color: p.status === 'active' ? '#15795C' : p.status === 'completed' ? '#1B9AAA' : '#B8741C',
                    }}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <a href={`/patients/${line.patientId}`} className="btn btn-secondary w-full inline-flex items-center justify-center gap-2">
            Open patient record <ExternalLink className="w-3.5 h-3.5" /> <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
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
