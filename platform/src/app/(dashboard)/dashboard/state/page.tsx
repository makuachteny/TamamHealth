'use client';
import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import RoleGuard from '@/components/RoleGuard';
import { useMCHAnalytics } from '@/lib/hooks/useMCHAnalytics';
import { useBirths } from '@/lib/hooks/useBirths';
import { useDeaths } from '@/lib/hooks/useDeaths';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { jubaYearMonth } from '@/lib/time-juba';
import { useTranslation } from '@/lib/i18n/useTranslation';
import EhrCareDashboard, { type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import EhrDayStatsChart, { type DayStatsItem } from '@/components/ehr/EhrDayStatsChart';
import { formatDateTitle, toIsoDate } from '@/components/ehr/EhrMiniCalendar';

function clockTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

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
  const { immunizations } = useImmunizations();
  const { hospitals } = useHospitals();

  // Shell state: single-tab work list plus a county-name search. Search is new
  // here — the bespoke layout had none — so it's a pure improvement.
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

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
  // "YTD" is meant literally — `getImmunizationStats().totalVaccinations` is an
  // all-time count, so derive the current-year figure from the raw records instead.
  const thisYear = thisMonth.slice(0, 4);
  const immunizationsYtd = immunizations.filter(i => i.status === 'completed' && i.dateGiven.startsWith(thisYear)).length;

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

  const query = search.trim().toLowerCase();
  const visibleCounties = query
    ? counties.filter(c => c.county.toLowerCase().includes(query))
    : counties;

  const dateLabel = formatDateTitle(toIsoDate(new Date()));
  const todayIso = toIsoDate(new Date());

  // Day statistics rail: counties are aggregates with no dated per-item work,
  // so row-derived bucketing (the shared shell's default) is meaningless here.
  // Built instead from the dated registry docs the page already loads — births
  // and deaths for this state — plotted at their real registration instant.
  const stateChartItems = useMemo<DayStatsItem[]>(() => [
    ...births.filter(b => b.state === stateName).map((b): DayStatsItem => ({
      date: b.createdAt.slice(0, 10), time: clockTime(b.createdAt), series: 0,
    })),
    ...deaths.filter(d => d.state === stateName).map((d): DayStatsItem => ({
      date: d.createdAt.slice(0, 10), time: clockTime(d.createdAt), series: 1,
    })),
  ], [births, deaths, stateName]);

  return (
    <RoleGuard>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <EhrCareDashboard
          title={t('state.title')}
          greetingName={currentUser?.name}
          dateLabel={dateLabel}
          tabs={[
            { key: 'all', label: t('state.countiesIn', { state: stateName || '—' }), count: counties.length },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchValue={search}
          searchPlaceholder={t('topbar.searchPlaceholder')}
          onSearchChange={setSearch}
          filters={[]}
          actions={[]}
          chart={(
            <EhrDayStatsChart
              items={stateChartItems}
              seriesNames={['Births', 'Deaths']}
              selectedDate={todayIso}
              todayIso={todayIso}
            />
          )}
          rows={visibleCounties.map((c): EhrCareDashboardRow => ({
            id: c.county,
            title: c.county,
            subtitle: t('state.countyStats', { births: c.birthCount, deaths: c.deathCount, anc: c.ancTotal }),
          }))}
          metrics={[
            { label: t('state.birthsThisMonth'), value: stateBirthsThisMonth },
            { label: t('state.deathsThisMonth'), value: stateDeathsThisMonth },
            { label: 'Facilities', value: facilitiesInState.length },
            { label: t('state.anc1Coverage'), value: `${anc1Rate}%` },
            { label: t('state.immunizationsYtd'), value: immunizationsYtd },
          ]}
          metricsTitle={t('state.title')}
          checklist={[]}
          missionTitle={t('state.title')}
          missionDescription={t('state.subtitle', { facilities: facilitiesInState.length, counties: counties.length })}
          emptyTitle={mchLoading && counties.length === 0 ? t('status.loading') : t('state.noCountyData')}
        />
      </main>
    </RoleGuard>
  );
}
