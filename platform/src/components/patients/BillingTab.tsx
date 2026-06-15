'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, CreditCard, CalendarClock, DollarSign,
  Shield, FileText, Clock,
  Receipt, AlertTriangle, CheckCircle, Printer, BarChart3,
  Plus, Trash2, RotateCcw, RefreshCw, X,
} from '@/components/icons/lucide';
import { BalanceBanner, InsuranceSnapshot, PaymentHistoryTimeline, PaymentPanel, PaymentPlanWizard } from '@/components/payments';
import Modal from '@/components/Modal';
import { getMethodConfig } from '@/lib/payment-method-config';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import type { PatientDoc } from '@/lib/db-types';
import type {
  PaymentDoc, ChargeDoc, PaymentPlanDoc, ClaimDoc, InsurancePolicyDoc,
  SavedPaymentMethodDoc, SavedPaymentMethodType, AdjustmentType,
} from '@/lib/db-types-payments';

const SAVED_METHOD_TYPES: SavedPaymentMethodType[] = ['mpesa', 'airtel', 'mtn_momo', 'm_gurush', 'card', 'bank'];
const ADJUSTMENT_TYPES: AdjustmentType[] = ['write_off', 'bad_debt', 'charity', 'denial', 'contractual', 'correction'];
const BILLING_ROLES = ['cashier', 'biller', 'org_admin', 'medical_superintendent', 'super_admin'];
const METHOD_LABELS: Record<SavedPaymentMethodType, string> = {
  mpesa: 'M-Pesa', airtel: 'Airtel Money', mtn_momo: 'MTN MoMo', m_gurush: 'm-Gurush', card: 'Card', bank: 'Bank',
};
const MOBILE_MONEY_METHODS: SavedPaymentMethodType[] = ['mpesa', 'airtel', 'mtn_momo', 'm_gurush'];

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
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const patientName = `${patient.firstName} ${patient.surname}`;
  const canManageBilling = BILLING_ROLES.includes(currentUser?.role ?? '');
  const facilityId = currentUser?.hospitalId ?? '';
  const orgId = currentUser?.orgId;

  // ─── Saved payment methods ───
  const [methods, setMethods] = useState<SavedPaymentMethodDoc[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [methodForm, setMethodForm] = useState<{
    methodType: SavedPaymentMethodType;
    phoneNumber: string;
    cardLast4: string;
    cardBrand: string;
    bankName: string;
    bankAccountLast4: string;
    label: string;
    isDefault: boolean;
  }>({ methodType: 'mpesa', phoneNumber: '', cardLast4: '', cardBrand: '', bankName: '', bankAccountLast4: '', label: '', isDefault: false });
  const [savingMethod, setSavingMethod] = useState(false);

  const loadMethods = useCallback(async () => {
    setMethodsLoading(true);
    try {
      const svc = await import('@/lib/services/payment-service');
      const rows = await svc.getPatientPaymentMethods(patient._id);
      setMethods(rows);
    } catch (err) {
      console.error('Failed to load saved payment methods:', err);
      setMethods([]);
    }
    setMethodsLoading(false);
  }, [patient._id]);

  useEffect(() => { loadMethods(); }, [loadMethods]);

  const handleSaveMethod = async () => {
    if (!facilityId) { showToast(t('billing.noFacility') || 'No facility context', 'error'); return; }
    setSavingMethod(true);
    try {
      const svc = await import('@/lib/services/payment-service');
      const isMobile = MOBILE_MONEY_METHODS.includes(methodForm.methodType);
      const isCard = methodForm.methodType === 'card';
      const isBank = methodForm.methodType === 'bank';
      await svc.savePaymentMethod({
        patientId: patient._id,
        methodType: methodForm.methodType,
        phoneNumber: isMobile ? methodForm.phoneNumber.trim() || undefined : undefined,
        cardLast4: isCard ? methodForm.cardLast4.trim() || undefined : undefined,
        cardBrand: isCard ? methodForm.cardBrand.trim() || undefined : undefined,
        bankName: isBank ? methodForm.bankName.trim() || undefined : undefined,
        bankAccountLast4: isBank ? methodForm.bankAccountLast4.trim() || undefined : undefined,
        label: methodForm.label.trim() || undefined,
        isDefault: methodForm.isDefault,
        facilityId,
        orgId,
      });
      showToast(t('billing.methodSaved') || 'Payment method saved', 'success');
      setShowAddMethod(false);
      setMethodForm({ methodType: 'mpesa', phoneNumber: '', cardLast4: '', cardBrand: '', bankName: '', bankAccountLast4: '', label: '', isDefault: false });
      await loadMethods();
    } catch (err) {
      console.error('Failed to save payment method:', err);
      showToast(t('billing.methodSaveFailed') || 'Failed to save payment method', 'error');
    }
    setSavingMethod(false);
  };

  const handleDeleteMethod = async (id: string) => {
    if (!window.confirm(t('billing.confirmDeleteMethod') || 'Remove this saved payment method?')) return;
    try {
      const svc = await import('@/lib/services/payment-service');
      const ok = await svc.deletePaymentMethod(id);
      if (ok) {
        showToast(t('billing.methodDeleted') || 'Payment method removed', 'success');
        await loadMethods();
      } else {
        showToast(t('billing.methodDeleteFailed') || 'Failed to remove payment method', 'error');
      }
    } catch (err) {
      console.error('Failed to delete payment method:', err);
      showToast(t('billing.methodDeleteFailed') || 'Failed to remove payment method', 'error');
    }
  };

  // ─── Refund ───
  const [showRefund, setShowRefund] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  const refundablePayments = (data?.payments ?? []).filter(p => p.method !== 'insurance' && p.method !== 'waiver');
  const selectedRefundPayment = refundablePayments.find(p => p._id === refundPaymentId);

  const openRefund = () => {
    const first = refundablePayments[0];
    setRefundPaymentId(first?._id ?? '');
    setRefundAmount(first?.amount ?? 0);
    setRefundReason('');
    setShowRefund(true);
  };

  const handleRefundPaymentChange = (id: string) => {
    setRefundPaymentId(id);
    const p = refundablePayments.find(x => x._id === id);
    setRefundAmount(p?.amount ?? 0);
  };

  const handleIssueRefund = async () => {
    if (!selectedRefundPayment) { showToast(t('billing.selectPayment') || 'Select a payment to refund', 'error'); return; }
    if (!refundReason.trim()) { showToast(t('billing.reasonRequired') || 'A reason is required', 'error'); return; }
    if (refundAmount <= 0 || refundAmount > selectedRefundPayment.amount) {
      showToast(t('billing.invalidRefundAmount') || 'Refund amount must be between 0 and the payment amount', 'error');
      return;
    }
    setProcessingRefund(true);
    try {
      const svc = await import('@/lib/services/payment-service');
      await svc.issueRefund({
        paymentId: selectedRefundPayment._id,
        patientId: patient._id,
        patientName,
        amount: refundAmount,
        currency: selectedRefundPayment.currency,
        method: selectedRefundPayment.method,
        reason: refundReason.trim(),
        processedBy: currentUser?._id ?? '',
        processedByName: currentUser?.name ?? '',
        facilityId,
        orgId,
      });
      showToast(t('billing.refundIssued') || 'Refund issued', 'success');
      setShowRefund(false);
      reloadPayments();
      loadAll();
    } catch (err) {
      console.error('Failed to issue refund:', err);
      showToast(t('billing.refundFailed') || 'Failed to issue refund', 'error');
    }
    setProcessingRefund(false);
  };

  // ─── Adjustment / write-off ───
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjForm, setAdjForm] = useState<{ adjustmentType: AdjustmentType; amount: number; reason: string; reasonCode: string }>({
    adjustmentType: 'write_off', amount: 0, reason: '', reasonCode: '',
  });
  const [processingAdj, setProcessingAdj] = useState(false);

  const handleCreateAdjustment = async () => {
    if (!adjForm.reason.trim()) { showToast(t('billing.reasonRequired') || 'A reason is required', 'error'); return; }
    if (adjForm.amount <= 0) { showToast(t('billing.invalidAmount') || 'Enter a valid amount', 'error'); return; }
    setProcessingAdj(true);
    try {
      const svc = await import('@/lib/services/payment-service');
      await svc.createAdjustment({
        patientId: patient._id,
        adjustmentType: adjForm.adjustmentType,
        amount: adjForm.amount,
        reason: adjForm.reason.trim(),
        reasonCode: adjForm.reasonCode.trim() || undefined,
        approvedBy: currentUser?._id ?? '',
        approvedByName: currentUser?.name ?? '',
        facilityId,
        orgId,
      });
      showToast(t('billing.adjustmentCreated') || 'Adjustment recorded', 'success');
      setShowAdjustment(false);
      setAdjForm({ adjustmentType: 'write_off', amount: 0, reason: '', reasonCode: '' });
      reloadPayments();
      loadAll();
    } catch (err) {
      console.error('Failed to create adjustment:', err);
      showToast(t('billing.adjustmentFailed') || 'Failed to record adjustment', 'error');
    }
    setProcessingAdj(false);
  };

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
          {t('billing.loadingBillingInfo')}
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
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('billing.totalBilled')}</div>
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
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('billing.totalPaid')}</div>
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
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('billing.insurancePaid')}</div>
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
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('billing.kpiOutstanding')}</div>
              <div className="text-lg font-bold" style={{ color: d.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {d.outstanding > 0 ? fmt(d.outstanding) : t('billing.paidInFull')}
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
          <Wallet size={16} /> {t('billing.collectPayment')}
        </button>
        <button
          onClick={() => setShowPlanWizard(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
        >
          <CalendarClock size={16} /> {t('billing.createPaymentPlan')}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
        >
          <Printer size={16} /> {t('billing.printStatement')}
        </button>
        {canManageBilling && (
          <>
            <button
              onClick={openRefund}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
            >
              <RotateCcw size={16} /> {t('billing.issueRefund') || 'Issue refund'}
            </button>
            <button
              onClick={() => setShowAdjustment(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
            >
              <RefreshCw size={16} /> {t('billing.adjustmentWriteOff') || 'Adjustment / write-off'}
            </button>
          </>
        )}
      </div>

      {/* ─── Two-Column: Insurance + Charges ─── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'stretch' }}>
        {/* Insurance Coverage */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
              {t('billing.insuranceCoverage')}
            </h3>
            {hasInsurance && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                {t('billing.badgeActive')}
              </span>
            )}
          </div>
          <InsuranceSnapshot patientId={patient._id} editable />
        </div>

        {/* Recent Charges */}
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
            <Receipt size={16} style={{ color: 'var(--accent-primary)' }} />
            {t('billing.recentCharges')}
            {d.charges.length > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
                {d.charges.length}
              </span>
            )}
          </h3>
          {d.charges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center" style={{ color: 'var(--text-muted)' }}>
              <Receipt size={44} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div className="text-xs">{t('billing.noChargesRecorded')}</div>
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
                    {t('billing.moreCharges', { count: d.charges.length - 8 })}
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
            {t('billing.activePaymentPlans')}
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
                        {t('billing.monthPlan', { count: plan.termMonths })}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {t('billing.planMonthlyStarted', { amount: fmt(plan.monthlyAmount), date: new Date(plan.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) })}
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
                        {t('billing.paidOfTotal', { paid: fmt(plan.paidToDate), total: fmt(plan.totalBalance) })}
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
                      {t('billing.nextDue', { date: plan.nextDueDate ? new Date(plan.nextDueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—' })}
                    </div>
                    <div className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {t('billing.remaining', { amount: fmt(plan.remainingBalance) })}
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
            {t('billing.insuranceClaims')}
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
                    {claim.claimNumber || claim._id.slice(0, 10)} &middot; {claim.submittedDate ? new Date(claim.submittedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : t('billing.claimDraft')}
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
            {t('billing.recentPayments')}
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

      {/* ─── Saved Payment Methods ─── */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <CreditCard size={16} style={{ color: 'var(--accent-primary)' }} />
            {t('billing.savedPaymentMethods') || 'Saved payment methods'}
            {methods.length > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
                {methods.length}
              </span>
            )}
          </h3>
          <button
            onClick={() => setShowAddMethod(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
          >
            <Plus size={14} /> {t('billing.addMethod') || 'Add method'}
          </button>
        </div>
        {methodsLoading ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('common.loading') || 'Loading…'}</div>
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center" style={{ color: 'var(--text-muted)' }}>
            <CreditCard size={44} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div className="text-xs">{t('billing.noSavedMethods') || 'No saved payment methods'}</div>
          </div>
        ) : (
          <div className="space-y-0">
            {methods.map(m => {
              const detail = m.cardLast4 ? `•••• ${m.cardLast4}`
                : m.bankAccountLast4 ? `${m.bankName ?? ''} •••• ${m.bankAccountLast4}`.trim()
                : m.phoneNumber ?? '';
              return (
                <div key={m._id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--accent-light)' }}>
                    <CreditCard size={14} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      {m.label || METHOD_LABELS[m.methodType]}
                      {m.isDefault && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                          {t('billing.default') || 'Default'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {METHOD_LABELS[m.methodType]}{detail ? ` · ${detail}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMethod(m._id)}
                    aria-label={t('billing.removeMethod') || 'Remove method'}
                    className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
                    style={{ background: 'var(--overlay-subtle)', color: 'var(--color-danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Full Ledger History ─── */}
      <div className="card-elevated p-5">
        <h3 className="text-sm font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
          <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
          {t('billing.transactionLedger')}
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
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('billing.noBillingRecords')}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto' }}>
                {t('billing.noBillingRecordsDesc')}
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

      {/* ─── Add Saved Payment Method Modal ─── */}
      {showAddMethod && (
        <Modal onClose={() => setShowAddMethod(false)} width={460}>
          <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <CreditCard className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h3 className="text-base font-semibold">{t('billing.addPaymentMethod') || 'Add payment method'}</h3>
              </div>
              <button onClick={() => setShowAddMethod(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.methodType') || 'Method type'}</label>
                <select
                  value={methodForm.methodType}
                  onChange={e => setMethodForm({ ...methodForm, methodType: e.target.value as SavedPaymentMethodType })}
                >
                  {SAVED_METHOD_TYPES.map(mt => <option key={mt} value={mt}>{METHOD_LABELS[mt]}</option>)}
                </select>
              </div>

              {MOBILE_MONEY_METHODS.includes(methodForm.methodType) && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.phoneNumber') || 'Phone number'}</label>
                  <input type="tel" value={methodForm.phoneNumber} onChange={e => setMethodForm({ ...methodForm, phoneNumber: e.target.value })} placeholder="+211 9XX XXX XXX" />
                </div>
              )}

              {methodForm.methodType === 'card' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.cardLast4') || 'Card last 4'}</label>
                    <input type="text" maxLength={4} value={methodForm.cardLast4} onChange={e => setMethodForm({ ...methodForm, cardLast4: e.target.value })} placeholder="4242" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.cardBrand') || 'Card brand'}</label>
                    <input type="text" value={methodForm.cardBrand} onChange={e => setMethodForm({ ...methodForm, cardBrand: e.target.value })} placeholder="visa" />
                  </div>
                </div>
              )}

              {methodForm.methodType === 'bank' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.bankName') || 'Bank name'}</label>
                    <input type="text" value={methodForm.bankName} onChange={e => setMethodForm({ ...methodForm, bankName: e.target.value })} placeholder="KCB" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.accountLast4') || 'Account last 4'}</label>
                    <input type="text" maxLength={4} value={methodForm.bankAccountLast4} onChange={e => setMethodForm({ ...methodForm, bankAccountLast4: e.target.value })} placeholder="0123" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.label') || 'Label'}</label>
                <input type="text" value={methodForm.label} onChange={e => setMethodForm({ ...methodForm, label: e.target.value })} placeholder={t('billing.labelPlaceholder') || 'Optional friendly name'} />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={methodForm.isDefault} onChange={e => setMethodForm({ ...methodForm, isDefault: e.target.checked })} />
                {t('billing.setAsDefault') || 'Set as default method'}
              </label>
            </div>
            <hr className="section-divider" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowAddMethod(false)} className="btn btn-secondary flex-1">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={handleSaveMethod} disabled={savingMethod} className="btn btn-primary flex-1">
                {savingMethod ? (t('common.saving') || 'Saving…') : (t('common.save') || 'Save')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Issue Refund Modal ─── */}
      {showRefund && (
        <Modal onClose={() => setShowRefund(false)} width={460}>
          <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <RotateCcw className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h3 className="text-base font-semibold">{t('billing.issueRefund') || 'Issue refund'}</h3>
              </div>
              <button onClick={() => setShowRefund(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {refundablePayments.length === 0 ? (
              <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                {t('billing.noRefundablePayments') || 'No refundable payments found for this patient.'}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.payment') || 'Payment'}</label>
                  <select value={refundPaymentId} onChange={e => handleRefundPaymentChange(e.target.value)}>
                    {refundablePayments.map(p => (
                      <option key={p._id} value={p._id}>
                        {fmt(p.amount)} · {getMethodConfig(p.method).label} · {new Date(p.processedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.refundAmount') || 'Refund amount'}</label>
                  <input
                    type="number"
                    min={0}
                    max={selectedRefundPayment?.amount ?? 0}
                    value={refundAmount || ''}
                    onChange={e => setRefundAmount(parseFloat(e.target.value) || 0)}
                  />
                  {selectedRefundPayment && (
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      {t('billing.maxRefund', { amount: fmt(selectedRefundPayment.amount) }) || `Max ${fmt(selectedRefundPayment.amount)}`}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.reason') || 'Reason'}</label>
                  <textarea rows={2} value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder={t('billing.reasonPlaceholder') || 'Required'} />
                </div>
              </div>
            )}
            <hr className="section-divider" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowRefund(false)} className="btn btn-secondary flex-1">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={handleIssueRefund} disabled={processingRefund || refundablePayments.length === 0} className="btn btn-primary flex-1">
                {processingRefund ? (t('common.processing') || 'Processing…') : (t('billing.issueRefund') || 'Issue refund')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Adjustment / Write-off Modal ─── */}
      {showAdjustment && (
        <Modal onClose={() => setShowAdjustment(false)} width={460}>
          <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <RefreshCw className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h3 className="text-base font-semibold">{t('billing.adjustmentWriteOff') || 'Adjustment / write-off'}</h3>
              </div>
              <button onClick={() => setShowAdjustment(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.adjustmentType') || 'Adjustment type'}</label>
                <select value={adjForm.adjustmentType} onChange={e => setAdjForm({ ...adjForm, adjustmentType: e.target.value as AdjustmentType })}>
                  {ADJUSTMENT_TYPES.map(at => <option key={at} value={at}>{at.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.amount') || 'Amount'}</label>
                <input type="number" min={0} value={adjForm.amount || ''} onChange={e => setAdjForm({ ...adjForm, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.reasonCode') || 'Reason code'}</label>
                <input type="text" value={adjForm.reasonCode} onChange={e => setAdjForm({ ...adjForm, reasonCode: e.target.value })} placeholder={t('common.optional') || 'Optional'} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('billing.reason') || 'Reason'}</label>
                <textarea rows={2} value={adjForm.reason} onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder={t('billing.reasonPlaceholder') || 'Required'} />
              </div>
            </div>
            <hr className="section-divider" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowAdjustment(false)} className="btn btn-secondary flex-1">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={handleCreateAdjustment} disabled={processingAdj} className="btn btn-primary flex-1">
                {processingAdj ? (t('common.processing') || 'Processing…') : (t('common.save') || 'Save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
