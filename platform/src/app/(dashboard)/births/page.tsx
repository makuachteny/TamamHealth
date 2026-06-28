'use client';

import { useState } from 'react';
import TopBar from '@/components/TopBar';
import { useBirths } from '@/lib/hooks/useBirths';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { FilterMenu } from '@/components/filters';
import {
  Baby, Plus, X, ChevronDown, ChevronUp,
} from '@/components/icons/lucide';

export default function BirthsPage() {
  const { births, loading, register } = useBirths();
  const { hospitals } = useHospitals();
  const { currentUser, globalSearch } = useApp();
  const { canRecordVitalEvents } = usePermissions();
  const { showToast } = useToast();
  const { t } = useTranslation();
  // Text search comes from the shared global search bar (TopBar).
  const search = globalSearch;
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const activeFilterCount = (deliveryFilter !== 'all' ? 1 : 0);
  const clearFilters = () => { setDeliveryFilter('all'); };
  const [showForm, setShowForm] = useState(false);
  const [expandedBirth, setExpandedBirth] = useState<string | null>(null);
  const [form, setForm] = useState({
    childFirstName: '', childSurname: '', childGender: 'Male' as 'Male' | 'Female',
    dateOfBirth: new Date().toISOString().slice(0, 10), placeOfBirth: '', facilityId: '', facilityName: '',
    motherName: '', motherAge: 0, motherNationality: 'South Sudanese',
    fatherName: '', fatherNationality: 'South Sudanese',
    birthWeight: 3000, birthType: 'single' as 'single' | 'twin' | 'multiple', deliveryType: 'normal' as 'normal' | 'caesarean' | 'assisted',
    attendedBy: '', registeredBy: '', state: '', county: '', certificateNumber: '',
  });

  const filtered = (births || []).filter(b =>
    (deliveryFilter === 'all' || b.deliveryType === deliveryFilter) &&
    (!search || `${b.childFirstName} ${b.childSurname}`.toLowerCase().includes(search.toLowerCase()) ||
    (b.motherName || '').toLowerCase().includes(search.toLowerCase()) || (b.certificateNumber || '').toLowerCase().includes(search.toLowerCase()))
  );

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
    <>
      <TopBar title={t('nav.births')} searchTrailing={
              <FilterMenu activeCount={activeFilterCount} onClear={clearFilters}>
                <FilterMenu.Field label="Delivery type">
                  <select
                    className="w-full text-sm"
                    value={deliveryFilter}
                    onChange={e => setDeliveryFilter(e.target.value)}
                  >
                    <option value="all">All deliveries</option>
                    <option value="normal">Normal</option>
                    <option value="caesarean">Caesarean</option>
                    <option value="assisted">Assisted</option>
                  </select>
                </FilterMenu.Field>
              </FilterMenu>
          } actions={
            canRecordVitalEvents && (
              <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('births.registerBirth')}
              </button>
            )
          } />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* Table */}
        <div className="card-elevated overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
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
                  <tr key={b._id} className="cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => setExpandedBirth(expandedBirth === b._id ? null : b._id)}>
                    <td className="font-mono text-xs">{b.certificateNumber}</td>
                    <td className="font-medium text-sm">{b.childFirstName} {b.childSurname}</td>
                    <td><span className="badge text-[10px]" style={{ background: b.childGender === 'Male' ? 'rgba(33, 145, 208, 0.12)' : 'rgba(229,46,66,0.12)', color: b.childGender === 'Male' ? 'var(--accent-primary)' : 'var(--color-danger)' }}>{b.childGender}</span></td>
                    <td className="text-xs font-mono">{b.dateOfBirth}</td>
                    <td className="text-sm">{b.birthWeight}g</td>
                    <td className="text-xs capitalize">{b.deliveryType}</td>
                    <td className="text-sm">{b.motherName}</td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(b.facilityName || '').replace(' Hospital', '').replace(' Teaching', '')}</td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex items-center gap-1">
                        {b.state}
                        {expandedBirth === b._id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </div>
                    </td>
                  </tr>
                ))}
                {expandedBirth && (() => {
                  const b = filtered.find(x => x._id === expandedBirth);
                  if (!b) return null;
                  return (
                    <tr>
                      <td colSpan={9} style={{ background: 'var(--overlay-subtle)', padding: 0 }}>
                        <div className="p-4 data-row-divider-sm">
                          {/* Birth Details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Certificate #</span>{b.certificateNumber}</div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Birth Type</span><span className="capitalize">{b.birthType}</span></div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Delivery Type</span><span className="capitalize">{b.deliveryType}</span></div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Birth Weight</span>{b.birthWeight}g</div>
                          </div>
                          {/* Parents */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Mother</span>{b.motherName} (Age: {b.motherAge || 'N/A'})</div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Mother Nationality</span>{b.motherNationality || 'N/A'}</div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Father</span>{b.fatherName || 'N/A'}</div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Father Nationality</span>{b.fatherNationality || 'N/A'}</div>
                          </div>
                          {/* Location & Registration */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Place of Birth</span>{b.placeOfBirth || b.facilityName}</div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Attended By</span>{b.attendedBy || 'N/A'}</div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>Registered By</span>{b.registeredBy || 'N/A'}</div>
                            <div><span className="font-semibold block mb-0.5" style={{ color: 'var(--text-muted)' }}>County</span>{b.county || 'N/A'}, {b.state}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          )}
          </div>
        </div>

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
                    <select value={form.childGender} onChange={e => setForm({ ...form, childGender: e.target.value as 'Male' | 'Female' })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
                      <option value="Male">Male</option><option value="Female">Female</option>
                    </select>
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
                    <select value={form.deliveryType} onChange={e => setForm({ ...form, deliveryType: e.target.value as 'normal' | 'caesarean' | 'assisted' })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
                      <option value="normal">Normal</option><option value="caesarean">Caesarean</option><option value="assisted">Assisted</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Birth Type</label>
                    <select value={form.birthType} onChange={e => setForm({ ...form, birthType: e.target.value as 'single' | 'twin' | 'multiple' })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
                      <option value="single">Single</option><option value="twin">Twin</option><option value="multiple">Multiple</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Attended By</label>
                    <select value={form.attendedBy} onChange={e => setForm({ ...form, attendedBy: e.target.value })} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
                      <option value="">Select...</option><option value="Doctor">Doctor</option><option value="Midwife">Midwife</option><option value="Nurse">Nurse</option><option value="TBA">TBA</option><option value="None">None</option>
                    </select>
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
                    <select value={form.facilityId} onChange={e => { const h = hospitals.find(h => h._id === e.target.value); setForm({ ...form, facilityId: e.target.value, facilityName: h?.name || '', state: h?.state || '' }); }} className="w-full p-2 rounded-lg text-sm outline-none" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
                      <option value="">Current facility</option>
                      {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                    </select>
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
    </>
  );
}
