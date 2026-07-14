'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LabResultDoc, OrderSetDoc } from '@/lib/db-types';
import { labTier, specimenFor } from '@/lib/clinical-flow/lab-catalog';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { estimateDispenseQuantity } from '@/lib/clinical-flow/dispense-quantity';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Check, Search,
  Stethoscope, Thermometer, ClipboardList,
  FlaskConical, Pill, Calendar, Building2, FileText,
  X, AlertTriangle, UserSearch, Brain,
  ShieldAlert, Paperclip,
  Mic, Wallet,
} from '@/components/icons/lucide';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { FavoritesBar, FavoriteStar } from '@/components/consultation/FavoritesBar';
import SearchInput from '@/components/filters/SearchInput';
import SearchAddField from '@/components/consultation/SearchAddField';
import CodedSearchField from '@/components/CodedSearchField';
import { medications } from '@/data/mock';
import type { Attachment } from '@/data/mock';
import { COMMON_ICD11_CODES } from '@/lib/icd11-codes';
import FileUpload from '@/components/FileUpload';
import ClinicalScribe from '@/components/ClinicalScribe';
import type { ScribeExtraction } from '@/lib/services/clinical-scribe-service';
import { usePatients } from '@/lib/hooks/usePatients';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useMedicalRecords } from '@/lib/hooks/useMedicalRecords';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useTriage } from '@/lib/hooks/useTriage';
import { useOrderSets } from '@/lib/hooks/useOrderSets';
import { checkInteractions, checkAllergies, checkAllergiesStructured, findDuplicateMedications } from '@/lib/services/drug-interaction-service';
import Modal from '@/components/Modal';
import PopupSelect from '@/components/PopupSelect';
import { useApp } from '@/lib/context';
import { isProviderRole, isClinicalAuthorRole } from '@/lib/clinical-roles';
import type { SuperbillPreview } from '@/lib/services/superbill-service';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { patientAgeLabel, patientFullName } from '@/lib/patient-utils';
import { formatMoney } from '@/lib/format-utils';
import { useToast } from '@/components/Toast';
import {
  CONSULT_SECTION,
  SYMPTOM_CATALOG,
  EXAM_FINDINGS_CATALOG,
  COMMON_TREATMENT_PLANS,
  COMMON_FOLLOWUP_REASONS,
  COMMON_REFERRAL_REASONS,
  LAB_PANELS,
  ROUTE_OPTIONS,
  FREQUENCY_OPTIONS,
} from '@/lib/consultation-options';
import { presetForMedication } from '@/lib/data/medication-presets';
import { saveDraft, loadDraft, dropDraft } from '@/lib/draft-storage';
import { useTranslation } from '@/lib/i18n/useTranslation';
import PageInstructionCard from '@/components/PageInstructionCard';

// Adapt ICD-11 entries to the {code, name} shape this page consumes. Keywords
// are carried over too — CodedSearchField matches against them, and most
// natural search terms (e.g. "cough", "pain") only appear there, not in the
// formal ICD title text.
const icdCodes = COMMON_ICD11_CODES.map(c => ({ code: c.code, name: c.title, keywords: c.keywords }));

// The symptom / exam-finding catalogues flattened for the CodedSearchField
// dropdowns. The group label rides along as `code` (searchable — typing
// "respiratory" surfaces that whole group) and as `meta` (shown under each
// row); the code badge itself is hidden since these aren't coded entries.
const symptomOptions = SYMPTOM_CATALOG.flatMap(g =>
  g.options.map(name => ({ code: g.label, name, meta: g.label })));
const examFindingOptions = Object.fromEntries(
  Object.entries(EXAM_FINDINGS_CATALOG).map(([system, groups]) => [
    system,
    groups.flatMap(g => g.options.map(name => ({ code: g.label, name, meta: g.label }))),
  ]),
) as Record<keyof typeof EXAM_FINDINGS_CATALOG, { code: string; name: string; meta: string }[]>;

interface DiagnosisEntry {
  code: string;
  name: string;
  type: 'primary' | 'secondary';
  certainty: 'confirmed' | 'suspected';
  severity: 'mild' | 'moderate' | 'severe';
}

interface PrescriptionEntry {
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
  /** Emergency/stat treatment before results vs. definitive after diagnosis. */
  urgency: 'immediate' | 'definitive';
}

const routeOptions = ROUTE_OPTIONS;
// Basic panel = ordered broadly; special = doctor-selected targeted investigations.

