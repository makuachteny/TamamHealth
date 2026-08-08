'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Plus,
  Search,
  Activity,
  X,
} from '@/components/icons/lucide';
import RowActionsMenu from '@/components/RowActionsMenu';
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
import '@/components/billing/billing.css';
import Select from '@/components/Select';

// Payer mix labels — relocated from the old Billing cockpit so the payer
// breakdown lives next to the claims it summarises. Colour is a single
// accent (the bl-meter default) rather than one hue per payer.
const PAYER_LABEL_KEYS: Record<PayerType, string> = {
  self_pay: 'billing.payerSelfPay',
  nhis: 'billing.payerNhis',
  cbhi: 'billing.payerCbhi',
  donor: 'billing.payerDonor',
  government: 'billing.payerGovernment',
  private: 'billing.payerPrivate',
  employer: 'billing.payerEmployer',
};

// Claim status → bl-chip variant. Claim statuses are their own union (not
// BillingStatus), so this maps onto the closest billing-module chip meaning:
// draft (not yet sent) reads as neutral, submitted/appealed as pending,
// accepted/paid as settled, denied as the alarm colour.
const CLAIM_STATUS_CHIP: Record<ClaimStatus, string> = {
  draft: 'bl-chip--waived',
  submitted: 'bl-chip--partial',
  accepted: 'bl-chip--paid',
  denied: 'bl-chip--unpaid',
  paid: 'bl-chip--paid',
  appealed: 'bl-chip--partial',
  partial: 'bl-chip--partial',
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
  const { currentUser, globalSearch, setGlobalSearch } = useApp();
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
  // Text search comes from the shared global search state, surfaced via the card header's search box.
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
          totalAllowed: allowed,
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
      <main className="page-container page-enter">
      <div className="bl-root">

      {/* KPI strip — no tinted tiles; denied/pending amounts speak for themselves. */}
      <div className="bl-stats">
        <div>
          <span className="bl-stat-label">{t('claims.kpiTotalClaims')}</span>
          <span className="bl-stat-value">{kpis.totalClaims}</span>
        </div>
        <div>
          <span className="bl-stat-label">{t('claims.kpiPendingReview')}</span>
          <span className="bl-stat-value">{kpis.pendingReview}</span>
          <span className="bl-stat-sub">{formatMoney(kpis.pendingAmount)}</span>
        </div>
        <div>
          <span className="bl-stat-label">{t('claims.kpiApprovedClaims')}</span>
          <span className={`bl-stat-value${kpis.approved > 0 ? ' bl-stat-value--good' : ''}`}>{kpis.approved}</span>
          <span className="bl-stat-sub">{formatMoney(kpis.approvedAmount)}</span>
        </div>
        <div>
          <span className="bl-stat-label">{t('claims.kpiDeniedClaims')}</span>
          <span className={`bl-stat-value${kpis.denied > 0 ? ' bl-stat-value--danger' : ''}`}>{kpis.denied}</span>
          <span className="bl-stat-sub">{formatMoney(kpis.deniedAmount)}</span>
        </div>
      </div>

      {/* Payer mix — revenue share by payer across all claims. One accent
          (the bl-meter default teal), not a colour per payer. */}
      {payerMix.length > 0 && (
        <div className="bl-section">
          <div className="bl-section-head">
            <h2 className="bl-section-title">{t('billing.payerMix')}</h2>
          </div>
          <div className="bl-meter">
            {payerMix.map(({ payer, amount, pct }) => (
              <div className="bl-meter-row" key={payer}>
                <span>{t(PAYER_LABEL_KEYS[payer])}</span>
                <span className="bl-meter-track"><span className="bl-meter-fill" style={{ width: `${pct}%` }} /></span>
                <span className="bl-meter-value">{formatMoney(amount)} · {pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claims table */}
      <div className="bl-card">
        <div className="bl-card-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 className="bl-card-title">{t('claims.title')}</h2>
            <span className="bl-underline" />
          </div>
          <button type="button" className="bl-btn bl-btn--primary" onClick={() => setNewClaimOpen(true)}>
            New claim <Plus size={15} />
          </button>
        </div>

        <div className="bl-search">
          <Search size={16} />
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Search this table"
            aria-label="Search claims"
          />
        </div>

        {loading ? (
          <div className="bl-loading">
            <Activity size={30} style={{ animation: 'spin 1s linear infinite' }} />
            <span>{t('claims.loading')}</span>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="bl-empty">
            <AlertTriangle size={34} />
            <h3>{t('claims.emptyTitle')}</h3>
            <p>{t('claims.emptyDescription')}</p>
          </div>
        ) : (
          <div className="bl-table-wrap">
            <table className="bl-table">
              <thead>
                <tr>
                  <th>{t('claims.colClaimNumber')}</th>
                  <th>{t('claims.colPatientName')}</th>
                  <th>{t('claims.colPayerName')}</th>
                  <th>{t('claims.colPayerType')}</th>
                  <th className="bl-right">{t('claims.colBilled')}</th>
                  <th className="bl-right">{t('claims.colAllowed')}</th>
                  <th className="bl-right">{t('claims.colPaid')}</th>
                  <th>{t('claims.colStatus')}</th>
                  <th>{t('claims.colSubmittedDate')}</th>
                  <th aria-label={t('claims.colActions')} />
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((claim) => (
                  <tr key={claim._id}>
                    <td style={{ fontWeight: 600 }}>{claim.claimNumber}</td>
                    <td>
                      {claim.patientId && !claim.patientId.startsWith('demo-') && !claim.patientId.includes('_demo') ? (
                        <Link href={`/patients/${claim.patientId}?tab=billing`} onClick={e => e.stopPropagation()} className="bl-link">
                          {claim.patientName}
                        </Link>
                      ) : (
                        claim.patientName
                      )}
                    </td>
                    <td>{claim.payerName}</td>
                    <td className="bl-muted">{claim.payerType}</td>
                    <td className="bl-num bl-right">{formatMoney(claim.totalBilled || 0)}</td>
                    <td className="bl-num bl-right">{formatMoney(claim.totalAllowed || 0)}</td>
                    <td className="bl-num bl-right">{formatMoney(claim.totalApproved || 0)}</td>
                    <td>
                      <span className={`bl-chip ${CLAIM_STATUS_CHIP[claim.status]}`}>{t(`claims.status_${claim.status}`)}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(claim.submittedDate || '').toLocaleDateString()}</td>
                    <td>
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
          </div>
        )}
      </div>
      </div>

      {/* Adjudication modal */}
      {editingId && adjForm && (
        <Modal onClose={handleCancel} width={480} labelledBy="adj-claim-title">
          <div className="bl-root bl-modal-body">
            <h3 className="bl-modal-title" id="adj-claim-title">{t('claims.modalTitle')}</h3>

            <div className="bl-field">
              <label htmlFor="adj-status-preview">{t('claims.colStatus')}</label>
              {/* Derived, not chosen: the same amount rule the service persists.
                  Paid amount 0 with an allowed amount = full denial. */}
              {adjPreview && (
                <div
                  id="adj-status-preview"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 6,
                    border: '1px solid var(--ehr-border, #D8E3EC)', background: 'var(--ehr-page-bg, #F8FBFD)',
                  }}
                >
                  <span className={`bl-chip ${CLAIM_STATUS_CHIP[adjPreview]}`}>{t(`claims.status_${adjPreview}`)}</span>
                  <span className="bl-muted" style={{ fontSize: 12.5 }}>
                    Derived from the amounts below — set paid to 0 to deny the full allowed amount.
                  </span>
                </div>
              )}
            </div>

            <div className="bl-field">
              <label htmlFor="adj-allowed">{t('claims.labelAllowedAmount')}</label>
              <input
                id="adj-allowed"
                type="number"
                value={adjForm.allowedAmount}
                onChange={(e) => setAdjForm({ ...adjForm, allowedAmount: parseFloat(e.target.value) })}
              />
            </div>

            <div className="bl-field">
              <label htmlFor="adj-paid">{t('claims.labelPaidAmount')}</label>
              <input
                id="adj-paid"
                type="number"
                value={adjForm.paidAmount}
                onChange={(e) => setAdjForm({ ...adjForm, paidAmount: parseFloat(e.target.value) })}
              />
            </div>

            {(adjPreview === 'denied' || adjPreview === 'partial') && (
              <div className="bl-field">
                <label htmlFor="adj-denial">{t('claims.labelDenialReason')}</label>
                <input
                  id="adj-denial"
                  type="text"
                  value={adjForm.denialReason || ''}
                  onChange={(e) => setAdjForm({ ...adjForm, denialReason: e.target.value })}
                  placeholder={t('claims.denialReasonPlaceholder')}
                />
              </div>
            )}

            <div className="bl-field">
              <label htmlFor="adj-notes">{t('claims.labelNotes')}</label>
              <textarea
                id="adj-notes"
                rows={3}
                value={adjForm.notes}
                onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })}
                placeholder={t('claims.notesPlaceholder')}
              />
            </div>

            <div className="bl-modal-actions">
              <button type="button" className="bl-btn bl-btn--ghost" onClick={handleCancel}>{t('action.cancel')}</button>
              <button type="button" className="bl-btn bl-btn--primary" onClick={handleSaveAdjudication}>{t('claims.saveAdjudication')}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Appeal modal — denied claim → appealed, with a note for the payer. */}
      {appealFor && (
        <Modal onClose={() => !lifecycleBusy && setAppealFor(null)} width={440} labelledBy="appeal-claim-title">
          <div className="bl-root bl-modal-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="bl-modal-title" id="appeal-claim-title">Appeal claim {appealFor.claimNumber}</h3>
              <button type="button" className="bl-row-menu-btn" onClick={() => !lifecycleBusy && setAppealFor(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <p className="bl-modal-sub">
              Denied by {appealFor.payerName} · billed {formatMoney(appealFor.totalBilled || 0)}
              {appealFor.denialReasons?.length ? ` · reason: ${appealFor.denialReasons.join(', ')}` : ''}
            </p>
            <div className="bl-field">
              <label htmlFor="appeal-note">Appeal note</label>
              <textarea
                id="appeal-note"
                rows={3}
                value={appealNote}
                onChange={e => setAppealNote(e.target.value)}
                placeholder="Why the denial should be reconsidered…"
                autoFocus
              />
            </div>
            <div className="bl-modal-actions">
              <button type="button" className="bl-btn bl-btn--ghost" disabled={lifecycleBusy} onClick={() => setAppealFor(null)}>Cancel</button>
              <button type="button" className="bl-btn bl-btn--primary" disabled={lifecycleBusy || !appealNote.trim()} onClick={handleAppeal}>
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
          <div className="bl-root bl-modal-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="bl-modal-title" id="new-claim-title">New insurance claim</h3>
              <button type="button" className="bl-row-menu-btn" onClick={() => !submittingClaim && resetNewClaim()} aria-label="Close"><X size={16} /></button>
            </div>

            {/* Patient picker */}
            {newClaim.patientId ? (
              <div className="bl-id-tag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px' }}>
                <strong>{patientFullName(patients.find(p => p._id === newClaim.patientId) || { firstName: 'Unknown', surname: '' } as never)}</strong>
                <button type="button" className="bl-link" onClick={() => setNewClaim({ patientId: '', policyId: '', billingId: '', amount: '' })}>Change</button>
              </div>
            ) : (
              <div className="bl-field">
                <label htmlFor="claim-patient-search">Patient</label>
                <input
                  id="claim-patient-search"
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search by name or hospital number…"
                  autoFocus
                />
                {patientSearch.trim().length >= 2 && (
                  <div className="bl-fee-list">
                    {patients
                      .filter(p => `${patientFullName(p)} ${p.hospitalNumber || ''}`.toLowerCase().includes(patientSearch.trim().toLowerCase()))
                      .slice(0, 6)
                      .map(p => (
                        <button
                          key={p._id}
                          type="button"
                          className="bl-fee-row"
                          onClick={() => setNewClaim(f => ({ ...f, patientId: p._id }))}
                          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                        >
                          <div className="bl-fee-name">{patientFullName(p)}</div>
                          <span className="bl-fee-cat">{p.hospitalNumber || ''}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Policy picker */}
            {newClaim.patientId && (
              patientPolicies.length === 0 ? (
                <p className="bl-muted" style={{ fontSize: 12.5 }}>
                  This patient has no insurance policy on file — add one from their chart&rsquo;s Billing tab first.
                </p>
              ) : (
                <div className="bl-field">
                  <label htmlFor="claim-policy">Insurance policy</label>
                  <Select
                    id="claim-policy"
                    value={newClaim.policyId}
                    onChange={e => setNewClaim(f => ({ ...f, policyId: e.target.value }))}
                  >
                    <option value="">Select policy…</option>
                    {patientPolicies.map(pol => (
                      <option key={pol._id} value={pol._id}>
                        {pol.payerName}{pol.memberId ? ` · ${pol.memberId}` : ''}{pol.isPrimary ? ' (primary)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              )
            )}

            {/* Bill or manual amount */}
            {newClaim.patientId && patientPolicies.length > 0 && (
              <>
                <div className="bl-field">
                  <label htmlFor="claim-bill">Bill to claim against</label>
                  <Select
                    id="claim-bill"
                    value={newClaim.billingId}
                    onChange={e => setNewClaim(f => ({ ...f, billingId: e.target.value }))}
                  >
                    <option value="">No linked bill — enter amount manually</option>
                    {patientBills.map(b => (
                      <option key={b._id} value={b._id}>
                        {formatMoney(b.balanceDue ?? 0)} outstanding · {(b.encounterDate || b.createdAt || '').slice(0, 10)}
                      </option>
                    ))}
                  </Select>
                </div>
                {!newClaim.billingId && (
                  <div className="bl-field">
                    <label htmlFor="claim-amount">Claim amount</label>
                    <input
                      id="claim-amount"
                      type="number"
                      min="0"
                      value={newClaim.amount}
                      onChange={e => setNewClaim(f => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                )}
              </>
            )}

            <div className="bl-modal-actions">
              <button type="button" className="bl-btn bl-btn--ghost" disabled={submittingClaim} onClick={resetNewClaim}>Cancel</button>
              <button
                type="button"
                className="bl-btn bl-btn--primary"
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
