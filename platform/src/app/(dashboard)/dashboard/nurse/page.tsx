'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import { useToast } from '@/components/Toast';
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import PatientName from '@/components/PatientName';
import { patientFullName, patientGenderAge } from '@/lib/patient-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Activity, Pill, Clock,
  ChevronRight, Thermometer,
  Stethoscope, FileText, BedDouble, AlertCircle,
  Shield, X, Check, Printer, Search,
  AlertTriangle, ArrowUpDown, Wind, Eye, Brain, Heart
} from '@/components/icons/lucide';

// ============================================================
// Types
// ============================================================

interface VitalsFormData {
  systolic: string;
  diastolic: string;
  temperature: string;
  pulse: string;
  spo2: string;
  weight: string;
  respiratoryRate: string;
  notes: string;
}

interface MAREntry {
  id: string;
  time: string;
  patientId: string;
  patientName: string;
  medication: string;
  dose: string;
  route: string;
  status: 'overdue' | 'due' | 'upcoming' | 'given';
  givenAt?: string;
}

interface TriageResult {
  airway: 'clear' | 'obstructed' | '';
  breathing: 'normal' | 'distressed' | 'absent' | '';
  circulation: 'normal' | 'impaired' | 'absent' | '';
  consciousness: 'alert' | 'verbal' | 'pain' | 'unresponsive' | '';
  priority: 'RED' | 'YELLOW' | 'GREEN' | '';
}

// Demo mode gates the seeded ward roster so the board is never empty during a
// walkthrough. (The old live "Care Feed" ticker has been removed app-wide.)
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const MEDICATIONS = [
  { name: 'Amoxicillin', dose: '500mg', route: 'Oral' },
  { name: 'Paracetamol', dose: '1g', route: 'Oral' },
  { name: 'Metronidazole', dose: '400mg', route: 'Oral' },
  { name: 'Artesunate', dose: '120mg', route: 'IV' },
  { name: 'Ceftriaxone', dose: '1g', route: 'IM' },
  { name: 'ORS', dose: '1 sachet', route: 'Oral' },
  { name: 'Zinc', dose: '20mg', route: 'Oral' },
  { name: 'Ampicillin', dose: '500mg', route: 'IV' },
  { name: 'Gentamicin', dose: '80mg', route: 'IM' },
  { name: 'Iron/Folate', dose: '200mg/0.4mg', route: 'Oral' },
];

// A ward-board row. Real patient docs are structurally compatible with the
// fields used here; demo rows (below) carry their triage inline via `_triage`.
type WardRow = {
  _id: string;
  firstName: string;
  surname: string;
  hospitalNumber: string;
  gender: string;
  estimatedAge?: number;
  dateOfBirth?: string;
  assignedDoctor?: string;
  assignedDoctorName?: string;
  _demo?: boolean;
  _triage?: { priority: 'RED' | 'YELLOW' | 'GREEN'; chiefComplaint: string; status: string };
};

// Demo ward roster — shown only in demo mode when the facility has fewer than
// 10 seeded patients, so the ward board is never empty during a walkthrough.
// These are display-only rows: charting/triage/assign actions are suppressed.
const DEMO_WARD_PATIENTS: WardRow[] = [
  { firstName: 'Deng', surname: 'Mabior', gender: 'Male', age: 34, hn: 'WRD-1042', priority: 'RED', complaint: 'Severe malaria, high fever', status: 'pending' },
  { firstName: 'Achol', surname: 'Mayen', gender: 'Female', age: 27, hn: 'WRD-1043', priority: 'RED', complaint: 'Postpartum haemorrhage', status: 'pending' },
  { firstName: 'Nyamal', surname: 'Koang', gender: 'Female', age: 19, hn: 'WRD-1044', priority: 'YELLOW', complaint: 'Obstructed labour — monitoring', status: 'seen' },
  { firstName: 'Gatluak', surname: 'Ruot', gender: 'Male', age: 45, hn: 'WRD-1045', priority: 'YELLOW', complaint: 'Pneumonia, on IV antibiotics', status: 'seen' },
  { firstName: 'Ayen', surname: 'Dut', gender: 'Female', age: 31, hn: 'WRD-1046', priority: 'YELLOW', complaint: 'Dehydration from diarrhoea', status: 'pending' },
  { firstName: 'Kuol', surname: 'Akot', gender: 'Male', age: 8, hn: 'WRD-1047', priority: 'GREEN', complaint: 'Minor laceration, dressed', status: 'admitted' },
  { firstName: 'Rose', surname: 'Gbudue', gender: 'Female', age: 52, hn: 'WRD-1048', priority: 'GREEN', complaint: 'Hypertension review', status: 'seen' },
  { firstName: 'Majok', surname: 'Chol', gender: 'Male', age: 60, hn: 'WRD-1049', priority: 'YELLOW', complaint: 'Diabetic foot, wound care', status: 'admitted' },
  { firstName: 'Nyandit', surname: 'Dut', gender: 'Female', age: 24, hn: 'WRD-1050', priority: 'GREEN', complaint: 'ANC routine check', status: 'seen' },
  { firstName: 'Garang', surname: 'Makuei', gender: 'Male', age: 38, hn: 'WRD-1051', priority: 'GREEN', complaint: 'Typhoid, recovering', status: 'admitted' },
  { firstName: 'Awut', surname: 'Deng', gender: 'Female', age: 5, hn: 'WRD-1052', priority: 'YELLOW', complaint: 'Acute respiratory infection', status: 'pending' },
  { firstName: 'Tut', surname: 'Chuol', gender: 'Male', age: 29, hn: 'WRD-1053', priority: 'GREEN', complaint: 'Fracture follow-up', status: 'discharged' },
].map((d, i) => ({
  _id: `demo-ward-${i}`,
  firstName: d.firstName,
  surname: d.surname,
  hospitalNumber: d.hn,
  gender: d.gender,
  estimatedAge: d.age,
  _demo: true,
  _triage: { priority: d.priority as 'RED' | 'YELLOW' | 'GREEN', chiefComplaint: d.complaint, status: d.status },
}));

