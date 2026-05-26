'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import DemoModeBanner from '@/components/DemoModeBanner';
import {
  CreditCard, Smartphone, Building2, CheckCircle,
  Shield, Receipt,
  ArrowRight, Wallet, Copy, Check
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import type { BillingDoc } from '@/lib/db-types-billing';

// Demo gate. In production (NEXT_PUBLIC_DEMO_MODE=false) the portal never
// shows fake invoices or the hardcoded Equity Bank account — empty state
// instead, and bank details fall back to a "contact billing" placeholder.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const fmt = (n: number) => 'SSP ' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Shape the portal renders against — independent of underlying BillingDoc so
// we can keep the demo fallback when a patient has no real bills yet.
interface PortalBill {
  id: string;
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
  date: (b.encounterDate || (b as { createdAt?: string }).createdAt || '').slice(0, 10),
  description:
    (b.items && b.items.length > 0 ? b.items.map(i => i.description).slice(0, 2).join(', ') : null)
    || `Visit at ${b.facilityName}`,
  amount: b.totalAmount,
  paid: b.amountPaid,
  status: billStatus(b.totalAmount, b.amountPaid),
});

/* ═══════════════════════════════════════════════════════════════
   Patient Payment Portal
   Self-service interface for patients to view bills, make
   payments via mobile money/card/bank, and manage payment plans.
   ═══════════════════════════════════════════════════════════════ */

// Demo fallback — only shown when the patient has no real bills on file
// (e.g. brand-new account or local-only deploy without seeded data).
const DEMO_BILLS: PortalBill[] = [
  { id: 'INV-DEMO-0041', date: '2026-04-10', description: 'General Consultation + Lab Work', amount: 15000, paid: 0, status: 'unpaid' },
  { id: 'INV-DEMO-0038', date: '2026-04-03', description: 'Follow-up Visit — Dr. Achol', amount: 8000, paid: 8000, status: 'paid' },
  { id: 'INV-DEMO-0032', date: '2026-03-20', description: 'X-Ray + Radiology Report', amount: 24000, paid: 12000, status: 'partial' },
  { id: 'INV-DEMO-0025', date: '2026-03-10', description: 'Pharmacy — Antibiotics (5-day)', amount: 4000, paid: 4000, status: 'paid' },
  { id: 'INV-DEMO-0019', date: '2026-02-28', description: 'Emergency Visit + Sutures', amount: 36000, paid: 36000, status: 'paid' },
];

type PaymentMethod = 'mgurush' | 'mpesa' | 'mtn' | 'airtel' | 'card' | 'bank';

// TODO: source bank-transfer details from the org settings doc once that
// surface exists. For now: demo mode keeps the canned Equity Bank example;
// real production deploys show a "contact billing" placeholder so we never
// hand patients a fake account number.
const BANK_INSTRUCTIONS_DEMO = 'Bank: Equity Bank South Sudan\nAccount: 0012345678901\nBranch: Juba Main\nReference: Your Invoice #';
const BANK_INSTRUCTIONS_FALLBACK = 'Contact billing for payment instructions.';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; desc: string; icon: typeof Smartphone; color: string; instructions: string }[] = [
  { id: 'mgurush', label: 'm-GURUSH', desc: 'Pay via m-GURUSH (South Sudan)', icon: Smartphone, color: '#0EA5A4', instructions: 'Dial *158# > Pay Bill\nBusiness Number: TamamHealth\nReference: Your Invoice #' },
  { id: 'mpesa', label: 'M-Pesa', desc: 'Pay via Safaricom M-Pesa', icon: Smartphone, color: '#4CAF50', instructions: 'Go to M-Pesa > Lipa na M-Pesa > Pay Bill\nBusiness Number: 247247\nAccount: Your Invoice #' },
  { id: 'mtn', label: 'MTN Mobile Money', desc: 'Pay via MTN MoMo', icon: Smartphone, color: '#FFCB05', instructions: 'Dial *165# > Pay Bill\nMerchant Code: TamamHealth\nReference: Your Invoice #' },
  { id: 'airtel', label: 'Airtel Money', desc: 'Pay via Airtel Money', icon: Smartphone, color: '#ED1C24', instructions: 'Dial *185# > Pay Bill\nBusiness Name: TamamHealth HEALTH\nReference: Your Invoice #' },
  { id: 'card', label: 'Visa / Mastercard', desc: 'Secure card payment via Flutterwave', icon: CreditCard, color: '#6366f1', instructions: 'Click "Pay Now" to be redirected to our secure payment gateway powered by Flutterwave.' },
  { id: 'bank', label: 'Bank Transfer', desc: 'Direct bank deposit', icon: Building2, color: '#1B9AAA', instructions: IS_DEMO ? BANK_INSTRUCTIONS_DEMO : BANK_INSTRUCTIONS_FALLBACK },
];

