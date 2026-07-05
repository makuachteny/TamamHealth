'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import { useToast } from '@/components/Toast';
import { patientFullName, patientGenderAge } from '@/lib/patient-utils';
import { isVitalInRange, VITAL_RANGES } from '@/lib/clinical/vitals';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Activity, Clock, X, AlertTriangle, Wind, Brain, Heart,
  Eye, ClipboardList, CheckCircle2, LogIn, LogOut, Send,
} from '@/components/icons/lucide';
import {
  ACCENT, calculateTriagePriority, type TriageResult,
} from './shared';
import ListSearch from './ListSearch';
import RowActionsMenu, { type RowAction } from '@/components/referrals/RowActionsMenu';

export default function TriageWorkflow({ initialPatientId }: { initialPatientId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  const { triages: triageHistory, create: createTriageRecord, update: updateTriageRecord } = useTriage();
  const { showToast } = useToast();

  // When set, the form is correcting an already-saved triage record rather
  // than creating a new one. Lets a nurse fix a mistyped vital / mis-tapped
  // ABCC option after saving — the audit trail keeps the record id stable.
  const [editingTriageId, setEditingTriageId] = useState<string | null>(null);

  const [triageData, setTriageData] = useState<TriageResult>({
    airway: '', breathing: '', circulation: '', consciousness: '', priority: '',
  });
  const [triagePatientId, setTriagePatientId] = useState(initialPatientId ?? '');
  const [triagePatientSearch, setTriagePatientSearch] = useState('');
  // Inline search for the "Recent Triages" list (right column).
  const [historySearch, setHistorySearch] = useState('');
  const [triageVitals, setTriageVitals] = useState({
    temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '',
    oxygenSaturation: '', weight: '', painScore: '', bloodGlucose: '', gcs: '', muac: '',
  });
  const [triageContext, setTriageContext] = useState<{
    modeOfArrival: 'walk-in' | 'ambulance' | 'referral' | 'police' | 'other' | '';
    symptomDuration: string;
    referralSource: string;
    knownAllergies: string;
  }>({
    modeOfArrival: '', symptomDuration: '', referralSource: '', knownAllergies: '',
  });
  const [triageComplaint, setTriageComplaint] = useState('');
  const [triageNotes, setTriageNotes] = useState('');
  const [triageSubmitting, setTriageSubmitting] = useState(false);

  // Triage auto-calculate
  useEffect(() => {
    const priority = calculateTriagePriority(triageData);
    if (priority !== triageData.priority) {
      setTriageData(prev => ({ ...prev, priority }));
    }
  }, [triageData]);

  const triagePatientMatches = useMemo(() => {
    const q = triagePatientSearch.trim().toLowerCase();
    if (q.length < 2 || triagePatientId) return [];
    return patients.filter(p =>
      patientFullName(p).toLowerCase().includes(q) ||
      (p.hospitalNumber || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [triagePatientSearch, patients, triagePatientId]);

  const selectedTriagePatient = useMemo(
    () => patients.find(p => p._id === triagePatientId) || null,
    [triagePatientId, patients]
  );

  // Load an already-saved triage back into the form for correction (behavior:
  // edit-saved-record). Uses updateTriage on the next save, keeping the id.
  const loadTriageForEdit = (ti: typeof triageHistory[number]) => {
    setEditingTriageId(ti._id);
    setTriagePatientId(ti.patientId);
    setTriagePatientSearch('');
    setTriageData({
      airway: (ti.airway as TriageResult['airway']) || '',
      breathing: (ti.breathing as TriageResult['breathing']) || '',
      circulation: (ti.circulation as TriageResult['circulation']) || '',
      consciousness: (ti.consciousness as TriageResult['consciousness']) || '',
      priority: (ti.priority as TriageResult['priority']) || '',
    });
    setTriageVitals({
      temperature: ti.temperature || '',
      pulse: ti.pulse || '',
      respiratoryRate: ti.respiratoryRate || '',
      systolic: ti.systolic || '',
      diastolic: ti.diastolic || '',
      oxygenSaturation: ti.oxygenSaturation || '',
      weight: ti.weight || '',
      painScore: ti.painScore || '',
      bloodGlucose: ti.bloodGlucose || '',
      gcs: ti.gcs || '',
      muac: ti.muac || '',
    });
    setTriageContext({
      modeOfArrival: (ti.modeOfArrival as typeof triageContext.modeOfArrival) || '',
      symptomDuration: ti.symptomDuration || '',
      referralSource: ti.referralSource || '',
      knownAllergies: ti.knownAllergies || '',
    });
    setTriageComplaint(ti.chiefComplaint || '');
    setTriageNotes(ti.notes || '');
  };

  // Disposition a triaged patient straight from the queue row — mark them seen,
  // admit, discharge, or refer onward — without re-opening the full form. Each
  // transition persists via updateTriage so the queue, ward acuity, and the
  // patient timeline stay consistent.
  const setTriageStatus = async (
    ti: typeof triageHistory[number],
    status: 'seen' | 'admitted' | 'discharged' | 'referred',
    label: string,
  ) => {
    try {
      await updateTriageRecord(ti._id, { status });
      showToast(t('nurse.triageStatusUpdated', { name: ti.patientName, status: label }), 'success');
    } catch {
      showToast(t('nurse.triageStatusFailed'), 'error');
    }
  };

  const triagePriorityColor = (priority: string) => {
    switch (priority) {
      case 'RED': return { bg: 'var(--color-danger)', text: '#FFF', label: t('nurse.priorityRedLabel') };
      case 'YELLOW': return { bg: 'var(--color-warning)', text: '#000', label: t('nurse.priorityYellowLabel') };
      case 'GREEN': return { bg: 'var(--color-success)', text: '#000', label: t('nurse.priorityGreenLabel') };
      default: return { bg: 'var(--text-muted)', text: '#FFF', label: t('nurse.priorityDefaultLabel') };
    }
  };

  const handleSubmitTriage = async () => {
    if (!selectedTriagePatient) {
      showToast(t('nurse.selectPatientFirst'), 'error');
      return;
    }
    // Require all four ABCC assessments explicitly (don't rely on the derived
    // priority happening to be truthy only when all four are set).
    if (!triageData.airway || !triageData.breathing || !triageData.circulation || !triageData.consciousness || !triageData.priority) {
      showToast(t('nurse.completeAbcc'), 'error');
      return;
    }
    // A valid triaging user is required so the audit trail is never blank.
    if (!currentUser?._id) {
      showToast(t('nurse.noActiveUser'), 'error');
      return;
    }
    // Validate any entered vitals are numeric and physiologically plausible,
    // so garbage strings ("abc", "999") are never persisted to the record.
    // Maps each triage form field to its key in the shared VITAL_RANGES table
    // (the form labels SpO₂ as `oxygenSaturation`; the shared table uses `spo2`).
    const vitalFieldMap: Record<keyof typeof triageVitals, keyof typeof VITAL_RANGES> = {
      temperature: 'temperature', pulse: 'pulse', respiratoryRate: 'respiratoryRate',
      systolic: 'systolic', diastolic: 'diastolic', oxygenSaturation: 'spo2', weight: 'weight',
      painScore: 'painScore', bloodGlucose: 'bloodGlucose', gcs: 'gcs', muac: 'muac',
    };
    for (const key of Object.keys(vitalFieldMap) as (keyof typeof triageVitals)[]) {
      if (!isVitalInRange(vitalFieldMap[key], triageVitals[key])) {
        showToast(t('nurse.invalidVital', { field: t(`nurse.vital_${key}`) }), 'error');
        return;
      }
    }
    try {
      setTriageSubmitting(true);
      const now = new Date().toISOString();
      // Shared field payload for both create and correct-an-existing-record paths.
      const payload = {
        airway: triageData.airway as 'clear' | 'obstructed',
        breathing: triageData.breathing as 'normal' | 'distressed' | 'absent',
        circulation: triageData.circulation as 'normal' | 'impaired' | 'absent',
        consciousness: triageData.consciousness as 'alert' | 'verbal' | 'pain' | 'unresponsive',
        priority: triageData.priority as 'RED' | 'YELLOW' | 'GREEN',
        temperature: triageVitals.temperature || undefined,
        pulse: triageVitals.pulse || undefined,
        respiratoryRate: triageVitals.respiratoryRate || undefined,
        systolic: triageVitals.systolic || undefined,
        diastolic: triageVitals.diastolic || undefined,
        oxygenSaturation: triageVitals.oxygenSaturation || undefined,
        weight: triageVitals.weight || undefined,
        painScore: triageVitals.painScore || undefined,
        bloodGlucose: triageVitals.bloodGlucose || undefined,
        gcs: triageVitals.gcs || undefined,
        muac: triageVitals.muac || undefined,
        modeOfArrival: triageContext.modeOfArrival || undefined,
        symptomDuration: triageContext.symptomDuration || undefined,
        referralSource: triageContext.referralSource || undefined,
        knownAllergies: triageContext.knownAllergies || undefined,
        chiefComplaint: triageComplaint || undefined,
        notes: triageNotes || undefined,
      };
      if (editingTriageId) {
        // Correct an already-saved record in place — keeps the same id so the
        // patient chart history points at one record, not a duplicate.
        await updateTriageRecord(editingTriageId, payload);
      } else {
        await createTriageRecord({
          patientId: selectedTriagePatient._id,
          patientName: patientFullName(selectedTriagePatient),
          hospitalNumber: selectedTriagePatient.hospitalNumber,
          ...payload,
          triagedBy: currentUser?._id || '',
          triagedByName: currentUser?.name || 'Unknown Nurse',
          triagedAt: now,
          facilityId: currentUser?.hospitalId,
          facilityName: currentUser?.hospitalName,
          orgId: currentUser?.orgId,
          status: 'pending',
        });
      }
      showToast(t('nurse.triageSaved', { priority: triageData.priority, name: patientFullName(selectedTriagePatient) }), 'success');
      // Reset form only on success
      setEditingTriageId(null);
      setTriageData({ airway: '', breathing: '', circulation: '', consciousness: '', priority: '' });
      setTriagePatientId('');
      setTriagePatientSearch('');
      setTriageVitals({ temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '', oxygenSaturation: '', weight: '', painScore: '', bloodGlucose: '', gcs: '', muac: '' });
      setTriageContext({ modeOfArrival: '', symptomDuration: '', referralSource: '', knownAllergies: '' });
      setTriageComplaint('');
      setTriageNotes('');
    } catch (err) {
      console.error(err);
      // Keep form data intact so the nurse can retry
      showToast(t('nurse.triageSaveFailed'), 'error');
    } finally {
      setTriageSubmitting(false);
    }
  };

  const histQ = historySearch.trim().toLowerCase();
  const filteredHistory = histQ
    ? triageHistory.filter(ti => (ti.patientName || '').toLowerCase().includes(histQ) || (ti.chiefComplaint || '').toLowerCase().includes(histQ))
    : triageHistory;

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ flex: 1, minHeight: 0 }}>
      {/* Left column: ETAT Assessment Form (2/3 width) */}
      <div className="lg:flex-[2] dash-card overflow-hidden flex flex-col" style={{ padding: '0', minHeight: 0 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: '#FB923C' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.etatTriageAssessment')}</h3>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {t('nurse.triageHeaderSummary', { today: triageHistory.filter(ti => (ti.triagedAt || '').startsWith(new Date().toISOString().slice(0, 10))).length, red: triageHistory.filter(ti => ti.priority === 'RED' && ti.status === 'pending').length })}
          </span>
        </div>
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Patient picker */}
          <div className="relative">
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nurse.patient')}</label>
            {selectedTriagePatient ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border, rgba(59, 130, 246,0.25))' }}>
                <div className="flex items-baseline gap-2 min-w-0">
                  <p className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                    {patientFullName(selectedTriagePatient)}
                  </p>
                  <p className="text-[11px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                    {selectedTriagePatient.hospitalNumber} · {patientGenderAge(selectedTriagePatient)}
                  </p>
                </div>
                <button onClick={() => { setTriagePatientId(''); setTriagePatientSearch(''); }} className="p-1.5 rounded-lg flex-shrink-0" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={triagePatientSearch}
                  onChange={e => setTriagePatientSearch(e.target.value)}
                  placeholder={t('nurse.searchPatientPlaceholder')}
                  className="w-full px-3 py-1 rounded-lg text-[10px]"
                  style={{
                    background: 'var(--overlay-subtle)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                  }}
                />
                {triagePatientMatches.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-10" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg)' }}>
                    {triagePatientMatches.map(p => (
                      <button
                        key={p._id}
                        onClick={() => { setTriagePatientId(p._id); setTriagePatientSearch(''); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--overlay-subtle)]"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                      >
                        <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{patientFullName(p)}</div>
                        <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.hospitalNumber} · {p.gender}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chief complaint */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nurse.chiefComplaint')}</label>
            <input
              type="text"
              value={triageComplaint}
              onChange={e => setTriageComplaint(e.target.value)}
              placeholder={t('nurse.chiefComplaintPlaceholder')}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* ABCC Assessment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Airway */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Wind className="w-4 h-4" style={{ color: '#2191D0' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.airway')}</span>
              </div>
              <div className="flex gap-2">
                {(['clear', 'obstructed'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setTriageData(prev => ({ ...prev, airway: prev.airway === opt ? '' : opt }))}
                    title={triageData.airway === opt ? t('action.deselect') : undefined}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: triageData.airway === opt
                        ? (opt === 'clear' ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)')
                        : 'var(--bg-card)',
                      color: triageData.airway === opt
                        ? (opt === 'clear' ? 'var(--color-success)' : 'var(--color-danger)')
                        : 'var(--text-secondary)',
                      border: `1px solid ${triageData.airway === opt
                        ? (opt === 'clear' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)')
                        : 'var(--border-light)'}`,
                    }}
                  >
                    {opt === 'clear' ? t('nurse.airwayClear') : t('nurse.airwayObstructed')}
                  </button>
                ))}
              </div>
            </div>

            {/* Breathing */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" style={{ color: '#A855F7' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.breathing')}</span>
              </div>
              <div className="flex gap-2">
                {(['normal', 'distressed', 'absent'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setTriageData(prev => ({ ...prev, breathing: prev.breathing === opt ? '' : opt }))}
                    title={triageData.breathing === opt ? t('action.deselect') : undefined}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: triageData.breathing === opt
                        ? (opt === 'normal' ? 'rgba(74,222,128,0.2)' : opt === 'distressed' ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)')
                        : 'var(--bg-card)',
                      color: triageData.breathing === opt
                        ? (opt === 'normal' ? 'var(--color-success)' : opt === 'distressed' ? 'var(--color-warning)' : 'var(--color-danger)')
                        : 'var(--text-secondary)',
                      border: `1px solid ${triageData.breathing === opt
                        ? (opt === 'normal' ? 'rgba(74,222,128,0.3)' : opt === 'distressed' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)')
                        : 'var(--border-light)'}`,
                    }}
                  >
                    {opt === 'normal' ? t('nurse.breathingNormal') : opt === 'distressed' ? t('nurse.breathingDistressed') : t('nurse.breathingAbsent')}
                  </button>
                ))}
              </div>
            </div>

            {/* Circulation */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4" style={{ color: '#EC4899' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.circulation')}</span>
              </div>
              <div className="flex gap-2">
                {(['normal', 'impaired', 'absent'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setTriageData(prev => ({ ...prev, circulation: prev.circulation === opt ? '' : opt }))}
                    title={triageData.circulation === opt ? t('action.deselect') : undefined}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: triageData.circulation === opt
                        ? (opt === 'normal' ? 'rgba(74,222,128,0.2)' : opt === 'impaired' ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)')
                        : 'var(--bg-card)',
                      color: triageData.circulation === opt
                        ? (opt === 'normal' ? 'var(--color-success)' : opt === 'impaired' ? 'var(--color-warning)' : 'var(--color-danger)')
                        : 'var(--text-secondary)',
                      border: `1px solid ${triageData.circulation === opt
                        ? (opt === 'normal' ? 'rgba(74,222,128,0.3)' : opt === 'impaired' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)')
                        : 'var(--border-light)'}`,
                    }}
                  >
                    {opt === 'normal' ? t('nurse.circulationNormal') : opt === 'impaired' ? t('nurse.circulationImpaired') : t('nurse.circulationAbsent')}
                  </button>
                ))}
              </div>
            </div>

            {/* Consciousness (AVPU) */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4" style={{ color: '#2191D0' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.consciousnessAvpu')}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 keep-cols">
                {([
                  { key: 'alert' as const, label: t('nurse.avpuAlert') },
                  { key: 'verbal' as const, label: t('nurse.avpuVerbal') },
                  { key: 'pain' as const, label: t('nurse.avpuPain') },
                  { key: 'unresponsive' as const, label: t('nurse.avpuUnresponsive') },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTriageData(prev => ({ ...prev, consciousness: prev.consciousness === opt.key ? '' : opt.key }))}
                    title={triageData.consciousness === opt.key ? t('action.deselect') : undefined}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: triageData.consciousness === opt.key
                        ? (opt.key === 'alert' ? 'rgba(74,222,128,0.2)' : opt.key === 'verbal' ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)')
                        : 'var(--bg-card)',
                      color: triageData.consciousness === opt.key
                        ? (opt.key === 'alert' ? 'var(--color-success)' : opt.key === 'verbal' ? 'var(--color-warning)' : 'var(--color-danger)')
                        : 'var(--text-secondary)',
                      border: `1px solid ${triageData.consciousness === opt.key
                        ? (opt.key === 'alert' ? 'rgba(74,222,128,0.3)' : opt.key === 'verbal' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)')
                        : 'var(--border-light)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Triage Result */}
          {triageData.priority && (
            <div
              className="p-4 rounded-2xl text-center transition-all"
              style={{
                background: triagePriorityColor(triageData.priority).bg,
                color: triagePriorityColor(triageData.priority).text,
              }}
            >
              <p className="text-base font-bold">{triagePriorityColor(triageData.priority).label}</p>
              {selectedTriagePatient && (
                <p className="text-xs mt-1 opacity-80">{t('nurse.patientLabel', { name: patientFullName(selectedTriagePatient) })}</p>
              )}
            </div>
          )}

          {/* Vitals at triage */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.vitalsAtTriage')}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.tempC')}</label>
                <input type="text" inputMode="decimal" value={triageVitals.temperature} onChange={e => setTriageVitals({ ...triageVitals, temperature: e.target.value })} placeholder="37.0" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.pulse')}</label>
                <input type="text" inputMode="numeric" value={triageVitals.pulse} onChange={e => setTriageVitals({ ...triageVitals, pulse: e.target.value })} placeholder="80" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.rr')}</label>
                <input type="text" inputMode="numeric" value={triageVitals.respiratoryRate} onChange={e => setTriageVitals({ ...triageVitals, respiratoryRate: e.target.value })} placeholder="18" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.spo2Pct')}</label>
                <input type="text" inputMode="numeric" value={triageVitals.oxygenSaturation} onChange={e => setTriageVitals({ ...triageVitals, oxygenSaturation: e.target.value })} placeholder="98" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.sysBp')}</label>
                <input type="text" inputMode="numeric" value={triageVitals.systolic} onChange={e => setTriageVitals({ ...triageVitals, systolic: e.target.value })} placeholder="120" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.diaBp')}</label>
                <input type="text" inputMode="numeric" value={triageVitals.diastolic} onChange={e => setTriageVitals({ ...triageVitals, diastolic: e.target.value })} placeholder="80" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.weightKg')}</label>
                <input type="text" inputMode="decimal" value={triageVitals.weight} onChange={e => setTriageVitals({ ...triageVitals, weight: e.target.value })} placeholder="65" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.painScore')}</label>
                <input type="text" inputMode="numeric" value={triageVitals.painScore} onChange={e => setTriageVitals({ ...triageVitals, painScore: e.target.value })} placeholder="0" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.bloodGlucose')}</label>
                <input type="text" inputMode="decimal" value={triageVitals.bloodGlucose} onChange={e => setTriageVitals({ ...triageVitals, bloodGlucose: e.target.value })} placeholder="5.5" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.gcs')}</label>
                <input type="text" inputMode="numeric" value={triageVitals.gcs} onChange={e => setTriageVitals({ ...triageVitals, gcs: e.target.value })} placeholder="15" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.muac')}</label>
                <input type="text" inputMode="decimal" value={triageVitals.muac} onChange={e => setTriageVitals({ ...triageVitals, muac: e.target.value })} placeholder="23.5" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          </div>

          {/* Triage context */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.triageContext')}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.modeOfArrival')}</label>
                <select value={triageContext.modeOfArrival} onChange={e => setTriageContext({ ...triageContext, modeOfArrival: e.target.value as typeof triageContext.modeOfArrival })} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                  <option value="">{t('nurse.modeSelectPlaceholder')}</option>
                  <option value="walk-in">{t('nurse.modeWalkIn')}</option>
                  <option value="ambulance">{t('nurse.modeAmbulance')}</option>
                  <option value="referral">{t('nurse.modeReferral')}</option>
                  <option value="police">{t('nurse.modePolice')}</option>
                  <option value="other">{t('nurse.modeOther')}</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.symptomDuration')}</label>
                <input type="text" value={triageContext.symptomDuration} onChange={e => setTriageContext({ ...triageContext, symptomDuration: e.target.value })} placeholder={t('nurse.symptomDurationPlaceholder')} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.referralSource')}</label>
                <input type="text" value={triageContext.referralSource} onChange={e => setTriageContext({ ...triageContext, referralSource: e.target.value })} placeholder={t('nurse.referralSourcePlaceholder')} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>{t('nurse.knownAllergies')}</label>
                <input type="text" value={triageContext.knownAllergies} onChange={e => setTriageContext({ ...triageContext, knownAllergies: e.target.value })} placeholder={t('nurse.knownAllergiesPlaceholder')} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>{t('nurse.notesOptional')}</label>
            <textarea
              rows={2}
              value={triageNotes}
              onChange={e => setTriageNotes(e.target.value)}
              placeholder={t('nurse.additionalObservations')}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Editing-an-existing-record banner — makes it clear the next save
              corrects a saved triage rather than creating a new one. */}
          {editingTriageId && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border, rgba(33,145,208,0.25))' }}>
              <span className="text-[11px] font-semibold" style={{ color: ACCENT }}>{t('action.edit')}</span>
              <button
                onClick={() => {
                  setEditingTriageId(null);
                  setTriageData({ airway: '', breathing: '', circulation: '', consciousness: '', priority: '' });
                  setTriagePatientId('');
                  setTriagePatientSearch('');
                  setTriageVitals({ temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '', oxygenSaturation: '', weight: '', painScore: '', bloodGlucose: '', gcs: '', muac: '' });
                  setTriageContext({ modeOfArrival: '', symptomDuration: '', referralSource: '', knownAllergies: '' });
                  setTriageComplaint('');
                  setTriageNotes('');
                }}
                className="text-[10px] font-semibold inline-flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-3 h-3" /> {t('action.cancel')}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingTriageId(null);
                setTriageData({ airway: '', breathing: '', circulation: '', consciousness: '', priority: '' });
                setTriagePatientId('');
                setTriagePatientSearch('');
                setTriageVitals({ temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '', oxygenSaturation: '', weight: '', painScore: '', bloodGlucose: '', gcs: '', muac: '' });
                setTriageContext({ modeOfArrival: '', symptomDuration: '', referralSource: '', knownAllergies: '' });
                setTriageComplaint('');
                setTriageNotes('');
              }}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--overlay-subtle)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}
              disabled={triageSubmitting}
            >
              {t('nurse.reset')}
            </button>
            <button
              onClick={handleSubmitTriage}
              disabled={triageSubmitting || !triageData.priority || !selectedTriagePatient}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all btn btn-primary"
            >
              {triageSubmitting ? t('nurse.saving') : editingTriageId ? t('action.saveChanges') : t('nurse.saveTriage')}
            </button>
          </div>
        </div>
      </div>

      {/* Right column: Recent Triages List (1/3 width) */}
      <div className="lg:flex-[1] card-elevated overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: ACCENT }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.recentTriages')}</h3>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.total', { count: triageHistory.length })}</span>
        </div>
        <div className="px-3 py-2.5 flex items-center border-b" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <ListSearch value={historySearch} onChange={setHistorySearch} placeholder={t('nurse.searchPatientPlaceholder')} />
        </div>
        <div className="p-3 flex-1 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>{t('nurse.noTriages')}</p>
          ) : (
            <div className="space-y-2">
              {filteredHistory.slice(0, 12).map(ti => {
                const timeAgo = (() => {
                  try {
                    const mins = Math.floor((Date.now() - new Date(ti.triagedAt).getTime()) / 60000);
                    if (mins < 1) return t('nurse.justNow');
                    if (mins < 60) return t('nurse.minsAgo', { mins });
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return t('nurse.hrsAgo', { hrs });
                    return t('nurse.daysAgo', { days: Math.floor(hrs / 24) });
                  } catch { return ''; }
                })();
                return (
                  <div
                    key={ti._id}
                    className="flex items-center gap-2 p-2 rounded-xl"
                    style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
                  >
                    <button className="flex-1 min-w-0 text-left" onClick={() => router.push(`/patients/${ti.patientId}`)} title={t('nurse.viewPatientRecord')}>
                      <p className="text-[11px] font-semibold truncate hover:underline" style={{ color: 'var(--text-primary)' }}>{ti.patientName}</p>
                      <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {ti.chiefComplaint || t('nurse.noComplaintRecorded')} · {timeAgo}
                      </p>
                    </button>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: ti.status === 'pending' ? 'rgba(252,211,77,0.12)' : ti.status === 'seen' ? 'rgba(92,184,168,0.12)' : 'rgba(31, 157, 111,0.12)', color: ti.status === 'pending' ? 'var(--color-warning)' : ti.status === 'seen' ? '#2191D0' : 'var(--color-success)' }}>
                        {ti.status}
                      </span>
                      {(() => {
                        const actions: RowAction[] = [
                          { key: 'view', label: t('nurse.triageActionView'), icon: <Eye />, onClick: () => router.push(`/patients/${ti.patientId}`) },
                          { key: 'edit', label: t('action.edit'), icon: <ClipboardList />, onClick: () => loadTriageForEdit(ti) },
                        ];
                        if (ti.status !== 'seen' && ti.status !== 'discharged' && ti.status !== 'admitted') {
                          actions.push({ key: 'seen', label: t('nurse.triageActionMarkSeen'), tone: 'success', icon: <CheckCircle2 />, onClick: () => setTriageStatus(ti, 'seen', t('nurse.triageActionMarkSeen')) });
                        }
                        if (ti.status !== 'admitted') {
                          actions.push({ key: 'admit', label: t('nurse.triageActionAdmit'), icon: <LogIn />, onClick: () => setTriageStatus(ti, 'admitted', t('nurse.triageActionAdmit')) });
                        }
                        if (ti.status !== 'referred') {
                          actions.push({ key: 'refer', label: t('nurse.triageActionRefer'), icon: <Send />, onClick: () => setTriageStatus(ti, 'referred', t('nurse.triageActionRefer')) });
                        }
                        if (ti.status !== 'discharged') {
                          actions.push({ key: 'discharge', label: t('nurse.triageActionDischarge'), tone: 'danger', icon: <LogOut />, onClick: () => setTriageStatus(ti, 'discharged', t('nurse.triageActionDischarge')) });
                        }
                        return <RowActionsMenu ariaLabel={t('nurse.colActions')} actions={actions} />;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
