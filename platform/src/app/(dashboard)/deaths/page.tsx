'use client';

import { useState, useMemo, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import PatientName from '@/components/PatientName';
import { useDeaths } from '@/lib/hooks/useDeaths';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SearchInput, FilterSelect, FilterBar } from '@/components/filters';
import { COMMON_ICD11_CODES } from '@/lib/icd11-codes';
import { Plus, Search, X, FileText, ChevronDown, ChevronUp, UserCheck } from '@/components/icons/lucide';

export default function DeathsPage() {
  const { t } = useTranslation();
  const { deaths, stats, register } = useDeaths();
  const { hospitals } = useHospitals();
  const { patients } = usePatients();
  const { currentUser } = useApp();
  const { canRecordVitalEvents } = usePermissions();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [expandedDeath, setExpandedDeath] = useState<string | null>(null);
  const [patientLookup, setPatientLookup] = useState('');
  const [linkedPatientId, setLinkedPatientId] = useState<string | undefined>(undefined);
  const [form, setForm] = useState({
    deceasedFirstName: '', deceasedSurname: '', deceasedGender: 'Male' as 'Male' | 'Female',
    dateOfBirth: '', dateOfDeath: new Date().toISOString().slice(0, 10), ageAtDeath: 0,
    placeOfDeath: '', facilityId: '', facilityName: '',
    immediateCause: '', immediateICD11: '', antecedentCause1: '', antecedentICD11_1: '',
    antecedentCause2: '', antecedentICD11_2: '', underlyingCause: '', underlyingICD11: '',
    contributingConditions: '', contributingICD11: '',
    mannerOfDeath: 'natural' as const, maternalDeath: false, pregnancyRelated: false,
    certifiedBy: '', certifierRole: '', state: '', county: '', certificateNumber: '',
    deathNotified: true, deathRegistered: false,
  });

  const patientMatches = useMemo(() => {
    if (!patientLookup || patientLookup.length < 2) return [];
    const q = patientLookup.toLowerCase();
    return (patients || [])
      .filter(p => !p.isDeceased && (
        `${p.firstName} ${p.surname}`.toLowerCase().includes(q) ||
        (p.hospitalNumber || '').toLowerCase().includes(q)
      ))
      .slice(0, 6);
  }, [patientLookup, patients]);

  // Auto-link if the user types an EXACT hospital number — saves a click in
  // the typical CRVS workflow where the death is recorded immediately after
  // the patient's last vital sign and the hospital number is known.
  useEffect(() => {
    if (linkedPatientId || !patientLookup || patientLookup.length < 4) return;
    const exact = (patients || []).find(p =>
      !p.isDeceased && (p.hospitalNumber || '').toLowerCase() === patientLookup.trim().toLowerCase()
    );
    if (exact) {
      selectLinkedPatient(exact._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientLookup, patients]);

  const filtered = (deaths || []).filter(d =>
    (genderFilter === 'all' || d.deceasedGender === genderFilter) &&
    (!search || `${d.deceasedFirstName} ${d.deceasedSurname}`.toLowerCase().includes(search.toLowerCase()) ||
    (d.certificateNumber || '').toLowerCase().includes(search.toLowerCase()) || (d.underlyingICD11 || '').toLowerCase().includes(search.toLowerCase()))
  );

  const handleSubmit = async () => {
    if (!form.deceasedFirstName || !form.immediateCause) return;
    const fac = hospitals.find(h => h._id === (form.facilityId || currentUser?.hospitalId));
    try {
      await register({
        ...form,
        patientId: linkedPatientId,
        facilityId: fac?._id || currentUser?.hospitalId || '',
        facilityName: fac?.name || currentUser?.hospitalName || '',
        state: fac?.state || form.state,
        certifiedBy: form.certifiedBy || currentUser?.name || '',
        certificateNumber: form.certificateNumber || `SS-D-${Date.now().toString(36).toUpperCase()}`,
      });
      showToast(t('deaths.registeredSuccess'), 'success');
      setShowForm(false);
      setLinkedPatientId(undefined);
      setPatientLookup('');
    } catch {
      showToast(t('deaths.registerFailed'), 'error');
    }
  };

  const selectLinkedPatient = (patientId: string) => {
    const p = patients.find(x => x._id === patientId);
    if (!p) return;
    setLinkedPatientId(p._id);
    setPatientLookup('');
    // Pre-fill the form with the patient's known data
    const dob = p.dateOfBirth || '';
    const ageAtDeath = p.estimatedAge ?? (dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0);
    setForm(f => ({
      ...f,
      deceasedFirstName: p.firstName || f.deceasedFirstName,
      deceasedSurname: p.surname || f.deceasedSurname,
      deceasedGender: (p.gender as 'Male' | 'Female') || f.deceasedGender,
      dateOfBirth: dob || f.dateOfBirth,
      ageAtDeath: ageAtDeath || f.ageAtDeath,
      state: p.state || f.state,
      county: p.county || f.county,
    }));
  };

  const ICD11Select = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
        <option value="">{t('deaths.selectIcd11')}</option>
        {COMMON_ICD11_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <TopBar title={t('deaths.title')} />
      <main className="page-container page-enter">
        <PageHeader
          icon={FileText}
          title={t('deaths.title')}
          subtitle={t('deaths.subtitle')}
          actions={canRecordVitalEvents && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('deaths.registerDeath')}
            </button>
          )}
        />

        {/* Search + filters, with the registry stats surfaced inline on the right */}
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t('deaths.searchPlaceholder')} />
          <FilterSelect
            value={genderFilter}
            onChange={setGenderFilter}
            options={[
              { value: 'all', label: 'All sexes' },
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
            aria-label="Filter by sex"
          />
          <FilterBar.Spacer />
          {stats && (
            <div className="flex items-center gap-4 sm:gap-5 pr-1">
              {[
                { label: t('deaths.statTotalDeaths'), value: stats.total, color: 'var(--color-danger)' },
                { label: t('deaths.statMaternalDeaths'), value: stats.maternalDeaths, color: 'var(--color-danger)' },
                { label: t('deaths.statUnder5Deaths'), value: stats.under5Deaths, color: 'var(--color-warning)' },
                { label: t('deaths.statWithIcd11'), value: `${stats.withICD11Code}/${stats.total}`, color: 'var(--accent-primary)' },
                { label: t('deaths.statRegistered'), value: `${stats.registered}/${stats.total}`, color: 'var(--accent-primary)' },
              ].map(s => (
                <div key={s.label} className="text-center leading-tight">
                  <div className="text-base font-bold" style={{ color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </FilterBar>

        {/* Table */}
        <div className="card-elevated overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('deaths.colCertificate')}</th>
                <th>{t('deaths.colDeceased')}</th>
                <th>{t('deaths.colAge')}</th>
                <th>{t('deaths.colDateOfDeath')}</th>
                <th>{t('deaths.colCause')}</th>
                <th>{t('deaths.colManner')}</th>
                <th>{t('deaths.colFacility')}</th>
                <th>{t('deaths.colRegistered')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d._id} className="cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => setExpandedDeath(expandedDeath === d._id ? null : d._id)}>
                  <td className="font-mono text-xs">{d.certificateNumber}</td>
                  <td><PatientName name={`${d.deceasedFirstName} ${d.deceasedSurname}`} gender={d.deceasedGender} nameClassName="text-sm font-medium" /></td>
                  <td className="text-sm">{d.ageAtDeath < 1 ? t('deaths.neonate') : `${d.ageAtDeath}y`}</td>
                  <td className="text-xs font-mono">{d.dateOfDeath}</td>
                  <td>
                    <div>
                      {d.underlyingICD11 && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded mr-1" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>{d.underlyingICD11}</span>}
                      <span className="text-xs">{d.underlyingCause || d.immediateCause}</span>
                    </div>
                  </td>
                  <td className="text-xs capitalize">{(d.mannerOfDeath || '').replace(/_/g, ' ')}</td>
                  <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(d.facilityName || '').replace(' Hospital', '').replace(' Teaching', '')}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className={`badge text-[10px] ${d.deathRegistered ? 'badge-normal' : 'badge-warning'}`}>
                        {d.deathRegistered ? t('deaths.yes') : t('deaths.no')}
                      </span>
                      {expandedDeath === d._id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                  </td>
                </tr>
              ))}
              {expandedDeath && (() => {
                const d = filtered.find(x => x._id === expandedDeath);
                if (!d) return null;
                return (
                  <tr>
                    <td colSpan={8} style={{ background: 'var(--overlay-subtle)', padding: 0 }}>
                      <div className="p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.fullName')}</span>{d.deceasedFirstName} {d.deceasedSurname}</div>
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.gender')}</span>{d.deceasedGender}</div>
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.dateOfBirth')}</span>{d.dateOfBirth || t('deaths.na')}</div>
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.placeOfDeath')}</span>{d.placeOfDeath || d.facilityName}</div>
                        </div>
                        <hr className="section-divider" />
                        <div className="p-3 rounded-lg" style={{ background: 'rgba(229,46,66,0.06)', border: '1px solid rgba(229,46,66,0.15)' }}>
                          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-danger)' }}>{t('deaths.causeChain')}</p>
                          <div className="data-row-divider-sm text-xs">
                            <p><span className="font-medium">{t('deaths.causeImmediate')}</span> {d.immediateCause} {d.immediateICD11 && <span className="font-mono text-[10px] px-1 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>{d.immediateICD11}</span>}</p>
                            {d.antecedentCause1 && <p><span className="font-medium">{t('deaths.causeDueTo')}</span> {d.antecedentCause1} {d.antecedentICD11_1 && <span className="font-mono text-[10px] px-1 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>{d.antecedentICD11_1}</span>}</p>}
                            {d.antecedentCause2 && <p><span className="font-medium">{t('deaths.causeDueToC')}</span> {d.antecedentCause2} {d.antecedentICD11_2 && <span className="font-mono text-[10px] px-1 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>{d.antecedentICD11_2}</span>}</p>}
                            {d.underlyingCause && <p><span className="font-medium">{t('deaths.causeUnderlying')}</span> {d.underlyingCause} {d.underlyingICD11 && <span className="font-mono text-[10px] px-1 rounded" style={{ background: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)' }}>{d.underlyingICD11}</span>}</p>}
                            {d.contributingConditions && <p><span className="font-medium">{t('deaths.causeContributing')}</span> {d.contributingConditions}</p>}
                          </div>
                        </div>
                        <hr className="section-divider" />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.colManner')}</span><span className="capitalize">{(d.mannerOfDeath || '').replace(/_/g, ' ')}</span></div>
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.maternalDeath')}</span>{d.maternalDeath ? t('deaths.yes') : t('deaths.no')}</div>
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.certifiedBy')}</span>{d.certifiedBy || t('deaths.na')} ({d.certifierRole || t('deaths.na')})</div>
                          <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>{t('deaths.location')}</span>{d.county || t('deaths.na')}, {d.state}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Death Registration Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2"><FileText className="w-5 h-5" style={{ color: 'var(--color-danger)' }} /><h2 className="font-semibold">{t('deaths.modalTitle')}</h2></div>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
              </div>
              <div className="p-4 space-y-4">
                {/* Link to existing patient (optional) */}
                <div className="rounded-lg p-3" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border, rgba(59, 130, 246,0.2))' }}>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                    <UserCheck className="w-3 h-3" />
                    {t('deaths.linkPatient')}
                  </label>
                  {linkedPatientId ? (
                    (() => {
                      const lp = patients.find(p => p._id === linkedPatientId);
                      return (
                        <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                          <div className="text-xs">
                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{lp?.firstName} {lp?.surname}</p>
                            <p style={{ color: 'var(--text-muted)' }}>{lp?.hospitalNumber} · {lp?.gender}{lp?.estimatedAge ? ` · ${lp.estimatedAge}y` : ''}</p>
                          </div>
                          <button onClick={() => { setLinkedPatientId(undefined); }} className="text-[10px] font-semibold" style={{ color: 'var(--accent-primary)' }}>{t('deaths.unlink')}</button>
                        </div>
                      );
                    })()
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          value={patientLookup}
                          onChange={e => setPatientLookup(e.target.value)}
                          placeholder={t('deaths.searchPatientPlaceholder')}
                          className="w-full text-xs p-2 pl-8 rounded-lg outline-none"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      {patientMatches.length > 0 && (
                        <div className="mt-1.5 rounded-lg overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                          {patientMatches.map(p => (
                            <button
                              key={p._id}
                              onClick={() => selectLinkedPatient(p._id)}
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
                        {t('deaths.linkHint')}
                      </p>
                    </>
                  )}
                </div>

                <hr className="section-divider" />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('deaths.deceasedInfo')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.firstNameRequired')}</label><input type="text" value={form.deceasedFirstName} onChange={e => setForm({ ...form, deceasedFirstName: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                  <div><label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.surname')}</label><input type="text" value={form.deceasedSurname} onChange={e => setForm({ ...form, deceasedSurname: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                  <div><label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.gender')}</label><select value={form.deceasedGender} onChange={e => setForm({ ...form, deceasedGender: e.target.value as 'Male' | 'Female' })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}><option value="Male">{t('deaths.male')}</option><option value="Female">{t('deaths.female')}</option></select></div>
                  <div><label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.colDateOfDeath')}</label><input type="date" value={form.dateOfDeath} onChange={e => setForm({ ...form, dateOfDeath: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                  <div><label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.ageAtDeath')}</label><input type="number" value={form.ageAtDeath} onChange={e => setForm({ ...form, ageAtDeath: Number(e.target.value) })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                  <div><label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.mannerOfDeath')}</label><select value={form.mannerOfDeath} onChange={e => setForm({ ...form, mannerOfDeath: e.target.value as typeof form.mannerOfDeath })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}><option value="natural">{t('deaths.mannerNatural')}</option><option value="accident">{t('deaths.mannerAccident')}</option><option value="intentional_self_harm">{t('deaths.mannerSelfHarm')}</option><option value="assault">{t('deaths.mannerAssault')}</option><option value="pending_investigation">{t('deaths.mannerPending')}</option><option value="unknown">{t('deaths.mannerUnknown')}</option></select></div>
                </div>

                <hr className="section-divider" />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('deaths.causeChainWhoFormat')}</h3>
                <div className="p-3 rounded-lg space-y-3" style={{ background: 'rgba(229,46,66,0.05)', border: '1px solid rgba(229,46,66,0.15)' }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.lineAImmediate')}</label><input type="text" value={form.immediateCause} onChange={e => setForm({ ...form, immediateCause: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} placeholder={t('deaths.lineAImmediatePlaceholder')} /></div>
                    <ICD11Select value={form.immediateICD11} onChange={v => setForm({ ...form, immediateICD11: v })} label={t('deaths.icd11LineA')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.lineBDueTo')}</label><input type="text" value={form.antecedentCause1} onChange={e => setForm({ ...form, antecedentCause1: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                    <ICD11Select value={form.antecedentICD11_1} onChange={v => setForm({ ...form, antecedentICD11_1: v })} label={t('deaths.icd11LineB')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.lineCDueTo')}</label><input type="text" value={form.antecedentCause2} onChange={e => setForm({ ...form, antecedentCause2: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                    <ICD11Select value={form.antecedentICD11_2} onChange={v => setForm({ ...form, antecedentICD11_2: v })} label={t('deaths.icd11LineC')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.lineDUnderlying')}</label><input type="text" value={form.underlyingCause} onChange={e => setForm({ ...form, underlyingCause: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                    <ICD11Select value={form.underlyingICD11} onChange={v => setForm({ ...form, underlyingICD11: v })} label={t('deaths.icd11LineD')} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('deaths.contributingConditions')}</label><input type="text" value={form.contributingConditions} onChange={e => setForm({ ...form, contributingConditions: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} /></div>
                    <ICD11Select value={form.contributingICD11} onChange={v => setForm({ ...form, contributingICD11: v })} label={t('deaths.icd11Contributing')} />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.maternalDeath} onChange={e => setForm({ ...form, maternalDeath: e.target.checked })} /> {t('deaths.maternalDeathCheckbox')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pregnancyRelated} onChange={e => setForm({ ...form, pregnancyRelated: e.target.checked })} /> {t('deaths.pregnancyRelated')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.deathNotified} onChange={e => setForm({ ...form, deathNotified: e.target.checked })} /> {t('deaths.deathNotified')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.deathRegistered} onChange={e => setForm({ ...form, deathRegistered: e.target.checked })} /> {t('deaths.deathRegistered')}</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">{t('action.cancel')}</button>
                <button onClick={handleSubmit} className="btn btn-primary btn-sm" style={{ opacity: !form.deceasedFirstName || !form.immediateCause ? 0.5 : 1 }}>{t('deaths.registerDeath')}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
