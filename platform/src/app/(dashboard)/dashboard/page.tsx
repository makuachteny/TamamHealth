'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import TopBar from '@/components/TopBar';
import {
  Users, User, AlertTriangle,
  ChevronRight, Stethoscope,
  Syringe, HeartPulse, Baby, FlaskConical,
  FileText, Globe, Pill,
  ArrowUpRight, SendHorizontal,
  X, ClipboardList, TestTube, Clock,
  CheckCircle2, Search,
  BarChart3, TrendingUp, PieChart as PieChartIcon
} from '@/components/icons/lucide';
import EmptyState from '@/components/EmptyState';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { usePatients } from '@/lib/hooks/usePatients';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { formatCompactDateTime } from '@/lib/format-utils';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useANC } from '@/lib/hooks/useANC';
import { useBirths } from '@/lib/hooks/useBirths';
import { getDefaultDashboard } from '@/lib/permissions';
import ReferralChainTracker from '@/components/ReferralChainTracker';
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

// Chart tooltip
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="dash-card p-3" style={{ fontSize: '0.75rem' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const SATISFACTION_COLORS = ['var(--color-success)', '#5CB8A8', 'var(--color-warning)', '#F87171'];

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
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel--lg">
        <div className="flex items-center justify-between p-4 sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ background: 'var(--bg-secondary)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
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
  const { referrals } = useReferrals();
  const { alerts: diseaseAlerts } = useSurveillance();
  const { stats: immStats } = useImmunizations();
  const { stats: ancStats } = useANC();
  const { stats: birthStats } = useBirths();
  const [activeTab, setActiveTab] = useState('satisfaction');

  // Patients a nurse has assigned to this clinician for care.
  const myAssigned = useMemo(
    () => patients
      .filter(p => p.assignedDoctor && p.assignedDoctor === currentUser?._id)
      .sort((a, b) => (b.assignedAt ?? '').localeCompare(a.assignedAt ?? '')),
    [patients, currentUser?._id],
  );

  // Disease trend explorer
  const [diseaseSearch, setDiseaseSearch] = useState('');
  const [selectedDiseases, setSelectedDiseases] = useState<Set<string>>(new Set(['Malaria', 'Pneumonia', 'Diarrheal']));
  const [showDiseaseDropdown, setShowDiseaseDropdown] = useState(false);

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
      currentUser.role !== 'medical_superintendent'
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
  // Anyone else who isn't a doctor/clinical officer is mid-redirect (above).
  if (currentUser.role !== 'doctor' && currentUser.role !== 'clinical_officer') return null;

  const hospital = currentUser.hospital;

  const activeAlerts = diseaseAlerts.filter(a => a.alertLevel === 'emergency' || a.alertLevel === 'warning');
  const pendingReferrals = referrals.filter(r => r.status === 'sent' || r.status === 'received');

  // In demo mode, derive plausible breakdowns from the seeded patient list so
  // the charts have something to show. In production these numbers are real
  // operational counts, not estimates — gate everything behind IS_DEMO and
  // fall back to zero so the UI surfaces "no data" instead of an invented
  // gender split or invented occupancy rate.
  const bedOccupancy = hospital && IS_DEMO ? Math.round((hospital.totalBeds * 0.72)) : 0;
  const bedTotal = hospital?.totalBeds || 0;
  const maleCount = IS_DEMO ? Math.floor(patients.length * 0.55) : 0;
  const femaleCount = IS_DEMO ? patients.length - maleCount : 0;
  const waitingCount = IS_DEMO ? Math.floor(patients.length * 0.12) : 0;
  const dischargeCount = IS_DEMO ? Math.floor(patients.length * 0.15) : 0;
  const transferCount = IS_DEMO ? Math.floor(patients.length * 0.02) : 0;

  const totalDoctors = hospital?.doctors || 0;
  const totalNurses = hospital?.nurses || 0;

  // Patient satisfaction — placeholder until a survey service exists.
  const satisfactionData = IS_DEMO
    ? [
        { name: 'Excellent', value: 54, color: 'var(--color-success)' },
        { name: 'Good', value: 23, color: '#5CB8A8' },
        { name: 'Average', value: 20, color: 'var(--color-warning)' },
        { name: 'Poor', value: 3, color: '#F87171' },
      ]
    : [];
  const satisfactionRate = IS_DEMO ? 76 : 0;

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
  }));

  // Bed occupancy bar chart. The ICU/Maternity/Pediatric defaults (8/30/20)
  // are demo placeholders for unfurnished hospital records — in production we
  // only render counts the hospital itself has reported.
  const bedChartData = [
    { status: t('dashboard.bedIcu'), beds: hospital?.icuBeds ?? (IS_DEMO ? 8 : 0), color: 'var(--color-danger)' },
    { status: t('dashboard.bedMaternity'), beds: hospital?.maternityBeds ?? (IS_DEMO ? 30 : 0), color: '#EC4899' },
    { status: t('dashboard.bedPediatric'), beds: hospital?.pediatricBeds ?? (IS_DEMO ? 20 : 0), color: '#5CB8A8' },
    { status: t('dashboard.bedGeneral'), beds: Math.max(0, bedTotal - (hospital?.icuBeds || 0) - (hospital?.maternityBeds || 0) - (hospital?.pediatricBeds || 0)), color: 'var(--color-success)' },
    { status: t('dashboard.bedAvailable'), beds: Math.max(0, bedTotal - bedOccupancy), color: 'var(--text-muted)' },
  ];

  // Weekly in/out-patient trend — derived from a fixed ratio of the seeded
  // patient list. There is no real time-series source yet, so production
  // collapses the chart to zeros until a real aggregator backs it.
  const inOutData = IS_DEMO
    ? [
        { week: 'Week 1', 'In Patients': Math.floor(patients.length * 0.3), 'Out Patients': Math.floor(patients.length * 0.18) },
        { week: 'Week 2', 'In Patients': Math.floor(patients.length * 0.35), 'Out Patients': Math.floor(patients.length * 0.22) },
        { week: 'Week 3', 'In Patients': Math.floor(patients.length * 0.28), 'Out Patients': Math.floor(patients.length * 0.2) },
        { week: 'Week 4', 'In Patients': Math.floor(patients.length * 0.4), 'Out Patients': Math.floor(patients.length * 0.25) },
      ]
    : [
        { week: 'Week 1', 'In Patients': 0, 'Out Patients': 0 },
        { week: 'Week 2', 'In Patients': 0, 'Out Patients': 0 },
        { week: 'Week 3', 'In Patients': 0, 'Out Patients': 0 },
        { week: 'Week 4', 'In Patients': 0, 'Out Patients': 0 },
      ];

  // ── Disease catalog with monthly trend data ──
  const DISEASE_COLORS: Record<string, string> = {
    'Malaria': '#EF4444', 'Pneumonia': '#F59E0B', 'Diarrheal': '#3b82f6', 'HIV/AIDS': '#8B5CF6',
    'Tuberculosis': '#6366F1', 'Typhoid': '#EC4899', 'Measles': '#14B8A6', 'Cholera': '#06B6D4',
    'Hypertension': '#F97316', 'Diabetes': '#A855F7', 'Malnutrition': '#EAB308', 'Meningitis': '#DC2626',
    'Hepatitis B': '#059669', 'Sickle Cell': '#D946EF', 'Leishmaniasis': '#0EA5E9', 'Epilepsy': '#5A7370',
    'Asthma': '#10B981', 'UTI': '#E11D48', 'Maternal': '#EC4899', 'Snakebite': '#84CC16',
    'Burns': '#FB923C', 'Other': '#8A9E9A',
  };
  const MONTHS_LABEL = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  const pLen = Math.max(patients.length, 1);
  // Disease catalog with monthly trends. The numbers below are demo-only —
  // they are derived from `pLen * fixed_ratio` to seed the chart. In
  // production the catalog falls back to zero counts so the page does not
  // present invented case loads as if they came from real surveillance.
  const allDiseases: { name: string; currentCases: number; trend: number[] }[] = IS_DEMO
    ? [
        { name: 'Malaria', currentCases: Math.floor(pLen * 0.35), trend: [28, 32, 38, 42, 35, Math.floor(pLen * 0.35)] },
        { name: 'Pneumonia', currentCases: Math.floor(pLen * 0.12), trend: [8, 10, 14, 12, 11, Math.floor(pLen * 0.12)] },
        { name: 'Diarrheal', currentCases: Math.floor(pLen * 0.15), trend: [12, 14, 18, 15, 13, Math.floor(pLen * 0.15)] },
        { name: 'HIV/AIDS', currentCases: Math.floor(pLen * 0.08), trend: [6, 6, 7, 7, 8, Math.floor(pLen * 0.08)] },
        { name: 'Tuberculosis', currentCases: Math.floor(pLen * 0.05), trend: [4, 5, 4, 5, 5, Math.floor(pLen * 0.05)] },
        { name: 'Typhoid', currentCases: Math.floor(pLen * 0.06), trend: [3, 5, 7, 6, 5, Math.floor(pLen * 0.06)] },
        { name: 'Measles', currentCases: Math.floor(pLen * 0.03), trend: [1, 2, 4, 5, 3, Math.floor(pLen * 0.03)] },
        { name: 'Cholera', currentCases: Math.floor(pLen * 0.04), trend: [2, 3, 6, 8, 5, Math.floor(pLen * 0.04)] },
        { name: 'Hypertension', currentCases: Math.floor(pLen * 0.07), trend: [5, 5, 6, 6, 7, Math.floor(pLen * 0.07)] },
        { name: 'Diabetes', currentCases: Math.floor(pLen * 0.04), trend: [3, 3, 3, 4, 4, Math.floor(pLen * 0.04)] },
        { name: 'Malnutrition', currentCases: Math.floor(pLen * 0.09), trend: [7, 8, 10, 11, 9, Math.floor(pLen * 0.09)] },
        { name: 'Meningitis', currentCases: Math.floor(pLen * 0.02), trend: [1, 1, 2, 3, 2, Math.floor(pLen * 0.02)] },
        { name: 'Hepatitis B', currentCases: Math.floor(pLen * 0.03), trend: [2, 2, 3, 3, 3, Math.floor(pLen * 0.03)] },
        { name: 'Sickle Cell', currentCases: Math.floor(pLen * 0.02), trend: [2, 2, 2, 2, 2, Math.floor(pLen * 0.02)] },
        { name: 'Leishmaniasis', currentCases: Math.floor(pLen * 0.01), trend: [1, 1, 1, 2, 1, Math.floor(pLen * 0.01)] },
        { name: 'Asthma', currentCases: Math.floor(pLen * 0.03), trend: [2, 3, 3, 3, 3, Math.floor(pLen * 0.03)] },
        { name: 'UTI', currentCases: Math.floor(pLen * 0.05), trend: [3, 4, 5, 5, 4, Math.floor(pLen * 0.05)] },
        { name: 'Maternal', currentCases: Math.floor(pLen * 0.12), trend: [9, 10, 11, 12, 11, Math.floor(pLen * 0.12)] },
        { name: 'Snakebite', currentCases: Math.floor(pLen * 0.02), trend: [1, 2, 3, 2, 2, Math.floor(pLen * 0.02)] },
        { name: 'Burns', currentCases: Math.floor(pLen * 0.02), trend: [1, 1, 2, 2, 2, Math.floor(pLen * 0.02)] },
      ]
    : [];

  // Filter diseases for dropdown search
  const filteredDiseaseList = diseaseSearch
    ? allDiseases.filter(d => d.name.toLowerCase().includes(diseaseSearch.toLowerCase()))
    : allDiseases;

  // Build trend chart data from selected diseases
  const trendChartData = MONTHS_LABEL.map((month, i) => {
    const point: Record<string, string | number> = { month };
    selectedDiseases.forEach(name => {
      const disease = allDiseases.find(d => d.name === name);
      if (disease) point[name] = disease.trend[i];
    });
    return point;
  });

  // Donut data from selected diseases
  const diseaseDistribution = Array.from(selectedDiseases).map(name => {
    const d = allDiseases.find(x => x.name === name);
    return { name, value: d?.currentCases || 0, color: DISEASE_COLORS[name] || '#8A9E9A' };
  });
  const totalCases = diseaseDistribution.reduce((s, d) => s + d.value, 0);

  const TABS = ['satisfaction', 'equipment', 'department', 'avg-wait'] as const;

  // Equipment / department / wait-time charts are demo-only stand-ins until
  // the corresponding services land. In production we render an empty chart
  // rather than fabricated percentages.
  const equipmentData = IS_DEMO
    ? [
        { name: 'Operational', value: 72, color: 'var(--color-success)' },
        { name: 'Needs Repair', value: 15, color: 'var(--color-warning)' },
        { name: 'Out of Service', value: 8, color: '#F87171' },
        { name: 'On Order', value: 5, color: '#5CB8A8' },
      ]
    : [];
  const equipmentRate = IS_DEMO ? 72 : 0;

  const departmentData = IS_DEMO
    ? [
        { name: 'OPD', value: 35, color: 'var(--color-success)' },
        { name: 'Emergency', value: 25, color: '#F87171' },
        { name: 'Maternity', value: 22, color: '#EC4899' },
        { name: 'Pediatrics', value: 18, color: '#5CB8A8' },
      ]
    : [];

  const waitTimeData = IS_DEMO
    ? [
        { name: 'OPD', value: 45, color: '#5CB8A8' },
        { name: 'Emergency', value: 12, color: '#F87171' },
        { name: 'Lab', value: 30, color: '#A855F7' },
        { name: 'Pharmacy', value: 20, color: 'var(--color-success)' },
      ]
    : [];
  const avgWaitTime = IS_DEMO ? 27 : 0;

  // Get data for active tab
  const getTabData = () => {
    switch (activeTab) {
      case 'equipment': return { data: equipmentData, center: `${equipmentRate}%`, colors: equipmentData.map(d => d.color) };
      case 'department': return { data: departmentData, center: `${departmentData.length}`, colors: departmentData.map(d => d.color) };
      case 'avg-wait': return { data: waitTimeData, center: `${avgWaitTime}m`, colors: waitTimeData.map(d => d.color) };
      default: return { data: satisfactionData, center: `${satisfactionRate}%`, colors: SATISFACTION_COLORS };
    }
  };
  const tabContent = getTabData();

  return (
    <>
      <TopBar title={t('nav.dashboard')} />
      <main className="page-container page-enter">

        {/* Clinical alerts moved to a dedicated /alerts page. */}

        {/* ═══ TOP ROW: KPI Cards ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

          {/* ── Admitted Patients ── */}
          <div className="dash-card" style={{ padding: '14px 16px' }}>
            <div className="kpi-card-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <Users className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <span className="kpi-card-title">{t('dashboard.admittedPatients')}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 2 }}><ArrowUpRight className="w-3 h-3" />2%</span>
            </div>
            <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em' }}>{patients.length || 0}</div>
            <hr className="section-divider" />
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              {[{ n: maleCount, l: t('patient.male'), c: '#4A99C9' }, { n: femaleCount, l: t('patient.female'), c: '#EC4899' }].map(g => (
                <div key={g.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User className="w-4 h-4" style={{ color: g.c }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}><span className="stat-value" style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: 3 }}>{g.n}</span>{g.l}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10, display: 'flex', gap: 0 }}>
              {[
                { v: waitingCount, l: t('dashboard.waiting'), c: 'var(--color-warning)' },
                { v: dischargeCount, l: t('dashboard.discharge'), c: 'var(--color-success)' },
                { v: transferCount, l: t('dashboard.transfer'), c: 'var(--accent-primary)' },
              ].map((s, i) => (
                <div key={s.l} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid var(--border-light)' : 'none' }}>
                  <div className="stat-value" style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Active Staff ── */}
          <div className="dash-card" style={{ padding: '14px 16px' }}>
            <div className="kpi-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <Users className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <span className="kpi-card-title">{t('dashboard.activeStaff')}</span>
              </div>
            </div>
            <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em' }}>{totalDoctors + totalNurses}</div>
            <hr className="section-divider" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { Icon: Stethoscope, label: t('dashboard.doctors'), count: totalDoctors, color: 'var(--accent-primary)', bg: 'var(--accent-light)' },
                { Icon: HeartPulse, label: t('dashboard.nursing'), count: totalNurses, color: '#D96E59', bg: 'rgba(217, 110, 89, 0.14)' },
              ].map((r, i) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    paddingTop: i > 0 ? 8 : 0,
                    marginTop: i > 0 ? 8 : 0,
                    borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
                  }}
                >
                  <div className="icon-box-sm" style={{ background: r.bg }}>
                    <r.Icon className="w-3.5 h-3.5" style={{ color: r.color }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{r.label}</span>
                  <span
                    className="stat-value"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: r.color,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick Overview ── */}
          <div
            className="dash-card"
            style={activeAlerts.length > 0
              ? { padding: '14px 16px', border: '1.5px solid #C44536' }
              : { padding: '14px 16px' }}
          >
            <div className="kpi-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <ClipboardList className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <span className="kpi-card-title">{t('dashboard.quickOverview')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { Icon: SendHorizontal, label: t('dashboard.pendingReferrals'), value: pendingReferrals.length, color: '#B8741C', bg: 'rgba(228, 168, 75, 0.16)', alarm: false, href: '/referrals' },
                { Icon: AlertTriangle, label: t('dashboard.activeAlerts'), value: activeAlerts.length, color: '#C44536', bg: 'rgba(196, 69, 54, 0.14)', alarm: activeAlerts.length > 0, href: '/alerts' },
                { Icon: Syringe, label: t('nav.immunizations'), value: immStats?.totalVaccinations || 0, color: 'var(--accent-primary)', bg: 'var(--accent-light)', alarm: false, href: '/immunizations' },
                { Icon: Baby, label: t('dashboard.ancBirths'), value: `${ancStats?.totalVisits || 0} / ${birthStats?.total || 0}`, color: '#D96E59', bg: 'rgba(217, 110, 89, 0.16)', alarm: false, href: '/anc' },
              ].map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="text-left transition-colors"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: item.alarm ? '6px 8px' : 0,
                    margin: item.alarm ? `${i > 0 ? 6 : 0}px -4px 0 -4px` : 0,
                    paddingTop: item.alarm ? 6 : i > 0 ? 10 : 0,
                    marginTop: item.alarm ? (i > 0 ? 6 : 0) : (i > 0 ? 10 : 0),
                    borderRadius: item.alarm ? 8 : 0,
                    borderTop: !item.alarm && i > 0 ? '1px solid var(--border-light)' : 'none',
                    background: item.alarm ? 'rgba(196, 69, 54, 0.08)' : 'transparent',
                    border: item.alarm ? '1px solid rgba(196, 69, 54, 0.28)' : 'none',
                    boxShadow: item.alarm ? '0 0 0 1px rgba(196, 69, 54, 0.10) inset' : 'none',
                    position: 'relative',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {item.alarm && <span className="data-tile__alarm-pulse" aria-hidden="true" />}
                  <div className="icon-box-sm" style={{ background: item.bg }}>
                    <item.Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  </div>
                  <span style={{ fontSize: 13, color: item.alarm ? '#8B2E24' : 'var(--text-secondary)', flex: 1, fontWeight: item.alarm ? 600 : 400 }}>{item.label}</span>
                  <span className="stat-value" style={{ fontSize: 15, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Insights Card (tabbed) ── */}
          <div className="dash-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid var(--border-light)', paddingBottom: 0 }}>
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '4px 8px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.02em', border: 'none', background: 'none', cursor: 'pointer',
                  color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                }}>
                  {tab === 'satisfaction' ? t('dashboard.tabScore') : tab === 'equipment' ? t('dashboard.tabEquip') : tab === 'department' ? t('dashboard.tabDept') : t('dashboard.tabWait')}
                </button>
              ))}
            </div>
            {tabContent.data.length === 0 || tabContent.data.every(d => !d.value) ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 108 }}>
                <PieChartIcon className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data yet</span>
              </div>
            ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ flexShrink: 0, position: 'relative', width: 108, height: 108 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tabContent.data} dataKey="value" cx="50%" cy="50%" outerRadius="92%" innerRadius="62%" paddingAngle={3} strokeWidth={0}>
                      {tabContent.data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="stat-value" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{tabContent.center}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110 }}>
                {tabContent.data.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: tabContent.colors[i], flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                    <span className="stat-value" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {d.value}{activeTab === 'avg-wait' ? 'm' : '%'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>

        {/* ═══ PATIENTS ASSIGNED TO YOU TABLE ═══ */}
        <div className="dash-card mb-6 overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Patients assigned to you</h3>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/patients')} className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                {t('dashboard.details')} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {[t('patient.name'), t('dashboard.patientId'), t('dashboard.admitted'), t('dashboard.wardRoomNo'), t('dashboard.assignedDoctor'), t('dashboard.assignedNurse'), t('dashboard.division')].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
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
                {assignedRows.map((p) => (
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
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-muted)' }}>{p.age} Y, {p.gender}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>{p.id}</td>
                    <td className="px-4 py-2.5 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                        {formatCompactDateTime(p.admittedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.ward}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.doctor}</td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.nurse}</td>
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

        {/* ═══ BOTTOM ROW: Disease Distribution + Bed Occupancy + In/Out Patient Rate ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Disease Trend Explorer */}
          <div className="glass-section">
            <div className="glass-section-header">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.diseaseTrends')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                  {t('dashboard.selectedCount', { count: selectedDiseases.size })}
                </span>
              </div>
              <button onClick={() => router.push('/surveillance')} className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                {t('dashboard.surveillance')} <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Search & disease pills */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative mb-2">
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={diseaseSearch}
                  onChange={e => { setDiseaseSearch(e.target.value); setShowDiseaseDropdown(true); }}
                  onFocus={() => setShowDiseaseDropdown(true)}
                  placeholder={t('dashboard.searchDiseasesPlaceholder')}
                  className="text-sm"
                  style={{ paddingLeft: 32, padding: '7px 12px 7px 32px' }}
                />
                {showDiseaseDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden" style={{
                    background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)',
                    boxShadow: 'var(--card-shadow-lg)', zIndex: 50, maxHeight: 200, overflowY: 'auto',
                  }}>
                    {filteredDiseaseList.map(d => {
                      const isSelected = selectedDiseases.has(d.name);
                      return (
                        <button
                          key={d.name}
                          onClick={() => {
                            setSelectedDiseases(prev => {
                              const next = new Set(prev);
                              if (next.has(d.name)) next.delete(d.name); else next.add(d.name);
                              return next;
                            });
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors"
                          style={{ background: isSelected ? 'var(--accent-light)' : 'transparent' }}
                        >
                          <span className="w-3 h-3 rounded flex-shrink-0 flex items-center justify-center" style={{
                            background: isSelected ? (DISEASE_COLORS[d.name] || '#8A9E9A') : 'transparent',
                            border: `2px solid ${DISEASE_COLORS[d.name] || '#8A9E9A'}`,
                          }}>
                            {isSelected && <CheckCircle2 size={8} style={{ color: '#fff' }} />}
                          </span>
                          <span style={{ color: 'var(--text-primary)', flex: 1 }}>{d.name}</span>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{d.currentCases}</span>
                        </button>
                      );
                    })}
                    {filteredDiseaseList.length === 0 && (
                      <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noDiseasesFound')}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Selected disease pills */}
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedDiseases).map(name => (
                  <button
                    key={name}
                    onClick={() => setSelectedDiseases(prev => { const next = new Set(prev); next.delete(name); return next; })}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors"
                    style={{
                      background: `${DISEASE_COLORS[name] || '#8A9E9A'}15`,
                      color: DISEASE_COLORS[name] || '#8A9E9A',
                      border: `1px solid ${DISEASE_COLORS[name] || '#8A9E9A'}30`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: DISEASE_COLORS[name] || '#8A9E9A' }} />
                    {name}
                    <X size={10} />
                  </button>
                ))}
              </div>
            </div>

            {/* Trend chart */}
            {selectedDiseases.size > 0 ? (
              <div className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    {Array.from(selectedDiseases).map(name => (
                      <Area key={name} type="monotone" dataKey={name} stroke={DISEASE_COLORS[name] || '#8A9E9A'} fill={`${DISEASE_COLORS[name] || '#8A9E9A'}15`} strokeWidth={2} dot={{ r: 3, fill: DISEASE_COLORS[name] || '#8A9E9A' }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>

                {/* Totals row */}
                <div className="flex flex-wrap gap-3 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                  {diseaseDistribution.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                    </div>
                  ))}
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>{t('dashboard.total')}: {totalCases}</span>
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4 text-center py-8">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.selectDiseasesHint')}</p>
              </div>
            )}

            {/* Active surveillance alerts — clickable, shows top 2 */}
            {activeAlerts.length > 0 && (
              <button
                onClick={() => router.push('/surveillance')}
                className="mx-4 mb-4 p-3 rounded-lg w-[calc(100%-2rem)] text-left transition-all hover:shadow-md"
                style={{
                  background: 'rgba(229,46,66,0.06)',
                  border: '1px solid rgba(229,46,66,0.18)',
                }}
                title={t('dashboard.openSurveillanceModule')}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-danger)' }}>
                      {t('dashboard.activeDiseaseAlerts', { count: activeAlerts.length })}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                </div>
                <div className="space-y-1">
                  {activeAlerts.slice(0, 2).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span style={{ color: 'var(--text-primary)' }}>
                        <span className="font-semibold">{a.disease || t('dashboard.unknownDisease')}</span>
                        {a.county || a.state ? ` · ${a.county || a.state}` : ''}
                        {typeof a.cases === 'number' ? ` · ${t('dashboard.casesCount', { count: a.cases })}` : ''}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                        style={{
                          background: a.alertLevel === 'emergency' ? 'rgba(229,46,66,0.18)' : 'rgba(252,211,77,0.2)',
                          color: a.alertLevel === 'emergency' ? 'var(--color-danger)' : 'var(--color-warning)',
                        }}
                      >
                        {a.alertLevel}
                      </span>
                    </div>
                  ))}
                  {activeAlerts.length > 2 && (
                    <p className="text-[10px] pt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {t('dashboard.moreAlertsTriage', { count: activeAlerts.length - 2 })}
                    </p>
                  )}
                </div>
              </button>
            )}
          </div>

          {/* Bed Occupancy Bar Chart */}
          <div className="glass-section">
            <div className="glass-section-header">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.bedOccupancy')}</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>({bedOccupancy}/{bedTotal})</span>
              </div>
              <button onClick={() => router.push('/hospitals')} className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                {t('dashboard.details')} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-4">
              {bedChartData.every(d => !d.beds) ? (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon={BarChart3} title="No data yet" message="No bed occupancy records for this facility." />
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bedChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="beds" name={t('dashboard.beds')} radius={[6, 6, 0, 0]} barSize={32}>
                    {bedChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* In Patient-Out Patient Rate Line Chart */}
          <div className="glass-section">
            <div className="glass-section-header">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.inOutPatientRate')}</span>
            </div>
            <div className="p-4">
              {inOutData.every(d => !d['In Patients'] && !d['Out Patients']) ? (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon={TrendingUp} title="No data yet" message="No in/out-patient records for this period." />
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={inOutData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.65rem', paddingTop: '6px' }} />
                  <Line type="monotone" dataKey="In Patients" stroke="#E52E42" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-danger)' }} />
                  <Line type="monotone" dataKey="Out Patients" stroke="#FCD34D" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-warning)' }} />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* ═══ REFERRAL CHAIN TRACKER ═══ */}
        {referrals.length > 0 && (
          <div className="mt-6">
            <ReferralChainTracker
              referrals={referrals}
              currentFacilityId={currentUser?.hospitalId}
              compact
            />
          </div>
        )}

        {/* ═══ QUICK ACTIONS (updated with clinical action modals) ═══ */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Quick Actions */}
          <div className="lg:col-span-2 dash-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('dashboard.quickActions')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: t('dashboard.newPatient'), icon: Users, action: () => router.push('/patients/new'), color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246,0.10)' },
                { label: t('action.newConsultation'), icon: ClipboardList, action: () => setSoapModalOpen(true), color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246,0.10)' },
                { label: t('dashboard.quickPrescribe'), icon: Pill, action: () => setPrescribeModalOpen(true), color: '#0D9488', bg: 'rgba(13,148,136,0.10)' },
                { label: t('dashboard.quickLabOrder'), icon: TestTube, action: () => setLabModalOpen(true), color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
                { label: t('dashboard.immunization'), icon: Syringe, action: () => router.push('/immunizations'), color: '#059669', bg: 'rgba(5,150,105,0.10)' },
                { label: t('dashboard.ancVisit'), icon: HeartPulse, action: () => router.push('/anc'), color: '#EC4899', bg: 'rgba(236,72,153,0.10)' },
                { label: t('dashboard.birthReg'), icon: Baby, action: () => router.push('/births'), color: 'var(--accent-primary)', bg: 'rgba(59, 130, 246,0.10)' },
                { label: t('nav.referrals'), icon: SendHorizontal, action: () => router.push('/referrals'), color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:shadow-sm"
                  style={{ background: `${action.bg}`, border: `1px solid var(--border-light)` }}
                >
                  <div className="icon-box" style={{ background: action.bg }}>
                    <action.icon className="w-4 h-4" style={{ color: action.color }} />
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* DHIS2 Status Mini Card */}
          <div className="dash-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('dashboard.dhis2Status')}</p>
              </div>
              <button onClick={() => router.push('/dhis2-export')} className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                {t('dashboard.open')} <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="data-row-divider-sm" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.connection')}</span>
                <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--color-success)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                  {t('dashboard.active')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.dataSync')}</span>
                <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>{t('dashboard.dataSyncElements', { synced: 8, total: 10 })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.lastSync')}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{t('dashboard.lastSyncTime', { time: '08:00' })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.reportsPending')}</span>
                <span className="text-xs font-bold" style={{ color: 'var(--color-warning)' }}>3</span>
              </div>
            </div>
            <div className="mt-3 p-2 rounded-lg text-center" style={{
              background: 'rgba(59, 130, 246,0.06)',
              border: '1px solid rgba(59, 130, 246,0.1)',
            }}>
              <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                hmis.southsudan.health
              </span>
            </div>
          </div>
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
