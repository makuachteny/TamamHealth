'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import {
  PieChart as PieChartIcon, TrendingUp, Users, HeartPulse, Building2
} from '@/components/icons/lucide';
import EmptyState from '@/components/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, CartesianGrid, Legend
} from 'recharts';
import ChartCard, { tooltipStyle as chartTooltipStyle, axisTick } from '@/components/ChartCard';

interface OrgDataPoint {
  name: string;
  patients: number;
  users: number;
  color: string;
}

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { organizations, loading: orgsLoading, getStats } = useOrganizations();

  const [orgData, setOrgData] = useState<OrgDataPoint[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Access control
  useEffect(() => {
    if (currentUser && currentUser.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Load per-org stats
  useEffect(() => {
    if (organizations.length === 0) return;
    const load = async () => {
      setDataLoading(true);
      const dataPoints: OrgDataPoint[] = [];
      for (const org of organizations) {
        try {
          const stats = await getStats(org._id);
          dataPoints.push({
            name: org.name.length > 18 ? org.name.slice(0, 16) + '...' : org.name,
            patients: stats.patientCount,
            users: stats.userCount,
            color: org.primaryColor || 'var(--color-success)',
          });
        } catch {
          dataPoints.push({
            name: org.name.length > 18 ? org.name.slice(0, 16) + '...' : org.name,
            patients: 0,
            users: 0,
            color: org.primaryColor || 'var(--color-success)',
          });
        }
      }
      setOrgData(dataPoints);
      setDataLoading(false);
    };
    load();
  }, [organizations, getStats]);

  if (!currentUser || currentUser.role !== 'super_admin') return null;

  // Plan distribution data for pie chart
  const planDistribution = [
    { name: t('analytics.planBasic'), value: organizations.filter(o => o.subscriptionPlan === 'basic').length, color: '#6B7280' },
    { name: t('analytics.planProfessional'), value: organizations.filter(o => o.subscriptionPlan === 'professional').length, color: '#2191D0' },
    { name: t('analytics.planEnterprise'), value: organizations.filter(o => o.subscriptionPlan === 'enterprise').length, color: 'var(--accent-primary)' },
  ].filter(d => d.value > 0);

  // Status distribution for pie chart
  const statusDistribution = [
    { name: t('analytics.statusActive'), value: organizations.filter(o => o.subscriptionStatus === 'active').length, color: 'var(--color-success)' },
    { name: t('analytics.statusTrial'), value: organizations.filter(o => o.subscriptionStatus === 'trial').length, color: 'var(--color-warning)' },
    { name: t('analytics.statusSuspended'), value: organizations.filter(o => o.subscriptionStatus === 'suspended').length, color: 'var(--color-danger)' },
    { name: t('analytics.statusCancelled'), value: organizations.filter(o => o.subscriptionStatus === 'cancelled').length, color: 'var(--text-muted)' },
  ].filter(d => d.value > 0);

  // Growth chart. There is no historical timeseries source yet, so in demo
  // mode we synthesize a smoothly-rising curve from the current totals so the
  // chart is not empty. In production this collapses to a flat zero line —
  // an empty chart is far less harmful than fabricated growth statistics
  // shown to operators making trend decisions.
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  const totalUsers = orgData.reduce((sum, d) => sum + d.users, 0);
  const totalPatients = orgData.reduce((sum, d) => sum + d.patients, 0);
  const showSyntheticGrowth = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
  const growthData = months.map((month, i) => {
    if (!showSyntheticGrowth) {
      return { month, users: 0, patients: 0, organizations: 0 };
    }
    const factor = 0.5 + (i * 0.1);
    return {
      month,
      users: Math.round(totalUsers * factor) || Math.round((i + 1) * 5),
      patients: Math.round(totalPatients * factor) || Math.round((i + 1) * 20),
      organizations: Math.round(organizations.length * (0.6 + i * 0.08)) || (i + 1),
    };
  });

  const totalPatientsAll = orgData.reduce((s, d) => s + d.patients, 0);
  const totalUsersAll = orgData.reduce((s, d) => s + d.users, 0);

  return (
    <>
      <TopBar title={t('analytics.title')} />
      <main className="page-container page-enter">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {[
            { label: t('analytics.totalOrganizations'), value: organizations.length, icon: Building2, color: 'var(--color-danger)' },
            { label: t('analytics.totalUsers'), value: totalUsersAll, icon: Users, color: '#2191D0' },
            { label: t('patients.kpiTotalPatients'), value: totalPatientsAll, icon: HeartPulse, color: 'var(--color-success)' },
            { label: t('analytics.avgPatientsPerOrg'), value: organizations.length > 0 ? Math.round(totalPatientsAll / organizations.length) : 0, icon: TrendingUp, color: 'var(--color-warning)' },
          ].map(stat => (
            <div key={stat.label} className="dash-card" style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="icon-box-sm">
                  <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                </div>
                <span className="kpi-card-title">{stat.label}</span>
              </div>
              <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800 }}>{stat.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Charts Row 1: Bar Chart + Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Patients per Org Bar Chart */}
          <ChartCard
            title={t('analytics.patientsPerOrganization')}
            defaultType="bar"
            defaultPeriod="month"
            className="lg:col-span-2"
          >
            {({ chartType }) => {
              if (dataLoading || orgsLoading) {
                return <div className="flex items-center justify-center h-64"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('analytics.loadingChartData')}</p></div>;
              }
              if (orgData.length === 0) {
                return <div className="flex items-center justify-center h-64"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('status.noData')}</p></div>;
              }
              const commonProps = { data: orgData, margin: { top: 5, right: 10, left: 0, bottom: 5 } };
              if (chartType === 'area') {
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart {...commonProps}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="name" tick={axisTick} />
                      <YAxis tick={axisTick} />
                      <Tooltip {...chartTooltipStyle} />
                      <Area type="monotone" dataKey="patients" stroke="#2191D0" fill="#2191D0" fillOpacity={0.12} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              }
              if (chartType === 'line') {
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart {...commonProps}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="name" tick={axisTick} />
                      <YAxis tick={axisTick} />
                      <Tooltip {...chartTooltipStyle} />
                      <Line type="monotone" dataKey="patients" stroke="#2191D0" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                );
              }
              return (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart {...commonProps}>
                    <XAxis dataKey="name" tick={axisTick} />
                    <YAxis tick={axisTick} />
                    <Tooltip {...chartTooltipStyle} />
                    <Bar dataKey="patients" fill="#2191D0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            }}
          </ChartCard>

          {/* Pie Charts */}
          <div className="grid grid-cols-1 gap-4">
            {/* Plan Distribution */}
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <PieChartIcon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('analytics.plansHeading')}</h3>
              </div>
              <div className="p-4">
              {planDistribution.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('analytics.noDataShort')}</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={planDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={30}>
                        {planDistribution.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="data-row-divider-sm">
                    {planDistribution.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        <span className="text-xs font-bold" style={{ color: d.color }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <PieChartIcon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('analytics.statusHeading')}</h3>
              </div>
              <div className="p-4">
              {statusDistribution.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('analytics.noDataShort')}</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={statusDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={30}>
                        {statusDistribution.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="data-row-divider-sm">
                    {statusDistribution.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        <span className="text-xs font-bold" style={{ color: d.color }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 2: Growth Line Chart + Users per Org */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Growth Over Time */}
          <ChartCard
            title={t('analytics.growthTrendSimulated')}
            defaultType="line"
            defaultPeriod="month"
          >
            {({ chartType }) => {
              if (growthData.length === 0 || growthData.every(d => !d.users && !d.patients && !d.organizations)) {
                return (
                  <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EmptyState icon={TrendingUp} title="No data yet" message="No growth data to display for this period." />
                  </div>
                );
              }
              const commonProps = { data: growthData, margin: { top: 5, right: 10, left: 0, bottom: 5 } };
              const lines = [
                { key: 'users', color: '#2191D0', name: t('analytics.legendUsers') },
                { key: 'patients', color: '#059669', name: t('analytics.legendPatients') },
                { key: 'organizations', color: '#7C3AED', name: t('analytics.legendOrganizations') },
              ];
              if (chartType === 'area') {
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart {...commonProps}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="month" tick={axisTick} />
                      <YAxis tick={axisTick} />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {lines.map(l => <Area key={l.key} type="monotone" dataKey={l.key} stroke={l.color} fill={l.color} fillOpacity={0.12} strokeWidth={2} name={l.name} />)}
                    </AreaChart>
                  </ResponsiveContainer>
                );
              }
              if (chartType === 'bar') {
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart {...commonProps}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="month" tick={axisTick} />
                      <YAxis tick={axisTick} />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {lines.map(l => <Bar key={l.key} dataKey={l.key} fill={l.color} radius={[3, 3, 0, 0]} name={l.name} />)}
                    </BarChart>
                  </ResponsiveContainer>
                );
              }
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="month" tick={axisTick} />
                    <YAxis tick={axisTick} />
                    <Tooltip {...chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} name={l.name} />)}
                  </LineChart>
                </ResponsiveContainer>
              );
            }}
          </ChartCard>

          {/* Users per Org Bar Chart */}
          <ChartCard
            title={t('analytics.usersPerOrganization')}
            defaultType="bar"
            defaultPeriod="month"
          >
            {({ chartType }) => {
              if (dataLoading || orgsLoading) {
                return <div className="flex items-center justify-center h-64"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('status.loading')}</p></div>;
              }
              if (orgData.length === 0) {
                return <div className="flex items-center justify-center h-64"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('status.noData')}</p></div>;
              }
              const commonProps = { data: orgData, margin: { top: 5, right: 10, left: 0, bottom: 5 } };
              if (chartType === 'area') {
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart {...commonProps}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="name" tick={axisTick} />
                      <YAxis tick={axisTick} />
                      <Tooltip {...chartTooltipStyle} />
                      <Area type="monotone" dataKey="users" stroke="#D97706" fill="#D97706" fillOpacity={0.12} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              }
              if (chartType === 'line') {
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart {...commonProps}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="name" tick={axisTick} />
                      <YAxis tick={axisTick} />
                      <Tooltip {...chartTooltipStyle} />
                      <Line type="monotone" dataKey="users" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                );
              }
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart {...commonProps}>
                    <XAxis dataKey="name" tick={axisTick} />
                    <YAxis tick={axisTick} />
                    <Tooltip {...chartTooltipStyle} />
                    <Bar dataKey="users" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            }}
          </ChartCard>
        </div>

        {/* Per-Org Data Table */}
        <div className="dash-card overflow-hidden">
          <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <Building2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('analytics.organizationMetrics')}</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                {[t('analytics.colOrganization'), t('analytics.colPatients'), t('analytics.colUsers'), t('analytics.colPlan'), t('analytics.colStatus')].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {organizations.map((org, i) => {
                const data = orgData[i];
                return (
                  <tr key={org._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ background: org.primaryColor }}>
                          {org.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-success)' }}>{data?.patients ?? '...'}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#2191D0' }}>{data?.users ?? '...'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                        background: org.subscriptionPlan === 'enterprise' ? 'rgba(124,58,237,0.12)' : org.subscriptionPlan === 'professional' ? 'rgba(33, 145, 208, 0.12)' : 'rgba(107,114,128,0.12)',
                        color: org.subscriptionPlan === 'enterprise' ? 'var(--accent-primary)' : org.subscriptionPlan === 'professional' ? '#2191D0' : '#6B7280',
                      }}>{org.subscriptionPlan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full" style={{
                          background: org.subscriptionStatus === 'active' ? 'var(--color-success)' : org.subscriptionStatus === 'trial' ? 'var(--color-warning)' : 'var(--color-danger)',
                        }} />
                        <span style={{
                          color: org.subscriptionStatus === 'active' ? 'var(--color-success)' : org.subscriptionStatus === 'trial' ? 'var(--color-warning)' : 'var(--color-danger)',
                        }}>{org.subscriptionStatus}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </>
  );
}
