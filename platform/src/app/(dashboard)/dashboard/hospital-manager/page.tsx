'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Building2, Users, Wallet, BarChart3, ArrowRight,
  AlertTriangle, Download, HeartPulse, Bug, ShieldCheck, Receipt, Globe,
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
        <PageHeader
          icon={Building2}
          title={t('hospitalManager.title')}
          subtitle={t('hospitalManager.subtitle', { facility: facilityName })}
        />

        {/* KPI strip */}
        <div className="stat-grid">
          <StatCard icon={Users} label={t('hospitalManager.kpiPatients')} value={loading ? '—' : String(stats?.patients ?? 0)} tint="var(--accent-primary)" />
          <StatCard icon={Building2} label={t('hospitalManager.kpiFacilitiesInNetwork')} value={loading ? '—' : String(stats?.facilities ?? 0)} tint="var(--accent-primary)" />
          <StatCard icon={Wallet} label={t('hospitalManager.kpiRevenueCollected')} value={loading ? '—' : money(stats?.revenue ?? 0)} tint="var(--color-success)" />
          <StatCard icon={Receipt} label={t('hospitalManager.kpiOutstanding')} value={loading ? '—' : money(stats?.outstanding ?? 0)} tint="var(--color-warning)" />
          <StatCard icon={ShieldCheck} label={t('hospitalManager.kpiFacilityReadiness')} value={loading ? '—' : `${stats?.readiness ?? 0}%`} tint="var(--accent-primary)" />
          <StatCard
            icon={AlertTriangle}
            label={t('hospitalManager.kpiEpidemicRisk')}
            value={loading ? '—' : (stats?.riskLevel ?? 'low').toUpperCase()}
            tint={RISK_COLORS[stats?.riskLevel ?? 'low']}
          />
        </div>

        {/* Intelligence + management entry points */}
        <div className="grid grid-cols-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
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
      </main>
    </>
  );
}

function StatCard({
  icon: Icon, label, value, tint,
}: { icon: typeof Users; label: string; value: string; tint: string }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat__icon" style={{ background: 'var(--accent-light)', color: tint }}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="dash-stat__value">{value}</div>
        <div className="dash-stat__label">{label}</div>
      </div>
    </div>
  );
}

function ManagementCard({
  href, icon: Icon, title, desc, stat,
}: { href: string; icon: typeof Users; title: string; desc: string; stat: string }) {
  return (
    <Link href={href} className="dash-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="icon-box" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
          <Icon className="w-4 h-4" />
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
