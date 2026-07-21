'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useToast } from '@/components/Toast';
import { patientAgeLabel, patientFullName } from '@/lib/patient-utils';
import PatientAvatar from '@/components/patients/PatientAvatar';
import { ClipboardCheck, Search, X, UserPlus } from '@/components/icons/lucide';
import type { CheckInAcuity } from '@/lib/services/check-in-service';
import type { PatientDoc } from '@/lib/db-types';

const ARRIVAL_MODES = ['walk-in', 'ambulance', 'referral', 'police', 'other'] as const;
const ACUITY: { key: CheckInAcuity; label: string; color: string; bg: string }[] = [
  { key: 'routine', label: 'Routine', color: 'var(--color-success)', bg: 'rgba(21,121,92,0.12)' },
  { key: 'priority', label: 'Priority', color: '#B45309', bg: 'rgba(217,119,6,0.12)' },
  { key: 'emergency', label: 'Emergency', color: 'var(--color-danger)', bg: 'rgba(229,46,66,0.12)' },
];

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
  color: 'var(--text-primary)', borderRadius: 10, padding: '9px 12px', fontSize: 13, width: '100%',
};

function patientFacilityName(patient: PatientDoc | undefined, fallback = 'Facility'): string {
  return (patient as (PatientDoc & { registrationHospitalName?: string }) | undefined)?.registrationHospitalName || fallback;
}

