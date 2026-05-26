'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/lib/context';
import {
  BarChart3, Users, FlaskConical, ArrowRightLeft, Building2, TrendingUp,
  Activity,
} from '@/components/icons/lucide';
import type { HospitalDoc, PatientDoc, LabResultDoc, ReferralDoc, UserRole } from '@/lib/db-types';
import type { DataScope } from '@/lib/services/data-scope';

// Dynamically import Recharts to avoid SSR issues
import dynamic from 'next/dynamic';

const RechartsBarChart = dynamic(
  () => import('recharts').then(mod => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } = mod;

    function ChartComponent({ data, brandColor }: { data: { name: string; patients: number }[]; brandColor: string }) {
      const barColors = [brandColor, 'var(--accent-primary)', 'var(--color-success)', 'var(--color-warning)', '#EC4899', '#06B6D4', '#8B5CF6', '#14B8A6'];

      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#888' }}
              angle={-35}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            />
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
  const [hospitals, setHospitals] = useState<HospitalDoc[]>([]);
  const [patients, setPatients] = useState<PatientDoc[]>([]);
  const [labResults, setLabResults] = useState<LabResultDoc[]>([]);
  const [referrals, setReferrals] = useState<ReferralDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const brandColor = currentUser?.branding?.primaryColor || '#7C3AED';

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
      label: 'Total Patients',
      value: patients.length,
      icon: Users,
      color: brandColor,
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Lab Results',
      value: labResults.length,
      icon: FlaskConical,
      color: '#06B6D4',
      trend: `${labResults.filter(l => l.status === 'completed').length} completed`,
      trendUp: true,
    },
    {
      label: 'Active Referrals',
      value: activeReferrals,
      icon: ArrowRightLeft,
      color: 'var(--color-warning)',
      trend: `${referrals.length} total`,
      trendUp: false,
    },
    {
      label: 'Facilities',
      value: hospitals.length,
      icon: Building2,
      color: 'var(--accent-primary)',
      trend: 'Across org',
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
        <TopBar title="Organization Analytics" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Organization Analytics" />

      <div className="page-container page-enter">
        <PageHeader
          icon={BarChart3}
          title="Analytics"
          subtitle={`Organization-wide data insights for ${currentUser?.organization?.name || 'your organization'}`}
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="p-5 rounded-xl"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${card.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {card.label}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {card.value.toLocaleString()}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3" style={{ color: card.trendUp ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: card.trendUp ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                    {card.trend}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patients Per Hospital Chart */}
          <div className="lg:col-span-2 p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5" style={{ color: brandColor }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Patients per Hospital
              </h2>
            </div>

            {patientsPerHospital.length > 0 ? (
              <RechartsBarChart data={patientsPerHospital} brandColor={brandColor} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No hospital data available.
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Lab Results Breakdown */}
            <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical className="w-5 h-5" style={{ color: '#06B6D4' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Lab Results
                </h2>
              </div>

              <div className="space-y-3">
                <ProgressRow label="Completed" count={labCompleted} total={labTotal} color="#1B9AAA" />
                <ProgressRow label="In Progress" count={labInProgress} total={labTotal} color="#F59E0B" />
                <ProgressRow label="Pending" count={labPending} total={labTotal} color="#E52E42" />
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{labResults.length}</span>
                </div>
              </div>
            </div>

            {/* Top Hospitals by Activity */}
            <div className="p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Top Facilities (Today)
                </h2>
              </div>

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
                        {h.todayVisits || 0} visits
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm py-2 text-center" style={{ color: 'var(--text-muted)' }}>No facilities.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Referrals Overview Table */}
        <div className="mt-6 p-5 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-4">
            <ArrowRightLeft className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recent Referrals
            </h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: `${brandColor}10`, color: brandColor }}>
              {referrals.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>Patient</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>From</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>To</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>Status</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No referrals found.
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
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {ref.patientName || '-'}
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