// Joins patient name parts and skips missing/empty pieces so legacy records
// without a middleName don't render "Deng undefined Garang".
const formatPatientName = (p: { firstName?: string; middleName?: string; surname?: string }) =>
  [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ');
const frequencyOptions = FREQUENCY_OPTIONS;

export default function ConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { t } = useTranslation();

  // Lab investigation lists, derived reactively from facility settings so an
  // admin's catalogue changes propagate here. Defaults mirror the old static
  // BASIC_LABS / SPECIAL_LABS / LAB_TESTS, so behaviour is identical at defaults.
  const settings = useSettings();
  const basicLabs = useMemo(
    () => settings.labCatalog.filter(l => l.tier === 'basic').map(l => l.name),
    [settings.labCatalog]
  );
  const specialLabs = useMemo(
    () => settings.labCatalog.filter(l => l.tier === 'special').map(l => l.name),
    [settings.labCatalog]
  );
  const labTests = useMemo(
    () => settings.labCatalog.map(l => l.name),
    [settings.labCatalog]
  );

  // PouchDB hooks
  const { patients } = usePatients();
  const { hospitals } = useHospitals();
  const { currentUser } = useApp();
  const { canConsult } = usePermissions();
  const { triages } = useTriage();

  // Section collapse state (11 sections — includes AI section at index 3 and Attachments at index 8)
  // In the stepped wizard every section is expanded; the active step controls
  // which section cards are visible (others are hidden), so sections start open.
  // Prescriptions and Lab Orders render inline in their own cards on the
  // Orders step, each led by a search bar with suggestion dropdown.
  const [openSections, setOpenSections] = useState<boolean[]>(() =>
    Array(CONSULT_SECTION.referral + 1).fill(true)
  );
  // Current wizard step (0..6), mapping to the workflow stages below.
  const [step, setStep] = useState(0);

  // AI Clinical Scribe
  const [scribeOpen, setScribeOpen] = useState(false);

  const [customLab, setCustomLab] = useState('');

  // Lab test picker — search bar with a suggestion dropdown (mirrors the
  // medication search in the Prescriptions card).
  const [labSearch, setLabSearch] = useState('');
  const [showLabDropdown, setShowLabDropdown] = useState(false);
  const filteredLabSuggestions = useMemo(() => {
    const q = labSearch.trim().toLowerCase();
    const matches = q ? labTests.filter(tn => tn.toLowerCase().includes(q)) : labTests;
    return matches.slice(0, 12);
  }, [labSearch, labTests]);

  // Patient selector
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(
    () => searchParams?.get('patientId') ?? null
  );
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // ── Auto-save draft state (declared early so the effects below can use it) ──
  // Drafts are persisted via the encrypted draft-storage module every ~600ms
  // while editing so a browser crash, power loss, or accidental tab close
  // never costs the doctor an in-progress consultation. Drafts are scoped
  // per patient, AES-GCM encrypted with a per-tab key (sessionStorage), and
  // expire after 24 hours. See docs/security/draft-storage.md.
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
  const draftKey = (pid: string | null) => (pid ? `consultation:${pid}` : null);
  const [draftRestored, setDraftRestored] = useState(false);
  // Only the setter is consumed (draft-save timestamp is recorded but the
  // header no longer reads it after the PageHeader refactor).
  const [, setDraftSavedAt] = useState<string | null>(null);
  const [restorePromptFor, setRestorePromptFor] = useState<{ key: string; savedAt: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(false);
  const consultPageRef = useRef<HTMLElement | null>(null);
  const visitNotesRef = useRef<HTMLDivElement | null>(null);

  // Pre-select patient from URL (?patientId=...) once patients load.
  useEffect(() => {
    const queryPatientId = searchParams?.get('patientId');
    if (!queryPatientId) return;
    if (selectedPatient === queryPatientId) return;
    if (patients.some(p => p._id === queryPatientId)) {
      setSelectedPatient(queryPatientId);
    }
  }, [searchParams, patients, selectedPatient]);

  // Resume a paused consultation (?encounter=…): rehydrate every field from the
  // saved encounter snapshot and pull the lab orders that were already placed,
  // so the clinician picks up exactly where they left off with results in hand.
  useEffect(() => {
    const encId = searchParams?.get('encounter');
    if (!encId || resumeLoadedRef.current) return;
    resumeLoadedRef.current = true;
    (async () => {
      try {
        const { getEncounter } = await import('@/lib/services/encounter-service');
        const enc = await getEncounter(encId);
        if (!enc) return;
        const s = enc.snapshot as Partial<{
          consultationStartedAt: string;
          chiefComplaint: string; complaints: string[];
          vitals: typeof vitals; physExam: typeof physExam;
          diagnoses: DiagnosisEntry[]; prescriptions: PrescriptionEntry[];
          labOrders: Record<string, boolean>; treatmentPlan: string;
          followUpDate: string; followUpReason: string;
          addReferral: boolean; referralHospital: string;
          referralUrgency: string; referralReason: string;
          visitDisposition: 'checkout' | 'referred' | 'admitted';
        }>;
        skipNextAutosave.current = true;
        setEncounterId(enc._id);
        setSelectedPatient(enc.patientId);
        setDraftRestored(true); // a resumed encounter supersedes any local draft
        if (s.consultationStartedAt) setConsultationStartedAt(s.consultationStartedAt);
        if (s.chiefComplaint != null) setChiefComplaint(s.chiefComplaint);
        if (Array.isArray(s.complaints)) setComplaints(s.complaints);
        if (s.vitals) setVitals(s.vitals);
        if (s.physExam) setPhysExam(s.physExam);
        if (Array.isArray(s.diagnoses)) setDiagnoses(s.diagnoses);
        if (Array.isArray(s.prescriptions)) setPrescriptions(s.prescriptions);
        if (s.labOrders) setLabOrders(s.labOrders);
        if (s.treatmentPlan != null) setTreatmentPlan(s.treatmentPlan);
        if (s.followUpDate != null) setFollowUpDate(s.followUpDate);
        if (s.followUpReason != null) setFollowUpReason(s.followUpReason);
        if (typeof s.addReferral === 'boolean') setAddReferral(s.addReferral);
        if (s.referralHospital != null) setReferralHospital(s.referralHospital);
        if (s.referralUrgency != null) setReferralUrgency(s.referralUrgency);
        if (s.referralReason != null) setReferralReason(s.referralReason);
        if (s.visitDisposition) setVisitDisposition(s.visitDisposition);
        // Open the Investigations section so returned results are visible.
        setOpenSections(prev => { const next = [...prev]; next[6] = true; return next; });
        if (enc.labOrderIds?.length) {
          const { labResultsDB } = await import('@/lib/db');
          const res = await labResultsDB().allDocs<LabResultDoc>({ keys: enc.labOrderIds, include_docs: true });
          const docs = res.rows
            .map(r => (r as { doc?: LabResultDoc }).doc)
            .filter((d): d is LabResultDoc => !!d);
          setResumedLabResults(docs);
        }
      } catch (err) {
        console.error('Failed to resume encounter', err);
      }
    })();

  }, [searchParams]);

  // Look for an existing draft for this patient on mount/patient-change.
  // Surfaces a one-time prompt offering to restore. The draft-storage module
  // handles decryption + lazy TTL expiry; if the per-tab key was lost
  // (closed tab, logged out) loadDraft just returns null.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedPatient || draftRestored) return;
    const key = draftKey(selectedPatient);
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const restored = await loadDraft<{ savedAt: string }>(key);
        if (cancelled) return;
        if (!restored || !restored.savedAt) return;
        setRestorePromptFor({ key, savedAt: restored.savedAt });
      } catch {
        // ignore — decryption failure or storage read error
      }
    })();
    return () => { cancelled = true; };

  }, [selectedPatient, draftRestored]);

  // Chief Complaint
  const [chiefComplaint, setChiefComplaint] = useState('');
  // Search text for the signs & symptoms search bar above the complaint box.
  const [symptomSearch, setSymptomSearch] = useState('');
  // Legacy list kept for drafts saved before the free-text complaint box.
  // `chiefComplaint` (string) stays the joined value used everywhere downstream.
  const [complaints, setComplaints] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Sign (attest + lock) the consultation note on completion — the Centricity
  // "provider signs their own encounter" step. Default on for clinicians.
  const [signOnComplete, setSignOnComplete] = useState(true);
  // Read-only fee-ticket preview shown on the final step so the clinician sees
  // the charges that completing the visit will post (P2.3 consultation checkout).
  const [chargePreview, setChargePreview] = useState<SuperbillPreview | null>(null);
  const [sendingLabs, setSendingLabs] = useState(false);
  const [sendingRx, setSendingRx] = useState(false);
  // Prescriptions already pushed to the pharmacy queue mid-visit, tracked by a
  // signature so the final "Complete" doesn't create a duplicate pharmacy order.
  const [sentRxSignatures, setSentRxSignatures] = useState<string[]>([]);
  // Lab tests already written to the DB during this visit (incl. a previous
  // failed Complete attempt), so a retry never duplicates an order.
  const [committedLabTests, setCommittedLabTests] = useState<string[]>([]);

  // Vital Signs
  const [vitals, setVitals] = useState({
    temperature: '',
    systolic: '',
    diastolic: '',
    pulse: '',
    respRate: '',
    o2Sat: '',
    weight: '',
    height: '',
    muac: '',
    painScore: '',
    bloodGlucose: '',
    gcs: '',
  });

  // Physical Examination
  const [physExam, setPhysExam] = useState({
    general: '',
    cardiovascular: '',
    respiratory: '',
    abdominal: '',
    neurological: '',
  });
  // Per-field search text for the findings search bars below.
  const [examSearch, setExamSearch] = useState({
    general: '',
    cardiovascular: '',
    respiratory: '',
    abdominal: '',
    neurological: '',
  });

  // Diagnosis
  const [diagSearch, setDiagSearch] = useState('');
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([]);

  // Per-clinician favorites — one-tap diagnosis & medicine picks.
  const favDx = useFavorites(currentUser?._id, 'diagnosis');
  const favRx = useFavorites(currentUser?._id, 'medication');

  const appendExamFinding = (field: keyof typeof physExam, value: string) => {
    const text = value.trim();
    if (!text) return;
    setPhysExam(prev => ({
      ...prev,
      [field]: prev[field].trim() ? `${prev[field].trim()}\n${text}` : text,
    }));
  };
  // Append a picked symptom to the complaint text (comma-joined, deduped) —
  // the box itself stays freely editable.
  const addSymptom = (symptom: string) => {
    const text = symptom.trim();
    if (!text) return;
    setChiefComplaint(prev => {
      if (prev.toLowerCase().includes(text.toLowerCase())) return prev;
      const base = prev.trim().replace(/,\s*$/, '');
      return base ? `${base}, ${text}` : text;
    });
  };
  const appendWorkflowText = (
    setter: Dispatch<SetStateAction<string>>,
    current: string,
    value: string,
  ) => {
    const text = value.trim();
    if (!text) return;
    setter(current.trim() ? `${current.trim()}\n${text}` : text);
  };

  // Prescriptions
  const [prescriptions, setPrescriptions] = useState<PrescriptionEntry[]>([]);
  const [rxMedSearch, setRxMedSearch] = useState('');
  const [showRxDropdown, setShowRxDropdown] = useState(false);

  // Order sets / clinical protocols
  const { orderSets } = useOrderSets();
  const [showProtocolPicker, setShowProtocolPicker] = useState(false);

  // Lab Orders
  const [labOrders, setLabOrders] = useState<Record<string, boolean>>(
    Object.fromEntries(labTests.map(t => [t, false]))
  );

  // Treatment Plan
  const [treatmentPlan, setTreatmentPlan] = useState('');

  // Attachments
  const [consultAttachments, setConsultAttachments] = useState<Attachment[]>([]);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');

  // Referral
  const [addReferral, setAddReferral] = useState(false);
  const [referralHospital, setReferralHospital] = useState('');
  const [referralUrgency, setReferralUrgency] = useState('routine');
  const [referralReason, setReferralReason] = useState('');
  const [visitDisposition, setVisitDisposition] = useState<'checkout' | 'referred' | 'admitted'>('checkout');

  // Medical records hook
  const { create: createRecord } = useMedicalRecords(selectedPatient || undefined);
  const selectedPatientData = useMemo(
    () => patients.find(p => p._id === selectedPatient) || null,
    [patients, selectedPatient]
  );

  // Today's triage for the selected patient (priority + captured vitals), used
  // to link the encounter, warn when triage was skipped, and prefill vitals.
  const todaysTriage = useMemo(() => {
    if (!selectedPatient) return null;
    const today = new Date().toISOString().slice(0, 10);
    return triages.find(tr => tr.patientId === selectedPatient && (tr.triagedAt || '').startsWith(today)) || null;
  }, [selectedPatient, triages]);

  // Prefill vitals from triage once per patient, only while still untouched, so
  // the clinician doesn't re-key what the nurse already measured.
  const vitalsPrefilledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedPatient || !todaysTriage) return;
    if (searchParams?.get('encounter')) return; // a resumed encounter owns its vitals
    if (vitalsPrefilledRef.current === selectedPatient) return;
    vitalsPrefilledRef.current = selectedPatient;
    setVitals(v => {
      const anyEntered = Object.values(v).some(x => x !== '');
      if (anyEntered) return v;
      return {
        ...v,
        temperature: todaysTriage.temperature || v.temperature,
        pulse: todaysTriage.pulse || v.pulse,
        respRate: todaysTriage.respiratoryRate || v.respRate,
        systolic: todaysTriage.systolic || v.systolic,
        diastolic: todaysTriage.diastolic || v.diastolic,
        o2Sat: todaysTriage.oxygenSaturation || v.o2Sat,
        weight: todaysTriage.weight || v.weight,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient, todaysTriage]);

  // Outstanding account balance for the selected patient — shown (non-blocking)
  // so the clinician is aware of arrears before ordering / at checkout.
  const [patientBalance, setPatientBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedPatient) { setPatientBalance(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { getPatientBalance } = await import('@/lib/services/ledger-service');
        const bal = await getPatientBalance(selectedPatient);
        if (!cancelled) setPatientBalance(bal);
      } catch { if (!cancelled) setPatientBalance(null); }
    })();
    return () => { cancelled = true; };
  }, [selectedPatient]);
  // Referral creation hook — used when the doctor checks "Add referral" below.
  // The full transfer-package flow is reused so the receiving facility gets
  // the patient's history, attachments, and clinical context, not just a
  // bare referral row.
  const { createWithTransfer: createReferralWithTransfer } = useReferrals();

  // Timestamp captured when this consultation session was started (first mount).
  // Stable across renders so we can record the true start time on save.
  const [consultationStartedAt, setConsultationStartedAt] = useState(() => new Date().toISOString());

  // Resume state: when this consultation was opened from a paused encounter
  // (?encounter=…), we hold its id and the lab orders already placed so we
  // neither re-order nor re-charge them on finalise, and can show the results.
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [resumedLabResults, setResumedLabResults] = useState<LabResultDoc[]>([]);
  const resumeLoadedRef = useRef(false);

  // Debounced auto-save: every time form state changes, schedule a write
  // ~600ms later. Cancels any pending write so rapid typing only triggers a
  // single save. (Auto-save state is declared higher up.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedPatient) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const key = draftKey(selectedPatient);
      if (!key) return;
      const draft = {
        savedAt: new Date().toISOString(),
        consultationStartedAt,
        chiefComplaint,
        vitals,
        physExam,
        diagnoses,
        prescriptions,
        labOrders,
        treatmentPlan,
        followUpDate,
        followUpReason,
        addReferral,
        referralHospital,
        referralUrgency,
        referralReason,
        visitDisposition,
      };
      // saveDraft is async (Web Crypto). Fire-and-forget — failure is
      // already silent inside the module, and we don't want to block typing.
      saveDraft(key, draft, DRAFT_TTL_MS)
        .then(() => setDraftSavedAt(draft.savedAt))
        .catch(() => { /* fail silently — same UX as before */ });
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPatient, chiefComplaint, vitals, physExam, diagnoses, prescriptions,
    labOrders, treatmentPlan, followUpDate, followUpReason, addReferral,
    referralHospital, referralUrgency, referralReason, visitDisposition,
  ]);

  const toggleSection = (index: number) => {
    setOpenSections(prev => prev.map((v, i) => (i === index ? !v : v)));
  };

  // Patient filtering
  const filteredPatients = patientSearch.length >= 1
    ? patients.filter(p =>
        formatPatientName(p).toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.hospitalNumber.toLowerCase().includes(patientSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // Prescribing safety screen (clinical decision support): drug–drug
  // interactions, drug–allergy conflicts (class-aware), and duplicate orders,
  // recomputed as the clinician edits the prescription list. Advisory, not
  // blocking — emergencies must never be gated on an alert.
  const rxSafety = useMemo(() => {
    const meds = prescriptions.map(p => p.medication).filter(Boolean);
    // Prefer structured allergies (criticality-aware) when the patient has
    // them; falls back to the legacy string list for patients not yet migrated.
    const structured = (selectedPatientData?.structuredAllergies || []);
    let allergyAlerts;
    if (structured.length > 0) {
      allergyAlerts = checkAllergiesStructured(meds, structured);
    } else {
      const allergyList = (selectedPatientData?.allergies as string[] | undefined) || [];
      allergyAlerts = checkAllergies(meds, allergyList);
    }
    return {
      interactions: checkInteractions(meds),
      allergyAlerts,
      duplicates: findDuplicateMedications(meds),
    };
  }, [prescriptions, selectedPatientData]);
  const hasRxWarnings = rxSafety.interactions.hasInteractions || rxSafety.allergyAlerts.length > 0 || rxSafety.duplicates.length > 0;
  /** True when any allergy alert is a severe-criticality match needing override. */
  const hasSevereAllergyAlert = rxSafety.allergyAlerts.some(
    (a): a is typeof a & { requiresOverride: boolean } => 'requiresOverride' in a && a.requiresOverride === true,
  );

  // Price the visit's services (consultation + ordered labs + prescriptions)
  // from the fee schedule so the clinician can review the fee ticket before
  // completing. Read-only — the actual charges are posted by handleSubmit.
  useEffect(() => {
    if (!selectedPatient) { setChargePreview(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { buildSuperbillPreview } = await import('@/lib/services/superbill-service');
        const selectedLabTests = Object.entries(labOrders).filter(([, c]) => c).map(([n]) => n);
        const selections = [
          { category: 'consultation' as const, serviceCode: 'CONS-GEN', description: 'Consultation' },
          ...selectedLabTests.map(tn => ({ category: 'laboratory' as const, serviceCode: tn, description: tn })),
          ...prescriptions.map(rx => ({ category: 'pharmacy' as const, serviceCode: rx.medication, description: rx.medication })),
        ];
        const preview = await buildSuperbillPreview(selections, { orgId: currentUser?.orgId, hospitalId: currentUser?.hospitalId, role: currentUser?.role || 'doctor' });
        if (!cancelled) setChargePreview(preview);
      } catch { if (!cancelled) setChargePreview(null); }
    })();
    return () => { cancelled = true; };
  }, [selectedPatient, labOrders, prescriptions, currentUser?.orgId, currentUser?.hospitalId, currentUser?.role]);

  // Only roles with the consultation capability (doctor, clinical officer,
  // clinician, medical superintendent) can create consultations. Gating on
  // canConsult keeps this consistent with the capability model and the route
  // allow-list — front desk and other non-clinical roles are blocked here.
  // NOTE: this early return MUST stay below every hook above so the hooks run
  // unconditionally on every render (react-hooks/rules-of-hooks).
  if (currentUser && !canConsult) {
    return (
      <>
        <main className="page-container flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{
              background: 'transparent',
            }}>
              <ShieldAlert className="w-8 h-8" style={{ color: 'var(--color-danger)' }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('consultation.accessRestricted')}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {t('consultation.accessRestrictedDesc')}
            </p>
            <button onClick={() => router.back()} className="btn btn-primary">
              <ArrowLeft className="w-4 h-4" />
              {t('consultation.goBack')}
            </button>
          </div>
        </main>
      </>
    );
  }

  // Medication filtering
  const filteredMeds = rxMedSearch.length >= 1
    ? medications.filter(m =>
        m.name.toLowerCase().includes(rxMedSearch.toLowerCase()) ||
        m.category.toLowerCase().includes(rxMedSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const addDiagnosis = (code: string, name: string, sev?: 'mild' | 'moderate' | 'severe') => {
    if (diagnoses.find(d => d.code === code)) return;
    setDiagnoses(prev => [...prev, {
      code,
      name,
      type: prev.length === 0 ? 'primary' : 'secondary',
      certainty: 'confirmed',
      severity: sev || 'moderate',
    }]);
    setDiagSearch('');
  };

  const removeDiagnosis = (index: number) => {
    setDiagnoses(prev => prev.filter((_, i) => i !== index));
  };

  const updateDiagnosis = (index: number, field: keyof DiagnosisEntry, value: string) => {
    setDiagnoses(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const addPrescription = (medName: string) => {
    // Auto-fill the standard adult dose/route/frequency/duration for the drug
    // so the clinician confirms rather than types. Unknown drugs fall back to
    // blank fields. (Preset data is a coded, EML-aligned reference module.)
    const preset = presetForMedication(medName);
    setPrescriptions(prev => [...prev, {
      medication: medName,
      dose: preset?.dose ?? '',
      route: preset?.route ?? 'Oral',
      frequency: preset?.frequency ?? '',
      duration: preset?.duration ?? '',
      instructions: '',
      urgency: 'definitive',
    }]);
    setRxMedSearch('');
    setShowRxDropdown(false);
  };

  const removePrescription = (index: number) => {
    // A prescription already pushed to the pharmacy queue can't be recalled
    // from here (no recall transition exists from received_in_pharmacy_queue),
    // so confirm before dropping it locally — the pharmacy order persists and
    // the pharmacist must be told. Fresh, un-sent rows remove silently.
    const rx = prescriptions[index];
    if (rx && sentRxSignatures.includes(rxSignature(rx)) && typeof window !== 'undefined') {
      if (!window.confirm(`${rx.medication} was already sent to the pharmacy. Removing it here won't recall the pharmacy order — tell the pharmacist to cancel it. Remove from this consultation?`)) {
        return;
      }
    }
    setPrescriptions(prev => prev.filter((_, i) => i !== index));
  };

  const updatePrescription = (index: number, field: keyof PrescriptionEntry, value: string) => {
    setPrescriptions(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  // Doctor-written specific investigation (per the "special lab" workflow).
  const addCustomLab = () => {
    const name = customLab.trim();
    if (!name) return;
    setLabOrders(prev => ({ ...prev, [name]: true }));
    setCustomLab('');
  };

  // One-tap lab panel: tick every test in the bundle, mapping each to the
  // facility catalog name where it exists, else adding it as a custom order.
  const applyLabPanel = (panel: { name: string; tests: string[] }) => {
    setLabOrders(prev => {
      const next = { ...prev };
      for (const test of panel.tests) {
        const key = test.toLowerCase();
        const match = labTests.find(t => t.toLowerCase() === key)
          || labTests.find(t => t.toLowerCase().includes(key) || key.includes(t.toLowerCase()));
        next[match || test] = true;
      }
      return next;
    });
  };

  // Apply a clinical protocol / order set: merge its labs, medications,
  // suggested diagnoses, and plan text into the in-progress consultation.
  // Additive and non-destructive — the clinician can still edit or remove
  // anything afterward, and duplicates are de-duplicated.
  const applyOrderSet = (os: OrderSetDoc) => {
    if (os.labs?.length) {
      setLabOrders(prev => ({
        ...prev,
        ...Object.fromEntries(os.labs!.map(name => [name, true])),
      }));
    }
    if (os.medications?.length) {
      setPrescriptions(prev => {
        const existing = new Set(prev.map(p => p.medication.toLowerCase()));
        const additions: PrescriptionEntry[] = os.medications!
          .filter(m => !existing.has(m.medication.toLowerCase()))
          .map(m => ({
            medication: m.medication,
            dose: m.dose || '',
            route: m.route || 'Oral',
            frequency: m.frequency || '',
            duration: m.duration || '',
            instructions: m.instructions || '',
            urgency: m.urgency || 'definitive',
          }));
        return [...prev, ...additions];
      });
    }
    if (os.diagnoses?.length) {
      setDiagnoses(prev => {
        const seen = new Set(prev.map(d => (d.code || d.name).toLowerCase()));
        const additions: DiagnosisEntry[] = os.diagnoses!
          .filter(d => !seen.has((d.code || d.label).toLowerCase()))
          .map((d, i) => ({
            code: d.code || '',
            name: d.label,
            type: prev.length === 0 && i === 0 ? 'primary' : 'secondary',
            certainty: 'suspected',
            severity: 'moderate',
          }));
        return [...prev, ...additions];
      });
    }
    if (os.planText) {
      setTreatmentPlan(prev => (prev.trim() ? `${prev.trim()}\n\n${os.planText}` : os.planText!));
    }
    setShowProtocolPicker(false);
    showToast(`Applied protocol: ${os.name}`, 'success');
  };

  // Send the selected investigations to the lab and pause the visit as
  // "Awaiting labs". The consultation is persisted as an encounter (not a
  // finalised medical record) so the clinician can resume it from their
  // dashboard once the results come back — see lib/services/encounter-service.ts.
  // The full working state of the visit, persisted on the encounter so it can
  // be resumed verbatim and is the canonical record of what was entered.
  const buildEncounterSnapshot = (): Record<string, unknown> => ({
    consultationStartedAt, chiefComplaint, complaints, vitals, physExam,
    diagnoses, prescriptions, labOrders, treatmentPlan,
    followUpDate, followUpReason, addReferral, referralHospital,
    referralUrgency, referralReason, visitDisposition,
  });

  // Ensure exactly one EncounterDoc exists for this visit. Created lazily on the
  // first order/finalise action (status `with_clinician`) so EVERY visit — not
  // only lab-paused ones — has a canonical encounter. Returns its id, and keeps
  // the snapshot fresh on subsequent calls.
  const ensureEncounter = async (): Promise<string | null> => {
    if (!selectedPatient) return null;
    const enc = await import('@/lib/services/encounter-service');
    if (encounterId) {
      try { await enc.updateEncounter(encounterId, { snapshot: buildEncounterSnapshot() }); } catch { /* non-fatal */ }
      return encounterId;
    }
    const patientData = patients.find(p => p._id === selectedPatient);
    const created = await enc.createEncounter({
      patientId: selectedPatient,
      patientName: patientData ? patientFullName(patientData) : '',
      hospitalNumber: patientData?.hospitalNumber || '',
      clinicianId: currentUser?._id || '',
      clinicianName: currentUser?.name || '',
      hospitalId: currentUser?.hospitalId || '',
      hospitalName: currentUser?.hospital?.name || currentUser?.hospitalName || '',
      status: 'with_clinician',
      snapshot: buildEncounterSnapshot(),
      labOrderIds: [],
      triageId: todaysTriage?._id,
      startedAt: consultationStartedAt,
      orgId: currentUser?.orgId,
    });
    setEncounterId(created._id);
    return created._id;
  };

  // Move the encounter to a target status, tolerating an illegal direct hop
  // (e.g. awaiting_pharmacy → awaiting_labs) by returning to `with_clinician`
  // first — the awaiting_* states all allow that — then advancing.
  const moveEncounter = async (
    encId: string,
    to: import('@/lib/clinical-flow/encounter-journey').EncounterStatus,
    opts?: { snapshot?: Record<string, unknown>; labOrderIds?: string[]; medicalRecordId?: string; actorId?: string },
  ): Promise<void> => {
    const { transitionEncounter } = await import('@/lib/services/encounter-service');
    try {
      await transitionEncounter(encId, to, opts);
    } catch {
      await transitionEncounter(encId, 'with_clinician');
      await transitionEncounter(encId, to, opts);
    }
  };

  const handleSendToLab = async () => {
    if (!selectedPatient || sendingLabs) return;
    const selectedLabTests = Object.entries(labOrders).filter(([, checked]) => checked).map(([name]) => name);
    if (selectedLabTests.length === 0) {
      showToast(t('consultation.toastSelectInvestigation'), 'error');
      return;
    }
    setSendingLabs(true);
    const hospital = currentUser?.hospital;
    const patientData = patients.find(p => p._id === selectedPatient);
    const patientName = patientData ? patientFullName(patientData) : '';
    const hospitalNumber = patientData?.hospitalNumber || '';
    const hospitalId = currentUser?.hospitalId || '';
    const hospitalName = hospital?.name || currentUser?.hospitalName || '';
    try {
      const activeEncounterId = await ensureEncounter();
      const { createLabResult } = await import('@/lib/services/lab-service');
      // Skip tests already written on a prior (failed-then-retried) send so a
      // retry never re-orders or re-charges them.
      const newTests = selectedLabTests.filter(tn => !committedLabTests.includes(tn));
      const labOrderIds: string[] = [];
      for (const testName of newTests) {
        const order = await createLabResult({
          patientId: selectedPatient,
          patientName,
          hospitalNumber,
          testName,
          specimen: specimenFor(testName),
          status: 'pending',
          result: '',
          unit: '',
          referenceRange: '',
          abnormal: false,
          critical: false,
          orderedBy: currentUser?.name || '',
          orderedAt: new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
          completedAt: '',
          tier: labTier(testName),
          hospitalId,
          hospitalName,
          orgId: currentUser?.orgId,
        });
        labOrderIds.push(order._id);
        setCommittedLabTests(prev => prev.includes(testName) ? prev : [...prev, testName]);
      }

      // Pause the visit on its encounter, recording the orders just placed.
      if (activeEncounterId) {
        await moveEncounter(activeEncounterId, 'awaiting_labs', {
          snapshot: buildEncounterSnapshot(),
          labOrderIds,
          actorId: currentUser?._id,
        });
      }

      // Bill the ordered investigations now (best-effort — pricing optional).
      try {
        const { chargeForServices } = await import('@/lib/services/fee-schedule-service');
        await chargeForServices(
          {
            patientId: selectedPatient,
            patientName,
            hospitalNumber,
            facilityId: hospitalId,
            facilityName: hospitalName,
            facilityLevel: 'clinic',
            state: patientData?.state || '',
            county: patientData?.county,
            orgId: currentUser?.orgId,
            encounterId: activeEncounterId || undefined,
            generatedBy: currentUser?._id || 'system',
            generatedByName: currentUser?.name || 'System',
            scope: { orgId: currentUser?.orgId, hospitalId, role: currentUser?.role || 'doctor' },
          },
          newTests.map(testName => ({
            category: 'laboratory' as const,
            serviceCode: testName,
            description: testName,
            referenceType: 'lab_result',
          })),
        );
      } catch {
        /* pricing not configured — labs still ordered */
      }

      showToast(t('consultation.toastSentToLab', { count: selectedLabTests.length }), 'success');
      router.push('/dashboard');
    } catch (err) {
      console.error('Send to lab failed', err);
      showToast(t('consultation.toastSendLabFailed'), 'error');
    } finally {
      setSendingLabs(false);
    }
  };

  // Stable signature for a prescription row, used to avoid sending/charging the
  // same medication to the pharmacy twice.
  const rxSignature = (rx: PrescriptionEntry) => `${rx.medication}||${rx.dose}||${rx.frequency}||${rx.duration}`;

  // Send the current prescriptions to the pharmacy queue now (so the pharmacist
  // can start preparing) without ending the visit. Already-sent rows are
  // skipped here and on final completion so nothing is queued twice.
  const handleSendToPharmacy = async () => {
    if (!selectedPatient || sendingRx) return;
    const pending = prescriptions.filter(rx => rx.medication && !sentRxSignatures.includes(rxSignature(rx)));
    if (pending.length === 0) {
      showToast(t('consultation.toastNoNewRx'), 'error');
      return;
    }
    setSendingRx(true);
    const hospital = currentUser?.hospital;
    const patientData = patients.find(p => p._id === selectedPatient);
    const patientName = patientData ? patientFullName(patientData) : '';
    const hospitalId = currentUser?.hospitalId || '';
    const hospitalName = hospital?.name || currentUser?.hospitalName || '';
    try {
      const activeEncounterId = await ensureEncounter();
      const { createPrescription } = await import('@/lib/services/prescription-service');
      for (const rx of pending) {
        await createPrescription({
          patientId: selectedPatient,
          patientName,
          medication: rx.medication,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          duration: rx.duration,
          prescribedBy: currentUser?.name || '',
          status: 'pending',
          orderStatus: 'received_in_pharmacy_queue',
          quantityToDispense: estimateDispenseQuantity(rx),
          encounterId: activeEncounterId || undefined,
          urgency: rx.urgency,
          hospitalId,
          hospitalName,
          orgId: currentUser?.orgId,
        });
      }
      setSentRxSignatures(prev => [...prev, ...pending.map(rxSignature)]);
      // Reflect on the encounter that pharmacy work is now in flight (the visit
      // continues; finalising later moves it on to clinic checkout).
      if (activeEncounterId) {
        await moveEncounter(activeEncounterId, 'awaiting_pharmacy', {
          snapshot: buildEncounterSnapshot(),
          actorId: currentUser?._id,
        });
      }
      showToast(t('consultation.toastSentToPharmacy', { count: pending.length }), 'success');
    } catch (err) {
      console.error('Send to pharmacy failed', err);
      showToast('Could not send the prescriptions to the pharmacy. Please try again.', 'error');
    } finally {
      setSendingRx(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatient || isSaving) return;

    if (!hasChiefComplaint()) {
      showToast(t('consultation.chiefComplaintRequired'), 'error');
      return;
    }

    if (!hasVitalsInput() && !todaysTriage) {
      showToast('Capture vitals or complete triage before saving the note.', 'error');
      return;
    }

    if (!hasExamInput()) {
      showToast('Document the physical examination before saving the note.', 'error');
      return;
    }

    if (diagnoses.length === 0) {
      showToast('Add at least one diagnosis before saving the note.', 'error');
      return;
    }

    if (!hasPlanInput()) {
      showToast('Add a treatment plan, follow-up, referral, or attachment before saving the note.', 'error');
      return;
    }

    // Every prescription needs a medication + dose + frequency (the same fields
    // validatePrescription enforces server-side). Catch it here, before the
    // staged commit, so an incomplete row shows a clear message instead of
    // throwing mid-save and aborting after the record/labs were already written.
    const incompleteRx = prescriptions.find(rx => !rx.medication?.trim() || !rx.dose?.trim() || !rx.frequency?.trim());
    if (incompleteRx) {
      showToast(`Complete the dose and frequency for "${incompleteRx.medication || 'the prescription'}" before saving.`, 'error');
      return;
    }

    // If the clinician opted to attach a referral, the destination + reason
    // are required. Catching this on submit (rather than silently dropping
    // the referral) prevents emergency hand-offs from being lost.
    if (addReferral || visitDisposition === 'referred') {
      if (!referralHospital) {
        showToast(t('consultation.selectReferralHospital'), 'error');
        return;
      }
      if (!referralReason.trim()) {
        showToast(t('consultation.referralReasonRequired'), 'error');
        return;
      }
    }

    // Facility checkout gate: a resumed visit can't be closed while any of its
    // ordered investigations are still open at the lab. The clinician should
    // wait for the result (the visit stays on their "Awaiting results"
    // worklist) or cancel the order before finalising.
    if (encounterId) {
      const stillOpen = resumedLabResults.filter(r => r.status !== 'completed');
      if (stillOpen.length > 0) {
        showToast(`${stillOpen.length} investigation${stillOpen.length === 1 ? ' is' : 's are'} still pending at the lab — you can't close this visit until ${stillOpen.length === 1 ? 'it is' : 'they are'} back.`, 'error');
        return;
      }
    }

    setIsSaving(true);
    // Non-critical post-steps (charges, referral, triage, encounter close) each
    // run independently; failures are collected here and surfaced together so
    // the clinician knows exactly what to follow up — the visit still saves.
    const postWarnings: string[] = [];
    const hospital = currentUser?.hospital;
    const now = new Date().toISOString();
    const weight = parseFloat(vitals.weight) || 0;
    const height = parseFloat(vitals.height) || 0;
    const patientData = patients.find(p => p._id === selectedPatient);
    const patientName = patientData ? patientFullName(patientData) : '';
    const hospitalNumber = patientData?.hospitalNumber || '';
    const hospitalId = currentUser?.hospitalId || '';
    const hospitalName = hospital?.name || currentUser?.hospitalName || '';

    // Names the critical stage in progress so a failure tells the clinician
    // exactly what to retry. The save is a journaled, idempotent staged commit:
    // the encounter is the journal, each create is dedup-guarded, so re-pressing
    // Complete resumes without duplicating anything (the offline-first stand-in
    // for a transaction — PouchDB has no cross-document rollback).
    let failedStage = 'saving the visit';
    try {
      // 0. Ensure this visit has a canonical encounter (created lazily if the
      //    clinician never sent to lab/pharmacy). Everything below links to it.
      const activeEncounterId = await ensureEncounter();
      const { getEncounter, updateEncounter } = await import('@/lib/services/encounter-service');
      // If a prior attempt already wrote the medical record, reuse it instead of
      // creating a duplicate on retry.
      const existingRecordId = activeEncounterId
        ? (await getEncounter(activeEncounterId))?.medicalRecordId
        : undefined;

      // 1. Create lab orders in tamamhealth_lab_results DB, capturing their ids
      //    so the medical record can reference the actual orders.
      const selectedLabTests = Object.entries(labOrders).filter(([, checked]) => checked).map(([name]) => name);
      // Tests already ordered when this visit was paused — don't re-order or
      // re-bill them on finalise (they were sent + charged at send-to-lab time).
      const resumedLabTests = resumedLabResults.map(r => r.testName);
      // Exclude tests already ordered on resume AND any created during a prior
      // failed save attempt, so a retry can't duplicate orders.
      const newLabTests = selectedLabTests.filter(tn => !resumedLabTests.includes(tn) && !committedLabTests.includes(tn));
      const labOrderIds: string[] = resumedLabResults.map(r => r._id);
      failedStage = 'recording the lab orders';
      if (newLabTests.length > 0) {
        const { createLabResult } = await import('@/lib/services/lab-service');
        for (const testName of newLabTests) {
          const order = await createLabResult({
            patientId: selectedPatient,
            patientName,
            hospitalNumber,
            testName,
            specimen: specimenFor(testName),
            status: 'pending',
            result: '',
            unit: '',
            referenceRange: '',
            abnormal: false,
            critical: false,
            orderedBy: currentUser?.name || '',
            orderedAt: new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
            completedAt: '',
            tier: labTier(testName),
            hospitalId,
            hospitalName,
            orgId: currentUser?.orgId,
          });
          labOrderIds.push(order._id);
          // Record immediately so a later failure + retry won't re-create it.
          setCommittedLabTests(prev => prev.includes(testName) ? prev : [...prev, testName]);
        }
      }

      // 2. Create prescriptions in tamamhealth_prescriptions DB — skipping any
      //    already pushed to the pharmacy mid-visit so they aren't queued twice.
      //    Capture ids + link each to this encounter for traceability.
      const rxToCreate = prescriptions.filter(rx => !sentRxSignatures.includes(rxSignature(rx)));
      const prescriptionIds: string[] = [];
      failedStage = 'recording the prescriptions';
      if (rxToCreate.length > 0) {
        const { createPrescription } = await import('@/lib/services/prescription-service');
        for (const rx of rxToCreate) {
          const res = await createPrescription({
            patientId: selectedPatient,
            patientName,
            medication: rx.medication,
            dose: rx.dose,
            route: rx.route,
            frequency: rx.frequency,
            duration: rx.duration,
            prescribedBy: currentUser?.name || '',
            status: 'pending',
            orderStatus: 'received_in_pharmacy_queue',
            quantityToDispense: estimateDispenseQuantity(rx),
            encounterId: activeEncounterId || undefined,
            urgency: rx.urgency,
            hospitalId,
            hospitalName,
            orgId: currentUser?.orgId,
          });
          prescriptionIds.push(res.prescription._id);
          // Mark as committed so a retry after a later failure won't re-queue it.
          setSentRxSignatures(prev => prev.includes(rxSignature(rx)) ? prev : [...prev, rxSignature(rx)]);
        }
      }

      // 3. Build lab results summary for the medical record. For a resumed
      //    visit the ordered tests have come back, so carry their real values
      //    into the record; freshly ordered tests stay as pending placeholders.
      const labResultsSummary = selectedLabTests.map(testName => {
        const done = resumedLabResults.find(r => r.testName === testName);
        return {
          testName,
          result: done?.result || '',
          unit: done?.unit || '',
          referenceRange: done?.referenceRange || '',
          abnormal: done?.abnormal || false,
          critical: done?.critical || false,
          date: now.split('T')[0],
        };
      });

      // 4. Save the medical record with all data linked. Idempotent: if a prior
      //    attempt already wrote it, reuse that id instead of duplicating.
      failedStage = 'saving the medical record';
      const savedRecord = existingRecordId ? { _id: existingRecordId } : await createRecord({
        patientId: selectedPatient,
        hospitalId,
        hospitalName,
        visitDate: now.split('T')[0],
        consultedAt: now,
        startedAt: consultationStartedAt,
        visitType: 'outpatient',
        visitDisposition,
        providerName: currentUser?.name || '',
        providerRole: currentUser?.role || 'doctor',
        department: 'Outpatient',
        chiefComplaint,
        chiefComplaints: chiefComplaint ? chiefComplaint.split(/[,\n]/).map(c => c.trim()).filter(Boolean) : complaints,
        historyOfPresentIllness: chiefComplaint,
        vitalSigns: {
          temperature: parseFloat(vitals.temperature) || 0,
          systolic: parseInt(vitals.systolic) || 0,
          diastolic: parseInt(vitals.diastolic) || 0,
          pulse: parseInt(vitals.pulse) || 0,
          respiratoryRate: parseInt(vitals.respRate) || 0,
          oxygenSaturation: parseInt(vitals.o2Sat) || 0,
          weight,
          height,
          bmi: weight && height ? parseFloat((weight / ((height / 100) ** 2)).toFixed(1)) : 0,
          muac: parseFloat(vitals.muac) || undefined,
          painScore: parseInt(vitals.painScore) || undefined,
          bloodGlucose: parseFloat(vitals.bloodGlucose) || undefined,
          gcs: parseInt(vitals.gcs) || undefined,
          recordedAt: now,
        },
        // Physical examination — persist the findings captured in the exam
        // step (the save is gated on at least one system being filled). Only
        // non-empty systems are stored so the record stays clean.
        physicalExamination: (() => {
          const filled = Object.fromEntries(
            Object.entries(physExam).filter(([, v]) => v.trim())
          );
          return Object.keys(filled).length > 0 ? filled : undefined;
        })(),
        // Codes come from the ICD-11 (MMS) reference module. Store `icd11Code`
        // (correct system) and keep `icd10Code` populated for legacy readers.
        diagnoses: diagnoses.map(d => ({ icd11Code: d.code, icd10Code: d.code, codeSystem: 'ICD-11-MMS', name: d.name, type: d.type, certainty: d.certainty, severity: d.severity })),
        prescriptions: prescriptions.map(rx => ({
          drugName: rx.medication,
          genericName: rx.medication,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          duration: rx.duration,
          instructions: rx.instructions,
          urgency: rx.urgency,
        })),
        labResults: labResultsSummary,
        treatmentPlan,
        attachments: consultAttachments.length > 0 ? consultAttachments : undefined,
        followUp: followUpDate ? { date: followUpDate, reason: followUpReason } : undefined,
        syncStatus: 'pending',
        // Referential links to the actual documents created this visit.
        encounterId: activeEncounterId || undefined,
        triageId: todaysTriage?._id,
        labOrderIds: labOrderIds.length > 0 ? labOrderIds : undefined,
        prescriptionIds: prescriptionIds.length > 0 ? prescriptionIds : undefined,
      });

      // Journal the record id onto the encounter immediately, so if anything
      // after this point fails a retry reuses this record instead of writing a
      // second one.
      if (activeEncounterId && savedRecord?._id && !existingRecordId) {
        try { await updateEncounter(activeEncounterId, { medicalRecordId: savedRecord._id }); } catch { /* non-fatal */ }
      }

      // Sign (attest + lock) the note on completion if the clinician opted in.
      // A provider signs as final; a supervised trainee (e.g. clinical officer)
      // signs and routes to a supervising provider for co-signature. Non-fatal:
      // if it fails, the visit still saves and the note can be signed from the
      // chart. Already-signed records (resumed visits) are left untouched.
      if (savedRecord?._id && signOnComplete && isClinicalAuthorRole(currentUser?.role)) {
        try {
          const { signMedicalRecord } = await import('@/lib/services/medical-record-service');
          await signMedicalRecord(
            savedRecord._id,
            { userId: currentUser?._id, userName: currentUser?.name || currentUser?.username || '', userRole: currentUser?.role },
            { awaitingCosign: !isProviderRole(currentUser?.role) },
          );
        } catch {
          postWarnings.push('Visit saved but the note could not be signed automatically — sign it from the patient chart.');
        }
      }
      failedStage = 'finalising the visit';

      // 5. Update the patient's last-consultation timestamp so the dashboard
      //    and patient profile header reflect the most recent visit immediately.
      try {
        const { updatePatient } = await import('@/lib/services/patient-service');
        await updatePatient(selectedPatient, {
          lastVisitDate: now.split('T')[0],
          lastVisitHospital: hospitalId,
          lastConsultedAt: now,
          lastConsultedBy: currentUser?.name || '',
        });
      } catch (e) {
        console.warn('Could not update patient lastConsultedAt', e);
      }

      // 6. Generate charges from the service price catalog: the consultation
      //    fee plus a line for each ordered lab test and prescribed drug. Lines
      //    with no catalogued price are skipped, and no bill is created when the
      //    org hasn't priced anything — so this is safe before pricing is set up.
      try {
        const { chargeForServices } = await import('@/lib/services/fee-schedule-service');
        // Idempotency guard: if a prior attempt already billed this encounter
        // for the consultation (then a later stage failed and the user retried,
        // or they re-opened a completed visit), don't charge again. Lab-only
        // mid-visit bills carry no 'consultation' line, so the consultation fee
        // is still billed exactly once per visit.
        const { getBillsByPatient } = await import('@/lib/services/billing-service');
        const priorBills = activeEncounterId ? await getBillsByPatient(selectedPatient) : [];
        const alreadyChargedConsult = priorBills.some(
          b => b.encounterId === activeEncounterId && b.items.some(i => i.category === 'consultation'),
        );
        const lines = [
          { category: 'consultation' as const, serviceCode: 'CONS-GEN', description: 'Consultation' },
          // Only bill labs not already charged when they were sent to the lab.
          ...newLabTests.map(testName => ({ category: 'laboratory' as const, serviceCode: testName, description: testName, referenceType: 'lab_result' })),
          ...prescriptions.map(rx => ({ category: 'pharmacy' as const, serviceCode: rx.medication, description: rx.medication, referenceType: 'prescription' })),
        ];
        if (!alreadyChargedConsult) {
          await chargeForServices({
            patientId: selectedPatient,
            patientName,
            hospitalNumber,
            facilityId: hospitalId,
            facilityName: hospitalName,
            facilityLevel: 'clinic',
            state: patientData?.state || '',
            county: patientData?.county,
            orgId: currentUser?.orgId,
            encounterId: activeEncounterId || undefined,
            generatedBy: currentUser?._id || 'system',
            generatedByName: currentUser?.name || 'System',
            scope: { orgId: currentUser?.orgId, hospitalId, role: currentUser?.role || 'doctor' },
          }, lines);
        }
      } catch (e) {
        console.warn('Could not generate charges from price catalog', e);
        postWarnings.push('charges were not generated');
      }

      // 6.5. If the doctor enabled "Add referral", create the outbound
      //      referral (with full transfer package) so the receiving facility
      //      gets the patient's history, current consultation, and any
      //      attachments. Previously this checkbox collected data but never
      //      created the referral — emergency hand-offs were silently dropped.
      if ((addReferral || visitDisposition === 'referred') && referralHospital && referralReason.trim()) {
        try {
          const destHospital = hospitals.find(h => h._id === referralHospital);
          await createReferralWithTransfer(
            {
              patientId: selectedPatient,
              patientName,
              fromHospitalId: hospitalId,
              fromHospital: hospitalName,
              toHospitalId: referralHospital,
              toHospital: destHospital?.name || '',
              department: 'Outpatient',
              urgency: referralUrgency as 'routine' | 'urgent' | 'emergency',
              reason: referralReason.trim(),
              notes: treatmentPlan || chiefComplaint,
              referringDoctor: currentUser?.name || '',
              referralDate: now.split('T')[0],
              status: 'sent',
            },
            consultAttachments,
            currentUser?.name || 'Unknown',
          );
        } catch (e) {
          // Don't fail the whole save if the referral fails — surface a
          // distinct toast so the clinician knows to re-create it manually
          // from the referrals page.
          console.warn('Failed to create referral from consultation', e);
          showToast(t('consultation.referralCreateFailed'), 'error');
          postWarnings.push('referral was not sent');
        }
      }

      // 7. Update the active triage route. Normal outpatient completion stays
      // open for front-desk checkout; admission/referral hand off to their own
      // downstream modules.
      try {
        const { updateTriage } = await import('@/lib/services/triage-service');
        const todayStr = now.slice(0, 10);
        const patientTriage = triages.find(t =>
          t.patientId === selectedPatient &&
          (t.triagedAt || '').startsWith(todayStr) &&
          (t.status === 'pending' || t.status === 'seen')
        );
        if (patientTriage) {
          const finalTriageStatus =
            visitDisposition === 'admitted' ? 'admitted'
              : visitDisposition === 'referred' ? 'referred'
                : 'seen';
          await updateTriage(patientTriage._id, {
            status: finalTriageStatus,
            handoffTo: currentUser?._id,
            handoffToName: currentUser?.name,
            handoffAt: now,
          });
        }
      } catch (e) {
        console.warn('Could not update visit disposition', e);
        postWarnings.push('visit disposition was not recorded');
      }

      // Close the encounter out according to the clinician's selected route.
      if (activeEncounterId) {
        try {
          const finalEncounterStatus =
            visitDisposition === 'admitted' ? 'admitted'
              : visitDisposition === 'referred' ? 'referred_out'
                : 'ready_for_clinic_checkout';
          await moveEncounter(activeEncounterId, finalEncounterStatus, {
            medicalRecordId: savedRecord?._id,
            snapshot: buildEncounterSnapshot(),
            actorId: currentUser?._id,
          });
          // Close the result-review loop: finalising the visit means the
          // clinician has reviewed each returned result (Stage 6 enforces this).
          const { advanceLabOrder } = await import('@/lib/services/lab-service');
          for (const r of resumedLabResults) {
            if (r.status === 'completed' && (r.orderStatus ?? 'resulted') === 'resulted') {
              try { await advanceLabOrder(r._id, 'reviewed_by_clinician'); } catch { /* non-fatal */ }
            }
          }
        } catch (e) {
          console.warn('Could not finalise the resumed encounter', e);
          postWarnings.push('the visit could not be closed to the selected disposition');
        }
      }

      // Successful save → clear the encrypted draft so we don't re-prompt on next visit
      try {
        const key = draftKey(selectedPatient);
        if (key) await dropDraft(key);
      } catch {
        // ignore
      }

      if (postWarnings.length > 0) {
        showToast(`Note saved, but ${postWarnings.join(', ')}. Please follow up.`, 'error');
      } else {
        showToast(t('consultation.savedSuccess'), 'success');
      }
      if (visitDisposition === 'admitted') {
        const admittingDiagnosis = diagnoses[0]?.name || chiefComplaint;
        router.push(`/wards?admitPatientId=${encodeURIComponent(selectedPatient)}&diagnosis=${encodeURIComponent(admittingDiagnosis)}`);
      } else if (visitDisposition === 'referred') {
        router.push('/referrals?tab=outgoing');
      } else {
        router.push(`/patients/${selectedPatient}`);
      }
    } catch (err) {
      console.error('Failed to save consultation:', err);
      // The form keeps all its data and the orders already written are tracked,
      // so the clinician can safely press Complete again to finish the save
      // without duplicating any orders.
      showToast(`Save stopped while ${failedStage}. Your entries are kept and nothing was duplicated — press Complete to retry.`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Restore a draft into the form state.
  const applyDraft = async (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      const parsed = await loadDraft<{
        savedAt?: string;
        chiefComplaint?: string;
        vitals?: typeof vitals;
        physExam?: typeof physExam;
        diagnoses?: DiagnosisEntry[];
        prescriptions?: PrescriptionEntry[];
        labOrders?: Record<string, boolean>;
        treatmentPlan?: string;
        followUpDate?: string;
        followUpReason?: string;
        addReferral?: boolean;
        referralHospital?: string;
        referralUrgency?: string;
        referralReason?: string;
        visitDisposition?: 'checkout' | 'referred' | 'admitted';
      }>(key);
      if (!parsed) {
        setRestorePromptFor(null);
        return;
      }
      // Skip the next autosave so the restore itself doesn't trigger an
      // immediate write of the same data (no-op but cleaner).
      skipNextAutosave.current = true;
      if (parsed.chiefComplaint != null) { setChiefComplaint(parsed.chiefComplaint); setComplaints(parsed.chiefComplaint.split(';').map(s => s.trim()).filter(Boolean)); }
      if (parsed.vitals) setVitals(parsed.vitals);
      if (parsed.physExam) setPhysExam(parsed.physExam);
      if (Array.isArray(parsed.diagnoses)) setDiagnoses(parsed.diagnoses);
      if (Array.isArray(parsed.prescriptions)) setPrescriptions(parsed.prescriptions);
      if (parsed.labOrders) setLabOrders(parsed.labOrders);
      if (parsed.treatmentPlan != null) setTreatmentPlan(parsed.treatmentPlan);
      if (parsed.followUpDate != null) setFollowUpDate(parsed.followUpDate);
      if (parsed.followUpReason != null) setFollowUpReason(parsed.followUpReason);
      if (typeof parsed.addReferral === 'boolean') setAddReferral(parsed.addReferral);
      if (parsed.referralHospital != null) setReferralHospital(parsed.referralHospital);
      if (parsed.referralUrgency != null) setReferralUrgency(parsed.referralUrgency);
      if (parsed.referralReason != null) setReferralReason(parsed.referralReason);
      if (parsed.visitDisposition) setVisitDisposition(parsed.visitDisposition);
      setDraftSavedAt(parsed.savedAt || null);
      showToast(t('consultation.draftRestored'), 'success');
    } catch {
      showToast(t('consultation.draftRestoreFailed'), 'error');
    } finally {
      setDraftRestored(true);
      setRestorePromptFor(null);
    }
  };

  const discardDraft = async (key: string) => {
    try {
      await dropDraft(key);
    } catch {
      // ignore
    }
    setDraftRestored(true);
    setRestorePromptFor(null);
  };

  // Apply AI Clinical Scribe extraction to all form fields
  const applyScribeExtraction = (extraction: ScribeExtraction) => {
    // Audit trail: record that clinical scribe extracted structured data
    // for this patient. The transcript itself is NOT logged (to avoid
    // duplicating PHI), only a summary of what fields were populated.
    if (selectedPatientData) {
      import('@/lib/services/audit-service').then(({ logAudit }) => {
        const populated: string[] = [];
        if (extraction.chiefComplaint) populated.push('chief_complaint');
        if (Object.values(extraction.vitals).some(v => v)) populated.push('vitals');
        if (extraction.examFindings.length) populated.push(`exam(${extraction.examFindings.length})`);
        if (extraction.diagnoses.length) populated.push(`dx(${extraction.diagnoses.length})`);
        if (extraction.medications.length) populated.push(`rx(${extraction.medications.length})`);
        logAudit(
          'CLINICAL_SCRIBE_APPLIED',
          currentUser?._id,
          currentUser?.username,
          `Patient ${selectedPatientData._id} (${selectedPatientData.hospitalNumber}): scribe populated ${populated.join(', ') || 'no fields'}`
        ).catch(() => {});
      }).catch(() => {});
    }

    // Chief Complaint
    if (extraction.chiefComplaint) {
      setChiefComplaint(extraction.chiefComplaint);
      setComplaints(extraction.chiefComplaint.split(';').map(s => s.trim()).filter(Boolean).slice(0, 3));
    }

    // Vitals
    const v = extraction.vitals;
    if (Object.values(v).some(val => val)) {
      setVitals(prev => ({
        ...prev,
        temperature: v.temperature || prev.temperature,
        systolic: v.systolic || prev.systolic,
        diastolic: v.diastolic || prev.diastolic,
        pulse: v.pulse || prev.pulse,
        respRate: v.respRate || prev.respRate,
        o2Sat: v.o2Sat || prev.o2Sat,
        weight: v.weight || prev.weight,
        height: v.height || prev.height,
        muac: v.muac || prev.muac,
      }));
    }

    // Physical Exam findings
    if (extraction.examFindings.length > 0) {
      const examUpdate: Record<string, string> = {};
      for (const finding of extraction.examFindings) {
        const key = finding.system;
        examUpdate[key] = (examUpdate[key] ? examUpdate[key] + '; ' : '') + finding.finding;
      }
      setPhysExam(prev => ({
        general: examUpdate.general || prev.general,
        cardiovascular: examUpdate.cardiovascular || prev.cardiovascular,
        respiratory: examUpdate.respiratory || prev.respiratory,
        abdominal: examUpdate.abdominal || prev.abdominal,
        neurological: examUpdate.neurological || prev.neurological,
      }));
    }

    // Diagnoses — match against ICD-10 codes
    if (extraction.diagnoses.length > 0) {
      for (const dx of extraction.diagnoses) {
        // Try to match by hint code or name
        const icdMatch = dx.icd10Hint
          ? icdCodes.find(c => c.code === dx.icd10Hint)
          : icdCodes.find(c => c.name.toLowerCase().includes(dx.name.toLowerCase().split(' ')[0]));
        if (icdMatch && !diagnoses.some(d => d.code === icdMatch.code)) {
          addDiagnosis(icdMatch.code, icdMatch.name);
        }
      }
    }

    // Medications — match against medication list
    if (extraction.medications.length > 0) {
      for (const med of extraction.medications) {
        const medMatch = medications.find(m =>
          m.name.toLowerCase().includes(med.name.toLowerCase()) ||
          med.name.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
        );
        const medName = medMatch ? medMatch.name : med.name;
        if (!prescriptions.some(p => p.medication.toLowerCase() === medName.toLowerCase())) {
          setPrescriptions(prev => [...prev, {
            medication: medName,
            dose: med.dose,
            route: med.route || 'Oral',
            frequency: med.frequency,
            duration: med.duration,
            instructions: '',
            urgency: 'definitive',
          }]);
        }
      }
    }

    // Lab Orders
    if (extraction.labOrders.length > 0) {
      setLabOrders(prev => {
        const updated = { ...prev };
        for (const lab of extraction.labOrders) {
          if (lab in updated) {
            updated[lab] = true;
          }
        }
        return updated;
      });
    }

    // Treatment Plan
    if (extraction.treatmentPlan.length > 0) {
      setTreatmentPlan(prev => {
        const existing = prev.trim();
        const newPlan = extraction.treatmentPlan.join('\n');
        return existing ? `${existing}\n${newPlan}` : newPlan;
      });
    }

    // Follow-up
    if (extraction.followUp) {
      setFollowUpReason(extraction.followUp);
    }

    // Referral
    if (extraction.referralNotes) {
      setAddReferral(true);
      setReferralReason(extraction.referralNotes);
    }

    // Open populated sections
    setOpenSections(prev => prev.map((v, i) => {
      if (i === 0 && extraction.chiefComplaint) return true;
      if (i === 1 && Object.values(extraction.vitals).some(val => val)) return true;
      if (i === 2 && extraction.examFindings.length > 0) return true;
      if (i === 4 && extraction.diagnoses.length > 0) return true;
      if (i === 5 && extraction.medications.length > 0) return true;
      if (i === 6 && extraction.labOrders.length > 0) return true;
      if (i === 7 && extraction.treatmentPlan.length > 0) return true;
      return v;
    }));

    setScribeOpen(false);
    showToast(t('consultation.scribeApplied'), 'success');
  };

  const sectionHeaders: { icon: React.ElementType; label: string }[] = [
    { icon: ClipboardList, label: 'History' },
    { icon: Thermometer, label: 'Intake' },
    { icon: Stethoscope, label: t('consultation.sectionPhysicalExam') },
    { icon: Brain, label: 'Summary' },
    { icon: AlertTriangle, label: t('consultation.sectionDiagnosis') },
    { icon: Pill, label: t('consultation.sectionPrescriptions') },
    { icon: FlaskConical, label: t('consultation.sectionLabOrders') },
    { icon: FileText, label: t('consultation.sectionTreatmentPlan') },
    { icon: Paperclip, label: t('consultation.sectionAttachments') },
    { icon: Calendar, label: t('consultation.sectionFollowUp') },
    { icon: Building2, label: t('consultation.sectionReferral') },
  ];

  const SectionHeader = ({ index }: { index: number }) => {
    const { icon: Icon, label } = sectionHeaders[index];
    return (
      <button
        onClick={() => toggleSection(index)}
        className="w-full flex items-center justify-between p-4 text-left"
        style={{ borderBottom: openSections[index] ? '1px solid var(--border-light)' : 'none' }}
        data-tour={`consult-section-${index}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
            <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
        </div>
        {openSections[index] ? (
          <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        )}
      </button>
    );
  };

  const WORKFLOW_PANEL = {
    intake: 1,
    exam: 2,
    assessment: 3,
    orders: 4,
    plan: 5,
    summary: 6,
  } as const;

  const hasChiefComplaint = () => chiefComplaint.trim().length >= 3;
  const hasVitalsInput = () => Object.values(vitals).some(value => value !== '');
  const hasExamInput = () => Object.values(physExam).some(value => value.trim().length > 0);
  const hasOrdersInput = () => prescriptions.length > 0 || Object.values(labOrders).some(Boolean);
  const hasPlanInput = () => (
    treatmentPlan.trim().length > 0 ||
    consultAttachments.length > 0 ||
    followUpDate !== '' ||
    followUpReason.trim().length > 0 ||
    visitDisposition !== 'checkout' ||
    (addReferral && (referralHospital !== '' || referralReason.trim().length > 0))
  );
  const intakeReady = () => hasChiefComplaint() && (hasVitalsInput() || !!todaysTriage);
  const consultationReadyForSummary = () => (
    intakeReady() &&
    hasExamInput() &&
    diagnoses.length > 0 &&
    hasPlanInput()
  );

  // The consultation wizard is intentionally linear: intake with vitals
  // first, and summary last as a read-only review step.
  const workflowStages: { label: string; sections: number[] }[] = [
    { label: 'Intake', sections: [WORKFLOW_PANEL.intake] },
    { label: 'Examination', sections: [WORKFLOW_PANEL.exam] },
    { label: 'Assessment', sections: [WORKFLOW_PANEL.assessment] },
    { label: 'Orders', sections: [WORKFLOW_PANEL.orders] },
    { label: 'Plan & checkout', sections: [WORKFLOW_PANEL.plan] },
    { label: 'Summary', sections: [WORKFLOW_PANEL.summary] },
  ];
  const workflowStageIcons: React.ElementType[] = [
    Thermometer,
    Stethoscope,
    AlertTriangle,
    FlaskConical,
    FileText,
    Brain,
  ];
  // Which section cards belong to the current wizard step (others are hidden).
  const stepHas = (sectionIndex: number) => workflowStages[step]?.sections.includes(sectionIndex) ?? false;
  const isLastStep = step === workflowStages.length - 1;

  const validateStep = (currentStep: number): string | null => {
    if (currentStep === WORKFLOW_PANEL.intake) {
      if (!hasChiefComplaint()) return t('consultation.chiefComplaintRequired');
      if (!hasVitalsInput() && !todaysTriage) return 'Capture vitals or complete triage before moving to examination.';
    }
    if (currentStep === WORKFLOW_PANEL.exam && !hasExamInput()) {
      return 'Document the physical examination before moving to assessment.';
    }
    if (currentStep === WORKFLOW_PANEL.assessment && diagnoses.length === 0) {
      return 'Add at least one diagnosis before moving to orders.';
    }
    if (currentStep === WORKFLOW_PANEL.plan && !hasPlanInput()) {
      return 'Add a treatment plan, follow-up, referral, or attachment before reviewing the summary.';
    }
    return null;
  };

  const goNext = () => {
    const validationMessage = validateStep(step);
    if (validationMessage) {
      showToast(validationMessage, 'error');
      return;
    }
    setStep(s => Math.min(s + 1, workflowStages.length - 1));
    consultPageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    setStep(s => Math.max(s - 1, 0));
    consultPageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Whether a section has any clinician-entered data. Single source of truth for
  // both the stage rail and the progress checklist — progress is driven by what
  // has been filled in, not by which section happens to be open.
  const workflowPanelFilled = (i: number): boolean => (
    i === WORKFLOW_PANEL.intake ? intakeReady()
    : i === WORKFLOW_PANEL.exam ? hasExamInput()
    : i === WORKFLOW_PANEL.assessment ? diagnoses.length > 0
    : i === WORKFLOW_PANEL.orders ? hasOrdersInput()
    : i === WORKFLOW_PANEL.plan ? hasPlanInput()
    : consultationReadyForSummary()
  );
  // A stage counts as done when at least one of its sections has data; the first
  // not-yet-started stage is the "current" one. (Plan & checkout is optional.)
  const stageDone = (sections: number[]) => sections.some(s => workflowPanelFilled(s));
  const workflowProgressItems = workflowStages.map((stage, index) => ({
    label: stage.label,
    icon: workflowStageIcons[index] || ClipboardList,
    filled: stageDone(stage.sections),
    active: index === step,
  }));

  return (
    <>
      <main ref={consultPageRef} className="page-container page-enter ehr-consultation-page" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <PageInstructionCard />
          <div className="flex items-center justify-between gap-3 mb-4">
            <button onClick={() => router.push('/patients')} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--accent-primary)' }}>
              <ArrowLeft className="w-4 h-4" /> {t('consultation.backToPatients')}
            </button>
            <button
              onClick={() => setScribeOpen(!scribeOpen)}
              className="btn btn-sm flex items-center gap-2"
              style={{
                background: scribeOpen ? 'rgba(229,46,66,0.12)' : 'rgba(59, 130, 246,0.10)',
                color: scribeOpen ? 'var(--color-danger)' : 'var(--accent-primary)',
                border: `1px solid ${scribeOpen ? 'rgba(229,46,66,0.2)' : 'rgba(59, 130, 246,0.2)'}`,
              }}
            >
              <Mic className="w-4 h-4" />
              {scribeOpen ? t('consultation.closeScribe') : t('consultation.aiScribe')}
            </button>
          </div>

          {/* Draft restore banner */}
          {restorePromptFor && (
            <div
              className="card-elevated mb-4 px-4 py-3 flex items-center gap-3 flex-wrap"
              style={{
                background: 'var(--accent-light)',
                border: '1px solid var(--accent-border, rgba(59, 130, 246,0.25))',
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'transparent' }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('consultation.draftFound')}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {t('consultation.lastEdited', { time: new Date(restorePromptFor.savedAt).toLocaleString() })}
                </p>
              </div>
              <button
                onClick={() => applyDraft(restorePromptFor.key)}
                className="btn btn-primary btn-sm"
              >
                {t('consultation.restoreDraft')}
              </button>
              <button
                onClick={() => discardDraft(restorePromptFor.key)}
                className="btn btn-secondary btn-sm"
              >
                {t('consultation.discard')}
              </button>
            </div>
          )}


          {/* Patient Selector — on xl+ screens selection lives in the right-hand
              patient summary card instead (search bar when nobody is selected,
              Change button in the card header once someone is), so this bar only
              renders below xl where that rail is hidden. Kept elevated above the
              following cards so the patient search dropdown (which overflows the
              card) is never hidden behind them — each .card-elevated makes its own
              stacking context via backdrop-filter. */}
          <div className="card-elevated p-3 mb-3 relative z-50 ehr-consult-patient-picker xl:hidden">
            <div className="flex items-center gap-3">
            {selectedPatientData ? (
              // The rich identity display (avatar, hospital number, age/gender,
              // location) now lives entirely in the right-hand patient summary
              // card — duplicating it here just to switch patients wasted a
              // whole row. Keep only the name (still a link to the chart) and
              // the control to pick someone else.
              <div className="ehr-consult-patient-summary ehr-consult-patient-summary--slim">
                <button
                  onClick={() => router.push(`/patients/${selectedPatientData._id}`)}
                  className="ehr-consult-patient-name"
                  title={t('payments.openPatientRecord')}
                >
                  {formatPatientName(selectedPatientData)}
                </button>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="ehr-consult-change-btn">
                  {t('consultation.change')}
                </button>
              </div>
            ) : (
              <div className="relative flex-1">
                <input
                  type="search"
                  placeholder={t('consultation.selectPatient')}
                  value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                  onFocus={() => setShowPatientDropdown(true)}
                  className="search-icon-input"
                  style={{ background: 'var(--overlay-subtle)' }}
                />
                {showPatientDropdown && filteredPatients.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', boxShadow: 'none' }}>
                    {filteredPatients.map(p => {
                      return (
                        <button
                          key={p._id}
                          onClick={() => { setSelectedPatient(p._id); setShowPatientDropdown(false); setPatientSearch(''); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                          style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{formatPatientName(p)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.hospitalNumber} &middot; {patientAgeLabel(p)} &middot; {p.gender} &middot; {p.tribe}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          <div className="flex gap-3 flex-1 min-h-0 ehr-consult-workspace">
          {/* AI Clinical Scribe Panel — a stretched flex sibling of the form
              column, so its top and bottom track the step cards and nav
              exactly (the old sticky + calc(100vh - 180px) guessed the chrome
              height and overshot the workspace). */}
          {scribeOpen && (
            <div className="w-[380px] flex-shrink-0 rounded-2xl overflow-hidden ehr-consult-sidecar" style={{
              border: '1px solid var(--border-light)',
              boxShadow: 'none',
            }}>
              <ClinicalScribe
                onApply={applyScribeExtraction}
                onClose={() => setScribeOpen(false)}
              />
            </div>
          )}

          {/* Left: Form sections */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Scrolling step content — only this region scrolls; the header,
                patient selector and step indicator above stay fixed. */}
            {/* No space-y here — the flex gap spaces the visible cards; a
                margin utility would also fire on cards after display:none
                siblings and push the first visible card out of line. */}
            <div className="pr-1 ehr-soap-scroll">
            {/* Section 1: Intake + Vital Signs */}
            <div className="card-elevated overflow-hidden ehr-consult-fill-card" style={{ display: stepHas(1) ? undefined : 'none' }}>
              <SectionHeader index={1} />
              {openSections[1] && (
                <div className="p-5 ehr-consult-fill-body">
                  {selectedPatient && !todaysTriage && (
                    <div className="flex items-start gap-2 p-3 mb-4 rounded-lg" style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid var(--color-warning)' }}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        This patient hasn’t been triaged today. You can proceed, but triage captures acuity and vitals — consider sending them to triage first for non-emergencies.
                      </p>
                    </div>
                  )}
                  {selectedPatient && todaysTriage && (
                    <div className="flex items-center gap-2 p-2.5 mb-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{
                        background: todaysTriage.priority === 'RED' ? 'var(--color-danger)' : todaysTriage.priority === 'YELLOW' ? 'var(--color-warning)' : 'var(--color-success)',
                      }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Triaged today — vitals carried over below.</span>
                    </div>
                  )}
                  <CodedSearchField
                    label={t('consultation.chiefComplaintLabel')}
                    placeholder="Search signs & symptoms…"
                    options={symptomOptions}
                    value={symptomSearch}
                    onChange={setSymptomSearch}
                    onSelect={c => { addSymptom(c.name); setSymptomSearch(''); }}
                    onAddCustom={text => { addSymptom(text); setSymptomSearch(''); }}
                    showCodeBadge={false}
                    maxResults={10}
                  />
                  {/* One editable box — picked symptoms append here and can be
                      reworded, reordered, or deleted freely. */}
                  <textarea
                    rows={3}
                    className="ehr-consult-complaint-box"
                    value={chiefComplaint}
                    onChange={e => setChiefComplaint(e.target.value)}
                    placeholder="e.g. Fever, watery diarrhoea, vomiting — or pick from the symptom list"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label>{t('consultation.vitalTemperature')}</label>
                      <input type="number" step="0.1" value={vitals.temperature}
                        onChange={e => setVitals(v => ({ ...v, temperature: e.target.value }))}
                        placeholder="e.g. 37.0" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalSystolic')}</label>
                      <input type="number" value={vitals.systolic}
                        onChange={e => setVitals(v => ({ ...v, systolic: e.target.value }))}
                        placeholder="e.g. 120" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalDiastolic')}</label>
                      <input type="number" value={vitals.diastolic}
                        onChange={e => setVitals(v => ({ ...v, diastolic: e.target.value }))}
                        placeholder="e.g. 80" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalPulse')}</label>
                      <input type="number" value={vitals.pulse}
                        onChange={e => setVitals(v => ({ ...v, pulse: e.target.value }))}
                        placeholder="e.g. 72" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalRespRate')}</label>
                      <input type="number" value={vitals.respRate}
                        onChange={e => setVitals(v => ({ ...v, respRate: e.target.value }))}
                        placeholder="e.g. 18" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalO2Sat')}</label>
                      <input type="number" value={vitals.o2Sat}
                        onChange={e => setVitals(v => ({ ...v, o2Sat: e.target.value }))}
                        placeholder="e.g. 98" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalWeight')}</label>
                      <input type="number" step="0.1" value={vitals.weight}
                        onChange={e => setVitals(v => ({ ...v, weight: e.target.value }))}
                        placeholder="e.g. 65.0" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalHeight')}</label>
                      <input type="number" step="0.1" value={vitals.height}
                        onChange={e => setVitals(v => ({ ...v, height: e.target.value }))}
                        placeholder="e.g. 170" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalMuac')}</label>
                      <input type="number" step="0.1" value={vitals.muac}
                        onChange={e => setVitals(v => ({ ...v, muac: e.target.value }))}
                        placeholder="e.g. 14.5" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalPainScore')}</label>
                      <input type="number" min="0" max="10" value={vitals.painScore}
                        onChange={e => setVitals(v => ({ ...v, painScore: e.target.value }))}
                        placeholder="e.g. 3" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalBloodGlucose')}</label>
                      <input type="number" step="0.1" value={vitals.bloodGlucose}
                        onChange={e => setVitals(v => ({ ...v, bloodGlucose: e.target.value }))}
                        placeholder="e.g. 5.5" />
                    </div>
                    <div>
                      <label>{t('consultation.vitalGcs')}</label>
                      <input type="number" min="3" max="15" value={vitals.gcs}
                        onChange={e => setVitals(v => ({ ...v, gcs: e.target.value }))}
                        placeholder="e.g. 15" />
                    </div>
                  </div>
                  {/* Always visible — shows the value once weight & height are
                      both entered, and a hint until then. */}
                  <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('consultation.calculatedBmi')} </span>
                    {vitals.weight && vitals.height && parseFloat(vitals.height) > 0 ? (
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {(parseFloat(vitals.weight) / ((parseFloat(vitals.height) / 100) ** 2)).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>— enter weight &amp; height</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Physical Examination */}
            <div className="card-elevated overflow-hidden" style={{ display: stepHas(2) ? undefined : 'none' }}>
              <SectionHeader index={2} />
              {openSections[2] && (
                <div className="p-5 space-y-4">
                  {([
                    { key: 'general', label: t('consultation.examGeneral'), placeholder: t('consultation.examGeneralPlaceholder') },
                    { key: 'cardiovascular', label: t('consultation.examCardiovascular'), placeholder: t('consultation.examCardiovascularPlaceholder') },
                    { key: 'respiratory', label: t('consultation.examRespiratory'), placeholder: t('consultation.examRespiratoryPlaceholder') },
                    { key: 'abdominal', label: t('consultation.examAbdominal'), placeholder: t('consultation.examAbdominalPlaceholder') },
                    { key: 'neurological', label: t('consultation.examNeurological'), placeholder: t('consultation.examNeurologicalPlaceholder') },
                  ] as const).map(field => (
                    <div key={field.key} className="rounded-2xl border p-4 ehr-exam-row" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}>
                      <CodedSearchField
                        label={field.label}
                        placeholder="Search findings…"
                        options={examFindingOptions[field.key]}
                        value={examSearch[field.key]}
                        onChange={v => setExamSearch(prev => ({ ...prev, [field.key]: v }))}
                        onSelect={c => {
                          appendExamFinding(field.key, c.name);
                          setExamSearch(prev => ({ ...prev, [field.key]: '' }));
                        }}
                        onAddCustom={text => {
                          appendExamFinding(field.key, text);
                          setExamSearch(prev => ({ ...prev, [field.key]: '' }));
                        }}
                        showCodeBadge={false}
                        maxResults={10}
                      />
                      <textarea
                        value={physExam[field.key]}
                        onChange={e => setPhysExam(prev => ({ ...prev, [field.key]: e.target.value }))}
                        rows={3}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 6: Summary */}
            <div className="card-elevated overflow-hidden" style={{ display: stepHas(6) ? undefined : 'none' }}>
              <SectionHeader index={3} />
              {openSections[3] && (
                <div className="p-5 space-y-5">
                  <div className="ehr-consult-summary-grid">
                    <div className="rounded-2xl border overflow-hidden ehr-consult-subcard" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Workflow assessments</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Progress across the consultation workflow.
                        </div>
                      </div>
                      <div className="p-4 ehr-consult-progress-list">
                        {workflowProgressItems.map(({ label, icon: Icon, filled, active }) => (
                          <div key={label} className="ehr-consult-progress-row" style={{ borderColor: active ? 'var(--accent-primary)' : 'var(--border-light)', background: filled ? 'var(--accent-light)' : 'transparent' }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: filled ? 'rgba(59,130,246,0.14)' : 'var(--overlay-subtle)', border: `1px solid ${filled || active ? 'var(--accent-primary)' : 'var(--border-light)'}` }}>
                                <Icon className="w-4 h-4" style={{ color: filled || active ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
                                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                  {filled ? 'Completed or in progress' : 'Needs attention'}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs font-semibold" style={{ color: filled ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                              {filled ? 'Done' : 'Open'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2 ehr-consult-summary-grid">
                    <div className="rounded-2xl border p-4 ehr-consult-subcard" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                      <div className="mb-3">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Clinical review</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Confirm the key findings from this visit before signing.</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: 'Chief complaint', value: chiefComplaint || 'Needs input' },
                          { label: 'Vitals', value: hasVitalsInput() ? [vitals.temperature && `Temp ${vitals.temperature}`, vitals.systolic && vitals.diastolic && `BP ${vitals.systolic}/${vitals.diastolic}`, vitals.pulse && `Pulse ${vitals.pulse}`, vitals.respRate && `RR ${vitals.respRate}`, vitals.o2Sat && `O2 ${vitals.o2Sat}%`].filter(Boolean).join(' · ') : (todaysTriage ? 'Captured during triage' : 'Needs input') },
                          { label: 'Examination', value: hasExamInput() ? Object.entries(physExam).filter(([, value]) => value.trim()).map(([system]) => system).join(', ') : 'Needs input' },
                          { label: 'Diagnosis', value: diagnoses.length > 0 ? diagnoses.map(dx => dx.name).join(', ') : 'Needs input' },
                          { label: 'Orders', value: hasOrdersInput() ? [prescriptions.length > 0 ? `${prescriptions.length} prescription${prescriptions.length === 1 ? '' : 's'}` : '', Object.values(labOrders).some(Boolean) ? `${Object.values(labOrders).filter(Boolean).length} lab order${Object.values(labOrders).filter(Boolean).length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') : 'No orders placed' },
                          { label: 'Disposition', value: treatmentPlan.trim() || followUpReason.trim() || (addReferral ? 'Referral added' : '') || 'Needs input' },
                        ].map(item => (
                          <div key={item.label} className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                            <div className="mt-1 text-sm" style={{ color: item.value === 'Needs input' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border p-4 ehr-consult-subcard" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                      <div className="mb-3">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Disposition review</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Check the plan, follow-up, and handoff details.</div>
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}>
                          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Treatment plan</div>
                          <div className="mt-1 text-sm whitespace-pre-line" style={{ color: treatmentPlan.trim() ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {treatmentPlan.trim() || 'Needs input'}
                          </div>
                        </div>
                        <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}>
                          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Follow-up</div>
                          <div className="mt-1 text-sm" style={{ color: followUpDate || followUpReason.trim() ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {[followUpDate, followUpReason.trim()].filter(Boolean).join(' · ') || 'Not scheduled'}
                          </div>
                        </div>
                        <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}>
                          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Referral</div>
                          <div className="mt-1 text-sm" style={{ color: addReferral ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {addReferral ? [hospitals.find(h => h._id === referralHospital)?.name || 'Hospital pending', referralUrgency, referralReason.trim()].filter(Boolean).join(' · ') : 'No referral added'}
                          </div>
                        </div>
                        <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}>
                          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Attachments</div>
                          <div className="mt-1 text-sm" style={{ color: consultAttachments.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {consultAttachments.length > 0 ? `${consultAttachments.length} attachment${consultAttachments.length === 1 ? '' : 's'} added` : 'No attachments added'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Section 4: Diagnosis */}
            <div className="card-elevated overflow-hidden" style={{ display: stepHas(3) ? undefined : 'none' }}>
              <SectionHeader index={4} />
              {openSections[4] && (
                <div className="p-5">
                  {/* Favorite diagnoses — one-tap add */}
                  <FavoritesBar
                    favorites={favDx.favorites}
                    label="Favorite diagnoses"
                    onPick={(fav) => { addDiagnosis(fav.code, fav.label); favDx.bumpUse('diagnosis', fav.code); }}
                  />
                  {/* ICD-11 Search */}
                  <div className="mb-4">
                    <CodedSearchField
                      label={t('consultation.searchIcdLabel')}
                      placeholder={t('consultation.searchIcdPlaceholder')}
                      options={icdCodes}
                      value={diagSearch}
                      onChange={setDiagSearch}
                      onSelect={c => addDiagnosis(c.code, c.name)}
                      excludeCodes={diagnoses.map(d => d.code)}
                    />
                  </div>

                  {/* Added Diagnoses */}
                  {diagnoses.length > 0 ? (
                    <div className="space-y-2">
                      {diagnoses.map((d, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="font-mono text-xs px-2 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(59, 130, 246,0.10)', color: 'var(--accent-primary)' }}>{d.code}</span>
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">{d.name}</span>
                          <PopupSelect compact label={t('consultation.diagPrimary') + ' / ' + t('consultation.diagSecondary')} value={d.type} onChange={v => updateDiagnosis(i, 'type', v)} triggerStyle={{ width: 120 }} options={[{ value: 'primary', label: t('consultation.diagPrimary') }, { value: 'secondary', label: t('consultation.diagSecondary') }]} />
                          <PopupSelect compact label="Certainty" value={d.certainty} onChange={v => updateDiagnosis(i, 'certainty', v)} triggerStyle={{ width: 120 }} options={[{ value: 'confirmed', label: t('consultation.diagConfirmed') }, { value: 'suspected', label: t('consultation.diagSuspected') }]} />
                          <PopupSelect compact label="Severity" value={d.severity} onChange={v => updateDiagnosis(i, 'severity', v)} triggerStyle={{ width: 110 }} options={[{ value: 'mild', label: t('consultation.diagMild') }, { value: 'moderate', label: t('consultation.diagModerate') }, { value: 'severe', label: t('consultation.diagSevere') }]} />
                          <FavoriteStar
                            active={favDx.isFav(d.code)}
                            onToggle={() => favDx.toggle({ kind: 'diagnosis', code: d.code, label: d.name, userName: currentUser?.name, orgId: currentUser?.orgId, hospitalId: currentUser?.hospitalId })}
                          />
                          <button onClick={() => removeDiagnosis(i)} className="p-1 rounded transition-colors flex-shrink-0" style={{ background: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,46,66,0.15)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <X className="w-4 h-4" style={{ color: 'var(--tamamhealth-red)' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>{t('consultation.noDiagnoses')}</p>
                  )}
                </div>
              )}
            </div>

            {/* Orders — Prescriptions + Lab Orders side by side, each an inline
                card led by a search bar with a suggestion dropdown. */}
            <div className="ehr-order-launchers flex gap-3 items-start" style={{ display: stepHas(4) ? 'flex' : 'none' }}>
            <div className="card-elevated overflow-hidden flex-1 min-w-0">
              <SectionHeader index={5} />
              {openSections[5] && (
                <div className="p-5">
                  {/* Prescribing safety advisories (CDS): allergy, interaction, duplicate */}
                  {hasRxWarnings && (
                    <div className="mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                      <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--color-danger)' }}>
                        <ShieldAlert className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-danger)' }}>Prescribing safety check</span>
                      </div>
                      <div className="p-3 space-y-2">
                        {hasSevereAllergyAlert && (
                          <div className="text-xs font-bold rounded-md px-2.5 py-1.5" style={{ background: 'var(--color-danger)', color: '#fff' }}>
                            ⛔ SEVERE allergy conflict — confirm an override reason before prescribing.
                          </div>
                        )}
                        {rxSafety.allergyAlerts.map((a, i) => {
                          const crit = 'criticality' in a ? (a as { criticality?: string }).criticality : undefined;
                          const reaction = 'reaction' in a ? (a as { reaction?: string }).reaction : undefined;
                          return (
                          <div key={`al-${i}`} className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            <span className="font-bold" style={{ color: 'var(--color-danger)' }}>⚠ Allergy{crit && crit !== 'unknown' ? ` (${crit})` : ''}:</span> {a.medication} conflicts with recorded allergy &ldquo;{a.allergy}&rdquo;{a.reason === 'class' ? ' (same drug class)' : ''}{reaction ? ` — reaction: ${reaction}` : ''}.
                          </div>
                          );
                        })}
                        {rxSafety.interactions.interactions.map((it, i) => (
                          <div key={`ix-${i}`} className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            <span className="font-bold" style={{ color: it.severity === 'contraindicated' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                              ⚠ {it.severity === 'contraindicated' ? 'Contraindicated' : it.severity === 'serious' ? 'Serious interaction' : 'Interaction'}:
                            </span> {it.drug1} + {it.drug2} — {it.description} <em style={{ color: 'var(--text-muted)' }}>{it.clinicalAdvice}</em>
                          </div>
                        ))}
                        {rxSafety.duplicates.map((d, i) => (
                          <div key={`dp-${i}`} className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            <span className="font-bold" style={{ color: 'var(--color-warning)' }}>⚠ Duplicate:</span> {d} appears more than once on this order.
                          </div>
                        ))}
                        <div className="text-[10px] pt-1" style={{ color: 'var(--text-muted)' }}>Advisory only — review and override using clinical judgement.</div>
                      </div>
                    </div>
                  )}
                  {/* Favorite medicines — one-tap add */}
                  <FavoritesBar
                    favorites={favRx.favorites}
                    label="Favorite medicines"
                    onPick={(fav) => { addPrescription(fav.label); favRx.bumpUse('medication', fav.code); }}
                  />
                  {/* Medication Search */}
                  <div className="relative mb-4">
                    <label>{t('consultation.searchMedicationLabel')}</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="search"
                        placeholder={t('consultation.searchMedicationPlaceholder')}
                        value={rxMedSearch}
                        onChange={e => { setRxMedSearch(e.target.value); setShowRxDropdown(true); }}
                        onFocus={() => setShowRxDropdown(true)}
                        className="pl-9 search-icon-input"
                        style={{ background: 'var(--overlay-subtle)' }}
                      />
                    </div>
                    {showRxDropdown && filteredMeds.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', boxShadow: 'none' }}>
                        {filteredMeds.map(m => (
                          <button
                            key={m.name}
                            onClick={() => addPrescription(m.name)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
                            style={{ borderBottom: '1px solid var(--border-light)' }}
                          >
                            <span className="text-sm font-medium">{m.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(252,211,77,0.10)', color: 'var(--color-warning)' }}>{m.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Added Prescriptions */}
                  {prescriptions.length > 0 ? (
                    <div className="space-y-3">
                      {prescriptions.map((rx, i) => (
                        <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Pill className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                              <span className="text-sm font-semibold">{rx.medication}</span>
                              {sentRxSignatures.includes(rxSignature(rx)) && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: 'rgba(21,121,92,0.12)', color: 'var(--color-success)' }}>
                                  <Check className="w-2.5 h-2.5" /> Sent to pharmacy
                                </span>
                              )}
                            </div>
                            <div className="flex items-center">
                              <FavoriteStar
                                active={favRx.isFav(rx.medication)}
                                onToggle={() => favRx.toggle({ kind: 'medication', code: rx.medication, label: rx.medication, meta: { dosage: rx.dose, frequency: rx.frequency }, userName: currentUser?.name, orgId: currentUser?.orgId, hospitalId: currentUser?.hospitalId })}
                              />
                              <button onClick={() => removePrescription(i)} className="p-1 rounded transition-colors" style={{ background: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,46,66,0.15)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <X className="w-4 h-4" style={{ color: 'var(--tamamhealth-red)' }} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label>{t('consultation.rxDose')}</label>
                              <input type="text" value={rx.dose}
                                onChange={e => updatePrescription(i, 'dose', e.target.value)}
                                placeholder="e.g. 500mg" />
                            </div>
                            <div>
                              <label>{t('consultation.rxRoute')}</label>
                              <PopupSelect label={t('consultation.rxRoute')} value={rx.route} onChange={v => updatePrescription(i, 'route', v)} options={[...routeOptions]} />
                            </div>
                            <div>
                              <label>{t('consultation.rxFrequency')}</label>
                              <PopupSelect label={t('consultation.rxFrequency')} value={rx.frequency} onChange={v => updatePrescription(i, 'frequency', v)} placeholder={t('consultation.rxSelectFrequency')} options={[...frequencyOptions]} />
                            </div>
                            <div>
                              <label>{t('consultation.rxDuration')}</label>
                              <input type="text" value={rx.duration}
                                onChange={e => updatePrescription(i, 'duration', e.target.value)}
                                placeholder="e.g. 7 days" />
                            </div>
                          </div>
                          <div className="mt-3">
                            <label>{t('consultation.rxInstructions')}</label>
                            <input type="text" value={rx.instructions}
                              onChange={e => updatePrescription(i, 'instructions', e.target.value)}
                              placeholder={t('consultation.rxInstructionsPlaceholder')} />
                          </div>
                          <div className="mt-3">
                            <label>Timing</label>
                            <div className="flex gap-2 mt-1">
                              {([['immediate', 'Immediate / emergency'], ['definitive', 'After diagnosis']] as const).map(([val, lbl]) => (
                                <button key={val} type="button"
                                  onClick={() => setPrescriptions(prev => prev.map((p, idx) => idx === i ? { ...p, urgency: val } : p))}
                                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                                  style={{
                                    border: `1px solid ${rx.urgency === val ? (val === 'immediate' ? 'var(--color-warning)' : 'var(--accent-primary)') : 'var(--border-medium)'}`,
                                    background: rx.urgency === val ? (val === 'immediate' ? 'rgba(217,119,6,0.10)' : 'var(--accent-light)') : 'transparent',
                                    color: rx.urgency === val ? (val === 'immediate' ? 'var(--color-warning)' : 'var(--accent-text)') : 'var(--text-muted)',
                                  }}>
                                  {lbl}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {prescriptions.some(rx => rx.medication && !sentRxSignatures.includes(rxSignature(rx))) && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={handleSendToPharmacy}
                            disabled={sendingRx || !selectedPatient}
                            className="btn btn-primary w-full flex items-center justify-center gap-2"
                          >
                            <Pill className="w-4 h-4" />
                            {sendingRx ? 'Sending…' : 'Send to pharmacy'}
                          </button>
                          <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                            Queues these medications at the pharmacy now so they can be prepared. Anything not sent here is queued automatically when you complete the visit.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>{t('consultation.noPrescriptions')}</p>
                  )}
                </div>
              )}
            </div>

            <div className="card-elevated overflow-hidden flex-1 min-w-0">
              <SectionHeader index={6} />
              {openSections[6] && (
                <div className="p-5 space-y-5">
                  {/* Returned results for a resumed visit, shown inline so the
                      clinician can act on them before finalising. */}
                  {resumedLabResults.length > 0 && (
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
                      <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'var(--overlay-subtle)', borderBottom: '1px solid var(--border-light)' }}>
                        <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Results from the lab</span>
                      </div>
                      <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                        {resumedLabResults.map(r => {
                          const done = r.status === 'completed';
                          return (
                            <div key={r._id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.testName}</span>
                              {done ? (
                                <span className="text-sm" style={{ color: r.critical ? 'var(--color-danger)' : r.abnormal ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
                                  {r.result || '—'}{r.unit ? ` ${r.unit}` : ''}
                                  {r.referenceRange ? <span className="text-[11px] ml-1.5" style={{ color: 'var(--text-muted)' }}>(ref {r.referenceRange})</span> : null}
                                  {(r.abnormal || r.critical) && (
                                    <span className="text-[9px] font-bold uppercase ml-2 px-1.5 py-0.5 rounded" style={{ background: r.critical ? 'rgba(229,46,66,0.1)' : 'rgba(184,116,28,0.12)', color: r.critical ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                                      {r.critical ? 'Critical' : 'Abnormal'}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                  Pending
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('consultation.selectTestsHint')}</p>

                  {/* Lab test search — dropdown suggestions on click/focus */}
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="search"
                        placeholder="Search lab tests…"
                        value={labSearch}
                        onChange={e => { setLabSearch(e.target.value); setShowLabDropdown(true); }}
                        onFocus={() => setShowLabDropdown(true)}
                        className="pl-9 search-icon-input"
                        style={{ background: 'var(--overlay-subtle)' }}
                      />
                    </div>
                    {showLabDropdown && filteredLabSuggestions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', maxHeight: 280, overflowY: 'auto' }}>
                        {filteredLabSuggestions.map(test => (
                          <button
                            key={test}
                            onClick={() => {
                              setLabOrders(prev => ({ ...prev, [test]: !prev[test] }));
                              setLabSearch('');
                              setShowLabDropdown(false);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
                            style={{ borderBottom: '1px solid var(--border-light)' }}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                              {test}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
                                {basicLabs.includes(test) ? 'Basic' : 'Special'}
                              </span>
                              {labOrders[test] && <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Apply a clinical protocol / order set — fills labs, meds, diagnoses, plan in one tap */}
                  {orderSets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowProtocolPicker(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                      style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }}
                    >
                      <ClipboardList className="w-4 h-4" />
                      Apply clinical protocol
                    </button>
                  )}

                  {showProtocolPicker && (
                    <Modal onClose={() => setShowProtocolPicker(false)} width={560}>
                      <div className="modal-panel" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                              <ClipboardList className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            <h3 className="text-base font-semibold">Clinical protocols</h3>
                          </div>
                          <button onClick={() => setShowProtocolPicker(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                          Applying a protocol adds its labs, medications, suggested diagnoses, and plan to this consultation. You can edit or remove anything afterward.
                        </p>
                        <div className="space-y-2" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                          {orderSets.map(os => (
                            <button
                              key={os._id}
                              type="button"
                              onClick={() => applyOrderSet(os)}
                              className="w-full text-left p-3 rounded-lg transition-colors"
                              style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{os.name}</span>
                                {os.source && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{os.source}</span>
                                )}
                              </div>
                              {os.description && (
                                <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{os.description}</div>
                              )}
                              <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {(os.labs?.length || 0)} lab{(os.labs?.length || 0) === 1 ? '' : 's'} · {(os.medications?.length || 0)} medication{(os.medications?.length || 0) === 1 ? '' : 's'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </Modal>
                  )}

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Order a panel</div>
                    <div className="flex flex-wrap gap-2">
                      {LAB_PANELS.map(panel => (
                        <button
                          key={panel.name}
                          type="button"
                          onClick={() => applyLabPanel(panel)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors"
                          style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                          title={panel.tests.join(', ')}
                        >
                          <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /> {panel.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Basic panel</div>
                    <div className="grid grid-cols-2 gap-3 keep-cols">
                      {basicLabs.map(test => (
                        <label key={test} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                          style={{ background: labOrders[test] ? 'rgba(59, 130, 246,0.10)' : 'var(--overlay-subtle)', border: `1px solid ${labOrders[test] ? 'var(--accent-primary)' : 'var(--border-light)'}` }}>
                          <input type="checkbox" checked={!!labOrders[test]} onChange={e => setLabOrders(prev => ({ ...prev, [test]: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent-primary)' }} />
                          <div className="flex items-center gap-2">
                            <FlaskConical className="w-3.5 h-3.5" style={{ color: labOrders[test] ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                            <span className="text-sm font-medium" style={{ color: labOrders[test] ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{test}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Special investigations</div>
                    <div className="grid grid-cols-2 gap-3 keep-cols">
                      {specialLabs.map(test => (
                        <label key={test} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                          style={{ background: labOrders[test] ? 'rgba(59, 130, 246,0.10)' : 'var(--overlay-subtle)', border: `1px solid ${labOrders[test] ? 'var(--accent-primary)' : 'var(--border-light)'}` }}>
                          <input type="checkbox" checked={!!labOrders[test]} onChange={e => setLabOrders(prev => ({ ...prev, [test]: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: 'var(--accent-primary)' }} />
                          <div className="flex items-center gap-2">
                            <FlaskConical className="w-3.5 h-3.5" style={{ color: labOrders[test] ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                            <span className="text-sm font-medium" style={{ color: labOrders[test] ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{test}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <input value={customLab} onChange={e => setCustomLab(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomLab(); } }} placeholder="Add a specific investigation (e.g. ferritin, ESR, culture)…" style={{ flex: 1 }} />
                      <button type="button" onClick={addCustomLab} className="btn btn-secondary btn-sm">Add</button>
                    </div>
                    {Object.keys(labOrders).filter(tn => labOrders[tn] && !labTests.includes(tn)).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.keys(labOrders).filter(tn => labOrders[tn] && !labTests.includes(tn)).map(tn => (
                          <span key={tn} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>
                            {tn}
                            <button type="button" aria-label="Remove" onClick={() => setLabOrders(prev => ({ ...prev, [tn]: false }))} style={{ color: 'var(--accent-text)' }}><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {Object.values(labOrders).some(v => v) && (
                    <>
                      <div className="p-3 rounded-lg" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-primary)' }}>
                        <p className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                          {t('consultation.testsSelectedForOrdering', { count: Object.values(labOrders).filter(v => v).length })}
                        </p>
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleSendToLab}
                          disabled={sendingLabs || !selectedPatient}
                          className="btn btn-primary w-full flex items-center justify-center gap-2"
                        >
                          <FlaskConical className="w-4 h-4" />
                          {sendingLabs ? 'Ordering…' : 'Order tests & send to lab'}
                        </button>
                        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                          Orders these investigations, pauses the visit as <strong>Awaiting labs</strong>, and lets you resume it from your dashboard when the results return. Your draft is saved — nothing is finalised yet.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* Section 7: Treatment Plan */}
            <div className="card-elevated overflow-hidden ehr-card-fit" style={{ display: stepHas(5) ? undefined : 'none' }}>
              <SectionHeader index={7} />
              {openSections[7] && (
                <div className="p-5 space-y-3">
                  <SearchAddField
                    placeholder="Type or search a plan"
                    options={COMMON_TREATMENT_PLANS}
                    onPick={value => appendWorkflowText(setTreatmentPlan, treatmentPlan, value)}
                    onAdd={value => appendWorkflowText(setTreatmentPlan, treatmentPlan, value)}
                  />
                  <div>
                    <label>{t('consultation.treatmentPlanLabel')}</label>
                    <textarea
                      value={treatmentPlan}
                      onChange={e => setTreatmentPlan(e.target.value)}
                      rows={4}
                      placeholder={t('consultation.treatmentPlanPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 8: Attachments / Scans */}
            <div className="card-elevated overflow-hidden ehr-card-fit" style={{ display: stepHas(5) ? undefined : 'none' }}>
              <SectionHeader index={8} />
              {openSections[8] && (
                <div className="p-5">
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    {t('consultation.attachmentsHint')}
                  </p>
                  <FileUpload
                    attachments={consultAttachments}
                    onAdd={(att) => setConsultAttachments(prev => [...prev, att])}
                    onRemove={(id) => setConsultAttachments(prev => prev.filter(a => a.id !== id))}
                    uploaderName={currentUser?.name || 'Unknown'}
                    maxFiles={10}
                  />
                </div>
              )}
            </div>

            {/* Section 9: Follow-up */}
            <div className="card-elevated overflow-hidden ehr-card-fit" style={{ display: stepHas(5) ? undefined : 'none' }}>
              <SectionHeader index={9} />
              {openSections[9] && (
                <div className="p-5 space-y-3">
                  <SearchAddField
                    placeholder="Type or search a follow-up reason"
                    options={COMMON_FOLLOWUP_REASONS}
                    onPick={setFollowUpReason}
                    onAdd={setFollowUpReason}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label>{t('consultation.followUpDate')}</label>
                      <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                    </div>
                    <div>
                      <label>{t('consultation.followUpReason')}</label>
                      <input type="text" value={followUpReason} onChange={e => setFollowUpReason(e.target.value)}
                        placeholder={t('consultation.followUpReasonPlaceholder')} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 10: Referral */}
            <div className="card-elevated overflow-hidden ehr-card-fit" style={{ display: stepHas(5) ? undefined : 'none' }}>
              <SectionHeader index={10} />
              {openSections[10] && (
                <div className="p-5">
                  <label className="flex items-center gap-3 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addReferral}
                      onChange={e => {
                        setAddReferral(e.target.checked);
                        if (!e.target.checked && visitDisposition === 'referred') setVisitDisposition('checkout');
                      }}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('consultation.addReferral')}</span>
                  </label>

                  {addReferral && (
                    <div className="space-y-4 p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label>{t('consultation.referralHospital')}</label>
                          <PopupSelect
                            label={t('consultation.referralHospital')}
                            value={referralHospital}
                            onChange={setReferralHospital}
                            placeholder={t('consultation.selectHospital')}
                            groups={Object.entries(
                              hospitals.reduce<Record<string, { value: string; label: string }[]>>((acc, h) => {
                                const state = h.state || 'Other';
                                (acc[state] = acc[state] || []).push({ value: h._id, label: h.name });
                                return acc;
                              }, {}),
                            ).sort(([a], [b]) => a.localeCompare(b)).map(([state, options]) => ({ label: state, options }))}
                          />
                        </div>
                        <div>
                          <label>{t('consultation.urgency')}</label>
                          <PopupSelect label={t('consultation.urgency')} value={referralUrgency} onChange={setReferralUrgency} options={[{ value: 'routine', label: t('consultation.urgencyRoutine') }, { value: 'urgent', label: t('consultation.urgencyUrgent') }, { value: 'emergency', label: t('consultation.urgencyEmergency') }]} />
                        </div>
                      </div>
                      <div>
                        <label>{t('consultation.reasonForReferral')}</label>
                        <div className="mb-2">
                          <SearchAddField
                            placeholder="Type or search a referral reason"
                            options={COMMON_REFERRAL_REASONS}
                            onPick={setReferralReason}
                            onAdd={setReferralReason}
                          />
                        </div>
                        <textarea
                          value={referralReason}
                          onChange={e => setReferralReason(e.target.value)}
                          rows={2}
                          placeholder={t('consultation.reasonForReferralPlaceholder')}
                        />
                      </div>
                      {referralUrgency === 'emergency' && (
                        <div className="p-3 rounded-lg" style={{ background: 'rgba(229,46,66,0.12)', border: '1px solid var(--tamamhealth-red)' }}>
                          <p className="text-xs font-medium" style={{ color: '#F87171' }}>
                            {t('consultation.emergencyReferralWarning')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Visit charges (fee ticket) review — shown before completing so the
                clinician sees what will be billed (P2.3 consultation checkout). */}
            {isLastStep && (
              <div className="card-elevated overflow-hidden ehr-card-fit">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                    <Building2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Visit disposition</span>
                </div>
                <div className="p-4">
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Choose the next station after this clinical note is completed.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { value: 'checkout', label: 'Checkout / pharmacy', note: 'Send to desk, billing, pharmacy, then dismissal' },
                    { value: 'referred', label: 'Refer / transfer', note: 'Create outbound transfer package' },
                    { value: 'admitted', label: 'Admit to ward', note: 'Open ward admission and bed assignment' },
                  ].map(option => {
                    const selected = visitDisposition === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          const value = option.value as 'checkout' | 'referred' | 'admitted';
                          setVisitDisposition(value);
                          if (value === 'referred') setAddReferral(true);
                        }}
                        className="text-left rounded-lg px-3 py-2"
                        style={{
                          border: selected ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
                          background: selected ? 'rgba(41,149,213,0.10)' : 'var(--surface-card)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span className="block text-xs font-semibold">{option.label}</span>
                        <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{option.note}</span>
                      </button>
                    );
                  })}
                </div>
                </div>
              </div>
            )}

            {isLastStep && chargePreview && chargePreview.lines.length > 0 && (
              <div className="card-elevated overflow-hidden ehr-card-fit">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
                      <Wallet className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Visit charges</span>
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Posted when you complete the visit</span>
                </div>
                <div className="p-4">
                <table className="w-full text-[12px]">
                  <tbody>
                    {chargePreview.lines.map((l, i) => (
                      <tr key={i} style={{ borderTop: i ? '1px solid var(--border-light)' : undefined }}>
                        <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>{l.description}{l.quantity > 1 ? ` ×${l.quantity}` : ''}</td>
                        <td className="py-1.5 text-right" style={{ color: l.unpriced ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
                          {l.unpriced ? 'no catalog price' : `${chargePreview.currency} ${l.totalPrice.toLocaleString()}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between font-bold text-[13px] mt-2 pt-2" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                  <span>Total</span><span>{chargePreview.currency} {chargePreview.total.toLocaleString()}</span>
                </div>
                {chargePreview.unpricedCount > 0 && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Items without a catalog price are not billed automatically — add a fee schedule entry to charge them.</p>
                )}
                </div>
              </div>
            )}

            </div>

            {/* Step navigation — Back / Next, with Complete on the final step.
                Deliberately outside .ehr-soap-scroll (a sibling, not the last
                scrolling child) so it's pinned to the bottom of the panel at
                a fixed height instead of trailing wherever the step's content
                happens to end — short steps (e.g. Intake with no patient
                selected yet) previously left a dead gap between the content
                and the nav bar, with the nav floating above empty space. */}
            <div className="flex items-center justify-between pt-4 pb-1 border-t ehr-consult-step-nav" style={{ borderColor: 'var(--border-light)' }}>
              <button onClick={() => step > 0 ? goBack() : router.push('/patients')} className="btn btn-secondary btn-sm">
                <ArrowLeft className="w-4 h-4" /> {step === 0 ? t('action.cancel') : t('patientNew.previous')}
              </button>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Step {step + 1} of {workflowStages.length} · {workflowStages[step]?.label}
              </span>
              {!isLastStep ? (
                <button onClick={goNext} className="btn btn-primary">
                  {t('patientNew.next')} <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {isClinicalAuthorRole(currentUser?.role) && (
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }} title="Attest and lock this note on completion">
                      <input type="checkbox" checked={signOnComplete} onChange={e => setSignOnComplete(e.target.checked)} />
                      {isProviderRole(currentUser?.role) ? 'Sign & lock note' : 'Sign & route for co-sign'}
                    </label>
                  )}
                  <button onClick={handleSubmit} disabled={isSaving || !selectedPatient} className="btn btn-primary btn-lg" style={{ opacity: isSaving ? 0.7 : 1 }}>
                    {isSaving ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {t('consultation.saving')}</> : <><Check className="w-4 h-4" /> {t('consultation.saveConsultation')}</>}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Patient summary panel */}
          <div className="hidden xl:block w-[320px] flex-shrink-0 min-h-0 ehr-chart-details">
            <div className="space-y-3">
              {selectedPatientData ? (
                <>
                  {/* Patient card — also hosts patient switching on xl+ (the top
                      picker bar is xl:hidden): name links to the chart, Change
                      clears the selection and brings back the search card. */}
                  <div className="card-elevated p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <button
                          onClick={() => router.push(`/patients/${selectedPatientData._id}`)}
                          className="ehr-consult-patient-name"
                          title={t('payments.openPatientRecord')}
                        >
                          {formatPatientName(selectedPatientData)}
                        </button>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {selectedPatientData.hospitalNumber}
                        </p>
                      </div>
                      <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="ehr-consult-change-btn">
                        {t('consultation.change')}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Assigned to', value: currentUser?.name || 'Tamam clinician' },
                        { label: t('patient.gender'), value: selectedPatientData.gender },
                        { label: t('patient.age'), value: patientAgeLabel(selectedPatientData) },
                        { label: t('patient.bloodType'), value: selectedPatientData.bloodType || t('consultation.unknown') },
                        { label: t('consultation.state'), value: selectedPatientData.state },
                        { label: t('patient.tribe'), value: selectedPatientData.tribe },
                        { label: t('patient.phone'), value: selectedPatientData.phone || t('consultation.na') },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between text-xs py-1" style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Allergies */}
                  {selectedPatientData.allergies && selectedPatientData.allergies.length > 0 && (
                    <div className="card-elevated p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--tamamhealth-red)' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tamamhealth-red)' }}>{t('patient.allergies')}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPatientData.allergies.map((a: string) => (
                          <span key={a} className="text-xs px-2 py-1 rounded-full font-medium" style={{
                            background: 'rgba(229,46,66,0.12)',
                            color: '#F87171',
                            border: '1px solid rgba(229,46,66,0.2)',
                          }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chronic conditions */}
                  {selectedPatientData.chronicConditions && selectedPatientData.chronicConditions.length > 0 && (
                    <div className="card-elevated p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Stethoscope className="w-4 h-4" style={{ color: 'var(--tamamhealth-amber)' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tamamhealth-amber)' }}>{t('patient.chronicConditions')}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPatientData.chronicConditions.map((c: string) => (
                          <span key={c} className="text-xs px-2 py-1 rounded-full font-medium" style={{
                            background: 'rgba(252,211,77,0.12)',
                            color: 'var(--color-warning)',
                            border: '1px solid rgba(252,211,77,0.2)',
                          }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Account balance (advisory) */}
                  {patientBalance !== null && patientBalance > 0 && (
                    <div className="card-elevated p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Outstanding balance</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>{formatMoney(patientBalance)}</span>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Collect at checkout — ordering is not blocked.</p>
                    </div>
                  )}

                  {/* Visit notes — running summary of everything recorded so far,
                      updating live as the clinician talks to the patient and works
                      through the rest of the note. Stays pinned in view (its own
                      scroll region) so it doesn't get lost below the patient/
                      allergy/progress cards as the note grows. */}
                  {(() => {
                    const vitalNotes = [
                      vitals.temperature && `Temp ${vitals.temperature}°C`,
                      (vitals.systolic || vitals.diastolic) && `BP ${vitals.systolic || '—'}/${vitals.diastolic || '—'}`,
                      vitals.pulse && `HR ${vitals.pulse}`,
                      vitals.respRate && `RR ${vitals.respRate}`,
                      vitals.o2Sat && `SpO₂ ${vitals.o2Sat}%`,
                      vitals.weight && `Wt ${vitals.weight} kg`,
                      vitals.height && `Ht ${vitals.height} cm`,
                      vitals.muac && `MUAC ${vitals.muac}`,
                      vitals.painScore && `Pain ${vitals.painScore}/10`,
                      vitals.bloodGlucose && `Glucose ${vitals.bloodGlucose} mmol/L`,
                      vitals.gcs && `GCS ${vitals.gcs}`,
                    ].filter(Boolean) as string[];
                    const examNotes = Object.entries(physExam)
                      .filter(([, value]) => value.trim())
                      .map(([system, value]) => `${system[0].toUpperCase()}${system.slice(1)}: ${value}`);
                    const orderedTests = Object.entries(labOrders).filter(([, on]) => on).map(([name]) => name);
                    const noteGroups = [
                      { title: 'Chief complaint', items: [chiefComplaint && `CC: ${chiefComplaint}`, ...complaints].filter(Boolean) as string[] },
                      { title: 'Intake', items: vitalNotes },
                      { title: 'Examination', items: examNotes },
                      { title: 'Assessment', items: diagnoses.map(d => `${d.name} (${d.type} · ${d.certainty})`) },
                      { title: 'Prescriptions', items: prescriptions.map(rx => `${rx.medication} ${rx.dose} · ${rx.frequency}${rx.duration ? ` · ${rx.duration}` : ''}`) },
                      { title: 'Lab orders', items: orderedTests },
                      { title: 'Plan', items: [
                        treatmentPlan,
                        followUpDate && `Follow-up ${followUpDate}${followUpReason ? ` — ${followUpReason}` : ''}`,
                        addReferral && referralHospital && `Referral → ${referralHospital} (${referralUrgency})`,
                      ].filter(Boolean) as string[] },
                    ].filter(group => group.items.length > 0);
                    return (
                      <div
                        ref={visitNotesRef}
                        className="card-elevated p-4"
                        style={{ position: 'sticky', top: 72, maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Visit notes</p>
                        {noteGroups.length === 0 ? (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Recorded data will appear here as you work through the steps.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {noteGroups.map(group => (
                              <div key={group.title}>
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent-primary)' }}>{group.title}</p>
                                <ul className="space-y-1">
                                  {group.items.map((item, i) => (
                                    <li key={i} className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </>
              ) : (
                /* No patient yet — the search bar sits on top of the card and the
                   matches render inside it (a floating dropdown would be clipped by
                   this rail's overflow-y: auto), replacing the empty-state hint. */
                <div className="card-elevated p-6">
                  <input
                    type="search"
                    placeholder={t('consultation.selectPatient')}
                    value={patientSearch}
                    onChange={e => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                    className="search-icon-input"
                    style={{ background: 'var(--overlay-subtle)' }}
                  />
                  {showPatientDropdown && filteredPatients.length > 0 ? (
                    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-light)', maxHeight: 320, overflowY: 'auto' }}>
                      {filteredPatients.map(p => (
                        <button
                          key={p._id}
                          onClick={() => { setSelectedPatient(p._id); setShowPatientDropdown(false); setPatientSearch(''); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                          style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{formatPatientName(p)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.hospitalNumber} &middot; {patientAgeLabel(p)} &middot; {p.gender} &middot; {p.tribe}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center pt-2 pb-1">
                      <UserSearch className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('consultation.noPatientSelected')}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('consultation.noPatientSelectedHint')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
      </main>
    </>
  );
}