const ACCENT = 'var(--accent-primary)';

// ============================================================
// Helper: Flag abnormal vitals
// ============================================================
function getVitalFlags(data: VitalsFormData): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  const temp = parseFloat(data.temperature);
  const sys = parseInt(data.systolic);
  const dia = parseInt(data.diastolic);
  const spo2 = parseInt(data.spo2);
  const pulse = parseInt(data.pulse);
  const rr = parseInt(data.respiratoryRate);

  if (!isNaN(temp) && temp > 38.5) flags.temperature = true;
  if (!isNaN(sys) && (sys > 140 || sys < 90)) flags.systolic = true;
  if (!isNaN(dia) && (dia > 90 || dia < 60)) flags.diastolic = true;
  if (!isNaN(spo2) && spo2 < 95) flags.spo2 = true;
  if (!isNaN(pulse) && (pulse > 100 || pulse < 50)) flags.pulse = true;
  if (!isNaN(rr) && (rr > 24 || rr < 12)) flags.respiratoryRate = true;

  return flags;
}

// ============================================================
// Helper: Calculate ETAT triage priority
// ============================================================
function calculateTriagePriority(triage: TriageResult): 'RED' | 'YELLOW' | 'GREEN' | '' {
  if (!triage.airway || !triage.breathing || !triage.circulation || !triage.consciousness) return '';

  if (
    triage.airway === 'obstructed' ||
    triage.breathing === 'absent' ||
    triage.circulation === 'absent' ||
    triage.consciousness === 'unresponsive'
  ) return 'RED';

  if (
    triage.breathing === 'distressed' ||
    triage.circulation === 'impaired' ||
    triage.consciousness === 'pain' ||
    triage.consciousness === 'verbal'
  ) return 'YELLOW';

  return 'GREEN';
}

