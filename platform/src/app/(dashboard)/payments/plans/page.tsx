'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Wallet,
  AlertTriangle,
  CheckCircle,
  Search,
  Clock,
  CreditCard,
  Receipt,
} from '@/components/icons/lucide';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import type { PaymentPlanDoc, PaymentPlanStatus } from '@/lib/db-types-payments';

interface PaymentPlanKPIs {
  activePlans: number;
  totalOutstanding: number;
  delinquentPlans: number;
  completedThisMonth: number;
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'success' | 'primary' | 'danger' | 'warning';
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, color }) => {
  const colorMap = {
    success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)', text: 'var(--color-success)' },
    primary: { bg: 'var(--accent-light)', border: 'var(--accent-primary)', text: 'var(--accent-primary)' },
    danger: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger)', text: 'var(--color-danger)' },
    warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', text: 'var(--color-warning)' },
  };

  const { bg, border } = colorMap[color];

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--card-shadow)',
        borderTop: `3px solid ${border}`,
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div className="icon-box-sm" style={{ backgroundColor: bg }}>
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            letterSpacing: '0.5px',
            marginBottom: '0.5rem',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
};

export default function PaymentPlansPage() {
  const { currentUser } = useApp();
  const [plans, setPlans] = useState<PaymentPlanDoc[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<PaymentPlanDoc[]>([]);
  const [kpis, setKpis] = useState<PaymentPlanKPIs>({
    activePlans: 0,
    totalOutstanding: 0,
    delinquentPlans: 0,
    completedThisMonth: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [recordingPlanId, setRecordingPlanId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
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

    const loadPlans = async () => {
      try {
        const { getAllPaymentPlans } = await import('@/lib/services/payment-service');
        const plansData = await getAllPaymentPlans(scope);
        if (cancelled) return;
        setPlans(plansData);

        // Calculate KPIs
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const kpiData: PaymentPlanKPIs = {
          activePlans: 0,
          totalOutstanding: 0,
          delinquentPlans: 0,
          completedThisMonth: 0,
        };

        plansData.forEach((plan) => {
          const outstanding = Math.max(0, plan.totalBalance - plan.paidToDate);

          if (plan.status === 'active') {
            kpiData.activePlans++;
            kpiData.totalOutstanding += outstanding;

            // Check if delinquent
            const nextDueDate = new Date(plan.nextDueDate || '');
            if (nextDueDate < now && outstanding > 0) {
              kpiData.delinquentPlans++;
            }
          } else if (
            plan.status === 'completed' &&
            new Date(plan.lastPaymentDate || '') >= thisMonth
          ) {
            kpiData.completedThisMonth++;
          }
        });

        if (cancelled) return;
        setKpis(kpiData);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load payment plans:', error);
        setLoading(false);
      }
    };

    loadPlans();
    return () => { cancelled = true; };
  }, [scope]);

  useEffect(() => {
    let filtered = plans;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((plan) =>
        plan.patientName?.toLowerCase().includes(query)
      );
    }

    setFilteredPlans(filtered);
  }, [plans, searchQuery]);

  const handleRecordPayment = async () => {
    if (!recordingPlanId || !paymentAmount) return;

    // Reject NaN / zero / negative — the plain `number` input lets the
    // cashier submit garbage that would otherwise corrupt the ledger.
    const amount = parseFloat(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    try {
      const { recordPlanPayment } = await import('@/lib/services/payment-service');
      const plan = plans.find(p => p._id === recordingPlanId);
      // Guard against divide-by-zero when monthlyAmount happens to be 0.
      const installmentNumber = plan && plan.monthlyAmount > 0
        ? Math.floor(plan.paidToDate / plan.monthlyAmount) + 1
        : 1;
      const paymentId = `PAY-${Date.now()}`;

      await recordPlanPayment(
        recordingPlanId,
        installmentNumber,
        paymentId,
        amount
      );

      // Reload plans
      if (scope) {
        const { getAllPaymentPlans } = await import('@/lib/services/payment-service');
        const updated = await getAllPaymentPlans(scope);
        setPlans(updated);
      }

      setRecordingPlanId(null);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (error) {
      console.error('Failed to record payment:', error);
    }
  };

  const handleCancel = () => {
    setRecordingPlanId(null);
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const getStatusBadgeStyle = (status: PaymentPlanStatus) => {
    const baseStyle = {
      fontSize: '0.625rem',
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: '10px',
      textTransform: 'uppercase' as const,
      display: 'inline-block',
    };

    const statusMap: Record<PaymentPlanStatus, { bg: string; color: string }> = {
      active: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
      delinquent: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
      completed: { bg: 'var(--accent-light)', color: 'var(--accent-primary)' },
      cancelled: { bg: 'var(--overlay-subtle)', color: 'var(--text-secondary)' },
      defaulted: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
    };

    const { bg, color } = statusMap[status] || statusMap.cancelled;
    return { ...baseStyle, backgroundColor: bg, color };
  };

  const getProgressPercentage = (plan: PaymentPlanDoc) => {
    if (plan.totalBalance === 0) return 0;
    return Math.min(100, (plan.paidToDate / plan.totalBalance) * 100);
  };

  const getOutstandingAmount = (plan: PaymentPlanDoc) => {
    return Math.max(0, plan.totalBalance - plan.paidToDate);
  };

  const getInstallmentDotColor = (status: string): string => {
    switch (status) {
      case 'paid':
        return 'var(--color-success)';
      case 'missed':
        return 'var(--color-danger)';
      case 'partial':
        return 'var(--color-warning)';
      default:
        return 'var(--border-light)';
    }
  };

  const renderInstallmentTimeline = (plan: PaymentPlanDoc) => {
    const installments = plan.installments || [];
    const maxDisplay = 6;
    const toShow = installments.slice(0, maxDisplay);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {toShow.map((inst, idx) => (
          <div
            key={idx}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: getInstallmentDotColor(inst.status),
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
            title={`Month ${inst.number}: ${inst.status}`}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.width = '12px';
              el.style.height = '12px';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.width = '10px';
              el.style.height = '10px';
            }}
          />
        ))}
        {installments.length > maxDisplay && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>
            +{installments.length - maxDisplay}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="page-container page-enter">
      <TopBar title="Payment Plans" />

      {/* KPI Cards Grid - 4 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          alignItems: 'stretch',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <KPICard
          icon={<BarChart3 size={34} style={{ color: 'var(--color-success)' }} />}
          label="Active Plans"
          value={kpis.activePlans}
          color="success"
        />
        <KPICard
          icon={<Wallet size={34} style={{ color: 'var(--accent-primary)' }} />}
          label="Total Outstanding"
          value={`SSP ${kpis.totalOutstanding.toLocaleString()}`}
          color="primary"
        />
        <KPICard
          icon={<AlertTriangle size={34} style={{ color: 'var(--color-danger)' }} />}
          label="Delinquent Plans"
          value={kpis.delinquentPlans}
          color="danger"
        />
        <KPICard
          icon={<CheckCircle size={34} style={{ color: 'var(--color-warning)' }} />}
          label="Completed This Month"
          value={kpis.completedThisMonth}
          color="warning"
        />
      </div>

      <hr className="section-divider" />

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            paddingLeft: '12px',
          }}
        >
          <Search
            size={16}
            style={{
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          />
          <input
            type="text"
            placeholder="Search by patient name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              outline: 'none',
              padding: '10px 12px 10px 8px',
              fontSize: '0.95rem',
              color: 'var(--text-primary)',
              backgroundColor: 'transparent',
              border: 'none',
            }}
          />
        </div>
      </div>

      <hr className="section-divider" />

      {/* Plans Grid - Card Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {loading ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '3rem 0',
              color: 'var(--text-secondary)',
            }}
          >
            Loading payment plans...
          </div>
        ) : filteredPlans.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '3rem 0',
              color: 'var(--text-secondary)',
            }}
          >
            No payment plans found
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const progressPercent = getProgressPercentage(plan);
            const outstanding = getOutstandingAmount(plan);

            const topBorderColor =
              plan.status === 'active'
                ? 'var(--color-success)'
                : plan.status === 'delinquent'
                  ? 'var(--color-danger)'
                  : 'var(--border-light)';

            return (
              <div
                key={plan._id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--card-radius)',
                  boxShadow: 'var(--card-shadow)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Top Progress Bar */}
                <div
                  style={{
                    height: '3px',
                    backgroundColor: 'var(--border-light)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progressPercent}%`,
                      background: `linear-gradient(90deg, ${topBorderColor} 0%, ${topBorderColor} 100%)`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                {/* Card Content */}
                <div className="data-row-divider-sm" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                  {/* Header: Patient Name + Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <h3
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          margin: 0,
                          marginBottom: '0.25rem',
                        }}
                      >
                        {plan.patientName}
                      </h3>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Plan ID: {plan._id?.substring(0, 8)}
                      </div>
                    </div>
                    <span style={getStatusBadgeStyle(plan.status)}>
                      {plan.status}
                    </span>
                  </div>

                  {/* Due Date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    <Clock size={14} style={{ color: 'var(--color-warning)' }} />
                    <div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Next Due
                      </div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {new Date(plan.nextDueDate || '').toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar Section */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                        }}
                      >
                        Progress
                      </span>
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {Math.round(progressPercent)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: '8px',
                        backgroundColor: 'var(--border-light)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${progressPercent}%`,
                          backgroundColor: 'var(--color-success)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Amount Summary: 3-column grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '1rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border-light)',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Total
                      </div>
                      <div
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        SSP {plan.totalBalance.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-success)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Paid
                      </div>
                      <div
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: 'var(--color-success)',
                        }}
                      >
                        SSP {plan.paidToDate.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-danger)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Remaining
                      </div>
                      <div
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: 'var(--color-danger)',
                        }}
                      >
                        SSP {outstanding.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Installment Timeline */}
                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--overlay-subtle)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      Installment Status
                    </div>
                    {renderInstallmentTimeline(plan)}
                  </div>

                  {/* Action Button */}
                  {plan.status === 'active' && (
                    <button
                      onClick={() => setRecordingPlanId(plan._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'var(--accent-hover, var(--accent-primary))';
                        (e.target as HTMLButtonElement).style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.backgroundColor = 'var(--accent-primary)';
                        (e.target as HTMLButtonElement).style.opacity = '1';
                      }}
                    >
                      <CreditCard size={16} />
                      Record Payment
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Record Payment Modal */}
      {recordingPlanId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={handleCancel}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--card-radius)',
              boxShadow: 'var(--card-shadow)',
              padding: '2rem',
              maxWidth: '450px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem',
                margin: 0,
              }}
            >
              Record Payment
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                Payment Amount (SSP)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-card)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                Notes (Optional)
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Add notes about this payment..."
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-card)',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  minHeight: '100px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--border-light)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--overlay-subtle)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--border-light)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={!paymentAmount}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: paymentAmount ? 'var(--color-success)' : 'var(--border-light)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: paymentAmount ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (paymentAmount) {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'var(--color-success)';
                    (e.target as HTMLButtonElement).style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (paymentAmount) {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'var(--color-success)';
                    (e.target as HTMLButtonElement).style.opacity = '1';
                  }
                }}
              >
                <Receipt size={16} />
                <span>Record Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
