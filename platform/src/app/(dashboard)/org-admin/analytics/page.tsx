'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import PatientName from '@/components/PatientName';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Users, FlaskConical, ArrowRightLeft, Building2, TrendingUp,
} from '@/components/icons/lucide';
import type { HospitalDoc, PatientDoc, LabResultDoc, ReferralDoc, UserRole } from '@/lib/db-types';
import type { DataScope } from '@/lib/services/data-scope';

// Dynamically import Recharts to avoid SSR issues
import dynamic from 'next/dynamic';
import ChartCard from '@/components/ChartCard';
import type { ChartType } from '@/components/ChartCard';

const RechartsOrgChart = dynamic(
  () => import('recharts').then(mod => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, AreaChart, Area } = mod;

    function ChartComponent({ data, brandColor, chartType }: { data: { name: string; patients: number }[]; brandColor: string; chartType: ChartType }) {
      const barColors = [brandColor, 'var(--accent-primary)', 'var(--color-success)', 'var(--color-warning)', '#EC4899', '#06B6D4', '#8B5CF6', '#3B82F6'];
      const commonProps = { data, margin: { top: 5, right: 20, left: 0, bottom: 60 } };
      const xProps = { dataKey: 'name', tick: { fontSize: 10, fill: '#888' }, angle: -35, textAnchor: 'end' as const, height: 80, interval: 0 };
      const tooltipProps = { contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12 }, labelStyle: { color: 'var(--text-primary)', fontWeight: 600 } };

      if (chartType === 'area') {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id="orgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={brandColor} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
              <XAxis {...xProps} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip {...tooltipProps} />
              <Area type="monotone" dataKey="patients" stroke={brandColor} fill="url(#orgGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      if (chartType === 'line') {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
              <XAxis {...xProps} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip {...tooltipProps} />
              <Line type="monotone" dataKey="patients" stroke={brandColor} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
            <XAxis {...xProps} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="patients" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return ChartComponent;
  }),
  { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading chart...</div> }
);

