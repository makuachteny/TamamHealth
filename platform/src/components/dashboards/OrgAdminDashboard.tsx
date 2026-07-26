'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useDataScope } from '@/lib/hooks/useDataScope';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useUsers } from '@/lib/hooks/useUsers';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { useWards } from '@/lib/hooks/useWards';
import { formatMoney } from '@/lib/format-utils';
import {
  Building2, Users, CalendarClock, BedDouble, DollarSign,
  Wallet, Package, Receipt, BarChart3, TrendingUp, ChevronRight,
} from '@/components/icons/lucide';
import type { ClaimDoc } from '@/lib/db-types-payments';

/** Local-calendar-day ISO string (YYYY-MM-DD) — matches how appointmentDate
 *  is entered/stored (a calendar day, not a UTC instant). */
function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface BillingSummary {
  totalRevenue: number;
  totalOutstanding: number;
  totalWaived: number;
  billCount: number;
  paidCount: number;
  pendingCount: number;
  currency: string;
}

export default function OrgAdminDashboard() {
  const { currentUser } = useApp();
  const router = useRouter();
  const scope = useDataScope();

  const brandColor = currentUser?.branding?.primaryColor || 'var(--accent-primary)';

  const { hospitals, loading: hospitalsLoading } = useHospitals();
  const { users, loading: usersLoading } = useUsers();
  const { appointments, loading: appointmentsLoading } = useAppointments();
  const {
    admissions, activeAdmissions, totalBeds, occupiedBeds, availableBeds, occupancyRate,
    loading: wardsLoading,
  } = useWards();

  // Billing/claims/pharmacy aren't covered by a shared live-reload hook yet —
  // loaded directly from services (same pattern as FacilityManagementDashboard),
  // scoped org-wide via DataScope (org_admin is an admin role, so filterByScope
  // skips the per-hospital narrowing and returns every facility in the org).
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [payments, setPayments] = useState<{ amount: number; status: string; processedAt: string }[]>([]);
  const [claims, setClaims] = useState<ClaimDoc[]>([]);
  const [stockAlerts, setStockAlerts] = useState({ low: 0, critical: 0, expired: 0 });
  const [financialsLoading, setFinancialsLoading] = useState(true);

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    (async () => {
      setFinancialsLoading(true);
      try {
        const [
          { getBillingSummary },
          { getAllPayments, getAllClaims },
          { getAllInventory, classifyStockStatus },
        ] = await Promise.all([
          import('@/lib/services/billing-service'),
          import('@/lib/services/payment-service'),
          import('@/lib/services/pharmacy-inventory-service'),
        ]);
        const [summary, paymentDocs, claimDocs, inventoryDocs] = await Promise.all([
          getBillingSummary(scope),
          getAllPayments(scope),
          getAllClaims(scope),
          getAllInventory(scope),
        ]);
        if (cancelled) return;
        setBilling(summary);
        setPayments(paymentDocs);
        setClaims(claimDocs);
        const risky = { low: 0, critical: 0, expired: 0 };
        for (const item of inventoryDocs) {
          const status = classifyStockStatus(item);
          if (status === 'low' || status === 'critical' || status === 'expired') risky[status] += 1;
        }
        setStockAlerts(risky);
      } catch (err) {
        console.error('Failed to load org financial/pharmacy data:', err);
      } finally {
        if (!cancelled) setFinancialsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope]);

  const loading = hospitalsLoading || usersLoading || appointmentsLoading || wardsLoading || financialsLoading;

  // ─── Derived, org-wide counts ───
  const today = toIsoDate(new Date());
  // Admission/discharge/payment timestamps are stored as new Date().toISOString()
  // (UTC instants) — sliced consistently the same way elsewhere (NurseDashboard).
  const todayUtc = new Date().toISOString().slice(0, 10);

  const todaysVisits = useMemo(
    () => appointments.filter(a => a.appointmentDate === today).length,
    [appointments, today],
  );

  const admissionsToday = useMemo(
    () => admissions.filter(a => (a.admissionDate || '').slice(0, 10) === todayUtc).length,
    [admissions, todayUtc],
  );
  const dischargesToday = useMemo(
    () => admissions.filter(a => (a.dischargeDate || '').slice(0, 10) === todayUtc).length,
    [admissions, todayUtc],
  );

  const activeUsers = useMemo(() => users.filter(u => u.isActive !== false), [users]);

  const revenueToday = useMemo(
    () => payments
      .filter(p => p.status === 'posted' && (p.processedAt || '').slice(0, 10) === todayUtc)
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments, todayUtc],
  );

  const pendingClaims = useMemo(() => claims.filter(c => c.status === 'submitted'), [claims]);

  const totalStockAlerts = stockAlerts.low + stockAlerts.critical + stockAlerts.expired;

  const currency = billing?.currency || 'SSP';

  if (!currentUser) return null;

  const kpis = [
    {
      label: 'Active Facilities',
      value: hospitals.length.toLocaleString(),
      sub: `${hospitals.length === 1 ? '1 facility' : `${hospitals.length} facilities`} in your organization`,
      icon: Building2,
      color: brandColor,
    },
    {
      label: "Today's Visits",
      value: todaysVisits.toLocaleString(),
      sub: 'Appointments scheduled today, across facilities',
      icon: CalendarClock,
      color: 'var(--accent-primary)',
    },
    {
      label: 'Current Inpatients',
      value: activeAdmissions.length.toLocaleString(),
      sub: `${admissionsToday} admitted · ${dischargesToday} discharged today`,
      icon: BedDouble,
      color: '#8B5CF6',
    },
    {
      label: 'Staff Accounts Active',
      value: activeUsers.length.toLocaleString(),
      sub: `${users.length - activeUsers.length} inactive account${users.length - activeUsers.length === 1 ? '' : 's'}`,
      icon: Users,
      color: '#369FDA',
    },
    {
      label: 'Revenue Collected Today',
      value: formatMoney(revenueToday, { currency }),
      sub: `${formatMoney(billing?.totalOutstanding, { currency })} outstanding org-wide`,
      icon: DollarSign,
      color: 'var(--color-success)',
    },
  ];

  const riskTiles = [
    {
      key: 'stock',
      label: 'Pharmacy Stock Alerts',
      value: totalStockAlerts,
      detail: `${stockAlerts.critical} critical · ${stockAlerts.low} low · ${stockAlerts.expired} expired`,
      icon: Package,
      tone: totalStockAlerts > 0 ? 'warning' as const : 'ok' as const,
      onClick: () => router.push('/pharmacy'),
    },
    {
      key: 'claims',
      label: 'Pending Claims',
      value: pendingClaims.length,
      detail: `${claims.length} total claims submitted`,
      icon: Receipt,
      tone: pendingClaims.length > 0 ? 'warning' as const : 'ok' as const,
      onClick: () => router.push('/payments/claims'),
    },
    {
      key: 'billing',
      label: 'Outstanding Balance',
      value: formatMoney(billing?.totalOutstanding, { currency }),
      detail: `${billing?.pendingCount ?? 0} bills pending or partial`,
      icon: Wallet,
      tone: (billing?.totalOutstanding ?? 0) > 0 ? 'warning' as const : 'ok' as const,
      onClick: () => router.push('/payments'),
    },
    {
      key: 'beds',
      label: 'Bed Capacity',
      value: `${occupancyRate}%`,
      detail: `${availableBeds} available of ${totalBeds} beds`,
      icon: BedDouble,
      tone: occupancyRate >= 90 ? 'danger' as const : occupancyRate >= 75 ? 'warning' as const : 'ok' as const,
      onClick: () => router.push('/wards'),
    },
  ];

  const shortcuts = [
    { label: 'Facilities', desc: 'Manage hospitals & clinics', icon: Building2, path: '/hospitals' },
    { label: 'Manage Users', desc: 'Staff accounts & access', icon: Users, path: '/org-admin/users' },
    { label: 'Billing & Payments', desc: 'Cash flow, invoices', icon: Wallet, path: '/payments' },
    { label: 'Claims', desc: 'Insurance claim tracking', icon: Receipt, path: '/payments/claims' },
    { label: 'Reports', desc: 'Operational reporting', icon: BarChart3, path: '/reports' },
    { label: 'Analytics', desc: 'Org-wide trends', icon: TrendingUp, path: '/org-admin/analytics' },
    { label: 'Service Pricing', desc: 'Fee schedules & pricing', icon: DollarSign, path: '/org-admin/pricing' },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title="Organization Overview" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Organization Overview" />

      <div className="page-container page-enter">
        {/* ═══ KPI tiles ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
          {kpis.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="dash-card" style={{ padding: '14px 16px' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-box-sm">
                    <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                  </div>
                  <span className="kpi-card-title">{card.label}</span>
                </div>
                <div className="stat-value text-2xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800 }}>
                  {card.value}
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{card.sub}</p>
              </div>
            );
          })}
        </div>

        {/* ═══ Operational status strip ═══ */}
        <div className="dash-card overflow-hidden mb-4">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Operational Status</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            {riskTiles.map(tile => {
              const Icon = tile.icon;
              const toneColor = tile.tone === 'danger' ? 'var(--color-danger)' : tile.tone === 'warning' ? 'var(--color-warning)' : 'var(--color-success)';
              const toneBg = tile.tone === 'danger' ? 'rgba(229,46,66,0.08)' : tile.tone === 'warning' ? 'rgba(237,161,0,0.10)' : 'rgba(12,163,12,0.08)';
              return (
                <button
                  key={tile.key}
                  onClick={tile.onClick}
                  className="text-left rounded-xl p-3 transition-all hover:opacity-90"
                  style={{ background: toneBg, border: `1px solid ${toneColor}33` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="w-4 h-4" style={{ color: toneColor }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{tile.label}</span>
                  </div>
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{tile.value}</div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{tile.detail}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Shortcuts ═══ */}
        <div className="dash-card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quick Actions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            {shortcuts.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.path}
                  onClick={() => router.push(s.path)}
                  className="flex items-center gap-3 rounded-xl p-3.5 text-left transition-all hover:opacity-90"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
                >
                  <div className="icon-box-sm flex-shrink-0">
                    <Icon className="w-4 h-4" style={{ color: brandColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                    <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{s.desc}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
