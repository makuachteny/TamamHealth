'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  AlertTriangle,
} from '@/components/icons/lucide';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import DataTile from '@/components/DataTile';
import { SearchInput, FilterBar, FilterSelect } from '@/components/filters';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ClaimDoc, ClaimStatus, PayerType } from '@/lib/db-types-payments';

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
  cbhi: '#0891B2',
  donor: 'var(--color-warning)',
  government: '#7C3AED',
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
  status: ClaimStatus;
  allowedAmount: number;
  paidAmount: number;
  denialReason?: string;
  notes: string;
}

export default function ClaimsPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjForm, setAdjForm] = useState<AdjudicationForm | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;

    const loadClaims = async () => {
      try {
        const { getAllClaims } = await import('@/lib/services/payment-service');
        const claimsData = await getAllClaims(scope);
        if (cancelled) return;
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

        if (cancelled) return;
        setKpis(kpiData);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load claims:', error);
        setLoading(false);
      }
    };

    loadClaims();
    return () => { cancelled = true; };
  }, [scope]);

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
      status: claim.status,
      allowedAmount: claim.totalAllowed || 0,
      paidAmount: claim.totalApproved || 0,
      denialReason: claim.denialReasons?.join(', ') || '',
      notes: '',
    });
  };

  const handleSaveAdjudication = async () => {
    if (!adjForm) return;

    try {
      const { adjudicateClaim } = await import('@/lib/services/payment-service');
      // Map the form state to the service's positional args.
      // adjudicateClaim(claimId, approved, denied, writeOff, patientResponsibility, by)
      // The service derives final status from approved/denied amounts:
      //   denied > 0 && approved === 0  → 'denied'
      //   approved > 0                  → 'paid'
      //   else                          → 'partial'
      const allowed = Number.isFinite(adjForm.allowedAmount) ? Math.max(0, adjForm.allowedAmount) : 0;
      const paid = Number.isFinite(adjForm.paidAmount) ? Math.max(0, adjForm.paidAmount) : 0;
      const approved = adjForm.status === 'denied' ? 0 : paid;
      const denied = adjForm.status === 'denied' ? allowed : Math.max(0, allowed - paid);
      await adjudicateClaim(
        adjForm.claimId,
        approved,
        denied,
        0,
        0,
        currentUser?.name || 'Unknown'
      );

      // Reload claims
      if (scope) {
        const { getAllClaims } = await import('@/lib/services/payment-service');
        const updated = await getAllClaims(scope);
        setClaims(updated);
      }

      setEditingId(null);
      setAdjForm(null);
    } catch (error) {
      console.error('Failed to save adjudication:', error);
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
      <TopBar title={t('claims.title')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      <PageHeader
        icon={FileText}
        title={t('claims.title')}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <DataTile label={t('claims.kpiTotalClaims')} value={kpis.totalClaims} />
        <DataTile label={t('claims.kpiPendingReview')} value={kpis.pendingReview} hint={`SSP ${kpis.pendingAmount.toLocaleString()}`} tone={kpis.pendingReview > 0 ? 'warning' : 'default'} />
        <DataTile label={t('claims.kpiApprovedClaims')} value={kpis.approved} hint={`SSP ${kpis.approvedAmount.toLocaleString()}`} tone={kpis.approved > 0 ? 'ok' : 'default'} />
        <DataTile label={t('claims.kpiDeniedClaims')} value={kpis.denied} hint={`SSP ${kpis.deniedAmount.toLocaleString()}`} tone={kpis.denied > 0 ? 'danger' : 'default'} />
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
                  <span style={{ color: 'var(--text-muted)' }}>SSP {amount.toLocaleString()} · {pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--overlay-medium)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: PAYER_COLORS[payer] }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search and Filter Controls */}
      <FilterBar>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('claims.searchPlaceholder')}
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: t('claims.filterAll') },
            { value: 'draft', label: t('claims.status_draft') },
            { value: 'submitted', label: t('claims.status_submitted') },
            { value: 'accepted', label: t('claims.status_accepted') },
            { value: 'denied', label: t('claims.status_denied') },
            { value: 'paid', label: t('claims.status_paid') },
          ]}
          aria-label="Filter by status"
        />
      </FilterBar>

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
                  }}>{claim.patientName}</td>
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
                  }}>SSP {(claim.totalBilled || 0).toLocaleString()}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'right',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}>SSP {(claim.totalAllowed || 0).toLocaleString()}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'right',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}>SSP {(claim.totalApproved || 0).toLocaleString()}</td>
                  <td style={{
                    padding: '12px 20px',
                    textAlign: 'center',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '10px',
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
                    {(claim.status === 'submitted' || claim.status === 'draft') && (
                      <button
                        onClick={() => handleAdjudicate(claim)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--accent-primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
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
                        {t('claims.actionAdjudicate')}
                      </button>
                    )}
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
              <select
                value={adjForm.status}
                onChange={(e) =>
                  setAdjForm({
                    ...adjForm,
                    status: e.target.value as ClaimStatus,
                  })
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="draft">{t('claims.status_draft')}</option>
                <option value="submitted">{t('claims.status_submitted')}</option>
                <option value="accepted">{t('claims.status_accepted')}</option>
                <option value="denied">{t('claims.status_denied')}</option>
                <option value="paid">{t('claims.status_paid')}</option>
                <option value="appealed">{t('claims.status_appealed')}</option>
                <option value="partial">{t('claims.status_partial')}</option>
              </select>
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
                  borderRadius: '8px',
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
                  borderRadius: '8px',
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-card)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {adjForm.status === 'denied' && (
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
                    borderRadius: '8px',
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
                  borderRadius: '8px',
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
                  borderRadius: '8px',
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
                  borderRadius: '8px',
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
      </main>
    </>
  );
}