export default function CheckInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PatientDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    modeOfArrival: 'walk-in' as (typeof ARRIVAL_MODES)[number],
    chiefComplaint: '',
    symptomDuration: '',
    knownAllergies: '',
    acuity: 'routine' as CheckInAcuity,
    notes: '',
    temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '', oxygenSaturation: '', weight: '',
  });
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Preselect a patient when arriving from a chart (?patientId=).
  const preId = params?.get('patientId');
  useEffect(() => {
    if (!preId) return;
    const p = patients.find(x => x._id === preId);
    if (p) setSelected(prev => prev ?? p);
  }, [preId, patients]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return patients.filter(p =>
      patientFullName(p).toLowerCase().includes(q) || (p.hospitalNumber || '').toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query, patients]);

  async function submit() {
    if (!selected) { showToast('Select a patient to check in.', 'error'); return; }
    setSubmitting(true);
    try {
      const { checkInPatient } = await import('@/lib/services/check-in-service');
      const res = await checkInPatient({
        patientId: selected._id,
        patientName: patientFullName(selected),
        hospitalNumber: selected.hospitalNumber,
        facilityId: currentUser?.hospitalId,
        facilityName: currentUser?.hospitalName,
        orgId: selected.orgId,
        modeOfArrival: form.modeOfArrival,
        chiefComplaint: form.chiefComplaint.trim() || undefined,
        symptomDuration: form.symptomDuration.trim() || undefined,
        knownAllergies: form.knownAllergies.trim() || undefined,
        acuity: form.acuity,
        notes: form.notes.trim() || undefined,
        vitals: {
          temperature: form.temperature || undefined, pulse: form.pulse || undefined,
          respiratoryRate: form.respiratoryRate || undefined, systolic: form.systolic || undefined,
          diastolic: form.diastolic || undefined, oxygenSaturation: form.oxygenSaturation || undefined,
          weight: form.weight || undefined,
        },
        checkedInById: currentUser?._id || '',
        checkedInByName: currentUser?.name || currentUser?.username || 'Front Desk',
      });
      showToast(
        `${patientFullName(selected)} checked in${res.appointmentCheckedIn ? ' · appointment marked arrived' : ''}.`,
        'success',
      );
      router.push('/dashboard/front-desk');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Check-in failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const label = (s: string) => <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{s}</label>;

  return (
    <>
      <TopBar title="Patient Check-In" hideSearch />
      <main className="page-container page-enter">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">

          {/* Patient selection */}
          <div className="card-elevated p-5">
            <h3 className="text-sm font-semibold mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ClipboardCheck className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> Patient
            </h3>
            {selected ? (
              <div className="checkin-patient-summary">
                <PatientAvatar patient={selected} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{patientFullName(selected)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {selected.hospitalNumber || '—'} · {patientAgeLabel(selected)}{selected.gender ? ` · ${selected.gender}` : ''}
                  </p>
                  <div className="checkin-patient-context">
                    <span><b>{selected.assignedDoctorName || 'Unassigned'}</b><small>Assigned physician</small></span>
                    <span><b>{patientFacilityName(selected, currentUser?.hospitalName || 'Facility')}</b><small>Location</small></span>
                  </div>
                </div>
                <button onClick={() => { setSelected(null); setQuery(''); }} className="btn btn-sm btn-secondary"><X className="w-3.5 h-3.5" /> Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or patient ID…"
                  className="pl-9" style={inputStyle} />
                {matches.length > 0 && (
                  <div className="mt-1 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                    {matches.map(p => (
                      <button key={p._id} onClick={() => { setSelected(p); }} className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-[var(--table-row-hover)]" style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <PatientAvatar patient={p} size={26} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{patientFullName(p)}</span>
                          <span className="block text-[10.5px] truncate" style={{ color: 'var(--text-muted)' }}>{p.assignedDoctorName || 'Unassigned'} · {patientFacilityName(p, currentUser?.hospitalName || 'Facility')}</span>
                        </span>
                        <span className="text-[11px] font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{p.hospitalNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => router.push('/patients/new')} className="mt-2 text-[12px] font-medium inline-flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                  <UserPlus className="w-3.5 h-3.5" /> Register a new patient
                </button>
              </div>
            )}
          </div>

          {/* Arrival + acuity */}
          <div className="card-elevated p-5 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Arrival details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                {label('Mode of arrival')}
                <select value={form.modeOfArrival} onChange={e => set('modeOfArrival', e.target.value)} style={inputStyle}>
                  {ARRIVAL_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                {label('Symptom duration')}
                <input value={form.symptomDuration} onChange={e => set('symptomDuration', e.target.value)} placeholder="e.g. 2 days" style={inputStyle} />
              </div>
            </div>
            <div>
              {label('Chief complaint / reason for visit')}
              <input value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)} placeholder="e.g. Fever and headache" style={inputStyle} />
            </div>
            <div>
              {label('Known allergies')}
              <input value={form.knownAllergies} onChange={e => set('knownAllergies', e.target.value)} placeholder="e.g. Penicillin (or leave blank)" style={inputStyle} />
            </div>
            <div>
              {label('Acuity')}
              <div className="flex gap-2">
                {ACUITY.map(a => {
                  const on = form.acuity === a.key;
                  return (
                    <button key={a.key} type="button" onClick={() => set('acuity', a.key)}
                      className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                      style={on ? { background: a.bg, color: a.color, border: `1px solid ${a.color}` } : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Optional vitals */}
          <div className="card-elevated p-5">
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Vitals <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span></h3>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>The nurse completes the full ETAT assessment at triage.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ['temperature', 'Temp °C'], ['pulse', 'Pulse'], ['respiratoryRate', 'Resp rate'], ['oxygenSaturation', 'SpO₂ %'],
                ['systolic', 'BP systolic'], ['diastolic', 'BP diastolic'], ['weight', 'Weight kg'],
              ] as const).map(([k, lbl]) => (
                <div key={k}>
                  {label(lbl)}
                  <input value={form[k]} onChange={e => set(k, e.target.value)} inputMode="decimal" style={inputStyle} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pb-4">
            <button onClick={() => router.push('/dashboard/front-desk')} className="btn btn-secondary">Cancel</button>
            <button onClick={submit} disabled={submitting || !selected} className="btn btn-primary btn-lg">
              {submitting ? 'Checking in…' : <><ClipboardCheck className="w-4 h-4" /> Check in patient</>}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
