'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import {
  Building2, BedDouble, Users, Stethoscope, WifiOff,
  Zap, ZapOff, Sun, Truck, Signal, Clock, Activity,
  MapPin, HeartPulse, X, Search, Filter, ChevronDown,
  FlaskConical, Download, Eye, Settings,
  Syringe, Baby, Pill, ShieldCheck, Microscope,
} from '@/components/icons/lucide';
import {
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { HospitalDoc, UserRole } from '@/lib/db-types';

// Roles that can open the per-hospital management dashboard. The route itself
// gates again (defence-in-depth), but hiding the button for unauthorized
// roles keeps the UI clean.
const MANAGE_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'medical_superintendent', 'hrio',
];
import {
  getPerformanceColor, getMetricColorInterpolated,
  METRIC_LABELS, type PerformanceMetricKey,
} from '@/lib/performance-colors';
import { states, statesAndCounties } from '@/data/mock';

// ───────────────────────────── helpers ─────────────────────────────
const TYPE_LABEL_KEYS: Record<string, string> = {
  national_referral: 'hospitals.typeNationalReferral',
  state_hospital: 'hospitals.typeStateHospital',
  county_hospital: 'hospitals.typeCountyHospital',
  phcc: 'hospitals.typePhcc',
  phcu: 'hospitals.typePhcu',
};

const TYPE_SHORT: Record<string, string> = {
  national_referral: 'NR',
  state_hospital: 'SH',
  county_hospital: 'CH',
  phcc: 'PHCC',
  phcu: 'PHCU',
};

const OWNERSHIP_LABEL_KEYS: Record<string, string> = {
  public: 'hospitals.ownershipPublic',
  ngo: 'hospitals.ownershipNgo',
  private: 'hospitals.ownershipPrivate',
  faith_based: 'hospitals.ownershipFaithBased',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  functional: 'hospitals.statusFunctional',
  partially_functional: 'hospitals.statusPartial',
  non_functional: 'hospitals.statusNonFunctional',
  closed: 'hospitals.statusClosed',
};

const STATUS_COLORS: Record<string, string> = {
  functional: 'var(--accent-primary)',
  partially_functional: 'var(--color-warning)',
  non_functional: 'var(--color-danger)',
  closed: 'var(--text-muted)',
};

const METRIC_KEYS: PerformanceMetricKey[] = [
  'reportingCompleteness', 'serviceReadinessScore', 'tracerMedicineAvailability',
  'staffingScore', 'ancCoverage', 'immunizationCoverage', 'qualityScore',
  'stockOutDays', 'opdVisitsPerMonth',
];

const PERCENTAGE_METRICS: PerformanceMetricKey[] = [
  'reportingCompleteness', 'serviceReadinessScore', 'tracerMedicineAvailability',
  'staffingScore', 'ancCoverage', 'immunizationCoverage', 'qualityScore',
];

const SERVICE_FLAG_ICONS: Record<string, { icon: React.ElementType; labelKey: string }> = {
  epi: { icon: Syringe, labelKey: 'hospitals.serviceEpi' },
  anc: { icon: Baby, labelKey: 'hospitals.serviceAnc' },
  delivery: { icon: HeartPulse, labelKey: 'hospitals.serviceDelivery' },
  hiv: { icon: ShieldCheck, labelKey: 'hospitals.serviceHiv' },
  tb: { icon: Activity, labelKey: 'hospitals.serviceTb' },
  emergencySurgery: { icon: FlaskConical, labelKey: 'hospitals.serviceSurgery' },
  laboratory: { icon: Microscope, labelKey: 'hospitals.serviceLab' },
  pharmacy: { icon: Pill, labelKey: 'hospitals.servicePharmacy' },
};

function formatMetricValue(key: PerformanceMetricKey, value: number): string {
  if (key === 'opdVisitsPerMonth') return value.toLocaleString();
  if (key === 'stockOutDays') return `${value}d`;
  return `${Math.round(value)}%`;
}

function normalizeMetricForColor(key: PerformanceMetricKey, value: number): number {
  if (key === 'stockOutDays') return Math.max(0, 100 - value * 3.3);
  if (key === 'opdVisitsPerMonth') return Math.min(100, value / 60);
  return value;
}

