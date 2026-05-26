'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, CreditCard, CalendarClock, DollarSign,
  Shield, FileText, Clock,
  Receipt, AlertTriangle, CheckCircle, Printer, BarChart3,
} from '@/components/icons/lucide';
import { BalanceBanner, InsuranceSnapshot, PaymentHistoryTimeline, PaymentPanel, PaymentPlanWizard } from '@/components/payments';
import { getMethodConfig } from '@/lib/payment-method-config';
import type { PatientDoc } from '@/lib/db-types';
import type { PaymentDoc, ChargeDoc, PaymentPlanDoc, ClaimDoc, InsurancePolicyDoc } from '@/lib/db-types-payments';

interface BillingTabProps {
  patient: PatientDoc;
  patientBalance: number;
  showPaymentPanel: boolean;
  showPlanWizard: boolean;
  setShowPaymentPanel: (v: boolean) => void;
  setShowPlanWizard: (v: boolean) => void;
  reloadPayments: () => void;
}

interface FinancialOverview {
  totalCharged: number;
  totalPaid: number;
  insurancePaid: number;
  selfPaid: number;
  outstanding: number;
  payments: PaymentDoc[];
  charges: ChargeDoc[];
  plans: PaymentPlanDoc[];
  claims: ClaimDoc[];
  policies: InsurancePolicyDoc[];
}

