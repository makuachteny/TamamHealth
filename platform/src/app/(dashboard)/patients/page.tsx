'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { comparePatients, PATIENT_SORT_OPTIONS, type PatientSort, patientFullName, patientAgeLabel, patientInitials } from '@/lib/patient-utils';
import { Search, Filter, ChevronRight, UserPlus, Users, ScanLine, Hash, X, ArrowRight, Stethoscope, Clock } from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { states } from '@/data/mock';
import dynamic from 'next/dynamic';
// Lazy-loaded: html5-qrcode is heavy and only needed when the scanner opens,
// so it stays out of the patients-route bundle until used.
const QRScanner = dynamic(() => import('@/components/QRScanner'), { ssr: false });
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import { formatRelativeShort, formatDate } from '@/lib/format-utils';
import FingerprintIdentifyModal from '@/components/FingerprintIdentifyModal';
import { isFingerprintEnabled } from '@/lib/services/fingerprint-service';
import { useTranslation } from '@/lib/i18n/useTranslation';

// Pagination cap — capped to keep DOM-node count manageable on low-end devices.
// Each row produces ~20 DOM nodes; 100 rows ≈ 2k nodes which renders smoothly.
// At 10k+ patients we render in pages instead of dumping the whole list.
const PAGE_SIZE = 100;

