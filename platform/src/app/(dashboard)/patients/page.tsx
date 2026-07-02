'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { comparePatients, patientFullName, patientAgeLabel, patientAge } from '@/lib/patient-utils';
import PatientAvatar from '@/components/patients/PatientAvatar';
import { UserPlus, Users, ScanLine, Hash, X, ArrowRight, Stethoscope, Filter, ChevronRight } from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { states } from '@/data/mock';
import dynamic from 'next/dynamic';
// Lazy-loaded: html5-qrcode is heavy and only needed when the scanner opens,
// so it stays out of the patients-route bundle until used.
const QRScanner = dynamic(() => import('@/components/QRScanner'), { ssr: false });
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import RowActionsMenu from '@/components/RowActionsMenu';
import { formatMoney } from '@/lib/format-utils';
import FingerprintIdentifyModal from '@/components/FingerprintIdentifyModal';
import { isFingerprintEnabled } from '@/lib/services/fingerprint-service';
import { useTranslation } from '@/lib/i18n/useTranslation';
import EmptyState from '@/components/EmptyState';

// Pagination cap — capped to keep DOM-node count manageable on low-end devices.
// Each row produces ~20 DOM nodes; 100 rows ≈ 2k nodes which renders smoothly.
// At 10k+ patients we render in pages instead of dumping the whole list.
const PAGE_SIZE = 100;

