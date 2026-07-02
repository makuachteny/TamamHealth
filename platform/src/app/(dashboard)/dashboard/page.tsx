'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Modal from '@/components/Modal';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { useApp } from '@/lib/context';
import EhrClinicalDashboard from '@/components/ehr/EhrClinicalDashboard';
import {
  Users, AlertTriangle,
  ChevronRight, ChevronLeft, Stethoscope,
  Syringe, HeartPulse, FlaskConical,
  FileText, Pill,
  SendHorizontal,
  X, ClipboardList, TestTube,
  CheckCircle2, ArrowUpRight,
  ArrowRightLeft, Calendar, BedDouble,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useResumableEncounters } from '@/lib/hooks/useResumableEncounters';
import { useSigningInbox } from '@/lib/hooks/useSigningInbox';
import { usePhoneNotesInbox } from '@/lib/hooks/usePhoneNotesInbox';
import { useTriage } from '@/lib/hooks/useTriage';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { useWards } from '@/lib/hooks/useWards';
import { formatCompactDateTime } from '@/lib/format-utils';
import { patientFullName, patientAge } from '@/lib/patient-utils';
import { getDefaultDashboard, getRoleConfig } from '@/lib/permissions';
import SuperintendentDashboard from '@/components/dashboards/SuperintendentDashboard';
import { useTranslation } from '@/lib/i18n/useTranslation';
import PatientAvatar from '@/components/patients/PatientAvatar';
import type { AppointmentDoc, PatientDoc } from '@/lib/db-types';

const DEPARTMENTS = ['OPD', 'Emergency', 'Maternity', 'Pediatrics', 'Surgery', 'Lab', 'Pharmacy', 'ICU'];


// In production we suppress fabricated demo numbers (e.g. 55%/12% gender splits,
// "Week N" trend points) so users do not see invented statistics presented as
// real clinical/operational data. Set NEXT_PUBLIC_DEMO_MODE=false on real
// deploys; everything below collapses to zero / empty until the underlying
// services start emitting real aggregates.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

// ═══════════════════════════════════════════════════
// SOAP NOTE TEMPLATES
// ═══════════════════════════════════════════════════
interface SOAPTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const SOAP_TEMPLATES: SOAPTemplate[] = [
  {
    id: 'malaria',
    name: 'Malaria',
    icon: 'bug',
    color: 'var(--color-danger)',
    subjective: 'Patient presents with high-grade intermittent fever for 3 days, associated with chills, rigors, headache, body aches, and generalized weakness. Reports loss of appetite and occasional nausea. No vomiting or diarrhea. Lives in malaria-endemic area. No recent travel history. No use of insecticide-treated bed net.',
    objective: 'Temp: 38.8 C, HR: 102 bpm, BP: 110/70 mmHg, RR: 20/min, SpO2: 97%.\nGeneral: Febrile, mild pallor, no jaundice.\nAbdomen: Splenomegaly palpable 2cm below costal margin, mild hepatomegaly.\nNo neck stiffness. No rash.\nMalaria RDT: Positive (P. falciparum).',
    assessment: 'Uncomplicated Plasmodium falciparum Malaria (ICD-11: 1F40).',
    plan: '1. Artemether-Lumefantrine (ACT) 20/120mg - 4 tablets BD x 3 days.\n2. Paracetamol 500mg TDS x 3 days for fever/pain.\n3. Encourage oral fluid intake.\n4. Advise use of insecticide-treated bed net.\n5. Return if symptoms worsen (persistent vomiting, confusion, dark urine).\n6. Follow-up in 3 days or if fever persists.',
  },
  {
    id: 'pneumonia',
    name: 'Pneumonia',
    icon: 'wind',
    color: 'var(--accent-primary)',
    subjective: 'Patient reports productive cough with yellowish sputum for 5 days, associated with fever, chest pain (pleuritic, worse on deep breathing), and shortness of breath on exertion. Reports night sweats and decreased appetite. No hemoptysis. No known TB contact.',
    objective: 'Temp: 38.5 C, HR: 96 bpm, BP: 120/80 mmHg, RR: 26/min, SpO2: 94% on room air.\nGeneral: Appears unwell, mildly tachypneic.\nChest: Reduced air entry right lower zone, dullness to percussion, bronchial breathing and coarse crackles right base.\nNo peripheral edema. No lymphadenopathy.',
    assessment: 'Community-Acquired Pneumonia, right lower lobe (ICD-11: CA40).',
    plan: '1. Amoxicillin 500mg TDS x 7 days (or Amoxicillin-Clavulanate if moderate severity).\n2. Paracetamol 500mg TDS for fever/pain.\n3. Encourage oral fluids and rest.\n4. Sputum for AFB if cough persists > 2 weeks (TB screening).\n5. Chest X-ray if available.\n6. Return if worsening breathlessness, confusion, or no improvement in 48 hours.\n7. Follow-up in 3 days.',
  },
  {
    id: 'anc',
    name: 'ANC Visit',
    icon: 'heart',
    color: 'var(--accent-primary)',
    subjective: 'Pregnant woman presents for routine antenatal visit. Reports fetal movements present and regular. No vaginal bleeding or discharge. No headache, visual disturbances, or epigastric pain. Reports mild ankle swelling in the evenings. No dysuria. Taking iron-folate supplements as prescribed.',
    objective: 'BP: 118/72 mmHg, Weight: 65 kg (gain 1.5kg since last visit), Temp: 36.6 C.\nFundal height: Corresponds to dates.\nFetal heart rate: 144 bpm, regular.\nPresentation: Cephalic.\nUrine dipstick: Protein negative, Glucose negative.\nHb: 11.2 g/dL.\nNo pedal edema.',
    assessment: 'Normal intrauterine pregnancy, appropriate for gestational age. Low-risk pregnancy (ICD-11: QA00).',
    plan: '1. Continue Iron-Folate supplementation daily.\n2. IPTp-SP dose given (if eligible by gestational age).\n3. Tetanus toxoid vaccine as per schedule.\n4. LLIN (bed net) provided/confirmed.\n5. Birth preparedness plan reviewed (facility, transport, blood donor).\n6. Danger signs counseling reinforced.\n7. Next ANC visit scheduled in 4 weeks.\n8. Refer for ultrasound if not yet done.',
  },
  {
    id: 'diarrhea',
    name: 'Diarrheal Disease',
    icon: 'droplets',
    color: 'var(--color-warning)',
    subjective: 'Patient presents with watery diarrhea for 2 days, 4-6 episodes per day. Associated with mild abdominal cramps and decreased appetite. No blood or mucus in stool. Low-grade fever reported. Drinking fluids but reduced oral intake. No recent travel. Unimproved water source at home.',
    objective: 'Temp: 37.8 C, HR: 100 bpm, BP: 100/65 mmHg, RR: 20/min.\nGeneral: Mild dehydration - dry mucous membranes, slightly sunken eyes, skin turgor mildly decreased.\nAbdomen: Soft, mildly tender diffusely, hyperactive bowel sounds. No guarding or rigidity.\nNo blood in stool on examination.',
    assessment: 'Acute Watery Diarrhea with mild dehydration (ICD-11: 1A00).',
    plan: '1. ORS (Oral Rehydration Solution) - Plan B: 75ml/kg over 4 hours, then maintenance.\n2. Zinc 20mg daily x 10 days (10mg for children <6 months).\n3. Continue breastfeeding (if applicable) and age-appropriate feeding.\n4. Paracetamol for fever if needed.\n5. Advise on hand hygiene and safe water practices.\n6. Return immediately if: unable to drink, blood in stool, high fever, or worsening.\n7. Follow-up in 2 days if not improved.',
  },
  {
    id: 'respiratory',
    name: 'Respiratory Infection',
    icon: 'thermometer',
    color: 'var(--accent-primary)',
    subjective: 'Patient presents with dry cough for 3 days, sore throat, nasal congestion, and mild headache. Low-grade fever reported. No shortness of breath or chest pain. No known sick contacts with TB. No significant past medical history.',
    objective: 'Temp: 37.6 C, HR: 82 bpm, BP: 120/76 mmHg, RR: 18/min, SpO2: 98%.\nGeneral: Appears well, not in distress.\nENT: Pharyngeal erythema, no exudates, no tonsillar enlargement. Nasal mucosa congested.\nChest: Clear breath sounds bilaterally, no crackles or wheezes.\nNo lymphadenopathy.',
    assessment: 'Acute Upper Respiratory Tract Infection (ICD-11: CA02).',
    plan: '1. Symptomatic management - Paracetamol 500mg TDS for fever/pain.\n2. Warm saline gargles for sore throat.\n3. Adequate oral fluid intake and rest.\n4. No antibiotics required (viral etiology likely).\n5. Return if: fever > 5 days, worsening cough, difficulty breathing, or new symptoms.\n6. Sputum AFB if cough persists beyond 2 weeks.',
  },
  {
    id: 'general',
    name: 'General Consultation',
    icon: 'clipboard',
    color: 'var(--accent-primary)',
    subjective: '',
    objective: 'Temp: ___ C, HR: ___ bpm, BP: ___/___ mmHg, RR: ___/min, SpO2: ___%.\nGeneral appearance: \nHEENT: \nChest/Lungs: \nCardiovascular: \nAbdomen: \nExtremities: \nNeurological: ',
    assessment: '',
    plan: '1. \n2. \n3. \nFollow-up: ',
  },
];

