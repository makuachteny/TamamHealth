'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import PatientName from '@/components/PatientName';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { usePatients } from '@/lib/hooks/usePatients';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SearchInput, FilterSelect, FilterBar } from '@/components/filters';
import type { ImmunizationDefaulter } from '@/lib/services/immunization-service';
import {
  Syringe, Search, Plus, X, CheckCircle2, Clock, AlertTriangle,
  XCircle, ChevronDown, ChevronUp, Users, ExternalLink,
} from '@/components/icons/lucide';

const VACCINES = ['BCG', 'OPV', 'Penta', 'PCV', 'Rota', 'Measles', 'Yellow Fever', 'Vitamin A'];
const SITES: Array<'left arm' | 'right arm' | 'left thigh' | 'right thigh' | 'oral'> = ['left arm', 'right arm', 'left thigh', 'right thigh', 'oral'];

const statusConfig = {
  completed: { color: '#059669', bg: 'rgba(5,150,105,0.12)', icon: CheckCircle2, label: 'Completed' },
  scheduled: { color: 'var(--color-warning)', bg: 'rgba(252,211,77,0.12)', icon: Clock, label: 'Scheduled' },
  overdue: { color: 'var(--color-danger)', bg: 'rgba(229,46,66,0.12)', icon: AlertTriangle, label: 'Overdue' },
  missed: { color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.12)', icon: XCircle, label: 'Missed' },
};

