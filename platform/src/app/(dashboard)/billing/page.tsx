'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import PaymentPanel from '@/components/payments/PaymentPanel';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Wallet, Receipt, ClipboardCheck, CreditCard, ArrowRight,
  TrendingUp, AlertTriangle, ShieldCheck,
} from '@/components/icons/lucide';
import type { BillingDoc } from '@/lib/db-types-billing';
import type { PaymentDoc, ClaimDoc, PayerType } from '@/lib/db-types-payments';

/**
 * Medical Biller home — the front-line collections + insurance cockpit.
 * Models the African facility revenue cycle: out-of-pocket ("cash & carry",
 * increasingly mobile money) sits alongside national schemes (NHIS/NHIF),
 * community-based insurance (CBHI/mutuelles) and donor-funded care. Surfaces
 * what's owed, by whom and how old, the payer mix, and a one-tap collect flow.
 */
export default function BillingPage() {
  return (
    <RoleGuard>
      <BillingDashboard />
    </RoleGuard>
  );
}

// Human labels for the payer types, framed around African financing.
const PAYER_LABEL_KEYS: Record<PayerType, string> = {
  self_pay: 'billing.payerSelfPay',
  nhis: 'billing.payerNhis',
  cbhi: 'billing.payerCbhi',
  donor: 'billing.payerDonor',
  government: 'billing.payerGovernment',
  private: 'billing.payerPrivate',
  employer: 'billing.payerEmployer',
};

const PAYER_COLORS: Record<PayerType, string> = {
  self_pay: 'var(--accent-primary)',
  nhis: 'var(--color-success)',
  cbhi: '#0891B2',
  donor: 'var(--color-warning)',
  government: '#7C3AED',
  private: '#EA580C',
  employer: '#0F766E',
};

interface CollectTarget {
  patientId: string;
  patientName: string;
  encounterId?: string;
  amountDue: number;
  currency: string;
}

