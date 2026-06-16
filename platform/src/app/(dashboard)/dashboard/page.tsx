'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Modal from '@/components/Modal';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import {
  Users, AlertTriangle,
  ChevronRight, Stethoscope,
  Syringe, HeartPulse, Baby, FlaskConical,
  FileText, Pill,
  SendHorizontal,
  X, ClipboardList, TestTube, Clock,
  CheckCircle2, Search, Globe, ExternalLink, RefreshCw,
  LayoutDashboard,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useResumableEncounters } from '@/lib/hooks/useResumableEncounters';
import { useTriage } from '@/lib/hooks/useTriage';
import { formatCompactDateTime } from '@/lib/format-utils';
import { getDefaultDashboard } from '@/lib/permissions';
import SuperintendentDashboard from '@/components/dashboards/SuperintendentDashboard';
import { useTranslation } from '@/lib/i18n/useTranslation';

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

  // Facility Sync — the data elements/documents this facility pushes to the
  // national HMIS, each with its current sync status. The "syncing" item shows
  // an animated spinner while it's in flight.
  const SYNC_ELEMENTS: { name: string; status: 'synced' | 'syncing' | 'pending' }[] = [
    { name: 'OPD Attendance', status: 'synced' },
    { name: 'Malaria Cases', status: 'synced' },
    { name: 'ANC Visits', status: 'synced' },
    { name: 'Immunizations', status: 'synced' },
    { name: 'Births', status: 'synced' },
    { name: 'Deaths', status: 'synced' },
    { name: 'Lab Results', status: 'synced' },
    { name: 'Referrals', status: 'synced' },
    { name: 'Inpatient Admissions', status: 'syncing' },
    { name: 'Drug Stock Levels', status: 'pending' },
  ];
  const syncedCount = SYNC_ELEMENTS.filter(e => e.status === 'synced').length;

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



  // Worklist table data: patients assigned to the signed-in clinician.
  // The assigning provider (often a nurse) and assignment time come from the
  // patient record; ward/division are sampled in demo mode for visual richness
  // and left blank in production rather than inventing a clinical team.
  const assignedRows = myAssigned.map((p, i) => ({
    _id: p._id,
    name: `${p.firstName} ${p.surname}`,
    age: p.estimatedAge || (p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : 25 + i * 3),
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
      return matchesSearch && matchesDivision;
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


  return (
    <>
      <TopBar title={t('nav.dashboard')} />
      <main className="page-container page-enter">

        {/* Clinical alerts moved to a dedicated /alerts page. */}

        <div className="flex flex-col gap-5 h-full min-h-0">
        {/* ═══ PAGE HEADER (Patient Registry-style) — order:0 so it sits at the
            top and pushes Quick Actions + Sync down to align with the sidebar
            navigation. ═══ */}
        <div style={{ order: 0 }} className="flex-shrink-0">
          <PageHeader
            icon={LayoutDashboard}
            title={t('nav.dashboard')}
            subtitle={currentUser?.hospitalName || 'Clinical overview'}
          />
        </div>

        {/* ═══ PATIENTS ASSIGNED TO YOU TABLE ═══ */}
        <div className="dash-card overflow-hidden flex flex-col" style={{ order: 4, flex: 1, minHeight: 0 }}>
          <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            {/* Row 1 — title + details */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Patients assigned to you <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>({displayedAssigned.length}{displayedAssigned.length !== assignedRows.length ? ` / ${assignedRows.length}` : ''})</span></h3>
              <button onClick={() => router.push('/patients')} className="text-[12px] font-medium flex items-center gap-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }}>
                {t('dashboard.details')} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {/* Row 2 — search + filters (matches the patient registry) */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="search"
                  value={assignedSearch}
                  onChange={(e) => setAssignedSearch(e.target.value)}
                  placeholder="Search by name or patient ID…"
                  className="pl-9 search-icon-input w-full"
                  style={{ background: 'var(--overlay-subtle)' }}
                />
              </div>
              {assignedDivisions.length > 0 && (
                <select
                  value={assignedDivision}
                  onChange={(e) => setAssignedDivision(e.target.value)}
                  className="w-full sm:w-44"
                  style={{ background: 'var(--overlay-subtle)' }}
                  aria-label="Filter by division"
                >
                  <option value="all">All divisions</option>
                  {assignedDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <select
                value={assignedSort}
                onChange={(e) => setAssignedSort(e.target.value as 'acuity' | 'recent' | 'name' | 'age')}
                className="w-full sm:w-44"
                style={{ background: 'var(--overlay-subtle)' }}
                aria-label="Sort"
              >
                <option value="acuity">Acuity (urgent first)</option>
                <option value="recent">Most recent</option>
                <option value="name">Name (A–Z)</option>
                <option value="age">Age (high→low)</option>
              </select>
            </div>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="w-full">
              <thead>
                <tr>
                  {[t('patient.name'), t('dashboard.patientId'), t('dashboard.admitted'), t('dashboard.wardRoomNo'), t('dashboard.assignedDoctor'), t('dashboard.assignedNurse'), t('dashboard.division')].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      No patients are assigned to you right now.
                    </td>
                  </tr>
                )}
                {assignedRows.length > 0 && displayedAssigned.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
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
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: p.gender === 'F' ? 'linear-gradient(135deg, #D96E59 0%, #C44536 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1E3A8A 100%)', letterSpacing: 0.3 }}
                          aria-hidden
                        >
                          {p.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                          <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-muted)' }}>{p.age} Y, {p.gender}</span>
                          {p.triagePriority && (
                            <span className="text-[8px] font-bold uppercase tracking-wider ml-1.5 px-1.5 py-0.5 rounded align-middle" style={{
                              background: p.triagePriority === 'RED' ? 'rgba(229,46,66,0.12)' : p.triagePriority === 'YELLOW' ? 'rgba(217,119,6,0.12)' : 'rgba(21,121,92,0.12)',
                              color: p.triagePriority === 'RED' ? 'var(--color-danger)' : p.triagePriority === 'YELLOW' ? 'var(--color-warning)' : 'var(--color-success)',
                            }}>{p.triagePriority}</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>{p.id}</td>
                    <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
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
        </div>

        {/* ═══ TOP ROW — Quick Actions + Facility Sync ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-shrink-0" style={{ order: 1 }}>
          {/* Quick Actions */}
          <div className="dash-card p-3 lg:col-span-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('dashboard.quickActions')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: t('dashboard.newPatient'), icon: Users, action: () => router.push('/patients/new'), color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246,0.10)' },
                { label: t('action.newConsultation'), icon: ClipboardList, action: () => setSoapModalOpen(true), color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246,0.10)' },
                { label: t('dashboard.quickPrescribe'), icon: Pill, action: () => setPrescribeModalOpen(true), color: '#1E3A8A', bg: 'rgba(13,148,136,0.10)' },
                { label: t('dashboard.quickLabOrder'), icon: TestTube, action: () => setLabModalOpen(true), color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
                { label: t('dashboard.immunization'), icon: Syringe, action: () => router.push('/immunizations'), color: '#059669', bg: 'rgba(5,150,105,0.10)' },
                { label: t('dashboard.ancVisit'), icon: HeartPulse, action: () => router.push('/anc'), color: '#EC4899', bg: 'rgba(236,72,153,0.10)' },
                { label: t('dashboard.birthReg'), icon: Baby, action: () => router.push('/births'), color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246,0.10)' },
                { label: t('nav.referrals'), icon: SendHorizontal, action: () => router.push('/referrals'), color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="flex flex-col items-center justify-center text-center gap-1.5 p-2.5 rounded-xl transition-all hover:shadow-sm hover:-translate-y-0.5"
                  style={{ background: action.bg, border: '1px solid var(--border-light)' }}
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card-solid)' }}>
                    <action.icon className="w-4 h-4" style={{ color: action.color }} />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Facility Sync (national HMIS / DHIS2 connection) */}
          <div className="dash-card p-3 lg:col-span-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Globe className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /> Facility Sync
              </h3>
              <button onClick={() => router.push('/dhis2-export')} className="text-[11px] font-semibold inline-flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                Open <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            {/* Summary line */}
            <div className="flex items-center justify-between pb-2 mb-1 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <span className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success)' }} /> Connected
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{syncedCount}/{SYNC_ELEMENTS.length} synced · 08:00</span>
            </div>
            {/* Per-document sync status — scrolls within the card so the panel
                stays exactly as tall as the Quick Actions card beside it. */}
            <div className="relative flex-1 min-h-0">
              <div className="overflow-y-auto pr-1 lg:absolute lg:inset-0">
                {SYNC_ELEMENTS.map(el => {
                  const cfg = el.status === 'synced'
                    ? { color: 'var(--color-success)', label: 'Synced' }
                    : el.status === 'syncing'
                    ? { color: 'var(--accent-primary)', label: 'Syncing' }
                    : { color: 'var(--color-warning)', label: 'Pending' };
                  return (
                    <div key={el.name} className="flex items-center justify-between py-1">
                      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{el.name}</span>
                      <span className="text-[10px] font-semibold inline-flex items-center gap-1 flex-shrink-0" style={{ color: cfg.color }}>
                        {el.status === 'synced' && <CheckCircle2 className="w-3 h-3" />}
                        {el.status === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                        {el.status === 'pending' && <Clock className="w-3 h-3" />}
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ AWAITING RESULTS — paused consultations to resume ═══ */}
        {resumableEncounters.length > 0 && (
          <div className="dash-card overflow-hidden flex-shrink-0" style={{ order: 2 }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm inline-flex items-center gap-2">
                <TestTube className="w-4 h-4" style={{ color: '#7C3AED' }} />
                Awaiting results
                <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>({resumableEncounters.length})</span>
              </h3>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Visits paused while labs are processed</span>
            </div>
            <div style={{ maxHeight: 222, overflowY: 'auto' }}>
              {resumableEncounters.map((e, i) => {
                const initials = (e.patientName || '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
                const avatarBg = ['#7C3AED', '#1E3A8A', '#B8741C', '#15795C', '#C44536'][i % 5];
                const ready = e.allResultsBack;
                return (
                  <div
                    key={e._id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: avatarBg }}>{initials}</div>
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
                      className="p-2.5 rounded-xl text-left transition-all hover:scale-[1.01]"
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
                          background: isSelected ? 'rgba(59, 130, 246,0.08)' : 'var(--bg-secondary)',
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
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(59, 130, 246,0.06)', color: 'var(--accent-primary)' }}>
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
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(59, 130, 246,0.04)', border: '1px solid rgba(59, 130, 246,0.12)' }}>
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

      </main>
    </>
  );
}
