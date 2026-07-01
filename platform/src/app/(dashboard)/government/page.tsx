'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import TopBar from '@/components/TopBar';
import {
  Building2, Users, BedDouble, Stethoscope, Wifi, WifiOff,
  AlertTriangle, ArrowRightLeft, TrendingUp, TrendingDown,
  Minus, ChevronDown, ChevronRight, Download, Calendar,
  ArrowUpDown, Check, BarChart3, LineChart as LineChartIcon,
  PieChart as PieChartIcon, Activity, Filter,
  Layers, MapPin, Target, Sliders, X, Maximize2, ChevronLeft
} from '@/components/icons/lucide';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ComposedChart,
} from 'recharts';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import { useReferrals } from '@/lib/hooks/useReferrals';
import EmptyState from '@/components/EmptyState';
import PatientName from '@/components/PatientName';
import type { HospitalDoc, DiseaseAlertDoc } from '@/lib/db-types';

/**
 * Aggregate computed dashboards
 * --------------------------------------------------------------------
 * `weeklyDiseaseData` and `casesByState` were previously imported from
 * a hard-coded mock module, which meant the national MoH dashboard
 * showed identical fake outbreak numbers regardless of the real
 * `disease_alert` documents in PouchDB. We now derive both shapes from
 * the live disease-alert feed (`useSurveillance`) so the charts and the
 * DHIS2 export reflect actual reporting.
 *
 * Disease keys used by the chart components:
 *   - weeklyDiseaseData: { week, malaria, cholera, measles, pneumonia, diarrhea }
 *   - casesByState:      { state, malaria, cholera, measles, tb, hiv }
 */
type WeeklyDiseaseRow = { week: string; malaria: number; cholera: number; measles: number; pneumonia: number; diarrhea: number };
type StateDiseaseRow = { state: string; malaria: number; cholera: number; measles: number; tb: number; hiv: number };

// Map free-form disease names to chart keys. Anything not listed is
// silently ignored — we do not invent numbers for diseases the chart
// can't display.
const DISEASE_KEY_MAP: Record<string, keyof Omit<WeeklyDiseaseRow, 'week'> | keyof Omit<StateDiseaseRow, 'state'>> = {
  malaria: 'malaria',
  cholera: 'cholera',
  measles: 'measles',
  pneumonia: 'pneumonia',
  diarrhea: 'diarrhea',
  'acute watery diarrhea': 'diarrhea',
  awd: 'diarrhea',
  tuberculosis: 'tb',
  tb: 'tb',
  hiv: 'hiv',
  'hiv/aids': 'hiv',
};

function isoWeekLabel(iso: string): string {
  // Convert an ISO date to a "Wnn MMM" label for the weekly chart axis.
  // Falls back to the raw string if the date doesn't parse.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || 'Unknown';
  // ISO week number (1-53)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  const month = d.toLocaleString('en', { month: 'short' });
  return `W${week} ${month}`;
}

function buildWeeklyDiseaseData(alerts: DiseaseAlertDoc[]): WeeklyDiseaseRow[] {
  const byWeek = new Map<string, WeeklyDiseaseRow & { _sortKey: string }>();
  for (const a of alerts) {
    if (!a.reportDate) continue;
    const label = isoWeekLabel(a.reportDate);
    const sortKey = a.reportDate.slice(0, 10);
    const key = DISEASE_KEY_MAP[(a.disease || '').toLowerCase()] as keyof Omit<WeeklyDiseaseRow, 'week'> | undefined;
    if (!key) continue;
    if (!(['malaria', 'cholera', 'measles', 'pneumonia', 'diarrhea'] as const).includes(key as 'malaria' | 'cholera' | 'measles' | 'pneumonia' | 'diarrhea')) continue;
    const existing = byWeek.get(label) ?? {
      week: label, malaria: 0, cholera: 0, measles: 0, pneumonia: 0, diarrhea: 0, _sortKey: sortKey,
    };
    existing[key as Exclude<keyof WeeklyDiseaseRow, 'week'>] += (a.cases || 0);
    if (sortKey < existing._sortKey) existing._sortKey = sortKey;
    byWeek.set(label, existing);
  }
  return Array.from(byWeek.values())
    .sort((a, b) => a._sortKey.localeCompare(b._sortKey))
    .map(row => {
      const { _sortKey: _drop, ...rest } = row;
      void _drop;
      return rest;
    });
}

function buildCasesByState(alerts: DiseaseAlertDoc[]): StateDiseaseRow[] {
  const byState = new Map<string, StateDiseaseRow>();
  for (const a of alerts) {
    if (!a.state) continue;
    const key = DISEASE_KEY_MAP[(a.disease || '').toLowerCase()] as keyof Omit<StateDiseaseRow, 'state'> | undefined;
    if (!key) continue;
    if (!(['malaria', 'cholera', 'measles', 'tb', 'hiv'] as const).includes(key as 'malaria' | 'cholera' | 'measles' | 'tb' | 'hiv')) continue;
    const existing = byState.get(a.state) ?? {
      state: a.state, malaria: 0, cholera: 0, measles: 0, tb: 0, hiv: 0,
    };
    existing[key as Exclude<keyof StateDiseaseRow, 'state'>] += (a.cases || 0);
    byState.set(a.state, existing);
  }
  return Array.from(byState.values()).sort((a, b) => b.malaria - a.malaria);
}

/**
 * Compress a state name into a short axis label.
 *
 * - Multi-word names → initials of each word ("Northern Bahr el Ghazal" → "NBEG").
 *   We strip a trailing period from initialized abbreviations like "W." so
 *   "W. Bahr el Ghazal" still becomes "WBEG" rather than "W.BEG".
 * - Single-word names → first 4 characters, upper-cased ("Jonglei" → "JONG").
 * - Names ≤ 4 chars are returned as-is.
 *
 * Replaces an earlier hard-coded map that silently passed through any state
 * not listed (e.g. "Jonglei", "Lakes"), crowding the chart axis.
 */
function abbreviateStateLabel(name: string): string {
  if (!name) return name;
  const trimmed = name.trim();
  if (trimmed.length <= 4) return trimmed;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map(w => (w[0] || '').toUpperCase())
      .join('');
  }
  return trimmed.slice(0, 4).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="card-elevated p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', fontSize: '0.75rem', borderRadius: '6px' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function CircularGauge({ value, label, color, size = 100, strokeWidth = 8 }: {
  value: number; label: string; color: string; size?: number; strokeWidth?: number;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-light)" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <span className="text-[10px] font-medium mt-2 text-center" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function DataQualityBadge({ score }: { score: number }) {
  const color = score > 90 ? 'var(--color-success)' : score >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
  const bg = score > 90 ? 'rgba(31, 157, 111,0.12)' : score >= 70 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: bg, color }}>
      {score}%
    </span>
  );
}

