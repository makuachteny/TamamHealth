'use client';

import { useState, useEffect, useMemo } from 'react';
import TopBar from '@/components/TopBar';
import DemoModeBanner from '@/components/DemoModeBanner';
import {
  CreditCard, Smartphone, Building2, CheckCircle,
  Shield, Receipt,
  ArrowRight, Wallet, Copy, Check, Loader2, AlertCircle
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { BillingDoc } from '@/lib/db-types-billing';
import type { PaymentMethodType, PaymentStatus } from '@/lib/db-types-payments';
import { formatMoney } from '@/lib/format-utils';

// Demo gate. In production (NEXT_PUBLIC_DEMO_MODE=false) the portal never
// shows fake invoices or the hardcoded Equity Bank account — empty state
// instead, and bank details fall back to a "contact billing" placeholder.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

// Shape the portal renders against — independent of underlying BillingDoc so
// we can keep the demo fallback when a patient has no real bills yet.
// Carries patientId/patientName/facilityId/currency through from the source
// BillingDoc — currentUser here is the *staff* member running this
// assisted-portal flow (see role-routes.ts: only cashier/medical_biller can
// reach /payments/portal), never the patient, so a recorded payment MUST be
// attributed using the bill's own patient/facility, not currentUser.
interface PortalBill {
  id: string;
  patientId: string;
  patientName: string;
  facilityId?: string;
  currency?: string;
  date: string;
  description: string;
  amount: number;
  paid: number;
  status: 'unpaid' | 'partial' | 'paid';
}

const billStatus = (totalAmount: number, paid: number): PortalBill['status'] =>
  paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

const fromBillingDoc = (b: BillingDoc): PortalBill => ({
  id: b.invoiceNumber || b._id,
  patientId: b.patientId,
  patientName: b.patientName,
  facilityId: b.facilityId,
  currency: b.currency,
  date: (b.encounterDate || (b as { createdAt?: string }).createdAt || '').slice(0, 10),
  description:
    (b.items && b.items.length > 0 ? b.items.map(i => i.description).slice(0, 2).join(', ') : null)
    || `Visit at ${b.facilityName}`,
  amount: b.totalAmount,
  paid: b.amountPaid,
  status: billStatus(b.totalAmount, b.amountPaid),
});

// Demo bills have no real patient behind them — tag them with a stable,
// clearly-demo patient id/name so a "recorded" demo payment never gets
// silently attributed to a real person.
const DEMO_PATIENT_ID = 'demo-patient-portal';
const DEMO_PATIENT_NAME = 'Demo Patient';

/* ═══════════════════════════════════════════════════════════════
   Patient Payment Portal
   Self-service interface for patients to view bills, make
   payments via mobile money/card/bank, and manage payment plans.
   ═══════════════════════════════════════════════════════════════ */

// Demo fallback — only shown when the patient has no real bills on file
// (e.g. brand-new account or local-only deploy without seeded data).
const DEMO_BILLS: PortalBill[] = [
  { id: 'INV-DEMO-0041', patientId: DEMO_PATIENT_ID, patientName: DEMO_PATIENT_NAME, date: '2026-04-10', description: 'General Consultation + Lab Work', amount: 15000, paid: 0, status: 'unpaid' },
  { id: 'INV-DEMO-0038', patientId: DEMO_PATIENT_ID, patientName: DEMO_PATIENT_NAME, date: '2026-04-03', description: 'Follow-up Visit — Dr. Achol', amount: 8000, paid: 8000, status: 'paid' },
  { id: 'INV-DEMO-0032', patientId: DEMO_PATIENT_ID, patientName: DEMO_PATIENT_NAME, date: '2026-03-20', description: 'X-Ray + Radiology Report', amount: 24000, paid: 12000, status: 'partial' },
  { id: 'INV-DEMO-0025', patientId: DEMO_PATIENT_ID, patientName: DEMO_PATIENT_NAME, date: '2026-03-10', description: 'Pharmacy — Antibiotics (5-day)', amount: 4000, paid: 4000, status: 'paid' },
  { id: 'INV-DEMO-0019', patientId: DEMO_PATIENT_ID, patientName: DEMO_PATIENT_NAME, date: '2026-02-28', description: 'Emergency Visit + Sutures', amount: 36000, paid: 36000, status: 'paid' },
];

type PaymentMethod = 'mgurush' | 'mpesa' | 'mtn' | 'airtel' | 'card' | 'bank';

// There is no live payment-gateway integration wired up for this portal (no
// Flutterwave/M-Pesa/Airtel redirect or webhook exists for it) — every method
// here is recorded as a `pending` PaymentDoc awaiting finance verification,
// exactly like the pay-by-link (`/api/checkout`) and patient-token
// (`/api/patient-portal/payments`) flows do. This map only translates the
// portal's UI method keys onto the canonical PaymentMethodType union so the
// recorded payment is reconcilable with the rest of the system.
const METHOD_TO_PAYMENT_TYPE: Record<PaymentMethod, PaymentMethodType> = {
  mgurush: 'm_gurush',
  mpesa: 'mpesa',
  mtn: 'mtn_momo',
  airtel: 'airtel',
  card: 'card',
  bank: 'bank_transfer',
};

// Bank-transfer instructions are sourced from the org's `bankDetails` settings
// field (set by the org admin on the branding page). When the org hasn't filled
// it in, real production deploys show a "contact billing" placeholder so we
// never hand patients a fake account number; demo mode keeps a canned Equity
// Bank example so the flow still has something to show.
const BANK_INSTRUCTIONS_DEMO = 'Bank: Equity Bank South Sudan\nAccount: 0012345678901\nBranch: Juba Main\nReference: Your Invoice #';
const BANK_INSTRUCTIONS_FALLBACK = 'Contact billing for payment instructions.';

const resolveBankInstructions = (bankDetails?: string): string =>
  (bankDetails && bankDetails.trim())
    ? bankDetails.trim()
    : (IS_DEMO ? BANK_INSTRUCTIONS_DEMO : BANK_INSTRUCTIONS_FALLBACK);

type PaymentMethodDef = { id: PaymentMethod; label: string; desc: string; icon: typeof Smartphone; color: string; instructions: string };

const buildPaymentMethods = (bankDetails?: string): PaymentMethodDef[] => [
  { id: 'mgurush', label: 'm-GURUSH', desc: 'Pay via m-GURUSH (South Sudan)', icon: Smartphone, color: '#0EA5A4', instructions: 'Dial *158# > Pay Bill\nBusiness Number: TamamHealth\nReference: Your Invoice #' },
  { id: 'mpesa', label: 'M-Pesa', desc: 'Pay via Safaricom M-Pesa', icon: Smartphone, color: '#4CAF50', instructions: 'Go to M-Pesa > Lipa na M-Pesa > Pay Bill\nBusiness Number: 247247\nAccount: Your Invoice #' },
  { id: 'mtn', label: 'MTN Mobile Money', desc: 'Pay via MTN MoMo', icon: Smartphone, color: '#FFCB05', instructions: 'Dial *165# > Pay Bill\nMerchant Code: TamamHealth\nReference: Your Invoice #' },
  { id: 'airtel', label: 'Airtel Money', desc: 'Pay via Airtel Money', icon: Smartphone, color: '#ED1C24', instructions: 'Dial *185# > Pay Bill\nBusiness Name: TamamHealth HEALTH\nReference: Your Invoice #' },
  { id: 'card', label: 'Visa / Mastercard', desc: 'Card payment (manually verified)', icon: CreditCard, color: '#6366f1', instructions: 'Enter your card details with our billing team, or provide a transaction reference. The charge is recorded here and verified by finance before it posts.' },
  { id: 'bank', label: 'Bank Transfer', desc: 'Direct bank deposit', icon: Building2, color: 'var(--accent-primary)', instructions: resolveBankInstructions(bankDetails) },
];

export default function PatientPortalPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const [selectedBill, setSelectedBill] = useState<PortalBill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentStep, setPaymentStep] = useState<'select' | 'method' | 'confirm' | 'success'>('select');
  const [copied, setCopied] = useState(false);
  // Persisting the payment (writing the PouchDB doc) before we can show the
  // success step — surface a spinner + a real error if the write fails.
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [completedReference, setCompletedReference] = useState('');

  // Bank-transfer instructions come from the org's configured bankDetails
  // (set on the org-admin branding page). Falls back to a "contact billing"
  // placeholder (or the demo example under IS_DEMO) when unset.
  const orgBankDetails = currentUser?.organization?.bankDetails;
  const PAYMENT_METHODS = useMemo(() => buildPaymentMethods(orgBankDetails), [orgBankDetails]);

  // Load real bills for the signed-in patient. Falls back to demo data when
  // the patient has no charges on file so the portal still has something
  // useful to show.
  const [realBills, setRealBills] = useState<PortalBill[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const patientId = (currentUser as { patientId?: string; _id?: string } | null)?.patientId
      || (currentUser as { _id?: string } | null)?._id;
    if (!patientId) { setRealBills([]); return; }
    (async () => {
      try {
        const { getBillsByPatient } = await import('@/lib/services/billing-service');
        const docs = await getBillsByPatient(patientId);
        if (cancelled) return;
        const sorted = docs
          .map(fromBillingDoc)
          .sort((a, b) => b.date.localeCompare(a.date));
        setRealBills(sorted);
      } catch (err) {
        console.error('[PatientPortal] Failed to load bills', err);
        if (!cancelled) setRealBills([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Use real bills when present; in demo mode fall back to canned invoices
  // so the portal still has something to show. In production we render an
  // empty state instead of fake bills.
  const usingDemo = IS_DEMO && (!realBills || realBills.length === 0);
  const bills: PortalBill[] = realBills && realBills.length > 0
    ? realBills
    : (IS_DEMO ? DEMO_BILLS : []);

  const totalOwed = bills.reduce((sum, b) => sum + (b.amount - b.paid), 0);
  const totalPaid = bills.reduce((sum, b) => sum + b.paid, 0);
  const unpaidBills = bills.filter(b => b.status !== 'paid');

  const handlePayBill = (bill: PortalBill) => {
    setSelectedBill(bill);
    setPaymentAmount(String(bill.amount - bill.paid));
    setPaymentStep('method');
    setPaymentMethod(null);
  };

  const handleConfirmPayment = () => {
    // Guard against zero / negative / non-numeric / over-balance amounts. The
    // input is a free-form number field — without this the patient could
    // submit a SSP 0 receipt or an amount larger than what's owed.
    const numericAmount = Number(paymentAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    if (selectedBill && numericAmount > selectedBill.amount - selectedBill.paid + 0.001) return;
    setPaymentStep('confirm');
  };

  const handleCompletePayment = async () => {
    if (!selectedBill || !paymentMethod || completing) return;
    const numericAmount = Number(paymentAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setCompleteError('Enter a valid amount before continuing.');
      return;
    }
    if (!selectedBill.patientId) {
      setCompleteError('Unable to identify the patient for this bill — please reopen it from the bill list.');
      return;
    }

    setCompleting(true);
    setCompleteError('');
    try {
      // No live payment-gateway (Flutterwave/M-Pesa/Airtel) redirect or
      // webhook is wired up for this portal, so we can't claim the money has
      // actually arrived. Every method here writes a `pending` PaymentDoc —
      // the same shape/semantics the pay-by-link (`/api/checkout`) and
      // patient-token (`/api/patient-portal/payments`) routes already use —
      // and finance must approve it (Payments page → Pending verification)
      // before it posts. This mirrors those routes rather than calling
      // `collectPayment` (which posts immediately), since we have no
      // confirmation that funds actually moved.
      const { paymentsDB } = await import('@/lib/db');
      const db = paymentsDB();
      const now = new Date().toISOString();
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const reference = `PORTAL-${uuid.slice(0, 8).toUpperCase()}`;

      const doc = {
        _id: `pmt-${uuid.slice(0, 10)}`,
        type: 'payment' as const,
        patientId: selectedBill.patientId,
        patientName: selectedBill.patientName || currentUser?.name || t('portal.patient'),
        method: METHOD_TO_PAYMENT_TYPE[paymentMethod],
        amount: numericAmount,
        currency: selectedBill.currency || 'SSP',
        reference,
        status: 'pending' as PaymentStatus,
        processedAt: now,
        processedBy: currentUser?._id || 'patient-portal',
        processedByName: currentUser?.name || 'Patient portal',
        notes: `[PATIENT_PORTAL] pending_verification — awaiting finance approval. Invoice ${selectedBill.id}.`,
        facilityId: selectedBill.facilityId || currentUser?.hospitalId || '',
        orgId: currentUser?.orgId,
        createdAt: now,
        updatedAt: now,
        createdBy: currentUser?._id || 'patient-portal',
      };

      const resp = await db.put(doc);

      const { logAuditSafe } = await import('@/lib/services/audit-service');
      await logAuditSafe(
        'PATIENT_SUBMIT_PAYMENT', doc.processedBy, doc.processedByName,
        `Portal payment ${doc._id} for ${doc.amount} ${doc.currency} from ${doc.patientName} (ref: ${reference}, pending finance approval)`
      );

      const { emitSyncEvent } = await import('@/lib/services/sync-event-service');
      emitSyncEvent({
        resourceType: 'payment',
        resourceId: doc._id,
        operation: 'create',
        resourceVersion: resp.rev,
        orgId: doc.orgId,
        hospitalId: doc.facilityId,
      });

      setCompletedReference(reference);
      setPaymentStep('success');
    } catch (err) {
      console.error('[PatientPortal] Failed to record payment', err);
      setCompleteError('Could not record the payment. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const handleCopyRef = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetPayment = () => {
    setSelectedBill(null);
    setPaymentMethod(null);
    setPaymentAmount('');
    setPaymentStep('select');
    setCompleteError('');
    setCompletedReference('');
  };

  return (
    <>
      <TopBar title={t('portal.title')} />
      <main className="page-container page-enter">

        {usingDemo && realBills !== null && <DemoModeBanner />}

        {/* ── Welcome Banner ───────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #015697 0%, #015697 50%, #2191D0 100%)',
          borderRadius: 'var(--card-radius)', padding: '28px 32px', marginBottom: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: -60, right: 80, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 'clamp(1.125rem, 2vw, 1.375rem)', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
                {t('portal.welcome', { name: currentUser?.name || t('portal.patient') })}
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                {t('portal.welcomeSubtitle')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 20px',
                border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', minWidth: 110,
              }}>
                <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('billing.colBalanceDue')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: totalOwed > 0 ? 'var(--color-warning-400)' : '#4ade80' }}>{formatMoney(totalOwed)}</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 20px',
                border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', minWidth: 110,
              }}>
                <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('portal.totalPaid')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>{formatMoney(totalPaid)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {paymentStep === 'select' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
            {/* Bills List */}
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                {t('portal.yourBills')}
              </h3>
              <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bills.length === 0 && realBills !== null && (
                  <div
                    style={{
                      padding: '32px 20px',
                      borderRadius: 'var(--card-radius)',
                      background: 'var(--bg-card)',
                      border: '1px dashed var(--border-medium)',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      fontSize: 13,
                    }}
                  >
                    {t('portal.noBills')}
                  </div>
                )}
                {bills.map(bill => {
                  const remaining = bill.amount - bill.paid;
                  const isPaid = bill.status === 'paid';
                  return (
                    <div key={bill.id} style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                      borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)',
                      overflow: 'hidden',
                    }}>
                      {/* Colored indicator */}
                      <div style={{
                        height: 3,
                        background: isPaid ? 'var(--color-success)' : bill.status === 'partial' ? 'var(--color-warning)' : 'var(--color-danger)',
                      }} />
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        {/* Icon */}
                        <div className="icon-box-sm" style={{
                          flexShrink: 0,
                        }}>
                          {isPaid
                            ? <CheckCircle size={34} style={{ color: 'var(--color-success)' }} />
                            : <Receipt size={34} style={{ color: 'var(--accent-primary)' }} />
                          }
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{bill.description}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-platform-mono)' }}>{bill.id}</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{new Date(bill.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>

                        {/* Amount + Action */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: isPaid ? 'var(--color-success)' : 'var(--text-primary)', marginBottom: 4 }}>
                            {formatMoney(bill.amount)}
                          </div>
                          {isPaid ? (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                              background: 'var(--color-success-bg)', color: 'var(--color-success)',
                              textTransform: 'uppercase',
                            }}>{t('telehealth.payment_paid')}</span>
                          ) : bill.status === 'partial' ? (
                            <div>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                                {t('portal.remaining', { amount: formatMoney(remaining) })}
                              </span>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                              background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                              textTransform: 'uppercase',
                            }}>{t('portal.unpaid')}</span>
                          )}
                        </div>

                        {/* Pay button */}
                        {!isPaid && (
                          <button
                            onClick={() => handlePayBill(bill)}
                            style={{
                              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                              background: 'var(--accent-primary)', color: '#fff',
                              fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                              transition: 'opacity 0.15s',
                            }}
                          >
                            {t('portal.pay')} <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Sidebar — Payment Summary + Quick Pay */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Quick Pay All */}
              {totalOwed > 0 && (
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: 'var(--card-radius)', padding: '22px 24px', boxShadow: 'var(--card-shadow)',
                }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                    {t('portal.payOutstandingBalance')}
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                    {unpaidBills.length > 1
                      ? t('portal.payAllBillsPlural', { count: unpaidBills.length })
                      : t('portal.payAllBills', { count: unpaidBills.length })}
                  </p>
                  <div style={{
                    background: 'var(--overlay-subtle)', borderRadius: 10, padding: '16px 20px',
                    textAlign: 'center', marginBottom: 16, border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('portal.totalDue')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatMoney(totalOwed)}</div>
                  </div>
                  <hr className="section-divider" />
                  <button
                    onClick={() => {
                      // All bills in this portal session belong to the same
                      // patient (they came from one getBillsByPatient query),
                      // so any unpaid bill's identity fields are representative.
                      const rep = unpaidBills[0] || bills[0];
                      setSelectedBill({
                        id: 'ALL',
                        patientId: rep?.patientId || '',
                        patientName: rep?.patientName || '',
                        facilityId: rep?.facilityId,
                        currency: rep?.currency,
                        date: '', description: t('portal.allOutstandingBills'), amount: totalOwed, paid: 0, status: 'unpaid',
                      });
                      setPaymentAmount(String(totalOwed));
                      setPaymentStep('method');
                    }}
                    style={{
                      width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #2191D0, #369FDA)', color: '#fff',
                      fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <Wallet size={16} /> {t('portal.payAllNow')}
                  </button>
                </div>
              )}

              {/* Accepted Payment Methods */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--card-radius)', padding: '22px 24px', boxShadow: 'var(--card-shadow)',
              }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                  {t('portal.acceptedPaymentMethods')}
                </h4>
                <hr className="section-divider" />
                <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PAYMENT_METHODS.map(m => {
                    const Icon = m.icon;
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="icon-box-sm" style={{
                          flexShrink: 0,
                        }}>
                          <Icon size={14} style={{ color: m.color }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security Badge */}
              <div style={{
                background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--card-radius)', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Shield size={34} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t('portal.securePayments')}</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{t('portal.securePaymentsDesc')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ PAYMENT METHOD SELECTION ══════════════ */}
        {paymentStep === 'method' && selectedBill && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <button onClick={resetPayment} style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20, padding: 0,
            }}>
              ← {t('portal.backToBills')}
            </button>

            {/* Bill summary card */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--card-radius)', padding: '20px 24px', marginBottom: 20,
              boxShadow: 'var(--card-shadow)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 4 }}>{selectedBill.id}</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedBill.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('portal.amountToPay')}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{formatMoney(Number(paymentAmount))}</div>
                </div>
              </div>
            </div>

            {/* Custom amount */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--card-radius)', padding: '16px 24px', marginBottom: 20,
              boxShadow: 'var(--card-shadow)',
            }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                {t('portal.paymentAmountSsp')}
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px', fontSize: '1.125rem', fontWeight: 700,
                  borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--overlay-subtle)',
                  color: 'var(--text-primary)', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Payment method cards */}
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>
              {t('portal.choosePaymentMethod')}
            </h3>
            <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {PAYMENT_METHODS.map(m => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '16px 20px', borderRadius: 'var(--card-radius)',
                      background: isSelected ? `${m.color}0A` : 'var(--bg-card)',
                      border: isSelected ? `2px solid ${m.color}` : '1px solid var(--border-light)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      boxShadow: isSelected ? `0 0 0 3px ${m.color}14` : 'var(--card-shadow)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="icon-box-sm">
                      <Icon size={16} style={{ color: m.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                    </div>
                    {isSelected && (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={12} color="#fff" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleConfirmPayment}
              disabled={!paymentMethod || !paymentAmount}
              style={{
                width: '100%', padding: '14px 24px', borderRadius: 10, border: 'none', cursor: paymentMethod ? 'pointer' : 'not-allowed',
                background: paymentMethod ? 'linear-gradient(135deg, #2191D0, #369FDA)' : 'var(--border-light)',
                color: paymentMethod ? '#fff' : 'var(--text-muted)',
                fontSize: '0.9375rem', fontWeight: 700, transition: 'all 0.15s',
              }}
            >
              {t('portal.continueToPayment')}
            </button>
          </div>
        )}

        {/* ══════════════ PAYMENT CONFIRMATION ══════════════ */}
        {paymentStep === 'confirm' && selectedBill && paymentMethod && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <button onClick={() => setPaymentStep('method')} style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20, padding: 0,
            }}>
              ← {t('portal.backToMethodSelection')}
            </button>

            {(() => {
              const method = PAYMENT_METHODS.find(m => m.id === paymentMethod)!;
              const Icon = method.icon;
              return (
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: 'var(--card-radius)', overflow: 'hidden', boxShadow: 'var(--card-shadow)',
                }}>
                  {/* Header */}
                  <div style={{
                    background: `${method.color}0A`, padding: '24px 28px',
                    borderBottom: `2px solid ${method.color}20`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: `${method.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={56} style={{ color: method.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('portal.payWith', { method: method.label })}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{method.desc}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{t('portal.amount')}</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatMoney(Number(paymentAmount))}</div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div style={{ padding: '24px 28px' }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                      {t('portal.paymentInstructions')}
                    </h4>
                    <div style={{
                      background: 'var(--overlay-subtle)', borderRadius: 10, padding: '16px 18px',
                      border: '1px solid var(--border-light)', marginBottom: 20,
                    }}>
                      {method.instructions.split('\n').map((line, i) => (
                        <div key={i} style={{
                          fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.8,
                          fontFamily: line.includes(':') ? 'var(--font-platform-mono)' : 'inherit',
                        }}>
                          {line}
                        </div>
                      ))}
                    </div>

                    <hr className="section-divider" />
                    {/* Reference to copy */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--overlay-subtle)', borderRadius: 8, padding: '10px 14px',
                      border: '1px solid var(--border-light)', marginBottom: 24,
                    }}>
                      <div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 2 }}>{t('lab.reference')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-platform-mono)' }}>
                          {selectedBill.id}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopyRef(selectedBill.id)}
                        style={{
                          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                          borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: '0.6875rem', fontWeight: 600, color: copied ? 'var(--color-success)' : 'var(--text-secondary)',
                        }}
                      >
                        {copied ? <><Check size={12} /> {t('portal.copied')}</> : <><Copy size={12} /> {t('portal.copy')}</>}
                      </button>
                    </div>

                    {completeError && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-500)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                      }}>
                        <AlertCircle size={16} style={{ color: 'var(--color-danger-500)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger-text)' }}>{completeError}</span>
                      </div>
                    )}

                    <button
                      onClick={handleCompletePayment}
                      disabled={completing}
                      style={{
                        width: '100%', padding: '14px 24px', borderRadius: 10, border: 'none',
                        cursor: completing ? 'not-allowed' : 'pointer',
                        background: `linear-gradient(135deg, ${method.color}, ${method.color}CC)`,
                        color: '#fff', fontSize: '0.9375rem', fontWeight: 700, opacity: completing ? 0.75 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      {completing && <Loader2 size={16} className="animate-spin" />}
                      {completing
                        ? 'Recording…'
                        : (paymentMethod === 'card' ? 'Record card payment (pending verification)' : t('portal.sentPayment'))}
                    </button>

                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                      {t('portal.confirmTiming')}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════ SUCCESS ══════════════ */}
        {paymentStep === 'success' && (
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--card-radius)', padding: '48px 40px', boxShadow: 'var(--card-shadow)',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
                background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle size={44} style={{ color: 'var(--color-success)' }} />
              </div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                {t('portal.paymentSubmitted')}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
                {t('portal.paymentSubmittedDescPre')}<strong>{formatMoney(Number(paymentAmount))}</strong>{t('portal.paymentSubmittedDescPost')}
              </p>

              <div className="data-row-divider-sm" style={{
                background: 'var(--overlay-subtle)', borderRadius: 10, padding: '16px 20px',
                marginBottom: 24, border: '1px solid var(--border-light)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('lab.reference')}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-platform-mono)' }}>{selectedBill?.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('portal.amount')}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatMoney(Number(paymentAmount))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('portal.method')}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}
                  </span>
                </div>
              </div>

              <button
                onClick={resetPayment}
                style={{
                  padding: '12px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'var(--accent-primary)', color: '#fff',
                  fontSize: '0.875rem', fontWeight: 700,
                }}
              >
                {t('portal.backToBillsBtn')}
              </button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
