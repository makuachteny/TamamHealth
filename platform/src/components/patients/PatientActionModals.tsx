'use client';

/**
 * In-place action modals for the patient detail page header buttons.
 *
 * Each modal is self-contained: it pre-fills the current patient (shown
 * read-only at the top), calls the relevant create hook on submit, toasts the
 * outcome, and closes on success (staying open on error). They mirror the
 * field sets + required fields of the existing inline forms (referrals, lab,
 * consultation) so the service-layer validation passes.
 */

import { useState } from 'react';
import Modal from '@/components/Modal';
import { FlaskConical, Pill, ArrowRightLeft, X, AlertTriangle } from '@/components/icons/lucide';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { patientFullName } from '@/lib/patient-utils';
import type { PatientDoc } from '@/lib/db-types';

// Minimal shape of the logged-in user needed by these modals. The patient
// detail page passes `currentUser` from useApp(); we only read these fields.
interface ActionUser {
  _id?: string;
  name: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientDoc;
  currentUser: ActionUser | null;
}

// Same catalog the lab page uses (Stage 6 diagnostics). Kept in sync here so
// the modal can resolve a test's specimen without importing from the page.
const LAB_TESTS_CATALOG = [
  { name: 'Malaria RDT', specimen: 'Blood' },
  { name: 'Full Blood Count', specimen: 'Blood' },
  { name: 'Blood Glucose', specimen: 'Blood' },
  { name: 'HIV Rapid Test', specimen: 'Blood' },
  { name: 'CD4 Count', specimen: 'Blood' },
  { name: 'Liver Function', specimen: 'Blood' },
  { name: 'Renal Function', specimen: 'Blood' },
  { name: 'Urinalysis', specimen: 'Urine' },
  { name: 'Stool Microscopy', specimen: 'Stool' },
  { name: 'Sputum AFB (TB)', specimen: 'Sputum' },
  { name: 'Hepatitis B Surface Antigen', specimen: 'Blood' },
  { name: 'Pregnancy Test (β-hCG)', specimen: 'Urine' },
  { name: 'Syphilis (RPR)', specimen: 'Blood' },
];

// Fallback departments — used when the facility hasn't configured its own in
// Facility Settings. Mirrors the referrals page fallback.
const FALLBACK_DEPARTMENTS = [
  'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'Surgery',
  'Emergency', 'Cardiology', 'Orthopedics', 'Ophthalmology', 'Neurology',
  'Dermatology', 'ENT', 'Outpatient',
];

const routeOptions = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Rectal', 'Inhaled'];
const frequencyOptions = [
  'OD (Once daily)', 'BD (Twice daily)', 'TDS (Three times daily)',
  'QDS (Four times daily)', 'PRN (As needed)', 'STAT (Immediately)', 'Nocte (At night)',
];

// Shared header showing the pre-filled (read-only) patient.
function ModalHeader({
  icon, title, patient, onClose,
}: { icon: React.ReactNode; title: string; patient: PatientDoc; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
            {icon}
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }} aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mb-4 p-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          <span className="font-medium">{patientFullName(patient)}</span>
          <span className="text-xs ml-2 font-mono" style={{ color: 'var(--text-muted)' }}>{patient.hospitalNumber || patient._id}</span>
        </span>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Order Lab — multi-select test catalog → one LabResultDoc per test
