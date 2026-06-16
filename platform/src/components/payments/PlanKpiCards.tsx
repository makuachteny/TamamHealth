// Payment-plan KPI computation — the figures (active / outstanding / delinquent
// / completed-this-month) are rendered inline on the Payments screen using the
// shared DataTile, so this module just exposes the calculation.

import type { PaymentPlanDoc } from '@/lib/db-types-payments';

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
