'use client';

import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useVitalStatistics } from '@/lib/hooks/useVitalStatistics';
import { Baby, Skull, AlertTriangle, Activity } from '@/components/icons/lucide';

export default function VitalStatisticsPage() {
  const { data, loading } = useVitalStatistics();

  if (loading || !data) return <><TopBar title="Vital Statistics" /><main className="page-container flex items-center justify-center"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading vital statistics...</p></main></>;

  const { birthStats, deathStats } = data;

  return (
    <>
      <TopBar title="Vital Statistics" />
      <main className="page-container page-enter">
        <PageHeader
          icon={Activity}
          title="National Vital Statistics"
          subtitle="Civil Registration and Vital Statistics (CRVS) — Republic of South Sudan"
        />

        {/* Birth Statistics */}
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-3"><Baby className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Birth Statistics</h2>
        <div className="kpi-grid mb-6">
          {[
            { label: 'Total Births', value: birthStats.total, icon: Baby, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)' },
            { label: 'This Month', value: birthStats.thisMonth, icon: Activity, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)' },
            { label: 'Male Births', value: birthStats.byGender.male, icon: Baby, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)' },
            { label: 'Female Births', value: birthStats.byGender.female, icon: Baby, color: 'var(--color-danger)', bg: 'rgba(229,46,66,0.12)' },
            { label: 'Caesarean Rate', value: `${birthStats.total ? Math.round(birthStats.byDeliveryType.caesarean / birthStats.total * 100) : 0}%`, icon: Activity, color: 'var(--color-warning)', bg: 'rgba(252,211,77,0.12)' },
          ].map(stat => (
            <div key={stat.label} className="kpi">
              <div className="icon-box-sm" style={{ background: stat.bg }}>
                <stat.icon style={{ color: stat.color }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{stat.value}</div>
                <div className="kpi__label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Births by State */}
        {Object.keys(birthStats.byState).length > 0 && (
          <div className="card-elevated p-4 mb-6">
            <h3 className="font-semibold text-sm mb-3">Births by State</h3>
            <hr className="section-divider" />
            <div className="space-y-2 data-row-divider-sm">
              {Object.entries(birthStats.byState).sort(([, a], [, b]) => b - a).map(([state, count]) => (
                <div key={state} className="flex items-center gap-3">
                  <span className="text-xs w-48 truncate" style={{ color: 'var(--text-secondary)' }}>{state}</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}>
                    <div className="h-full rounded-full" style={{ width: `${birthStats.total > 0 ? (count / birthStats.total) * 100 : 0}%`, background: 'var(--accent-primary)' }} />
                  </div>
                  <span className="text-sm font-bold w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Death Statistics */}
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-3 mt-6"><Skull className="w-4 h-4" style={{ color: 'var(--color-danger)' }} /> Mortality Statistics</h2>
        <div className="kpi-grid mb-6">
          {[
            { label: 'Total Deaths', value: deathStats.total, icon: Skull, color: 'var(--color-danger)', bg: 'rgba(229,46,66,0.12)' },
            { label: 'Maternal Deaths', value: deathStats.maternalDeaths, icon: Skull, color: 'var(--color-danger)', bg: 'rgba(229,46,66,0.12)' },
            { label: 'Under-5 Deaths', value: deathStats.under5Deaths, icon: AlertTriangle, color: 'var(--color-warning)', bg: 'rgba(252,211,77,0.12)' },
            { label: 'Neonatal Deaths', value: deathStats.neonatalDeaths, icon: AlertTriangle, color: 'var(--color-warning)', bg: 'rgba(252,211,77,0.12)' },
            { label: 'ICD-11 Coded', value: `${deathStats.total ? Math.round(deathStats.withICD11Code / deathStats.total * 100) : 0}%`, icon: Activity, color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)' },
          ].map(stat => (
            <div key={stat.label} className="kpi">
              <div className="icon-box-sm" style={{ background: stat.bg }}>
                <stat.icon style={{ color: stat.color }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{stat.value}</div>
                <div className="kpi__label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CRVS Indicators */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card-elevated p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} /> CRVS Registration Gaps</h3>
            <hr className="section-divider" />
            <div className="space-y-3 data-row-divider-sm">
              <div>
                <div className="flex justify-between text-xs mb-1"><span style={{ color: 'var(--text-secondary)' }}>Death Notification Rate</span><span className="font-bold">{deathStats.total ? Math.round(deathStats.notified / deathStats.total * 100) : 0}%</span></div>
                <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}><div className="h-full rounded-full" style={{ width: `${deathStats.total ? (deathStats.notified / deathStats.total) * 100 : 0}%`, background: 'var(--color-warning)' }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span style={{ color: 'var(--text-secondary)' }}>Death Registration Rate</span><span className="font-bold">{deathStats.total ? Math.round(deathStats.registered / deathStats.total * 100) : 0}%</span></div>
                <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}><div className="h-full rounded-full" style={{ width: `${deathStats.total ? (deathStats.registered / deathStats.total) * 100 : 0}%`, background: 'var(--color-danger)' }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span style={{ color: 'var(--text-secondary)' }}>ICD-11 Coding Rate</span><span className="font-bold">{deathStats.total ? Math.round(deathStats.withICD11Code / deathStats.total * 100) : 0}%</span></div>
                <div className="w-full h-2 rounded-full" style={{ background: 'var(--overlay-light)' }}><div className="h-full rounded-full" style={{ width: `${deathStats.total ? (deathStats.withICD11Code / deathStats.total) * 100 : 0}%`, background: 'var(--accent-primary)' }} /></div>
              </div>
            </div>
          </div>

          <div className="card-elevated p-4">
            <h3 className="font-semibold text-sm mb-3">Top Causes of Death</h3>
            <hr className="section-divider" />
            <div className="space-y-2 data-row-divider-sm">
              {deathStats.topCauses.slice(0, 5).map((c, i) => (
                <div key={c.code} className="flex items-center gap-2">
                  <span className="text-xs font-bold w-5" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>{c.code}</span>
                  <span className="text-xs flex-1 truncate">{c.cause}</span>
                  <span className="text-sm font-bold">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