// ─────────────────────────────────────────────────────────────────────────
export function OrderLabModal({ isOpen, onClose, patient, currentUser }: BaseModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { create } = useLabResults();
  const [tests, setTests] = useState<string[]>([]);
  const [tier, setTier] = useState<'basic' | 'special'>('basic');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setTests([]); setTier('basic'); setClinicalNotes(''); };
  const close = () => { if (!submitting) { reset(); onClose(); } };

  const handleSubmit = async () => {
    if (tests.length === 0) { showToast(t('lab.selectAtLeastOneTest'), 'error'); return; }
    try {
      setSubmitting(true);
      for (const testName of tests) {
        const catalog = LAB_TESTS_CATALOG.find(c => c.name === testName);
        await create({
          patientId: patient._id,
          patientName: patientFullName(patient),
          hospitalNumber: patient.hospitalNumber || '',
          testName,
          specimen: catalog?.specimen || 'Blood',
          status: 'pending',
          result: '',
          unit: '',
          referenceRange: '',
          abnormal: false,
          critical: false,
          orderedBy: currentUser?.name || 'Lab',
          orderedAt: new Date().toISOString(),
          completedAt: '',
          hospitalId: currentUser?.hospitalId || patient.registrationHospital,
          hospitalName: currentUser?.hospitalName,
          orgId: currentUser?.orgId,
          clinicalNotes: clinicalNotes.trim() || undefined,
          tier,
        });
      }
      showToast(t('lab.ordersCreated', { count: tests.length }), 'success');
      reset();
      onClose();
    } catch (err) {
      console.error('Order lab failed', err);
      showToast(t('lab.createOrderFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={close} width={560}>
      <div className="modal-content card-elevated p-6 w-full" onClick={e => e.stopPropagation()}>
        <ModalHeader
          icon={<FlaskConical className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />}
          title={t('lab.newLabOrder')}
          patient={patient}
          onClose={close}
        />
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                {t('lab.testsSelectedLabel', { count: tests.length })}
              </label>
              {tests.length > 0 && (
                <button type="button" onClick={() => setTests([])} className="text-xs underline" style={{ color: 'var(--accent-primary)' }}>
                  {t('action.clear')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 rounded-lg keep-cols" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              {LAB_TESTS_CATALOG.map(c => {
                const checked = tests.includes(c.name);
                return (
                  <label key={c.name} className="flex items-center gap-2 p-2 rounded text-xs cursor-pointer" style={{ background: checked ? 'var(--accent-light)' : 'transparent' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) setTests([...tests, c.name]);
                        else setTests(tests.filter(n => n !== c.name));
                      }}
                    />
                    <span className="flex-1">
                      <span className="font-medium">{c.name}</span>
                      <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.specimen}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('lab.priority')}</label>
              <select value={tier} onChange={e => setTier(e.target.value as 'basic' | 'special')}>
                <option value="basic">Basic</option>
                <option value="special">Special</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('referral.notes')}</label>
            <textarea rows={2} value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} placeholder={t('lab.clinicalNotesPlaceholder')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={close} className="btn btn-secondary flex-1" disabled={submitting}>{t('action.cancel')}</button>
          <button onClick={handleSubmit} className="btn btn-primary flex-1" disabled={submitting || tests.length === 0}>
            {submitting ? t('lab.creating') : t('dashboard.orderTests', { count: tests.length })}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Prescribe — mirrors consultation prescription entry → one PrescriptionDoc
// ─────────────────────────────────────────────────────────────────────────
export function PrescribeModal({ isOpen, onClose, patient, currentUser }: BaseModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { create } = usePrescriptions();
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('Oral');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [instructions, setInstructions] = useState('');
  const [urgency, setUrgency] = useState<'immediate' | 'definitive'>('definitive');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setMedication(''); setDose(''); setRoute('Oral'); setFrequency('');
    setDuration(''); setInstructions(''); setUrgency('definitive');
  };
  const close = () => { if (!submitting) { reset(); onClose(); } };

  // Required by validatePrescription: medication, dose, frequency, patientId.
  const canSubmit = !!medication.trim() && !!dose.trim() && !!frequency.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      // PrescriptionDoc has no dedicated free-text directions field, so — like
      // the consultation flow — instructions are appended to the duration note
      // (e.g. "5 days — take after meals") so they aren't lost.
      const durationNote = [duration.trim(), instructions.trim()].filter(Boolean).join(' — ');
      await create({
        patientId: patient._id,
        patientName: patientFullName(patient),
        medication: medication.trim(),
        dose: dose.trim(),
        route,
        frequency,
        duration: durationNote,
        prescribedBy: currentUser?.name || '',
        status: 'pending',
        orderStatus: 'received_in_pharmacy_queue',
        urgency,
        hospitalId: currentUser?.hospitalId || patient.registrationHospital,
        hospitalName: currentUser?.hospitalName,
        orgId: currentUser?.orgId,
      });
      showToast(t('consultation.toastSentToPharmacy', { count: 1 }), 'success');
      reset();
      onClose();
    } catch (err) {
      console.error('Prescribe failed', err);
      showToast(t('error.title'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={close} width={560}>
      <div className="modal-content card-elevated p-6 w-full" onClick={e => e.stopPropagation()}>
        <ModalHeader
          icon={<Pill className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />}
          title={t('tab.prescriptions')}
          patient={patient}
          onClose={close}
        />
        <div className="space-y-3">
          <div>
            <label>Medication</label>
            <input
              type="text"
              value={medication}
              onChange={e => setMedication(e.target.value)}
              placeholder="e.g. Amoxicillin"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Dose</label>
              <input type="text" value={dose} onChange={e => setDose(e.target.value)} placeholder="e.g. 500 mg" />
            </div>
            <div>
              <label>Route</label>
              <select value={route} onChange={e => setRoute(e.target.value)}>
                {routeOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}>
                <option value="">Select frequency…</option>
                {frequencyOptions.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label>Duration</label>
              <input type="text" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 5 days" />
            </div>
          </div>
          <div>
            <label>{t('referrals.urgency')}</label>
            <select value={urgency} onChange={e => setUrgency(e.target.value as 'immediate' | 'definitive')}>
              <option value="definitive">Definitive</option>
              <option value="immediate">Immediate (stat)</option>
            </select>
          </div>
          <div>
            <label>Instructions</label>
            <textarea rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="e.g. Take after meals" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={close} className="btn btn-secondary flex-1" disabled={submitting}>{t('action.cancel')}</button>
          <button onClick={handleSubmit} className="btn btn-primary flex-1" disabled={submitting || !canSubmit}>
            {submitting ? t('referrals.saving') : t('tab.prescriptions')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Refer — mirrors the New Referral form → ReferralDoc via useReferrals().create
// ─────────────────────────────────────────────────────────────────────────
export function ReferModal({ isOpen, onClose, patient, currentUser }: BaseModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { create } = useReferrals();
  const { hospitals } = useHospitals();
  const { departments: facilityDepartments } = useSettings();
  const departments = facilityDepartments.length ? facilityDepartments : FALLBACK_DEPARTMENTS;

  const ourHospitalId = currentUser?.hospitalId || '';
  const otherHospitals = hospitals.filter(h => h._id !== ourHospitalId);

  const [toHospital, setToHospital] = useState('');
  const [department, setDepartment] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setToHospital(''); setDepartment(''); setUrgency('routine'); setReason(''); setNotes('');
  };
  const close = () => { if (!submitting) { reset(); onClose(); } };

  const canSubmit = !!toHospital && !!department && !!reason.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const dest = hospitals.find(h => h._id === toHospital);
      const from = hospitals.find(h => h._id === ourHospitalId);
      await create({
        patientId: patient._id,
        patientName: patientFullName(patient),
        fromHospitalId: ourHospitalId,
        fromHospital: from?.name || currentUser?.hospitalName || '',
        toHospitalId: toHospital,
        toHospital: dest?.name || '',
        department,
        urgency,
        reason: reason.trim(),
        notes: notes.trim(),
        referringDoctor: currentUser?.name || '',
        referralDate: new Date().toISOString().split('T')[0],
        status: 'sent',
        orgId: currentUser?.orgId,
      });
      showToast(t('referrals.toastSent'), 'success');
      reset();
      onClose();
    } catch (err) {
      console.error('Refer failed', err);
      showToast(t('referrals.toastSubmitFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={close} width={600}>
      <div className="modal-content card-elevated p-6 w-full" onClick={e => e.stopPropagation()}>
        <ModalHeader
          icon={<ArrowRightLeft className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />}
          title={t('referrals.createNew')}
          patient={patient}
          onClose={close}
        />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label>{t('referrals.destinationHospital')}</label>
            <select value={toHospital} onChange={e => setToHospital(e.target.value)}>
              <option value="">{t('referrals.selectHospital')}</option>
              {otherHospitals.map(h => (
                <option key={h._id} value={h._id}>{h.name} ({h.state})</option>
              ))}
            </select>
          </div>
          <div>
            <label>{t('referrals.department')}</label>
            <select value={department} onChange={e => setDepartment(e.target.value)}>
              <option value="">{t('referrals.selectDepartment')}</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label>{t('referrals.urgency')}</label>
            <div className="flex gap-3 mt-1">
              {(['routine', 'urgent', 'emergency'] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUrgency(level)}
                  className={`badge urgency-${level} cursor-pointer px-4 py-2 text-sm transition-all`}
                  style={{
                    opacity: urgency === level ? 1 : 0.45,
                    transform: urgency === level ? 'scale(1.05)' : 'scale(1)',
                    border: urgency === level ? '2px solid currentColor' : '2px solid transparent',
                    borderRadius: '4px',
                  }}
                >
                  {level === 'emergency' && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                  {t(`referrals.urgency_${level}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <label>{t('referrals.reasonForReferral')}</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder={t('referrals.reasonPlaceholder')} />
          </div>
          <div className="col-span-2">
            <label>{t('referral.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={t('referrals.notesPlaceholder')} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={close} className="btn btn-secondary" disabled={submitting}>{t('action.cancel')}</button>
          <button onClick={handleSubmit} className="btn btn-primary" disabled={!canSubmit || submitting}>
            {submitting ? t('referrals.saving') : t('referrals.newReferral')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
