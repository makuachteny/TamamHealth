'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useBirths } from '@/lib/hooks/useBirths';
import { usePatients } from '@/lib/hooks/usePatients';
import { patientFullName } from '@/lib/patient-utils';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import EhrListHeader, { LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import Modal from '@/components/Modal';
import PopupSelect from '@/components/PopupSelect';
import {
  Baby, Plus, X, ChevronDown,
} from '@/components/icons/lucide';

export default function BirthsPage() {
  const { births, loading, register } = useBirths();
  const { hospitals } = useHospitals();
  const { patients } = usePatients();

  // Birth records store the mother as free text only — link her name to a
  // chart when a real registered patient matches it (same guard idea as ANC:
  // never link demo/seed-only identities).
  const motherChartId = useMemo(() => {
    const byName = new Map<string, string>();
    for (const p of patients) {
      if (p._id.startsWith('demo-') || p._id.includes('_demo')) continue;
      byName.set(patientFullName(p).trim().toLowerCase(), p._id);
    }
    return (name?: string) => (name ? byName.get(name.trim().toLowerCase()) : undefined);
  }, [patients]);
  const { currentUser, globalSearch } = useApp();
  const { canRecordVitalEvents } = usePermissions();
  const { showToast } = useToast();
  const { t } = useTranslation();
  // Table toolbar search (shared list-page header), combined with the
  // platform-wide search bar so a term typed elsewhere still narrows this list.
  const [tableSearch, setTableSearch] = useState('');
  const search = `${tableSearch} ${globalSearch}`.trim();
  const [showForm, setShowForm] = useState(false);
  const [selectedBirthId, setSelectedBirthId] = useState<string | null>(null);
  const [form, setForm] = useState({
    childFirstName: '', childSurname: '', childGender: 'Male' as 'Male' | 'Female',
    dateOfBirth: new Date().toISOString().slice(0, 10), placeOfBirth: '', facilityId: '', facilityName: '',
    motherName: '', motherAge: 0, motherNationality: 'South Sudanese',
    fatherName: '', fatherNationality: 'South Sudanese',
    birthWeight: 3000, birthType: 'single' as 'single' | 'twin' | 'multiple', deliveryType: 'normal' as 'normal' | 'caesarean' | 'assisted',
    attendedBy: '', registeredBy: '', state: '', county: '', certificateNumber: '',
  });

  const filtered = (births || []).filter(b =>
    (!search || `${b.childFirstName} ${b.childSurname}`.toLowerCase().includes(search.toLowerCase()) ||
    (b.motherName || '').toLowerCase().includes(search.toLowerCase()) || (b.certificateNumber || '').toLowerCase().includes(search.toLowerCase()))
  );
  const selectedBirth = useMemo(
    () => (selectedBirthId ? (births || []).find(b => b._id === selectedBirthId) || null : null),
    [births, selectedBirthId],
  );

  // Header stat chips — computed from data already loaded on this page,
  // unaffected by the search box (same as the patients header).
  const thisMonthPrefix = new Date().toISOString().slice(0, 7);
  const birthStats = useMemo(() => {
    const all = births || [];
    return {
      total: all.length,
      thisMonth: all.filter(b => b.dateOfBirth?.startsWith(thisMonthPrefix)).length,
      male: all.filter(b => b.childGender === 'Male').length,
      female: all.filter(b => b.childGender === 'Female').length,
    };
  }, [births, thisMonthPrefix]);

  const handleSubmit = async () => {
    if (!form.childFirstName || !form.motherName) return;
    const facilityMatch = hospitals.find(h => h._id === (form.facilityId || currentUser?.hospitalId));
    try {
      await register({
        ...form,
        facilityId: facilityMatch?._id || currentUser?.hospitalId || '',
        facilityName: facilityMatch?.name || currentUser?.hospitalName || '',
        state: facilityMatch?.state || form.state,
        registeredBy: currentUser?.name || '',
        certificateNumber: form.certificateNumber || `SS-B-${Date.now().toString(36).toUpperCase()}`,
      });
      showToast(t('births.registeredSuccess'), 'success');
      setShowForm(false);
      setForm({ childFirstName: '', childSurname: '', childGender: 'Male', dateOfBirth: new Date().toISOString().slice(0, 10), placeOfBirth: '', facilityId: '', facilityName: '', motherName: '', motherAge: 0, motherNationality: 'South Sudanese', fatherName: '', fatherNationality: 'South Sudanese', birthWeight: 3000, birthType: 'single', deliveryType: 'normal', attendedBy: '', registeredBy: '', state: '', county: '', certificateNumber: '' });
    } catch {
      showToast(t('births.registerFailed'), 'error');
    }
  };

  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* Table */}
        <div className="card-elevated overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          <EhrListHeader
            title={t('nav.births')}
            stats={[
              { label: 'Registered', value: birthStats.total, color: LIST_STAT_COLORS.muted },
              { label: 'This month', value: birthStats.thisMonth, color: LIST_STAT_COLORS.blue },
              { label: 'Male', value: birthStats.male, color: LIST_STAT_COLORS.amber },
              { label: 'Female', value: birthStats.female, color: LIST_STAT_COLORS.green },
            ]}
            search={{ value: tableSearch, onChange: setTableSearch, placeholder: 'Search by child or mother name…', ariaLabel: 'Search births' }}
            actions={
              canRecordVitalEvents && (
                <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2" style={{ height: 38, whiteSpace: 'nowrap' }}>
                  <Plus className="w-4 h-4" /> {t('births.registerBirth')}
                </button>
              )
            }
          />
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          {loading ? (
            <div className="p-8 text-center"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p></div>
          ) : (
            <table className="data-table" style={{ minWidth: 1080 }}>
              <thead>
                <tr>
                  <th>Certificate #</th>
                  <th>Child Name</th>
                  <th>Gender</th>
                  <th>Date of Birth</th>
                  <th>Weight</th>
                  <th>Delivery</th>
                  <th>Mother</th>
                  <th>Facility</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b._id} className="cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => setSelectedBirthId(b._id)}>
                    <td className="font-mono text-xs">{b.certificateNumber}</td>
                    <td className="font-medium text-sm">{b.childFirstName} {b.childSurname}</td>
                    <td><span className="badge text-[10px]" style={{ background: b.childGender === 'Male' ? 'rgba(33, 145, 208, 0.12)' : 'rgba(229,46,66,0.12)', color: b.childGender === 'Male' ? 'var(--accent-primary)' : 'var(--color-danger)' }}>{b.childGender}</span></td>
                    <td className="text-xs font-mono">{b.dateOfBirth}</td>
                    <td className="text-sm">{b.birthWeight}g</td>
                    <td className="text-xs capitalize">{b.deliveryType}</td>
                    <td className="text-sm">
                      {motherChartId(b.motherName) ? (
                        <Link
                          href={`/patients/${motherChartId(b.motherName)}`}
                          className="hover:underline"
                          style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                          onClick={e => e.stopPropagation()}
                        >
                          {b.motherName}
                        </Link>
                      ) : (
                        b.motherName
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(b.facilityName || '').replace(' Hospital', '').replace(' Teaching', '')}</td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex items-center gap-1">
                        {b.state}
                        <ChevronDown className="w-3 h-3" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>

        {selectedBirth && (
          <Modal onClose={() => setSelectedBirthId(null)} width={720} labelledBy="birth-certificate-details-title">
            <div className="modal-content card-elevated w-full overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="min-w-0">
                  <h3 id="birth-certificate-details-title" className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    Birth Certificate · {selectedBirth.certificateNumber}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {selectedBirth.childFirstName} {selectedBirth.childSurname} · {selectedBirth.dateOfBirth}
                  </p>
                </div>
                <button onClick={() => setSelectedBirthId(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }} aria-label="Close birth certificate details">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Certificate #</span>{selectedBirth.certificateNumber}</div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Birth Type</span><span className="capitalize">{selectedBirth.birthType}</span></div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Delivery Type</span><span className="capitalize">{selectedBirth.deliveryType}</span></div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Birth Weight</span>{selectedBirth.birthWeight}g</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Mother</span>{selectedBirth.motherName} (Age: {selectedBirth.motherAge || 'N/A'})</div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Mother Nationality</span>{selectedBirth.motherNationality || 'N/A'}</div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Father</span>{selectedBirth.fatherName || 'N/A'}</div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Father Nationality</span>{selectedBirth.fatherNationality || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Place of Birth</span>{selectedBirth.placeOfBirth || selectedBirth.facilityName}</div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Attended By</span>{selectedBirth.attendedBy || 'N/A'}</div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Registered By</span>{selectedBirth.registeredBy || 'N/A'}</div>
                  <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>County</span>{selectedBirth.county || 'N/A'}, {selectedBirth.state}</div>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Registration Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2"><Baby className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /><h2 className="font-semibold">Register New Birth</h2></div>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
              </div>
              <div className="p-4 space-y-4">
                {/* Child Information */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Child First Name *</label>
                    <input type="text" value={form.childFirstName} onChange={e => setForm({ ...form, childFirstName: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Child Surname *</label>
                    <input type="text" value={form.childSurname} onChange={e => setForm({ ...form, childSurname: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Gender</label>
                    <PopupSelect label="Gender" value={form.childGender} onChange={value => setForm({ ...form, childGender: value as 'Male' | 'Female' })} options={['Male', 'Female']} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} />
                  </div>
                </div>

                <hr className="section-divider" />

                {/* Birth Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Birth Weight (grams)</label>
                    <input type="number" value={form.birthWeight} onChange={e => setForm({ ...form, birthWeight: Number(e.target.value) })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Delivery Type</label>
                    <PopupSelect label="Delivery Type" value={form.deliveryType} onChange={value => setForm({ ...form, deliveryType: value as 'normal' | 'caesarean' | 'assisted' })} options={[{ value: 'normal', label: 'Normal' }, { value: 'caesarean', label: 'Caesarean' }, { value: 'assisted', label: 'Assisted' }]} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Birth Type</label>
                    <PopupSelect label="Birth Type" value={form.birthType} onChange={value => setForm({ ...form, birthType: value as 'single' | 'twin' | 'multiple' })} options={[{ value: 'single', label: 'Single' }, { value: 'twin', label: 'Twin' }, { value: 'multiple', label: 'Multiple' }]} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Attended By</label>
                    <PopupSelect label="Attended By" value={form.attendedBy} onChange={value => setForm({ ...form, attendedBy: value })} placeholder="Select..." options={[{ value: '', label: 'Select...' }, 'Doctor', 'Midwife', 'Nurse', 'TBA', 'None']} />
                  </div>
                </div>

                <hr className="section-divider" />

                {/* Parent Information */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Mother Name *</label>
                    <input type="text" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Mother Age</label>
                    <input type="number" value={form.motherAge} onChange={e => setForm({ ...form, motherAge: Number(e.target.value) })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Father Name</label>
                    <input type="text" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Facility</label>
                    <PopupSelect
                      label="Facility"
                      value={form.facilityId}
                      onChange={value => {
                        const h = hospitals.find(hospital => hospital._id === value);
                        setForm({ ...form, facilityId: value, facilityName: h?.name || '', state: h?.state || '' });
                      }}
                      placeholder="Current facility"
                      options={[{ value: '', label: 'Current facility' }, ...hospitals.map(h => ({ value: h._id, label: h.name }))]}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button onClick={handleSubmit} className="btn btn-primary btn-sm" style={{ opacity: !form.childFirstName || !form.motherName ? 0.5 : 1 }}>Register Birth</button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}
