'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from '@/components/icons/lucide';
import TopBar from '@/components/TopBar';
import { SearchInput, FilterBar, FilterSelect } from '@/components/filters';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { ClaimDoc, ClaimStatus } from '@/lib/db-types-payments';

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

  return (
    <main className="page-container page-enter">
      <TopBar title={t('claims.title')} />

      {/* KPI Cards - Premium Style with Top Border Accents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', alignItems: 'stretch', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Total Claims KPI */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          borderTop: '3px solid var(--color-info)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div className="icon-box-sm" style={{
              background: 'var(--color-info-bg)',
            }}>
              <FileText size={16} color="var(--color-info)" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: '1.2',
              }}>
                {kpis.totalClaims}
              </div>
              <div style={{
                fontSize: '0.6875rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                {t('claims.kpiTotalClaims')}
              </div>
            </div>
          </div>
        </div>

        {/* Pending Review KPI */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          borderTop: '3px solid var(--color-warning)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div className="icon-box-sm" style={{
              background: 'var(--color-warning-bg)',
            }}>
              <Clock size={16} color="var(--color-warning)" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: '1.2',
              }}>
                {kpis.pendingReview}
              </div>
              <div style={{
                fontSize: '0.6875rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                {t('claims.kpiPendingReview')}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                SSP {kpis.pendingAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Approved Claims KPI */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          borderTop: '3px solid var(--color-success)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div className="icon-box-sm" style={{
              background: 'var(--color-success-bg)',
            }}>
              <CheckCircle size={16} color="var(--color-success)" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: '1.2',
              }}>
                {kpis.approved}
              </div>
              <div style={{
                fontSize: '0.6875rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                {t('claims.kpiApprovedClaims')}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                SSP {kpis.approvedAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Denied Claims KPI */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          borderTop: '3px solid var(--color-danger)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div className="icon-box-sm" style={{
              background: 'var(--color-danger-bg)',
            }}>
              <XCircle size={16} color="var(--color-danger)" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: '1.2',
              }}>
                {kpis.denied}
              </div>
              <div style={{
                fontSize: '0.6875rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                {t('claims.kpiDeniedClaims')}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginTop: '0.5rem',
              }}>
                SSP {kpis.deniedAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="section-divider" />

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

      <hr className="section-divider" />

      {/* Claims Table - Premium Style */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--card-shadow)',
        overflowX: 'auto',
      }}>
        {loading ? (
          <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.9375rem',
          }}>
            {t('claims.loading')}
          </div>
        ) : filteredClaims.length === 0 ? (
          <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <AlertTriangle size={56} color="var(--text-muted)" />
            <div>
              <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)' }}>{t('claims.emptyTitle')}</p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {t('claims.emptyDescription')}
              </p>
            </div>
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
  );
}
