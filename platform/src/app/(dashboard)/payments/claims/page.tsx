'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  AlertTriangle,
  Plus,
  X,
} from '@/components/icons/lucide';
import RowActionsMenu from '@/components/RowActionsMenu';
import TopBar from '@/components/TopBar';
import DataTile from '@/components/DataTile';
import Modal from '@/components/Modal';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { usePatients } from '@/lib/hooks/usePatients';
import { patientFullName } from '@/lib/patient-utils';
import { computeAdjudicatedStatus } from '@/lib/services/payment-service';
import type { ClaimDoc, ClaimStatus, PayerType, InsurancePolicyDoc } from '@/lib/db-types-payments';
import type { BillingDoc } from '@/lib/db-types-billing';
import { formatMoney } from '@/lib/format-utils';

// Payer mix labels/colours — relocated from the old Billing cockpit so the
// payer breakdown lives next to the claims it summarises.
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
  cbhi: '#2191D0',
  donor: 'var(--color-warning)',
  government: 'var(--accent-primary)',
  private: '#EA580C',
  employer: '#0F766E',
};

interface ClaimKPIs {
  totalClaims: number;
  totalBilled: number;
  pendingReview: number;
  pendingAmount: number;
  approved: number;
  approvedAmount: number;
  denied: number;
  deniedAmount: number;
}

interface AdjudicationForm {
  claimId: string;
  allowedAmount: number;
  paidAmount: number;
  denialReason?: string;
  notes: string;
}

interface NewClaimForm {
  patientId: string;
  policyId: string;
  billingId: string;
  amount: string;
}