export default function PatientsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { globalSearch, currentUser } = useApp();
  const { patients } = usePatients();
  const { canRegisterPatients, isMedicalBiller, isCashier } = usePermissions();
  // Billing-desk roles see money (outstanding balance) instead of clinical detail.
  const isBilling = isMedicalBiller || isCashier;
  // Structured filters — a single "Filters" dropdown panel (replaces the old
  // per-column funnels). Text search lives in the platform-wide search bar; this
  // panel narrows by the registry's real dimensions.
  const emptyFilters = { olderThan: '', gender: '', state: '', registeredFrom: '', registeredTo: '', allergies: false, chronic: false, recent: false, assignedMe: false, unassigned: false, outstanding: false };
  type Filters = typeof emptyFilters;
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const setF = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters(f => ({ ...f, [k]: v }));
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v !== '' && v !== false).length;
  const clearFilters = () => setFilters(emptyFilters);
  // Shared input/select styling for the filter panel controls.
  const fieldStyle = { background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', borderRadius: 8, minWidth: 0 } as const;

  // The Filters panel opens as a dropdown anchored to its trigger. Close on
  // outside click / Escape; filterRef wraps the trigger + its menu.
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showFilters) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFilters(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [showFilters]);
  // Reception roles can assign a patient to a care provider straight from the
  // registry. The AssignDoctorModal picks doctor vs. nurse from the facility tier.
  const canAssignPatients = ['front_desk', 'central_registration_clerk', 'clinic_clerk'].includes(currentUser?.role ?? '');
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);

  // Outstanding balance per patient — loaded only for billing-desk roles, so the
  // registry shows a "Balance" column instead of clinical conditions. Aggregated
  // from open bills (same rule the billing dashboard uses) in one pass.
  const [balanceByPatient, setBalanceByPatient] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!isBilling) return;
    let cancelled = false;
    (async () => {
      try {
        const { getAllBills } = await import('@/lib/services/billing-service');
        const bills = await getAllBills();
        const m = new Map<string, number>();
        for (const b of bills) {
          if ((b.balanceDue ?? 0) > 0 && b.status !== 'waived' && b.status !== 'cancelled') {
            m.set(b.patientId, (m.get(b.patientId) || 0) + b.balanceDue);
          }
        }
        if (!cancelled) setBalanceByPatient(m);
      } catch (err) {
        console.error('Failed to load patient balances:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isBilling]);
  const [showFindPatient, setShowFindPatient] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showFingerprintIdentify, setShowFingerprintIdentify] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupError, setLookupError] = useState('');
  // Inline search bar (inside the table card, separate from the global TopBar search).
  const [localSearch, setLocalSearch] = useState('');
  // Sort order for the patient list.
  const [patientSort] = useState<'recent' | 'oldest' | 'name' | 'age'>('recent');
  // Cap how many rows are rendered at once. "Load more" extends the window
  // by another PAGE_SIZE; switching filter/search resets the window.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const handleLookup = () => {
    const q = lookupId.trim().toLowerCase();
    if (!q) { setLookupError(t('patients.enterHospitalOrGeocode')); return; }
    const match = patients.find(p =>
      p.hospitalNumber?.toLowerCase() === q ||
      p.geocodeId?.toLowerCase() === q ||
      p.nationalId?.toLowerCase() === q ||
      p._id?.toLowerCase() === q
    );
    if (match) {
      setShowFindPatient(false);
      setLookupId('');
      setLookupError('');
      router.push(`/patients/${match._id}`);
    } else {
      setLookupError(t('patients.noPatientWithId', { id: lookupId.trim() }));
    }
  };

  // Clinical predicates — also drive the quick-filter tab counts that replaced
  // the old summary KPI cards.
  const MS30 = 30 * 24 * 60 * 60 * 1000;
  const isRecentlyVisited = (p: typeof patients[number]) =>
    !!p.lastConsultedAt && (Date.now() - new Date(p.lastConsultedAt).getTime()) < MS30;
  const hasChronic = (p: typeof patients[number]) =>
    !!(p.chronicConditions?.length && p.chronicConditions[0] !== 'None');
  const hasAllergies = (p: typeof patients[number]) =>
    !!(p.allergies?.length && p.allergies[0] !== 'None known');

  const filtered = patients.filter(p => {
    const fullName = `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase();
    // Platform-wide and inline search bars both narrow the registry.
    if (globalSearch && !(fullName.includes(globalSearch.toLowerCase()) || (p.hospitalNumber || '').toLowerCase().includes(globalSearch.toLowerCase()) || (p.phone || '').includes(globalSearch))) return false;
    if (localSearch) {
      const ls = localSearch.toLowerCase();
      if (!(fullName.includes(ls) || (p.hospitalNumber || '').toLowerCase().includes(ls) || (p.phone || '').includes(ls))) return false;
    }
    const f = filters;
    if (f.olderThan) {
      const age = patientAge(p);
      if (age == null || age < Number(f.olderThan)) return false;
    }
    if (f.gender && p.gender !== f.gender) return false;
    if (f.state && p.state !== f.state) return false;
    if (f.registeredFrom || f.registeredTo) {
      const reg = p.registeredAt || p.registrationDate;
      if (!reg) return false;
      const d = new Date(reg).getTime();
      if (f.registeredFrom && d < new Date(f.registeredFrom).getTime()) return false;
      if (f.registeredTo && d > new Date(`${f.registeredTo}T23:59:59`).getTime()) return false;
    }
    if (f.allergies && !hasAllergies(p)) return false;
    if (f.chronic && !hasChronic(p)) return false;
    if (f.recent && !isRecentlyVisited(p)) return false;
    if (f.assignedMe && p.assignedDoctor !== currentUser?._id) return false;
    if (f.unassigned && p.assignedDoctor) return false;
    if (f.outstanding && isBilling && !((balanceByPatient.get(p._id) || 0) > 0)) return false;
    return true;
  }).sort(comparePatients('recent'));

  // Reset the visible window whenever the filters change — otherwise narrowing
  // would leave a stale "Load more" count.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, globalSearch, localSearch, patientSort]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (patientSort === 'name') return arr.sort((a, b) => patientFullName(a).localeCompare(patientFullName(b)));
    if (patientSort === 'age') return arr.sort((a, b) => (patientAge(b) ?? 0) - (patientAge(a) ?? 0));
    if (patientSort === 'oldest') return arr.sort((a, b) => (a.registeredAt || a.registrationDate || '').localeCompare(b.registeredAt || b.registrationDate || ''));
    return arr.sort((a, b) => (b.registeredAt || b.registrationDate || '').localeCompare(a.registeredAt || a.registrationDate || ''));
  }, [filtered, patientSort]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;

  // ── Role-aware columns ──────────────────────────────────────────────────
  // Every role sees the common identity columns (who + how to reach + where +
  // recency). Beyond that the registry adapts to what the role needs to act on:
  //   • clinical roles  → Conditions (allergies / chronic) for safe care
  //   • billing desk    → Balance (outstanding) for collections
  //   • reception       → an Assign action to route the patient to a provider
  // Non-billing roles keep the Registered date; billers swap it for Balance.
  type PatientCol = { key: string; label: string; width: number; align?: 'right'; render: (p: typeof patients[number]) => React.ReactNode };
  const columns: PatientCol[] = [
    {
      key: 'patient', label: t('nurse.colPatientName'), width: 20,
      render: (p) => (
        <div className="flex items-center gap-2 min-w-0">
          <PatientAvatar patient={p} size={30} />
          <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{patientFullName(p)}</span>
        </div>
      ),
    },
    {
      key: 'gender', label: t('nurse.colGender'), width: 9,
      render: (p) => <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.gender || '—'}</span>,
    },
    {
      key: 'age', label: t('nurse.colAge'), width: 8,
      render: (p) => <span className="text-[12px] tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{patientAgeLabel(p)}</span>,
    },
    { key: 'hospitalNo', label: t('patients.colHospitalNo'), width: 13, render: (p) => <span className="text-[12px] font-mono tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.hospitalNumber || '—'}</span> },
    { key: 'location', label: t('patient.location'), width: 16, render: (p) => <span className="text-[12px] block truncate" style={{ color: 'var(--text-secondary)' }}>{[p.county, p.state].filter(Boolean).join(', ') || '—'}</span> },
  ];

  if (isBilling) {
    columns.push({
      key: 'balance', label: t('patients.colBalance'), width: 14,
      render: (p) => {
        const bal = balanceByPatient.get(p._id) || 0;
        return bal > 0
          ? <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: '#8B2E24', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(bal)}</span>
          : <span className="text-[11px]" style={{ color: 'var(--color-success)' }}>{t('billing.paidInFull')}</span>;
      },
    });
  }

  columns.push({
    key: 'assigned', label: t('patients.colAssigned'), width: 12,
    render: (p) => p.assignedDoctorName
      ? <span className="text-[12px] block truncate" style={{ color: 'var(--text-secondary)' }}>{p.assignedDoctorName}</span>
      : <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>,
  });

  // The whole row is clickable (navigates to the patient), so there is no bare
  // chevron column. An action column is added only when the role actually has a
  // row action — the reception "Assign to provider" button.
  if (canAssignPatients) {
    columns.push({
      key: 'action', label: t('frontDesk.colAction'), width: 12, align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end">
          <RowActionsMenu
            ariaLabel={t('frontDesk.colAction')}
            actions={[
              {
                key: 'assign',
                label: p.assignedDoctor ? t('frontDesk.reassign') : t('frontDesk.assign'),
                icon: <Stethoscope className="w-4 h-4" />,
                onClick: () => setAssignTarget({ patientId: p._id, patientName: patientFullName(p), hospitalNumber: p.hospitalNumber, currentDoctorId: p.assignedDoctor }),
              },
            ]}
          />
        </div>
      ),
    });
  }

  const totalColWidth = columns.reduce((s, c) => s + c.width, 0);

  return (
    <>
      <TopBar title={t('nav.patients')} hideSearch />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
            {/* ── Card toolbar ── */}
            <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-light)' }}>
              {/* Header row — title + stats */}
              <div className="flex items-end justify-between gap-3 mb-3">
                <span
                  style={{
                    fontFamily: "var(--font-platform)",
                    fontWeight: 500,
                    fontSize: 24,
                    lineHeight: '100%',
                    letterSpacing: 0,
                    color: '#000000',
                  }}
                >
                  All patients
                </span>
                <div className="flex items-center gap-3 flex-shrink-0 pb-0.5">
                  <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#2191D0' }} />
                    Male ({patients.filter(p => p.gender === 'Male').length})
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#D97706' }} />
                    Female ({patients.filter(p => p.gender === 'Female').length})
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-success)' }} />
                    Total ({filtered.length})
                  </span>
                </div>
              </div>
              {/* Search + filter row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Search wrapper — flex:1 so it fills remaining space; input inside uses width:100% from global CSS */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                    placeholder="Search by name or patient ID…"
                    style={{ padding: '9px 18px', height: 38, borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                {/* Filters */}
                <div className="relative" ref={filterRef}>
                  <button
                    onClick={() => setShowFilters(s => !s)}
                    aria-expanded={showFilters}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px',
                      borderRadius: 999,
                      border: `1px solid ${activeFilterCount ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                      background: activeFilterCount ? 'rgba(33,145,208,0.08)' : 'var(--bg-card-solid)',
                      color: activeFilterCount ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {t('patients.filtersTitle')}
                    {activeFilterCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: '#2191D0', color: '#fff' }}>
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  {showFilters && (
                    <div
                      className="absolute left-0 mt-2 rounded-2xl overflow-hidden z-50"
                      style={{ width: 'min(92vw, 560px)', background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg, 0 16px 48px rgba(0,0,0,0.2))' }}
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('patients.filtersTitle')}</span>
                        <div className="flex items-center gap-2">
                          {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>{t('nurse.clearAllFilters')}</button>
                          )}
                          <button type="button" onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-[var(--overlay-subtle)]" aria-label={t('action.close')}>
                            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterOlderThan')}</span>
                          <div className="relative">
                            <input type="number" min={0} max={120} value={filters.olderThan} onChange={e => setF('olderThan', e.target.value)} placeholder="—" className="w-full text-sm py-2 pl-3 pr-12" style={fieldStyle} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('patients.filterYears')}</span>
                          </div>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('nurse.colGender')}</span>
                          <select value={filters.gender} onChange={e => setF('gender', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle}>
                            <option value="">{t('patients.all')}</option>
                            <option value="Male">{t('patient.male')}</option>
                            <option value="Female">{t('patient.female')}</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patient.location')}</span>
                          <select value={filters.state} onChange={e => setF('state', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle}>
                            <option value="">{t('patients.all')}</option>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterRegisteredFrom')}</span>
                          <input type="date" value={filters.registeredFrom} onChange={e => setF('registeredFrom', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterRegisteredTo')}</span>
                          <input type="date" value={filters.registeredTo} onChange={e => setF('registeredTo', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle} />
                        </label>
                      </div>
                      <div className="px-4 pb-4">
                        <span className="text-[11px] font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterShowWith')}</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                          {([
                            ['allergies', t('patients.kpiAllergiesFlagged')],
                            ['chronic', t('patient.chronicConditions')],
                            ['recent', t('patients.kpiVisitedLast30d')],
                            ['assignedMe', t('patients.assignedMe')],
                            ['unassigned', t('patients.assignedUnassigned')],
                            ...(isBilling ? [['outstanding', t('patients.filterOutstanding')] as const] : []),
                          ] as const).map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-primary)' }}>
                              <input type="checkbox" checked={filters[key]} onChange={e => setF(key, e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent-primary)' }} />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {canRegisterPatients && (
                  <button
                    onClick={() => router.push('/patients/new')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px',
                      borderRadius: 999, background: '#2191D0', color: '#fff', border: 'none',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    <UserPlus className="w-4 h-4" />
                    {t('frontDesk.registerNewPatient')}
                  </button>
                )}
              </div>
            </div>
            <div className="show-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <table className="w-full" style={{ tableLayout: 'fixed', minWidth: 880 }}>
                <colgroup>
                  {columns.map(c => (
                    <col key={c.key} style={{ width: `${(c.width / totalColWidth * 100).toFixed(2)}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {columns.map(c => (
                      <th
                        key={c.key}
                        className={`${c.align === 'right' ? 'text-right' : 'text-left'} px-4 py-2.5`}
                        style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}
                      >
                        <div className={`flex items-center gap-1.5 ${c.align === 'right' ? 'justify-end' : ''}`}>
                          <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">{c.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={columns.length}>
                        <EmptyState
                          icon={Users}
                          title={t('patients.registryTitle')}
                          message={t('patients.patientsFound', { count: 0 })}
                        />
                      </td>
                    </tr>
                  )}
                  {visible.map(patient => (
                    <tr
                      key={patient._id}
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer transition-colors hover:bg-[var(--table-row-hover)]"
                      onClick={() => router.push(`/patients/${patient._id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/patients/${patient._id}`); } }}
                      style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                      {columns.map((col, ci) => {
                        const isLast = ci === columns.length - 1;
                        return (
                          <td key={col.key} className={`px-4 py-2.5 ${isLast ? 'relative' : ''}`}>
                            {col.render(patient)}
                            {/* Subtle hover affordance: the whole row is clickable, so for roles
                                without an explicit action button we fade in a chevron on hover. */}
                            {isLast && !canAssignPatients && (
                              <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('patients.showingOf', { shown: visible.length.toLocaleString(), total: filtered.length.toLocaleString() })}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                >
                  {t('patients.loadMore')}
                </button>
              </div>
            )}
          </div>
      </main>

      {/* Find Patient Modal — Hospital ID lookup + QR scan */}
      {showFindPatient && !showQRScanner && !showFingerprintIdentify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg, var(--bg-card))' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-semibold">{t('boma.findPatient')}</h3>
              <button onClick={() => { setShowFindPatient(false); setLookupId(''); setLookupError(''); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Hospital ID / Geocode ID Lookup */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('patients.enterLookupId')}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={lookupId}
                      onChange={(e) => { setLookupId(e.target.value); setLookupError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                      placeholder={t('patients.lookupPlaceholder')}
                      className="pl-9 w-full"
                      autoFocus
                      style={{ background: 'var(--overlay-subtle)' }}
                    />
                  </div>
                  <button onClick={handleLookup} className="btn btn-primary btn-sm px-4">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {lookupError && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-danger)' }}>{lookupError}</p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
                <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{t('patients.or')}</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
              </div>

              {/* QR Code Scan Option */}
              <button
                onClick={() => setShowQRScanner(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[var(--accent-light)]"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                  <ScanLine className="w-5 h-5" style={{ color: 'var(--tamamhealth-blue)' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('patients.scanQrCode')}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('patients.scanQrDesc')}</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-muted)' }} />
              </button>

              {/* Fingerprint identification (feature-flagged, needs local bridge) */}
              {isFingerprintEnabled() && (
                <button
                  onClick={() => setShowFingerprintIdentify(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[var(--accent-light)]"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                    <ScanLine className="w-5 h-5" style={{ color: 'var(--tamamhealth-blue)' }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('fingerprint.identifyTitle')}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('fingerprint.identifyOptionDesc')}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showFingerprintIdentify && (
        <FingerprintIdentifyModal
          onSelect={(patientId) => {
            setShowFingerprintIdentify(false);
            setShowFindPatient(false);
            router.push(`/patients/${patientId}`);
          }}
          onClose={() => setShowFingerprintIdentify(false)}
        />
      )}

      {showQRScanner && (
        <QRScanner
          onScan={(data) => {
            setShowQRScanner(false);
            setShowFindPatient(false);
            router.push(`/patients/${data.id}`);
          }}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {assignTarget && (
        <AssignDoctorModal
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </>
  );
}
