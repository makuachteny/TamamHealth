'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import RoleGuard from '@/components/RoleGuard';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Building2, Users, Wallet, BarChart3, ArrowRight,
  AlertTriangle, Download, HeartPulse, Bug, ShieldCheck, Receipt, Globe,
  LayoutDashboard,
} from '@/components/icons/lucide';

/**
 * Hospital Manager home — the single management cockpit. Aggregates the
 * facility-wide signals that used to be scattered across the doctor's
 * dashboard (epidemic intelligence, MCH analytics, the hospital network,
 * facility readiness and revenue) and routes the manager into each detail
 * view. Reads are local-first via the service layer.
 */
export default function HospitalManagerPage() {
  return (
    <RoleGuard>
      <HospitalManagerDashboard />
    </RoleGuard>
  );
}

interface ManagerStats {
  patients: number;
  facilities: number;
  revenue: number;
  outstanding: number;
  currency: string;
  readiness: number;
  activeDiseases: number;
  casesThisWeek: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  anc4Coverage: number;
  mchGrade: string;
  highRisk: number;
}

const RISK_COLORS: Record<string, string> = {
  low: 'var(--color-success)',
  moderate: 'var(--color-warning)',
  high: '#EA580C',
  critical: 'var(--color-danger)',
};

function HospitalManagerDashboard() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const facilityName = currentUser?.hospitalName || t('hospitalManager.yourFacility');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          { getAllPatients },
          { getAllHospitals },
          { getBillingSummary },
          { getAssessmentSummary },
          { getEpidemicIntelligence },
          { getMCHAnalytics },
        ] = await Promise.all([
          import('@/lib/services/patient-service'),
          import('@/lib/services/hospital-service'),
          import('@/lib/services/billing-service'),
          import('@/lib/services/facility-assessment-service'),
          import('@/lib/services/epidemic-intelligence-service'),
          import('@/lib/services/mch-analytics-service'),
        ]);

        const [patients, hospitals, billing, assess, epi, mch] = await Promise.all([
          getAllPatients(),
          getAllHospitals(),
          getBillingSummary(),
          getAssessmentSummary(),
          getEpidemicIntelligence(),
          getMCHAnalytics(),
        ]);

        if (cancelled) return;
        setStats({
          patients: patients.length,
          facilities: hospitals.length,
          revenue: billing.totalRevenue,
          outstanding: billing.totalOutstanding,
          currency: billing.currency,
          readiness: assess.avgOverallScore,
          activeDiseases: epi.summary.totalActiveDiseases,
          casesThisWeek: epi.summary.totalCasesThisWeek,
          riskLevel: epi.summary.overallRiskLevel,
          anc4Coverage: mch.summary.anc4PlusCoverage,
          mchGrade: mch.summary.overallGrade,
          highRisk: mch.summary.highRiskCount,
        });
      } catch (err) {
        console.error('Failed to load management overview:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const money = (n: number) =>
    `${stats?.currency || 'SSP'} ${Math.round(n).toLocaleString()}`;

  return (
    <>
      <TopBar />
      <main className="page-container">

        {/* COMMAND CENTER HEADER (matches the nurse dashboard) */}
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 44 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>{t('hospitalManager.title')}</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('hospitalManager.subtitle', { facility: facilityName })}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ KPI TILES ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
          {[
            { icon: Users, label: t('hospitalManager.kpiPatients'), value: loading ? '—' : String(stats?.patients ?? 0), tint: 'var(--accent-primary)' },
            { icon: Building2, label: t('hospitalManager.kpiFacilitiesInNetwork'), value: loading ? '—' : String(stats?.facilities ?? 0), tint: 'var(--accent-primary)' },
            { icon: Wallet, label: t('hospitalManager.kpiRevenueCollected'), value: loading ? '—' : money(stats?.revenue ?? 0), tint: 'var(--color-success)' },
            { icon: Receipt, label: t('hospitalManager.kpiOutstanding'), value: loading ? '—' : money(stats?.outstanding ?? 0), tint: 'var(--color-warning)' },
            { icon: ShieldCheck, label: t('hospitalManager.kpiFacilityReadiness'), value: loading ? '—' : `${stats?.readiness ?? 0}%`, tint: 'var(--accent-primary)' },
            { icon: AlertTriangle, label: t('hospitalManager.kpiEpidemicRisk'), value: loading ? '—' : (stats?.riskLevel ?? 'low').toUpperCase(), tint: RISK_COLORS[stats?.riskLevel ?? 'low'] },
          ].map(k => (
            <div key={k.label} className="dash-card" style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <k.icon className="w-3.5 h-3.5" style={{ color: k.tint }} />
                </div>
                <span className="kpi-card-title">{k.label}</span>
              </div>
              <div className="stat-value" style={{ color: 'var(--text-primary)', lineHeight: 1.05, fontWeight: 800, fontSize: 20 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ═══ INTELLIGENCE & MANAGEMENT ═══ */}
        <div className="dash-card overflow-hidden">
          <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <LayoutDashboard className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('hospitalManager.title')}</h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ManagementCard
            href="/epidemic-intelligence"
            icon={Bug}
            title={t('hospitalManager.epidemicIntelligence')}
            desc={t('hospitalManager.epidemicIntelligenceDesc')}
            stat={loading ? '' : t('hospitalManager.epidemicIntelligenceStat', { diseases: stats?.activeDiseases ?? 0, cases: stats?.casesThisWeek ?? 0 })}
          />
          <ManagementCard
            href="/mch-analytics"
            icon={HeartPulse}
            title={t('hospitalManager.mchAnalytics')}
            desc={t('hospitalManager.mchAnalyticsDesc')}
            stat={loading ? '' : t('hospitalManager.mchAnalyticsStat', { anc4: stats?.anc4Coverage ?? 0, grade: stats?.mchGrade ?? '—', highRisk: stats?.highRisk ?? 0 })}
          />
          <ManagementCard
            href="/hospitals"
            icon={Building2}
            title={t('hospitalManager.hospitalNetwork')}
            desc={t('hospitalManager.hospitalNetworkDesc')}
            stat={loading ? '' : t('hospitalManager.facilitiesStat', { count: stats?.facilities ?? 0 })}
          />
          <ManagementCard
            href="/my-facility"
            icon={Building2}
            title={t('hospitalManager.myFacility')}
            desc={t('hospitalManager.myFacilityDesc')}
            stat={t('hospitalManager.facilityConfiguration')}
          />
          <ManagementCard
            href="/payments"
            icon={Wallet}
            title={t('hospitalManager.revenueBills')}
            desc={t('hospitalManager.revenueBillsDesc')}
            stat={loading ? '' : t('hospitalManager.outstandingStat', { amount: money(stats?.outstanding ?? 0) })}
          />
          <ManagementCard
            href="/facility-assessments"
            icon={ShieldCheck}
            title={t('hospitalManager.facilityAssessments')}
            desc={t('hospitalManager.facilityAssessmentsDesc')}
            stat={loading ? '' : t('hospitalManager.avgReadinessStat', { pct: stats?.readiness ?? 0 })}
          />
          <ManagementCard
            href="/reports"
            icon={BarChart3}
            title={t('hospitalManager.reports')}
            desc={t('hospitalManager.reportsDesc')}
            stat={t('hospitalManager.viewReports')}
          />
          <ManagementCard
            href="/dhis2-export"
            icon={Download}
            title={t('hospitalManager.dhis2Export')}
            desc={t('hospitalManager.dhis2ExportDesc')}
            stat={t('hospitalManager.exportData')}
          />
          <ManagementCard
            href="/public-stats"
            icon={Globe}
            title={t('hospitalManager.publicStatistics')}
            desc={t('hospitalManager.publicStatisticsDesc')}
            stat={t('hospitalManager.viewStatistics')}
          />
          </div>
        </div>
      </main>
    </>
  );
}

function ManagementCard({
  href, icon: Icon, title, desc, stat,
}: { href: string; icon: typeof Users; title: string; desc: string; stat: string }) {
  return (
    <Link href={href} className="rounded-xl transition-all hover:bg-[var(--accent-light)]" style={{ display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', padding: 14, background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
          <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        </div>
        <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </div>
      <div>
        <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>{title}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</p>
      </div>
      {stat && (
        <div style={{ marginTop: 'auto', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-text)' }}>{stat}</div>
      )}
    </Link>
  );
}
