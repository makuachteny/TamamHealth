'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { comparePatients, patientFullName, patientAgeLabel, patientAge } from '@/lib/patient-utils';
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
import { formatRelativeShort, formatDate, formatMoney } from '@/lib/format-utils';
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
  const { canRegisterPatients, canViewClinical, isMedicalBiller, isCashier } = usePermissions();
  // Billing-desk roles see money (outstanding balance) instead of clinical detail.
  const isBilling = isMedicalBiller || isCashier;
  // Structured filters — a single "Filters" dropdown panel (replaces the old
  // per-column funnels). Text search lives in the platform-wide search bar; this
  // panel narrows by the registry's real dimensions.
  const emptyFilters = { olderThan: '', gender: '', state: '', diagnosis: '', registeredFrom: '', registeredTo: '', allergies: false, chronic: false, recent: false, assignedMe: false, unassigned: false, outstanding: false };
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
    // The platform-wide search bar narrows the registry by name / hospital # / phone.
    if (globalSearch && !(fullName.includes(globalSearch.toLowerCase()) || (p.hospitalNumber || '').toLowerCase().includes(globalSearch.toLowerCase()) || (p.phone || '').includes(globalSearch))) return false;
    const f = filters;
    if (f.olderThan) {
      const age = patientAge(p);
      if (age == null || age < Number(f.olderThan)) return false;
    }
    if (f.gender && p.gender !== f.gender) return false;
    if (f.state && p.state !== f.state) return false;
    if (f.diagnosis) {
      const q = f.diagnosis.toLowerCase();
      const haystack = [...(p.chronicConditions || []), ...(p.allergies || [])].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
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
  }, [filters, globalSearch]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

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
      key: 'patient', label: t('nurse.colPatientName'), width: 16,
      render: (p) => <span className="text-[12px] font-medium block truncate" style={{ color: 'var(--text-primary)' }}>{patientFullName(p)}</span>,
    },
    {
      key: 'gender', label: t('nurse.colGender'), width: 9,
      render: (p) => <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.gender || '—'}</span>,
    },
    {
      key: 'age', label: t('nurse.colAge'), width: 8,
      render: (p) => <span className="text-[12px] tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{patientAgeLabel(p)}</span>,
    },
    { key: 'hospitalNo', label: t('patients.colHospitalNo'), width: 11, render: (p) => <span className="text-[12px] font-mono tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.hospitalNumber || '—'}</span> },
    { key: 'phone', label: t('patient.phone'), width: 11, render: (p) => <span className="text-[12px] font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.phone || '—'}</span> },
    { key: 'location', label: t('patient.location'), width: 13, render: (p) => <span className="text-[12px] block truncate" style={{ color: 'var(--text-secondary)' }}>{[p.county, p.state].filter(Boolean).join(', ') || '—'}</span> },
    {
      key: 'lastVisit', label: t('frontDesk.lastVisit'), width: 11,
      render: (p) => {
        const lastVisit = p.lastConsultedAt ? new Date(p.lastConsultedAt) : null;
        const daysAgo = lastVisit ? Math.floor((Date.now() - lastVisit.getTime()) / 86400000) : null;
        return lastVisit ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium" title={formatRelativeShort(p.lastConsultedAt)} style={{ color: daysAgo != null && daysAgo > 90 ? '#C44536' : daysAgo != null && daysAgo > 30 ? '#B8741C' : 'var(--text-secondary)' }}>
            {lastVisit.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        ) : <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>;
      },
    },
  ];

  if (canViewClinical) {
    columns.push({
      key: 'conditions', label: t('patients.colConditions'), width: 14,
      render: (p) => {
        const hasAllergy = !!(p.allergies?.length && p.allergies[0] !== 'None known');
        const chronic = (p.chronicConditions || []).filter(c => c && c !== 'None');
        const hasChronic = chronic.length > 0;
        if (!hasAllergy && !hasChronic) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
        const moreCount = hasAllergy ? chronic.length : chronic.length - 1;
        const tooltip = [hasAllergy ? t('patients.allergyTitle', { list: p.allergies.join(', ') }) : null, ...chronic].filter(Boolean).join(' · ');
        return (
          <div className="flex items-center gap-1 whitespace-nowrap" title={tooltip}>
            {hasAllergy ? (
              <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: '#C44536' }}>{t('patients.allergyBadge')}</span>
            ) : (
              <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: '#B8741C' }}>{chronic[0]}</span>
            )}
            {moreCount > 0 && <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>+{moreCount}</span>}
          </div>
        );
      },
    });
  }

  if (isBilling) {
    columns.push({
      key: 'balance', label: t('patients.colBalance'), width: 13,
      render: (p) => {
        const bal = balanceByPatient.get(p._id) || 0;
        return bal > 0
          ? <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: '#8B2E24', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(bal)}</span>
          : <span className="text-[11px]" style={{ color: 'var(--color-success)' }}>{t('billing.paidInFull')}</span>;
      },
    });
  } else {
    columns.push({
      key: 'registered', label: t('patient.registered'), width: 11,
      render: (p) => <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.registeredAt || p.registrationDate ? formatDate(p.registeredAt || p.registrationDate) : '—'}</span>,
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
      <TopBar
        title={t('nav.patients')}
        splitActions
        searchTrailing={
                /* Filters — single dropdown panel (replaces the old per-column funnels) */
                <div className="relative" ref={filterRef}>
                  <button
                    onClick={() => setShowFilters(s => !s)}
                    className={`btn btn-secondary btn-filter${activeFilterCount ? ' is-active' : ''}`}
                    title={t('patients.filtersTitle')}
                    aria-expanded={showFilters}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('patients.filtersTitle')}</span>
                    {activeFilterCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  {showFilters && (
                    <div
                      className="absolute right-0 mt-2 rounded-2xl overflow-hidden z-50"
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
                        {/* Older than (age) */}
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterOlderThan')}</span>
                          <div className="relative">
                            <input type="number" min={0} max={120} value={filters.olderThan} onChange={e => setF('olderThan', e.target.value)} placeholder="—" className="w-full text-sm py-2 pl-3 pr-12" style={fieldStyle} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('patients.filterYears')}</span>
                          </div>
                        </label>
                        {/* Gender */}
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('nurse.colGender')}</span>
                          <select value={filters.gender} onChange={e => setF('gender', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle}>
                            <option value="">{t('patients.all')}</option>
                            <option value="Male">{t('patient.male')}</option>
                            <option value="Female">{t('patient.female')}</option>
                          </select>
                        </label>
                        {/* Diagnosis / condition */}
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterDiagnosis')}</span>
                          <input type="text" value={filters.diagnosis} onChange={e => setF('diagnosis', e.target.value)} placeholder={t('patients.filterDiagnosisPlaceholder')} className="w-full text-sm py-2 px-3" style={fieldStyle} />
                        </label>
                        {/* Location (state) */}
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patient.location')}</span>
                          <select value={filters.state} onChange={e => setF('state', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle}>
                            <option value="">{t('patients.all')}</option>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                        {/* Registered date range */}
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterRegisteredFrom')}</span>
                          <input type="date" value={filters.registeredFrom} onChange={e => setF('registeredFrom', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('patients.filterRegisteredTo')}</span>
                          <input type="date" value={filters.registeredTo} onChange={e => setF('registeredTo', e.target.value)} className="w-full text-sm py-2 px-3" style={fieldStyle} />
                        </label>
                      </div>
                      {/* Show patients with — checkbox group */}
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
              }
              actions={
              <div className="flex gap-2">
                <button onClick={() => setShowFindPatient(true)} className="btn btn-secondary" title={t('boma.findPatient')}>
                  <Hash className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('boma.findPatient')}</span>
                  <span className="sm:hidden">{t('patients.findShort')}</span>
                </button>
                {canRegisterPatients && (
                  <button onClick={() => router.push('/patients/new')} className="btn btn-primary" title={t('frontDesk.registerNewPatient')}>
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('frontDesk.registerNewPatient')}</span>
                    <span className="sm:hidden">{t('patients.registerShort')}</span>
                  </button>
                )}
              </div>
            } />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {/* Patient Table — filtering lives in the Filters panel + search bar */}
          <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
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