// ═══════════════════════════════════════════════════
// PRESCRIPTION PRESETS
// ═══════════════════════════════════════════════════
interface PrescriptionItem {
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
}

interface PrescriptionPreset {
  id: string;
  name: string;
  color: string;
  items: PrescriptionItem[];
}

const PRESCRIPTION_PRESETS: PrescriptionPreset[] = [
  {
    id: 'malaria-adult',
    name: 'Malaria Adult',
    color: 'var(--color-danger)',
    items: [
      { medication: 'Artemether-Lumefantrine (ACT)', dose: '20/120mg (4 tablets)', route: 'Oral', frequency: 'BD (twice daily)', duration: '3 days' },
      { medication: 'Paracetamol', dose: '500mg', route: 'Oral', frequency: 'TDS (three times daily)', duration: '3 days' },
    ],
  },
  {
    id: 'malaria-child',
    name: 'Malaria Child',
    color: 'var(--accent-primary)',
    items: [
      { medication: 'ACT Suspension (Artemether-Lumefantrine)', dose: 'Weight-based dosing', route: 'Oral', frequency: 'BD (twice daily)', duration: '3 days' },
      { medication: 'Paracetamol Syrup', dose: '10-15mg/kg', route: 'Oral', frequency: 'TDS (three times daily)', duration: '3 days' },
    ],
  },
  {
    id: 'pneumonia-adult',
    name: 'Pneumonia Adult',
    color: 'var(--accent-primary)',
    items: [
      { medication: 'Amoxicillin', dose: '500mg', route: 'Oral', frequency: 'TDS (three times daily)', duration: '5 days' },
    ],
  },
  {
    id: 'pneumonia-child',
    name: 'Pneumonia Child',
    color: 'var(--accent-primary)',
    items: [
      { medication: 'Amoxicillin Suspension', dose: '25-50mg/kg/day divided', route: 'Oral', frequency: 'TDS (three times daily)', duration: '5 days' },
      { medication: 'Paracetamol Syrup', dose: '10-15mg/kg', route: 'Oral', frequency: 'TDS (three times daily)', duration: '3 days' },
    ],
  },
  {
    id: 'diarrhea',
    name: 'Diarrhea',
    color: 'var(--color-warning)',
    items: [
      { medication: 'ORS (Oral Rehydration Salts)', dose: '1 sachet per 200ml water', route: 'Oral', frequency: 'After each loose stool', duration: 'Until resolved' },
      { medication: 'Zinc', dose: '20mg', route: 'Oral', frequency: 'Once daily', duration: '10 days' },
    ],
  },
  {
    id: 'uti',
    name: 'UTI',
    color: 'var(--accent-primary)',
    items: [
      { medication: 'Ciprofloxacin', dose: '500mg', route: 'Oral', frequency: 'BD (twice daily)', duration: '5 days' },
    ],
  },
];

// ═══════════════════════════════════════════════════
// COMMON LAB TESTS
// ═══════════════════════════════════════════════════
interface LabTest {
  id: string;
  name: string;
  specimen: string;
  category: string;
}

const COMMON_LAB_TESTS: LabTest[] = [
  { id: 'malaria-rdt', name: 'Malaria RDT', specimen: 'Blood (finger prick)', category: 'Rapid' },
  { id: 'fbc', name: 'Full Blood Count', specimen: 'Blood (EDTA tube)', category: 'Hematology' },
  { id: 'urinalysis', name: 'Urinalysis', specimen: 'Urine (midstream)', category: 'Chemistry' },
  { id: 'blood-glucose', name: 'Blood Glucose', specimen: 'Blood (finger prick)', category: 'Chemistry' },
  { id: 'hiv-test', name: 'HIV Test', specimen: 'Blood (finger prick)', category: 'Rapid' },
  { id: 'hep-b', name: 'Hepatitis B', specimen: 'Blood (serum)', category: 'Serology' },
  { id: 'lft', name: 'Liver Function Test', specimen: 'Blood (serum)', category: 'Chemistry' },
  { id: 'rft', name: 'Renal Function Test', specimen: 'Blood (serum)', category: 'Chemistry' },
  { id: 'pregnancy-test', name: 'Pregnancy Test', specimen: 'Urine', category: 'Rapid' },
  { id: 'sputum-afb', name: 'Sputum AFB', specimen: 'Sputum (morning sample)', category: 'Microbiology' },
];

// ═══════════════════════════════════════════════════
// MODAL OVERLAY COMPONENT
// ═══════════════════════════════════════════════════
function ModalOverlay({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <Modal onClose={onClose}>
      <div className="modal-panel modal-panel--lg">
        <div className="flex items-center justify-between p-4 sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ background: 'var(--bg-secondary)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </Modal>
  );
}