/* ─── Tableau-style Dropdown Select ──────────────────────────────── */
function TableauSelect({ label, value, options, onChange, icon: Icon, width }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  icon?: React.ElementType;
  width?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
      <span className="text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-[11px] font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer transition-all"
        style={{
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border-light)',
          color: 'var(--text-primary)',
          minWidth: width || '90px',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ─── Multi-Select Dropdown (Tableau filter) ─────────────────────── */
function TableauMultiSelect({ label, options, selected, onChange, icon: Icon }: {
  label: string;
  options: Array<{ value: string; label: string; color: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  icon?: React.ElementType;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (v: string) => {
    if (selected.includes(v)) {
      if (selected.length > 1) onChange(selected.filter(s => s !== v));
    } else {
      onChange([...selected, v]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
        <span className="text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[11px] font-semibold rounded-lg px-2 py-1 transition-all"
          style={{
            background: 'var(--overlay-subtle)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            minWidth: '120px',
          }}
        >
          <span className="truncate flex-1 text-left">
            {selected.length === options.length ? t('government.all') : t('government.countSelected', { count: selected.length })}
          </span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
      {isOpen && (
        <div
          className="absolute z-20 mt-1 right-0 rounded-xl shadow-lg overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', minWidth: '180px' }}
        >
          {/* Select All / Clear */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <button
              onClick={() => onChange(options.map(o => o.value))}
              className="text-[10px] font-semibold" style={{ color: 'var(--accent-primary)' }}
            >
              {t('government.selectAll')}
            </button>
          </div>
          {options.map(o => {
            const checked = selected.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => toggle(o.value)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:opacity-80"
                style={{
                  background: checked ? `${o.color}10` : 'transparent',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    border: checked ? `2px solid ${o.color}` : '2px solid var(--border-light)',
                    background: checked ? o.color : 'transparent',
                  }}
                >
                  {checked && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                </span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />
                <span style={{ color: 'var(--text-primary)' }}>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Chart Type Button Group ────────────────────────────────────── */
function ChartTypeSelector({ value, options, onChange }: {
  value: string;
  options: Array<{ value: string; label: string; icon: React.ElementType }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold transition-all"
          title={opt.label}
          style={{
            background: value === opt.value ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
            color: value === opt.value ? '#fff' : 'var(--text-muted)',
            borderRight: i < options.length - 1 ? '1px solid var(--border-light)' : 'none',
          }}
        >
          <opt.icon className="w-3 h-3" />
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Inline Expanded Chart View (fills the content area beside sidebar) ── */
function ExpandedChartView({ title, onClose, children, hasData = true, emptyMessage }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  hasData?: boolean;
  emptyMessage?: string;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0 rounded-t-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderBottom: 'none' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t('government.backToDashboard')}
          </button>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
          style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
          title={t('government.closeEsc')}
        >
          <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
      {/* Chart fills the remaining space */}
      <div
        className="flex-1 min-h-0 p-5 rounded-b-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderTop: '1px solid var(--border-light)' }}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState icon={Activity} title="No data yet" message={emptyMessage || 'No data to display for this chart.'} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Expand Button ──────────────────────────────────────────────── */
function ExpandButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:opacity-70"
      style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
      title={t('government.enlargeChart')}
    >
      <Maximize2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

const FACILITY_COLORS = ['var(--color-success)', '#2563EB', '#A855F7', 'var(--color-warning)', 'var(--text-muted)'];

const DISEASE_COLORS: Record<string, string> = {
  malaria: '#E52E42', cholera: '#1B9E77', measles: '#A855F7',
  pneumonia: '#FCD34D', diarrhea: '#2563EB', tb: '#F97316', hiv: '#EC4899',
  'Malaria': '#E52E42', 'Cholera': '#1B9E77', 'Measles': '#A855F7',
  'Pneumonia': '#FCD34D', 'Diarrhea': '#2563EB', 'Tuberculosis': '#F97316',
  'HIV/AIDS': '#EC4899', 'Acute Watery Diarrhea': '#2563EB',
  'Meningitis': '#06B6D4', 'Kala-azar': '#8B5CF6', 'Hepatitis E': '#F43F5E',
};

// Master list of all diseases collected across the system
const ALL_COLLECTED_DISEASES = [
  'Malaria', 'Cholera', 'Measles', 'Pneumonia', 'Diarrhea',
  'Tuberculosis', 'HIV/AIDS', 'Acute Watery Diarrhea',
  'Meningitis', 'Kala-azar', 'Hepatitis E',
];

const WEEKLY_DISEASE_KEYS = ['malaria', 'cholera', 'measles', 'pneumonia', 'diarrhea'] as const;
const STATE_DISEASE_KEYS = ['malaria', 'cholera', 'measles', 'tb', 'hiv'] as const;

function calcDataQuality(h: HospitalDoc): number {
  const fields = [
    h.name, h.state, h.facilityType, h.totalBeds, h.doctors, h.nurses,
    h.clinicalOfficers, h.syncStatus, h.lastSync, h.patientCount,
    h.operationalStatus, h.performance?.reportingCompleteness,
    h.performance?.serviceReadinessScore, h.performance?.immunizationCoverage,
    h.performance?.qualityScore, h.county,
  ];
  const filled = fields.filter(f => f !== undefined && f !== null && f !== '' && f !== 0).length;
  return Math.round((filled / fields.length) * 100);
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function GovernmentDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { hospitals } = useHospitals();
  const { alerts: diseaseAlerts } = useSurveillance();
  const { referrals } = useReferrals();

  // Live aggregations derived from the surveillance feed so the dashboard
  // never falls back to hardcoded outbreak numbers (a previous prod issue).
  const weeklyDiseaseData = useMemo(() => buildWeeklyDiseaseData(diseaseAlerts), [diseaseAlerts]);
  const casesByState = useMemo(() => buildCasesByState(diseaseAlerts), [diseaseAlerts]);

  // Drill-Down + Export state
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
  const [dhis2Period, setDhis2Period] = useState<'monthly' | 'quarterly'>('monthly');
  const [tableSortBy, setTableSortBy] = useState<'name' | 'quality'>('name');

  /* ─── TABLEAU-STYLE SELECTOR STATES ──────────────────────────── */

  // Global state filter
  const [selectedState, setSelectedState] = useState<string>('all');

  // Disease Trends panel
  const [dtChartType, setDtChartType] = useState('line');
  const [dtSelectedDiseases, setDtSelectedDiseases] = useState<string[]>([...WEEKLY_DISEASE_KEYS]);

  // Cases by State panel
  const [csChartType, setCsChartType] = useState('bar');
  const [csDisplayMode] = useState<'single' | 'multi'>('single');
  const [csSingleDisease, setCsSingleDisease] = useState('malaria');
  const [csSelectedDiseases, setCsSelectedDiseases] = useState<string[]>([...STATE_DISEASE_KEYS]);

  // Health Visits panel
  const [hvChartType, setHvChartType] = useState('line');
  const [hvSelectedSeries, setHvSelectedSeries] = useState<string[]>(['OPD Visits', 'ANC Visits', 'Immunizations']);

  // Staff Distribution panel
  const [sdChartType, setSdChartType] = useState('bar');
  const [sdMetric, setSdMetric] = useState<'count' | 'ratio'>('count');
  const [sdSelectedRoles, setSdSelectedRoles] = useState<string[]>(['Doctors', 'Nurses', 'Clinical Officers']);

  // Performance panel
  const [perfView, setPerfView] = useState('gauges');

  // Alert filter by disease
  const [alertDiseaseFilter, setAlertDiseaseFilter] = useState('all');

  // Fullscreen chart states
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'government') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // All states from data
  const allStates = useMemo(() => {
    const states = new Set<string>();
    hospitals.forEach(h => { if (h.state) states.add(h.state); });
    casesByState.forEach(s => states.add(s.state));
    return Array.from(states).sort();
  }, [hospitals, casesByState]);

  // Ministry of Health reporting gate: facility data only counts toward the
  // national picture once the facility has reviewed and submitted it from
  // "My Facility". Facilities that have not yet submitted are excluded from
  // every aggregate below (the banner near the filter bar reports how many are
  // still pending).
  // Filtered hospitals — all facilities, optionally scoped to a selected state.
  const filteredHospitals = useMemo(() => {
    if (selectedState === 'all') return hospitals;
    return hospitals.filter(h => h.state === selectedState);
  }, [hospitals, selectedState]);

  // KPI aggregates
  const totalHospitals = filteredHospitals.length;
  const totalPatients = filteredHospitals.reduce((s, h) => s + h.patientCount, 0);
  const totalBeds = filteredHospitals.reduce((s, h) => s + h.totalBeds, 0);
  const totalDoctors = filteredHospitals.reduce((s, h) => s + h.doctors, 0);
  const totalNurses = filteredHospitals.reduce((s, h) => s + h.nurses, 0);
  const totalCOs = filteredHospitals.reduce((s, h) => s + h.clinicalOfficers, 0);
  const totalStaff = totalDoctors + totalNurses + totalCOs;
  const onlineHospitals = filteredHospitals.filter(h => h.syncStatus === 'online').length;
  const offlineHospitals = filteredHospitals.filter(h => h.syncStatus === 'offline').length;
  const activeAlerts = diseaseAlerts.filter(a => {
    if (selectedState !== 'all' && a.state !== selectedState) return false;
    return a.alertLevel === 'emergency' || a.alertLevel === 'warning';
  }).length;
  const pendingReferrals = referrals.filter(r => r.status === 'sent' || r.status === 'received').length;

  // Facility distribution
  const facilityDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    const labels: Record<string, string> = {
      national_referral: t('government.facilityNationalReferral'), state_hospital: t('government.facilityStateHospital'),
      county_hospital: t('government.facilityCountyHospital'), phcc: t('government.facilityPhcc'), phcu: t('government.facilityPhcu'),
    };
    filteredHospitals.forEach(h => {
      const t = labels[h.facilityType] || h.facilityType;
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredHospitals, t]);

  // OPD trend data
  const opdTrendData = useMemo(() => {
    const months = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
    const labels = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    return months.map((m, i) => {
      let opd = 0, anc = 0, imm = 0;
      filteredHospitals.forEach(h => {
        const tr = h.monthlyTrends?.find((row: { month: string }) => row.month === m);
        if (tr) { opd += tr.opdVisits || 0; anc += tr.ancVisits || 0; imm += tr.immunizations || 0; }
      });
      return { month: labels[i], 'OPD Visits': opd, 'ANC Visits': anc, 'Immunizations': imm };
    });
  }, [filteredHospitals]);

  // State cases data
  const stateBarData = useMemo(() => {
    const data = selectedState === 'all' ? [...casesByState] : casesByState.filter(s => s.state === selectedState);
    return data
      .sort((a, b) => b.malaria - a.malaria)
      .slice(0, 10)
      .map(s => ({
        ...s,
        state: abbreviateStateLabel(s.state),
      }));
  }, [selectedState, casesByState]);

  // State disease pie data
  const statePieData = useMemo(() => {
    const totals: Record<string, number> = {};
    csSelectedDiseases.forEach(d => {
      totals[d] = stateBarData.reduce((s, row) => s + ((row as Record<string, unknown>)[d] as number || 0), 0);
    });
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [stateBarData, csSelectedDiseases]);

  // Staff distribution
  const staffDistribution = useMemo(() => {
    return filteredHospitals
      .sort((a, b) => (b.doctors + b.nurses + b.clinicalOfficers) - (a.doctors + a.nurses + a.clinicalOfficers))
      .slice(0, 8)
      .map(h => {
        const total = h.doctors + h.nurses + h.clinicalOfficers;
        const isRatio = sdMetric === 'ratio' && total > 0;
        return {
          name: h.name.replace(' Hospital', '').replace(' Teaching', '').replace('Juba ', 'J.').slice(0, 15),
          Doctors: isRatio ? Math.round((h.doctors / total) * 100) : h.doctors,
          Nurses: isRatio ? Math.round((h.nurses / total) * 100) : h.nurses,
          'Clinical Officers': isRatio ? Math.round((h.clinicalOfficers / total) * 100) : h.clinicalOfficers,
        };
      });
  }, [filteredHospitals, sdMetric]);

  const staffPieData = useMemo(() => [
    { name: 'Doctors', value: totalDoctors, color: '#2563EB' },
    { name: 'Nurses', value: totalNurses, color: '#1B9E77' },
    { name: 'Clinical Officers', value: totalCOs, color: '#A855F7' },
  ], [totalDoctors, totalNurses, totalCOs]);

  // Performance metrics
  const avg = (key: keyof NonNullable<HospitalDoc['performance']>) => {
    if (!filteredHospitals.length) return 0;
    return Math.round(filteredHospitals.reduce((s, h) => s + ((h.performance as Record<string, number> | undefined)?.[key] || 0), 0) / filteredHospitals.length);
  };
  const avgReporting = avg('reportingCompleteness');
  const avgReadiness = avg('serviceReadinessScore');
  const avgImmCoverage = avg('immunizationCoverage');
  const avgMedicine = avg('tracerMedicineAvailability');
  const avgQualityScore = avg('qualityScore');
  const functionalPct = useMemo(() => {
    if (!filteredHospitals.length) return 0;
    return Math.round((filteredHospitals.filter(h => h.operationalStatus === 'functional').length / filteredHospitals.length) * 100);
  }, [filteredHospitals]);

  const perfRadarData = useMemo(() => [
    { metric: t('government.metricReporting'), value: avgReporting },
    { metric: t('government.metricReadiness'), value: avgReadiness },
    { metric: t('government.metricEpiCoverage'), value: avgImmCoverage },
    { metric: t('government.metricFunctional'), value: functionalPct },
    { metric: t('government.metricMedicine'), value: avgMedicine },
    { metric: t('government.metricQuality'), value: avgQualityScore },
  ], [avgReporting, avgReadiness, avgImmCoverage, functionalPct, avgMedicine, avgQualityScore, t]);

  /* ─── Empty-state flags: whether each chart has anything to plot ── */
  const diseaseTrendHasData = weeklyDiseaseData.length > 0
    && dtSelectedDiseases.length > 0
    && weeklyDiseaseData.some(row => WEEKLY_DISEASE_KEYS.some(k => dtSelectedDiseases.includes(k) && ((row as Record<string, unknown>)[k] as number) > 0));
  const stateCasesHasData = stateBarData.length > 0
    && (csChartType === 'pie'
      ? statePieData.some(d => d.value > 0)
      : stateBarData.some(row => Object.entries(row).some(([k, v]) => k !== 'state' && typeof v === 'number' && v > 0)));
  const visitsHasData = hvSelectedSeries.length > 0
    && opdTrendData.some(row => hvSelectedSeries.some(s => ((row as unknown as Record<string, number>)[s] || 0) > 0));
  const staffHasData = staffDistribution.length > 0
    && sdSelectedRoles.length > 0
    && staffDistribution.some(row => sdSelectedRoles.some(r => ((row as Record<string, unknown>)[r] as number) > 0));
  const performanceHasData = perfRadarData.some(d => d.value > 0);

  const sortedAlerts = useMemo(() => {
    let filtered = selectedState === 'all' ? [...diseaseAlerts] : diseaseAlerts.filter(a => a.state === selectedState);
    if (alertDiseaseFilter !== 'all') filtered = filtered.filter(a => a.disease === alertDiseaseFilter);
    return filtered.sort((a, b) => {
      const order: Record<string, number> = { emergency: 0, warning: 1, watch: 2, normal: 3 };
      return (order[a.alertLevel] ?? 3) - (order[b.alertLevel] ?? 3);
    });
  }, [diseaseAlerts, selectedState, alertDiseaseFilter]);

  // State drill-down
  const hospitalsByState = useMemo(() => {
    const grouped: Record<string, HospitalDoc[]> = {};
    filteredHospitals.forEach(h => {
      const state = h.state || 'Unknown';
      if (!grouped[state]) grouped[state] = [];
      grouped[state].push(h);
    });
    return grouped;
  }, [filteredHospitals]);

  const stateAggregates = useMemo(() => {
    return Object.entries(hospitalsByState).map(([state, hosps]) => ({
      state, hospitals: hosps,
      totalPatients: hosps.reduce((s, h) => s + h.patientCount, 0),
      totalBeds: hosps.reduce((s, h) => s + h.totalBeds, 0),
      totalStaff: hosps.reduce((s, h) => s + h.doctors + h.nurses + h.clinicalOfficers, 0),
      facilityCount: hosps.length,
    })).sort((a, b) => b.totalPatients - a.totalPatients);
  }, [hospitalsByState]);

  const toggleState = useCallback((state: string) => {
    setExpandedStates(prev => ({ ...prev, [state]: !prev[state] }));
  }, []);

  // DHIS2 export
  const handleDhis2Export = useCallback(() => {
    const now = new Date();
    const period = dhis2Period === 'monthly'
      ? `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      : `${now.getFullYear()}Q${Math.ceil((now.getMonth() + 1) / 3)}`;
    const dataValues: Array<{ dataElement: string; period: string; orgUnit: string; value: number }> = [];
    casesByState.forEach(s => {
      const orgUnit = s.state.replace(/\s+/g, '_').toUpperCase();
      dataValues.push({ dataElement: 'MALARIA_CASES', period, orgUnit, value: s.malaria });
      dataValues.push({ dataElement: 'CHOLERA_CASES', period, orgUnit, value: s.cholera });
      dataValues.push({ dataElement: 'MEASLES_CASES', period, orgUnit, value: s.measles });
      dataValues.push({ dataElement: 'TB_CASES', period, orgUnit, value: s.tb });
      dataValues.push({ dataElement: 'HIV_CASES', period, orgUnit, value: s.hiv });
    });
    hospitals.forEach(h => {
      const orgUnit = h._id;
      dataValues.push({ dataElement: 'PATIENT_COUNT', period, orgUnit, value: h.patientCount });
      const lastTrend = h.monthlyTrends?.[h.monthlyTrends.length - 1];
      if (lastTrend) {
        dataValues.push({ dataElement: 'IMMUNIZATION_COUNT', period, orgUnit, value: lastTrend.immunizations || 0 });
        dataValues.push({ dataElement: 'OPD_VISITS', period, orgUnit, value: lastTrend.opdVisits || 0 });
        dataValues.push({ dataElement: 'ANC_VISITS', period, orgUnit, value: lastTrend.ancVisits || 0 });
      }
    });
    const blob = new Blob([JSON.stringify({ dataValueSet: { dataValues } }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dhis2_export_${period}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [dhis2Period, hospitals, casesByState]);

  // Facility comparison

  if (!currentUser || currentUser.role !== 'government') return null;

  const typeLabel = (type: string) => {
    switch (type) {
      case 'national_referral': return t('government.facilityNationalReferral');
      case 'state_hospital': return t('government.facilityStateHospital');
      case 'county_hospital': return t('government.facilityCountyHospital');
      default: return type;
    }
  };
  const syncDotColor = (status: string) => {
    switch (status) {
      case 'online': return 'var(--color-success)';
      case 'offline': return 'var(--text-muted)';
      case 'syncing': return 'var(--color-warning)';
      default: return 'var(--text-muted)';
    }
  };

  /* ═══ CHART RENDERERS ═══ */

  // Disease Trends
  const renderDiseaseTrend = () => {
    const activeKeys = WEEKLY_DISEASE_KEYS.filter(d => dtSelectedDiseases.includes(d));
    const commonProps = { data: weeklyDiseaseData, margin: { top: 5, right: 20, left: 0, bottom: 5 } };
    const xProps = { dataKey: 'week' as const, tick: { fontSize: 10, fill: 'var(--text-muted)' }, axisLine: { stroke: 'var(--border-light)' }, tickLine: false };
    const yProps = { tick: { fontSize: 10, fill: 'var(--text-muted)' }, axisLine: { stroke: 'var(--border-light)' }, tickLine: false };
    const gridProps = { strokeDasharray: '3 3', stroke: 'var(--border-light)' };
    const legendProps = { iconType: 'circle' as const, iconSize: 8, wrapperStyle: { fontSize: '0.65rem', paddingTop: '4px' } };

    if (dtChartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} />
          <Tooltip content={<ChartTooltip />} /><Legend {...legendProps} />
          {activeKeys.map(d => <Area key={d} type="monotone" dataKey={d} name={d.charAt(0).toUpperCase() + d.slice(1)} stroke={DISEASE_COLORS[d]} fill={DISEASE_COLORS[d]} fillOpacity={0.15} strokeWidth={2} />)}
        </AreaChart>
      );
    }
    if (dtChartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} />
          <Tooltip content={<ChartTooltip />} /><Legend {...{ ...legendProps, iconType: 'square' as const }} />
          {activeKeys.map(d => <Bar key={d} dataKey={d} name={d.charAt(0).toUpperCase() + d.slice(1)} fill={DISEASE_COLORS[d]} radius={[3, 3, 0, 0]} barSize={10} />)}
        </BarChart>
      );
    }
    if (dtChartType === 'composed') {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} />
          <Tooltip content={<ChartTooltip />} /><Legend {...legendProps} />
          {activeKeys.map((d, i) => {
            const name = d.charAt(0).toUpperCase() + d.slice(1);
            if (i === 0) return <Bar key={d} dataKey={d} name={name} fill={DISEASE_COLORS[d]} radius={[3, 3, 0, 0]} barSize={12} fillOpacity={0.7} />;
            if (i === 1) return <Area key={d} type="monotone" dataKey={d} name={name} stroke={DISEASE_COLORS[d]} fill={DISEASE_COLORS[d]} fillOpacity={0.1} strokeWidth={2} />;
            return <Line key={d} type="monotone" dataKey={d} name={name} stroke={DISEASE_COLORS[d]} strokeWidth={2} dot={{ r: 3 }} />;
          })}
        </ComposedChart>
      );
    }
    // line
    return (
      <LineChart {...commonProps}>
        <CartesianGrid {...gridProps} /><XAxis {...xProps} /><YAxis {...yProps} />
        <Tooltip content={<ChartTooltip />} /><Legend {...legendProps} />
        {activeKeys.map(d => <Line key={d} type="monotone" dataKey={d} name={d.charAt(0).toUpperCase() + d.slice(1)} stroke={DISEASE_COLORS[d]} strokeWidth={d === 'malaria' ? 2.5 : 2} dot={{ r: 3 }} />)}
      </LineChart>
    );
  };

  // Cases by State
  const renderStateCases = () => {
    if (csChartType === 'stacked' || csDisplayMode === 'multi') {
      const activeKeys = STATE_DISEASE_KEYS.filter(d => csSelectedDiseases.includes(d));
      return (
        <BarChart data={stateBarData} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
          <YAxis type="category" dataKey="state" tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<ChartTooltip />} />
          <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: '0.6rem', paddingTop: '4px' }} />
          {activeKeys.map(d => <Bar key={d} dataKey={d} name={d.charAt(0).toUpperCase() + d.slice(1)} fill={DISEASE_COLORS[d]} stackId="diseases" barSize={16} />)}
        </BarChart>
      );
    }
    if (csChartType === 'radar') {
      const activeKeys = STATE_DISEASE_KEYS.filter(d => csSelectedDiseases.includes(d));
      return (
        <RadarChart data={stateBarData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--border-light)" />
          <PolarAngleAxis dataKey="state" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} />
          <PolarRadiusAxis tick={{ fontSize: 8, fill: 'var(--text-muted)' }} />
          <Tooltip />
          {activeKeys.map(d => <Radar key={d} name={d.charAt(0).toUpperCase() + d.slice(1)} dataKey={d} stroke={DISEASE_COLORS[d]} fill={DISEASE_COLORS[d]} fillOpacity={0.15} />)}
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.6rem' }} />
        </RadarChart>
      );
    }
    if (csChartType === 'pie') {
      return (
        <PieChart>
          <Pie data={statePieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, value }) => `${(name as string).charAt(0).toUpperCase() + (name as string).slice(1)}: ${(value as number).toLocaleString()}`}>
            {statePieData.map((entry, i) => <Cell key={i} fill={DISEASE_COLORS[entry.name] || FACILITY_COLORS[i % FACILITY_COLORS.length]} />)}
          </Pie>
          <Tooltip /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.6rem' }} />
        </PieChart>
      );
    }
    // single disease bar
    return (
      <BarChart data={stateBarData} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
        <YAxis type="category" dataKey="state" tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={55} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey={csSingleDisease} name={csSingleDisease.charAt(0).toUpperCase() + csSingleDisease.slice(1)} fill={DISEASE_COLORS[csSingleDisease] || '#E52E42'} radius={[0, 6, 6, 0]} barSize={14} />
      </BarChart>
    );
  };

  // Health Visits
  const renderVisits = () => {
    const activeVisits = hvSelectedSeries;
    const visitColors: Record<string, string> = { 'OPD Visits': '#2563EB', 'ANC Visits': '#EC4899', 'Immunizations': '#A855F7' };
    const commonProps = { data: opdTrendData, margin: { top: 5, right: 15, left: 0, bottom: 5 } };
    const xProps = { dataKey: 'month' as const, tick: { fontSize: 10, fill: 'var(--text-muted)' }, axisLine: { stroke: 'var(--border-light)' }, tickLine: false };
    const yProps = { tick: { fontSize: 10, fill: 'var(--text-muted)' }, axisLine: { stroke: 'var(--border-light)' }, tickLine: false };

    if (hvChartType === 'area') {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" /><XAxis {...xProps} /><YAxis {...yProps} />
          <Tooltip content={<ChartTooltip />} /><Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.6rem', paddingTop: '4px' }} />
          {activeVisits.map(v => <Area key={v} type="monotone" dataKey={v} stroke={visitColors[v]} fill={visitColors[v]} fillOpacity={0.15} strokeWidth={2} />)}
        </AreaChart>
      );
    }
    if (hvChartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" /><XAxis {...xProps} /><YAxis {...yProps} />
          <Tooltip content={<ChartTooltip />} /><Legend iconType="square" iconSize={6} wrapperStyle={{ fontSize: '0.6rem', paddingTop: '4px' }} />
          {activeVisits.map(v => <Bar key={v} dataKey={v} fill={visitColors[v]} radius={[3, 3, 0, 0]} barSize={14} />)}
        </BarChart>
      );
    }
    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" /><XAxis {...xProps} /><YAxis {...yProps} />
        <Tooltip content={<ChartTooltip />} /><Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.6rem', paddingTop: '4px' }} />
        {activeVisits.map(v => <Line key={v} type="monotone" dataKey={v} stroke={visitColors[v]} strokeWidth={2.5} dot={{ r: 3, fill: visitColors[v] }} />)}
      </LineChart>
    );
  };

  // Staff
  const renderStaff = () => {
    const staffColors: Record<string, string> = { Doctors: '#2563EB', Nurses: '#1B9E77', 'Clinical Officers': '#A855F7' };
    const activeRoles = sdSelectedRoles;

    if (sdChartType === 'stacked') {
      return (
        <BarChart data={staffDistribution} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
          <XAxis dataKey="name" tick={{ fontSize: 7, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} angle={-35} textAnchor="end" height={45} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
          <Tooltip content={<ChartTooltip />} /><Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: '0.6rem', paddingTop: '4px' }} />
          {activeRoles.map(r => <Bar key={r} dataKey={r} fill={staffColors[r]} stackId="staff" barSize={18} />)}
        </BarChart>
      );
    }
    if (sdChartType === 'pie') {
      const filtered = staffPieData.filter(d => activeRoles.includes(d.name));
      return (
        <PieChart>
          <Pie data={filtered} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={35} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
            {filtered.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.6rem' }} />
        </PieChart>
      );
    }
    return (
      <BarChart data={staffDistribution} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
        <XAxis dataKey="name" tick={{ fontSize: 7, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} angle={-35} textAnchor="end" height={45} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
        <Tooltip content={<ChartTooltip />} /><Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: '0.6rem', paddingTop: '4px' }} />
        {activeRoles.map(r => <Bar key={r} dataKey={r} fill={staffColors[r]} radius={[3, 3, 0, 0]} barSize={10} />)}
      </BarChart>
    );
  };

  // Performance
  const renderPerformance = () => {
    if ((perfView === 'radar' || perfView === 'bar') && !performanceHasData) {
      return (
        <div className="p-3" style={{ height: 224, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon={Activity} title="No data yet" message="No performance metrics for the selected facilities." />
        </div>
      );
    }
    if (perfView === 'radar') {
      return (
        <div className="p-3">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={perfRadarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="var(--border-light)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: 'var(--text-muted)' }} />
              <Radar name={t('government.performance')} dataKey="value" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (perfView === 'bar') {
      return (
        <div className="p-3">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perfRadarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="metric" tick={{ fontSize: 7, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} angle={-20} textAnchor="end" height={40} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name={t('government.scorePct')} radius={[4, 4, 0, 0]} barSize={24}>
                {perfRadarData.map((e, i) => <Cell key={i} fill={e.value >= 80 ? '#1B9E77' : e.value >= 60 ? '#FCD34D' : '#E52E42'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return (
      <div className="p-3 grid grid-cols-2 gap-2">
        <CircularGauge value={avgReporting} label={t('government.metricReporting')} color="#2563EB" size={96} strokeWidth={5} />
        <CircularGauge value={avgReadiness} label={t('government.metricReadiness')} color="#2191D0" size={96} strokeWidth={5} />
        <CircularGauge value={avgImmCoverage} label={t('government.metricEpiCoverage')} color="#A855F7" size={96} strokeWidth={5} />
        <CircularGauge value={functionalPct} label={t('government.metricFunctional')} color="#FCD34D" size={96} strokeWidth={5} />
      </div>
    );
  };

  /* ═══ RENDER ═══ */

  // When a chart is expanded, render it filling the entire content area
  if (fullscreenChart) {
    const closeExpanded = () => setFullscreenChart(null);

    const expandedContent = (() => {
      switch (fullscreenChart) {
        case 'diseaseTrend':
          return <ExpandedChartView title={t('government.weeklyDiseaseTrends')} onClose={closeExpanded} hasData={diseaseTrendHasData} emptyMessage="No disease trends for the selected diseases or period.">{renderDiseaseTrend()}</ExpandedChartView>;
        case 'performance':
          return (
            <ExpandedChartView title={t('government.nationalPerformance')} onClose={closeExpanded} hasData={performanceHasData} emptyMessage="No performance metrics for the selected facilities.">
              {perfView === 'radar' ? (
                <RadarChart data={perfRadarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="var(--border-light)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 14, fill: 'var(--text-primary)' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <Radar name={t('government.performance')} dataKey="value" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.2} />
                  <Tooltip />
                </RadarChart>
              ) : (
                <BarChart data={perfRadarData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12, fill: 'var(--text-primary)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name={t('government.scorePct')} radius={[6, 6, 0, 0]} barSize={40}>
                    {perfRadarData.map((e, i) => <Cell key={i} fill={e.value >= 80 ? '#1B9E77' : e.value >= 60 ? '#FCD34D' : '#E52E42'} />)}
                  </Bar>
                </BarChart>
              )}
            </ExpandedChartView>
          );
        case 'stateCases':
          return <ExpandedChartView title={t('government.diseaseCasesByState')} onClose={closeExpanded} hasData={stateCasesHasData} emptyMessage="No cases reported for the selected states or diseases.">{renderStateCases()}</ExpandedChartView>;
        case 'healthVisits':
          return <ExpandedChartView title={t('government.nationalHealthVisits6m')} onClose={closeExpanded} hasData={visitsHasData} emptyMessage="No health-visit records for the selected metrics or period.">{renderVisits()}</ExpandedChartView>;
        case 'staffDist':
          return <ExpandedChartView title={t('government.staffDistributionByHospital')} onClose={closeExpanded} hasData={staffHasData} emptyMessage="No staffing data for the selected roles or facilities.">{renderStaff()}</ExpandedChartView>;
        default:
          return null;
      }
    })();

    return (
      <>
        <TopBar title={t('government.nationalDashboard')} />
        <div className="page-container page-enter flex flex-col flex-1 min-h-0" style={{ padding: '12px 16px' }}>
          {expandedContent}
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('government.nationalDashboard')} />
      <main className="page-container page-enter">

        {/* ═══ National snapshot — distinct colour-tinted chips, spread across ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 mb-4">
          {[
            { label: t('government.kpiHospitals'), value: totalHospitals.toString(), icon: Building2, color: '#2563EB', bg: 'rgba(37,99,235,0.10)', href: '/hospitals' },
            { label: t('government.kpiPatients'), value: totalPatients.toLocaleString(), icon: Users, color: '#0E7490', bg: 'rgba(14,116,144,0.10)', href: '/hospitals' },
            { label: t('government.kpiBeds'), value: totalBeds.toLocaleString(), icon: BedDouble, color: 'var(--accent-primary)', bg: 'rgba(124,58,237,0.10)', href: '/hospitals' },
            { label: t('government.kpiStaff'), value: totalStaff.toLocaleString(), icon: Stethoscope, color: '#0891B2', bg: 'rgba(8,145,178,0.10)', href: '/hospitals' },
            { label: t('government.kpiOnline'), value: onlineHospitals.toString(), icon: Wifi, color: '#15803D', bg: 'rgba(21,128,61,0.10)', href: '/hospitals' },
            { label: t('government.kpiOffline'), value: offlineHospitals.toString(), icon: WifiOff, color: '#64748B', bg: 'rgba(100,116,139,0.12)', href: '/hospitals' },
            { label: t('government.kpiAlerts'), value: activeAlerts.toString(), icon: AlertTriangle, color: '#C44536', bg: 'rgba(196,69,54,0.10)', href: '/surveillance' },
            { label: t('government.kpiReferrals'), value: pendingReferrals.toString(), icon: ArrowRightLeft, color: '#B8741C', bg: 'rgba(184,116,28,0.12)', href: '/referrals' },
          ].map(stat => (
            <button
              key={stat.label}
              onClick={() => stat.href && router.push(stat.href)}
              className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-transform"
              style={{ background: stat.bg, border: `1px solid ${stat.color}22` }}
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'transparent' }}>
                <stat.icon className="w-[18px] h-[18px]" style={{ color: stat.color }} />
              </span>
              <span className="flex flex-col justify-center min-w-0 leading-tight">
                <span className="text-lg font-extrabold" style={{ color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</span>
                <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{stat.label}</span>
              </span>
            </button>
          ))}
        </div>

        {/* ═══ GLOBAL FILTER BAR ═══ */}
        <div className="card-elevated p-3 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                <Filter className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{t('government.filters')}</span>
            </div>
            <TableauSelect
              label={t('government.state')}
              value={selectedState}
              options={[{ value: 'all', label: t('government.allStates') }, ...allStates.map(s => ({ value: s, label: s }))]}
              onChange={setSelectedState}
              icon={MapPin}
              width="160px"
            />
            <TableauSelect
              label={t('government.alertDisease')}
              value={alertDiseaseFilter}
              options={[{ value: 'all', label: t('government.allDiseases') }, ...ALL_COLLECTED_DISEASES.map(d => ({ value: d, label: d }))]}
              onChange={setAlertDiseaseFilter}
              icon={AlertTriangle}
              width="180px"
            />
            {selectedState !== 'all' && (
              <button
                onClick={() => { setSelectedState('all'); setAlertDiseaseFilter('all'); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(229,46,66,0.2)' }}
              >
                <X className="w-3 h-3" /> {t('government.clearFilters')}
              </button>
            )}
          </div>
        </div>


        {/* ═══ ROW 1: Disease Trends + Facility Distribution + Performance ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">

          {/* Disease Trends (Tableau-style) */}
          <div className="lg:col-span-2 glass-section flex flex-col">
            <div className="glass-section-header flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.weeklyDiseaseTrends')}</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)' }}>{t('government.surveillance')}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ChartTypeSelector
                  value={dtChartType}
                  options={[
                    { value: 'line', label: t('government.chartLine'), icon: LineChartIcon },
                    { value: 'area', label: t('government.chartArea'), icon: Activity },
                    { value: 'bar', label: t('government.chartBar'), icon: BarChart3 },
                    { value: 'composed', label: t('government.chartMixed'), icon: Layers },
                  ]}
                  onChange={setDtChartType}
                />
                <TableauMultiSelect
                  label={t('government.diseases')}
                  options={WEEKLY_DISEASE_KEYS.map(d => ({
                    value: d, label: d.charAt(0).toUpperCase() + d.slice(1), color: DISEASE_COLORS[d],
                  }))}
                  selected={dtSelectedDiseases}
                  onChange={setDtSelectedDiseases}
                  icon={Filter}
                />
                <ExpandButton onClick={() => setFullscreenChart('diseaseTrend')} />
              </div>
            </div>
            <div className="p-3 flex-1 min-h-0">
              {diseaseTrendHasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  {renderDiseaseTrend()}
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon={TrendingUp} title="No data yet" message="No disease trends for the selected diseases or period." />
                </div>
              )}
            </div>
          </div>

          {/* Facility Types + Performance */}
          <div className="space-y-3">
            <div className="glass-section">
              <div className="glass-section-header">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.facilityTypes')}</span>
              </div>
              {facilityDistribution.length === 0 || facilityDistribution.every(d => !d.value) ? (
                <div className="p-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 110 }}>
                  <PieChartIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No data yet</span>
                </div>
              ) : (
              <div className="p-3 flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <ResponsiveContainer width={110} height={110}>
                    <PieChart>
                      <Pie data={facilityDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={32} paddingAngle={2}>
                        {facilityDistribution.map((_, i) => <Cell key={i} fill={FACILITY_COLORS[i % FACILITY_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{totalHospitals}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  {facilityDistribution.map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: FACILITY_COLORS[i % FACILITY_COLORS.length] }} />
                        {entry.name}
                      </span>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>

            <div className="glass-section">
              <div className="glass-section-header">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.performance')}</span>
                <div className="flex items-center gap-1.5">
                  <ChartTypeSelector
                    value={perfView}
                    options={[
                      { value: 'gauges', label: t('government.chartGauges'), icon: Target },
                      { value: 'radar', label: t('government.chartRadar'), icon: Activity },
                      { value: 'bar', label: t('government.chartBar'), icon: BarChart3 },
                    ]}
                    onChange={setPerfView}
                  />
                  <ExpandButton onClick={() => setFullscreenChart('performance')} />
                </div>
              </div>
              {renderPerformance()}
            </div>
          </div>
        </div>

        {/* ═══ ROW 2: Cases by State + Health Visits + Staff ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">

          {/* Cases by State */}
          <div className="glass-section flex flex-col">
            <div className="glass-section-header flex-wrap gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.casesByState')}</span>
              <div className="flex items-center gap-1.5">
                <ChartTypeSelector
                  value={csChartType}
                  options={[
                    { value: 'bar', label: t('government.chartBar'), icon: BarChart3 },
                    { value: 'stacked', label: t('government.chartStacked'), icon: Layers },
                    { value: 'radar', label: t('government.chartRadar'), icon: Activity },
                    { value: 'pie', label: t('government.chartPie'), icon: PieChartIcon },
                  ]}
                  onChange={setCsChartType}
                />
                <ExpandButton onClick={() => setFullscreenChart('stateCases')} />
              </div>
            </div>
            <div className="px-3 pt-2 flex items-center gap-2 flex-wrap">
              {csChartType === 'bar' ? (
                <TableauSelect
                  label={t('government.disease')}
                  value={csSingleDisease}
                  options={[
                    ...STATE_DISEASE_KEYS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })),
                  ]}
                  onChange={setCsSingleDisease}
                  icon={Filter}
                  width="110px"
                />
              ) : (
                <TableauMultiSelect
                  label={t('government.diseases')}
                  options={STATE_DISEASE_KEYS.map(d => ({
                    value: d, label: d.charAt(0).toUpperCase() + d.slice(1), color: DISEASE_COLORS[d],
                  }))}
                  selected={csSelectedDiseases}
                  onChange={setCsSelectedDiseases}
                  icon={Filter}
                />
              )}
            </div>
            <div className="p-3 flex-1 min-h-0" style={{ minHeight: '220px' }}>
              {stateCasesHasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  {renderStateCases()}
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon={BarChart3} title="No data yet" message="No cases reported for the selected states or diseases." />
                </div>
              )}
            </div>
          </div>

          {/* Health Visits */}
          <div className="glass-section flex flex-col">
            <div className="glass-section-header flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.healthVisits')}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('government.sixMonths')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ChartTypeSelector
                  value={hvChartType}
                  options={[
                    { value: 'line', label: t('government.chartLine'), icon: LineChartIcon },
                    { value: 'area', label: t('government.chartArea'), icon: Activity },
                    { value: 'bar', label: t('government.chartBar'), icon: BarChart3 },
                  ]}
                  onChange={setHvChartType}
                />
                <ExpandButton onClick={() => setFullscreenChart('healthVisits')} />
              </div>
            </div>
            <div className="px-3 pt-2">
              <TableauMultiSelect
                label={t('government.metrics')}
                options={[
                  { value: 'OPD Visits', label: t('government.opdVisits'), color: '#2563EB' },
                  { value: 'ANC Visits', label: t('government.ancVisits'), color: '#EC4899' },
                  { value: 'Immunizations', label: t('government.immunizations'), color: '#A855F7' },
                ]}
                selected={hvSelectedSeries}
                onChange={setHvSelectedSeries}
                icon={Filter}
              />
            </div>
            <div className="p-3 flex-1 min-h-0" style={{ minHeight: '220px' }}>
              {visitsHasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  {renderVisits()}
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon={TrendingUp} title="No data yet" message="No health-visit records for the selected metrics or period." />
                </div>
              )}
            </div>
          </div>

          {/* Staff Distribution */}
          <div className="glass-section flex flex-col">
            <div className="glass-section-header flex-wrap gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.staffDistribution')}</span>
              <div className="flex items-center gap-1.5">
                <ChartTypeSelector
                  value={sdChartType}
                  options={[
                    { value: 'bar', label: t('government.chartGrouped'), icon: BarChart3 },
                    { value: 'stacked', label: t('government.chartStacked'), icon: Layers },
                    { value: 'pie', label: t('government.chartPie'), icon: PieChartIcon },
                  ]}
                  onChange={setSdChartType}
                />
                <ExpandButton onClick={() => setFullscreenChart('staffDist')} />
              </div>
            </div>
            <div className="px-3 pt-2 flex items-center gap-2 flex-wrap">
              <TableauSelect
                label={t('government.show')}
                value={sdMetric}
                options={[{ value: 'count', label: t('government.headcount') }, { value: 'ratio', label: t('government.ratioPct') }]}
                onChange={v => setSdMetric(v as 'count' | 'ratio')}
                icon={Sliders}
                width="100px"
              />
              <TableauMultiSelect
                label={t('government.roles')}
                options={[
                  { value: 'Doctors', label: t('government.roleDoctors'), color: '#2563EB' },
                  { value: 'Nurses', label: t('government.roleNurses'), color: '#1B9E77' },
                  { value: 'Clinical Officers', label: t('government.roleClinicalOfficers'), color: '#A855F7' },
                ]}
                selected={sdSelectedRoles}
                onChange={setSdSelectedRoles}
                icon={Users}
              />
            </div>
            <div className="p-3 flex-1 min-h-0" style={{ minHeight: '220px' }}>
              {staffHasData ? (
                <ResponsiveContainer width="100%" height="100%">
                  {renderStaff()}
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon={BarChart3} title="No data yet" message="No staffing data for the selected roles or facilities." />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ DHIS2 EXPORT ═══ */}
        <div className="card-elevated p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: 'transparent' }}>
                <Download className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.exportToDhis2')}</h3>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('government.dhis2ExportDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TableauSelect
                label={t('government.period')}
                value={dhis2Period}
                options={[{ value: 'monthly', label: t('government.periodMonthly') }, { value: 'quarterly', label: t('government.periodQuarterly') }]}
                onChange={v => setDhis2Period(v as 'monthly' | 'quarterly')}
                icon={Calendar}
                width="100px"
              />
              <button
                onClick={handleDhis2Export}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'var(--color-success)' }}
              >
                <Download className="w-3.5 h-3.5" />
                {t('government.exportJson')}
              </button>
            </div>
          </div>
        </div>

        {/* ═══ STATE/COUNTY DRILL-DOWN TABLE ═══ */}
        <div className="card-elevated overflow-hidden mb-4">
          <div className="flex items-center justify-between p-4 pb-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Building2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              {t('government.hospitalPerformanceByState')}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTableSortBy(prev => prev === 'name' ? 'quality' : 'name')}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
              >
                <ArrowUpDown className="w-3 h-3" />
                {t('government.sortLabel', { field: tableSortBy === 'quality' ? t('government.dataQuality') : t('government.name') })}
              </button>
              <button onClick={() => router.push('/hospitals')} className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>{t('government.viewAll')}</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  <th>{t('government.colStateHospital')}</th>
                  <th>{t('government.colFacilities')}</th>
                  <th>{t('government.colPatients')}</th>
                  <th>{t('government.colBeds')}</th>
                  <th>{t('government.colStaff')}</th>
                  <th>{t('government.colDataQuality')}</th>
                  <th>{t('government.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {stateAggregates.map(sa => {
                  const isExpanded = expandedStates[sa.state] || false;
                  const stateHospitals = tableSortBy === 'quality'
                    ? [...sa.hospitals].sort((a, b) => calcDataQuality(b) - calcDataQuality(a))
                    : [...sa.hospitals].sort((a, b) => a.name.localeCompare(b.name));
                  const avgQuality = sa.hospitals.length > 0
                    ? Math.round(sa.hospitals.reduce((s, h) => s + calcDataQuality(h), 0) / sa.hospitals.length) : 0;
                  return (
                    <React.Fragment key={sa.state}>
                      <tr className="cursor-pointer transition-colors" onClick={() => toggleState(sa.state)} style={{ background: 'var(--overlay-subtle)' }}>
                        <td>
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} /> : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
                            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{sa.state}</span>
                          </div>
                        </td>
                        <td className="font-semibold text-sm">{sa.facilityCount}</td>
                        <td className="font-semibold text-sm">{sa.totalPatients.toLocaleString()}</td>
                        <td className="text-sm">{sa.totalBeds.toLocaleString()}</td>
                        <td className="text-sm">{sa.totalStaff.toLocaleString()}</td>
                        <td><DataQualityBadge score={avgQuality} /></td>
                        <td><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('government.onlineCount', { online: sa.hospitals.filter(h => h.syncStatus === 'online').length, total: sa.facilityCount })}</span></td>
                      </tr>
                      {isExpanded && stateHospitals.map(h => (
                        <tr key={h._id} className="cursor-pointer" onClick={() => router.push(`/hospitals?facility=${h._id}`)}>
                          <td>
                            <div className="flex items-center gap-2 pl-6">
                              <div>
                                <p className="font-medium text-sm">{h.name}</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{typeLabel(h.facilityType)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-[10px]" style={{ color: 'var(--text-muted)' }}>--</td>
                          <td className="font-semibold text-sm">{h.patientCount.toLocaleString()}</td>
                          <td className="text-sm">{h.totalBeds}</td>
                          <td className="text-sm">{h.doctors + h.nurses + h.clinicalOfficers}</td>
                          <td><DataQualityBadge score={calcDataQuality(h)} /></td>
                          <td>
                            <span className="flex items-center gap-1 text-[10px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: syncDotColor(h.syncStatus) }} />
                              {h.syncStatus.charAt(0).toUpperCase() + h.syncStatus.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ BOTTOM: Alerts + Referrals ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Disease Alerts */}
          <div className="glass-section">
            <div className="glass-section-header">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.diseaseAlerts')}</span>
                {alertDiseaseFilter !== 'all' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)' }}>{alertDiseaseFilter}</span>
                )}
                {selectedState !== 'all' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{selectedState}</span>
                )}
              </div>
              <button onClick={() => router.push('/surveillance')} className="text-[10px] font-medium" style={{ color: 'var(--accent-primary)' }}>{t('government.viewAll')}</button>
            </div>
            <div className="p-3 space-y-2" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {sortedAlerts.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('government.noAlertsMatch')}</p>
              )}
              {sortedAlerts.slice(0, 6).map(alert => (
                <div key={alert._id} className="p-3 rounded-md cursor-pointer" onClick={() => router.push('/surveillance')} style={{
                  background: alert.alertLevel === 'emergency' ? 'rgba(229,46,66,0.08)' : alert.alertLevel === 'warning' ? 'rgba(252,211,77,0.08)' : 'rgba(56,189,248,0.06)',
                  border: `1px solid ${alert.alertLevel === 'emergency' ? 'rgba(229,46,66,0.15)' : alert.alertLevel === 'warning' ? 'rgba(252,211,77,0.15)' : 'rgba(56,189,248,0.1)'}`,
                }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{alert.disease}</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: alert.alertLevel === 'emergency' ? 'rgba(229,46,66,0.15)' : alert.alertLevel === 'warning' ? 'rgba(252,211,77,0.15)' : 'rgba(56,189,248,0.15)',
                      color: alert.alertLevel === 'emergency' ? 'var(--color-danger)' : alert.alertLevel === 'warning' ? 'var(--color-warning)' : '#2563EB',
                    }}>{alert.alertLevel.toUpperCase()}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('government.alertCasesDeaths', { state: alert.state, cases: alert.cases, deaths: alert.deaths })}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {alert.trend === 'increasing' ? <TrendingUp className="w-2.5 h-2.5" style={{ color: 'var(--color-danger)' }} /> : alert.trend === 'decreasing' ? <TrendingDown className="w-2.5 h-2.5" style={{ color: 'var(--color-success)' }} /> : <Minus className="w-2.5 h-2.5" style={{ color: 'var(--color-warning)' }} />}
                    <span className="text-[9px]" style={{ color: alert.trend === 'increasing' ? 'var(--color-danger)' : alert.trend === 'decreasing' ? 'var(--color-success)' : 'var(--color-warning)' }}>{alert.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Referrals */}
          <div className="glass-section">
            <div className="glass-section-header">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('government.recentReferrals')}</span>
              </div>
              <button onClick={() => router.push('/referrals')} className="text-[10px] font-medium" style={{ color: 'var(--accent-primary)' }}>{t('government.viewAll')}</button>
            </div>
            <div className="p-3 space-y-2">
              {referrals.slice(0, 4).map(ref => (
                <div key={ref._id} className="p-2.5 rounded-md" style={{ border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <PatientName patientId={ref.patientId} name={ref.patientName} nameClassName="text-[11px] font-semibold" />
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: ref.urgency === 'emergency' ? 'rgba(229,46,66,0.12)' : ref.urgency === 'urgent' ? 'rgba(252,211,77,0.12)' : 'rgba(0,119,215,0.12)',
                      color: ref.urgency === 'emergency' ? 'var(--color-danger)' : ref.urgency === 'urgent' ? 'var(--color-warning)' : 'var(--accent-primary)',
                    }}>{ref.urgency}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{ref.fromHospital} → {ref.toHospital}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{ref.department} · {ref.referralDate}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

    </>
  );
}
