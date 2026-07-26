'use client';

/**
 * Ministry of Health — National Dashboard.
 *
 * Public-health intelligence workspace (WHO RHIS / DHIS2-aligned), answering:
 * "What is happening nationally, where is action needed, and can we trust the
 * data?" One screen of situation awareness — detailed work lives in the
 * module pages (surveillance, programs, CRVS, data quality, exchange).
 *
 * Every panel states its period and geography, and no number is invented:
 * each value is computed from the live local datasets (disease alerts,
 * facility assessments, immunization/ANC records, birth/death registrations,
 * DHIS2 sync log). Missing data renders as an explicit empty state.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { tooltipStyle, axisTick } from '@/components/ChartCard';
import {
  Siren, ClipboardPen, ChevronRight, Eye, Database, Download, Syringe, HeartPulse,
} from '@/components/icons/lucide';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useBirths } from '@/lib/hooks/useBirths';
import { useDeaths } from '@/lib/hooks/useDeaths';
import { getNationalDataQuality, type NationalDataQuality } from '@/lib/services/data-quality-service';
import { getImmunizationStats, getDefaulterStats } from '@/lib/services/immunization-service';
import { getANCStats } from '@/lib/services/anc-service';
import { getDhis2SyncLog, isDhis2Configured, getDhis2BaseUrlHost, isFullySynced, type Dhis2SyncLogDoc } from '@/lib/services/dhis2-sync-log-service';
import type { DiseaseAlertDoc } from '@/lib/db-types';

// Restrained public-health palette.
const BLUE = '#2a78d6';
const GREEN = '#199e70';
const RED = '#e34948';
const AMBER = '#eda100';
const DEEP = '#015697';

type ImmunizationStats = Awaited<ReturnType<typeof getImmunizationStats>>;
type ANCStats = Awaited<ReturnType<typeof getANCStats>>;
type DefaulterStats = Awaited<ReturnType<typeof getDefaulterStats>>;

// ── Ten-state tile-grid cartogram ────────────────────────────────────
// Approximate geographic layout (4 cols × 3 rows). A tile grid keeps every
// state readable and equal-weight — no distorted polygons, no fake precision.
const STATE_TILES: { name: string; abbr: string; col: number; row: number }[] = [
  { name: 'Northern Bahr el Ghazal', abbr: 'NBG', col: 0, row: 0 },
  { name: 'Unity', abbr: 'UNY', col: 2, row: 0 },
  { name: 'Upper Nile', abbr: 'UNL', col: 3, row: 0 },
  { name: 'Western Bahr el Ghazal', abbr: 'WBG', col: 0, row: 1 },
  { name: 'Warrap', abbr: 'WRP', col: 1, row: 1 },
  { name: 'Lakes', abbr: 'LKS', col: 2, row: 1 },
  { name: 'Jonglei', abbr: 'JGL', col: 3, row: 1 },
  { name: 'Western Equatoria', abbr: 'WEQ', col: 1, row: 2 },
  { name: 'Central Equatoria', abbr: 'CEQ', col: 2, row: 2 },
  { name: 'Eastern Equatoria', abbr: 'EEQ', col: 3, row: 2 },
];

type MapLayer = 'alerts' | 'completeness' | 'immunization' | 'facilities';

const MAP_LAYERS: { key: MapLayer; label: string; legend: string }[] = [
  { key: 'alerts', label: 'Alert cases', legend: 'Active surveillance alert cases' },
  { key: 'completeness', label: 'Reporting', legend: 'Avg reporting completeness (facility assessments)' },
  { key: 'immunization', label: 'Immunization', legend: 'Immunization records on file' },
  { key: 'facilities', label: 'Facilities', legend: 'Registered facilities' },
];

function isoWeekLabel(iso: string): { label: string; sortKey: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: iso || '?', sortKey: iso || '' };
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  const month = target.toLocaleString('en', { month: 'short', timeZone: 'UTC' });
  return { label: `W${week} ${month}`, sortKey: target.toISOString().slice(0, 10) };
}

function monthLabel(iso: string): { label: string; sortKey: string } | null {
  if (!iso || iso.length < 7) return null;
  const key = iso.slice(0, 7);
  const d = new Date(`${key}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return { label: d.toLocaleString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }), sortKey: key };
}

// Threshold tone for percentage indicators (WHO DQR-style traffic light).
function pctTone(value: number, amberBelow: number, redBelow: number): string {
  if (value < redBelow) return RED;
  if (value < amberBelow) return AMBER;
  return GREEN;
}

// ── Small presentational pieces ──────────────────────────────────────

function PanelHead({ title, meta, action }: { title: string; meta?: string; action?: React.ReactNode }) {
  return (
    <div className="px-4 pt-3.5 pb-2.5 flex items-baseline justify-between gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--border-light)' }}>
      <h3 className="text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <div className="flex items-center gap-3">
        {meta && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{meta}</span>}
        {action}
      </div>
    </div>
  );
}

/** Target-vs-actual bullet bar: filled actual, tick at target. */
function BulletRow({ label, actual, target, denominator }: { label: string; actual: number; target: number; denominator?: string }) {
  const tone = actual >= target ? GREEN : actual >= target - 15 ? AMBER : RED;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          <b style={{ color: tone }}>{actual}%</b> / target {target}%
        </span>
      </div>
      <div className="relative" style={{ height: 8, borderRadius: 4, background: 'var(--overlay-subtle)' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, actual)}%`, borderRadius: 4, background: tone }} />
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, target)}%`, width: 2, background: 'var(--text-primary)', opacity: 0.55 }} />
      </div>
      {denominator && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{denominator}</div>}
    </div>
  );
}

