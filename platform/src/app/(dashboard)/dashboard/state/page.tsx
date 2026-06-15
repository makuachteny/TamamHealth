'use client';

import { useApp } from '@/lib/context';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import {
  Baby, Skull, HeartPulse, Syringe, Building2,
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
      <main className="page-container page-enter">
        <PageHeader
          icon={Building2}
          title={stateName || t('state.title')}
          subtitle={stateName ? t('state.subtitle', { facilities: facilitiesInState.length, counties: counties.length }) : t('state.noStateAssigned')}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Kpi label={t('state.birthsThisMonth')} value={stateBirthsThisMonth} icon={Baby} />
          <Kpi label={t('state.deathsThisMonth')} value={stateDeathsThisMonth} icon={Skull} />
          <Kpi label={t('state.anc1Coverage')} value={`${anc1Rate}%`} icon={HeartPulse} />
          <Kpi label={t('state.immunizationsYtd')} value={immStats?.totalVaccinations ?? 0} icon={Syringe} />
        </div>

        <div className="card-elevated p-5">
          <h3 className="font-semibold text-sm mb-3">{t('state.countiesIn', { state: stateName || '—' })}</h3>
          {mchLoading && counties.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('status.loading')}</p>
          ) : counties.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('state.noCountyData')}</p>
          ) : (
            <div className="space-y-2">
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
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <Icon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