// SOAP template icon helper
function TemplateIcon({ icon, color }: { icon: string; color: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    bug: <AlertTriangle className="w-5 h-5" style={{ color }} />,
    wind: <Stethoscope className="w-5 h-5" style={{ color }} />,
    heart: <HeartPulse className="w-5 h-5" style={{ color }} />,
    droplets: <FlaskConical className="w-5 h-5" style={{ color }} />,
    thermometer: <Syringe className="w-5 h-5" style={{ color }} />,
    clipboard: <ClipboardList className="w-5 h-5" style={{ color }} />,
  };
  return <>{iconMap[icon] || <FileText className="w-5 h-5" style={{ color }} />}</>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  // Consultations this clinician paused while waiting on lab/imaging results.
  const { encounters: resumableEncounters } = useResumableEncounters();
  // Documents awaiting signature / co-signature — the Chart Desktop "to sign" inbox.
  const { unsignedDrafts, awaitingCosign, heldAssessments } = useSigningInbox();
  // Open patient phone notes routed to me — callbacks worklist.
  const { notes: phoneNotesInbox } = usePhoneNotesInbox();
  // Referrals — used for the "My Referrals" greeting-hero stat.
  const { referrals } = useReferrals();
  // Appointments — drives the "Next Appointment" card.
  const { appointments, updateStatus: updateApptStatus } = useAppointments();
  const { wards } = useWards();
  const canCosign = currentUser?.role === 'doctor' || currentUser?.role === 'medical_superintendent' || currentUser?.role === 'clinician';
  // Resolve a patient display name for the signing inbox from the loaded roster.
  const signingPatientName = useCallback(
    (patientId: string): string => {
      const p = patients.find((pt) => pt._id === patientId);
      return p ? patientFullName(p) : patientId;
    },
    [patients],
  );
  const { triages } = useTriage();
  // Today's triage priority per patient, so the worklist can lead with acuity.
  const triagePriorityByPatient = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map: Record<string, 'RED' | 'YELLOW' | 'GREEN'> = {};
    const rank = { RED: 3, YELLOW: 2, GREEN: 1 } as const;
    for (const tr of triages) {
      if (!(tr.triagedAt || '').startsWith(today)) continue;
      const prev = map[tr.patientId];
      if (!prev || rank[tr.priority] > rank[prev]) map[tr.patientId] = tr.priority;
    }
    return map;
  }, [triages]);

  // Reviews Score chart controls
  const [reviewsChartType, setReviewsChartType] = useState<'line' | 'area' | 'bar'>('bar');
  const [reviewsPeriod, setReviewsPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  const REVIEWS_DATA: Record<string, { label: string; data: { label: string; inpatient: number; outpatient: number }[] }> = {
    week: {
      label: 'This Week',
      data: [
        { label: 'Mon', inpatient: 76, outpatient: 82 },
        { label: 'Tue', inpatient: 80, outpatient: 78 },
        { label: 'Wed', inpatient: 72, outpatient: 86 },
        { label: 'Thu', inpatient: 84, outpatient: 80 },
        { label: 'Fri', inpatient: 78, outpatient: 88 },
        { label: 'Sat', inpatient: 82, outpatient: 84 },
        { label: 'Sun', inpatient: 86, outpatient: 90 },
      ],
    },
    month: {
      label: 'This Month',
      data: [
        { label: 'Wk 1', inpatient: 74, outpatient: 80 },
        { label: 'Wk 2', inpatient: 80, outpatient: 84 },
        { label: 'Wk 3', inpatient: 78, outpatient: 88 },
        { label: 'Wk 4', inpatient: 84, outpatient: 86 },
      ],
    },
    quarter: {
      label: 'This Quarter',
      data: [
        { label: 'Jan', inpatient: 72, outpatient: 78 },
        { label: 'Feb', inpatient: 76, outpatient: 82 },
        { label: 'Mar', inpatient: 80, outpatient: 86 },
        { label: 'Apr', inpatient: 78, outpatient: 84 },
        { label: 'May', inpatient: 82, outpatient: 88 },
        { label: 'Jun', inpatient: 86, outpatient: 90 },
      ],
    },
  };
  const reviewsData = REVIEWS_DATA[reviewsPeriod].data;

  // Patients a nurse has assigned to this clinician for care.
  const myAssigned = useMemo(
    () => patients
      .filter(p => p.assignedDoctor && p.assignedDoctor === currentUser?._id)
      .sort((a, b) => (b.assignedAt ?? '').localeCompare(a.assignedAt ?? '')),
    [patients, currentUser?._id],
  );

  // Search / filter / sort controls for the "assigned to you" worklist.
  const [assignedSearch, setAssignedSearch] = useState('');
  const [assignedDivision, setAssignedDivision] = useState('all');
  const [assignedSort, setAssignedSort] = useState<'acuity' | 'recent' | 'name' | 'age'>('acuity');
  // Acuity filter value (the setter's UI control was removed; value still
  // feeds the worklist filter and defaults to showing all acuities).
  const [assignedAcuity] = useState<'all' | 'RED' | 'YELLOW' | 'GREEN'>('all');
  // Which tab of the worklist card is showing: the assigned-patients table or
  // the documents-to-sign inbox (both share one card).
  const [worklistTab, setWorklistTab] = useState<'patients' | 'documents'>('patients');
  // Index into the clinician's upcoming-appointments carousel. Declared with the
  // other hooks (above any early return) so hook order is always stable.
  const [apptIndex, setApptIndex] = useState(0);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDoc | null>(null);
  const apptCarouselRef = useRef<HTMLDivElement>(null);
  const apptScrolling = useRef(false);
  useEffect(() => {
    const el = apptCarouselRef.current;
    if (!el) return;
    apptScrolling.current = true;
    el.scrollTo({ left: apptIndex * el.clientWidth, behavior: 'smooth' });
    const timer = setTimeout(() => { apptScrolling.current = false; }, 400);
    return () => clearTimeout(timer);
  }, [apptIndex]);
  const [docsSearch, setDocsSearch] = useState('');
  const [docsFilter, setDocsFilter] = useState<'all' | 'outcome' | 'cosign' | 'draft'>('all');

  // Disease trend explorer

  // Modal states
  const [soapModalOpen, setSoapModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SOAPTemplate | null>(null);
  const [soapForm, setSoapForm] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [soapPatientId, setSoapPatientId] = useState('');

  const [prescribeModalOpen, setPrescribeModalOpen] = useState(false);
  const [prescribePatientId, setPrescribePatientId] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [prescriptionSuccess, setPrescriptionSuccess] = useState(false);

  const [labModalOpen, setLabModalOpen] = useState(false);
  const [labPatientId, setLabPatientId] = useState('');
  const [selectedLabTests, setSelectedLabTests] = useState<Set<string>>(new Set());
  const [labOrderSuccess, setLabOrderSuccess] = useState(false);

  // Quick-action popup modals
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ firstName: '', lastName: '', dob: '', gender: 'female', phone: '' });

  const [newReferralOpen, setNewReferralOpen] = useState(false);
  const [referralForm, setReferralForm] = useState({ patientId: '', toFacility: '', reason: '' });
  const [referralDone, setReferralDone] = useState(false);

  const [bookApptOpen, setBookApptOpen] = useState(false);
  const [apptForm, setApptForm] = useState({ patientId: '', date: '', time: '', type: 'OPD' });
  const [apptDone, setApptDone] = useState(false);

  const [ancOpen, setAncOpen] = useState(false);
  const [ancPatientId, setAncPatientId] = useState('');

  const [wardAdmitOpen, setWardAdmitOpen] = useState(false);
  const [admitForm2, setAdmitForm2] = useState({ patientId: '', wardId: '', diagnosis: '' });
  const [admitDone, setAdmitDone] = useState(false);

  // `/dashboard` is shared. Doctors/clinical officers get the clinical view
  // below; the medical superintendent gets the admin-oriented view rendered
  // separately. The superintendent's defaultDashboard IS `/dashboard`, so it
  // must be excluded from the redirect or it would bounce to itself (the
  // blank-page / redirect-loop bug). Every other role is sent to its home.
  useEffect(() => {
    if (
      currentUser &&
      currentUser.role !== 'doctor' &&
      currentUser.role !== 'clinical_officer' &&
      currentUser.role !== 'medical_superintendent' &&
      currentUser.role !== 'clinician'
    ) {
      router.push(getDefaultDashboard(currentUser.role));
    }
  }, [currentUser, router]);

  // SOAP template selection handler
  const handleSelectTemplate = useCallback((template: SOAPTemplate) => {
    setSelectedTemplate(template);
    setSoapForm({
      subjective: template.subjective,
      objective: template.objective,
      assessment: template.assessment,
      plan: template.plan,
    });
  }, []);

  const handleSoapSave = useCallback(() => {
    // Hand off the template/draft to the full consultation page where the
    // proper save pipeline lives. The quick-action modal only prefills —
    // the consultation page persists the note, draft, and triage handoff.
    if (!soapPatientId) return;
    try {
      // Pass the draft through sessionStorage so the consultation page can
      // pick it up without leaking it into the URL.
      sessionStorage.setItem(
        'consultation:soap-draft',
        JSON.stringify({
          patientId: soapPatientId,
          ...soapForm,
          templateId: selectedTemplate?.id || null,
        }),
      );
    } catch {
      // sessionStorage can throw in private modes — fail open, the
      // consultation page will simply start fresh.
    }
    setSoapModalOpen(false);
    setSelectedTemplate(null);
    setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' });
    const targetId = soapPatientId;
    setSoapPatientId('');
    router.push(`/consultation?patientId=${encodeURIComponent(targetId)}`);
  }, [soapForm, soapPatientId, selectedTemplate, router]);

  // Prescription handler
  const handleApplyPreset = useCallback((preset: PrescriptionPreset) => {
    setPrescriptionItems(prev => [...prev, ...preset.items]);
  }, []);

  const handleRemovePrescriptionItem = useCallback((index: number) => {
    setPrescriptionItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmitPrescription = useCallback(() => {
    if (!prescribePatientId || prescriptionItems.length === 0) return;
    setPrescriptionSuccess(true);
    setTimeout(() => {
      setPrescriptionSuccess(false);
      setPrescribeModalOpen(false);
      setPrescriptionItems([]);
      setPrescribePatientId('');
    }, 2000);
  }, [prescribePatientId, prescriptionItems]);

  // Lab order handler
  const handleToggleLabTest = useCallback((testId: string) => {
    setSelectedLabTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  }, []);

  const handleSubmitLabOrder = useCallback(() => {
    if (!labPatientId || selectedLabTests.size === 0) return;
    setLabOrderSuccess(true);
    setTimeout(() => {
      setLabOrderSuccess(false);
      setLabModalOpen(false);
      setSelectedLabTests(new Set());
      setLabPatientId('');
    }, 2000);
  }, [labPatientId, selectedLabTests]);

  if (!currentUser) return null;
  // Medical superintendent → admin-oriented hospital dashboard.
  if (currentUser.role === 'medical_superintendent') return <SuperintendentDashboard />;
  // Facility administrators are redirected to /facility-overview (their home
  // dashboard) by the effect above. Anyone else who isn't a doctor/clinical
  // officer is likewise mid-redirect.
  if (currentUser.role !== 'doctor' && currentUser.role !== 'clinical_officer' && currentUser.role !== 'clinician') return null;
  const legacyCurrentUser = currentUser as NonNullable<typeof currentUser>;



  // Worklist table data: patients assigned to the signed-in clinician.
  // The assigning provider (often a nurse) and assignment time come from the
  // patient record; ward/division are sampled in demo mode for visual richness
  // and left blank in production rather than inventing a clinical team.
  const assignedRows = myAssigned.map((p, i) => ({
    _id: p._id,
    firstName: p.firstName,
    surname: p.surname,
    photoUrl: p.photoUrl,
    payorInfo: p.payorInfo,
    name: patientFullName(p),
    age: patientAge(p) ?? (25 + i * 3),
    gender: p.gender?.[0] || (IS_DEMO ? (i % 2 === 0 ? 'M' : 'F') : ''),
    id: p.hospitalNumber,
    admittedAt: p.assignedAt || p.registeredAt || p.registrationDate,
    ward: IS_DEMO ? DEPARTMENTS[i % DEPARTMENTS.length] + '-' + (i + 1) : '',
    doctor: currentUser?.name || '',
    nurse: p.assignedByName || '',
    division: IS_DEMO ? DEPARTMENTS[i % DEPARTMENTS.length] : '',
    critical: false,
    triagePriority: triagePriorityByPatient[p._id],
  }));

  // Divisions present in the worklist — powers the filter dropdown.
  const assignedDivisions = Array.from(new Set(assignedRows.map(r => r.division).filter(Boolean))).sort();

  // Apply search + division filter + sort to the worklist.
  const displayedAssigned = assignedRows
    .filter(r => {
      const q = assignedSearch.trim().toLowerCase();
      // Multi-word search: every typed term must appear somewhere in the row's
      // searchable fields, so a long "full name + details" query still matches.
      const haystack = `${r.name} ${r.id} ${r.ward} ${r.division} ${r.nurse} ${r.doctor} ${r.gender}`.toLowerCase();
      const matchesSearch = !q || q.split(/\s+/).every(term => haystack.includes(term));
      const matchesDivision = assignedDivision === 'all' || r.division === assignedDivision;
      const matchesAcuity = assignedAcuity === 'all' || r.triagePriority === assignedAcuity;
      return matchesSearch && matchesDivision && matchesAcuity;
    })
    .sort((a, b) => {
      if (assignedSort === 'name') return a.name.localeCompare(b.name);
      if (assignedSort === 'age') return (b.age || 0) - (a.age || 0);
      if (assignedSort === 'acuity') {
        const rank = { RED: 3, YELLOW: 2, GREEN: 1 } as const;
        const ar = a.triagePriority ? rank[a.triagePriority] : 0;
        const br = b.triagePriority ? rank[b.triagePriority] : 0;
        if (ar !== br) return br - ar; // most urgent first
        return (b.admittedAt ?? '').localeCompare(a.admittedAt ?? '');
      }
      return (b.admittedAt ?? '').localeCompare(a.admittedAt ?? ''); // recent
    });

  // Total documents awaiting the clinician's signature — drives the
  // "Documents to sign" tab count + empty state.
  const signCount = unsignedDrafts.length + awaitingCosign.length + heldAssessments.length;

  // ─── Greeting hero values ───
  const now = new Date();
  const heroDate = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const myReferralsCount = (referrals || []).filter(r => r.createdBy === currentUser._id).length;
  const heroStats = [
    { label: 'My Patients', value: assignedRows.length },
    { label: 'My Referrals', value: myReferralsCount },
    { label: 'Documents', value: signCount },
  ];

  // ─── Facility sync summary (drives the ring + pending list) ───

  // ─── Next appointment for this clinician ───
  const apptKey = (a: { appointmentDate: string; appointmentTime?: string }) => `${a.appointmentDate}T${a.appointmentTime || '00:00'}`;
  const myUpcomingAppts = (appointments || [])
    .filter(a => a.providerId === currentUser._id && a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show')
    .sort((x, y) => apptKey(x).localeCompare(apptKey(y)));

  // ─── Quick actions — all open popup modals ───
  const quickActions = [
    { label: t('dashboard.newPatient'), icon: Users, action: () => setNewPatientOpen(true) },
    { label: t('action.newConsultation'), icon: FileText, action: () => setSoapModalOpen(true) },
    { label: t('dashboard.quickPrescribe'), icon: Pill, action: () => setPrescribeModalOpen(true) },
    { label: t('dashboard.quickLabOrder'), icon: FlaskConical, action: () => setLabModalOpen(true) },
    { label: 'New Referral', icon: ArrowRightLeft, action: () => { setReferralDone(false); setReferralForm({ patientId: '', toFacility: '', reason: '' }); setNewReferralOpen(true); } },
    { label: 'Book Appointment', icon: Calendar, action: () => { setApptDone(false); setApptForm({ patientId: '', date: '', time: '', type: 'OPD' }); setBookApptOpen(true); } },
    { label: 'ANC Visit', icon: HeartPulse, action: () => { setAncPatientId(''); setAncOpen(true); } },
    { label: 'Ward Admission', icon: BedDouble, action: () => { setAdmitDone(false); setAdmitForm2({ patientId: '', wardId: '', diagnosis: '' }); setWardAdmitOpen(true); } },
  ];

  const outstandingItems = [
    { label: 'Documents to sign', count: signCount, tone: signCount > 0 ? 'warning' as const : 'neutral' as const, href: '/consultation' },
    { label: 'Phone notes', count: phoneNotesInbox.length, tone: phoneNotesInbox.length > 0 ? 'warning' as const : 'neutral' as const, href: '/messages' },
    { label: 'Open referrals', count: myReferralsCount, href: '/referrals' },
    { label: 'Patient intake', count: Math.max(0, assignedRows.length ? Math.min(assignedRows.length, 4) : 0), href: '/patient-intake' },
    { label: 'Awaiting labs', count: resumableEncounters.length, tone: resumableEncounters.length > 0 ? 'danger' as const : 'neutral' as const, href: '/lab' },
  ];
  const canAccessBilling = !!getRoleConfig(currentUser.role)?.allowedRoutes.includes('/payments');

  return (
    <>
      <main className="page-container page-enter">
        <EhrClinicalDashboard
          clinicianName={currentUser.name || 'clinician'}
          facilityName={currentUser.hospitalName}
          patients={assignedRows}
          appointments={myUpcomingAppts}
          outstanding={outstandingItems}
          onUpdateAppointmentStatus={updateApptStatus}
          canAccessBilling={canAccessBilling}
        />
      </main>
      {false && currentUser && (
      <main className="page-container page-enter">

        {/* Clinical alerts moved to a dedicated /alerts page. */}

        <div className="flex flex-col gap-5 h-full min-h-0">
        {/* ═══ ROW 1 — Greeting hero + Facility Sync ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-shrink-0" style={{ order: 0 }}>
          {/* Greeting hero — brand gradient banner. Greeting on top, day-at-a-
              glance stats anchored to the bottom-left (matches the design). */}
          <div className="hero-banner md:col-span-2 lg:col-span-2 flex flex-col justify-between" style={{ minHeight: 224, height: 224 }}>
            {/* Decorative Union dots */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              aria-hidden
              src="/assets/union.png"
              alt=""
              style={{
                position: 'absolute',
                width: 420,
                height: 420,
                top: -80,
                right: -60,
                zIndex: 0,
                pointerEvents: 'none',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)',
                opacity: 0.18,
                transform: 'rotate(10deg)',
              }}
            />
            <div className="relative z-[1] min-w-0">
              <h2 style={{ fontFamily: "var(--font-platform)", fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: 0 }}>
                Welcome{legacyCurrentUser.name ? `, ${legacyCurrentUser.name}` : ''}
              </h2>
              <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                <span style={{ fontFamily: "var(--font-platform)", fontWeight: 300, fontSize: 14, lineHeight: 1, letterSpacing: 0, color: 'rgba(255,255,255,0.9)' }}>
                  {heroDate}
                </span>
                {legacyCurrentUser.hospitalName && (
                  <span
                    className="inline-flex items-center gap-2"
                    style={{ height: 26, padding: '0 12px 0 3px', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.5)', borderRadius: 9999, fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 12, color: '#fff' }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0, display: 'block' }} />
                    {legacyCurrentUser.hospitalName}
                  </span>
                )}
              </div>
            </div>
            <div className="relative z-[1] flex items-end gap-8 sm:gap-12 mt-6">
              {heroStats.map(s => (
                <div key={s.label} className="text-left">
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {s.label}
                  </div>
                  <div className="mt-2 tabular-nums" style={{ fontFamily: "var(--font-platform)", fontWeight: 700, fontSize: 48, lineHeight: 1, letterSpacing: -0.5 }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews Score */}
          <div className="dash-card p-4 md:col-span-2 lg:col-span-1 flex flex-col" style={{ minHeight: 224, height: 224 }}>
            {/* Header row */}
            <div className="flex items-center justify-between mb-2 flex-shrink-0 gap-2">
              <h3 style={{ fontFamily: "var(--font-platform)", fontWeight: 600, fontSize: 15, lineHeight: 1, color: 'var(--text-primary)', flexShrink: 0 }}>Patient Satisfaction</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Chart type picker */}
                {(['line', 'area', 'bar'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setReviewsChartType(t)}
                    style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: reviewsChartType === t ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                      color: reviewsChartType === t ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
                {/* Period picker */}
                <select
                  value={reviewsPeriod}
                  onChange={e => setReviewsPeriod(e.target.value as 'week' | 'month' | 'quarter')}
                  style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                </select>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {reviewsChartType === 'bar' ? (
                  <BarChart data={reviewsData} margin={{ top: 2, right: 4, left: -26, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-platform)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 100]} ticks={[60, 70, 80, 90, 100]} tickFormatter={(v: number) => v + '%'} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-platform)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-platform)' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(0) + '%', '']} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-platform)', paddingTop: 2 }} />
                    <Bar dataKey="inpatient" name="Inpatient" fill="#2191D0" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="outpatient" name="Outpatient" fill="#FF7F00" radius={[3, 3, 0, 0]} />
                  </BarChart>
                ) : reviewsChartType === 'area' ? (
                  <AreaChart data={reviewsData} margin={{ top: 2, right: 4, left: -26, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-platform)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 100]} ticks={[60, 70, 80, 90, 100]} tickFormatter={(v: number) => v + '%'} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-platform)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-platform)' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(0) + '%', '']} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-platform)', paddingTop: 2 }} />
                    <Area type="monotone" dataKey="inpatient" name="Inpatient" stroke="#2191D0" strokeWidth={2} fill="#2191D0" fillOpacity={0.12} dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="outpatient" name="Outpatient" stroke="#FF7F00" strokeWidth={2} fill="#FF7F00" fillOpacity={0.12} dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                ) : (
                  <LineChart data={reviewsData} margin={{ top: 2, right: 4, left: -26, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-platform)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 100]} ticks={[60, 70, 80, 90, 100]} tickFormatter={(v: number) => v + '%'} tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-platform)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-platform)' }} formatter={(v: number | undefined) => [(v ?? 0).toFixed(0) + '%', '']} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-platform)', paddingTop: 2 }} />
                    <Line type="monotone" dataKey="inpatient" name="Inpatient" stroke="#2191D0" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="outpatient" name="Outpatient" stroke="#FF7F00" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* ═══ PATIENTS ASSIGNED TO YOU TABLE ═══ */}
        <div className="dash-card overflow-hidden flex flex-col" style={{ order: 4, flex: 1, minHeight: 0 }}>
          <div className="p-4 pb-3">
            {/* Row 1 — tab switcher (assigned patients / documents to sign) + context action */}
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="flex items-end gap-6" role="tablist">
                <button
                  role="tab"
                  aria-selected={worklistTab === 'patients'}
                  onClick={() => setWorklistTab('patients')}
                  className="transition-colors focus:outline-none"
                  style={{
                    fontFamily: "var(--font-platform)",
                    fontWeight: 500,
                    fontSize: 24,
                    lineHeight: '100%',
                    letterSpacing: 0,
                    color: worklistTab === 'patients' ? '#000000' : 'rgba(0,0,0,0.30)',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  Patients assigned to you
                </button>
                <button
                  role="tab"
                  aria-selected={worklistTab === 'documents'}
                  onClick={() => setWorklistTab('documents')}
                  className="transition-colors focus:outline-none"
                  style={{
                    fontFamily: "var(--font-platform)",
                    fontWeight: 500,
                    fontSize: 24,
                    lineHeight: '100%',
                    letterSpacing: 0,
                    color: worklistTab === 'documents' ? '#000000' : 'rgba(0,0,0,0.30)',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  Documents to sign
                  {signCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: 'var(--color-warning)', color: '#fff', verticalAlign: 'middle' }}>
                      {signCount}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 pb-0.5">
                {worklistTab === 'patients' ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-danger)' }} /> Critical ({assignedRows.filter(r => r.triagePriority === 'RED').length})</span>
                    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-warning)' }} /> Watch ({assignedRows.filter(r => r.triagePriority === 'YELLOW').length})</span>
                    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-success)' }} /> Stable ({assignedRows.filter(r => r.triagePriority === 'GREEN').length})</span>
                    <button onClick={() => router.push('/patients')} className="text-[12px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                      {t('dashboard.details')} <ChevronRight className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--text-muted)' }} /> Drafts ({unsignedDrafts.length})</span>
                    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#6366F1' }} /> Co-sign ({awaitingCosign.length})</span>
                    <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-warning)' }} /> Outcome ({heldAssessments.length})</span>
                    <button onClick={() => router.push('/encounters')} className="text-[12px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                      Details <ChevronRight className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Row 2 — search + filters */}
            {worklistTab === 'documents' && (
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="search"
                value={docsSearch}
                onChange={(e) => setDocsSearch(e.target.value)}
                placeholder="Search by patient name…"
                className="flex-1 min-w-[200px]"
                style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 18px', fontSize: 13 }}
              />
              <select
                value={docsFilter}
                onChange={(e) => setDocsFilter(e.target.value as typeof docsFilter)}
                className="w-full sm:w-48"
                style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 16px', fontSize: 13 }}
                aria-label="Filter by document type"
              >
                <option value="all">All Types</option>
                <option value="draft">Unsigned drafts</option>
                <option value="cosign">Needs co-signature</option>
                <option value="outcome">Outcome measures</option>
              </select>
            </div>
            )}
            {worklistTab === 'patients' && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Pill-shaped search + filters (matches the design). */}
              <input
                type="search"
                value={assignedSearch}
                onChange={(e) => setAssignedSearch(e.target.value)}
                placeholder="Search by name or patient ID…"
                className="flex-1 min-w-[200px]"
                style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 18px', fontSize: 13 }}
              />
              {assignedDivisions.length > 0 && (
                <select
                  value={assignedDivision}
                  onChange={(e) => setAssignedDivision(e.target.value)}
                  className="w-full sm:w-44"
                  style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 16px', fontSize: 13 }}
                  aria-label="Filter by division"
                >
                  <option value="all">All Divisions</option>
                  {assignedDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <select
                value={assignedSort}
                onChange={(e) => setAssignedSort(e.target.value as 'acuity' | 'recent' | 'name' | 'age')}
                className="w-full sm:w-44"
                style={{ borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', padding: '9px 16px', fontSize: 13 }}
                aria-label="Sort"
              >
                <option value="acuity">Acuity (urgent first)</option>
                <option value="recent">Most recent</option>
                <option value="name">Name (A–Z)</option>
                <option value="age">Age (high→low)</option>
              </select>
            </div>
            )}
          </div>
          {worklistTab === 'patients' ? (
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="w-full" style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  {[t('patient.name'), t('nurse.colAge'), t('nurse.colGender'), t('dashboard.patientId'), t('dashboard.admitted'), t('dashboard.wardRoomNo'), t('dashboard.assignedDoctor'), t('dashboard.assignedNurse'), t('dashboard.division')].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      No patients are assigned to you right now.
                    </td>
                  </tr>
                )}
                {assignedRows.length > 0 && displayedAssigned.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      No assigned patients match your search or filter.
                    </td>
                  </tr>
                )}
                {displayedAssigned.map((p) => (
                  <tr
                    key={p._id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-[var(--table-row-hover)]"
                    onClick={() => router.push(`/patients/${p._id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/patients/${p._id}`); } }}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                    title={t('dashboard.viewPatientRecord')}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PatientAvatar
                          patient={p}
                          size={28}
                          color={
                            p.triagePriority === 'RED' ? '#DC2626' :
                            p.triagePriority === 'YELLOW' ? '#D97706' :
                            p.triagePriority === 'GREEN' ? '#059669' :
                            undefined
                          }
                        />
                        <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] tabular-nums whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.age != null ? `${p.age}y` : '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.gender || '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>{p.id}</td>
                    <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center gap-1">
                        {formatCompactDateTime(p.admittedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.ward}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.doctor || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.nurse || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td className="px-4 py-2.5">
                      {p.critical ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)' }}>
                          {p.division}
                        </span>
                      ) : (
                        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.division}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="w-full" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  {['Patient', 'Document', 'Detail', 'Date', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold" style={{ color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signCount === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      No outstanding clinical tasks.
                    </td>
                  </tr>
                )}
                {heldAssessments.filter(a => (docsFilter === 'all' || docsFilter === 'outcome') && (!docsSearch || signingPatientName(a.patientId).toLowerCase().includes(docsSearch.toLowerCase()))).length > 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-1.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Outcome measures</span>
                    </td>
                  </tr>
                )}
                {heldAssessments.filter(a => (docsFilter === 'all' || docsFilter === 'outcome') && (!docsSearch || signingPatientName(a.patientId).toLowerCase().includes(docsSearch.toLowerCase()))).map((a) => (
                  <tr
                    key={a._id}
                    className="cursor-pointer hover:bg-[var(--table-row-hover)]"
                    onClick={() => router.push(`/patients/${a.patientId}`)}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PatientAvatar patient={(() => { const p = signingPatientName(a.patientId).trim().split(/\s+/); return { firstName: p[0], surname: p[p.length - 1] }; })()} size={28} />
                        <span className="text-[12px] font-medium min-w-0" style={{ color: 'var(--text-primary)' }}>{signingPatientName(a.patientId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[12px]" style={{ color: '#B45309' }}>Outcome measure</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {a.instrumentName} · score {a.totalScore}{a.interpretation ? ` · ${a.interpretation}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>—</td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/patients/${a.patientId}`)} className="btn btn-sm btn-secondary">Review</button>
                    </td>
                  </tr>
                ))}
                {awaitingCosign.filter(r => (docsFilter === 'all' || docsFilter === 'cosign') && (!docsSearch || signingPatientName(r.patientId).toLowerCase().includes(docsSearch.toLowerCase()))).length > 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-1.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Co-signatures</span>
                    </td>
                  </tr>
                )}
                {awaitingCosign.filter(r => (docsFilter === 'all' || docsFilter === 'cosign') && (!docsSearch || signingPatientName(r.patientId).toLowerCase().includes(docsSearch.toLowerCase()))).map((r) => (
                  <tr
                    key={r._id}
                    className="cursor-pointer hover:bg-[var(--table-row-hover)]"
                    onClick={() => router.push(`/patients/${r.patientId}`)}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PatientAvatar patient={(() => { const p = signingPatientName(r.patientId).trim().split(/\s+/); return { firstName: p[0], surname: p[p.length - 1] }; })()} size={28} />
                        <span className="text-[12px] font-medium min-w-0" style={{ color: 'var(--text-primary)' }}>{signingPatientName(r.patientId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[12px]" style={{ color: '#B45309' }}>
                        {canCosign ? 'Needs co-sign' : 'Awaiting co-sign'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {r.chiefComplaint} · signed by {r.signedByName || 'trainee'}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>—</td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/patients/${r.patientId}`)} className="btn btn-sm btn-secondary">Review</button>
                    </td>
                  </tr>
                ))}
                {unsignedDrafts
                  .filter(r => (docsFilter === 'all' || docsFilter === 'draft') && (!docsSearch || signingPatientName(r.patientId).toLowerCase().includes(docsSearch.toLowerCase())))
                  .map((r) => (
                  <tr
                    key={r._id}
                    className="cursor-pointer hover:bg-[var(--table-row-hover)]"
                    onClick={() => router.push(`/patients/${r.patientId}`)}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PatientAvatar patient={(() => { const p = signingPatientName(r.patientId).trim().split(/\s+/); return { firstName: p[0], surname: p[p.length - 1] }; })()} size={28} />
                        <span className="text-[12px] font-medium min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{signingPatientName(r.patientId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Unsigned draft</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{r.chiefComplaint}</td>
                    <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{formatCompactDateTime(r.consultedAt || r.visitDate || r.createdAt)}</td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/patients/${r.patientId}`)} className="btn btn-sm btn-secondary">Sign</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* ═══ ROW 2 — Quick Actions (2×2) + Next Appointment ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-shrink-0" style={{ order: 1 }}>
          {/* Quick Actions */}
          <div className="md:col-span-2 lg:col-span-2 flex flex-col">
            <div className="dash-card p-4 flex flex-col gap-4 flex-1">
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.quickActions')}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map(a => (
                  <button
                    key={a.label}
                    onClick={a.action}
                    className="flex items-center gap-3 text-left transition-all hover:border-[var(--accent-primary)] hover:bg-[var(--accent-light)]"
                    style={{
                      height: 56,
                      borderRadius: 18,
                      border: '1px solid #202F394D',
                      background: 'var(--bg-card)',
                      padding: '0 14px',
                      width: '100%',
                    }}
                  >
                    <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34 }}>
                      <a.icon className="w-[17px] h-[17px]" style={{ color: '#2191D0' }} />
                    </span>
                    <span className="text-xs font-semibold leading-tight" style={{ color: '#2191D0' }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="hero-banner md:col-span-2 lg:col-span-1 flex flex-col" style={{ minHeight: 224, height: 224, padding: 0, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img aria-hidden src="/assets/union.png" alt="" style={{ position: 'absolute', width: 280, height: 280, top: -40, right: -40, zIndex: 0, pointerEvents: 'none', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.13, transform: 'rotate(10deg)' }} />

            {/* Fixed header */}
            <div className="relative z-[1] flex items-center justify-between flex-shrink-0" style={{ padding: '14px 16px 0' }}>
              <span style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 24, color: '#fff', lineHeight: 1, letterSpacing: 0 }}>
                Upcoming Appointments
                {myUpcomingAppts.length > 1 && (
                  <span style={{ marginLeft: 6, fontSize: 13, opacity: 0.6 }}>{apptIndex + 1}/{myUpcomingAppts.length}</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {myUpcomingAppts.length > 1 && (<>
                  <button
                    disabled={apptIndex === 0}
                    onClick={() => setApptIndex(apptIndex - 1)}
                    className="flex items-center justify-center transition-opacity"
                    style={{ background: 'none', border: 'none', padding: 4, opacity: apptIndex === 0 ? 0.4 : 1 }}
                    aria-label="Previous appointment"
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.88)' }} />
                  </button>
                  <button
                    disabled={apptIndex === myUpcomingAppts.length - 1}
                    onClick={() => setApptIndex(apptIndex + 1)}
                    className="flex items-center justify-center transition-opacity"
                    style={{ background: 'none', border: 'none', padding: 4, opacity: apptIndex === myUpcomingAppts.length - 1 ? 0.4 : 1 }}
                    aria-label="Next appointment"
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.88)' }} />
                  </button>
                </>)}
                <button
                  onClick={() => router.push('/appointments')}
                  className="flex items-center justify-center transition-opacity hover:opacity-100"
                  style={{ background: 'none', border: 'none', padding: 4, opacity: 1, marginLeft: 2 }}
                  aria-label="View all appointments"
                >
                  <ArrowUpRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.88)' }} />
                </button>
              </div>
            </div>

            {/* Scroll track — full-width cards, scroll hidden */}
            <div
              ref={apptCarouselRef}
              className="flex flex-1 min-h-0 scrollbar-none"
              style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', scrollBehavior: 'smooth', pointerEvents: 'none' }}
              onScroll={(e) => {
                if (apptScrolling.current) return;
                const el = e.currentTarget;
                setApptIndex(Math.round(el.scrollLeft / el.clientWidth));
              }}
            >
              {myUpcomingAppts.length > 0 ? myUpcomingAppts.map((appt) => {
                const when = new Date(apptKey(appt)).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={appt._id}
                    role="button"
                    tabIndex={0}
                    className="flex-shrink-0 flex flex-col relative"
                    onClick={() => setSelectedAppointment(appt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedAppointment(appt);
                      }
                    }}
                    style={{ width: '100%', scrollSnapAlign: 'start', padding: '10px 16px 16px', zIndex: 1, pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    {/* Patient info — vertically centered */}
                    <div className="flex-1 flex flex-col justify-center">
                      <div style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 24, color: '#fff', lineHeight: 1, letterSpacing: 0 }}>{appt.patientName}</div>
                      <div className="mt-1.5" style={{ fontFamily: "var(--font-platform)", fontWeight: 400, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>{when}</div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          updateApptStatus(appt._id, 'checked_in');
                        }}
                        className="transition-opacity hover:opacity-90"
                        style={{ background: '#fff', color: 'var(--text-primary)', fontFamily: "var(--font-platform)", fontWeight: 600, fontSize: 12, padding: '7px 18px', borderRadius: 999 }}
                      >
                        Check In
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/patients/${appt.patientId}`);
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 12 }}
                      >
                        Open Patient Record
                      </button>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex-shrink-0 flex items-center relative z-[1]" style={{ width: '100%', padding: '12px 16px 16px' }}>
                  <div style={{ fontFamily: "var(--font-platform)", fontWeight: 400, fontSize: 14, color: 'rgba(255,255,255,0.72)' }}>No upcoming appointments scheduled.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ AWAITING RESULTS — paused consultations to resume ═══ */}
        {resumableEncounters.length > 0 && (
          <div className="dash-card overflow-hidden flex-shrink-0" style={{ order: 2 }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm inline-flex items-center gap-2">
                <TestTube className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                Awaiting results
                <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>({resumableEncounters.length})</span>
              </h3>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Visits paused while labs are processed</span>
            </div>
            <div style={{ maxHeight: 222, overflowY: 'auto' }}>
              {resumableEncounters.map((e) => {
                const ready = e.allResultsBack;
                return (
                  <div
                    key={e._id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{e.patientName}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {e.resultsTotal} investigation{e.resultsTotal === 1 ? '' : 's'} ordered · {e.resultsReady}/{e.resultsTotal} back
                      </div>
                    </div>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded flex-shrink-0"
                      style={ready
                        ? { background: 'rgba(21,121,92,0.12)', color: 'var(--color-success)' }
                        : { background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}
                    >
                      {ready ? 'Results ready' : 'Waiting'}
                    </span>
                    <button
                      onClick={() => router.push(`/consultation?encounter=${e._id}`)}
                      className={`btn btn-sm flex-shrink-0 ${ready ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Resume
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents to sign now lives as a tab inside the worklist card above. */}

        {/* ═══ PATIENT CALLBACKS — open phone notes routed to me ═══ */}
        {phoneNotesInbox.length > 0 && (
          <div className="dash-card overflow-hidden flex-shrink-0" style={{ order: 2 }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm inline-flex items-center gap-2">
                <SendHorizontal className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                Patient callbacks
                <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>({phoneNotesInbox.length})</span>
              </h3>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Phone notes awaiting your response</span>
            </div>
            <div style={{ maxHeight: 264, overflowY: 'auto' }}>
              {phoneNotesInbox.map((n) => (
                <div key={n._id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{n.patientName || n.patientId}</div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{n.subject} · from {n.callerName || 'caller'}</div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded flex-shrink-0" style={{ background: 'rgba(217,119,6,0.12)', color: '#B45309' }}>Open</span>
                  <button onClick={() => router.push(`/patients/${n.patientId}`)} className="btn btn-sm btn-secondary flex-shrink-0">
                    Respond
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>

        {/* ═══════════════════════════════════════════════
            SOAP NOTE MODAL
        ═══════════════════════════════════════════════ */}
        <ModalOverlay open={soapModalOpen} onClose={() => { setSoapModalOpen(false); setSelectedTemplate(null); setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' }); setSoapPatientId(''); }} title={t('dashboard.newConsultationSoap')}>
          {/* Patient selector */}
          <div className="mb-4">
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('dashboard.selectPatient')}
            </label>
            <select
              value={soapPatientId}
              onChange={e => setSoapPatientId(e.target.value)}
              className="w-full p-2.5 rounded-xl text-[13px]"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('dashboard.selectPatientOption')}</option>
              {patients.slice(0, 20).map(p => (
                <option key={p._id} value={p._id}>
                  {p.firstName} {p.surname} ({p.hospitalNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Template selector */}
          <div className="mb-4">
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
              {t('dashboard.chooseTemplate')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SOAP_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all text-center"
                  style={{
                    background: selectedTemplate?.id === t.id ? `${t.color}15` : 'var(--bg-secondary)',
                    border: selectedTemplate?.id === t.id ? `2px solid ${t.color}` : '1px solid var(--border-light)',
                  }}
                >
                  <TemplateIcon icon={t.icon} color={t.color} />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SOAP fields */}
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map(field => (
            <div key={field} className="mb-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 mb-1.5" style={{ color: 'var(--text-muted)' }}>
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: field === 'subjective' ? 'var(--accent-primary)' : field === 'objective' ? 'var(--color-success)' : field === 'assessment' ? 'var(--color-warning)' : '#A855F7' }}>
                  {field[0].toUpperCase()}
                </span>
                {field === 'subjective' ? t('dashboard.soapSubjective') : field === 'objective' ? t('dashboard.soapObjective') : field === 'assessment' ? t('dashboard.soapAssessment') : t('dashboard.soapPlan')}
              </label>
              <textarea
                value={soapForm[field]}
                onChange={e => setSoapForm(prev => ({ ...prev, [field]: e.target.value }))}
                rows={field === 'plan' || field === 'objective' ? 5 : 3}
                className="w-full p-2.5 rounded-xl text-[12px] resize-y"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                placeholder={t('dashboard.enterFieldNotes', { field })}
              />
            </div>
          ))}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => { setSoapModalOpen(false); setSelectedTemplate(null); setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' }); }}
              className="px-4 py-2 rounded-xl text-[12px] font-medium"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
            >
              {t('action.cancel')}
            </button>
            <button
              onClick={handleSoapSave}
              disabled={!soapPatientId}
              title={!soapPatientId ? t('dashboard.selectPatientFirst') : undefined}
              className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: soapPatientId ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: soapPatientId ? 'pointer' : 'not-allowed' }}
            >
              {t('dashboard.openInConsultation')}
            </button>
          </div>
        </ModalOverlay>

        {/* ═══════════════════════════════════════════════
            PRESCRIPTION MODAL
        ═══════════════════════════════════════════════ */}
        <ModalOverlay open={prescribeModalOpen} onClose={() => { setPrescribeModalOpen(false); setPrescriptionItems([]); setPrescribePatientId(''); setPrescriptionSuccess(false); }} title={t('dashboard.quickPrescribe')}>
          {prescriptionSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle2 className="w-12 h-12" style={{ color: 'var(--color-success)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.prescriptionCreated')}</p>
            </div>
          ) : (
            <>
              {/* Patient selector */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboard.selectPatient')}
                </label>
                <select
                  value={prescribePatientId}
                  onChange={e => setPrescribePatientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl text-[13px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                >
                  <option value="">{t('dashboard.selectPatientOption')}</option>
                  {patients.slice(0, 20).map(p => (
                    <option key={p._id} value={p._id}>
                      {p.firstName} {p.surname} ({p.hospitalNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preset buttons */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboard.presetCombos')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESCRIPTION_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className="p-2.5 rounded-xl text-left transition-all"
                      style={{ background: `${preset.color}08`, border: `1px solid ${preset.color}20` }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Pill className="w-3.5 h-3.5" style={{ color: preset.color }} />
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{preset.name}</span>
                      </div>
                      <div className="space-y-0.5">
                        {preset.items.map((item, idx) => (
                          <p key={idx} className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            {item.medication} {item.dose} {item.frequency}
                          </p>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current prescription items */}
              {prescriptionItems.length > 0 && (
                <div className="mb-4">
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('dashboard.prescriptionItems', { count: prescriptionItems.length })}
                  </label>
                  <div className="space-y-2">
                    {prescriptionItems.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between p-2.5 rounded-xl"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                      >
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.medication}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{item.dose}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(62,207,142,0.08)', color: 'var(--color-success)' }}>{item.route}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}>{item.frequency}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--color-warning)' }}>{item.duration}</span>
                          </div>
                        </div>
                        <button onClick={() => handleRemovePrescriptionItem(i)} className="p-1 rounded-lg hover:opacity-80" style={{ background: 'rgba(229,46,66,0.08)' }}>
                          <X className="w-3 h-3" style={{ color: 'var(--color-danger)' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setPrescribeModalOpen(false); setPrescriptionItems([]); setPrescribePatientId(''); }}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                >
                  {t('action.cancel')}
                </button>
                <button
                  onClick={handleSubmitPrescription}
                  disabled={!prescribePatientId || prescriptionItems.length === 0}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-40"
                  style={{ background: '#A855F7' }}
                >
                  {t('dashboard.createPrescription', { count: prescriptionItems.length })}
                </button>
              </div>
            </>
          )}
        </ModalOverlay>

        {/* ═══════════════════════════════════════════════
            LAB ORDER MODAL
        ═══════════════════════════════════════════════ */}
        <ModalOverlay open={labModalOpen} onClose={() => { setLabModalOpen(false); setSelectedLabTests(new Set()); setLabPatientId(''); setLabOrderSuccess(false); }} title={t('dashboard.quickLabOrder')}>
          {labOrderSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle2 className="w-12 h-12" style={{ color: 'var(--color-success)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.labOrderSubmitted')}</p>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('dashboard.testsOrdered', { count: selectedLabTests.size })}</p>
            </div>
          ) : (
            <>
              {/* Patient selector */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboard.selectPatient')}
                </label>
                <select
                  value={labPatientId}
                  onChange={e => setLabPatientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl text-[13px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                >
                  <option value="">{t('dashboard.selectPatientOption')}</option>
                  {patients.slice(0, 20).map(p => (
                    <option key={p._id} value={p._id}>
                      {p.firstName} {p.surname} ({p.hospitalNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lab test checkboxes */}
              <div className="mb-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboard.selectTests')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMON_LAB_TESTS.map(test => {
                    const isSelected = selectedLabTests.has(test.id);
                    return (
                      <button
                        key={test.id}
                        onClick={() => handleToggleLabTest(test.id)}
                        className="flex items-center gap-3 p-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: isSelected ? 'rgba(33, 145, 208, 0.08)' : 'var(--bg-secondary)',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-light)',
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isSelected ? 'var(--accent-primary)' : 'transparent',
                            border: isSelected ? 'none' : '2px solid var(--border-light)',
                          }}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{test.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{test.specimen}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(33, 145, 208, 0.06)', color: 'var(--accent-primary)' }}>
                              {test.category}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected summary */}
              {selectedLabTests.size > 0 && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(59, 130, 246,0.04)', border: '1px solid rgba(33, 145, 208, 0.12)' }}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--accent-primary)' }}>
                    {t('dashboard.testsSelected', { count: selectedLabTests.size })}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {COMMON_LAB_TESTS.filter(t => selectedLabTests.has(t.id)).map(t => t.name).join(', ')}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setLabModalOpen(false); setSelectedLabTests(new Set()); setLabPatientId(''); }}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                >
                  {t('action.cancel')}
                </button>
                <button
                  onClick={handleSubmitLabOrder}
                  disabled={!labPatientId || selectedLabTests.size === 0}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--color-warning)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <TestTube className="w-3.5 h-3.5" />
                    {t('dashboard.orderTests', { count: selectedLabTests.size })}
                  </span>
                </button>
              </div>
            </>
          )}
        </ModalOverlay>

        {/* ── New Patient ── */}
        <ModalOverlay open={newPatientOpen} onClose={() => setNewPatientOpen(false)} title="New Patient">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>First Name</label>
                <input className="input-field" value={newPatientForm.firstName} onChange={e => setNewPatientForm(f => ({ ...f, firstName: e.target.value }))} placeholder="e.g. Amara" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Last Name</label>
                <input className="input-field" value={newPatientForm.lastName} onChange={e => setNewPatientForm(f => ({ ...f, lastName: e.target.value }))} placeholder="e.g. Deng" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                <input className="input-field" type="date" value={newPatientForm.dob} onChange={e => setNewPatientForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Gender</label>
                <select className="input-field" value={newPatientForm.gender} onChange={e => setNewPatientForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Phone (optional)</label>
              <input className="input-field" value={newPatientForm.phone} onChange={e => setNewPatientForm(f => ({ ...f, phone: e.target.value }))} placeholder="+211..." />
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button className="btn btn-secondary btn-sm" onClick={() => setNewPatientOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!newPatientForm.firstName || !newPatientForm.lastName}
                onClick={() => { setNewPatientOpen(false); router.push(`/patients/new?first=${encodeURIComponent(newPatientForm.firstName)}&last=${encodeURIComponent(newPatientForm.lastName)}&dob=${newPatientForm.dob}&gender=${newPatientForm.gender}&phone=${encodeURIComponent(newPatientForm.phone)}`); }}
              >
                Continue to Full Registration →
              </button>
            </div>
          </div>
        </ModalOverlay>

        {/* ── New Referral ── */}
        <ModalOverlay open={newReferralOpen} onClose={() => setNewReferralOpen(false)} title="New Referral">
          {referralDone ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" style={{ color: '#059669' }} />
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Referral submitted</p>
              <button className="btn btn-primary btn-sm" onClick={() => setNewReferralOpen(false)}>Done</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Patient</label>
                <select className="input-field" value={referralForm.patientId} onChange={e => setReferralForm(f => ({ ...f, patientId: e.target.value }))}>
                  <option value="">Select patient…</option>
                  {patients.slice(0, 50).map(p => <option key={p._id} value={p._id}>{patientFullName(p)}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Referring To (Facility)</label>
                <input className="input-field" value={referralForm.toFacility} onChange={e => setReferralForm(f => ({ ...f, toFacility: e.target.value }))} placeholder="e.g. Juba Teaching Hospital" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Reason for Referral</label>
                <textarea className="input-field" rows={3} value={referralForm.reason} onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))} placeholder="Clinical summary and reason…" />
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button className="btn btn-secondary btn-sm" onClick={() => setNewReferralOpen(false)}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!referralForm.patientId || !referralForm.toFacility}
                  onClick={() => { setNewReferralOpen(false); router.push(`/referrals?patient=${referralForm.patientId}&to=${encodeURIComponent(referralForm.toFacility)}&reason=${encodeURIComponent(referralForm.reason)}`); }}
                >
                  Open Full Form →
                </button>
              </div>
            </div>
          )}
        </ModalOverlay>

        {/* ── Book Appointment ── */}
        <ModalOverlay open={bookApptOpen} onClose={() => setBookApptOpen(false)} title="Book Appointment">
          {apptDone ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" style={{ color: '#059669' }} />
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Appointment booked</p>
              <button className="btn btn-primary btn-sm" onClick={() => setBookApptOpen(false)}>Done</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Patient</label>
                <select className="input-field" value={apptForm.patientId} onChange={e => setApptForm(f => ({ ...f, patientId: e.target.value }))}>
                  <option value="">Select patient…</option>
                  {patients.slice(0, 50).map(p => <option key={p._id} value={p._id}>{patientFullName(p)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Date</label>
                  <input className="input-field" type="date" value={apptForm.date} onChange={e => setApptForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Time</label>
                  <input className="input-field" type="time" value={apptForm.time} onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Type</label>
                <select className="input-field" value={apptForm.type} onChange={e => setApptForm(f => ({ ...f, type: e.target.value }))}>
                  {['OPD', 'ANC', 'Follow-up', 'Specialist', 'Procedure', 'Vaccination'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button className="btn btn-secondary btn-sm" onClick={() => setBookApptOpen(false)}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!apptForm.patientId || !apptForm.date || !apptForm.time}
                  onClick={() => { setBookApptOpen(false); router.push(`/appointments?patient=${apptForm.patientId}&date=${apptForm.date}&time=${apptForm.time}&type=${encodeURIComponent(apptForm.type)}`); }}
                >
                  Open Full Form →
                </button>
              </div>
            </div>
          )}
        </ModalOverlay>

        {/* ── ANC Visit ── */}
        <ModalOverlay open={ancOpen} onClose={() => setAncOpen(false)} title="ANC Visit">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Select Patient</label>
              <select className="input-field" value={ancPatientId} onChange={e => setAncPatientId(e.target.value)}>
                <option value="">Select patient…</option>
                {patients.filter(p => p.gender === 'Female').slice(0, 50).map(p => <option key={p._id} value={p._id}>{patientFullName(p)}</option>)}
              </select>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>You&apos;ll be taken to the full ANC visit form for this patient.</p>
            <div className="flex gap-2 justify-end mt-1">
              <button className="btn btn-secondary btn-sm" onClick={() => setAncOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!ancPatientId}
                onClick={() => { setAncOpen(false); router.push(`/anc?patient=${ancPatientId}`); }}
              >
                Open ANC Form →
              </button>
            </div>
          </div>
        </ModalOverlay>

        {/* ── Ward Admission ── */}
        <ModalOverlay open={wardAdmitOpen} onClose={() => setWardAdmitOpen(false)} title="Ward Admission">
          {admitDone ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" style={{ color: '#059669' }} />
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Patient admitted</p>
              <button className="btn btn-primary btn-sm" onClick={() => setWardAdmitOpen(false)}>Done</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Patient</label>
                <select className="input-field" value={admitForm2.patientId} onChange={e => setAdmitForm2(f => ({ ...f, patientId: e.target.value }))}>
                  <option value="">Select patient…</option>
                  {patients.slice(0, 50).map(p => <option key={p._id} value={p._id}>{patientFullName(p)} — {patientAge(p)}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Ward</label>
                <select className="input-field" value={admitForm2.wardId} onChange={e => setAdmitForm2(f => ({ ...f, wardId: e.target.value }))}>
                  <option value="">Select ward…</option>
                  {wards.filter(w => w.availableBeds > 0).map(w => <option key={w._id} value={w._id}>{w.name} ({w.availableBeds} beds free)</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Admitting Diagnosis</label>
                <input className="input-field" value={admitForm2.diagnosis} onChange={e => setAdmitForm2(f => ({ ...f, diagnosis: e.target.value }))} placeholder="e.g. Severe malaria" />
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button className="btn btn-secondary btn-sm" onClick={() => setWardAdmitOpen(false)}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!admitForm2.patientId || !admitForm2.wardId || !admitForm2.diagnosis}
                  onClick={() => { setWardAdmitOpen(false); router.push(`/wards?patient=${admitForm2.patientId}&ward=${admitForm2.wardId}&diagnosis=${encodeURIComponent(admitForm2.diagnosis)}`); }}
                >
                  Open Full Form →
                </button>
              </div>
            </div>
          )}
        </ModalOverlay>

        {selectedAppointment && (() => {
          const appointment = selectedAppointment as AppointmentDoc;
          return (
          <>
            <button
              type="button"
              className="appointment-detail-backdrop"
              aria-label="Close appointment details"
              onClick={() => setSelectedAppointment(null)}
            />
            <DashboardAppointmentDrawer
              appointment={appointment}
              patient={patients.find(patient => patient._id === appointment.patientId)}
              onClose={() => setSelectedAppointment(null)}
              onOpenPatient={() => {
                const patientId = appointment.patientId;
                setSelectedAppointment(null);
                router.push(`/patients/${patientId}`);
              }}
              onCheckIn={() => {
                const appointmentId = appointment._id;
                setSelectedAppointment(null);
                updateApptStatus(appointmentId, 'checked_in');
              }}
              onOpenSchedule={() => {
                setSelectedAppointment(null);
                router.push('/appointments');
              }}
            />
          </>
          );
        })()}

      </main>
      )}
    </>
  );
}

function DashboardAppointmentDrawer({
  appointment,
  patient,
  onClose,
  onOpenPatient,
  onCheckIn,
  onOpenSchedule,
}: {
  appointment: AppointmentDoc;
  patient?: PatientDoc;
  onClose: () => void;
  onOpenPatient: () => void;
  onCheckIn: () => void;
  onOpenSchedule: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'visit' | 'financial'>('visit');
  const visitRows = [
    { label: 'Patient Phone', value: appointment.patientPhone || patient?.phone || 'Not recorded' },
    { label: 'Date', value: dashboardFormatDate(appointment.appointmentDate) },
    { label: 'Time', value: dashboardAppointmentTimeRange(appointment) },
    { label: 'Duration', value: `${appointment.duration} minutes` },
    { label: 'Provider', value: appointment.providerName || 'Unassigned' },
    { label: 'Department', value: appointment.department || 'Not assigned' },
    { label: 'Visit Type', value: dashboardReadable(appointment.appointmentType) },
    { label: 'Visit Reason', value: appointment.reason || 'Not recorded' },
    { label: 'Facility', value: appointment.facilityName || 'Not assigned' },
    { label: 'Reminder', value: appointment.reminderSent ? `Sent${appointment.reminderChannel ? ` by ${appointment.reminderChannel}` : ''}` : 'Not sent' },
    { label: 'Recurring', value: appointment.isRecurring ? dashboardReadable(appointment.recurrencePattern || 'recurring') : 'No' },
    ...(appointment.notes ? [{ label: 'Notes', value: appointment.notes }] : []),
  ];
  const financialRows = [
    { label: 'Balance', value: '$0.00' },
    { label: 'Charge', value: appointment.status === 'completed' ? 'Ready for charge capture' : 'Charge not started' },
    { label: 'Payment Responsibility', value: 'Not recorded' },
    { label: 'Insurance', value: 'Not recorded' },
    { label: 'Claim Status', value: 'Not started' },
    { label: 'Booked By', value: appointment.bookedByName || appointment.bookedBy || 'Not recorded' },
    { label: 'Facility', value: appointment.facilityName || 'Not assigned' },
    { label: 'Facility Level', value: dashboardReadable(appointment.facilityLevel) },
    { label: 'Patient Intake', value: appointment.reminderSent ? 'Sent to patient' : 'Not sent to patient' },
  ];
  const detailRows = activeTab === 'visit' ? visitRows : financialRows;

  return (
    <aside className="appointment-detail-sidebar" aria-label="Appointment details" role="dialog" aria-modal="true">
      <div className="appointment-detail-sidebar__header">
        <button type="button" className="appointment-detail-sidebar__back" onClick={onClose} aria-label="Close appointment details">
          <ChevronLeft size={22} />
        </button>
        <div className="appointment-detail-sidebar__title">
          <h2>{dashboardAppointmentTimeRange(appointment)}</h2>
          <button type="button" onClick={onOpenPatient}>{appointment.patientName}</button>
          <p>{patient ? `${patientAge(patient)} · ${patient.gender || 'Sex not recorded'}` : appointment.patientPhone || 'Patient details not loaded'}</p>
          <div className="appointment-detail-sidebar__status">
            <span>{dashboardReadable(appointment.status)}</span>
            <span>{dashboardReadable(appointment.priority)}</span>
          </div>
        </div>
        <button type="button" className="appointment-detail-sidebar__close" onClick={onClose} aria-label="Close appointment details">
          <X size={16} />
        </button>
      </div>

      <div className="appointment-detail-sidebar__tabs" role="tablist" aria-label="Appointment detail sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'visit'}
          className={activeTab === 'visit' ? 'active' : undefined}
          onClick={() => setActiveTab('visit')}
        >
          Visit Information
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'financial'}
          className={activeTab === 'financial' ? 'active' : undefined}
          onClick={() => setActiveTab('financial')}
        >
          Financial Information
        </button>
      </div>

      <div className="appointment-detail-sidebar__body" role="tabpanel">
        {detailRows.map(row => (
          <DashboardDetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      <div className="appointment-detail-sidebar__actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenPatient}>Open patient record</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCheckIn}>Check in</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenSchedule}>Open schedule</button>
      </div>
    </aside>
  );
}

function DashboardDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="appointment-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function dashboardAppointmentTimeRange(appointment: AppointmentDoc) {
  const start = appointment.appointmentTime || '00:00';
  if (appointment.endTime) return `${start} - ${appointment.endTime}`;
  return `${start} · ${appointment.duration}m`;
}

function dashboardFormatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' });
}

function dashboardReadable(value?: string) {
  if (!value) return 'Not recorded';
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