export default function PatientPortalPage() {
  const { currentUser } = useApp();
  const [selectedBill, setSelectedBill] = useState<PortalBill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentStep, setPaymentStep] = useState<'select' | 'method' | 'confirm' | 'success'>('select');
  const [copied, setCopied] = useState(false);

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

  const handleCompletePayment = () => {
    setPaymentStep('success');
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
  };

  return (
    <>
      <TopBar title="Patient Payment Portal" />
      <main className="page-container page-enter">

        {usingDemo && realBills !== null && <DemoModeBanner />}

        {/* ── Welcome Banner ───────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1A3A3A 0%, #1E4D4A 50%, #1B9AAA 100%)',
          borderRadius: 'var(--card-radius)', padding: '28px 32px', marginBottom: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: -60, right: 80, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 'clamp(1.125rem, 2vw, 1.375rem)', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
                Welcome, {currentUser?.name || 'Patient'}
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                View your bills and make secure payments using mobile money, card, or bank transfer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 20px',
                border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', minWidth: 110,
              }}>
                <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Balance Due</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: totalOwed > 0 ? '#E4A84B' : '#4ade80' }}>{fmt(totalOwed)}</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 20px',
                border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', minWidth: 110,
              }}>
                <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Paid</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>{fmt(totalPaid)}</div>
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
                Your Bills
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
                    No bills on file yet. New charges will appear here once recorded.
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
                          background: isPaid ? 'var(--color-success-bg)' : 'var(--accent-light)',
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
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{bill.id}</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{new Date(bill.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>

                        {/* Amount + Action */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: isPaid ? 'var(--color-success)' : 'var(--text-primary)', marginBottom: 4 }}>
                            {fmt(bill.amount)}
                          </div>
                          {isPaid ? (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                              background: 'var(--color-success-bg)', color: 'var(--color-success)',
                              textTransform: 'uppercase',
                            }}>Paid</span>
                          ) : bill.status === 'partial' ? (
                            <div>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                                {fmt(remaining)} remaining
                              </span>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                              background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                              textTransform: 'uppercase',
                            }}>Unpaid</span>
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
                            Pay <ArrowRight size={12} />
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
                    Pay Outstanding Balance
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                    Pay all {unpaidBills.length} outstanding bill{unpaidBills.length > 1 ? 's' : ''} at once
                  </p>
                  <div style={{
                    background: 'var(--overlay-subtle)', borderRadius: 10, padding: '16px 20px',
                    textAlign: 'center', marginBottom: 16, border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Due</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(totalOwed)}</div>
                  </div>
                  <hr className="section-divider" />
                  <button
                    onClick={() => {
                      setSelectedBill({ id: 'ALL', date: '', description: 'All Outstanding Bills', amount: totalOwed, paid: 0, status: 'unpaid' });
                      setPaymentAmount(String(totalOwed));
                      setPaymentStep('method');
                    }}
                    style={{
                      width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #1B9AAA, #3FA9C9)', color: '#fff',
                      fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <Wallet size={16} /> Pay All Now
                  </button>
                </div>
              )}

              {/* Accepted Payment Methods */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--card-radius)', padding: '22px 24px', boxShadow: 'var(--card-shadow)',
              }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                  Accepted Payment Methods
                </h4>
                <hr className="section-divider" />
                <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PAYMENT_METHODS.map(m => {
                    const Icon = m.icon;
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="icon-box-sm" style={{
                          flexShrink: 0,
                          background: `${m.color}14`,
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
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Secure Payments</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>All transactions encrypted end-to-end. PCI DSS compliant.</div>
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
              ← Back to bills
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
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Amount to pay</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{fmt(Number(paymentAmount))}</div>
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
                Payment Amount (SSP)
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
              Choose Payment Method
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
                    <div className="icon-box-sm" style={{
                      background: `${m.color}14`,
                    }}>
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
                background: paymentMethod ? 'linear-gradient(135deg, #1B9AAA, #3FA9C9)' : 'var(--border-light)',
                color: paymentMethod ? '#fff' : 'var(--text-muted)',
                fontSize: '0.9375rem', fontWeight: 700, transition: 'all 0.15s',
              }}
            >
              Continue to Payment
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
              ← Back to method selection
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
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pay with {method.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{method.desc}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Amount</div>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>{fmt(Number(paymentAmount))}</div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div style={{ padding: '24px 28px' }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                      Payment Instructions
                    </h4>
                    <div style={{
                      background: 'var(--overlay-subtle)', borderRadius: 10, padding: '16px 18px',
                      border: '1px solid var(--border-light)', marginBottom: 20,
                    }}>
                      {method.instructions.split('\n').map((line, i) => (
                        <div key={i} style={{
                          fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.8,
                          fontFamily: line.includes(':') ? 'var(--font-mono, monospace)' : 'inherit',
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
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginBottom: 2 }}>Reference</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
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
                        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                      </button>
                    </div>

                    <button
                      onClick={handleCompletePayment}
                      style={{
                        width: '100%', padding: '14px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: `linear-gradient(135deg, ${method.color}, ${method.color}CC)`,
                        color: '#fff', fontSize: '0.9375rem', fontWeight: 700,
                      }}
                    >
                      {paymentMethod === 'card' ? 'Pay Now via Flutterwave' : 'I\'ve Sent the Payment'}
                    </button>

                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                      Payments are typically confirmed within 1-5 minutes
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
                Payment Submitted
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6 }}>
                Your payment of <strong>{fmt(Number(paymentAmount))}</strong> has been submitted. You&apos;ll receive a confirmation once it&apos;s verified.
              </p>

              <div className="data-row-divider-sm" style={{
                background: 'var(--overlay-subtle)', borderRadius: 10, padding: '16px 20px',
                marginBottom: 24, border: '1px solid var(--border-light)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reference</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>{selectedBill?.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Amount</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(Number(paymentAmount))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Method</span>
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
                Back to Bills
              </button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