// ============================================================
// Main Component
// ============================================================
export default function NurseDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser, globalSearch } = useApp();
  const { patients, reload } = usePatients();

  // Feature states
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsPatient, setVitalsPatient] = useState<{ id: string; name: string } | null>(null);
  const [vitalsForm, setVitalsForm] = useState<VitalsFormData>({
    systolic: '', diastolic: '', temperature: '', pulse: '', spo2: '', weight: '', respiratoryRate: '', notes: '',
  });
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [vitalsSaved, setVitalsSaved] = useState(false);

  const [activeTab, setActiveTab] = useState<'ward' | 'mar' | 'triage'>('ward');

  // Local search for the ward patient table (mirrors the search pattern used
  // elsewhere in the nurse views).
  const [wardSearch, setWardSearch] = useState('');

  const [marEntries, setMarEntries] = useState<MAREntry[]>([]);

  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffNotes, setHandoffNotes] = useState('');

  const [triageData, setTriageData] = useState<TriageResult>({
    airway: '', breathing: '', circulation: '', consciousness: '', priority: '',
  });
  // Triage is now tied to a real patient, not a free-text name.
  const [triagePatientId, setTriagePatientId] = useState('');
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);
  const [triagePatientSearch, setTriagePatientSearch] = useState('');
  const [triageVitals, setTriageVitals] = useState({
    temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '',
    oxygenSaturation: '', weight: '',
  });
  const [triageComplaint, setTriageComplaint] = useState('');
  const [triageNotes, setTriageNotes] = useState('');
  const [triageSubmitting, setTriageSubmitting] = useState(false);

  // Persistent triage queue + history from PouchDB
  const { triages: triageHistory, create: createTriageRecord } = useTriage();
  const { showToast } = useToast();

  const triagePatientMatches = useMemo(() => {
    const q = triagePatientSearch.trim().toLowerCase();
    if (q.length < 2 || triagePatientId) return [];
    return patients.filter(p =>
      `${p.firstName} ${p.surname}`.toLowerCase().includes(q) ||
      (p.hospitalNumber || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [triagePatientSearch, patients, triagePatientId]);

  const selectedTriagePatient = useMemo(
    () => patients.find(p => p._id === triagePatientId) || null,
    [triagePatientId, patients]
  );

  const handleSubmitTriage = async () => {
    if (!selectedTriagePatient) {
      showToast(t('nurse.selectPatientFirst'), 'error');
      return;
    }
    if (!triageData.priority) {
      showToast(t('nurse.completeAbcc'), 'error');
      return;
    }
    try {
      setTriageSubmitting(true);
      const now = new Date().toISOString();
      await createTriageRecord({
        patientId: selectedTriagePatient._id,
        patientName: `${selectedTriagePatient.firstName} ${selectedTriagePatient.surname}`,
        hospitalNumber: selectedTriagePatient.hospitalNumber,
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
        chiefComplaint: triageComplaint || undefined,
        notes: triageNotes || undefined,
        triagedBy: currentUser?._id || '',
        triagedByName: currentUser?.name || 'Unknown Nurse',
        triagedAt: now,
        facilityId: currentUser?.hospitalId,
        facilityName: currentUser?.hospitalName,
        orgId: currentUser?.orgId,
        status: 'pending',
      });
      showToast(t('nurse.triageSaved', { priority: triageData.priority, name: `${selectedTriagePatient.firstName} ${selectedTriagePatient.surname}` }), 'success');
      // Reset form only on success
      setTriageData({ airway: '', breathing: '', circulation: '', consciousness: '', priority: '' });
      setTriagePatientId('');
      setTriagePatientSearch('');
      setTriageVitals({ temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '', oxygenSaturation: '', weight: '' });
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

  // Sort mode for task prioritization
  const [sortByUrgency, setSortByUrgency] = useState(true);

  // Generate MAR entries from patient data
  useEffect(() => {
    if (patients.length === 0) return;
    const now = new Date();
    const entries: MAREntry[] = [];
    const scheduleHours = [-2, -1, 0, 1, 2, 3, 4];

    patients.slice(0, 6).forEach((patient, pIdx) => {
      const medCount = 1 + (pIdx % 3);
      for (let m = 0; m < medCount; m++) {
        const med = MEDICATIONS[(pIdx * 3 + m) % MEDICATIONS.length];
        const hourOffset = scheduleHours[(pIdx + m) % scheduleHours.length];
        const schedTime = new Date(now.getTime() + hourOffset * 60 * 60 * 1000);
        let status: MAREntry['status'];
        if (hourOffset < -1) status = 'overdue';
        else if (hourOffset >= -1 && hourOffset <= 0) status = 'due';
        else status = 'upcoming';

        entries.push({
          id: `mar-${patient._id}-${m}`,
          time: schedTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          patientId: patient._id,
          patientName: `${patient.firstName} ${patient.surname}`,
          medication: med.name,
          dose: med.dose,
          route: med.route,
          status,
        });
      }
    });

    // Sort: overdue first, then due, then upcoming, then given
    const order = { overdue: 0, due: 1, upcoming: 2, given: 3 };
    entries.sort((a, b) => order[a.status] - order[b.status]);
    setMarEntries(entries);
  }, [patients]);

  // Triage auto-calculate
  useEffect(() => {
    const priority = calculateTriagePriority(triageData);
    if (priority !== triageData.priority) {
      setTriageData(prev => ({ ...prev, priority }));
    }
  }, [triageData]);

  // Map patient IDs to their most recent triage for sorting and display
  const patientTriageMap = useMemo(() => {
    const map = new Map<string, typeof triageHistory[0]>();
    for (const t of triageHistory) {
      if (!map.has(t.patientId)) map.set(t.patientId, t);
    }
    return map;
  }, [triageHistory]);

  // Ward patients with priority sorting using REAL triage data. When the
  // facility has fewer than 10 seeded patients (demo mode), fall back to the
  // demo roster so the ward board always shows a realistic, full list.
  const wardPatients = useMemo<WardRow[]>(() => {
    const realRows: WardRow[] = patients.slice(0, 12);
    const base: WardRow[] = (realRows.length >= 10 || !IS_DEMO) ? realRows : DEMO_WARD_PATIENTS;

    const q = (wardSearch || globalSearch || '').toLowerCase();
    const filtered = base.filter(p =>
      !q || `${p.firstName} ${p.surname}`.toLowerCase().includes(q) || p.hospitalNumber.toLowerCase().includes(q)
    );

    if (!sortByUrgency) return filtered;

    const priorityOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
    const priorityOf = (p: WardRow) => patientTriageMap.get(p._id)?.priority ?? p._triage?.priority;
    return [...filtered].sort((a, b) => {
      const ap = priorityOf(a);
      const bp = priorityOf(b);
      return (ap ? (priorityOrder[ap] ?? 3) : 3) - (bp ? (priorityOrder[bp] ?? 3) : 3);
    });
  }, [patients, globalSearch, wardSearch, sortByUrgency, patientTriageMap]);

  // Save vitals to PouchDB
  const handleSaveVitals = async () => {
    if (!vitalsPatient) return;
    // Validate vitals before saving
    const { validateVitalSigns } = await import('@/lib/validation');
    const vitalErrors = validateVitalSigns({
      temperature: vitalsForm.temperature || undefined,
      systolicBP: vitalsForm.systolic || undefined,
      diastolicBP: vitalsForm.diastolic || undefined,
      pulse: vitalsForm.pulse || undefined,
      respiratoryRate: vitalsForm.respiratoryRate || undefined,
      oxygenSaturation: vitalsForm.spo2 || undefined,
      weight: vitalsForm.weight || undefined,
    });
    if (Object.keys(vitalErrors).length > 0) {
      showToast(Object.values(vitalErrors)[0], 'error');
      return;
    }
    setVitalsSaving(true);
    try {
      const { getDB } = await import('@/lib/db');
      const db = getDB('tamamhealth_vitals');
      await db.put({
        _id: `vitals-${vitalsPatient.id}-${Date.now()}`,
        type: 'vitals',
        patientId: vitalsPatient.id,
        patientName: vitalsPatient.name,
        systolic: parseInt(vitalsForm.systolic) || null,
        diastolic: parseInt(vitalsForm.diastolic) || null,
        temperature: parseFloat(vitalsForm.temperature) || null,
        pulse: parseInt(vitalsForm.pulse) || null,
        spo2: parseInt(vitalsForm.spo2) || null,
        weight: parseFloat(vitalsForm.weight) || null,
        respiratoryRate: parseInt(vitalsForm.respiratoryRate) || null,
        notes: vitalsForm.notes,
        flags: getVitalFlags(vitalsForm),
        recordedBy: currentUser?.name || '',
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setVitalsSaved(true);
      setTimeout(() => {
        setVitalsSaved(false);
        setVitalsModalOpen(false);
        setVitalsForm({ systolic: '', diastolic: '', temperature: '', pulse: '', spo2: '', weight: '', respiratoryRate: '', notes: '' });
      }, 1500);
    } catch (err) {
      console.error('Failed to save vitals:', err);
    } finally {
      setVitalsSaving(false);
    }
  };

  // MAR: mark medication as given — persists to PouchDB
  const handleMarkGiven = async (entryId: string) => {
    const now = new Date().toISOString();
    // Optimistic UI update
    setMarEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, status: 'given' as const, givenAt: now } : e
    ));
    // Persist to DB if entryId maps to a real prescription
    try {
      if (entryId.startsWith('mar-')) {
        // MAR entries are derived from patients, not real prescriptions yet.
        // Log the administration for audit trail.
        const entry = marEntries.find(e => e.id === entryId);
        const { logAudit } = await import('@/lib/services/audit-service');
        await logAudit(
          'MEDICATION_ADMINISTERED',
          currentUser?._id,
          currentUser?.name,
          `Administered ${entry?.medication || 'medication'} ${entry?.dose || ''} to ${entry?.patientName || 'patient'}`
        );
      } else {
        // Real prescription ID — dispense it
        const { dispensePrescription } = await import('@/lib/services/prescription-service');
        await dispensePrescription(entryId, currentUser?.name);
      }
      showToast(t('nurse.medicationGivenToast'), 'success');
    } catch (err) {
      console.error('Failed to persist medication given:', err);
      showToast(t('nurse.medicationGivenFailedToast'), 'error');
    }
  };

  if (!currentUser) return null;

  const hospital = currentUser.hospital;
  const todayDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const displayName = currentUser.name.split(' ')[1] || currentUser.name.split(' ')[0];
  const hr = new Date().getHours();
  const greeting = hr < 12 ? t('nurse.greetingMorning') : hr < 17 ? t('nurse.greetingAfternoon') : t('nurse.greetingEvening');
  // Vitals-due count drives the shift-handoff task list. In demo mode we
  // synthesize a plausible workload from the seeded patient list so it never
  // reads zero against a non-empty ward.
  const vitalsDue = IS_DEMO ? Math.max(4, Math.floor(patients.length * 0.3)) : 0;
  const vitalFlags = getVitalFlags(vitalsForm);

  // Handoff data — critical = RED triage priority (real or demo).
  const criticalPatients = wardPatients.filter(p =>
    (patientTriageMap.get(p._id)?.priority ?? p._triage?.priority) === 'RED'
  );
  const overdueMarCount = marEntries.filter(e => e.status === 'overdue').length;
  const dueMarCount = marEntries.filter(e => e.status === 'due').length;

  // MAR color helper
  const marStatusColor = (status: MAREntry['status']) => {
    switch (status) {
      case 'overdue': return { bg: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', label: t('nurse.marOverdue') };
      case 'due': return { bg: 'rgba(251,191,36,0.12)', color: 'var(--color-warning)', label: t('nurse.marDueNow') };
      case 'upcoming': return { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)', label: t('nurse.marUpcoming') };
      case 'given': return { bg: 'rgba(74,222,128,0.12)', color: 'var(--color-success)', label: t('nurse.marGiven') };
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

  // Quick actions double as the view switcher (the old tabs). Defined once and
  // reused: as a right-hand card on the ward view, and as a top bar on the
  // MAR/triage views so navigation is always reachable.
  const quickActions = [
    { key: 'ward', label: t('nurse.tabWard'), icon: BedDouble, color: 'var(--color-success)', bg: 'rgba(27,158,119,0.10)', onClick: () => setActiveTab('ward') },
    { key: 'mar', label: t('nurse.tabMar'), icon: Pill, color: '#2563EB', bg: 'rgba(37,99,235,0.10)', onClick: () => setActiveTab('mar') },
    { key: 'triage', label: t('nurse.tabTriage'), icon: AlertTriangle, color: '#FB923C', bg: 'rgba(251,146,60,0.10)', onClick: () => setActiveTab('triage') },
    { key: 'handoff', label: t('nurse.shiftHandoff'), icon: FileText, color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246,0.10)', onClick: () => setHandoffOpen(true) },
  ];
  const quickActionButton = (a: typeof quickActions[number]) => {
    const isCurrent = a.key === activeTab;
    return (
      <button
        key={a.key}
        onClick={a.onClick}
        className="flex flex-col items-center justify-center text-center gap-2 p-3 rounded-xl transition-all hover:shadow-sm hover:-translate-y-0.5"
        style={{
          background: a.bg,
          border: `1px solid ${isCurrent ? a.color : 'var(--border-light)'}`,
          boxShadow: isCurrent ? `0 0 0 1px ${a.color}` : undefined,
        }}
      >
        <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card-solid)' }}>
          <a.icon className="w-[18px] h-[18px]" style={{ color: a.color }} />
        </span>
        <span className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
      </button>
    );
  };

  return (
    <>
      <TopBar title={t('nurse.title')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* COMMAND CENTER HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: 'var(--accent-primary)',
            }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {t('nurse.greeting', { greeting, name: displayName })}
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {todayDate} · {hospital?.name || currentUser.hospitalName || ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Shift Handoff Button */}
            <button
              onClick={() => setHandoffOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--accent-light)',
                color: ACCENT,
                border: `1px solid var(--accent-border, rgba(59, 130, 246,0.2))`,
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              {t('nurse.shiftHandoff')}
            </button>
          </div>
        </div>

        {/* QUICK ACTIONS bar — shown on the MAR/Triage views so navigation back
            to the ward is always reachable. On the ward view the quick actions
            sit on the right of the status row instead (see below). */}
        {activeTab !== 'ward' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {quickActions.map(quickActionButton)}
          </div>
        )}

        {/* ═══ TAB: WARD PATIENTS ═══ */}
        {activeTab === 'ward' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Ward Patient Table — moved below the triage/medication panels (order: 1) */}
            <div className="dash-card mb-4 overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0, padding: '0', order: 1 }}>
              <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4" style={{ color: ACCENT }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.wardPatients')}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {/* Ward patient search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="search"
                      value={wardSearch}
                      onChange={(e) => setWardSearch(e.target.value)}
                      placeholder={t('nurse.searchPatientPlaceholder')}
                      className="pl-8 pr-3 py-1.5 rounded-lg text-[11px]"
                      style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', width: '190px' }}
                    />
                  </div>
                  <button
                    onClick={() => setSortByUrgency(!sortByUrgency)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: sortByUrgency ? 'rgba(248,113,113,0.1)' : 'var(--overlay-subtle)',
                      color: sortByUrgency ? '#F87171' : 'var(--text-muted)',
                      border: `1px solid ${sortByUrgency ? 'rgba(248,113,113,0.2)' : 'var(--border-light)'}`,
                    }}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {sortByUrgency ? t('nurse.byUrgency') : t('nurse.sort')}
                  </button>
                  <button onClick={() => router.push('/patients')} className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: ACCENT }}>
                    {t('nurse.viewAll')} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <table className="w-full">
                  <thead>
                    <tr>
                      {[t('nurse.colPatientName'), t('nurse.colId'), t('nurse.colGenderAge'), t('nurse.colChiefComplaint'), t('nurse.colStatus'), t('nurse.colActions')].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wardPatients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          {t('patients.patientsFound', { count: 0 })}
                        </td>
                      </tr>
                    )}
                    {wardPatients.map((patient) => {
                      const realTriage = patientTriageMap.get(patient._id);
                      const triage = realTriage || patient._triage;
                      const triagePriority = triage?.priority;
                      const triageStatus = triage?.status || 'none';
                      const isRed = triagePriority === 'RED';
                      return (
                        <tr
                          key={patient._id}
                          onClick={() => { if (!patient._demo) router.push(`/patients/${patient._id}`); }}
                          className="transition-colors hover:bg-[var(--table-row-hover)]"
                          style={{
                            borderBottom: '1px solid var(--border-light)',
                            background: isRed ? 'rgba(196,69,54,0.04)' : 'transparent',
                            cursor: patient._demo ? 'default' : 'pointer',
                          }}
                        >
                          <td className="px-4 py-2.5">
                            {patient._demo ? (
                              <PatientName patient={patient} size={28} nameClassName="text-[12px]" />
                            ) : (
                              <button onClick={() => router.push(`/patients/${patient._id}`)} className="text-left hover:opacity-80">
                                <PatientName patient={patient} size={28} nameClassName="text-[12px]" />
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>{patient.hospitalNumber}</td>
                          <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            {patientGenderAge(patient)}
                          </td>
                          <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            {triage?.chiefComplaint || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {triageStatus === 'pending' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(252,211,77,0.15)', color: 'var(--color-warning)' }}>{t('nurse.statusWaiting')}</span>
                            )}
                            {triageStatus === 'seen' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(92,184,168,0.15)', color: '#2563EB' }}>{t('nurse.statusInConsult')}</span>
                            )}
                            {(triageStatus === 'discharged' || triageStatus === 'admitted') && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,222,128,0.15)', color: 'var(--color-success)' }}>{triageStatus.toUpperCase()}</span>
                            )}
                            {triageStatus === 'none' && !triagePriority && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>{t('nurse.statusNotTriaged')}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVitalsPatient({ id: patient._id, name: `${patient.firstName} ${patient.surname}` });
                                  setVitalsForm({ systolic: '', diastolic: '', temperature: '', pulse: '', spo2: '', weight: '', respiratoryRate: '', notes: '' });
                                  setVitalsSaved(false);
                                  setVitalsModalOpen(true);
                                }}
                                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                                style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}
                                title={t('nurse.recordVitalsTitle')}
                              >
                                <Thermometer className="w-3.5 h-3.5" />
                              </button>
                              {!patient._demo && (!triage || triageStatus === 'none') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab('triage');
                                    setTriagePatientId(patient._id);
                                  }}
                                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                                  style={{ background: 'rgba(251,146,60,0.12)', color: '#FB923C' }}
                                  title={t('nurse.startTriage')}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {!patient._demo && triageStatus === 'pending' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssignTarget({
                                      patientId: patient._id,
                                      patientName: `${patient.firstName} ${patient.surname}`,
                                      hospitalNumber: patient.hospitalNumber,
                                      triageId: realTriage?._id,
                                      currentDoctorId: patient.assignedDoctor,
                                    });
                                  }}
                                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                                  style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--color-success)' }}
                                  title={patient.assignedDoctor ? `Assigned to ${patient.assignedDoctorName ?? 'doctor'} — reassign` : 'Assign to doctor'}
                                >
                                  <Stethoscope className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Triage Queue + Medication Status + Quick Actions — three panels in
                one line, with Quick Actions on the right (order: 0) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4" style={{ order: 0 }}>

              {/* Ward Status — Triage Queue + Medication Status merged into one card */}
              <div className="dash-card overflow-hidden flex flex-col lg:col-span-2" style={{ padding: '0' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 flex-1" style={{ minHeight: 0 }}>

                  {/* Triage Queue section */}
                  <div className="flex flex-col border-b sm:border-b-0 sm:border-r" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" style={{ color: '#FB923C' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.triageQueue')}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {t('nurse.waiting', { count: triageHistory.filter(t => t.status === 'pending').length })}
                      </span>
                    </div>
                    <div className="p-3 space-y-2 flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                      {[
                        { label: t('nurse.redEmergency'), count: triageHistory.filter(ti => ti.priority === 'RED' && ti.status === 'pending').length, color: 'var(--color-danger)', bg: 'rgba(196,69,54,0.12)' },
                        { label: t('nurse.yellowPriority'), count: triageHistory.filter(ti => ti.priority === 'YELLOW' && ti.status === 'pending').length, color: 'var(--color-warning)', bg: 'rgba(228,168,75,0.12)' },
                        { label: t('nurse.greenStandard'), count: triageHistory.filter(ti => ti.priority === 'GREEN' && ti.status === 'pending').length, color: 'var(--color-success)', bg: 'rgba(27,158,119,0.12)' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg" style={{
                          background: item.bg, border: '1px solid var(--border-light)',
                        }}>
                          <span className="text-[10px] font-semibold" style={{ color: item.color }}>{item.label}</span>
                          <span className="text-sm font-bold" style={{ color: item.color }}>{item.count}</span>
                        </div>
                      ))}
                      {/* Today's triage activity */}
                      <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('nurse.todaysActivity')}</p>
                        <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.totalTriagedToday')}</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {triageHistory.filter(ti => (ti.triagedAt || '').startsWith(new Date().toISOString().slice(0, 10))).length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg mt-1.5" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.currentlyInConsult')}</span>
                          <span className="text-sm font-bold" style={{ color: '#2563EB' }}>
                            {triageHistory.filter(ti => ti.status === 'seen').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg mt-1.5" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.dischargedToday')}</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                            {triageHistory.filter(ti => ti.status === 'discharged' && (ti.triagedAt || '').startsWith(new Date().toISOString().slice(0, 10))).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Medication Status section */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
                      <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4" style={{ color: '#2563EB' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.medicationStatus')}</span>
                      </div>
                    </div>
                    <div className="p-3 space-y-2 flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                      {[
                        { label: t('nurse.overdue'), value: overdueMarCount, color: 'var(--color-danger)' },
                        { label: t('nurse.dueNow'), value: dueMarCount, color: 'var(--color-warning)' },
                        { label: t('nurse.upcoming'), value: marEntries.filter(e => e.status === 'upcoming').length, color: 'var(--text-muted)' },
                        { label: t('nurse.given'), value: marEntries.filter(e => e.status === 'given').length, color: 'var(--color-success)' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg" style={{
                          background: 'var(--overlay-subtle)',
                          border: '1px solid var(--border-light)',
                        }}>
                          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                          <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                        </div>
                      ))}
                      {/* MAR summary */}
                      <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('nurse.shiftProgress')}</p>
                        <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.totalScheduled')}</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{marEntries.length}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg mt-1.5" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.completionRate')}</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                            {marEntries.length > 0 ? Math.round((marEntries.filter(e => e.status === 'given').length / marEntries.length) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Quick Actions — right column; doubles as the view switcher */}
              <div className="dash-card p-4 flex flex-col lg:col-span-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('dashboard.quickActions')}</h3>
                <div className="grid grid-cols-2 gap-2.5 flex-1">
                  {quickActions.map(quickActionButton)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: MEDICATION ADMINISTRATION RECORD (MAR) ═══ */}
        {activeTab === 'mar' && (
          <div className="dash-card overflow-hidden flex flex-col" style={{ padding: '0' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4" style={{ color: '#2563EB' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.marTitle')}</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider" style={{
                  background: 'rgba(92,184,168,0.1)',
                  color: '#2563EB',
                  border: '1px solid rgba(92,184,168,0.2)',
                }}>{t('nurse.pending', { count: marEntries.filter(e => e.status !== 'given').length })}</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full">
                <thead>
                  <tr>
                    {[t('nurse.colTime'), t('nurse.colPatient'), t('nurse.colMedication'), t('nurse.colDose'), t('nurse.colRoute'), t('nurse.colStatus'), t('nurse.colAction')].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marEntries.map(entry => {
                    const sc = marStatusColor(entry.status);
                    return (
                      <tr
                        key={entry.id}
                        className="cursor-pointer transition-colors hover:bg-[var(--table-row-hover)]"
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          background: sc.bg,
                        }}
                      >
                        <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-primary)' }}>{entry.time}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => router.push(`/patients/${entry.patientId}`)} className="text-left hover:underline">
                            <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{entry.patientName}</span>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] font-semibold" style={{ color: sc.color }}>{entry.medication}</td>
                        <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{entry.dose}</td>
                        <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{entry.route}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[9px] font-bold px-2 py-1 rounded" style={{ background: `${sc.color}20`, color: sc.color }}>
                            {sc.label}
                          </span>
                          {entry.givenAt && (
                            <p className="text-[8px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {new Date(entry.givenAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {entry.status !== 'given' ? (
                            <button
                              onClick={() => handleMarkGiven(entry.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                              style={{
                                background: 'rgba(74,222,128,0.15)',
                                border: '1px solid rgba(74,222,128,0.3)',
                              }}
                              title={t('nurse.markAsGiven')}
                            >
                              <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                            </button>
                          ) : (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.2)' }}>
                              <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {marEntries.length === 0 && (
              <div className="text-center py-12">
                <Pill className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('nurse.noMedications')}</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: TRIAGE (ETAT) — Two-column layout ═══ */}
        {activeTab === 'triage' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column: ETAT Assessment Form (2/3 width) */}
            <div className="lg:col-span-2 dash-card overflow-hidden flex flex-col" style={{ padding: '0' }}>
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
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border, rgba(59, 130, 246,0.25))' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {patientFullName(selectedTriagePatient)}
                        </p>
                        <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {selectedTriagePatient.hospitalNumber} · {patientGenderAge(selectedTriagePatient)}
                        </p>
                      </div>
                      <button onClick={() => { setTriagePatientId(''); setTriagePatientSearch(''); }} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
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
                        className="w-full px-3 py-2 rounded-xl text-sm"
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
                      <Wind className="w-4 h-4" style={{ color: '#2563EB' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.airway')}</span>
                    </div>
                    <div className="flex gap-2">
                      {(['clear', 'obstructed'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTriageData(prev => ({ ...prev, airway: opt }))}
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
                          onClick={() => setTriageData(prev => ({ ...prev, breathing: opt }))}
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
                          onClick={() => setTriageData(prev => ({ ...prev, circulation: opt }))}
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
                      <Brain className="w-4 h-4" style={{ color: '#2563EB' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.consciousnessAvpu')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { key: 'alert' as const, label: t('nurse.avpuAlert') },
                        { key: 'verbal' as const, label: t('nurse.avpuVerbal') },
                        { key: 'pain' as const, label: t('nurse.avpuPain') },
                        { key: 'unresponsive' as const, label: t('nurse.avpuUnresponsive') },
                      ]).map(opt => (
                        <button
                          key={opt.key}
                          onClick={() => setTriageData(prev => ({ ...prev, consciousness: opt.key }))}
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
                    <p className="text-3xl font-black mb-1">{triageData.priority}</p>
                    <p className="text-sm font-semibold">{triagePriorityColor(triageData.priority).label}</p>
                    {selectedTriagePatient && (
                      <p className="text-xs mt-1 opacity-80">{t('nurse.patientLabel', { name: `${selectedTriagePatient.firstName} ${selectedTriagePatient.surname}` })}</p>
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

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTriageData({ airway: '', breathing: '', circulation: '', consciousness: '', priority: '' });
                      setTriagePatientId('');
                      setTriagePatientSearch('');
                      setTriageVitals({ temperature: '', pulse: '', respiratoryRate: '', systolic: '', diastolic: '', oxygenSaturation: '', weight: '' });
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
                    {triageSubmitting ? t('nurse.saving') : t('nurse.saveTriage')}
                  </button>
                </div>
              </div>
            </div>

            {/* Right column: Recent Triages List (1/3 width) */}
            <div className="card-elevated overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: ACCENT }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.recentTriages')}</h3>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.total', { count: triageHistory.length })}</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto">
                {triageHistory.length === 0 ? (
                  <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>{t('nurse.noTriages')}</p>
                ) : (
                  <div className="space-y-2">
                    {triageHistory.slice(0, 12).map(ti => {
                      const c = triagePriorityColor(ti.priority);
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
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c.bg, color: c.text }}>
                            <span className="text-[9px] font-black">{ti.priority}</span>
                          </div>
                          <button className="flex-1 min-w-0 text-left" onClick={() => router.push(`/patients/${ti.patientId}`)} title={t('nurse.viewPatientRecord')}>
                            <p className="text-[11px] font-semibold truncate hover:underline" style={{ color: 'var(--text-primary)' }}>{ti.patientName}</p>
                            <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {ti.chiefComplaint || 'ABCC'} · {timeAgo}
                            </p>
                          </button>
                          <div className="flex-shrink-0">
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: ti.status === 'pending' ? 'rgba(252,211,77,0.12)' : ti.status === 'seen' ? 'rgba(92,184,168,0.12)' : 'rgba(31, 157, 111,0.12)', color: ti.status === 'pending' ? 'var(--color-warning)' : ti.status === 'seen' ? '#2563EB' : 'var(--color-success)' }}>
                              {ti.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {assignTarget && (
        <AssignDoctorModal
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => { setAssignTarget(null); reload(); }}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL: Quick Vitals Entry (Feature 1) */}
      {/* ============================================================ */}
      {vitalsModalOpen && vitalsPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Thermometer className="w-5 h-5" style={{ color: ACCENT }} />
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.quickVitalsEntry')}</h2>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{vitalsPatient.name}</p>
                </div>
              </div>
              <button onClick={() => setVitalsModalOpen(false)} className="p-1 rounded-lg transition-all" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Success State */}
            {vitalsSaved ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.15)' }}>
                  <Check className="w-7 h-7" style={{ color: 'var(--color-success)' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>{t('nurse.vitalsSavedSuccess')}</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Blood Pressure */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.bloodPressureMmhg')}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder={t('nurse.systolic')}
                        value={vitalsForm.systolic}
                        onChange={e => setVitalsForm(prev => ({ ...prev, systolic: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.systolic ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.systolic ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.systolic ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <span className="self-center text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        placeholder={t('nurse.diastolic')}
                        value={vitalsForm.diastolic}
                        onChange={e => setVitalsForm(prev => ({ ...prev, diastolic: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-sm"
                        style={{
                          background: vitalFlags.diastolic ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                          border: `1px solid ${vitalFlags.diastolic ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                          color: vitalFlags.diastolic ? 'var(--color-danger)' : 'var(--text-primary)',
                        }}
                      />
                    </div>
                  </div>
                  {(vitalFlags.systolic || vitalFlags.diastolic) && (
                    <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                      <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.abnormalBpDetected')}
                    </p>
                  )}
                </div>

                {/* Temperature */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.temperatureC')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="36.5"
                    value={vitalsForm.temperature}
                    onChange={e => setVitalsForm(prev => ({ ...prev, temperature: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: vitalFlags.temperature ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                      border: `1px solid ${vitalFlags.temperature ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                      color: vitalFlags.temperature ? 'var(--color-danger)' : 'var(--text-primary)',
                    }}
                  />
                  {vitalFlags.temperature && (
                    <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                      <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.feverDetected')}
                    </p>
                  )}
                </div>

                {/* Pulse & SpO2 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.pulseRateBpm')}
                    </label>
                    <input
                      type="number"
                      placeholder="72"
                      value={vitalsForm.pulse}
                      onChange={e => setVitalsForm(prev => ({ ...prev, pulse: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: vitalFlags.pulse ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                        border: `1px solid ${vitalFlags.pulse ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                        color: vitalFlags.pulse ? 'var(--color-danger)' : 'var(--text-primary)',
                      }}
                    />
                    {vitalFlags.pulse && (
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.abnormalPulse')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.spo2Label')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="98"
                      value={vitalsForm.spo2}
                      onChange={e => setVitalsForm(prev => ({ ...prev, spo2: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: vitalFlags.spo2 ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                        border: `1px solid ${vitalFlags.spo2 ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                        color: vitalFlags.spo2 ? 'var(--color-danger)' : 'var(--text-primary)',
                      }}
                    />
                    {vitalFlags.spo2 && (
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.lowSpo2')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Weight & Respiratory Rate */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.weightKgLabel')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="65.0"
                      value={vitalsForm.weight}
                      onChange={e => setVitalsForm(prev => ({ ...prev, weight: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('nurse.respiratoryRate')}
                    </label>
                    <input
                      type="number"
                      placeholder="18"
                      value={vitalsForm.respiratoryRate}
                      onChange={e => setVitalsForm(prev => ({ ...prev, respiratoryRate: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{
                        background: vitalFlags.respiratoryRate ? 'rgba(239,68,68,0.1)' : 'var(--overlay-subtle)',
                        border: `1px solid ${vitalFlags.respiratoryRate ? 'rgba(239,68,68,0.4)' : 'var(--border-light)'}`,
                        color: vitalFlags.respiratoryRate ? 'var(--color-danger)' : 'var(--text-primary)',
                      }}
                    />
                    {vitalFlags.respiratoryRate && (
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--color-danger)' }}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />{t('nurse.abnormalRr')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('nurse.notes')}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t('nurse.additionalObservations')}
                    value={vitalsForm.notes}
                    onChange={e => setVitalsForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: 'var(--overlay-subtle)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {/* Abnormal flags summary */}
                {Object.keys(vitalFlags).length > 0 && (
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>{t('nurse.abnormalValuesDetected')}</span>
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--color-danger)' }}>
                      {t('nurse.valuesFlagged', { values: Object.keys(vitalFlags).map(k => {
                        const labels: Record<string, string> = { systolic: t('nurse.flagSystolic'), diastolic: t('nurse.flagDiastolic'), temperature: t('nurse.flagTemperature'), spo2: t('nurse.flagSpo2'), pulse: t('nurse.flagPulse'), respiratoryRate: t('nurse.flagRespiratoryRate') };
                        return labels[k] || k;
                      }).join(', ') })}
                    </p>
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveVitals}
                  disabled={vitalsSaving}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: vitalsSaving ? 'var(--text-muted)' : ACCENT }}
                >
                  {vitalsSaving ? t('nurse.savingDots') : t('nurse.saveVitals')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: Shift Handoff (Feature 3) */}
      {/* ============================================================ */}
      {handoffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: ACCENT }} />
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.shiftHandoffReport')}</h2>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{todayDate} - {currentUser.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                  style={{ background: 'var(--accent-light)', color: ACCENT, border: '1px solid var(--accent-border)' }}
                >
                  <Printer className="w-3 h-3" />
                  {t('action.print')}
                </button>
                <button onClick={() => setHandoffOpen(false)} className="p-1 rounded-lg transition-all" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 print-handoff">
              {/* Critical Patients */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>{t('nurse.criticalPatients')}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)' }}>
                    {criticalPatients.length}
                  </span>
                </div>
                {criticalPatients.length > 0 ? (
                  <div className="space-y-1">
                    {criticalPatients.map(p => (
                      <div key={p._id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: 'var(--color-danger)' }}>
                          {(p.firstName || '?')[0]}{(p.surname || '?')[0]}
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{patientFullName(p)}</span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>{t('nurse.vitalsOverdue')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('nurse.noCriticalPatients')}</p>
                )}
              </div>

              {/* Pending Tasks */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>{t('nurse.pendingTasks')}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>{t('nurse.vitalsDueTask')}</span>
                    <span className="text-xs font-bold" style={{ color: '#F87171' }}>{vitalsDue}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>{t('nurse.medicationsOverdue')}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>{overdueMarCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>{t('nurse.medicationsDueNow')}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--color-warning)' }}>{dueMarCount}</span>
                  </div>
                </div>
              </div>

              {/* Admissions & Discharges */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <BedDouble className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>{t('nurse.newAdmissionsToday')}</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{IS_DEMO ? Math.max(1, Math.floor(patients.length * 0.05)) : 0}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(92,184,168,0.05)', border: '1px solid rgba(92,184,168,0.15)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4" style={{ color: '#2563EB' }} />
                    <span className="text-xs font-semibold" style={{ color: '#2563EB' }}>{t('nurse.dischargesToday')}</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: '#2563EB' }}>{IS_DEMO ? Math.max(1, Math.floor(patients.length * 0.03)) : 0}</p>
                </div>
              </div>

              {/* Notes from outgoing nurse */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                  {t('nurse.notesOutgoingNurse')}
                </label>
                <textarea
                  rows={4}
                  placeholder={t('nurse.handoffNotesPlaceholder')}
                  value={handoffNotes}
                  onChange={e => setHandoffNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: 'var(--overlay-subtle)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Summary footer */}
              <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {t('nurse.generatedBy', { name: currentUser.name, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) })}
                </p>
                <button
                  onClick={() => setHandoffOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: ACCENT }}
                >
                  {t('nurse.completeHandoff')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