export default function ClaimsPage() {
  const { t } = useTranslation();
  const { currentUser, globalSearch } = useApp();
  const [claims, setClaims] = useState<ClaimDoc[]>([]);
  const [filteredClaims, setFilteredClaims] = useState<ClaimDoc[]>([]);
  const [kpis, setKpis] = useState<ClaimKPIs>({
    totalClaims: 0,
    totalBilled: 0,
    pendingReview: 0,
    pendingAmount: 0,
    approved: 0,
    approvedAmount: 0,
    denied: 0,
    deniedAmount: 0,
  });
  // Text search comes from the shared global search bar (TopBar).
  const searchQuery = globalSearch;
  // Status filter retained for the claims list logic; the header filter UI was
  // removed, so it stays at 'all'.
  const [statusFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjForm, setAdjForm] = useState<AdjudicationForm | null>(null);
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();
  const { patients } = usePatients();

  // Appeal modal (denied claim → appealed, with a note).
  const [appealFor, setAppealFor] = useState<ClaimDoc | null>(null);
  const [appealNote, setAppealNote] = useState('');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  // "New claim" modal — the first UI path that actually creates a ClaimDoc
  // (previously claims only existed from seed data).
  const [newClaimOpen, setNewClaimOpen] = useState(false);
  const [newClaim, setNewClaim] = useState<NewClaimForm>({ patientId: '', policyId: '', billingId: '', amount: '' });
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPolicies, setPatientPolicies] = useState<InsurancePolicyDoc[]>([]);
  const [patientBills, setPatientBills] = useState<BillingDoc[]>([]);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const scope = useMemo(
    () =>
      currentUser
        ? {
            orgId: currentUser.orgId,
            hospitalId: currentUser.hospitalId,
            role: currentUser.role,
          }
        : undefined,
    [currentUser]
  );

  const loadClaims = useCallback(async (cancelledRef?: { cancelled: boolean }) => {
    if (!scope) return;
    const cancelled = () => cancelledRef?.cancelled === true;
    {
      try {
        const { getAllClaims } = await import('@/lib/services/payment-service');
        const claimsData = await getAllClaims(scope);
        if (cancelled()) return;
        setClaims(claimsData);

        // Calculate KPIs
        const kpiData: ClaimKPIs = {
          totalClaims: claimsData.length,
          totalBilled: 0,
          pendingReview: 0,
          pendingAmount: 0,
          approved: 0,
          approvedAmount: 0,
          denied: 0,
          deniedAmount: 0,
        };

        claimsData.forEach((claim) => {
          kpiData.totalBilled += claim.totalBilled || 0;
          if (claim.status === 'submitted' || claim.status === 'draft') {
            kpiData.pendingReview++;
            kpiData.pendingAmount += claim.totalBilled || 0;
          } else if (claim.status === 'accepted' || claim.status === 'paid') {
            kpiData.approved++;
            kpiData.approvedAmount += claim.totalApproved || 0;
          } else if (claim.status === 'denied') {
            kpiData.denied++;
            kpiData.deniedAmount += claim.totalBilled || 0;
          }
        });

        if (cancelled()) return;
        setKpis(kpiData);
        setLoading(false);
      } catch (error) {
        if (cancelled()) return;
        console.error('Failed to load claims:', error);
        setLoading(false);
      }
    }
  }, [scope]);

  useEffect(() => {
    const ref = { cancelled: false };
    loadClaims(ref);
    return () => { ref.cancelled = true; };
  }, [loadClaims]);

  // When a patient is picked in the New-claim modal, load their insurance
  // policies and open bills so the claim can be raised against real data.
  useEffect(() => {
    if (!newClaim.patientId) { setPatientPolicies([]); setPatientBills([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const [{ getPatientInsurancePolicies }, { getAllBills }] = await Promise.all([
          import('@/lib/services/payment-service'),
          import('@/lib/services/billing-service'),
        ]);
        const [policies, bills] = await Promise.all([
          getPatientInsurancePolicies(newClaim.patientId),
          getAllBills(scope),
        ]);
        if (cancelled) return;
        setPatientPolicies(policies);
        setPatientBills(bills.filter(b => b.patientId === newClaim.patientId && (b.balanceDue ?? 0) > 0));
      } catch (err) {
        console.error('Failed to load patient billing context:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [newClaim.patientId, scope]);

  const handleAppeal = async () => {
    if (!appealFor || !appealNote.trim()) { showToast('An appeal needs a note for the payer', 'error'); return; }
    setLifecycleBusy(true);
    try {
      const { appealClaim } = await import('@/lib/services/payment-service');
      await appealClaim(appealFor._id, appealNote.trim(), currentUser?._id || 'unknown', currentUser?.name || 'Unknown');
      showToast(`Claim ${appealFor.claimNumber} appealed`, 'success');
      setAppealFor(null);
      setAppealNote('');
      await loadClaims();
    } catch (err) {
      console.error(err);
      showToast((err as Error).message || 'Could not appeal this claim', 'error');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleResubmit = async (claim: ClaimDoc) => {
    setLifecycleBusy(true);
    try {
      const { resubmitClaim } = await import('@/lib/services/payment-service');
      await resubmitClaim(claim._id, currentUser?._id || 'unknown', currentUser?.name || 'Unknown');
      showToast(`Claim ${claim.claimNumber} resubmitted to ${claim.payerName}`, 'success');
      await loadClaims();
    } catch (err) {
      console.error(err);
      showToast((err as Error).message || 'Could not resubmit this claim', 'error');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const resetNewClaim = () => {
    setNewClaim({ patientId: '', policyId: '', billingId: '', amount: '' });
    setPatientSearch('');
    setNewClaimOpen(false);
  };

  const handleSubmitNewClaim = async () => {
    const policy = patientPolicies.find(p => p._id === newClaim.policyId);
    const patient = patients.find(p => p._id === newClaim.patientId);
    const bill = patientBills.find(b => b._id === newClaim.billingId);
    const amount = bill ? (bill.balanceDue ?? bill.totalAmount ?? 0) : parseFloat(newClaim.amount);
    if (!patient) { showToast('Pick a patient first', 'error'); return; }
    if (!policy) { showToast('Pick the insurance policy to claim against', 'error'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Enter a claim amount greater than zero', 'error'); return; }
    setSubmittingClaim(true);
    try {
      const { submitClaim } = await import('@/lib/services/payment-service');
      const doc = await submitClaim({
        patientId: patient._id,
        patientName: patientFullName(patient),
        policyId: policy._id,
        payerName: policy.payerName,
        payerType: policy.payerType,
        billingId: bill?._id,
        encounterId: bill?.encounterId,
        chargeIds: [],
        totalBilled: amount,
        facilityId: currentUser?.hospitalId || '',
        facilityName: currentUser?.hospitalName || '',
        submittedBy: currentUser?.name || currentUser?.username || 'Unknown',
        orgId: currentUser?.orgId,
      });
      showToast(`Claim ${doc.claimNumber} submitted to ${policy.payerName}`, 'success');
      resetNewClaim();
      await loadClaims();
    } catch (err) {
      console.error(err);
      showToast((err as Error).message || 'Could not submit the claim', 'error');
    } finally {
      setSubmittingClaim(false);
    }
  };

  useEffect(() => {
    let filtered = claims;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((claim) => claim.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (claim) =>
          claim.claimNumber?.toLowerCase().includes(query) ||
          claim.patientName?.toLowerCase().includes(query) ||
          claim.payerName?.toLowerCase().includes(query)
      );
    }

    setFilteredClaims(filtered);
  }, [claims, statusFilter, searchQuery]);

  const handleAdjudicate = (claim: ClaimDoc) => {
    setEditingId(claim._id);
    setAdjForm({
      claimId: claim._id,
      allowedAmount: claim.totalAllowed || claim.totalBilled || 0,
      paidAmount: claim.totalApproved || 0,
      denialReason: claim.denialReasons?.join(', ') || '',
      notes: '',
    });
  };

  // The persisted status is DERIVED from the amounts by the exact rule the
  // service applies (computeAdjudicatedStatus) — the modal shows a live
  // preview of that outcome instead of offering a status dropdown that the
  // save path would silently ignore.
  const adjPreview = useMemo(() => {
    if (!adjForm) return null;
    const allowed = Number.isFinite(adjForm.allowedAmount) ? Math.max(0, adjForm.allowedAmount) : 0;
    const paid = Number.isFinite(adjForm.paidAmount) ? Math.max(0, adjForm.paidAmount) : 0;
    return computeAdjudicatedStatus(paid, Math.max(0, allowed - paid));
  }, [adjForm]);

  const handleSaveAdjudication = async () => {
    if (!adjForm) return;

    try {
      const { adjudicateClaim } = await import('@/lib/services/payment-service');
      const allowed = Number.isFinite(adjForm.allowedAmount) ? Math.max(0, adjForm.allowedAmount) : 0;
      const paid = Number.isFinite(adjForm.paidAmount) ? Math.max(0, adjForm.paidAmount) : 0;
      await adjudicateClaim(
        adjForm.claimId,
        paid,
        Math.max(0, allowed - paid),
        0,
        0,
        currentUser?.name || 'Unknown',
        {
          denialReasons: adjForm.denialReason?.trim() ? [adjForm.denialReason.trim()] : undefined,
          notes: adjForm.notes.trim() || undefined,
        }
      );

      await loadClaims();

      setEditingId(null);
      setAdjForm(null);
    } catch (error) {
      console.error('Failed to save adjudication:', error);
      showToast('Could not save the adjudication', 'error');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setAdjForm(null);
  };

  const getStatusBgColor = (status: ClaimStatus): string => {
    const colorMap: Record<ClaimStatus, string> = {
      draft: 'var(--color-info-bg)',
      submitted: 'var(--color-warning-bg)',
      accepted: 'var(--color-success-bg)',
      denied: 'var(--color-danger-bg)',
      paid: 'var(--color-info-bg)',
      appealed: 'var(--color-warning-bg)',
      partial: 'var(--color-warning-bg)',
    };
    return colorMap[status] || 'var(--overlay-subtle)';
  };

  const getStatusTextColor = (status: ClaimStatus): string => {
    const colorMap: Record<ClaimStatus, string> = {
      draft: 'var(--color-info)',
      submitted: 'var(--color-warning)',
      accepted: 'var(--color-success)',
      denied: 'var(--color-danger)',
      paid: 'var(--color-info)',
      appealed: 'var(--color-warning)',
      partial: 'var(--color-warning)',
    };
    return colorMap[status] || 'var(--text-secondary)';
  };

  const getStatusBorderColor = (status: ClaimStatus): string => {
    const colorMap: Record<ClaimStatus, string> = {
      draft: 'var(--color-info)',
      submitted: 'var(--color-warning)',
      accepted: 'var(--color-success)',
      denied: 'var(--color-danger)',
      paid: 'var(--color-info)',
      appealed: 'var(--color-warning)',
      partial: 'var(--color-warning)',
    };
    return colorMap[status] || 'var(--text-secondary)';
  };

  // Revenue share by payer type across all claims.
  const payerMix = useMemo(() => {
    const mix: Partial<Record<PayerType, number>> = {};
    for (const c of claims) mix[c.payerType] = (mix[c.payerType] || 0) + (c.totalBilled || 0);
    const total = Object.values(mix).reduce((s, v) => s + (v || 0), 0) || 1;
    return (Object.keys(mix) as PayerType[])
      .map(k => ({ payer: k, amount: mix[k] || 0, pct: Math.round(((mix[k] || 0) / total) * 100) }))
      .sort((a, b) => b.amount - a.amount);
  }, [claims]);

  return (
    <>
      <TopBar title={t('claims.title')} hideSearch actions={
        <button
          onClick={() => setNewClaimOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent-primary)', color: '#fff' }}
        >
          <Plus className="w-4 h-4" /> New claim
        </button>
      } />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <DataTile label={t('claims.kpiTotalClaims')} value={kpis.totalClaims} />
        <DataTile label={t('claims.kpiPendingReview')} value={kpis.pendingReview} hint={formatMoney(kpis.pendingAmount)} tone={kpis.pendingReview > 0 ? 'warning' : 'default'} />
        <DataTile label={t('claims.kpiApprovedClaims')} value={kpis.approved} hint={formatMoney(kpis.approvedAmount)} tone={kpis.approved > 0 ? 'ok' : 'default'} />
        <DataTile label={t('claims.kpiDeniedClaims')} value={kpis.denied} hint={formatMoney(kpis.deniedAmount)} tone={kpis.denied > 0 ? 'danger' : 'default'} />
      </div>

      {/* Payer mix — revenue share by payer across all claims. */}
      {payerMix.length > 0 && (
        <section className="glass-section" style={{ marginBottom: 16 }}>
          <div className="glass-section-header">
            <span className="kpi-card-title">{t('billing.payerMix')}</span>
          </div>
          <div className="glass-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payerMix.map(({ payer, amount, pct }) => (
              <div key={payer}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{t(PAYER_LABEL_KEYS[payer])}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{formatMoney(amount)} · {pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--overlay-medium)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: PAYER_COLORS[payer] }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Claims Table */}
      <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <FileText className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('claims.title')}</h3>
        </div>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {loading ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
            {t('claims.loading')}
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.6 }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('claims.emptyTitle')}</p>
            <p style={{ marginTop: 4, fontSize: '0.8125rem' }}>
              {t('claims.emptyDescription')}
            </p>
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
            minWidth: 1120,
          }}>
            <thead>
              <tr style={{
                background: 'var(--overlay-subtle)',
                borderBottom: '1px solid var(--border-light)',
              }}>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'left',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colClaimNumber')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'left',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colPatientName')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'left',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colPayerName')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'left',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colPayerType')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colBilled')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colAllowed')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colPaid')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'center',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colStatus')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'left',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colSubmittedDate')}</th>
                <th style={{
                  padding: '12px 20px',
                  textAlign: 'center',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                }}>{t('claims.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => (
                <tr
                  key={claim._id}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    transition: 'background-color 0.15s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--overlay-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{
                    padding: '12px 20px',
                    color: 'var(--text-primary)',
                    fontWeight: '600',
                  }}>{claim.claimNumber}</td>
                  <td style={{
                    padding: '12px 20px',
                    color: 'var(--text-primary)',
                  }}>
                    {claim.patientId && !claim.patientId.startsWith('demo-') && !claim.patientId.includes('_demo') ? (
                      <Link
                        href={`/patients/${claim.patientId}`}
                        onClick={e => e.stopPropagation()}
                        className="hover:underline"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {claim.patientName}
                      </Link>
                    ) : (
                      claim.patientName
                    )}
                  </td>
                  <td style={{
                    padding: '12px 20px',
                    color: 'var(--text-primary)',
                  }}>{claim.payerName}</td>
                  <td style={{
                    padding: '12px 20px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                  }}>{claim.payerType}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'right',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}>{formatMoney(claim.totalBilled || 0)}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'right',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}>{formatMoney(claim.totalAllowed || 0)}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'right',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}>{formatMoney(claim.totalApproved || 0)}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'center',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '0.625rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      backgroundColor: getStatusBgColor(claim.status),
                      color: getStatusTextColor(claim.status),
                      borderLeft: `2px solid ${getStatusBorderColor(claim.status)}`,
                    }}>{t(`claims.status_${claim.status}`)}</span>
                  </td>
                  <td style={{
                    padding: '12px 20px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                  }}>{new Date(claim.submittedDate || '').toLocaleDateString()}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'center',
                  }}>
                    <div style={{ display: 'inline-flex' }}>
                      <RowActionsMenu
                        actions={[
                          ...((claim.status === 'submitted' || claim.status === 'draft') ? [{ key: 'adjudicate', label: t('claims.actionAdjudicate'), onClick: () => handleAdjudicate(claim) }] : []),
                          ...(claim.status === 'denied' ? [{ key: 'appeal', label: 'Appeal denial', onClick: () => { setAppealNote(''); setAppealFor(claim); } }] : []),
                          ...((claim.status === 'denied' || claim.status === 'appealed') ? [{ key: 'resubmit', label: 'Resubmit to payer', onClick: () => handleResubmit(claim) }] : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* Adjudication Modal - Premium Style */}
      {editingId && adjForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 31, 29, 0.70)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }} onClick={handleCancel}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--card-radius)',
            boxShadow: 'var(--card-shadow)',
            maxWidth: '520px',
            width: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '2rem',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              margin: '0 0 2rem 0',
              color: 'var(--text-primary)',
              fontSize: '1.375rem',
              fontWeight: '700',
            }}>
              {t('claims.modalTitle')}
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.625rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {t('claims.colStatus')}
              </label>
              {/* Derived, not chosen: the same amount rule the service persists.
                  Paid amount 0 with an allowed amount = full denial. */}
              {adjPreview && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: '4px',
                  border: '1px solid var(--border-light)', background: 'var(--overlay-subtle)',
                }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '4px',
                    fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase',
                    backgroundColor: getStatusBgColor(adjPreview),
                    color: getStatusTextColor(adjPreview),
                    borderLeft: `2px solid ${getStatusBorderColor(adjPreview)}`,
                  }}>{t(`claims.status_${adjPreview}`)}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Derived from the amounts below — set paid to 0 to deny the full allowed amount.
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.625rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {t('claims.labelAllowedAmount')}
              </label>
              <input
                type="number"
                value={adjForm.allowedAmount}
                onChange={(e) =>
                  setAdjForm({
                    ...adjForm,
                    allowedAmount: parseFloat(e.target.value),
                  })
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border-light)',
                  borderRadius: '4px',
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.625rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {t('claims.labelPaidAmount')}
              </label>
              <input
                type="number"
                value={adjForm.paidAmount}
                onChange={(e) =>
                  setAdjForm({
                    ...adjForm,
                    paidAmount: parseFloat(e.target.value),
                  })
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border-light)',
                  borderRadius: '4px',
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {(adjPreview === 'denied' || adjPreview === 'partial') && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.625rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {t('claims.labelDenialReason')}
                </label>
                <input
                  type="text"
                  value={adjForm.denialReason || ''}
                  onChange={(e) =>
                    setAdjForm({
                      ...adjForm,
                      denialReason: e.target.value,
                    })
                  }
                  placeholder={t('claims.denialReasonPlaceholder')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border-light)',
                    borderRadius: '4px',
                    fontSize: '0.9375rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-card)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.625rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {t('claims.labelNotes')}
              </label>
              <textarea
                value={adjForm.notes}
                onChange={(e) =>
                  setAdjForm({ ...adjForm, notes: e.target.value })
                }
                placeholder={t('claims.notesPlaceholder')}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border-light)',
                  borderRadius: '4px',
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  minHeight: '100px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--overlay-subtle)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--border-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--overlay-subtle)';
                }}
              >
                {t('action.cancel')}
              </button>
              <button
                onClick={handleSaveAdjudication}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'var(--color-success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {t('claims.saveAdjudication')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appeal modal — denied claim → appealed, with a note for the payer. */}
      {appealFor && (
        <Modal onClose={() => !lifecycleBusy && setAppealFor(null)} width={440} labelledBy="appeal-claim-title">
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center justify-between">
              <h2 id="appeal-claim-title" className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Appeal claim {appealFor.claimNumber}
              </h2>
              <button className="p-1 rounded" onClick={() => !lifecycleBusy && setAppealFor(null)} style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Denied by {appealFor.payerName} · billed {formatMoney(appealFor.totalBilled || 0)}
              {appealFor.denialReasons?.length ? ` · reason: ${appealFor.denialReasons.join(', ')}` : ''}
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Appeal note</label>
              <textarea
                rows={3}
                value={appealNote}
                onChange={e => setAppealNote(e.target.value)}
                placeholder="Why the denial should be reconsidered…"
                autoFocus
                className="w-full p-2.5 rounded-md text-[13px]"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', resize: 'vertical' }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button className="btn btn-sm btn-secondary" disabled={lifecycleBusy} onClick={() => setAppealFor(null)}>Cancel</button>
              <button className="btn btn-sm btn-primary" disabled={lifecycleBusy || !appealNote.trim()} onClick={handleAppeal}>
                {lifecycleBusy ? 'Submitting…' : 'Submit appeal'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New claim modal — pick an insured patient, the policy, and the bill
          (or a manual amount), then submit through the real claims service. */}
      {newClaimOpen && (
        <Modal onClose={() => !submittingClaim && resetNewClaim()} width={480} labelledBy="new-claim-title">
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center justify-between">
              <h2 id="new-claim-title" className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>New insurance claim</h2>
              <button className="p-1 rounded" onClick={() => !submittingClaim && resetNewClaim()} style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
            </div>

            {/* Patient picker */}
            {newClaim.patientId ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-accent)' }}>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {patientFullName(patients.find(p => p._id === newClaim.patientId) || { firstName: 'Unknown', surname: '' } as never)}
                </div>
                <button onClick={() => setNewClaim({ patientId: '', policyId: '', billingId: '', amount: '' })} className="text-xs font-semibold underline shrink-0" style={{ color: 'var(--accent-primary)' }}>Change</button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Patient</label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search by name or hospital number…"
                  autoFocus
                  className="w-full p-2.5 rounded-md text-[13px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
                {patientSearch.trim().length >= 2 && (
                  <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--border-light)', maxHeight: 180, overflowY: 'auto' }}>
                    {patients
                      .filter(p => `${patientFullName(p)} ${p.hospitalNumber || ''}`.toLowerCase().includes(patientSearch.trim().toLowerCase()))
                      .slice(0, 6)
                      .map(p => (
                        <button
                          key={p._id}
                          onClick={() => setNewClaim(f => ({ ...f, patientId: p._id }))}
                          className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--overlay-subtle)]"
                          style={{ color: 'var(--text-primary)', display: 'block' }}
                        >
                          {patientFullName(p)} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.hospitalNumber || ''}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Policy picker */}
            {newClaim.patientId && (
              patientPolicies.length === 0 ? (
                <p className="text-xs px-3 py-2.5 rounded-md" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                  This patient has no insurance policy on file — add one from their chart&rsquo;s Billing tab first.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Insurance policy</label>
                  <select
                    value={newClaim.policyId}
                    onChange={e => setNewClaim(f => ({ ...f, policyId: e.target.value }))}
                    className="w-full p-2.5 rounded-md text-[13px]"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select policy…</option>
                    {patientPolicies.map(pol => (
                      <option key={pol._id} value={pol._id}>
                        {pol.payerName}{pol.memberId ? ` · ${pol.memberId}` : ''}{pol.isPrimary ? ' (primary)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}

            {/* Bill or manual amount */}
            {newClaim.patientId && patientPolicies.length > 0 && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Bill to claim against</label>
                  <select
                    value={newClaim.billingId}
                    onChange={e => setNewClaim(f => ({ ...f, billingId: e.target.value }))}
                    className="w-full p-2.5 rounded-md text-[13px]"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                  >
                    <option value="">No linked bill — enter amount manually</option>
                    {patientBills.map(b => (
                      <option key={b._id} value={b._id}>
                        {formatMoney(b.balanceDue ?? 0)} outstanding · {(b.encounterDate || b.createdAt || '').slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>
                {!newClaim.billingId && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Claim amount</label>
                    <input
                      type="number"
                      min="0"
                      value={newClaim.amount}
                      onChange={e => setNewClaim(f => ({ ...f, amount: e.target.value }))}
                      className="w-full p-2.5 rounded-md text-[13px]"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button className="btn btn-sm btn-secondary" disabled={submittingClaim} onClick={resetNewClaim}>Cancel</button>
              <button
                className="btn btn-sm btn-primary"
                disabled={submittingClaim || !newClaim.patientId || !newClaim.policyId || (!newClaim.billingId && !newClaim.amount)}
                onClick={handleSubmitNewClaim}
              >
                {submittingClaim ? 'Submitting…' : 'Submit claim'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      </main>
    </>
  );
}