export default function ImmunizationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { immunizations, stats, coverage, loading, register } = useImmunizations();
  const { patients } = usePatients();
  const { canRecordVitalEvents } = usePermissions();
  // Coverage analytics (summary cards, coverage-by-antigen, coverage-by-age) are
  // a population-health view for facility management and the Ministry of Health.
  // Clinical roles (doctors, nurses, etc.) just work the records and defaulters.
  const canViewCoverage = ['facility_administrator', 'hospital_manager', 'medical_superintendent', 'government', 'county_health_director', 'super_admin'].includes(currentUser?.role ?? '');
  const [search, setSearch] = useState('');
  const [vaccineFilter, setVaccineFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  useBodyScrollLock(showModal);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [patientLookup, setPatientLookup] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'defaulters'>('records');
  const [defaulters, setDefaulters] = useState<ImmunizationDefaulter[]>([]);
  const [defaulterStats, setDefaulterStats] = useState<{ totalDefaulters: number; uniqueChildren: number; critical: number; high: number; medium: number; byVaccine: Record<string, number> } | null>(null);
  const [defaulterFilter, setDefaulterFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [cohortRows, setCohortRows] = useState<Array<{ vaccine: string; cohort: string; covered: number; total: number; percentage: number }>>([]);

  // Load defaulter list + cohort coverage whenever immunization data changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const svc = await import('@/lib/services/immunization-service');
        const [list, s, cohort] = await Promise.all([
          svc.getDefaulters(),
          svc.getDefaulterStats(),
          svc.getCoverageByAgeCohort(),
        ]);
        if (cancelled) return;
        setDefaulters(list);
        setDefaulterStats(s);
        setCohortRows(cohort);
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; };
  }, [immunizations]);

  // Build a {vaccine -> {cohort -> percentage}} grid for the heatmap
  const cohortGrid = useMemo(() => {
    const grid: Record<string, Record<string, { pct: number; covered: number; total: number }>> = {};
    for (const r of cohortRows) {
      if (!grid[r.vaccine]) grid[r.vaccine] = {};
      grid[r.vaccine][r.cohort] = { pct: r.percentage, covered: r.covered, total: r.total };
    }
    return grid;
  }, [cohortRows]);
  const cohortKeys = ['<6mo', '6-12mo', '1-2y', '2-5y', '5y+'];

  // Form state
  const [form, setForm] = useState({
    patientId: '', patientName: '', gender: 'Male' as 'Male' | 'Female',
    dateOfBirth: '', vaccine: 'BCG', doseNumber: 1, dateGiven: new Date().toISOString().slice(0, 10),
    nextDueDate: '', batchNumber: '', site: 'left arm' as typeof SITES[number],
    adverseReaction: false, adverseReactionDetails: '',
  });

  // Filter patients (children only — under 6 years old) for the lookup picker
  const patientMatches = useMemo(() => {
    if (!patientLookup || patientLookup.length < 2) return [];
    const q = patientLookup.toLowerCase();
    return (patients || [])
      .filter(p => {
        const age = p.estimatedAge ?? (p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : 99);
        if (age > 15) return false; // immunizations are pediatric
        return (
          `${p.firstName} ${p.surname}`.toLowerCase().includes(q) ||
          (p.hospitalNumber || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [patientLookup, patients]);

  const selectImmunizationPatient = (id: string) => {
    const p = patients.find(x => x._id === id);
    if (!p) return;
    setForm(f => ({
      ...f,
      patientId: p._id,
      patientName: `${p.firstName || ''} ${p.surname || ''}`.trim(),
      gender: (p.gender as 'Male' | 'Female') || f.gender,
      dateOfBirth: p.dateOfBirth || f.dateOfBirth,
    }));
    setPatientLookup('');
  };

  // Group immunizations by child
  const childGroups = useMemo(() => {
    const groups = new Map<string, typeof immunizations>();
    for (const imm of immunizations) {
      if (!groups.has(imm.patientId)) groups.set(imm.patientId, []);
      groups.get(imm.patientId)!.push(imm);
    }
    return groups;
  }, [immunizations]);

  const filteredChildren = useMemo(() => {
    const entries = Array.from(childGroups.entries());
    const q = search.toLowerCase();
    return entries.filter(([, records]) =>
      (!search || records[0]?.patientName?.toLowerCase().includes(q)) &&
      (vaccineFilter === 'all' || records.some(r => r.vaccine === vaccineFilter))
    );
  }, [childGroups, search, vaccineFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register({
      patientId: form.patientId || `child-new-${Date.now()}`,
      patientName: form.patientName,
      gender: form.gender,
      dateOfBirth: form.dateOfBirth,
      vaccine: form.vaccine,
      doseNumber: form.doseNumber,
      dateGiven: form.dateGiven,
      nextDueDate: form.nextDueDate,
      facilityId: currentUser?.hospitalId || '',
      facilityName: currentUser?.hospitalName || '',
      state: currentUser?.hospital?.state || '',
      administeredBy: currentUser?.name || '',
      batchNumber: form.batchNumber,
      site: form.site,
      adverseReaction: form.adverseReaction,
      adverseReactionDetails: form.adverseReaction ? form.adverseReactionDetails : undefined,
      status: 'completed',
    });
    setShowModal(false);
    setForm({ patientId: '', patientName: '', gender: 'Male', dateOfBirth: '', vaccine: 'BCG', doseNumber: 1, dateGiven: new Date().toISOString().slice(0, 10), nextDueDate: '', batchNumber: '', site: 'left arm', adverseReaction: false, adverseReactionDetails: '' });
  };

  if (loading) {
    return (
      <>
        <TopBar title={t('immun.title')} />
        <main className="page-container page-enter">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('immun.loadingRecords')}</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('immun.title')} />
      <main className="page-container page-enter">
        <PageHeader
          icon={Syringe}
          title={t('immun.trackerTitle')}
          subtitle={t('immun.trackerSubtitle')}
          actions={canRecordVitalEvents && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('immun.recordVaccination')}
            </button>
          )}
        />

        {/* Tab switcher */}
        <div className="flex gap-0 border-b mb-5" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={() => setActiveTab('records')}
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'records' ? 'tab-active' : ''}`}
            style={{ color: activeTab === 'records' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
            {t('immun.tabRecords', { count: stats?.totalChildren || 0 })}
          </button>
          <button onClick={() => setActiveTab('defaulters')}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${activeTab === 'defaulters' ? 'tab-active' : ''}`}
            style={{ color: activeTab === 'defaulters' ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
            {t('immun.tabDefaulters', { count: defaulterStats?.uniqueChildren || 0 })}
            {defaulterStats && defaulterStats.critical > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(229,46,66,0.15)', color: 'var(--color-danger)' }}>
                {t('immun.criticalBadge', { count: defaulterStats.critical })}
              </span>
            )}
          </button>
        </div>

        {/* Coverage by Antigen */}
        {activeTab === 'records' && canViewCoverage && coverage && (
          <div className="card-elevated p-5 mb-6">
            <h3 className="font-semibold text-sm mb-0 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="icon-box-sm" style={{ background: 'rgba(5,150,105,0.12)' }}>
                <Syringe className="w-4 h-4" style={{ color: '#059669' }} />
              </span>
              {t('immun.coverageByAntigen')}
            </h3>
            <hr className="section-divider" />
            <div className="data-row-divider-sm">
              {coverage.map(c => (
                <div key={c.vaccine} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-24 text-right" style={{ color: 'var(--text-secondary)' }}>{c.vaccine}</span>
                  <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'var(--overlay-light)' }}>
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                      style={{
                        width: `${Math.max(c.percentage, 8)}%`,
                        background: c.percentage >= 80 ? 'var(--accent-primary)' :
                                   c.percentage >= 50 ? 'var(--color-warning)' :
                                   'var(--color-danger)',
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">{c.percentage}%</span>
                    </div>
                  </div>
                  <span className="text-xs w-12 text-right" style={{ color: 'var(--text-muted)' }}>{c.count}/{stats?.totalChildren || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coverage by Age Cohort heatmap */}
        {activeTab === 'records' && canViewCoverage && cohortRows.length > 0 && (
          <div className="card-elevated p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="icon-box-sm" style={{ background: 'rgba(5,150,105,0.12)' }}>
                  <Syringe className="w-4 h-4" style={{ color: '#059669' }} />
                </span>
                <h3 className="font-semibold text-sm">{t('immun.coverageByAgeCohort')}</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>{t('immun.epiScheduleAlignment')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-2" style={{ color: 'var(--text-muted)' }}>{t('immun.colVaccine')}</th>
                    {cohortKeys.map(c => (
                      <th key={c} className="text-center p-2" style={{ color: 'var(--text-muted)' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(cohortGrid).map(vaccine => (
                    <tr key={vaccine}>
                      <td className="font-semibold p-2" style={{ color: 'var(--text-primary)' }}>{vaccine}</td>
                      {cohortKeys.map(c => {
                        const cell = cohortGrid[vaccine]?.[c];
                        if (!cell || cell.total === 0) {
                          return <td key={c} className="text-center p-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>—</td>;
                        }
                        const bg = cell.pct >= 90 ? 'rgba(5,150,105,0.85)' : cell.pct >= 70 ? 'rgba(13,148,136,0.65)' : cell.pct >= 50 ? 'rgba(252,211,77,0.55)' : cell.pct >= 25 ? 'rgba(245,158,11,0.5)' : 'rgba(229,46,66,0.45)';
                        const fg = cell.pct >= 50 ? '#fff' : 'var(--text-primary)';
                        return (
                          <td key={c} className="p-1">
                            <div className="rounded-md text-center font-bold" style={{ background: bg, color: fg, padding: '6px 4px' }} title={`${cell.covered}/${cell.total}`}>
                              {cell.pct}%
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Search */}
        {activeTab === 'records' && (
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t('immun.searchByChildName')} />
          <FilterSelect
            value={vaccineFilter}
            onChange={setVaccineFilter}
            options={[
              { value: 'all', label: 'All vaccines' },
              ...VACCINES.map(v => ({ value: v, label: v })),
            ]}
            aria-label="Filter by vaccine"
          />
        </FilterBar>
        )}

        {/* Defaulters Panel */}
        {activeTab === 'defaulters' && (
          <>
            {defaulterStats && (
              <div className="kpi-grid mb-4">
                {[
                  { label: t('immun.critical30Days'), value: defaulterStats.critical, bg: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)', filter: 'critical' as const },
                  { label: t('immun.high14Days'), value: defaulterStats.high, bg: 'rgba(252,211,77,0.12)', color: 'var(--color-warning)', filter: 'high' as const },
                  { label: t('immun.medium0Days'), value: defaulterStats.medium, bg: 'rgba(59, 130, 246,0.12)', color: 'var(--accent-primary)', filter: 'medium' as const },
                  { label: t('immun.uniqueChildren'), value: defaulterStats.uniqueChildren, bg: 'rgba(59, 130, 246,0.08)', color: 'var(--accent-primary)', filter: 'all' as const },
                ].map(k => (
                  <div key={k.label} className="kpi cursor-pointer" onClick={() => setDefaulterFilter(k.filter)}>
                    <div className="icon-box-sm" style={{ background: k.bg }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: k.color }} />
                    </div>
                    <div className="kpi__body">
                      <div className="kpi__value">{k.value}</div>
                      <div className="kpi__label">{k.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="card-elevated overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <span className="icon-box-sm" style={{ background: 'rgba(229,46,66,0.12)' }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                  </span>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {t('immun.defaultersTitle')} {defaulterFilter !== 'all' && `· ${defaulterFilter}`}
                  </h3>
                </div>
                {defaulterFilter !== 'all' && (
                  <button onClick={() => setDefaulterFilter('all')} className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>{t('immun.clearFilter')}</button>
                )}
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('immun.colChild')}</th>
                    <th>{t('immun.colAge')}</th>
                    <th>{t('immun.colGender')}</th>
                    <th>{t('immun.colOverdueVaccine')}</th>
                    <th>{t('immun.colDose')}</th>
                    <th>{t('immun.colDueDate')}</th>
                    <th>{t('immun.colDaysOverdue')}</th>
                    <th>{t('immun.colFacility')}</th>
                    <th>{t('immun.colUrgency')}</th>
                  </tr>
                </thead>
                <tbody>
                  {defaulters.filter(d => defaulterFilter === 'all' || d.urgency === defaulterFilter).length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('immun.noDefaultersInCategory')}
                    </td></tr>
                  ) : defaulters.filter(d => defaulterFilter === 'all' || d.urgency === defaulterFilter).map((d, i) => {
                    const urgencyColor = d.urgency === 'critical' ? 'var(--color-danger)' : d.urgency === 'high' ? 'var(--color-warning)' : 'var(--accent-primary)';
                    const urgencyBg = d.urgency === 'critical' ? 'rgba(229,46,66,0.10)' : d.urgency === 'high' ? 'rgba(252,211,77,0.10)' : 'rgba(59, 130, 246,0.10)';
                    return (
                      <tr key={`${d.patientId}-${d.vaccine}-${i}`} className="cursor-pointer" onClick={() => router.push(`/patients/${d.patientId}`)}>
                        <td><PatientName name={d.patientName} gender={d.gender} nameClassName="font-medium text-sm" /></td>
                        <td className="text-xs">{Math.floor(d.ageMonths / 12)}y {d.ageMonths % 12}m</td>
                        <td className="text-xs">{d.gender}</td>
                        <td className="text-sm font-medium">{d.vaccine}</td>
                        <td className="text-xs">#{d.doseNumber}</td>
                        <td className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{d.dueDate}</td>
                        <td className="text-sm font-bold" style={{ color: urgencyColor }}>{d.daysOverdue}d</td>
                        <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.facilityName}</td>
                        <td>
                          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full" style={{ background: urgencyBg, color: urgencyColor }}>
                            {d.urgency}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Vaccine Schedule Table — Grouped by Child */}
        {activeTab === 'records' && (
        <div className="card-elevated overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
            <span className="icon-box-sm" style={{ background: 'rgba(5,150,105,0.12)' }}>
              <Syringe className="w-4 h-4" style={{ color: '#059669' }} />
            </span>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {t('immun.vaccinationRecords', { count: filteredChildren.length })}
            </h3>
          </div>

          {filteredChildren.map(([childId, records]) => {
            const child = records[0];
            const isExpanded = expandedChild === childId;
            const completedCount = records.filter(r => r.status === 'completed').length;
            const overdueCount = records.filter(r => r.status === 'overdue' || r.status === 'missed').length;

            const toggle = () => setExpandedChild(isExpanded ? null : childId);
            return (
              <div key={childId} className="border-b" style={{ borderColor: 'var(--border-light)' }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={toggle}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--table-row-hover)] cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--accent-primary)' }}>
                    {child.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{child.patientName}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {child.gender} · DOB: {child.dateOfBirth} · {child.facilityName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                      {t('immun.given', { count: completedCount })}
                    </span>
                    {overdueCount > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>
                        {t('immun.overdueCount', { count: overdueCount })}
                      </span>
                    )}
                    <Link
                      href={`/patients/${childId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors hover:bg-[var(--accent-light)]"
                      style={{ color: 'var(--accent-primary)' }}
                      title={t('immun.viewPatientRecord')}
                    >
                      {t('immun.view')} <ExternalLink className="w-3 h-3" />
                    </Link>
                    {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 data-row-divider-sm">
                      {VACCINES.map(vac => {
                        const doses = records.filter(r => r.vaccine === vac);
                        if (doses.length === 0) return (
                          <div key={vac} className="p-2 rounded-lg border" style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}>
                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{vac}</p>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('immun.notScheduled')}</p>
                          </div>
                        );
                        return doses.map(dose => {
                          const cfg = statusConfig[dose.status];
                          return (
                            <div key={dose._id} className="p-2 rounded-lg border" style={{ borderColor: 'var(--border-light)', background: cfg.bg }}>
                              <div className="flex items-center gap-1 mb-1">
                                <cfg.icon className="w-3 h-3" style={{ color: cfg.color }} />
                                <p className="text-xs font-medium" style={{ color: cfg.color }}>{dose.vaccine} {dose.doseNumber > 0 ? `#${dose.doseNumber}` : ''}</p>
                              </div>
                              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                {dose.status === 'completed' ? dose.dateGiven : dose.status === 'scheduled' ? t('immun.due', { date: dose.nextDueDate }) : t(`immun.status${dose.status.charAt(0).toUpperCase()}${dose.status.slice(1)}`)}
                              </p>
                            </div>
                          );
                        });
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredChildren.length === 0 && (
            <EmptyState
              icon={Syringe}
              title={search ? t('immun.noMatchingChildren') : t('immun.noRecordsYet')}
              message={search
                ? t('immun.noMatchingMessage')
                : t('immun.noRecordsMessage')}
              action={!search && canRecordVitalEvents ? { label: t('immun.recordVaccinationAction'), onClick: () => setShowModal(true) } : undefined}
            />
          )}
        </div>
        )}

        {/* Registration Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="card-elevated p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn" style={{ margin: '20px' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('immun.recordVaccination')}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[var(--overlay-light)]">
                  <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Link to existing patient (recommended) */}
                <div className="rounded-lg p-3" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border, rgba(59, 130, 246,0.25))' }}>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                    <Users className="w-3 h-3" />
                    {t('immun.linkToExistingChild')}
                  </label>
                  {form.patientId ? (
                    <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                      <div className="text-xs">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{form.patientName}</p>
                        <p style={{ color: 'var(--text-muted)' }}>{form.gender}{form.dateOfBirth ? ` · DOB ${form.dateOfBirth}` : ''}</p>
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, patientId: '', patientName: '', dateOfBirth: '' }))} className="text-[10px] font-semibold" style={{ color: 'var(--accent-primary)' }}>{t('immun.unlink')}</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          value={patientLookup}
                          onChange={e => setPatientLookup(e.target.value)}
                          placeholder={t('immun.searchChildPlaceholder')}
                          className="w-full text-xs p-2 pl-8 rounded-lg outline-none"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      {patientMatches.length > 0 && (
                        <div className="mt-1.5 rounded-lg overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                          {patientMatches.map(p => (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => selectImmunizationPatient(p._id)}
                              className="w-full px-2.5 py-2 text-left text-xs hover:bg-[var(--overlay-subtle)] transition-colors"
                              style={{ borderBottom: '1px solid var(--border-light)' }}
                            >
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.firstName} {p.surname}</p>
                              <p style={{ color: 'var(--text-muted)' }}>{p.hospitalNumber} · {p.gender}{p.estimatedAge ? ` · ${p.estimatedAge}y` : ''}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {t('immun.linkingHint')}
                      </p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label>{t('immun.childName')}</label>
                    <input type="text" required value={form.patientName} onChange={e => setForm({ ...form, patientName: e.target.value })} placeholder={t('immun.fullName')} />
                  </div>
                  <div>
                    <label>{t('immun.gender')}</label>
                    <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as 'Male' | 'Female' })}>
                      <option value="Male">{t('immun.male')}</option>
                      <option value="Female">{t('immun.female')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label>{t('immun.dateOfBirth')}</label>
                  <input type="date" required value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label>{t('immun.vaccine')}</label>
                    <select value={form.vaccine} onChange={e => setForm({ ...form, vaccine: e.target.value })}>
                      {VACCINES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>{t('immun.doseNumber')}</label>
                    <input type="number" min={0} max={5} value={form.doseNumber} onChange={e => setForm({ ...form, doseNumber: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label>{t('immun.dateGiven')}</label>
                    <input type="date" required value={form.dateGiven} onChange={e => setForm({ ...form, dateGiven: e.target.value })} />
                  </div>
                  <div>
                    <label>{t('immun.nextDueDate')}</label>
                    <input type="date" value={form.nextDueDate} onChange={e => setForm({ ...form, nextDueDate: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label>{t('immun.batchNumber')}</label>
                    <input type="text" value={form.batchNumber} onChange={e => setForm({ ...form, batchNumber: e.target.value })} placeholder={t('immun.batchNumberPlaceholder')} />
                  </div>
                  <div>
                    <label>{t('immun.site')}</label>
                    <select value={form.site} onChange={e => setForm({ ...form, site: e.target.value as typeof SITES[number] })}>
                      {SITES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer" style={{ textTransform: 'none', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={form.adverseReaction} onChange={e => setForm({ ...form, adverseReaction: e.target.checked })} className="w-4 h-4" />
                    {t('immun.adverseReactionObserved')}
                  </label>
                  {form.adverseReaction && (
                    <textarea
                      className="mt-2"
                      rows={2}
                      placeholder={t('immun.adverseReactionPlaceholder')}
                      value={form.adverseReactionDetails}
                      onChange={e => setForm({ ...form, adverseReactionDetails: e.target.value })}
                    />
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">{t('immun.cancel')}</button>
                  <button type="submit" className="btn btn-primary flex-1">
                    <Syringe className="w-4 h-4" /> {t('immun.recordVaccination')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