export default function PatientsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { globalSearch, currentUser } = useApp();
  const { patients } = usePatients();
  const { canRegisterPatients, canViewClinical } = usePermissions();
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [clinicalFilter, setClinicalFilter] = useState<'all' | 'visited30d' | 'chronic' | 'allergies'>('all');
  const [sort, setSort] = useState<PatientSort>('recent');
  // Only clinicians who can be the responsible provider get the "assigned to me" toggle.
  const canBeAssigned = ['doctor', 'clinical_officer', 'medical_superintendent'].includes(currentUser?.role ?? '');
  // Reception roles can assign a patient to a care provider straight from the
  // registry. The AssignDoctorModal picks doctor vs. nurse from the facility tier.
  const canAssignPatients = ['front_desk', 'central_registration_clerk', 'clinic_clerk'].includes(currentUser?.role ?? '');
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);
  const assignedToMeCount = canBeAssigned
    ? patients.filter(p => p.assignedDoctor === currentUser?._id).length
    : 0;
  const [showFilters, setShowFilters] = useState(false);
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
    const q = search || globalSearch;
    const matchSearch = !q ||
      `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase().includes(q.toLowerCase()) ||
      (p.hospitalNumber || '').toLowerCase().includes(q.toLowerCase()) ||
      (p.phone || '').includes(q);
    const matchState = !filterState || p.state === filterState;
    const matchGender = !filterGender || p.gender === filterGender;
    const matchAssigned = !assignedToMe || p.assignedDoctor === currentUser?._id;
    const matchClinical = clinicalFilter === 'all'
      || (clinicalFilter === 'visited30d' && isRecentlyVisited(p))
      || (clinicalFilter === 'chronic' && hasChronic(p))
      || (clinicalFilter === 'allergies' && hasAllergies(p));
    return matchSearch && matchState && matchGender && matchAssigned && matchClinical;
  }).sort(comparePatients(sort));

  // Chronic-condition and allergy filters expose clinical attributes, so they are
  // only offered to clinical roles. A non-clinical role (e.g. Medical Receptionist)
  // sees just the administrative cuts: everyone and recently-visited.
  const clinicalTabs = [
    { key: 'all', label: t('patients.kpiTotalPatients'), count: patients.length },
    { key: 'visited30d', label: t('patients.kpiVisitedLast30d'), count: patients.filter(isRecentlyVisited).length },
    ...(canViewClinical ? [
      { key: 'chronic', label: t('patient.chronicConditions'), count: patients.filter(hasChronic).length, tint: '#B8741C' },
      { key: 'allergies', label: t('patients.kpiAllergiesFlagged'), count: patients.filter(hasAllergies).length, tint: '#C44536' },
    ] : []),
  ];

  // Reset the visible window whenever the filter or search changes — otherwise
  // narrowing the result set would leave the user looking at a stale "Load more"
  // count that doesn't correspond to the new filtered.length.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filterState, filterGender, globalSearch, assignedToMe, clinicalFilter, sort]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  return (
    <>
      <TopBar title={t('nav.patients')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>
          <PageHeader
            icon={Users}
            title={t('patients.registryTitle')}
            subtitle={t('patients.patientsFound', { count: filtered.length })}
            actions={
              <div className="flex gap-2">
                <button onClick={() => setShowFindPatient(true)} className="btn btn-secondary">
                  <Hash className="w-4 h-4" />
                  {t('boma.findPatient')}
                </button>
                {canRegisterPatients && (
                  <button onClick={() => router.push('/patients/new')} className="btn btn-primary">
                    <UserPlus className="w-4 h-4" />
                    {t('frontDesk.registerNewPatient')}
                  </button>
                )}
              </div>
            }
          />

          {/* Search & Filter */}
          <div className="dash-card p-4 mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="search"
                  placeholder={t('patients.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 search-icon-input"
                  style={{ background: 'var(--overlay-subtle)' }}
                />
              </div>
              {canBeAssigned && (
                <button
                  onClick={() => setAssignedToMe(v => !v)}
                  className="btn btn-sm"
                  aria-pressed={assignedToMe}
                  title="Show only patients assigned to you"
                  style={assignedToMe
                    ? { background: 'var(--accent-primary)', color: '#fff', border: '1px solid var(--accent-primary)' }
                    : { background: 'var(--btn-secondary-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}
                >
                  <Stethoscope className="w-4 h-4" /> Assigned to me
                  <span
                    className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={assignedToMe
                      ? { background: 'rgba(255,255,255,0.25)' }
                      : { background: 'var(--accent-light)', color: 'var(--accent-primary)' }}
                  >
                    {assignedToMeCount}
                  </span>
                </button>
              )}
              <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm">
                <Filter className="w-4 h-4" /> {t('patients.filters')}
              </button>
            </div>
            {showFilters && (
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <div className="w-full sm:w-48">
                  <label>{t('patients.show')}</label>
                  <select value={clinicalFilter} onChange={e => setClinicalFilter(e.target.value as typeof clinicalFilter)} aria-label={t('patients.show')}>
                    {clinicalTabs.map(tab => (
                      <option key={tab.key} value={tab.key}>{tab.label} ({tab.count})</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-44">
                  <label>{t('patients.sortBy')}</label>
                  <select value={sort} onChange={e => setSort(e.target.value as PatientSort)} aria-label={t('patients.sortBy')}>
                    {PATIENT_SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-48">
                  <label>{t('patients.state')}</label>
                  <select value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                    <option value="">{t('patients.allStates')}</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-36">
                  <label>{t('patient.gender')}</label>
                  <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
                    <option value="">{t('patients.all')}</option>
                    <option value="Male">{t('patient.male')}</option>
                    <option value="Female">{t('patient.female')}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setFilterState(''); setFilterGender(''); setClinicalFilter('all'); }} className="btn btn-secondary btn-sm">
                    {t('patients.clear')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Patient Table */}
          <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <table className="w-full">
                <thead>
                  <tr>
                    {[t('frontDesk.colPatient'), t('patients.colHospitalNo'), t('patient.phone'), t('patient.location'), t('frontDesk.lastVisit'), t('patient.registered'), t('patients.colConditions'), canAssignPatients ? t('frontDesk.colAction') : ''].map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {t('patients.patientsFound', { count: 0 })}
                      </td>
                    </tr>
                  )}
                  {visible.map(patient => {
                    const hasAllergy = patient.allergies?.length && patient.allergies[0] !== 'None known';
                    const chronic = (patient.chronicConditions || []).filter(c => c && c !== 'None');
                    const hasChronic = chronic.length > 0;
                    const lastVisit = patient.lastConsultedAt ? new Date(patient.lastConsultedAt) : null;
                    const daysAgo = lastVisit ? Math.floor((Date.now() - lastVisit.getTime()) / 86400000) : null;
                    const location = [patient.county, patient.state].filter(Boolean).join(', ');
                    return (
                      <tr
                        key={patient._id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer transition-colors hover:bg-[var(--table-row-hover)]"
                        onClick={() => router.push(`/patients/${patient._id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/patients/${patient._id}`); } }}
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                      >
                        {/* Patient name + inline age/gender */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: patient.gender === 'Female' ? 'linear-gradient(135deg, #D96E59 0%, #C44536 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1E3A8A 100%)', letterSpacing: 0.3 }}
                              aria-hidden
                            >
                              {patientInitials(patient)}
                            </span>
                            <span className="min-w-0">
                              <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{patientFullName(patient)}</span>
                              <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-muted)' }}>{patientAgeLabel(patient)}, {patient.gender?.[0] ?? '?'}</span>
                            </span>
                          </div>
                        </td>
                        {/* Patient ID */}
                        <td className="px-4 py-2.5 text-[12px] font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{patient.hospitalNumber || '—'}</td>
                        {/* Phone */}
                        <td className="px-4 py-2.5 text-[12px] font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{patient.phone || '—'}</td>
                        {/* Location */}
                        <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{location || '—'}</td>
                        {/* Last visit */}
                        <td className="px-4 py-2.5 text-[11px] whitespace-nowrap">
                          {lastVisit ? (
                            <span
                              className="inline-flex items-center gap-1 font-medium"
                              title={lastVisit.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              style={{ color: daysAgo != null && daysAgo > 90 ? '#C44536' : daysAgo != null && daysAgo > 30 ? '#B8741C' : 'var(--text-secondary)' }}
                            >
                              <Clock className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                              {formatRelativeShort(patient.lastConsultedAt)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        {/* Registered */}
                        <td className="px-4 py-2.5 text-[11px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {patient.registeredAt || patient.registrationDate ? formatDate(patient.registeredAt || patient.registrationDate) : '—'}
                        </td>
                        {/* Conditions */}
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {hasAllergy && (
                              <span
                                className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                style={{ background: 'rgba(196, 69, 54, 0.14)', color: '#8B2E24', border: '1px solid rgba(196, 69, 54, 0.30)' }}
                                title={t('patients.allergyTitle', { list: patient.allergies.join(', ') })}
                              >
                                ⚠ {t('patients.allergyBadge')}
                              </span>
                            )}
                            {hasChronic ? (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                style={{ background: 'rgba(228, 168, 75, 0.14)', color: '#B8741C', border: '1px solid rgba(228, 168, 75, 0.30)' }}
                                title={chronic.join(', ')}
                              >
                                {chronic[0]}{chronic.length > 1 ? ` +${chronic.length - 1}` : ''}
                              </span>
                            ) : !hasAllergy ? (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            {canAssignPatients && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignTarget({
                                    patientId: patient._id,
                                    patientName: patientFullName(patient),
                                    hospitalNumber: patient.hospitalNumber,
                                    currentDoctorId: patient.assignedDoctor,
                                  });
                                }}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:opacity-90"
                                style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)', border: '1px solid var(--border-light)' }}
                                title={patient.assignedDoctor ? `${t('frontDesk.assignedTo', { name: patient.assignedDoctorName ?? 'provider' })}` : t('frontDesk.assignToProvider')}
                              >
                                <Stethoscope className="w-3.5 h-3.5" />
                                {patient.assignedDoctor ? t('frontDesk.reassign') : t('frontDesk.assign')}
                              </button>
                            )}
                            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
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
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
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
