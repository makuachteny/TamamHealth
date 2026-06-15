'use client';

// Payment-plan KPI summary cards — shared by the Collect Payment screen and the
// Payment Plans screen so the cashier sees the same at-a-glance figures, styled
// identically (tinted icon tile + label + value). Display-only: not selectable.

import { BarChart3, Wallet, AlertTriangle, CheckCircle } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { PaymentPlanDoc } from '@/lib/db-types-payments';

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}

function KpiCard({ icon, label, value, color, bg }: KpiCardProps) {
  return (
    <div
      className="dash-card"
      style={{ padding: '1rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.875rem', height: '100%' }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: bg, color }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.5px',
            marginBottom: '0.25rem',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 'clamp(1.125rem, 1.5vw, 1.375rem)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export interface PlanKpis {
  activePlans: number;
  totalOutstanding: number;
  delinquentPlans: number;
  completedThisMonth: number;
}

export function computePlanKpis(plans: PaymentPlanDoc[]): PlanKpis {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const kpis: PlanKpis = { activePlans: 0, totalOutstanding: 0, delinquentPlans: 0, completedThisMonth: 0 };

  for (const plan of plans) {
    const outstanding = Math.max(0, plan.totalBalance - plan.paidToDate);
    if (plan.status === 'active') {
      kpis.activePlans++;
      kpis.totalOutstanding += outstanding;
      const nextDueDate = new Date(plan.nextDueDate || '');
      if (nextDueDate < now && outstanding > 0) kpis.delinquentPlans++;
    } else if (plan.status === 'completed' && new Date(plan.lastPaymentDate || '') >= thisMonth) {
      kpis.completedThisMonth++;
    }
  }
  return kpis;
}

export default function PlanKpiCards({ plans }: { plans: PaymentPlanDoc[] }) {
  const { t } = useTranslation();
  const k = computePlanKpis(plans);

  return (
    <div className="stat-grid">
      <KpiCard
        icon={<BarChart3 size={22} style={{ color: 'var(--accent-primary)' }} />}
        label={t('plans.kpiActivePlans')}
        value={k.activePlans}
        color="var(--accent-primary)"
        bg="rgba(59, 130, 246, 0.10)"
      />
      <KpiCard
        icon={<Wallet size={22} style={{ color: 'var(--color-warning)' }} />}
        label={t('plans.kpiTotalOutstanding')}
        value={`SSP ${k.totalOutstanding.toLocaleString()}`}
        color="var(--color-warning)"
        bg="rgba(228, 168, 75, 0.12)"
      />
      <KpiCard
        icon={<AlertTriangle size={22} style={{ color: 'var(--color-danger)' }} />}
        label={t('plans.kpiDelinquentPlans')}
        value={k.delinquentPlans}
        color="var(--color-danger)"
        bg="rgba(196, 69, 54, 0.12)"
      />
      <KpiCard
        icon={<CheckCircle size={22} style={{ color: 'var(--color-success)' }} />}
        label={t('plans.kpiCompletedThisMonth')}
        value={k.completedThisMonth}
        color="var(--color-success)"
        bg="rgba(27, 158, 119, 0.12)"
      />
    </div>
  );
}