const fmt = (n: number) => `SSP ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function BillingTab({
  patient, patientBalance, showPaymentPanel, showPlanWizard,
  setShowPaymentPanel, setShowPlanWizard, reloadPayments,
}: BillingTabProps) {
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [paymentSvc] = await Promise.all([
        import('@/lib/services/payment-service'),
        import('@/lib/services/ledger-service'),
      ]);

      const [payments, charges, plans, claims, policies] = await Promise.all([
        paymentSvc.getPaymentsByPatient(patient._id),
        paymentSvc.getChargesByPatient(patient._id).catch(() => [] as ChargeDoc[]),
        paymentSvc.getPaymentPlansByPatient(patient._id),
        paymentSvc.getClaimsByPatient?.(patient._id).catch(() => [] as ClaimDoc[]) ?? Promise.resolve([] as ClaimDoc[]),
        paymentSvc.getPatientInsurancePolicies(patient._id),
      ]);

      const totalCharged = charges.reduce((s: number, c: ChargeDoc) => s + c.billedAmount, 0);
      const postedPayments = payments.filter((p: PaymentDoc) => p.status === 'posted');
      const totalPaid = postedPayments.reduce((s: number, p: PaymentDoc) => s + p.amount, 0);
      const insurancePaid = postedPayments
        .filter((p: PaymentDoc) => p.method === 'insurance')
        .reduce((s: number, p: PaymentDoc) => s + p.amount, 0);
      const selfPaid = totalPaid - insurancePaid;

      setData({
        totalCharged,
        totalPaid,
        insurancePaid,
        selfPaid,
        outstanding: Math.max(0, patientBalance),
        payments: postedPayments.sort((a: PaymentDoc, b: PaymentDoc) =>
          new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
        ),
        charges,
        plans,
        claims,
        policies,
      });
    } catch (err) {
      console.error('Failed to load billing data:', err);
      setData({
        totalCharged: 0, totalPaid: 0, insurancePaid: 0, selfPaid: 0,
        outstanding: Math.max(0, patientBalance),
        payments: [], charges: [], plans: [], claims: [], policies: [],
      });
    }
    setLoading(false);
  }, [patient._id, patientBalance]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-light)', borderTopColor: 'var(--accent-primary)' }} />
          Loading billing information...
        </div>
      </div>
    );
  }

  const d = data!;
  const activePlans = d.plans.filter(p => p.status === 'active');
  const hasInsurance = d.policies.length > 0;

  return (
    <div className="space-y-5">
      {/* ─── Balance Alert Banner ─── */}
      <BalanceBanner
        patientId={patient._id}
        onPayClick={() => setShowPaymentPanel(true)}
      />

      {/* ─── Financial Summary KPIs ─── */}
      <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'stretch' }}>
        {/* Total Charged */}
        <div className="card-elevated p-4" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--accent-light)' }}>
              <FileText size={44} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Billed</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(d.totalCharged)}</div>
            </div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="card-elevated p-4" style={{ borderLeft: '3px solid var(--color-success)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle size={44} style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Paid</div>
              <div className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{fmt(d.totalPaid)}</div>
            </div>
          </div>
        </div>

        {/* Insurance Paid */}
        <div className="card-elevated p-4" style={{ borderLeft: '3px solid var(--color-info)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
              <Shield size={44} style={{ color: 'var(--color-info)' }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Insurance Paid</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(d.insurancePaid)}</div>
            </div>
          </div>
        </div>

        {/* Outstanding */}
        <div className="card-elevated p-4" style={{ borderLeft: `3px solid ${d.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: d.outstanding > 0 ? 'var(--color-danger-bg)' : 'var(--color-success-bg)' }}>
              <DollarSign size={44} style={{ color: d.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Outstanding</div>
              <div className="text-lg font-bold" style={{ color: d.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {d.outstanding > 0 ? fmt(d.outstanding) : 'Paid in Full'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setShowPaymentPanel(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'var(--color-success)' }}
        >
          <Wallet size={16} /> Collect Payment
        </button>
        <button
          onClick={() => setShowPlanWizard(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
        >
          <CalendarClock size={16} /> Create Payment Plan
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
        >
          <Printer size={16} /> Print Statement
        </button>
      </div>

      {/* ─── Two-Column: Insurance + Charges ─── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'stretch' }}>
        {/* Insurance Coverage */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
              Insurance Coverage
            </h3>
            {hasInsurance && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                ACTIVE
              </span>
            )}
          </div>
          <InsuranceSnapshot patientId={patient._id} editable />
        </div>

        {/* Recent Charges */}
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
            <Receipt size={16} style={{ color: 'var(--accent-primary)' }} />
            Recent Charges
            {d.charges.length > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
                {d.charges.length}
              </span>
            )}
          </h3>
          {d.charges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center" style={{ color: 'var(--text-muted)' }}>
              <Receipt size={44} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div className="text-xs">No charges recorded yet</div>
            </div>
          ) : (
            <div className="space-y-0">
              {d.charges.slice(0, 8).map(charge => (
                <div key={charge._id} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{charge.description}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {charge.category} &middot; {new Date(charge.serviceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(charge.billedAmount)}</div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: charge.status === 'approved' ? 'var(--color-success-bg)' : charge.status === 'pending' ? 'var(--color-warning-bg)' : 'var(--overlay-subtle)',
                      color: charge.status === 'approved' ? 'var(--color-success)' : charge.status === 'pending' ? 'var(--color-warning)' : 'var(--text-muted)',
                    }}>
                      {charge.status}
                    </span>
                  </div>
                </div>
              ))}
              {d.charges.length > 8 && (
                <div className="text-center pt-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                    +{d.charges.length - 8} more charges
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Active Payment Plans ─── */}
      {activePlans.length > 0 && (
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
            <CalendarClock size={16} style={{ color: 'var(--accent-primary)' }} />
            Active Payment Plans
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              {activePlans.length}
            </span>
          </h3>
          <div className="space-y-3">
            {activePlans.map(plan => {
              const progress = plan.totalBalance > 0 ? Math.min(100, (plan.paidToDate / plan.totalBalance) * 100) : 0;
              return (
                <div key={plan._id} className="rounded-xl p-4" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {plan.termMonths}-Month Plan
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {fmt(plan.monthlyAmount)}/month &middot; Started {new Date(plan.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                      background: plan.status === 'active' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                      color: plan.status === 'active' ? 'var(--color-success)' : 'var(--color-warning)',
                    }}>
                      {plan.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {fmt(plan.paidToDate)} of {fmt(plan.totalBalance)}
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--color-success)' }}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--color-success)' }} />
                    </div>
                  </div>

                  {/* Installment dots */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {plan.installments.map((inst, i) => (
                      <div
                        key={i}
                        className="w-2.5 h-2.5 rounded-full"
                        title={`#${inst.number}: ${inst.status} — ${fmt(inst.amount)}`}
                        style={{
                          background:
                            inst.status === 'paid' ? 'var(--color-success)' :
                            inst.status === 'missed' ? 'var(--color-danger)' :
                            inst.status === 'partial' ? 'var(--color-warning)' :
                            'var(--border-light)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Next due */}
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={11} />
                      Next due: {plan.nextDueDate ? new Date(plan.nextDueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                    </div>
                    <div className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Remaining: {fmt(plan.remainingBalance)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Claims Overview ─── */}
      {d.claims.length > 0 && (
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
            <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
            Insurance Claims
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
              {d.claims.length}
            </span>
          </h3>
          <div className="space-y-0">
            {d.claims.map(claim => (
              <div key={claim._id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{
                  background:
                    claim.status === 'paid' ? 'var(--color-success-bg)' :
                    claim.status === 'denied' ? 'var(--color-danger-bg)' :
                    'var(--color-warning-bg)',
                }}>
                  {claim.status === 'paid' ? <CheckCircle size={14} style={{ color: 'var(--color-success)' }} /> :
                   claim.status === 'denied' ? <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} /> :
                   <Clock size={14} style={{ color: 'var(--color-warning)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {claim.payerName}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {claim.claimNumber || claim._id.slice(0, 10)} &middot; {claim.submittedDate ? new Date(claim.submittedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Draft'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(claim.totalBilled)}</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                    background:
                      claim.status === 'paid' ? 'var(--color-success-bg)' :
                      claim.status === 'denied' ? 'var(--color-danger-bg)' :
                      claim.status === 'accepted' ? 'var(--color-info-bg)' :
                      'var(--color-warning-bg)',
                    color:
                      claim.status === 'paid' ? 'var(--color-success)' :
                      claim.status === 'denied' ? 'var(--color-danger)' :
                      claim.status === 'accepted' ? 'var(--color-info)' :
                      'var(--color-warning)',
                  }}>
                    {claim.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Payments (last 5) ─── */}
      {d.payments.length > 0 && (
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
            <CreditCard size={16} style={{ color: 'var(--accent-primary)' }} />
            Recent Payments
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
              {d.payments.length}
            </span>
          </h3>
          <div className="space-y-0">
            {d.payments.slice(0, 5).map(pmt => {
              const mc = getMethodConfig(pmt.method);
              const MethodIcon = mc.icon;
              return (
                <div key={pmt._id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: `${mc.color}15` }}>
                    <MethodIcon size={14} style={{ color: mc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{mc.label}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {pmt.reference || '—'} &middot; {new Date(pmt.processedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>{fmt(pmt.amount)}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pmt.processedByName}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Full Ledger History ─── */}
      <div className="card-elevated p-5">
        <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
          <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
          Transaction Ledger
        </h3>
        <PaymentHistoryTimeline patientId={patient._id} limit={30} />
      </div>

      {/* ─── Empty State (no billing data at all) ─── */}
      {d.totalCharged === 0 && d.payments.length === 0 && d.policies.length === 0 && (
        <div className="card-elevated p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: 'var(--overlay-subtle)' }}>
              <Wallet size={56} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            </div>
            <div>
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No billing records yet</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto' }}>
                This patient has no charges, payments, or insurance on file. Billing records are created automatically during encounters.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Payment Panel Modal ─── */}
      {showPaymentPanel && (
        <PaymentPanel
          patientId={patient._id}
          patientName={`${patient.firstName} ${patient.surname}`}
          amountDue={patientBalance}
          onSuccess={() => { setShowPaymentPanel(false); reloadPayments(); loadAll(); }}
          onCancel={() => setShowPaymentPanel(false)}
        />
      )}

      {/* ─── Plan Wizard Modal ─── */}
      {showPlanWizard && (
        <PaymentPlanWizard
          patientId={patient._id}
          patientName={`${patient.firstName} ${patient.surname}`}
          balance={patientBalance}
          encounterIds={[]}
          onComplete={() => { setShowPlanWizard(false); reloadPayments(); loadAll(); }}
          onCancel={() => setShowPlanWizard(false)}
        />
      )}
    </div>
  );
}