function BillingDashboard() {
  const { t } = useTranslation();
  const [bills, setBills] = useState<BillingDoc[]>([]);
  const [payments, setPayments] = useState<PaymentDoc[]>([]);
  const [claims, setClaims] = useState<ClaimDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectFor, setCollectFor] = useState<CollectTarget | null>(null);

  const load = async () => {
    try {
      const [{ getAllBills }, { getAllPayments, getAllClaims }] = await Promise.all([
        import('@/lib/services/billing-service'),
        import('@/lib/services/payment-service'),
      ]);
      const [b, p, c] = await Promise.all([getAllBills(), getAllPayments(), getAllClaims()]);
      setBills(b);
      setPayments(p);
      setClaims(c);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const currency = bills[0]?.currency || 'SSP';
  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;

  // Outstanding bills (anything with a balance still due).
  const outstanding = useMemo(
    () => bills.filter(b => (b.balanceDue ?? 0) > 0 && b.status !== 'waived' && b.status !== 'cancelled'),
    [bills],
  );

  const totalOutstanding = useMemo(
    () => outstanding.reduce((s, b) => s + b.balanceDue, 0),
    [outstanding],
  );

  const totalCollected = useMemo(
    () => payments.filter(p => p.status === 'posted').reduce((s, p) => s + p.amount, 0),
    [payments],
  );

  const pendingClaims = useMemo(
    () => claims.filter(c => c.status === 'submitted' || c.status === 'draft' || c.status === 'appealed'),
    [claims],
  );

  // A/R aging buckets — days since encounter.
  const aging = useMemo(() => {
    const buckets = { current: 0, d31: 0, d61: 0, d91: 0, d120: 0 };
    const now = Date.now();
    for (const b of outstanding) {
      const dateStr = b.encounterDate || b.createdAt;
      const days = Math.floor((now - new Date(dateStr).getTime()) / 86_400_000);
      if (days <= 30) buckets.current += b.balanceDue;
      else if (days <= 60) buckets.d31 += b.balanceDue;
      else if (days <= 90) buckets.d61 += b.balanceDue;
      else if (days <= 120) buckets.d91 += b.balanceDue;
      else buckets.d120 += b.balanceDue;
    }
    return buckets;
  }, [outstanding]);

  // Payer mix — from claims by payer type, plus out-of-pocket from uninsured bills.
  const payerMix = useMemo(() => {
    const mix: Partial<Record<PayerType, number>> = {};
    for (const c of claims) {
      mix[c.payerType] = (mix[c.payerType] || 0) + c.totalBilled;
    }
    // Bills with no insurance provider counted as out-of-pocket.
    const oop = bills
      .filter(b => !b.insuranceProvider)
      .reduce((s, b) => s + b.totalAmount, 0);
    if (oop > 0) mix.self_pay = (mix.self_pay || 0) + oop;
    const total = Object.values(mix).reduce((s, v) => s + (v || 0), 0) || 1;
    return (Object.keys(mix) as PayerType[])
      .map(k => ({ payer: k, amount: mix[k] || 0, pct: Math.round(((mix[k] || 0) / total) * 100) }))
      .sort((a, b) => b.amount - a.amount);
  }, [claims, bills]);

  // Outstanding grouped by patient for the collections worklist.
  const byPatient = useMemo(() => {
    const map = new Map<string, { patientId: string; patientName: string; encounterId?: string; balance: number; bills: number }>();
    for (const b of outstanding) {
      const cur = map.get(b.patientId) || { patientId: b.patientId, patientName: b.patientName, encounterId: b.encounterId, balance: 0, bills: 0 };
      cur.balance += b.balanceDue;
      cur.bills += 1;
      map.set(b.patientId, cur);
    }
    return [...map.values()].sort((a, b) => b.balance - a.balance);
  }, [outstanding]);

  return (
    <>
      <TopBar />
      <main className="page-container">
        <PageHeader
          icon={Wallet}
          title={t('billing.title')}
          subtitle={t('billing.subtitle')}
        />

        {/* KPI strip */}
        <div className="stat-grid">
          <StatCard icon={Receipt} label={t('billing.kpiOutstanding')} value={loading ? '—' : money(totalOutstanding)} tint="var(--color-warning)" />
          <StatCard icon={TrendingUp} label={t('billing.kpiCollected')} value={loading ? '—' : money(totalCollected)} tint="var(--color-success)" />
          <StatCard icon={ClipboardCheck} label={t('billing.kpiPendingClaims')} value={loading ? '—' : String(pendingClaims.length)} tint="var(--accent-primary)" />
          <StatCard icon={AlertTriangle} label={t('billing.kpiPatientsOwing')} value={loading ? '—' : String(byPatient.length)} tint="var(--accent-primary)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginTop: 8 }}>
          {/* A/R aging */}
          <section className="glass-section">
            <div className="glass-section-header">
              <span className="kpi-card-title">{t('billing.arAging')}</span>
            </div>
            <div className="glass-section-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <AgingTile label={t('billing.agingCurrent')} sub="0–30d" value={money(aging.current)} ok />
                <AgingTile label="31–60d" sub={t('billing.agingWatch')} value={money(aging.d31)} />
                <AgingTile label="61–90d" sub={t('billing.agingFollowUp')} value={money(aging.d61)} />
                <AgingTile label="91–120d" sub={t('billing.agingAtRisk')} value={money(aging.d91)} warn />
                <AgingTile label="120d+" sub={t('billing.agingCollections')} value={money(aging.d120)} danger />
              </div>
            </div>
          </section>

          {/* Payer mix */}
          <section className="glass-section">
            <div className="glass-section-header">
              <span className="kpi-card-title">{t('billing.payerMix')}</span>
            </div>
            <div className="glass-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading && <p className="text-caption">{t('billing.loading')}</p>}
              {!loading && payerMix.length === 0 && <p className="text-caption">{t('billing.noBillingData')}</p>}
              {payerMix.map(({ payer, amount, pct }) => (
                <div key={payer}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{t(PAYER_LABEL_KEYS[payer])}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{money(amount)} · {pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--overlay-medium)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: PAYER_COLORS[payer] }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
          <QuickLink href="/payments/claims" icon={ShieldCheck} title={t('billing.insuranceClaims')} desc={t('billing.insuranceClaimsDesc')} />
          <QuickLink href="/payments/plans" icon={CreditCard} title={t('billing.paymentPlans')} desc={t('billing.paymentPlansDesc')} />
          <QuickLink href="/payments" icon={Receipt} title={t('billing.allBills')} desc={t('billing.allBillsDesc')} />
        </div>

        {/* Collections worklist */}
        <section className="glass-section" style={{ marginTop: 12 }}>
          <div className="glass-section-header">
            <span className="kpi-card-title">{t('billing.collectionsWorklist')}</span>
            <span className="text-caption">{t('billing.patientsOwing', { count: byPatient.length })}</span>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('billing.colPatient')}</th>
                  <th>{t('billing.colOpenBills')}</th>
                  <th>{t('billing.colBalanceDue')}</th>
                  <th style={{ textAlign: 'right' }}>{t('billing.colAction')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('billing.loading')}</td></tr>
                )}
                {!loading && byPatient.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('billing.nothingOutstanding')}</td></tr>
                )}
                {byPatient.map(p => (
                  <tr key={p.patientId}>
                    <td>
                      <Link href={`/patients/${p.patientId}`} className="link-accent" style={{ fontWeight: 600 }}>{p.patientName}</Link>
                    </td>
                    <td>{p.bills}</td>
                    <td style={{ fontWeight: 700 }}>{money(p.balance)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setCollectFor({ patientId: p.patientId, patientName: p.patientName, encounterId: p.encounterId, amountDue: p.balance, currency })}
                      >
                        {t('billing.collect')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {collectFor && (
        <PaymentPanel
          patientId={collectFor.patientId}
          patientName={collectFor.patientName}
          encounterId={collectFor.encounterId}
          amountDue={collectFor.amountDue}
          currency={collectFor.currency}
          onCancel={() => setCollectFor(null)}
          onSuccess={() => { setCollectFor(null); setLoading(true); load(); }}
        />
      )}
    </>
  );
}

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof Wallet; label: string; value: string; tint: string }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat__icon" style={{ background: 'var(--accent-light)', color: tint }}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="dash-stat__value">{value}</div>
        <div className="dash-stat__label">{label}</div>
      </div>
    </div>
  );
}

function AgingTile({ label, sub, value, ok, warn, danger }: { label: string; sub: string; value: string; ok?: boolean; warn?: boolean; danger?: boolean }) {
  const cls = danger ? 'data-tile data-tile--danger' : warn ? 'data-tile data-tile--warning' : ok ? 'data-tile data-tile--ok' : 'data-tile';
  return (
    <div className={cls}>
      <div className="data-tile__label">{label}</div>
      <div className="data-tile__value" style={{ fontSize: '0.95rem' }}>{value}</div>
      <div className="data-tile__hint">{sub}</div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, desc }: { href: string; icon: typeof Wallet; title: string; desc: string }) {
  return (
    <Link href={href} className="dash-card" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none' }}>
      <div className="icon-box-lg" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
        <Icon className="w-4 h-4" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 2 }}>{title}</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
    </Link>
  );
}
