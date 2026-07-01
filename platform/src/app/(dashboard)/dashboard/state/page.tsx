'use client';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardActionsRow from '@/components/dashboard/DashboardActionsRow';
import SpotlightCard from '@/components/dashboard/SpotlightCard';

import { useApp } from '@/lib/context';
import TopBar from '@/components/TopBar';
import RoleGuard from '@/components/RoleGuard';
import {
  Baby, Skull, HeartPulse, Syringe, Building2, MapPin, Activity, BarChart3,
} from '@/components/icons/lucide';
import { useMCHAnalytics } from '@/lib/hooks/useMCHAnalytics';
import { useBirths } from '@/lib/hooks/useBirths';
import { useDeaths } from '@/lib/hooks/useDeaths';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { jubaYearMonth } from '@/lib/time-juba';
import { useTranslation } from '@/lib/i18n/useTranslation';

function countByState(
  agg: Record<string, number> | undefined,
  stateName: string,
): number {
  if (!agg) return 0;
  return agg[stateName] ?? 0;
}

export default function StateDashboardPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const stateName = (currentUser as unknown as { state?: string } | null)?.state || '';

  const { data: mch, loading: mchLoading } = useMCHAnalytics();
  const { births } = useBirths();
  const { deaths } = useDeaths();
  const { stats: immStats } = useImmunizations();
  const { hospitals } = useHospitals();

  const thisMonth = jubaYearMonth();
  const stateBirthsThisMonth = births.filter(
    b => b.state === stateName && b.dateOfBirth?.startsWith(thisMonth),
  ).length;
  const stateDeathsThisMonth = deaths.filter(
    d => d.state === stateName && d.dateOfDeath?.startsWith(thisMonth),
  ).length;
  const facilitiesInState = hospitals.filter(h => h.state === stateName);
  const anc1ForState = mch?.ancCascade?.byState?.[stateName]?.anc1 ?? 0;
  const ancTotalForState = mch?.ancCascade?.byState?.[stateName]?.total ?? 0;
  const anc1Rate = ancTotalForState > 0 ? Math.round((anc1ForState / ancTotalForState) * 100) : 0;

  // Counties within this state from the byCounty rollup (keyed `${state}::${county}`).
  const counties: Array<{ county: string; birthCount: number; deathCount: number; ancTotal: number }> = [];
  const byCounty = mch?.ancCascade?.byCounty ?? {};
  for (const [key, val] of Object.entries(byCounty)) {
    const [s, c] = key.split('::');
    if (s !== stateName) continue;
    counties.push({
      county: c,
      birthCount: countByState(undefined, c), // birth count by county is not yet aggregated; fall back below
      deathCount: 0,
      ancTotal: val.total,
    });
  }
  // Fallback: derive county births/deaths from raw streams when the rollup is empty for them.
  for (const b of births) {
    if (b.state !== stateName || !b.county) continue;
    const row = counties.find(c => c.county === b.county);
    if (row) row.birthCount += 1;
    else counties.push({ county: b.county, birthCount: 1, deathCount: 0, ancTotal: 0 });
  }
  for (const d of deaths) {
    if (d.state !== stateName || !d.county) continue;
    const row = counties.find(c => c.county === d.county);
    if (row) row.deathCount += 1;
    else counties.push({ county: d.county, birthCount: 0, deathCount: 1, ancTotal: 0 });
  }
  counties.sort((a, b) => a.county.localeCompare(b.county));

  return (
    <RoleGuard>
      <TopBar title={t('state.title')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

        <DashboardHero
          className="mb-5"
          stats={[
            { label: 'Births (mo)', value: stateBirthsThisMonth },
            { label: 'Deaths (mo)', value: stateDeathsThisMonth },
            { label: 'Facilities', value: facilitiesInState.length },
            { label: 'ANC-1 Rate', value: `${anc1Rate}%` },
          ]}
        />

        <DashboardActionsRow
          className="mb-5"
          actions={[
            { label: 'Hospitals', icon: Building2, href: '/hospitals' },
            { label: 'MCH Analytics', icon: HeartPulse, href: '/mch-analytics', color: '#EC4899' },
            { label: 'Surveillance', icon: Activity, href: '/surveillance', color: '#C44536' },
            { label: 'Reports', icon: BarChart3, href: '/reports', color: 'var(--accent-primary)' },
          ]}
          secondaryCard={<SpotlightCard title="ANC-1 Coverage" value={`${anc1Rate}%`} caption={`${facilitiesInState.length} facilities in state`} href="/mch-analytics" />}
        />

        {/* COMMAND CENTER HEADER (matches the nurse dashboard) */}
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 44 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'transparent' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>{stateName || t('state.title')}</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {stateName ? t('state.subtitle', { facilities: facilitiesInState.length, counties: counties.length }) : t('state.noStateAssigned')}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ KPI TILES ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <Kpi label={t('state.birthsThisMonth')} value={stateBirthsThisMonth} icon={Baby} />
          <Kpi label={t('state.deathsThisMonth')} value={stateDeathsThisMonth} icon={Skull} />
          <Kpi label={t('state.anc1Coverage')} value={`${anc1Rate}%`} icon={HeartPulse} />
          <Kpi label={t('state.immunizationsYtd')} value={immStats?.totalVaccinations ?? 0} icon={Syringe} />
        </div>

        {/* ═══ COUNTIES ═══ */}
        <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <MapPin className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('state.countiesIn', { state: stateName || '—' })}</h3>
          </div>
          {mchLoading && counties.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <MapPin className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.6 }} /> {t('status.loading')}
            </div>
          ) : counties.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <MapPin className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.6 }} /> {t('state.noCountyData')}
            </div>
          ) : (
            <div className="p-4 space-y-2" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {counties.map(c => (
                <div
                  key={c.county}
                  className="w-full flex items-center justify-between p-3 rounded-xl text-left"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
                >
                  <div>
                    <p className="font-medium text-sm">{c.county}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {t('state.countyStats', { births: c.birthCount, deaths: c.deathCount, anc: c.ancTotal })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </RoleGuard>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <div className="dash-card" style={{ padding: '14px 16px' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="icon-box-sm">
          <Icon className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
        </div>
        <span className="kpi-card-title">{label}</span>
      </div>
      <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