export default function OrgAnalyticsPage() {
  const { currentUser } = useApp();
  const { t } = useTranslation();
  const [hospitals, setHospitals] = useState<HospitalDoc[]>([]);
  const [patients, setPatients] = useState<PatientDoc[]>([]);
  const [labResults, setLabResults] = useState<LabResultDoc[]>([]);
  const [referrals, setReferrals] = useState<ReferralDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const brandColor = currentUser?.branding?.primaryColor || 'var(--accent-primary)';

  useEffect(() => {
    if (!currentUser?.orgId) return;
    const load = async () => {
      try {
        const scope: DataScope = { orgId: currentUser.orgId, role: currentUser.role as UserRole };

        const [
          { getAllHospitals },
          { getAllPatients },
          { getAllLabResults },
          { getAllReferrals },
        ] = await Promise.all([
          import('@/lib/services/hospital-service'),
          import('@/lib/services/patient-service'),
          import('@/lib/services/lab-service'),
          import('@/lib/services/referral-service'),
        ]);

        const [h, p, l, r] = await Promise.all([
          getAllHospitals(scope),
          getAllPatients(scope),
          getAllLabResults(scope),
          getAllReferrals(scope),
        ]);

        setHospitals(h);
        setPatients(p);
        setLabResults(l);
        setReferrals(r);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.orgId, currentUser?.role]);

  // Patients per hospital chart data
  const patientsPerHospital = hospitals.map(h => ({
    name: h.name.length > 20 ? h.name.slice(0, 18) + '...' : h.name,
    patients: h.patientCount || patients.filter(p => p.registrationHospital === h._id).length,
  })).sort((a, b) => b.patients - a.patients);

  const activeReferrals = referrals.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length;

  const statCards = [
    {
      label: t('orgAnalytics.totalPatients'),
      value: patients.length,
      icon: Users,
      color: brandColor,
      trend: '+12%',
      trendUp: true,
    },
    {
      label: t('orgAnalytics.labResults'),
      value: labResults.length,
      icon: FlaskConical,
      color: '#06B6D4',
      trend: t('orgAnalytics.trendCompleted', { count: labResults.filter(l => l.status === 'completed').length }),
      trendUp: true,
    },
    {
      label: t('referralChain.activeReferrals'),
      value: activeReferrals,
      icon: ArrowRightLeft,
      color: 'var(--color-warning)',
      trend: t('orgAnalytics.totalCount', { count: referrals.length }),
      trendUp: false,
    },
    {
      label: t('orgAnalytics.facilities'),
      value: hospitals.length,
      icon: Building2,
      color: 'var(--accent-primary)',
      trend: t('orgAnalytics.acrossOrg'),
      trendUp: true,
    },
  ];

  // Top hospitals by activity
  const topHospitals = [...hospitals]
    .sort((a, b) => (b.todayVisits || 0) - (a.todayVisits || 0))
    .slice(0, 5);

  // Lab result breakdown
  const labPending = labResults.filter(l => l.status === 'pending').length;
  const labInProgress = labResults.filter(l => l.status === 'in_progress').length;
  const labCompleted = labResults.filter(l => l.status === 'completed').length;
  const labTotal = labResults.length || 1;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={t('orgAnalytics.topBarTitle')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={t('orgAnalytics.topBarTitle')} />

      <div className="page-container page-enter">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="dash-card"
                style={{ padding: '14px 16px' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-box-sm">
                    <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                  </div>
                  <span className="kpi-card-title">{card.label}</span>
                </div>
                <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800 }}>
                  {card.value.toLocaleString()}
                </div>
                <div className="flex items-center gap-1" style={{ marginTop: 6 }}>
                  <TrendingUp className="w-3 h-3" style={{ color: card.trendUp ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: 11, color: card.trendUp ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                    {card.trend}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Patients Per Hospital Chart */}
          <ChartCard
            title={t('orgAnalytics.patientsPerHospital')}
            defaultType="bar"
            defaultPeriod="month"
            className="lg:col-span-2"
          >
            {({ chartType }) => (
              patientsPerHospital.length > 0 ? (
                <RechartsOrgChart data={patientsPerHospital} brandColor={brandColor} chartType={chartType} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('orgAnalytics.noHospitalData')}
                </div>
              )
            )}
          </ChartCard>

          {/* Right Column */}
          <div className="flex flex-col gap-4">
            {/* Lab Results Breakdown */}
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <FlaskConical className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('orgAnalytics.labResults')}
                </h3>
              </div>
              <div className="p-4">
              <div className="space-y-3">
                <ProgressRow label={t('orgAnalytics.statusCompleted')} count={labCompleted} total={labTotal} color="#2191D0" />
                <ProgressRow label={t('orgAnalytics.statusInProgress')} count={labInProgress} total={labTotal} color="#F59E0B" />
                <ProgressRow label={t('orgAnalytics.statusPending')} count={labPending} total={labTotal} color="#E52E42" />
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('orgAnalytics.total')}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{labResults.length}</span>
                </div>
              </div>
              </div>
            </div>

            {/* Top Hospitals by Activity */}
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Building2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('orgAnalytics.topFacilitiesToday')}
                </h3>
              </div>
              <div className="p-4">
              <div className="space-y-2">
                {topHospitals.length > 0 ? (
                  topHospitals.map((h, i) => (
                    <div
                      key={h._id}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: i < topHospitals.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{
                            background: i === 0 ? brandColor : i === 1 ? 'var(--accent-primary)' : i === 2 ? 'var(--accent-hover)' : 'var(--text-muted)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm truncate max-w-[140px]" style={{ color: 'var(--text-primary)' }}>
                          {h.name}
                        </span>
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('orgAnalytics.visitsCount', { count: h.todayVisits || 0 })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm py-2 text-center" style={{ color: 'var(--text-muted)' }}>{t('orgAnalytics.noFacilities')}</p>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Referrals Overview Table */}
        <div className="dash-card overflow-hidden mt-4">
          <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <ArrowRightLeft className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('government.recentReferrals')}
            </h3>
            <span className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
              {t('orgAnalytics.totalCount', { count: referrals.length })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgAnalytics.colPatient')}</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgAnalytics.colFrom')}</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgAnalytics.colTo')}</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgAnalytics.colStatus')}</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgAnalytics.colDate')}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('orgAnalytics.noReferrals')}
                    </td>
                  </tr>
                ) : (
                  referrals.slice(0, 10).map(ref => {
                    const statusColor: Record<string, string> = {
                      sent: 'var(--color-warning)',
                      received: 'var(--accent-primary)',
                      seen: '#8B5CF6',
                      completed: 'var(--accent-primary)',
                      cancelled: '#6B7280',
                    };
                    return (
                      <tr key={ref._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td className="px-4 py-3">
                          {ref.patientName
                            ? <PatientName patientId={ref.patientId} name={ref.patientName} nameClassName="text-sm font-medium" />
                            : <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {ref.fromHospital || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {ref.toHospital || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                            style={{
                              background: `${statusColor[ref.status] || '#6B7280'}15`,
                              color: statusColor[ref.status] || '#6B7280',
                            }}
                          >
                            {ref.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {ref.referralDate ? new Date(ref.referralDate).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Progress bar helper
function ProgressRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{count}</span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-subtle)' }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