export default function GovernmentNationalDashboard() {
  const router = useRouter();
  const { alerts } = useSurveillance();
  const { hospitals } = useHospitals();
  const { births } = useBirths();
  const { deaths } = useDeaths();

  const [dq, setDq] = useState<NationalDataQuality | null>(null);
  const [imm, setImm] = useState<ImmunizationStats | null>(null);
  const [anc, setAnc] = useState<ANCStats | null>(null);
  const [defaulters, setDefaulters] = useState<DefaulterStats | null>(null);
  const [dhis2, setDhis2] = useState<Dhis2SyncLogDoc | null>(null);
  const [layer, setLayer] = useState<MapLayer>('alerts');
  const [selectedState, setSelectedState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dqRes, immRes, ancRes, defRes, logRes] = await Promise.all([
        getNationalDataQuality().catch(() => null),
        getImmunizationStats().catch(() => null),
        getANCStats().catch(() => null),
        getDefaulterStats().catch(() => null),
        getDhis2SyncLog().catch(() => null),
      ]);
      if (cancelled) return;
      setDq(dqRes); setImm(immRes); setAnc(ancRes); setDefaulters(defRes); setDhis2(logRes);
    })();
    return () => { cancelled = true; };
  }, []);

  const activeAlerts = useMemo(
    () => alerts.filter(a => a.alertLevel === 'watch' || a.alertLevel === 'warning' || a.alertLevel === 'emergency'),
    [alerts],
  );
  const emergencyCount = activeAlerts.filter(a => a.alertLevel === 'emergency').length;
  const warningCount = activeAlerts.filter(a => a.alertLevel === 'warning').length;

  // Outbreak risk — derived strictly from the worst active alert level.
  const outbreakRisk = emergencyCount > 0
    ? { label: 'High', tone: RED }
    : warningCount > 0
      ? { label: 'Elevated', tone: AMBER }
      : activeAlerts.length > 0
        ? { label: 'Guarded', tone: BLUE }
        : { label: 'Low', tone: GREEN };

  // ── Per-state aggregates for the map layers ──
  const stateAgg = useMemo(() => {
    const agg = new Map<string, { alertCases: number; facilities: number; immRecords: number; completenessSum: number; completenessN: number }>();
    const get = (s: string) => {
      const cur = agg.get(s) || { alertCases: 0, facilities: 0, immRecords: 0, completenessSum: 0, completenessN: 0 };
      agg.set(s, cur);
      return cur;
    };
    for (const a of alerts) { if (a.state) get(a.state).alertCases += a.cases || 0; }
    for (const h of hospitals) { if (h.state) get(h.state).facilities += 1; }
    for (const [state, count] of Object.entries(imm?.byState || {})) get(state).immRecords += count;
    for (const e of dq?.entries || []) {
      if (!e.state) continue;
      const cur = get(e.state);
      cur.completenessSum += e.reportingCompleteness;
      cur.completenessN += 1;
    }
    return agg;
  }, [alerts, hospitals, imm, dq]);

  const layerValue = (state: string): number | null => {
    const a = stateAgg.get(state);
    if (!a) return null;
    switch (layer) {
      case 'alerts': return a.alertCases;
      case 'facilities': return a.facilities;
      case 'immunization': return a.immRecords;
      case 'completeness': return a.completenessN > 0 ? Math.round(a.completenessSum / a.completenessN) : null;
    }
  };

  const layerMax = Math.max(1, ...STATE_TILES.map(s => layerValue(s.name) ?? 0));

  const tileStyle = (state: string): React.CSSProperties => {
    const v = layerValue(state);
    if (v === null || v === 0) {
      return { background: 'var(--overlay-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' };
    }
    if (layer === 'completeness') {
      // Threshold-colored (traffic light), not intensity — completeness is a
      // target indicator, not a magnitude.
      const tone = pctTone(v, 80, 60);
      return { background: `color-mix(in srgb, ${tone} 18%, #fff)`, color: 'var(--text-primary)', border: `1px solid color-mix(in srgb, ${tone} 45%, transparent)` };
    }
    const base = layer === 'alerts' ? RED : layer === 'immunization' ? GREEN : DEEP;
    const intensity = v / layerMax;
    const step = intensity > 0.75 ? 55 : intensity > 0.5 ? 40 : intensity > 0.25 ? 26 : 14;
    return {
      background: `color-mix(in srgb, ${base} ${step}%, #fff)`,
      color: step >= 55 ? '#fff' : 'var(--text-primary)',
      border: `1px solid color-mix(in srgb, ${base} 45%, transparent)`,
    };
  };

  // ── Priority watchlist (ranked action queue) ──
  const watchlist = useMemo(() => {
    type Item = { key: string; severity: number; title: string; detail: string; metric: string; tone: string; href: string };
    const items: Item[] = [];
    const rankedAlerts = [...activeAlerts].sort((a, b) => (b.cases || 0) - (a.cases || 0));
    for (const a of rankedAlerts) {
      if (a.alertLevel === 'emergency' || a.alertLevel === 'warning') {
        items.push({
          key: `alert-${(a as DiseaseAlertDoc & { _id?: string })._id || `${a.disease}-${a.county}`}`,
          severity: a.alertLevel === 'emergency' ? 0 : 1,
          title: `${a.disease} — ${a.county || a.state}`,
          detail: `${a.alertLevel === 'emergency' ? 'Emergency' : 'Warning'} alert · ${a.state} · trend ${a.trend}`,
          metric: `${(a.cases || 0).toLocaleString()} cases`,
          tone: a.alertLevel === 'emergency' ? RED : AMBER,
          href: '/government/alerts',
        });
      }
    }
    for (const e of [...(dq?.entries || [])].sort((a, b) => a.reportingCompleteness - b.reportingCompleteness)) {
      if (e.reportingCompleteness < 80) {
        items.push({
          key: `dq-${e.facilityId}`,
          severity: e.reportingCompleteness < 60 ? 1 : 2,
          title: e.facilityName,
          detail: `Reporting completeness below target · ${e.state}`,
          metric: `${e.reportingCompleteness}%`,
          tone: e.reportingCompleteness < 60 ? RED : AMBER,
          href: '/data-quality?view=completeness',
        });
      }
    }
    if ((defaulters?.totalDefaulters ?? 0) > 0) {
      items.push({
        key: 'immunization-defaulters',
        severity: 2,
        title: 'Immunization defaulters need tracing',
        detail: 'Children overdue for scheduled doses',
        metric: `${defaulters!.uniqueChildren.toLocaleString()} children`,
        tone: AMBER,
        href: '/immunizations',
      });
    }
    return items.sort((a, b) => a.severity - b.severity).slice(0, 8);
  }, [activeAlerts, dq, defaulters]);

  // ── Trends ──
  const weeklyCases = useMemo(() => {
    const byWeek = new Map<string, { week: string; cases: number; sortKey: string }>();
    for (const a of alerts) {
      if (!a.reportDate) continue;
      const { label, sortKey } = isoWeekLabel(a.reportDate);
      const cur = byWeek.get(label) || { week: label, cases: 0, sortKey };
      cur.cases += a.cases || 0;
      if (sortKey < cur.sortKey) cur.sortKey = sortKey;
      byWeek.set(label, cur);
    }
    return Array.from(byWeek.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-12);
  }, [alerts]);

  const vitalMonthly = useMemo(() => {
    const byMonth = new Map<string, { month: string; births: number; deaths: number; sortKey: string }>();
    const bump = (iso: string, key: 'births' | 'deaths') => {
      const m = monthLabel(iso);
      if (!m) return;
      const cur = byMonth.get(m.sortKey) || { month: m.label, births: 0, deaths: 0, sortKey: m.sortKey };
      cur[key] += 1;
      byMonth.set(m.sortKey, cur);
    };
    for (const b of births) bump(b.dateOfBirth || b.createdAt, 'births');
    for (const d of deaths) bump(d.dateOfDeath || d.createdAt, 'deaths');
    return Array.from(byMonth.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-6);
  }, [births, deaths]);

  // ── Registration completeness (certificate issued as proxy) ──
  const birthCert = births.length > 0 ? Math.round((births.filter(b => !!b.certificateNumber).length / births.length) * 100) : null;
  const deathCert = deaths.length > 0 ? Math.round((deaths.filter(d => !!d.certificateNumber).length / deaths.length) * 100) : null;

  const now = new Date();
  const periodLabel = now.toLocaleString('en', { month: 'long', year: 'numeric' });

  // Situation strip — the only factoid row on the page; everything else is a
  // working panel.
  const situation: { label: string; value: string; sub: string; tone?: string }[] = [
    { label: 'Reporting completeness', value: dq ? `${dq.avgCompleteness}%` : '—', sub: `${dq?.facilitiesReporting ?? 0}/${dq?.totalFacilities ?? 0} facilities`, tone: dq ? pctTone(dq.avgCompleteness, 80, 60) : undefined },
    { label: 'Reporting timeliness', value: dq ? `${dq.avgTimeliness}%` : '—', sub: 'Latest assessments', tone: dq ? pctTone(dq.avgTimeliness, 80, 60) : undefined },
    { label: 'Active alerts', value: String(activeAlerts.length), sub: `${emergencyCount} emergency · ${warningCount} warning`, tone: emergencyCount > 0 ? RED : warningCount > 0 ? AMBER : GREEN },
    { label: 'Outbreak risk', value: outbreakRisk.label, sub: 'Worst active alert level', tone: outbreakRisk.tone },
    { label: 'Fully immunized', value: imm ? `${imm.coverageRate}%` : '—', sub: `of ${imm?.totalChildren ?? 0} children with records`, tone: imm ? pctTone(imm.coverageRate, 90, 60) : undefined },
    { label: 'ANC 4+ visits', value: anc ? `${anc.anc4PlusRate}%` : '—', sub: `of ${anc?.totalMothers ?? 0} mothers with records`, tone: anc ? pctTone(anc.anc4PlusRate, 80, 50) : undefined },
    { label: 'Birth certificates', value: birthCert === null ? '—' : `${birthCert}%`, sub: `${births.length.toLocaleString()} births registered`, tone: birthCert === null ? undefined : pctTone(birthCert, 90, 60) },
    { label: 'Death certificates', value: deathCert === null ? '—' : `${deathCert}%`, sub: `${deaths.length.toLocaleString()} deaths registered`, tone: deathCert === null ? undefined : pctTone(deathCert, 90, 60) },
  ];

  const dhis2Configured = isDhis2Configured();
  const dhis2Host = getDhis2BaseUrlHost();
  const dhis2Ok = dhis2 ? isFullySynced(dhis2) : false;

  const selected = selectedState ? stateAgg.get(selectedState) : null;

  return (
    <main className="page-container page-enter">
      {/* ── Header: what/where/when — no decorative hero ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 style={{ fontFamily: 'var(--font-platform)', fontWeight: 500, fontSize: 24, lineHeight: 1.1, color: '#000' }}>
            National situation
          </h1>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
            South Sudan · National · {periodLabel} — computed live from facility-reported data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.push('/government/briefing')}>
            <ClipboardPen className="w-4 h-4" /> Executive briefing
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push('/government/alerts')}>
            <Siren className="w-4 h-4" /> Priority alerts
          </button>
        </div>
      </div>

      {/* ── Situation strip ── */}
      <div className="dash-card mb-3" style={{ padding: '10px 4px' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {situation.map((s, i) => (
            <div key={s.label} className="px-3 py-1.5" style={{ borderLeft: i % 8 === 0 ? 'none' : '1px solid var(--border-light)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
              <div className="text-[20px] font-extrabold tabular-nums leading-tight" style={{ color: s.tone || 'var(--text-primary)' }}>{s.value}</div>
              <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }} title={s.sub}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row: national map + priority watchlist ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-3">
        <div className="dash-card overflow-hidden lg:col-span-3">
          <PanelHead
            title="National map"
            meta={`${MAP_LAYERS.find(l => l.key === layer)?.legend} · National`}
            action={
              <div className="flex gap-1">
                {MAP_LAYERS.map(l => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLayer(l.key)}
                    className="text-[11px] font-bold px-2 py-1 rounded-full"
                    style={{
                      background: layer === l.key ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                      color: layer === l.key ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-4">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const col = i % 4; const row = Math.floor(i / 4);
                const tile = STATE_TILES.find(s => s.col === col && s.row === row);
                if (!tile) return <div key={i} />;
                const v = layerValue(tile.name);
                const isSelected = selectedState === tile.name;
                return (
                  <button
                    key={tile.abbr}
                    type="button"
                    onClick={() => setSelectedState(cur => cur === tile.name ? null : tile.name)}
                    title={tile.name}
                    className="text-left rounded-xl px-2.5 py-2 transition-shadow"
                    style={{
                      ...tileStyle(tile.name),
                      minHeight: 64,
                      outline: isSelected ? `2px solid ${DEEP}` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="text-[10px] font-bold tracking-wider">{tile.abbr}</div>
                    <div className="text-[17px] font-extrabold tabular-nums leading-tight">
                      {v === null ? '—' : layer === 'completeness' ? `${v}%` : v.toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Drill-down strip for the selected state */}
            <div className="mt-3 px-3 py-2 rounded-xl text-[12px] flex items-center gap-4 flex-wrap" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}>
              {selected && selectedState ? (
                <>
                  <b style={{ color: 'var(--text-primary)' }}>{selectedState}</b>
                  <span>{selected.facilities} facilities</span>
                  <span style={{ color: selected.alertCases > 0 ? RED : 'inherit' }}>{selected.alertCases.toLocaleString()} alert cases</span>
                  <span>{selected.immRecords.toLocaleString()} immunization records</span>
                  <span>{selected.completenessN > 0 ? `${Math.round(selected.completenessSum / selected.completenessN)}% reporting completeness` : 'no assessment on file'}</span>
                  <button type="button" className="ml-auto text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }} onClick={() => router.push('/hospitals')}>
                    Open facilities <ChevronRight className="w-3 h-3 inline" />
                  </button>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Select a state to drill down · tile values follow the active layer</span>
              )}
            </div>
          </div>
        </div>

        {/* Priority watchlist */}
        <div className="dash-card overflow-hidden lg:col-span-2 flex flex-col">
          <PanelHead title="Priority watchlist" meta="Needs follow-up · National" action={
            <button type="button" className="text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }} onClick={() => router.push('/government/alerts')}>
              All alerts <ChevronRight className="w-3 h-3 inline" />
            </button>
          } />
          {watchlist.length === 0 ? (
            <p className="text-[12px] p-6 text-center" style={{ color: 'var(--text-muted)' }}>
              Nothing needs national follow-up right now — no active warnings and all facilities at target.
            </p>
          ) : (
            <div className="show-scrollbar" style={{ overflowY: 'auto', maxHeight: 330 }}>
              {watchlist.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[var(--overlay-subtle)]"
                  style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.tone }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</span>
                    <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{item.detail}</span>
                  </span>
                  <span className="text-[12px] font-bold tabular-nums whitespace-nowrap" style={{ color: item.tone }}>{item.metric}</span>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row: trends + program coverage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div className="dash-card overflow-hidden">
          <PanelHead title="Reported cases per week" meta="Last 12 reporting weeks · all diseases · National" action={
            <button type="button" className="text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }} onClick={() => router.push('/surveillance')}>
              Surveillance <Eye className="w-3 h-3 inline" />
            </button>
          } />
          <div className="p-3">
            {weeklyCases.length === 0 ? (
              <p className="text-[12px] p-6 text-center" style={{ color: 'var(--text-muted)' }}>No surveillance reports on file.</p>
            ) : (
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={weeklyCases} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => [v ?? 0, 'Cases']} />
                  <Line type="monotone" dataKey="cases" stroke={RED} strokeWidth={2} dot={{ r: 2.5, fill: RED }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="px-3 pb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Vital events per month</div>
            {vitalMonthly.length === 0 ? (
              <p className="text-[12px] p-4 text-center" style={{ color: 'var(--text-muted)' }}>No birth/death registrations on file.</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={vitalMonthly} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Line type="monotone" dataKey="births" name="Births" stroke={GREEN} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="deaths" name="Deaths" stroke={DEEP} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="dash-card overflow-hidden">
          <PanelHead title="Programme coverage vs target" meta="Cumulative recorded data · National" action={
            <span className="flex items-center gap-2">
              <button type="button" className="text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }} onClick={() => router.push('/immunizations')}>
                <Syringe className="w-3 h-3 inline" /> EPI
              </button>
              <button type="button" className="text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }} onClick={() => router.push('/anc')}>
                <HeartPulse className="w-3 h-3 inline" /> ANC
              </button>
            </span>
          } />
          <div className="p-4 flex flex-col gap-4">
            <BulletRow label="Children fully immunized (BCG + Penta3 + Measles1)" actual={imm?.coverageRate ?? 0} target={90} denominator={`Denominator: ${imm?.totalChildren ?? 0} children with immunization records (no census denominator on file)`} />
            <BulletRow label="Mothers reaching ANC 4+" actual={anc?.anc4PlusRate ?? 0} target={80} denominator={`Denominator: ${anc?.totalMothers ?? 0} mothers with ANC records`} />
            <BulletRow label="Birth registrations with certificate issued" actual={birthCert ?? 0} target={90} denominator={`Denominator: ${births.length} registered births`} />
            <BulletRow label="Death registrations with certificate issued" actual={deathCert ?? 0} target={90} denominator={`Denominator: ${deaths.length} registered deaths`} />
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Targets are national programme targets. Rates use facility-recorded denominators, not population estimates.
            </p>
          </div>
        </div>
      </div>

      {/* ── Row: data quality + reports/exchange status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="dash-card overflow-hidden flex flex-col">
          <PanelHead title="Data quality warnings" meta={`Latest facility assessments · ${dq?.totalFacilities ?? 0} facilities`} action={
            <button type="button" className="text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }} onClick={() => router.push('/data-quality')}>
              <Database className="w-3 h-3 inline" /> Data quality
            </button>
          } />
          {!dq || dq.entries.length === 0 ? (
            <p className="text-[12px] p-6 text-center" style={{ color: 'var(--text-muted)' }}>No facility assessments on file yet.</p>
          ) : (
            <div>
              {dq.entries
                .filter(e => e.reportingCompleteness < 80 || e.reportingTimeliness < 80)
                .sort((a, b) => a.reportingCompleteness - b.reportingCompleteness)
                .slice(0, 6)
                .map(e => (
                  <div key={e.facilityId} className="flex items-center gap-2.5 px-4 py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pctTone(Math.min(e.reportingCompleteness, e.reportingTimeliness), 80, 60) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{e.facilityName}</span>
                      <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{e.state} · assessed {e.lastAssessmentDate ? e.lastAssessmentDate.slice(0, 10) : 'never'}</span>
                    </span>
                    <span className="text-[11px] tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      compl <b style={{ color: pctTone(e.reportingCompleteness, 80, 60) }}>{e.reportingCompleteness}%</b>
                      {' · '}timel <b style={{ color: pctTone(e.reportingTimeliness, 80, 60) }}>{e.reportingTimeliness}%</b>
                    </span>
                  </div>
                ))}
              {dq.entries.every(e => e.reportingCompleteness >= 80 && e.reportingTimeliness >= 80) && (
                <p className="text-[12px] p-6 text-center" style={{ color: GREEN }}>All assessed facilities at or above the 80% reporting target.</p>
              )}
            </div>
          )}
        </div>

        <div className="dash-card overflow-hidden flex flex-col">
          <PanelHead title="Reports & exchange" meta={dhis2Host ? `DHIS2 · ${dhis2Host}` : 'DHIS2 not configured'} action={
            <button type="button" className="text-[11px] font-bold" style={{ color: 'var(--accent-primary)' }} onClick={() => router.push('/dhis2-export')}>
              <Download className="w-3 h-3 inline" /> DHIS2 export
            </button>
          } />
          <div className="p-4 flex flex-col gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: !dhis2Configured ? 'var(--text-muted)' : dhis2Ok ? GREEN : dhis2?.lastAttemptAt ? RED : AMBER }} />
              <b style={{ color: 'var(--text-primary)' }}>
                {!dhis2Configured ? 'DHIS2 connection not configured'
                  : dhis2Ok ? 'Last export fully synced'
                  : dhis2?.lastAttemptAt ? 'Last export attempt did not fully sync'
                  : 'No export attempted yet'}
              </b>
            </div>
            <div>Last successful push: {dhis2?.lastSyncedAt ? new Date(dhis2.lastSyncedAt).toLocaleString() : '—'}</div>
            <div>Last attempt: {dhis2?.lastAttemptAt ? new Date(dhis2.lastAttemptAt).toLocaleString() : '—'}</div>
            <div>
              Last dataset: {dhis2?.lastDataset ? `${dhis2.lastDataset.period} · ${dhis2.lastDataset.totalValueCount.toLocaleString()} values` : 'none generated'}
            </div>
            <div>Facilities reporting: <b style={{ color: 'var(--text-primary)' }}>{dq?.facilitiesReporting ?? 0}/{dq?.totalFacilities ?? 0}</b> · DHIS2 adoption {dq ? `${dq.dhis2Adoption}%` : '—'}</div>
            {(dhis2?.entries?.length ?? 0) > 0 && (
              <div className="mt-1 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Recent log</div>
                {dhis2!.entries.slice(-4).reverse().map((e, i) => (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: e.status === 'error' ? RED : e.status === 'success' ? GREEN : BLUE }} />
                    <span className="truncate" title={e.message}>{e.message}</span>
                    <span className="ml-auto text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{new Date(e.time).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