// ───────────────────────────── page ─────────────────────────────
function HospitalsPageInner() {
  const { t } = useTranslation();
  const { hospitals, loading } = useHospitals();
  const { globalSearch, currentUser } = useApp();
  const canManage = !!currentUser && MANAGE_ROLES.includes(currentUser.role);
  const searchParams = useSearchParams();
  const [selectedHospital, setSelectedHospital] = useState<HospitalDoc | null>(null);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('all');

  // Auto-select hospital from URL query param. Re-run whenever the param
  // changes — guarding on `!selectedHospital` previously froze the selection
  // after the first auto-select, so navigating back to the page with a new
  // ?facility= silently kept the old card open.
  const facilityIdParam = searchParams.get('facility');
  useEffect(() => {
    if (!facilityIdParam || hospitals.length === 0) return;
    const found = hospitals.find(h => h._id === facilityIdParam);
    if (found) setSelectedHospital(found);
  }, [facilityIdParam, hospitals]);
  const [filterCounty, setFilterCounty] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterOwnership, setFilterOwnership] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [colorMetric, setColorMetric] = useState<PerformanceMetricKey>('serviceReadinessScore');
  const [showFilters, setShowFilters] = useState(true);

  // Counties for selected state
  const availableCounties = useMemo(() => {
    if (filterState === 'all') return [];
    return statesAndCounties[filterState] || [];
  }, [filterState]);

  // Reset county when state changes
  useEffect(() => { setFilterCounty('all'); }, [filterState]);

  // ── Filter ──
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h => {
      const combined = [search, globalSearch].filter(Boolean).join(' ').toLowerCase().trim();
      if (combined) {
        const terms = combined.split(/\s+/);
        const haystack = [h.name || '', h.state || '', h.town || '', h.facilityType || '', ...(h.services || [])].join(' ').toLowerCase();
        if (!terms.every(term => haystack.includes(term))) return false;
      }
      if (filterState !== 'all' && h.state !== filterState) return false;
      if (filterCounty !== 'all' && h.county !== filterCounty) return false;
      if (filterType !== 'all' && h.facilityType !== filterType) return false;
      if (filterOwnership !== 'all' && h.ownership !== filterOwnership) return false;
      if (filterStatus !== 'all' && h.operationalStatus !== filterStatus) return false;
      if (filterService !== 'all' && h.serviceFlags) {
        const flags = h.serviceFlags as Record<string, boolean>;
        if (!flags[filterService]) return false;
      }
      return true;
    });
  }, [hospitals, search, globalSearch, filterState, filterCounty, filterType, filterOwnership, filterStatus, filterService]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const f = filteredHospitals;
    const n = f.length || 1;
    const functional = f.filter(h => h.operationalStatus === 'functional').length;
    const avgReporting = f.reduce((s, h) => s + (h.performance?.reportingCompleteness || 0), 0) / n;
    const avgReadiness = f.reduce((s, h) => s + (h.performance?.serviceReadinessScore || 0), 0) / n;
    const coverageGaps = f.filter(h => (h.performance?.immunizationCoverage || 0) < 50).length;
    const totalStaff = f.reduce((s, h) => s + (h.doctors || 0) + (h.nurses || 0) + (h.clinicalOfficers || 0), 0);
    const totalBeds = f.reduce((s, h) => s + (h.totalBeds || 0), 0);
    return {
      total: f.length,
      pctFunctional: f.length ? Math.round((functional / f.length) * 100) : 0,
      avgReporting: Math.round(avgReporting),
      avgReadiness: Math.round(avgReadiness),
      coverageGaps,
      staffPerBed: totalBeds ? (totalStaff / totalBeds).toFixed(1) : '—',
    };
  }, [filteredHospitals]);

  // ── CSV export ──
  const handleExport = useCallback(() => {
    const headers = ['Name', 'Type', 'State', 'County', 'Town', 'Ownership', 'Status', 'Beds',
      'Doctors', 'Nurses', 'Reporting%', 'Readiness%', 'Medicines%', 'Staffing%',
      'ANC Coverage%', 'EPI Coverage%', 'Quality', 'OPD/Month', 'Stock-out Days'];
    const rows = filteredHospitals.map(h => [
      h.name, TYPE_LABEL_KEYS[h.facilityType] ? t(TYPE_LABEL_KEYS[h.facilityType]) : h.facilityType, h.state, h.county, h.town,
      h.ownership, h.operationalStatus, h.totalBeds,
      h.doctors, h.nurses,
      h.performance?.reportingCompleteness, h.performance?.serviceReadinessScore,
      h.performance?.tracerMedicineAvailability, h.performance?.staffingScore,
      h.performance?.ancCoverage, h.performance?.immunizationCoverage,
      h.performance?.qualityScore, h.performance?.opdVisitsPerMonth, h.performance?.stockOutDays,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facility-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredHospitals]);

  if (loading) {
    return (
      <>
        <TopBar title={t('hospitals.topBarTitle')} />
        <main className="page-container flex items-center justify-center page-enter">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('hospitals.loadingFacilities')}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('hospitals.topBarTitle')} />
      <main className="page-container page-enter">
        <PageHeader
          icon={Building2}
          title={t('hospitalManager.hospitalNetwork')}
          subtitle={t('hospitals.facilitiesCount', { count: filteredHospitals.length })}
          actions={
            <>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                <input type="text" placeholder={t('hospitals.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, width: 200 }} />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                <Filter style={{ width: 13, height: 13 }} /> {t('hospitals.filters')}
                <ChevronDown style={{ width: 12, height: 12, transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <button onClick={handleExport} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                <Download style={{ width: 13, height: 13 }} /> {t('action.export')}
              </button>
            </>
          }
        />

        {/* ── Filters ── */}
        {showFilters && (
          <div className="card-elevated" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <FilterDropdown label={t('hospitals.filterState')} value={filterState} onChange={setFilterState} options={[{ value: 'all', label: t('hospitals.allStates') }, ...states.map(s => ({ value: s, label: s }))]} />
            {availableCounties.length > 0 && (
              <FilterDropdown label={t('hospitals.filterCounty')} value={filterCounty} onChange={setFilterCounty} options={[{ value: 'all', label: t('hospitals.allCounties') }, ...availableCounties.map(c => ({ value: c, label: c }))]} />
            )}
            <FilterDropdown label={t('hospitals.filterType')} value={filterType} onChange={setFilterType} options={[{ value: 'all', label: t('hospitals.allTypes') }, ...Object.entries(TYPE_LABEL_KEYS).map(([v, l]) => ({ value: v, label: t(l) }))]} />
            <FilterDropdown label={t('hospitals.filterOwnership')} value={filterOwnership} onChange={setFilterOwnership} options={[{ value: 'all', label: t('hospitals.allOwnership') }, ...Object.entries(OWNERSHIP_LABEL_KEYS).map(([v, l]) => ({ value: v, label: t(l) }))]} />
            <FilterDropdown label={t('hospitals.filterService')} value={filterService} onChange={setFilterService} options={[{ value: 'all', label: t('hospitals.allServices') }, ...Object.entries(SERVICE_FLAG_ICONS).map(([k, v]) => ({ value: k, label: t(v.labelKey) }))]} />
            <FilterDropdown label={t('hospitals.filterStatus')} value={filterStatus} onChange={setFilterStatus} options={[{ value: 'all', label: t('hospitals.allStatus') }, ...Object.entries(STATUS_LABEL_KEYS).map(([v, l]) => ({ value: v, label: t(l) }))]} />
            <div style={{ width: 1, height: 20, background: 'var(--border-light)' }} />
            <FilterDropdown label={t('hospitals.colorBy')} value={colorMetric} onChange={v => setColorMetric(v as PerformanceMetricKey)} options={METRIC_KEYS.map(k => ({ value: k, label: METRIC_LABELS[k] }))} />
          </div>
        )}

        {/* ── KPIs ── */}
        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <KpiCard label={t('hospitals.kpiFacilities')} value={kpis.total} icon={Building2} color="#14B8A6" />
          <KpiCard label={t('hospitals.kpiFunctional')} value={`${kpis.pctFunctional}%`} icon={ShieldCheck} color={getPerformanceColor(kpis.pctFunctional)} />
          <KpiCard label={t('hospitals.kpiReporting')} value={`${kpis.avgReporting}%`} icon={Activity} color={getPerformanceColor(kpis.avgReporting)} />
          <KpiCard label={t('hospitals.kpiReadiness')} value={`${kpis.avgReadiness}%`} icon={Stethoscope} color={getPerformanceColor(kpis.avgReadiness)} />
          <KpiCard label={t('hospitals.kpiGaps')} value={kpis.coverageGaps} icon={Syringe} color={kpis.coverageGaps > 5 ? 'var(--color-danger)' : 'var(--color-warning)'} />
          <KpiCard label={t('hospitals.kpiStaffPerBed')} value={kpis.staffPerBed} icon={Users} color="#3B82F6" />
        </div>

        {/* ── Facility Table / Profile ── */}
        <div className="card-elevated" style={{ overflow: 'hidden' }}>
          {selectedHospital ? (
            <FacilityProfile hospital={selectedHospital} onClose={() => setSelectedHospital(null)} canManage={canManage} />
          ) : (
            <FacilityList hospitals={filteredHospitals} colorMetric={colorMetric} onSelect={setSelectedHospital} canManage={canManage} />
          )}
        </div>
      </main>
    </>
  );
}

// ═══════════════════════════════════════════
//  Filter Dropdown
// ═══════════════════════════════════════════
function FilterDropdown({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const isActive = value !== 'all' && value !== options[0]?.value;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-[11px] font-semibold cursor-pointer transition-colors"
        style={{
          background: isActive ? 'rgba(43,111,224,0.08)' : 'var(--bg-card)',
          color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
          border: isActive ? '1px solid rgba(43,111,224,0.2)' : '1px solid var(--border-light)',
          borderRadius: 'var(--input-radius)',
          padding: '5px 28px 5px 10px',
          maxWidth: '160px',
          minHeight: '30px',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════
//  KPI Card
// ═══════════════════════════════════════════
function KpiCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="kpi">
      <div className="icon-box-sm" style={{ background: `${color}18` }}>
        <Icon style={{ color }} />
      </div>
      <div className="kpi__body">
        <div className="kpi__value">{value}</div>
        <div className="kpi__label">{label}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Facility List (no selection)
// ═══════════════════════════════════════════
function FacilityList({ hospitals, colorMetric, onSelect, canManage }: {
  hospitals: HospitalDoc[];
  colorMetric: PerformanceMetricKey;
  onSelect: (h: HospitalDoc) => void;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  if (hospitals.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Building2 style={{ width: 32, height: 32, color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('hospitals.noFacilitiesMatch')}</p>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto' }}>
      <table className="data-table" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ width: '28%' }}>{t('hospitals.colFacility')}</th>
            <th style={{ width: '10%' }}>{t('hospitals.colType')}</th>
            <th style={{ width: '14%' }}>{t('hospitals.colLocation')}</th>
            <th style={{ width: '8%' }}>{t('hospitals.colStatus')}</th>
            <th style={{ width: '8%' }}>{t('hospitals.colBeds')}</th>
            <th style={{ width: '8%' }}>{t('hospitals.colStaff')}</th>
            <th style={{ width: '14%' }}>{METRIC_LABELS[colorMetric]}</th>
            <th style={{ width: '10%' }}>{t('hospitals.colSync')}</th>
            {canManage && <th style={{ width: '8%' }}></th>}
          </tr>
        </thead>
        <tbody>
          {hospitals.map(h => {
            const metricVal = h.performance ? (h.performance[colorMetric as keyof typeof h.performance] as number) : 0;
            const normVal = normalizeMetricForColor(colorMetric, metricVal);
            const staff = (h.doctors || 0) + (h.nurses || 0) + (h.clinicalOfficers || 0);
            return (
              <tr key={h._id} onClick={() => onSelect(h)} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: getMetricColorInterpolated(normVal), flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{h.name}</span>
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    background: 'var(--accent-light)', color: 'var(--accent-primary)',
                  }}>
                    {TYPE_SHORT[h.facilityType] || h.facilityType}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{h.town}, {h.state}</td>
                <td>
                  {h.operationalStatus && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: STATUS_COLORS[h.operationalStatus] }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLORS[h.operationalStatus] }} />
                      {t(STATUS_LABEL_KEYS[h.operationalStatus])}
                    </span>
                  )}
                </td>
                <td className="stat-value" style={{ fontWeight: 600 }}>{h.totalBeds}</td>
                <td className="stat-value" style={{ fontWeight: 600 }}>{staff}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      flex: 1, height: 4, borderRadius: 2, background: 'var(--overlay-subtle)', maxWidth: 60,
                    }}>
                      <div style={{
                        width: `${Math.min(100, PERCENTAGE_METRICS.includes(colorMetric) ? metricVal : normVal)}%`,
                        height: '100%', borderRadius: 2,
                        background: getPerformanceColor(normVal),
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: getPerformanceColor(normVal), minWidth: 36 }}>
                      {formatMetricValue(colorMetric, metricVal)}
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500,
                    color: h.syncStatus === 'online' ? 'var(--color-success)' : h.syncStatus === 'syncing' ? 'var(--color-warning)' : 'var(--text-muted)',
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: h.syncStatus === 'online' ? 'var(--color-success)' : h.syncStatus === 'syncing' ? 'var(--color-warning)' : 'var(--text-muted)',
                    }} />
                    {h.syncStatus}
                  </span>
                </td>
                {canManage && (
                  <td onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/hospitals/${h._id}/manage`}
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 4, padding: '4px 8px', fontSize: 11 }}
                    >
                      <Settings style={{ width: 11, height: 11 }} /> {t('hospitals.manage')}
                    </Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Facility Profile Panel (with selection)
// ═══════════════════════════════════════════
function FacilityProfile({ hospital, onClose, canManage }: {
  hospital: HospitalDoc;
  onClose: () => void;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const formatLastSync = (iso: string) => {
    if (!iso) return t('hospitals.syncUnknown');
    const d = new Date(iso);
    if (isNaN(d.getTime())) return t('hospitals.syncUnknown');
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return t('hospitals.syncJustNow');
    if (diffMin < 60) return t('hospitals.syncMinutesAgo', { count: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t('hospitals.syncHoursAgo', { count: diffHr });
    return t('hospitals.syncDaysAgo', { count: Math.floor(diffHr / 24) });
  };

  const totalStaff = (hospital.doctors || 0) + (hospital.clinicalOfficers || 0) + (hospital.nurses || 0) + (hospital.labTechnicians || 0) + (hospital.pharmacists || 0);

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{hospital.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)', fontSize: 11 }}>
              {TYPE_LABEL_KEYS[hospital.facilityType] ? t(TYPE_LABEL_KEYS[hospital.facilityType]) : hospital.facilityType}
            </span>
            {hospital.ownership && <span style={{ color: 'var(--text-muted)' }}>{t(OWNERSHIP_LABEL_KEYS[hospital.ownership])}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)' }}>
              <MapPin style={{ width: 12, height: 12 }} />{hospital.town}, {hospital.state}
            </span>
            {hospital.operationalStatus && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: STATUS_COLORS[hospital.operationalStatus] }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[hospital.operationalStatus] }} />
                {t(STATUS_LABEL_KEYS[hospital.operationalStatus])}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {canManage && (
            <Link
              href={`/hospitals/${hospital._id}/manage`}
              className="btn btn-primary btn-sm"
              style={{ gap: 4 }}
            >
              <Settings style={{ width: 13, height: 13 }} /> {t('hospitals.manage')}
            </Link>
          )}
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      <hr className="section-divider" />

      {/* Quick stats row */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}><Users style={{ color: 'var(--accent-primary)' }} /></div><div className="kpi__body"><div className="kpi__value">{hospital.patientCount.toLocaleString()}</div><div className="kpi__label">{t('hospitals.statPatients')}</div></div></div>
        <div className="kpi"><div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}><Activity style={{ color: 'var(--accent-primary)' }} /></div><div className="kpi__body"><div className="kpi__value">{hospital.todayVisits}</div><div className="kpi__label">{t('hospitals.statToday')}</div></div></div>
        <div className="kpi"><div className="icon-box-sm" style={{ background: 'rgba(168,85,247,0.08)' }}><BedDouble style={{ color: '#A78BFA' }} /></div><div className="kpi__body"><div className="kpi__value">{hospital.totalBeds}</div><div className="kpi__label">{t('hospitals.statBeds')}</div></div></div>
        <div className="kpi"><div className="icon-box-sm" style={{ background: 'rgba(168,85,247,0.08)' }}><Stethoscope style={{ color: '#A78BFA' }} /></div><div className="kpi__body"><div className="kpi__value">{totalStaff}</div><div className="kpi__label">{t('hospitals.statStaff')}</div></div></div>
      </div>

      <hr className="section-divider" />

      {/* Performance Metrics — horizontal bar chart style */}
      {hospital.performance && (
        <div className="card-elevated" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye style={{ width: 14, height: 14, color: 'var(--text-muted)' }} /> {t('hospitals.performanceMetrics')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...PERCENTAGE_METRICS, 'stockOutDays' as PerformanceMetricKey, 'opdVisitsPerMonth' as PerformanceMetricKey].map(key => {
              const val = hospital.performance![key as keyof typeof hospital.performance] as number;
              const norm = normalizeMetricForColor(key, val);
              const barWidth = PERCENTAGE_METRICS.includes(key) ? val : norm;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>{METRIC_LABELS[key]}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--overlay-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, barWidth)}%`, height: '100%', borderRadius: 3, background: getPerformanceColor(norm), transition: 'width 0.3s' }} />
                  </div>
                  <span className="stat-value" style={{ fontSize: 12, fontWeight: 700, color: getPerformanceColor(norm), minWidth: 40, textAlign: 'right' }}>
                    {formatMetricValue(key, val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <hr className="section-divider" />

      {/* Sparkline + Services — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Trend */}
        {hospital.monthlyTrends && hospital.monthlyTrends.length > 0 && (
          <div className="card-elevated" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{t('hospitals.sixMonthTrend')}</div>
            {hospital.monthlyTrends.every(m => !m.opdVisits && !m.reportingTimeliness) ? (
              <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>—</div>
            ) : (
            <ResponsiveContainer width="100%" height={50}>
              <LineChart data={hospital.monthlyTrends} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <Line type="monotone" dataKey="opdVisits" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="reportingTimeliness" stroke="#10B981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: 'var(--accent-primary)' }} />{t('hospitals.legendOpd')}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 2, borderRadius: 1, background: 'var(--color-success)' }} />{t('hospitals.legendReporting')}</span>
            </div>
          </div>
        )}

        {/* Beds breakdown */}
        <div className="card-elevated" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{t('hospitals.bedsHeader', { count: hospital.totalBeds })}</div>
          <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: t('hospitals.bedsIcu'), value: hospital.icuBeds, color: 'var(--color-danger)' },
              { label: t('hospitals.bedsMaternity'), value: hospital.maternityBeds, color: '#EC4899' },
              { label: t('hospitals.bedsPediatric'), value: hospital.pediatricBeds, color: '#5CB8A8' },
              { label: t('hospitals.bedsGeneral'), value: Math.max(0, hospital.totalBeds - hospital.icuBeds - hospital.maternityBeds - hospital.pediatricBeds), color: 'var(--text-muted)' },
            ].map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 4, height: 12, borderRadius: 2, background: b.color }} />{b.label}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="section-divider" />

      {/* Staff + Services + Infrastructure — compact */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Staff */}
        <div className="card-elevated" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{t('hospitals.staffHeader', { count: totalStaff })}</div>
          <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: t('hospitals.staffDoctors'), value: hospital.doctors, color: 'var(--accent-primary)' },
              { label: t('hospitals.staffClinicalOfficers'), value: hospital.clinicalOfficers, color: '#A78BFA' },
              { label: t('hospitals.staffNurses'), value: hospital.nurses, color: '#EC4899' },
              { label: t('hospitals.staffLabTech'), value: hospital.labTechnicians, color: 'var(--color-warning)' },
              { label: t('hospitals.staffPharmacists'), value: hospital.pharmacists, color: 'var(--color-success)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: s.color }} />{s.label}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Infrastructure */}
        <div className="card-elevated" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{t('hospitals.infrastructure')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {hospital.hasElectricity ? <InfraBadge icon={Zap} label={t('hospitals.infraPower')} color="#FCD34D" bg="rgba(252,211,77,0.10)" />
              : <InfraBadge icon={ZapOff} label={t('hospitals.infraNoPower')} color="#8A9E9A" bg="rgba(100,116,139,0.10)" />}
            {hospital.hasGenerator && <InfraBadge icon={Activity} label={t('hospitals.infraGenerator')} color="#10B981" bg="rgba(16,185,129,0.10)" />}
            {hospital.hasSolar && <InfraBadge icon={Sun} label={t('hospitals.infraSolar')} color="#FCD34D" bg="rgba(252,211,77,0.08)" />}
            {hospital.hasInternet ? <InfraBadge icon={Signal} label={hospital.internetType} color="#5CB8A8" bg="rgba(96,165,250,0.10)" />
              : <InfraBadge icon={WifiOff} label={t('hospitals.infraNoInternet')} color="#8A9E9A" bg="rgba(100,116,139,0.10)" />}
            {hospital.hasAmbulance && <InfraBadge icon={Truck} label={t('hospitals.infraAmbulance')} color="#EF4444" bg="rgba(239,68,68,0.08)" />}
            {hospital.emergency24hr && <InfraBadge icon={HeartPulse} label={t('hospitals.infra24hrEr')} color="#EF4444" bg="rgba(239,68,68,0.08)" />}
          </div>
          {hospital.electricityHours > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{t('hospitals.infraPower')}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--overlay-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${(hospital.electricityHours / 24) * 100}%`, height: '100%', borderRadius: 2, background: hospital.electricityHours >= 12 ? 'var(--color-success)' : hospital.electricityHours >= 6 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
              </div>
              <span className="stat-value" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{hospital.electricityHours}h</span>
            </div>
          )}
        </div>
      </div>

      <hr className="section-divider" />

      {/* Services + Sync */}
      {hospital.serviceFlags && (
        <div className="card-elevated" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>{t('hospitals.servicesAvailable')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(SERVICE_FLAG_ICONS).map(([key, { icon: FlagIcon, labelKey }]) => {
              const available = (hospital.serviceFlags as Record<string, boolean>)?.[key];
              return (
                <span key={key} className="badge" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, background: available ? 'rgba(0,119,215,0.08)' : 'rgba(100,116,139,0.06)', color: available ? 'var(--accent-primary)' : 'var(--text-muted)', opacity: available ? 1 : 0.5 }}>
                  <FlagIcon style={{ width: 11, height: 11 }} /> {t(labelKey)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer: sync + GPS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', padding: '8px 0', borderTop: '1px solid var(--border-light)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: hospital.syncStatus === 'online' ? 'var(--color-success)' : hospital.syncStatus === 'syncing' ? 'var(--color-warning)' : 'var(--text-muted)' }} />
          {hospital.syncStatus} &middot; <Clock style={{ width: 10, height: 10 }} /> {formatLastSync(hospital.lastSync)}
        </span>
        <span className="font-mono">{(hospital.lat ?? 0).toFixed(4)}°N, {(hospital.lng ?? 0).toFixed(4)}°E{hospital.county && ` | ${hospital.county}`}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Small helper components
// ═══════════════════════════════════════════

function InfraBadge({ icon: Icon, label, color, bg }: { icon: React.ElementType; label: string; color: string; bg: string }) {
  return (
    <span className="badge text-[10px]" style={{ background: bg, color }}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export default function HospitalsPage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('status.loading')}</div>}>
      <HospitalsPageInner />
    </Suspense>
  );
}
