'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Modal from '@/components/Modal';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
// Clean single-stroke Tailwind Labs Heroicons via the local compatibility shim.
import {
  ArrowLeft, ArrowRightLeft,
  AlertTriangle, FileText, FlaskConical,
  Pill, Activity,
  ShieldAlert, ChevronRight,
  ClipboardList,
  User as UserIcon, Building2, X, Wallet, Syringe,
  Heart, Printer, History, Calendar,
  Bandage, Layers, Plus,
} from '@/components/icons/lucide';
import Badge from '@/components/Badge';
import { usePatients } from '@/lib/hooks/usePatients';
import { useMedicalRecords } from '@/lib/hooks/useMedicalRecords';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePatientReferrals } from '@/lib/hooks/useReferrals';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useANC } from '@/lib/hooks/useANC';
import { Package, MessageSquare } from '@/components/icons/lucide';
import { Icon as DuotoneInfoIcon } from '@/components/icons';
import { useTranslation } from '@/lib/i18n/useTranslation';
import dynamic from 'next/dynamic';
// Lazy-loaded: recharts is large and only used on the Trends view, so keep it
// out of the patient-record initial bundle.
const VitalsTrends = dynamic(() => import('@/components/VitalsTrends'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading charts…</div>,
});
import PatientTimeline from '@/components/PatientTimeline';
import { toIsoDate } from '@/components/ehr/EhrMiniCalendar';
// Canonical geography — the same lists patient registration writes from, so an
// edit here can't introduce a state/county spelling the geo rollups don't know.
import { states as SOUTH_SUDAN_STATES, statesAndCounties } from '@/data/mock';
import { formatDateTime, formatDate, formatClockTime, formatRxSig, humanizeStatus } from '@/lib/format-utils';
import { isScreeningOverdue } from '@/lib/services/screening-service';
import { patientFullName, patientInitials, patientAgeLabel } from '@/lib/patient-utils';
import { usePatientAppointments } from '@/lib/hooks/useAppointments';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { useTriage } from '@/lib/hooks/useTriage';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePatientPayments } from '@/lib/hooks/usePayments';
import BillingTab from '@/components/patients/BillingTab';
import PatientSBAR from '@/components/patients/PatientSBAR';
import DirectiveList from '@/components/patients/DirectiveList';
import PhoneNotes from '@/components/patients/PhoneNotes';
import AssessmentsPanel from '@/components/patients/AssessmentsPanel';
import ScreeningsPanel from '@/components/patients/ScreeningsPanel';
import RemindersPanel from '@/components/patients/RemindersPanel';
import TransferHistoryPanel, { TransferBanner } from '@/components/patients/TransferHistoryPanel';
import DocumentsPanel from '@/components/patients/DocumentsPanel';
import SuperbillPanel from '@/components/patients/SuperbillPanel';
import { useProblems } from '@/lib/hooks/useProblems';
import type {
  AppointmentDoc,
  ImmunizationDoc,
  LabResultDoc,
  MedicalRecordDoc,
  PatientDoc,
  PatientNoteDoc,
  PrescriptionDoc,
  ProblemDoc,
} from '@/lib/db-types';
import { isValidPhone, normalizePhone, formatPhoneDisplay } from '@/lib/field-formats';
import { useAuth } from '@/lib/context';
import { OrderLabModal, PrescribeModal, ReferModal } from '@/components/patients/PatientActionModals';
import { useWards } from '@/lib/hooks/useWards';
import OpenmrsChartShell from '@/components/ehr/chart/OpenmrsChartShell';
import ChartHeader from '@/components/ehr/chart/ChartHeader';
import ChartVitalsBand from '@/components/ehr/chart/ChartVitalsBand';
import ChartSection, { OmrsEmptyState } from '@/components/ehr/chart/ChartSection';
import AllergiesSection from '@/components/ehr/chart/sections/AllergiesSection';
import ConditionsSection from '@/components/ehr/chart/sections/ConditionsSection';
import MedicationsSection from '@/components/ehr/chart/sections/MedicationsSection';
import ResultsSection from '@/components/ehr/chart/sections/ResultsSection';
import OrdersSection from '@/components/ehr/chart/sections/OrdersSection';
import ProceduresSection from '@/components/ehr/chart/sections/ProceduresSection';
import ProgramsSection from '@/components/ehr/chart/sections/ProgramsSection';
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import NurseVitalsModal from '@/components/nurse/NurseVitalsModal';

// Administrative tabs are the only ones a non-clinical role (e.g. Medical
// Receptionist) may see — the "minimum necessary" rule: contact details,
// referral follow-up, and billing/scheduling, but NOT clinical notes, test
// results, diagnoses, vitals, or medications.
// 'transfers' is admin-visible because "who is responsible for this patient?"
// is a question the front desk fields constantly. The panel redacts the
// clinical detail (reason, hand-off notes, problem/medication snapshot) for
// these roles — see TransferHistoryPanel's canViewClinical prop — so the tab
// answers accountability without exposing the chart.
const ADMIN_TAB_IDS = ['overview', 'appointments', 'demographics', 'billing', 'documents', 'recall', 'referrals'];
type PrintSectionId = 'consultation' | 'problems' | 'vitals' | 'medications' | 'allergies' | 'labs' | 'immunizations' | 'appointments';
const PRINT_SECTION_OPTIONS: Array<{ id: PrintSectionId; label: string; description: string }> = [
  { id: 'consultation', label: 'Latest consultation', description: 'Reason for visit, examination, assessment, and plan' },
  { id: 'problems', label: 'Problems and diagnoses', description: 'Current problem list and diagnoses from the latest visit' },
  { id: 'vitals', label: 'Vital signs', description: 'Most recently recorded observations' },
  { id: 'medications', label: 'Current medications', description: 'Active prescriptions and instructions' },
  { id: 'allergies', label: 'Allergies', description: 'Active allergies and adverse reactions' },
  { id: 'labs', label: 'Laboratory results', description: 'Recent results, values, units, and reference ranges' },
  { id: 'immunizations', label: 'Immunizations', description: 'Recorded vaccines and doses' },
  { id: 'appointments', label: 'Next appointment', description: 'Upcoming appointment and follow-up details' },
];
const DEFAULT_PRINT_SECTIONS = new Set<PrintSectionId>(PRINT_SECTION_OPTIONS.map(section => section.id));
type FacesheetPanelId = 'medications' | 'problems' | 'vitals' | 'recommendations';

const FACESHEET_PANEL_OPTIONS: Array<{ id: FacesheetPanelId; label: string }> = [
  { id: 'problems', label: 'Safety alerts' },
  { id: 'medications', label: 'Medications' },
  { id: 'vitals', label: 'Latest observations' },
  { id: 'recommendations', label: 'Next care actions' },
];

const DEFAULT_FACESHEET_PANELS = FACESHEET_PANEL_OPTIONS.map(panel => panel.id);

/** Primary write-action per facesheet card, keyed by panel id. An entry is
 *  omitted when the current role can't perform it, in which case no action
 *  button renders for that card. */
type FacesheetActions = Partial<Record<FacesheetPanelId, {
  label: string;
  onClick: () => void;
  /** Defaults to a "+" — override for actions that aren't additive (Edit, Review). */
  icon?: typeof Plus;
}>>;

// Tab ids that a `?tab=` deep-link is allowed to open. Mirrors `allTabs` (in the
// component) plus the other reachable `activeTab` targets (`referrals`, `sbar`).
// Clinical-permission gating still runs in the effect below, so a non-clinical
// user deep-linked to a clinical tab is bounced back to overview.
const DEEP_LINK_TAB_IDS = new Set([
    'overview', 'appointments', 'history', 'problems', 'prescriptions', 'immunizations',
  'allergies', 'vitals', 'notes', 'labs', 'demographics', 'billing', 'careChecklist',
    'documents', 'recall', 'referrals', 'sbar', 'transfers',
    'orders', 'procedures', 'programs',
]);

export default function PatientDetailPage() {
  const routeParams = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(routeParams?.id) ? routeParams.id[0] : routeParams?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLElement>(null);
  // Deep-link support: a link like `/patients/<id>?tab=labs&focus=<recordId>`
  // opens that chart section (validated + permission-gated) and the section
  // scrolls to / highlights the specific record. Seeded once from the URL.
  const initialTab = searchParams.get('tab');
  const focusId = searchParams.get('focus') || undefined;
  const [activeTab, setActiveTab] = useState(
    initialTab === 'transfers' ? 'referrals' : initialTab === 'recall' ? 'appointments' : initialTab && DEEP_LINK_TAB_IDS.has(initialTab) ? initialTab : 'overview',
  );
  const [demographicsTab, setDemographicsTab] = useState('profile');
  const [vitalsView, setVitalsView] = useState<'table' | 'flowsheet'>('table');
  const [showCustomizeView, setShowCustomizeView] = useState(false);
  const [facesheetPanels, setFacesheetPanels] = useState<Set<FacesheetPanelId>>(() => new Set(DEFAULT_FACESHEET_PANELS));
  // Keep the content area pinned to the top when switching tabs, so cards don't
  // appear to "jump" when a shorter/taller tab swaps in under a retained scroll
  // position. Instant (no smooth) so it's a fixed reset, not an animation.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageSubject, setMessageSubject] = useState('Follow-up from your care team');
  const [messageBody, setMessageBody] = useState('');
  const [messageChannel, setMessageChannel] = useState<'app' | 'sms' | 'both'>('app');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [showPlanWizard, setShowPlanWizard] = useState(false);
  // Header action modals — open in place, pre-filled with the current patient.
  const [showOrderLabModal, setShowOrderLabModal] = useState(false);
  const [showPrescribeModal, setShowPrescribeModal] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const [showNurseVitals, setShowNurseVitals] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);
  const [showTriagePopup, setShowTriagePopup] = useState(false);
  // One-shot request for the chart shell to open a workspace drawer panel
  // (e.g. header "+ Note" → the persisting visit-note panel).
  const [chartPanelRequest, setChartPanelRequest] = useState<string | null>(null);
  // One-shot request for a tab's ChartSection to pop its own "Add" form open
  // (e.g. the Facesheet Problems card's "Add" → Conditions tab + add modal).
  const [sectionAddRequest, setSectionAddRequest] = useState<'problems' | 'allergies' | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSignature, setPrintSignature] = useState('');
  const [printSigned, setPrintSigned] = useState(false);
  const [printSections, setPrintSections] = useState<Set<PrintSectionId>>(() => new Set(DEFAULT_PRINT_SECTIONS));
  // Trigger print after React commits the selected document into the DOM.
  useEffect(() => {
    if (!printSigned) return;
    const printFrame = window.requestAnimationFrame(() => window.print());
    const reset = () => setPrintSigned(false);
    window.addEventListener('afterprint', reset);
    return () => {
      window.cancelAnimationFrame(printFrame);
      window.removeEventListener('afterprint', reset);
    };
  }, [printSigned]);

  // OpenMRS-style client-side pagination for the Appointments tab (Stage 3).
  const [apptPage, setApptPage] = useState(1);
  const APPT_PAGE_SIZE = 8;
  const toggleFacesheetPanel = (panelId: FacesheetPanelId) => {
    setFacesheetPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelId) && next.size > 1) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  };

  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { patients, loading, update: updatePatient } = usePatients();
  const { hospitals } = useHospitals();

  const scopedPatient = patients.find(p => p._id === id);

  // The patients list is scoped to the viewer's facility, so a patient who was
  // registered at another facility in the same organisation (referred in, an
  // appointment booked here, a shared record) isn't in it — the chart would
  // wrongly show "Patient not found". Fetch such a patient directly by id, but
  // gate on the org boundary so tenant isolation still holds (no cross-org PHI).
  const [fallbackPatient, setFallbackPatient] = useState<PatientDoc | null>(null);
  const [fallbackChecked, setFallbackChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFallbackPatient(null);
    setFallbackChecked(false);
    if (!id || loading || scopedPatient) { setFallbackChecked(true); return; }
    (async () => {
      const { getPatientById } = await import('@/lib/services/patient-service');
      const doc = await getPatientById(id);
      if (cancelled) return;
      const sameOrg = !doc?.orgId || !currentUser?.orgId || doc.orgId === currentUser.orgId;
      const isNational = currentUser?.role === 'super_admin' || currentUser?.role === 'government';
      setFallbackPatient(doc && (sameOrg || isNational) ? doc : null);
      setFallbackChecked(true);
    })();
    return () => { cancelled = true; };
  }, [id, loading, scopedPatient, currentUser?.orgId, currentUser?.role]);

  const patient = scopedPatient ?? (fallbackPatient?._id === id ? fallbackPatient : undefined);
  const { records } = useMedicalRecords(patient?._id);
  const { referrals: patientReferrals } = usePatientReferrals(patient?._id);
  const { results: allLabResults } = useLabResults(patient?._id);
  const { immunizations: allImmunizations } = useImmunizations(patient?._id);
  const { visits: allANCVisits } = useANC();
  const { appointments: patientAppointments } = usePatientAppointments(patient?._id);
  const { prescriptions: allPrescriptions } = usePrescriptions(patient?._id);
  const { triages: patientTriages } = useTriage(patient?._id);
  const { canConsult, canViewClinical, canOrderLabs, canPrescribe, canBookAppointments, canManageReferrals, canRecordVitalEvents } = usePermissions();
  const canAssignPatients = ['front_desk', 'central_registration_clerk', 'clinic_clerk'].includes(currentUser?.role ?? '');

  // Defence in depth: if a non-clinical viewer lands on (or deep-links to) a
  // clinical tab, snap them back to the overview so clinical panels never render.
  useEffect(() => {
    if (!canViewClinical && !ADMIN_TAB_IDS.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [canViewClinical, activeTab]);
  const { balance: patientBalance, reload: reloadPayments } = usePatientPayments(patient?._id);
  const { problems: patientProblems } = useProblems(patient?._id);
  // Used only to detect an active ward admission for the OpenMRS-style chart
  // header's "Active Visit" chip.
  const { admissions } = useWards();

  // Patient care notes (free-text staff notes) — surfaced on the overview only
  // when present, so the page never shows an empty "Notes" placeholder.
  const [, setPatientNotes] = useState<PatientNoteDoc[]>([]);
  const patientIdForNotes = patient?._id;
  const reloadPatientNotes = useCallback(() => {
    if (!patientIdForNotes) { setPatientNotes([]); return; }
    import('@/lib/services/patient-note-service')
      .then(m => m.getNotesByPatient(patientIdForNotes))
      .then(n => setPatientNotes(n))
      .catch(() => { /* best-effort */ });
  }, [patientIdForNotes]);
  useEffect(() => {
    let cancelled = false;
    if (!patientIdForNotes) { setPatientNotes([]); return; }
    import('@/lib/services/patient-note-service')
      .then(m => m.getNotesByPatient(patientIdForNotes))
      .then(n => { if (!cancelled) setPatientNotes(n); })
      .catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, [patientIdForNotes]);

  // Outstanding balance for the most recent encounter — surfaced as a chip on
  // the "Most Recent Record" hero so clinicians see if the visit is settled.
  const [, setEncounterBalance] = useState<number | null>(null);
  // The ledger is keyed by encounterId (enc-…), not the medical-record id (mr-…),
  // so the balance must be looked up by the record's encounterId.
  const latestEncounterId = (records[0] as { encounterId?: string } | undefined)?.encounterId;
  useEffect(() => {
    if (!latestEncounterId) { setEncounterBalance(null); return; }
    let cancelled = false;
    import('@/lib/services/ledger-service')
      .then(m => m.getEncounterBalance(latestEncounterId))
      .then(b => { if (!cancelled) setEncounterBalance(b); })
      .catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, [latestEncounterId]);

  // Edit form state — initialised when modal opens
  const [editForm, setEditForm] = useState({
    firstName: '',
    middleName: '',
    surname: '',
    phone: '',
    state: '',
    county: '',
    dateOfBirth: '',
    gender: 'Male' as 'Male' | 'Female',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  /** Counties for the state currently picked in the edit form. */
  const editCounties = useMemo(
    () => (editForm.state ? statesAndCounties[editForm.state] || [] : []),
    [editForm.state],
  );

  const openEditModal = () => {
    if (!patient) return;
    setEditErrors({});
    setEditForm({
      firstName: patient.firstName || '',
      middleName: patient.middleName || '',
      surname: patient.surname || '',
      phone: patient.phone || '',
      state: patient.state || '',
      county: patient.county || '',
      dateOfBirth: patient.dateOfBirth || '',
      gender: (patient.gender as 'Male' | 'Female') || 'Male',
    });
    setShowEditModal(true);
  };

  const openPaymentFromHeader = () => {
    setActiveTab('billing');
    setShowPaymentPanel(true);
  };

  // Facesheet card actions. Each one performs the real write action the card
  // represents, reusing the flows the header/tabs already use: the prescribe
  // and lab-order modals, the visit-note drawer, the consultation vitals form,
  // and the Conditions/Allergies tabs' own "Add" modals (opened via
  // sectionAddRequest so the card's action lands directly in the add form).
  const openSectionAdd = (section: 'problems' | 'allergies') => {
    setActiveTab(section);
    setSectionAddRequest(section);
  };
  const facesheetActions: FacesheetActions = {
    ...(canPrescribe ? { medications: { label: 'Prescribe', onClick: () => setShowPrescribeModal(true) } } : {}),
    ...(canConsult ? { problems: { label: 'Add', onClick: () => openSectionAdd('problems') } } : {}),
    ...((canConsult || canRecordVitalEvents) && patient ? { vitals: { label: 'Record', onClick: () => canConsult ? router.push(`/consultation?patientId=${patient._id}`) : setShowNurseVitals(true) } } : {}),
    ...(canConsult ? { recommendations: { label: 'Review', onClick: () => setActiveTab('careChecklist'), icon: ClipboardList } } : {}),
  };

  const handleEditSubmit = async () => {
    if (!patient) return;
    // Phone is optional — only block when a non-empty value is malformed.
    if (!isValidPhone(editForm.phone)) {
      setEditErrors({ phone: t('validation.errPhone') });
      return;
    }
    setEditErrors({});
    try {
      setEditSubmitting(true);
      // Normalize to canonical form before persisting (patient-service also
      // re-normalizes, but keep the saved value canonical here too).
      const normPhone = normalizePhone(editForm.phone) ?? editForm.phone.trim();
      await updatePatient(patient._id, {
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName.trim(),
        surname: editForm.surname.trim(),
        phone: normPhone,
        state: editForm.state.trim(),
        county: editForm.county.trim(),
        dateOfBirth: editForm.dateOfBirth,
        gender: editForm.gender,
      });
      const { logAudit } = await import('@/lib/services/audit-service');
      await logAudit('PATIENT_EDIT', undefined, undefined,
        `Updated demographics for ${patient.hospitalNumber} (${editForm.firstName} ${editForm.surname})`
      ).catch(() => {});
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Still "loading" while the scoped list loads OR while the out-of-facility
  // fallback lookup is in flight — only declare "not found" once both are done.
  const stillResolving = loading || (!patient && !fallbackChecked);
  if (stillResolving || !patient) {
    return (
      <>
        <main className="page-container flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {stillResolving ? t('status.loading') : t('patient.notFound')}
          </p>
        </main>
      </>
    );
  }

  const regHospital = hospitals.find(h => h._id === patient.registrationHospital);

  const sendPatientMessage = async () => {
    if (!patient || !currentUser) return;
    const body = messageBody.trim();
    if (!body) {
      setMessageError('Enter a message before sending.');
      return;
    }
    if ((messageChannel === 'sms' || messageChannel === 'both') && !patient.phone) {
      setMessageError('This patient does not have a phone number for SMS.');
      return;
    }
    setMessageSending(true);
    setMessageError('');
    try {
      const { createMessage } = await import('@/lib/services/message-service');
      await createMessage({
        patientId: patient._id,
        patientName: patientFullName(patient),
        patientPhone: patient.phone || '',
        recipientType: 'patient',
        direction: 'staff_to_patient',
        fromDoctorId: currentUser._id,
        fromDoctorName: currentUser.name || currentUser.username || 'Care team',
        fromHospitalId: currentUser.hospitalId,
        fromHospitalName: regHospital?.name || patient.registrationHospital || '',
        subject: messageSubject.trim() || 'Patient message',
        body,
        channel: messageChannel,
        sentAt: new Date().toISOString(),
        orgId: currentUser.orgId,
      });
      setMessageSent(true);
      setMessageBody('');
      setMessageSubject('Follow-up from your care team');
      setMessageChannel('app');
    } catch (err) {
      console.error(err);
      setMessageError('Could not send this message. Please try again.');
    } finally {
      setMessageSending(false);
    }
  };

  // Appointment sort key for the Appointments tab.
  const apptTs = (a: { appointmentDate: string; appointmentTime?: string }) =>
    new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}:00`).getTime();

  const allTabs = [
    { id: 'overview', label: 'Summary', icon: Heart },
    { id: 'history', label: 'Activity', icon: FileText },
    { id: 'problems', label: 'Problems', icon: AlertTriangle },
    { id: 'prescriptions', label: 'Medications', icon: Pill },
    { id: 'immunizations', label: 'Immunizations', icon: Syringe },
    { id: 'allergies', label: 'Allergies', icon: ShieldAlert },
    { id: 'vitals', label: 'Vitals', icon: Activity },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'labs', label: 'Results', icon: FlaskConical },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'procedures', label: 'Procedures', icon: Bandage },
    { id: 'programs', label: 'Programs', icon: Layers },
    { id: 'demographics', label: 'Demographics', icon: UserIcon },
    { id: 'billing', label: 'Account', icon: Wallet },
    { id: 'careChecklist', label: 'Care Plan', icon: ClipboardList },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'appointments', label: 'Appointments & follow-up', icon: Calendar },
    { id: 'referrals', label: 'Care coordination', icon: ArrowRightLeft },
  ];
  const tabs = canViewClinical ? allTabs : allTabs.filter(tb => ADMIN_TAB_IDS.includes(tb.id));

  // records[] is sorted newest-first by the service layer.
  const latestRecord = records[0];
  const latestVitals = latestRecord?.vitalSigns;
  // The sticky vitals band shows the most recent record that actually carries
  // vital signs — records[0] is often a note with no vitals, which would leave
  // the band blank even when older encounters have readings. The band's
  // freshness timestamp follows this record too, so "X days old" is meaningful.
  const latestVitalsRecord = records.find(r => r.vitalSigns);


  // ── OpenMRS-style chart shell wiring ────────────────────────────────────
  // Keep the primary rail focused on the six tasks staff perform repeatedly.
  // Less frequent clinical sections remain available under More.
  const OMRS_RAIL_DEFS: { id: string; label: string; icon: typeof Heart; clinicalOnly?: boolean }[] = [
    { id: 'overview', label: 'Summary', icon: Heart },
    { id: 'history', label: 'Activity', icon: History },
    { id: 'prescriptions', label: 'Medications', icon: Pill },
    { id: 'labs', label: 'Results', icon: FlaskConical },
    { id: 'careChecklist', label: 'Care plan', icon: ClipboardList },
    // Referrals and internal transfers are one coordination workflow. Keep it
    // in the primary rail so ownership changes cannot be hidden under More.
    { id: 'referrals', label: 'Care coordination', icon: ArrowRightLeft },
  ];
  const omrsRailIds = new Set(OMRS_RAIL_DEFS.map(d => d.id));
  const omrsRailItems = OMRS_RAIL_DEFS.filter(item => (item.clinicalOnly ? canViewClinical : tabs.some(t => t.id === item.id)));
  // Everything reachable from the full chart model that doesn't have an
  // OpenMRS-rail slot is available under More.
  const omrsMoreItems = tabs.filter(t => !omrsRailIds.has(t.id));

  // Sticky header: "Active Visit" chip — a checked-in/in-progress appointment
  // today, or an active ward admission.
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasActiveApptToday = (patientAppointments || []).some(a =>
    a.appointmentDate === todayStr && (a.status === 'checked_in' || a.status === 'in_progress'));
  const hasActiveAdmission = (admissions || []).some(a => a.patientId === patient._id && a.status === 'admitted');
  const hasActiveVisit = hasActiveApptToday || hasActiveAdmission;

  // Sticky header: pregnancy pill — hoisted unchanged from the old inline
  // patient-banner IIFE so the ANC-derived pill keeps behaving identically.
  const patientANC = (allANCVisits || []).filter(a => a.patientId === patient._id);
  const activeANC = patientANC.find(a => !a.linkedBirthId);
  const isPregnant = !!activeANC;
  const pregnancyPillNode = isPregnant ? (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-bold" style={{
      background: 'rgba(217, 110, 89, 0.12)', color: 'var(--color-danger-500)', border: '1px solid rgba(217, 110, 89, 0.32)', letterSpacing: 0.2,
    }}>
      <DuotoneInfoIcon name="pregnant" size={11} color="var(--color-danger-500)" accent="var(--color-danger-500)" />
      Pregnant{activeANC?.gestationalAge ? ` · ${activeANC.gestationalAge} wk` : ''}
    </span>
  ) : null;

  // Sticky header: triage badge + popup — hoisted unchanged from the old
  // inline patient-banner IIFE (same showTriagePopup state, same rendering).
  const triageBadgeNode = patientTriages.length > 0 ? (() => {
    const latest = patientTriages[0];
    const hoursOld = (Date.now() - new Date(latest.triagedAt).getTime()) / 3600000;
    if (hoursOld > 24 && latest.status !== 'pending') return null;
    const color = latest.priority === 'RED' ? 'var(--color-danger)' : latest.priority === 'YELLOW' ? 'var(--color-warning)' : 'var(--color-success)';
    const bg = latest.priority === 'RED' ? 'rgba(220,38,38,0.10)' : latest.priority === 'YELLOW' ? 'rgba(217,119,6,0.10)' : 'rgba(5,150,105,0.10)';
    const label = latest.priority === 'RED' ? 'Emergency — immediate care' : latest.priority === 'YELLOW' ? 'Priority — see soon' : 'Non-urgent';
    return (
      <div className="relative">
        <button
          onClick={() => setShowTriagePopup(v => !v)}
          aria-label="View triage details"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 8,
            background: bg, border: `1.5px solid ${color}`,
            color, cursor: 'pointer',
            animation: latest.priority === 'RED' ? 'pulse 2s infinite' : undefined,
          }}
        >
          <AlertTriangle className="w-4 h-4" />
        </button>
        {showTriagePopup && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowTriagePopup(false)} />
            <div
              className="absolute left-0 top-10 z-50 rounded-2xl overflow-hidden"
              style={{ width: 340, background: 'var(--bg-card-solid)', border: `1px solid ${color}40`, boxShadow: 'none' }}
            >
              {/* Header strip */}
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: bg, borderBottom: `1px solid ${color}30` }}>
                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>ETAT Triage · {label}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(latest.triagedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg-app)', color }}>
                  {latest.status}
                </span>
              </div>
              {/* Body */}
              <div className="px-4 py-3 space-y-2">
                {latest.chiefComplaint && (
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{latest.chiefComplaint}</p>
                )}
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  A: {latest.airway} · B: {latest.breathing} · C: {latest.circulation} · AVPU: {latest.consciousness?.toUpperCase()[0]}
                </p>
                {(latest.temperature || latest.pulse || latest.oxygenSaturation || latest.systolic) && (
                  <p className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {latest.temperature && `T ${latest.temperature}°C  `}
                    {latest.pulse && `HR ${latest.pulse}  `}
                    {latest.respiratoryRate && `RR ${latest.respiratoryRate}  `}
                    {latest.oxygenSaturation && `SpO₂ ${latest.oxygenSaturation}%  `}
                    {(latest.systolic && latest.diastolic) && `BP ${latest.systolic}/${latest.diastolic}`}
                  </p>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>by {latest.triagedByName}</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  })() : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .print-only { display: none; }

        @media print {
          /* ── Page setup ── */
          @page {
            size: A4;
            margin: 0;
          }
          @page :first { margin-top: 0; }

          html, body {
            background: #fff !important;
            color: #1a1a1a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: var(--font-platform) !important;
            font-size: 9pt;
            line-height: 1.45;
          }

          /* Hide all app chrome — target every node in the tree */
          body * { visibility: hidden !important; }
          .print-doc-root,
          .print-doc-root * { visibility: visible !important; }

          /* Full-page print wrapper — absolute so content flows across pages */
          .print-doc-root {
            position: absolute;
            top: 0; left: 0; right: 0;
            width: 100%;
            background: #fff;
          }

          /* Reset everything inside the doc */
          .print-doc-root * {
            font-family: var(--font-platform) !important;
            box-sizing: border-box;
            animation: none !important;
            transition: none !important;
          }

          svg:not(.print-logo-svg) { display: none !important; }

          /* ── Header band ── */
          .rx-header {
            background: #015697 !important;
            padding: 10mm 14mm 8mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .rx-header-left { display: flex; align-items: center; gap: 12pt; }
          .rx-logo-wrap {
            background: #fff !important;
            border-radius: 8pt;
            padding: 5pt 7pt;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .rx-logo-wrap img { width: 36pt; height: 36pt; display: block !important; }
          .rx-facility-name {
            color: #fff !important;
            font-size: 13pt;
            font-weight: 700;
            letter-spacing: 0.3pt;
          }
          .rx-facility-sub {
            color: rgba(255,255,255,0.72) !important;
            font-size: 8pt;
            margin-top: 2pt;
          }
          .rx-doc-label {
            text-align: right;
          }
          .rx-doc-label .rx-doc-title {
            color: #fff !important;
            font-size: 10pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1pt;
          }
          .rx-doc-label .rx-doc-meta {
            color: rgba(255,255,255,0.75) !important;
            font-size: 7.5pt;
            margin-top: 4pt;
            line-height: 1.6;
          }

          /* ── Patient banner ── */
          .rx-patient-banner {
            background: #f0f6fb !important;
            border-bottom: 2px solid #015697 !important;
            padding: 6mm 14mm;
            page-break-inside: avoid;
          }
          .rx-patient-name {
            font-size: 15pt;
            font-weight: 700;
            color: #015697 !important;
            margin-bottom: 5pt;
          }
          .rx-patient-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6pt 12pt;
          }
          .rx-patient-field label {
            display: block;
            font-size: 6.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            color: #5a7a96 !important;
            margin-bottom: 1pt;
          }
          .rx-patient-field span {
            font-size: 8.5pt;
            color: #1a1a1a !important;
            font-weight: 500;
          }

          /* ── Body ── */
          .rx-body { padding: 6mm 14mm; }

          /* ── Section ── */
          .rx-section { margin-bottom: 10pt; page-break-inside: avoid; }
          .rx-section-title {
            font-size: 8pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8pt;
            color: #015697 !important;
            border-bottom: 1.5pt solid #015697 !important;
            padding-bottom: 2pt;
            margin-bottom: 5pt;
          }
          .rx-section-body { font-size: 8.5pt; color: #1a1a1a !important; }

          /* ── Two-column layout ── */
          .rx-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; }
          .rx-three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10pt; }

          /* ── Field inline ── */
          .rx-field { margin-bottom: 4pt; }
          .rx-field b { color: #333 !important; font-weight: 600; }

          /* ── Vitals table ── */
          .rx-vitals-table { width: 100%; border-collapse: collapse; }
          .rx-vitals-table td {
            border: 1pt solid #c5d8e8 !important;
            padding: 4pt 8pt;
            font-size: 8pt;
            text-align: center;
            color: #1a1a1a !important;
          }
          .rx-vitals-table td:first-child { text-align: left; font-weight: 600; background: #f0f6fb !important; }

          /* ── Med / lab rows ── */
          .rx-row {
            border-bottom: 0.5pt solid #dde8f0 !important;
            padding: 3pt 0;
            font-size: 8.5pt;
            color: #1a1a1a !important;
          }
          .rx-row:last-child { border-bottom: none !important; }
          .rx-row b { color: #015697 !important; }

          /* ── Diagnosis rows ── */
          .rx-dx-row { display: flex; gap: 8pt; align-items: baseline; margin-bottom: 3pt; }
          .rx-dx-code { font-size: 7pt; font-weight: 700; background: #e8f2fa !important; color: #015697 !important; padding: 1pt 5pt; border-radius: 3pt; flex-shrink: 0; }
          .rx-dx-name { font-size: 8.5pt; color: #1a1a1a !important; }
          .rx-dx-type { font-size: 7pt; color: #888 !important; margin-left: 4pt; }

          /* ── Allergy pill ── */
          .rx-allergy-row { display: flex; gap: 6pt; align-items: center; margin-bottom: 3pt; }
          .rx-allergy-sev { font-size: 7pt; font-weight: 700; padding: 1pt 5pt; border-radius: 3pt; }
          .rx-allergy-sev.severe { background: #fde8e8 !important; color: #c0392b !important; }
          .rx-allergy-sev.moderate { background: #fef3cd !important; color: #b7791f !important; }
          .rx-allergy-sev.mild { background: #d4edda !important; color: #276749 !important; }
          .rx-allergy-sev.unknown { background: #f1f3f4 !important; color: #555 !important; }

          /* ── Signature block ── */
          .rx-sig-block {
            margin-top: 14pt;
            padding-top: 10pt;
            border-top: 1.5pt solid #015697 !important;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30pt;
            page-break-inside: avoid;
          }
          .rx-sig-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; color: #5a7a96 !important; margin-bottom: 18pt; }
          .rx-sig-line { border-bottom: 1pt solid #333 !important; margin-bottom: 4pt; height: 1pt; }
          .rx-sig-name { font-size: 8.5pt; color: #1a1a1a !important; font-weight: 600; }
          .rx-sig-role { font-size: 7.5pt; color: #666 !important; }

          /* ── Footer ── */
          .rx-footer {
            background: #f0f6fb !important;
            border-top: 1pt solid #c5d8e8 !important;
            padding: 4mm 14mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7pt;
            color: #5a7a96 !important;
            margin-top: 10mm;
          }
          .rx-footer-conf { font-weight: 700; color: #c0392b !important; }

          /* page break helpers */
          .rx-page-break { page-break-before: always; }
        }
      ` }} />
      <main ref={contentRef} className="page-container ehr-chart-page">
          {/* ══════ PRINT-ONLY HOSPITAL DOCUMENT ══════ */}
          {printSigned && (() => {
            const activeAllergies = (patient.structuredAllergies || []).filter((a: { status: string }) => a.status === 'active');
            const legacyAllergies = !patient.structuredAllergies ? (patient.allergies || []).filter(Boolean) : [];
            const activeProblems = patientProblems.filter(p => p.status === 'active' || p.status === 'chronic');
            const currentMeds = (allPrescriptions || []).filter(rx => rx.patientId === patient._id && rx.status !== 'dispensed');
            const patientLabs = (allLabResults || []).filter(l => l.patientId === patient._id).slice(0, 12);
            const patientImms = (allImmunizations || []).filter(i => i.patientId === patient._id);
            const upcomingPrint = (patientAppointments || [])
              .filter(a => a.status !== 'cancelled' && a.status !== 'no_show' && new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}`).getTime() >= Date.now())
              .sort((x, y) => `${x.appointmentDate}T${x.appointmentTime || '00:00'}`.localeCompare(`${y.appointmentDate}T${y.appointmentTime || '00:00'}`))[0];
            const printedAt = new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
            return (
              <div className="print-only print-doc-root">

                {/* ── Blue header band ── */}
                <div className="rx-header">
                  <div className="rx-header-left">
                    <div className="rx-logo-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/assets/logos/SVG/Tamam_Style_Guide-33.svg" alt="Tamam" />
                    </div>
                    <div>
                      <div className="rx-facility-name">{patient.registrationHospital || 'Tamam Facility'}</div>
                      <div className="rx-facility-sub">Tamam · Patient record</div>
                    </div>
                  </div>
                  <div className="rx-doc-label">
                    <div className="rx-doc-title">Patient Medical Record</div>
                    <div className="rx-doc-meta">
                      <span>Printed: {printedAt}</span><br />
                      <span>Record ID: {patient.hospitalNumber || patient.geocodeId || '—'}</span><br />
                      {patient.nationalId && <span>National ID: {patient.nationalId}</span>}
                    </div>
                  </div>
                </div>

                {/* ── Patient identity banner ── */}
                <div className="rx-patient-banner">
                  <div className="rx-patient-name">{patientFullName(patient)}</div>
                  <div className="rx-patient-grid">
                    <div className="rx-patient-field"><label>Date of Birth</label><span>{formatDate(patient.dateOfBirth)}</span></div>
                    <div className="rx-patient-field"><label>Age / Sex</label><span>{patientAgeLabel(patient)} · {patient.gender || '—'}</span></div>
                    <div className="rx-patient-field"><label>Hospital Number</label><span>{patient.hospitalNumber || '—'}</span></div>
                    <div className="rx-patient-field"><label>Phone</label><span>{patient.phone || '—'}</span></div>
                    <div className="rx-patient-field"><label>State / County</label><span>{patient.state || '—'}{patient.county ? ` · ${patient.county}` : ''}</span></div>
                    <div className="rx-patient-field"><label>Facility</label><span>{patient.registrationHospital || 'Tamam Facility'}</span></div>
                    <div className="rx-patient-field"><label>Visit Date</label><span>{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</span></div>
                    <div className="rx-patient-field"><label>Blood Group</label><span>{(patient as unknown as Record<string, string>).bloodGroup || '—'}</span></div>
                  </div>
                </div>

                {/* ── Document body ── */}
                <div className="rx-body">

                  {/* Consultation Note */}
                  {printSections.has('consultation') && latestRecord && (
                    <div className="rx-section">
                      <div className="rx-section-title">Consultation Note</div>
                      <div className="rx-section-body">
                        <div className="rx-two-col" style={{ marginBottom: 6 }}>
                          <div className="rx-field"><b>Date:</b> {formatDateTime(latestRecord.consultedAt || latestRecord.visitDate)}</div>
                          <div className="rx-field"><b>Visit type:</b> {latestRecord.visitType}</div>
                          <div className="rx-field"><b>Provider:</b> {latestRecord.providerName}</div>
                          <div className="rx-field"><b>Department:</b> {latestRecord.department}</div>
                        </div>
                        {latestRecord.chiefComplaint && <div className="rx-field"><b>Chief complaint:</b> {latestRecord.chiefComplaint}</div>}
                        {latestRecord.historyOfPresentIllness && <div className="rx-field" style={{ marginTop: 4 }}><b>History of present illness:</b> {latestRecord.historyOfPresentIllness}</div>}
                        {latestRecord.physicalExamination && Object.entries(latestRecord.physicalExamination).filter(([, v]) => v).length > 0 && (
                          <div className="rx-field" style={{ marginTop: 4 }}>
                            <b>Physical examination:</b>{' '}
                            {Object.entries(latestRecord.physicalExamination)
                              .filter(([, v]) => v)
                              .map(([sys, v]) => `${sys.charAt(0).toUpperCase()}${sys.slice(1)}: ${v}`)
                              .join('; ')}
                          </div>
                        )}
                        {latestRecord.treatmentPlan && <div className="rx-field" style={{ marginTop: 4 }}><b>Treatment plan:</b> {latestRecord.treatmentPlan}</div>}
                      </div>
                    </div>
                  )}

                  {/* Diagnoses + Active Problems side by side */}
                  {printSections.has('problems') && <div className="rx-two-col">
                    {latestRecord?.diagnoses && latestRecord.diagnoses.length > 0 && (
                      <div className="rx-section">
                        <div className="rx-section-title">Diagnoses (This Visit)</div>
                        <div className="rx-section-body">
                          {latestRecord.diagnoses.map((d, i) => (
                            <div key={i} className="rx-dx-row">
                              {d.icd10Code && <span className="rx-dx-code">{d.icd10Code}</span>}
                              <span className="rx-dx-name">{d.name}</span>
                              {d.type && <span className="rx-dx-type">{d.type}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeProblems.length > 0 && (
                      <div className="rx-section">
                        <div className="rx-section-title">Active Problem List</div>
                        <div className="rx-section-body">
                          {activeProblems.map(p => (
                            <div key={p._id} className="rx-dx-row">
                              {(p.icd10Code || p.icd11Code) && <span className="rx-dx-code">{p.icd10Code || p.icd11Code}</span>}
                              <span className="rx-dx-name">{p.name}</span>
                              {p.status === 'chronic' && <span className="rx-dx-type">chronic</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>}

                  {/* Vital Signs */}
                  {printSections.has('vitals') && latestVitals && (
                    <div className="rx-section">
                      <div className="rx-section-title">Vital Signs</div>
                      <div className="rx-section-body">
                        <table className="rx-vitals-table">
                          <tbody>
                            <tr>
                              {latestVitals.temperature && <><td>Temperature</td><td>{latestVitals.temperature} °C</td></>}
                              {latestVitals.systolic && <><td>Blood Pressure</td><td>{latestVitals.systolic}/{latestVitals.diastolic} mmHg</td></>}
                              {latestVitals.pulse && <><td>Pulse</td><td>{latestVitals.pulse} bpm</td></>}
                            </tr>
                            <tr>
                              {latestVitals.respiratoryRate && <><td>Resp. Rate</td><td>{latestVitals.respiratoryRate} /min</td></>}
                              {latestVitals.oxygenSaturation && <><td>SpO₂</td><td>{latestVitals.oxygenSaturation}%</td></>}
                              {latestVitals.weight && <><td>Weight</td><td>{latestVitals.weight} kg</td></>}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Prescriptions */}
                  {printSections.has('medications') && currentMeds.length > 0 && (
                    <div className="rx-section">
                      <div className="rx-section-title">Prescriptions</div>
                      <div className="rx-section-body">
                        {currentMeds.map((rx, i) => (
                          <div key={rx._id} className="rx-row" style={{ display: 'flex', gap: 12 }}>
                            <span style={{ minWidth: 18, color: '#5a7a96', fontSize: '7.5pt', paddingTop: 1 }}>{i + 1}.</span>
                            <span><b>{rx.medication}</b></span>
                            <span style={{ color: '#555' }}>{rx.dose} · {rx.frequency}{rx.duration ? ` · ${rx.duration}` : ''}{rx.route ? ` · ${rx.route}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Allergies */}
                  {printSections.has('allergies') && (activeAllergies.length > 0 || legacyAllergies.length > 0) && (
                    <div className="rx-section">
                      <div className="rx-section-title">Allergy &amp; Adverse Reaction Record</div>
                      <div className="rx-section-body">
                        {activeAllergies.map((a: { id: string; substance: string; criticality?: string; classification?: string; reaction?: string }) => (
                          <div key={a.id} className="rx-allergy-row">
                            {a.criticality && (
                              <span className={`rx-allergy-sev ${a.criticality.toLowerCase()}`}>{a.criticality}</span>
                            )}
                            <b>{a.substance}</b>
                            {a.classification && <span style={{ color: '#555', fontSize: '8pt' }}>{a.classification}</span>}
                            {a.reaction && <span style={{ color: '#555', fontSize: '8pt' }}>— Reaction: {a.reaction}</span>}
                          </div>
                        ))}
                        {legacyAllergies.map((a: string, i: number) => (
                          <div key={i} className="rx-allergy-row"><b>{a}</b></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lab Results */}
                  {printSections.has('labs') && patientLabs.length > 0 && (
                    <div className="rx-section">
                      <div className="rx-section-title">Recent Laboratory Results</div>
                      <div className="rx-section-body">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
                          <thead>
                            <tr style={{ background: '#f0f6fb' }}>
                              <th style={{ textAlign: 'left', padding: '3pt 8pt', borderBottom: '1pt solid #c5d8e8', fontWeight: 700 }}>Test</th>
                              <th style={{ textAlign: 'left', padding: '3pt 8pt', borderBottom: '1pt solid #c5d8e8', fontWeight: 700 }}>Result</th>
                              <th style={{ textAlign: 'left', padding: '3pt 8pt', borderBottom: '1pt solid #c5d8e8', fontWeight: 700 }}>Unit</th>
                              <th style={{ textAlign: 'left', padding: '3pt 8pt', borderBottom: '1pt solid #c5d8e8', fontWeight: 700 }}>Reference</th>
                              <th style={{ textAlign: 'left', padding: '3pt 8pt', borderBottom: '1pt solid #c5d8e8', fontWeight: 700 }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patientLabs.map((l, i) => (
                              <tr key={i} style={{ borderBottom: '0.5pt solid #dde8f0', background: l.abnormal ? '#fff8f8' : 'transparent' }}>
                                <td style={{ padding: '3pt 8pt', fontWeight: 600 }}>{l.testName}</td>
                                <td style={{ padding: '3pt 8pt', color: l.abnormal ? '#c0392b' : '#1a1a1a', fontWeight: l.abnormal ? 700 : 400 }}>{l.result}{l.abnormal ? ' ↑' : ''}</td>
                                <td style={{ padding: '3pt 8pt', color: '#555' }}>{l.unit || '—'}</td>
                                <td style={{ padding: '3pt 8pt', color: '#555' }}>{l.referenceRange || '—'}</td>
                                <td style={{ padding: '3pt 8pt', color: '#555' }}>{formatDate(l.completedAt || l.orderedAt || l.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Immunizations */}
                  {printSections.has('immunizations') && patientImms.length > 0 && (
                    <div className="rx-section">
                      <div className="rx-section-title">Immunization Record</div>
                      <div className="rx-section-body">
                        <div className="rx-three-col">
                          {patientImms.map((im, i) => (
                            <div key={i} className="rx-row" style={{ borderBottom: 'none', paddingBottom: 2 }}>
                              <b>{im.vaccine}</b>{im.doseNumber ? ` (Dose ${im.doseNumber})` : ''}<br />
                              <span style={{ color: '#555', fontSize: '7.5pt' }}>{formatDate(im.dateGiven)}{im.batchNumber ? ` · Batch: ${im.batchNumber}` : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Next Appointment */}
                  {printSections.has('appointments') && upcomingPrint && (
                    <div className="rx-section">
                      <div className="rx-section-title">Next Appointment</div>
                      <div className="rx-section-body rx-two-col">
                        <div className="rx-field"><b>Date &amp; Time:</b> {new Date(`${upcomingPrint.appointmentDate}T${upcomingPrint.appointmentTime || '00:00'}`).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</div>
                        {upcomingPrint.reason && <div className="rx-field"><b>Reason:</b> {upcomingPrint.reason}</div>}
                        {upcomingPrint.providerName && <div className="rx-field"><b>Provider:</b> {upcomingPrint.providerName}</div>}
                        <div className="rx-field"><b>Facility:</b> {patient.registrationHospital || 'Tamam Facility'}</div>
                      </div>
                    </div>
                  )}

                  {/* Signature block */}
                  <div className="rx-sig-block">
                    <div>
                      <div className="rx-sig-label">Clinician Signature</div>
                      <div className="rx-sig-line" />
                      <div className="rx-sig-name">{printSignature}</div>
                      <div className="rx-sig-role">{currentUser?.role ? currentUser.role.replace(/_/g, ' ') : ''}</div>
                      <div className="rx-sig-role">Signed: {printedAt}</div>
                    </div>
                    <div>
                      <div className="rx-sig-label">Patient / Guardian Signature</div>
                      <div className="rx-sig-line" />
                      <div className="rx-sig-role">Date: ______________________</div>
                      <div className="rx-sig-role" style={{ marginTop: 4 }}>Relationship: ______________</div>
                    </div>
                  </div>

                </div>{/* end rx-body */}

                {/* Fixed footer on every page */}
                <div className="rx-footer">
                  <span className="rx-footer-conf">CONFIDENTIAL — Patient Medical Record</span>
                  <span>Tamam · {patient.hospitalNumber || patient.geocodeId} · {patient.registrationHospital || 'Tamam Facility'}</span>
                  <span>Printed: {printedAt}</span>
                </div>

              </div>
            );
          })()}

          {/* ══════ SIGN BEFORE PRINT MODAL ══════ */}
          {showPrintModal && (
            <Modal onClose={() => setShowPrintModal(false)} width={560} labelledBy="print-sign-title">
              <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div className="flex items-center justify-between">
                  <h2 id="print-sign-title" className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Print patient record</h2>
                  <button className="p-1 rounded" onClick={() => setShowPrintModal(false)} style={{ color: 'var(--text-muted)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Patient identity is always included. Select the sections needed for this printout, then sign the document.
                </p>
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>Sections to print</span>
                    <button
                      type="button"
                      className="text-[11px] font-semibold"
                      style={{ color: 'var(--tamamhealth-blue)' }}
                      onClick={() => setPrintSections(prev => prev.size === PRINT_SECTION_OPTIONS.length ? new Set() : new Set(DEFAULT_PRINT_SECTIONS))}
                    >
                      {printSections.size === PRINT_SECTION_OPTIONS.length ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRINT_SECTION_OPTIONS.map(section => (
                      <label key={section.id} className="flex items-start gap-2 rounded-md p-2 cursor-pointer" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                        <input
                          type="checkbox"
                          checked={printSections.has(section.id)}
                          onChange={() => setPrintSections(prev => {
                            const next = new Set(prev);
                            if (next.has(section.id)) next.delete(section.id); else next.add(section.id);
                            return next;
                          })}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{section.label}</span>
                          <span className="block text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>{section.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Clinician name &amp; title</label>
                  <input
                    autoFocus
                    value={printSignature}
                    onChange={e => setPrintSignature(e.target.value)}
                    placeholder="e.g. Dr. James Wani Igga, MD"
                    className="w-full p-2.5 rounded-md text-[13px]"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && printSignature.trim() && printSections.size > 0) {
                        setShowPrintModal(false);
                        setPrintSigned(true);
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowPrintModal(false)}>Cancel</button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!printSignature.trim() || printSections.size === 0}
                    onClick={() => {
                      setShowPrintModal(false);
                      setPrintSigned(true);
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" /> Sign &amp; Print selected
                  </button>
                </div>
              </div>
            </Modal>
          )}

          <button onClick={() => router.push('/patients')} className="ehr-chart-back flex items-center gap-1.5 text-sm mb-4 no-print" style={{ color: 'var(--tamamhealth-blue)' }}>
            <ArrowLeft className="w-4 h-4" /> {t('action.back')}
          </button>

          <OpenmrsChartShell
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            railItems={omrsRailItems}
            moreItems={omrsMoreItems}
            patient={patient}
            currentUser={currentUser}
            canPrescribe={canPrescribe}
            canOrderLabs={canOrderLabs}
            canConsult={canConsult}
            router={router}
            onOpenPrescribeModal={() => setShowPrescribeModal(true)}
            onOpenOrderLabModal={() => setShowOrderLabModal(true)}
            onNoteSaved={reloadPatientNotes}
            panelRequest={chartPanelRequest}
            onPanelRequestHandled={() => setChartPanelRequest(null)}
            header={
              <ChartHeader
                patient={patient}
                triageBadge={triageBadgeNode}
                pregnancyPill={pregnancyPillNode}
                hasActiveVisit={hasActiveVisit}
                patientBalance={patientBalance}
                onCollectPayment={openPaymentFromHeader}
                onMessage={() => setShowMessageModal(true)}
                onPrint={() => { setPrintSignature(currentUser?.name || ''); setPrintSections(new Set(DEFAULT_PRINT_SECTIONS)); setPrintSigned(false); setShowPrintModal(true); }}
                onPatientEd={() => {
                  // Real patient-education action: a message queued to the
                  // patient (app/SMS), pre-labelled — not just a tab switch.
                  setMessageSubject('Patient education');
                  setShowMessageModal(true);
                }}
                onNote={() => (canConsult ? setChartPanelRequest('visit-note') : setActiveTab('notes'))}
                onScripts={() => (canPrescribe ? setShowPrescribeModal(true) : setActiveTab('prescriptions'))}
                onOrders={() => (canOrderLabs ? setShowOrderLabModal(true) : setActiveTab('labs'))}
                onExchange={() => (canManageReferrals ? setShowReferModal(true) : setActiveTab('appointments'))}
                onEdit={openEditModal}
                onStickyNote={() => { if (canViewClinical) setActiveTab('notes'); }}
                onAssignProvider={canAssignPatients ? () => setAssignTarget({
                  patientId: patient._id,
                  patientName: patientFullName(patient),
                  hospitalNumber: patient.hospitalNumber,
                  currentDoctorId: patient.assignedDoctor,
                }) : undefined}
              />
            }
            vitalsBand={canViewClinical ? (
              <ChartVitalsBand
                latestVitals={latestVitalsRecord?.vitalSigns}
                latestRecordDate={latestVitalsRecord?.consultedAt || latestVitalsRecord?.visitDate}
                onViewVitalsHistory={() => setActiveTab('vitals')}
                onRecordVitals={() => {
                  if (canConsult) router.push(`/consultation?patientId=${patient._id}`);
                  else { setActiveTab('vitals'); setShowNurseVitals(true); }
                }}
                canRecordVitals={canConsult || canRecordVitalEvents}
              />
            ) : undefined}
          >
          <section className="ehr-chart-content">


          {/* Care ownership is in flight (or time-boxed) — shown on every tab,
              because a clinician who doesn't know a transfer is pending can
              start work the receiving team is about to take over. */}
          {patient && (
            <TransferBanner patient={patient} onOpenHistory={() => setActiveTab('referrals')} />
          )}


          {activeTab === 'overview' && (
            <PatientFacesheetView
              patient={patient}
              latestVitals={latestVitalsRecord?.vitalSigns}
              problems={patientProblems}
              prescriptions={(allPrescriptions || []).filter(rx => rx.patientId === patient._id)}
              labResults={(allLabResults || []).filter(lab => lab.patientId === patient._id)}
              immunizations={(allImmunizations || []).filter(imm => imm.patientId === patient._id)}
              canViewClinical={canViewClinical}
              onOpenTab={setActiveTab}
              actions={facesheetActions}
              visiblePanelIds={facesheetPanels}
              customizeOpen={showCustomizeView}
              onToggleCustomize={() => setShowCustomizeView(open => !open)}
              onTogglePanel={toggleFacesheetPanel}
              onResetPanels={() => setFacesheetPanels(new Set(DEFAULT_FACESHEET_PANELS))}
            />
          )}

          {activeTab === 'appointments' && patient && (() => {
            const sortedAppts = [...patientAppointments].sort((a, b) => apptTs(b) - apptTs(a));
            const apptPageRows = sortedAppts.slice((apptPage - 1) * APPT_PAGE_SIZE, apptPage * APPT_PAGE_SIZE);
            return (
              <div className="space-y-2">
                <ChartSection
                  title="Appointments"
                  addLabel="New appointment"
                  onAdd={canBookAppointments ? () => router.push(`/appointments?new=1&patientId=${patient._id}`) : undefined}
                  pagination={{ page: apptPage, pageSize: APPT_PAGE_SIZE, total: sortedAppts.length, onPageChange: setApptPage }}
                >
                  {sortedAppts.length === 0 ? (
                    <OmrsEmptyState
                      itemLabel="appointments"
                      actionLabel="Record appointments"
                      onAction={canBookAppointments ? () => router.push(`/appointments?new=1&patientId=${patient._id}`) : undefined}
                      disabledReason={canBookAppointments ? undefined : 'Requires scheduling permission'}
                    />
                  ) : (
                    <table className="omrs-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Care team</th>
                          <th>Context</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apptPageRows.map(appt => (
                          <tr key={appt._id}>
                            <td className="font-mono">{formatDate(appt.appointmentDate)}</td>
                            <td>{formatClockTime(appt.appointmentTime) || '—'}</td>
                            <td>
                              <div className="appointment-card-provider">
                                <strong>{appt.providerName || patient.assignedDoctorName || 'Doctor unassigned'}</strong>
                                <span>{patient.assignedByName || 'Nurse unassigned'}</span>
                              </div>
                            </td>
                            <td>
                              <div className="appointment-card-provider">
                                <strong>{appt.reason || appt.department || 'Follow-up'}</strong>
                                <span>{appt.department || 'Appointment'}</span>
                              </div>
                            </td>
                            <td><span className="badge badge-normal text-[10px]">{humanizeStatus(appt.status)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ChartSection>
              </div>
            );
          })()}

          {activeTab === 'sbar' && patient && (
            <div className="card-elevated p-5">
              <PatientSBAR
                patient={patient}
                records={records}
                labs={(allLabResults || []).filter(l => l.patientId === patient._id)}
                prescriptions={(allPrescriptions || []).filter(r => r.patientId === patient._id)}
                triages={patientTriages}
                problems={patientProblems}
              />
            </div>
          )}

          {/* Problem List — longitudinal active/chronic/resolved */}
          {/* Conditions — OpenMRS-style Conditions table (ChartSection), replacing
              the old ProblemList card-list layout for this tab specifically.
              The original ProblemList widget (with inline edit/resolve) still
              lives on the legacy facesheet view. */}
          {activeTab === 'problems' && patient && (
            <div className="space-y-4">
              <ConditionsSection
                patientId={patient._id}
                patientName={patientFullName(patient)}
                autoOpenAdd={sectionAddRequest === 'problems'}
                onAutoOpenHandled={() => setSectionAddRequest(null)}
              />
            </div>
          )}

          {/* Allergies — OpenMRS-style Allergies table (ChartSection). Directives
              stay reachable here since they don't have their own rail slot. */}
          {activeTab === 'allergies' && patient && (
            <div className="space-y-4">
              <AllergiesSection
                patient={patient}
                autoOpenAdd={sectionAddRequest === 'allergies'}
                onAutoOpenHandled={() => setSectionAddRequest(null)}
              />
              <div className="card-elevated p-5">
                <DirectiveList patient={patient} />
              </div>
            </div>
          )}

          {activeTab === 'notes' && patient && (
            <div className="space-y-4">
              <div className="card-elevated p-5">
                <PhoneNotes patient={patient} />
              </div>
              {/* Encounter documentation lives on the Activity feed — this tab
                  is for persistent care-team notes only, so the same encounters
                  are not listed twice under two names. */}
              <div className="card-elevated p-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-sm">Looking for encounter notes?</h3>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Consultations and their documentation are on the Activity feed.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canConsult && (
                    <button className="btn btn-secondary text-[12px]" onClick={() => router.push(`/consultation?patientId=${patient._id}`)}>
                      Start consultation
                    </button>
                  )}
                  <button className="btn btn-primary text-[12px]" onClick={() => setActiveTab('history')}>
                    Open Activity
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'demographics' && patient && (
            <PatientDemographicsView
              patient={patient}
              activeTab={demographicsTab}
              onTabChange={setDemographicsTab}
              onEdit={openEditModal}
              appointments={patientAppointments}
              regHospitalName={regHospital?.name || patient.registrationHospital || ''}
            />
          )}

          {activeTab === 'careChecklist' && patient && (
            <div className="space-y-4">
              <ScreeningsPanel patient={patient} />
              <RemindersPanel patient={patient} />
              <div className="card-elevated p-5">
                <AssessmentsPanel patient={patient} />
              </div>
            </div>
          )}

          {activeTab === 'documents' && patient && (
            <div className="space-y-4">
              <DocumentsPanel patient={patient} />
            </div>
          )}

          {activeTab === 'history' && patient && (
            <PatientTimeline
              medicalRecords={records}
              labResults={allLabResults || []}
              prescriptions={allPrescriptions || []}
              immunizations={allImmunizations || []}
              referrals={patientReferrals}
              ancVisits={patientANC}
              appointments={patientAppointments}
              triages={patientTriages}
            />
          )}

          {/* Labs Tab */}
          {activeTab === 'labs' && (
            <ResultsSection
              patientId={patient._id}
              canOrderLabs={canOrderLabs}
              onAdd={() => setShowOrderLabModal(true)}
              focusId={focusId}
            />
          )}

          {/* Prescriptions Tab */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              {patient.preferredPharmacy && (
                <div className="card-elevated px-5 py-3 flex items-center gap-3">
                  <div className="icon-box-sm flex-shrink-0">
                    <Building2 className="w-3.5 h-3.5" style={{ color: '#2191D0' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Preferred Pharmacy</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {patient.preferredPharmacy.name}
                      {patient.preferredPharmacy.address && <span className="font-normal" style={{ color: 'var(--text-muted)' }}> · {patient.preferredPharmacy.address}</span>}
                      {patient.preferredPharmacy.phone && <span className="font-normal" style={{ color: 'var(--text-muted)' }}> · {patient.preferredPharmacy.phone}</span>}
                    </p>
                  </div>
                </div>
              )}
              <MedicationsSection
                patientId={patient._id}
                canPrescribe={canPrescribe}
                onAdd={() => setShowPrescribeModal(true)}
              />
            </div>
          )}

          {/* Vitals Tab */}
          {activeTab === 'vitals' && (
            <ChartSection
              title={vitalsView === 'flowsheet' ? 'Vital sign flowsheet' : 'Vitals'}
              onAdd={(canRecordVitalEvents && vitalsView === 'table') ? () => setShowNurseVitals(true) : undefined}
              addLabel="Record vitals"
              toggleSlot={(
                <div className="ehr-chart-subtabs" role="tablist" aria-label="Vitals view">
                  <button
                    type="button"
                    className={vitalsView === 'table' ? 'is-active' : ''}
                    onClick={() => setVitalsView('table')}
                    role="tab"
                    aria-selected={vitalsView === 'table'}
                  >
                    Vitals
                  </button>
                  <button
                    type="button"
                    className={vitalsView === 'flowsheet' ? 'is-active' : ''}
                    onClick={() => setVitalsView('flowsheet')}
                    role="tab"
                    aria-selected={vitalsView === 'flowsheet'}
                  >
                    Flowsheet
                  </button>
                </div>
              )}
            >
              {vitalsView === 'flowsheet' ? (
                <div className="p-5">
                  <VitalsTrends records={records} />
                </div>
              ) : (
                <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                <table className="omrs-table" style={{ minWidth: 1080 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Temp (°C)</th>
                      <th>BP (mmHg)</th>
                      <th>Pulse</th>
                      <th>Resp Rate</th>
                      <th>SpO₂</th>
                      <th>Weight (kg)</th>
                      <th>BMI</th>
                      <th>Facility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.every(rec => !rec.vitalSigns) && (
                      <tr>
                        <td colSpan={9} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                          No vitals recorded yet for this patient.
                        </td>
                      </tr>
                    )}
                    {records.filter(rec => rec.vitalSigns).map(rec => {
                      const v = rec.vitalSigns;
                      return (
                        <tr key={rec._id}>
                          <td className="font-mono text-xs">{formatDate(rec.visitDate)}</td>
                          <td style={{ color: v.temperature > 37.5 ? 'var(--color-danger)' : 'inherit', fontWeight: v.temperature > 37.5 ? 600 : 400 }}>{v.temperature}</td>
                          <td style={{ color: v.systolic > 140 ? 'var(--color-danger)' : 'inherit', fontWeight: v.systolic > 140 ? 600 : 400 }}>{v.systolic}/{v.diastolic}</td>
                          <td style={{ color: v.pulse > 100 ? 'var(--color-danger)' : 'inherit' }}>{v.pulse}</td>
                          <td>{v.respiratoryRate}</td>
                          <td style={{ color: v.oxygenSaturation < 95 ? 'var(--color-danger)' : 'inherit' }}>{v.oxygenSaturation}%</td>
                          <td>{v.weight}</td>
                          <td>{v.bmi}</td>
                          <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{(rec.hospitalName || '').replace(' Hospital', '').replace(' Teaching', '')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </ChartSection>
          )}

          {/* Immunizations Tab */}
          {activeTab === 'immunizations' && (() => {
            const immRecords = (allImmunizations || [])
              .filter(i => i.patientId === patient._id)
              .sort((a, b) => new Date(b.dateGiven || b.nextDueDate).getTime() - new Date(a.dateGiven || a.nextDueDate).getTime());
            const statusStyle: Record<string, { bg: string; color: string }> = {
              completed: { bg: 'rgba(31,157,111,0.14)', color: 'var(--color-success)' },
              scheduled: { bg: 'var(--accent-light)', color: 'var(--accent-primary)' },
              overdue: { bg: 'rgba(229,46,66,0.14)', color: 'var(--color-danger)' },
              missed: { bg: 'rgba(252,211,77,0.16)', color: 'var(--color-warning)' },
            };
            return (
              <ChartSection title="Immunizations" addLabel="Add" onAdd={() => router.push('/immunizations')}>
                {immRecords.length === 0 ? (
                  <OmrsEmptyState itemLabel="immunizations" actionLabel="Record immunizations" onAction={() => router.push('/immunizations')} />
                ) : (
                  <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <table className="omrs-table" style={{ minWidth: 840 }}>
                    <thead>
                      <tr>
                        {['Vaccine', 'Dose', 'Date given', 'Next due', 'Site', 'Batch', 'Status'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {immRecords.map(im => {
                        const s = statusStyle[im.status] || statusStyle.scheduled;
                        return (
                          <tr key={im._id}>
                            <td style={{ fontWeight: 600 }}>{im.vaccine}</td>
                            <td>{im.doseNumber ? `Dose ${im.doseNumber}` : '—'}</td>
                            <td>{im.dateGiven ? formatDate(im.dateGiven) : '—'}</td>
                            <td>{im.nextDueDate ? formatDate(im.nextDueDate) : '—'}</td>
                            <td style={{ textTransform: 'capitalize' }}>{im.site || '—'}</td>
                            <td className="font-mono">{im.batchNumber || '—'}</td>
                            <td>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{humanizeStatus(im.status)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </ChartSection>
            );
          })()}

          {/* Care coordination: internal transfers and external referrals share
              one ownership and follow-up destination. */}
          {activeTab === 'referrals' && (
            <div className="space-y-3">
              <TransferHistoryPanel patient={patient} canViewClinical={canViewClinical} />
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                  <div className="icon-box-sm">
                    <ArrowRightLeft className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Referrals</span>
                </div>
                <button onClick={() => router.push(`/referrals?patient=${encodeURIComponent(patientFullName(patient))}`)} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--tamamhealth-blue)' }}>
                  All referrals <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {patientReferrals.length === 0 ? (
                <div className="card-elevated p-8 text-center">
                  <ArrowRightLeft className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('referral.none')}</p>
                </div>
              ) : (
                <div className="space-y-3" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                {patientReferrals.map(ref => {
                  const tp = ref.transferPackage as { medicalRecords?: unknown[]; labResults?: unknown[]; attachments?: unknown[]; packageSizeBytes?: number } | undefined;
                  const refAtts = ref.referralAttachments as unknown[] | undefined;
                  return (
                    <div key={ref._id} className="card-elevated px-5 py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`badge urgency-${ref.urgency} text-[10px]`}>
                            {ref.urgency === 'emergency' && <AlertTriangle className="w-3 h-3" />}
                            {ref.urgency.charAt(0).toUpperCase() + ref.urgency.slice(1)}
                          </span>
                          <span className={`badge ${ref.status === 'sent' ? 'ref-sent' : ref.status === 'received' ? 'ref-received' : ref.status === 'seen' ? 'ref-seen' : ref.status === 'completed' ? 'ref-completed' : 'ref-cancelled'} text-[10px]`}>
                            {ref.status === 'sent' ? 'Sent' : ref.status === 'received' ? 'Received' : ref.status === 'seen' ? 'Being Seen' : ref.status === 'completed' ? 'Completed' : 'Cancelled'}
                          </span>
                          {tp && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)', border: '1px solid var(--accent-border)' }}>
                              <Package className="w-3 h-3" /> Data Package
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {ref.referralDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <span style={{ color: 'var(--text-secondary)' }}>{ref.fromHospital}</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span className="font-medium">{ref.toHospital}</span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--overlay-subtle)' }}>{ref.department}</span>
                      </div>
                      {canViewClinical ? (
                        <>
                          <p className="text-sm mb-1"><span className="font-medium">Reason:</span> {ref.reason}</p>
                          {ref.notes && (
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Notes: {ref.notes}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Clinical reason restricted</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>Dr. {ref.referringDoctor}</span>
                        {refAtts && refAtts.length > 0 && (
                          <span>{refAtts.length} attachment(s)</span>
                        )}
                        {tp && tp.medicalRecords && (
                          <span>{(tp.medicalRecords as unknown[]).length} record(s) in package</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-5">
              {/* Clinician-facing superbill / fee ticket — review + post charges (P2.3). */}
              <div className="card-elevated p-5">
                <SuperbillPanel
                  patient={patient}
                  encounterId={(records[0] as { encounterId?: string } | undefined)?.encounterId}
                  hospitalName={hospitals.find(h => h._id === patient.registrationHospital)?.name}
                />
              </div>
              <BillingTab
                patient={patient}
                patientBalance={patientBalance}
                showPaymentPanel={showPaymentPanel}
                showPlanWizard={showPlanWizard}
                setShowPaymentPanel={setShowPaymentPanel}
                setShowPlanWizard={setShowPlanWizard}
                reloadPayments={reloadPayments}
              />
            </div>
          )}

          {/* Orders — unified drug + lab orders table (Stage 3). */}
          {activeTab === 'orders' && (
            <OrdersSection
              patientId={patient._id}
              canPrescribe={canPrescribe}
              canOrderLabs={canOrderLabs}
              onAddDrug={() => setShowPrescribeModal(true)}
              onAddLab={() => setShowOrderLabModal(true)}
            />
          )}

          {/* Procedures — bedside/theatre procedures (ProcedureDoc), recorded
              and listed directly on the chart. */}
          {activeTab === 'procedures' && (
            <ProceduresSection patientId={patient._id} patientName={patientFullName(patient)} canConsult={canConsult} />
          )}

          {/* Programs — care-program enrollments (ART/TB/PMTCT/ANC/Nutrition/
              EPI/NCD) with enroll + status-transition flows. */}
          {activeTab === 'programs' && (
            <ProgramsSection patientId={patient._id} patientName={patientFullName(patient)} canConsult={canConsult} />
          )}
          </section>
          </OpenmrsChartShell>
      </main>

      {/* Edit Demographics Modal */}
      {showNurseVitals && patient && currentUser && (
        <NurseVitalsModal
          patientId={patient._id}
          patientName={patientFullName(patient)}
          hospitalNumber={patient.hospitalNumber}
          hospitalId={currentUser.hospitalId || patient.registrationHospital || ''}
          hospitalName={currentUser.hospital?.name || currentUser.hospitalName || patient.registrationHospital || undefined}
          orgId={currentUser.orgId}
          currentUser={currentUser}
          onClose={() => setShowNurseVitals(false)}
        />
      )}

      {showMessageModal && patient && (
        <Modal onClose={() => !messageSending && setShowMessageModal(false)} width={500} labelledBy="patient-message-title">
          <div className="modal-content card-elevated p-5 w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 id="patient-message-title" className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Message patient
                </h3>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {patientFullName(patient)}{patient.phone ? ` · ${formatPhoneDisplay(patient.phone)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMessageModal(false)}
                className="p-1.5 rounded-lg"
                disabled={messageSending}
                style={{ background: 'var(--overlay-subtle)' }}
                aria-label="Close patient message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['app', 'sms', 'both'] as const).map(channel => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => { setMessageChannel(channel); setMessageError(''); setMessageSent(false); }}
                      className="btn btn-sm"
                      style={{
                        background: messageChannel === channel ? 'var(--tamamhealth-blue)' : 'var(--bg-secondary)',
                        color: messageChannel === channel ? '#fff' : 'var(--text-primary)',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      {channel === 'app' ? 'App' : channel === 'sms' ? 'SMS' : 'App + SMS'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
                <input
                  value={messageSubject}
                  onChange={e => { setMessageSubject(e.target.value); setMessageSent(false); }}
                  className="w-full p-2.5 rounded-md text-[13px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Message</label>
                <textarea
                  autoFocus
                  value={messageBody}
                  onChange={e => { setMessageBody(e.target.value); setMessageError(''); setMessageSent(false); }}
                  rows={4}
                  placeholder="Write a clear patient instruction or follow-up message."
                  className="w-full p-2.5 rounded-md text-[13px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
              </div>
              {messageError && <p className="text-[12px]" role="alert" style={{ color: 'var(--color-danger)' }}>{messageError}</p>}
              {messageSent && <p className="text-[12px] font-semibold" role="status" style={{ color: 'var(--color-success)' }}>Message saved and queued.</p>}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowMessageModal(false)} className="btn btn-sm btn-secondary" disabled={messageSending}>Close</button>
              <button type="button" onClick={sendPatientMessage} className="btn btn-sm btn-primary" disabled={messageSending || !messageBody.trim()}>
                <MessageSquare className="w-3.5 h-3.5" /> {messageSending ? 'Sending...' : 'Send message'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Demographics Modal */}
      {showEditModal && patient && (
        <Modal onClose={() => !editSubmitting && setShowEditModal(false)}>
          {/* No max-width here: Modal already sizes the dialog panel (600px) and
              paints it opaque, so a narrower child left ~90px of empty panel
              showing past the form's right edge. Matches the message modal above. */}
          <div className="modal-content card-elevated p-5 w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Edit Patient Demographics</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="edit-first-name" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>First Name</label>
                  <input id="edit-first-name" type="text" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="edit-middle-name" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Middle Name</label>
                  <input id="edit-middle-name" type="text" value={editForm.middleName} onChange={e => setEditForm({ ...editForm, middleName: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="edit-surname" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Surname</label>
                  <input id="edit-surname" type="text" value={editForm.surname} onChange={e => setEditForm({ ...editForm, surname: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* Capped at today — registration already does this, and a
                      future date of birth is never a correction. */}
                  <label htmlFor="edit-dob" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                  <input id="edit-dob" type="date" max={toIsoDate(new Date())} value={editForm.dateOfBirth} onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="edit-gender" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Gender</label>
                  <select id="edit-gender" value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value as 'Male' | 'Female' })}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="edit-phone" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Phone</label>
                <input id="edit-phone" type="tel" value={editForm.phone} onChange={e => { setEditForm({ ...editForm, phone: e.target.value }); if (editErrors.phone) setEditErrors({}); }} aria-invalid={!!editErrors.phone} style={editErrors.phone ? { borderColor: 'var(--color-danger)' } : {}} />
                {editErrors.phone && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{editErrors.phone}</p>}
              </div>
              {/* State/county are pick-lists, not free text: registration writes
                  from these same lists, and every geographic rollup (surveillance,
                  vital statistics, the ADM1 maps) joins on the exact name. A typo
                  typed here would quietly drop the patient out of their county.
                  A value already on the record that isn't in the list is kept as
                  an option so editing a phone number can't silently rewrite it. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-state" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>State</label>
                  <select
                    id="edit-state"
                    value={editForm.state}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value, county: '' })}
                  >
                    <option value="">Select state…</option>
                    {editForm.state && !SOUTH_SUDAN_STATES.includes(editForm.state) && (
                      <option value={editForm.state}>{editForm.state} (on record)</option>
                    )}
                    {SOUTH_SUDAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-county" className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>County</label>
                  <select
                    id="edit-county"
                    value={editForm.county}
                    onChange={e => setEditForm({ ...editForm, county: e.target.value })}
                    disabled={!editForm.state}
                  >
                    <option value="">{editForm.state ? 'Select county…' : 'Select a state first'}</option>
                    {editForm.county && !editCounties.includes(editForm.county) && (
                      <option value={editForm.county}>{editForm.county} (on record)</option>
                    )}
                    {editCounties.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setShowEditModal(false)} className="btn btn-sm btn-secondary" disabled={editSubmitting}>Cancel</button>
              <button onClick={handleEditSubmit} className="btn btn-sm btn-primary" disabled={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Header action modals — open in place, pre-filled with this patient. */}
      <OrderLabModal
        isOpen={showOrderLabModal}
        onClose={() => setShowOrderLabModal(false)}
        patient={patient}
        currentUser={currentUser}
      />
      <PrescribeModal
        isOpen={showPrescribeModal}
        onClose={() => setShowPrescribeModal(false)}
        patient={patient}
        currentUser={currentUser}
      />
      <ReferModal
        isOpen={showReferModal}
        onClose={() => setShowReferModal(false)}
        patient={patient}
        currentUser={currentUser}
      />
      {assignTarget && (
        <AssignDoctorModal
          target={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </>
  );
}

/**
 * Facesheet card header — icon + title on the left, the card's primary write
 * action on the right. The action button stops propagation so it never also
 * fires the card's "open this tab" click handler.
 */
function FacesheetPanelHead({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Pill;
  title: string;
  action?: FacesheetActions[FacesheetPanelId];
}) {
  const ActionIcon = action?.icon || Plus;
  return (
    <div className="tebra-panel__head">
      <h2><Icon className="tebra-panel-icon" aria-hidden /> {title}</h2>
      {action && (
        <button
          type="button"
          className="tebra-panel-action"
          onClick={event => { event.stopPropagation(); action.onClick(); }}
          aria-label={`${action.label} — ${title}`}
        >
          <ActionIcon aria-hidden /> {action.label}
        </button>
      )}
    </div>
  );
}

function PatientFacesheetView({
  patient,
  latestVitals,
  problems,
  prescriptions,
  labResults,
  immunizations,
  canViewClinical,
  onOpenTab,
  actions,
  visiblePanelIds,
  customizeOpen,
  onToggleCustomize,
  onTogglePanel,
  onResetPanels,
}: {
  patient: PatientDoc;
  latestVitals?: MedicalRecordDoc['vitalSigns'];
  problems: ProblemDoc[];
  prescriptions: PrescriptionDoc[];
  labResults: LabResultDoc[];
  immunizations: ImmunizationDoc[];
  canViewClinical: boolean;
  onOpenTab: (tab: string) => void;
  /** Per-panel primary actions. A missing entry hides that panel's action
   *  button (the role lacks the permission); the card itself stays clickable. */
  actions: FacesheetActions;
  visiblePanelIds: Set<FacesheetPanelId>;
  customizeOpen: boolean;
  onToggleCustomize: () => void;
  onTogglePanel: (panelId: FacesheetPanelId) => void;
  onResetPanels: () => void;
}) {
  const activeProblems = problems.filter(problem => problem.status === 'active' || problem.status === 'chronic');
  const activeAllergies = patient.structuredAllergies !== undefined
    ? patient.structuredAllergies.filter(a => a.status === 'active').map(a => ({ name: a.substance, detail: a.reaction || a.criticality }))
    : (patient.allergies || [])
        .filter(a => a && a.toLowerCase() !== 'none known' && a.toLowerCase() !== 'none')
        .map(a => ({ name: a, detail: undefined as string | undefined }));
  // "Current" = anything not stopped. A dispensed medicine is the one the
  // patient is actually taking — excluding it (the old filter) made the panel
  // read "(None documented)" for fully-dispensed patients.
  const currentMeds = prescriptions.filter(rx => rx.status !== 'discontinued').slice(0, 4);
  const recentLabs = [...labResults]
    .sort((a, b) => (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || ''))
    .slice(0, 4);
  const careActions = buildCareActions(patient, immunizations);
  const showPanel = (panelId: FacesheetPanelId) => visiblePanelIds.has(panelId);

  if (!canViewClinical) {
    return (
      <div className="tebra-facesheet">
        <section className="tebra-panel tebra-panel--wide">
          <div className="tebra-panel__head">
            <h2>Facesheet</h2>
          </div>
          <div className="tebra-empty">
            Clinical information is restricted for your role. Use Demographics, Account, Documents, and Recall for administrative work.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="tebra-facesheet">
      <div className="tebra-section-title">
        <h1>Patient summary</h1>
        <button type="button" onClick={onToggleCustomize}>
          {customizeOpen ? 'Done' : 'Customize View'}
        </button>
      </div>

      {customizeOpen && (
        <div className="tebra-customize-panel" role="group" aria-label="Customize facesheet panels">
          <div className="tebra-customize-panel__head">
            <strong>Show on Facesheet</strong>
            <button type="button" onClick={onResetPanels}>Reset</button>
          </div>
          <div className="tebra-customize-panel__grid">
            {FACESHEET_PANEL_OPTIONS.map(panel => (
              <label key={panel.id}>
                <input
                  type="checkbox"
                  checked={visiblePanelIds.has(panel.id)}
                  onChange={() => onTogglePanel(panel.id)}
                  disabled={visiblePanelIds.has(panel.id) && visiblePanelIds.size === 1}
                />
                <span>{panel.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {showPanel('medications') && (
      <section className="tebra-panel" onClick={() => onOpenTab('prescriptions')}>
        <FacesheetPanelHead icon={Pill} title="Medications" action={actions.medications} />
        {currentMeds.length ? (
          <div className="tebra-list">
            {currentMeds.map(rx => (
              <div key={rx._id} className="tebra-list-row">
                <strong>{rx.medication}</strong>
                <span>{formatRxSig(rx)}</span>
              </div>
            ))}
          </div>
        ) : <p className="tebra-none">(None documented)</p>}
      </section>
      )}

      {showPanel('problems') && (
      <section className="tebra-panel" onClick={() => onOpenTab('problems')}>
        <FacesheetPanelHead icon={ShieldAlert} title="Safety alerts" action={actions.problems} />
        {activeProblems.length || activeAllergies.length ? (
          <div className="tebra-list">
            {activeProblems.slice(0, 4).map(problem => (
              <div key={problem._id} className="tebra-list-row">
                <strong>{problem.name}</strong>
                <span className="tebra-list-row-meta">
                  {problem.icd10Code && <span>{problem.icd10Code}</span>}
                  <Badge tone={problem.status === 'chronic' ? 'warning' : 'success'}>{problem.status}</Badge>
                </span>
              </div>
            ))}
            {activeAllergies.slice(0, 4).map((allergy, index) => (
              <div key={`${allergy.name}-${index}`} className="tebra-list-row">
                <strong>Allergy: {allergy.name}</strong>
                <span>{allergy.detail || 'Active'}</span>
              </div>
            ))}
          </div>
        ) : <p className="tebra-none">No active problems or allergies documented.</p>}
      </section>
      )}

      {showPanel('vitals') && (() => {
        const bpElevated = !!(latestVitals?.systolic && latestVitals.systolic >= 140) || !!(latestVitals?.diastolic && latestVitals.diastolic >= 90);
        const tempElevated = !!(latestVitals?.temperature && latestVitals.temperature >= 38);
        const spo2Low = !!(latestVitals?.oxygenSaturation && latestVitals.oxygenSaturation < 94);
        return (
      <section className="tebra-panel tebra-panel--highlight" onClick={() => onOpenTab('vitals')}>
        <FacesheetPanelHead icon={Activity} title="Latest observations" action={actions.vitals} />
        {latestVitals ? (
          <div className="tebra-vitals">
            <span className={bpElevated ? 'is-out-of-range' : ''}>BP <strong>{latestVitals.systolic && latestVitals.diastolic ? `${latestVitals.systolic}/${latestVitals.diastolic}` : '-'}</strong></span>
            <span>Pulse <strong>{latestVitals.pulse ?? '-'}</strong></span>
            <span className={tempElevated ? 'is-out-of-range' : ''}>Temp <strong>{latestVitals.temperature ?? '-'}</strong></span>
            <span className={spo2Low ? 'is-out-of-range' : ''}>SpO2 <strong>{latestVitals.oxygenSaturation ?? '-'}</strong></span>
          </div>
        ) : <p className="tebra-none">(None documented)</p>}
        {recentLabs.length > 0 && (
          <div className="tebra-list mt-2">
            <div className="tebra-list-row"><strong>Recent results</strong><span>{recentLabs.length} recorded</span></div>
            {recentLabs.slice(0, 2).map(lab => (
              <div key={lab._id} className="tebra-list-row">
                <strong>{lab.testName}</strong>
                <span>{[lab.result, lab.unit].filter(Boolean).join(' ') || lab.status || 'Pending'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
        );
      })()}

      {showPanel('recommendations') && (
      <section className="tebra-panel tebra-recommendations" onClick={() => onOpenTab('careChecklist')}>
        <FacesheetPanelHead icon={ClipboardList} title="Next care actions" action={actions.recommendations} />
        {careActions.length ? (
          <div className="tebra-reco-list">
            {careActions.map(item => (
              <div key={item.key} className="tebra-reco-row">
                <span className={item.overdue ? 'tebra-reco-grade is-rec' : 'tebra-reco-grade is-info'}>
                  {item.overdue ? '!' : '•'}
                </span>
                <div>
                  <small>{item.category}{item.detail ? ` · ${item.detail}` : ''}{item.overdue ? ' · overdue' : ''}</small>
                  <strong>{item.title}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="tebra-none">No outstanding care actions — manage screenings on the Care plan tab.</p>}
      </section>
      )}

    </div>
  );
}

function PatientDemographicsView({
  patient,
  activeTab,
  onTabChange,
  onEdit,
  appointments,
  regHospitalName,
}: {
  patient: PatientDoc;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onEdit: () => void;
  appointments: AppointmentDoc[];
  regHospitalName: string;
}) {
  const tabs = [
    ['profile', 'Profile'],
    ['additional', 'Additional Info'],
    ['contacts', 'Contacts'],
    ['upcoming', 'Upcoming Appointments'],
    ['past', 'Past Appointments'],
    ['portal', 'Patient Portal'],
  ];
  const upcoming = appointments
    .filter(appt => new Date(`${appt.appointmentDate}T${appt.appointmentTime || '00:00'}:00`).getTime() >= Date.now())
    .sort((a, b) => `${a.appointmentDate}${a.appointmentTime}`.localeCompare(`${b.appointmentDate}${b.appointmentTime}`));
  const past = appointments
    .filter(appt => new Date(`${appt.appointmentDate}T${appt.appointmentTime || '00:00'}:00`).getTime() < Date.now())
    .sort((a, b) => `${b.appointmentDate}${b.appointmentTime}`.localeCompare(`${a.appointmentDate}${a.appointmentTime}`));

  return (
    <div className="tebra-demographics">
      <div className="tebra-demo-title">
        <h1>Demographics</h1>
      </div>
      <div className="tebra-demo-tabs" role="tablist" aria-label="Demographics sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? 'active' : ''}
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <section className="tebra-demo-panel">
          <button type="button" className="tebra-demo-edit" onClick={onEdit}>Edit</button>
          <div className="tebra-demo-person">
            <div className="tebra-demo-avatar">{patientInitials(patient)}</div>
            <h2>{patientFullName(patient)}</h2>
            <span>Active</span>
          </div>
          <div className="tebra-demo-columns">
            <DemoField label="Legal Name" value={patientFullName(patient)} />
            <DemoField label="Pronoun" value="-" />
            <DemoField label="MRN" value={patient.hospitalNumber || '-'} />
            <DemoField label="Preferred Name" value={patient.firstName || '-'} />
            <DemoField label="Sex" value={patient.gender || '-'} />
            <DemoField label="Tamam Patient ID" value={patient.geocodeId || patient.hospitalNumber || '-'} />
            <DemoField label="Date of Birth" value={patient.dateOfBirth ? `${formatDate(patient.dateOfBirth)} (${patientAgeLabel(patient)})` : '-'} />
            <DemoField label="Gender Identity" value={patient.gender || '-'} />
            <DemoField label="National ID" value={patient.nationalId || '-'} />
            <DemoField label="Previous Full Name" value={patient.maidenName || '-'} />
            <DemoField label="Sexual Orientation" value="Choose not to disclose" />
            <DemoField label="Facility" value={regHospitalName || '-'} />
            <DemoField label="Marital Status" value="Unknown" />
            <DemoField label="Blood Type" value={patient.bloodType || '-'} />
            <DemoField label="Primary Language" value={patient.primaryLanguage || '-'} />
          </div>

          <div className="tebra-demo-section">
            <h3>Contact Information:</h3>
            <div className="tebra-demo-columns">
              <DemoField label="Home Address" value={[patient.address, patient.boma, patient.payam, patient.county, patient.state].filter(Boolean).join(', ') || '-'} wide />
              <DemoField label="Mobile Phone" value={patient.phone ? `${formatPhoneDisplay(patient.phone)} Primary` : '-'} />
              <DemoField label="Personal Email" value="-" />
              <DemoField label="Mailing Address" value={patient.address || '-'} wide />
              <DemoField label="Home Phone" value="-" />
              <DemoField label="Work Email" value="-" />
              <DemoField label="Previous Address" value="-" wide />
              <DemoField label="Other Phone" value={patient.altPhone ? formatPhoneDisplay(patient.altPhone) : '-'} />
              <DemoField label="Preferred Communication" value="Unknown" />
              <DemoField label="Driver's License" value="-" />
              <DemoField label="Send Reminders by" value={patient.whatsapp ? 'Phone(Text Message), WhatsApp' : 'Phone(Text Message)'} wide />
            </div>
          </div>
        </section>
      )}

      {activeTab === 'additional' && (
        <section className="tebra-demo-panel">
          <div className="tebra-demo-columns">
            <DemoField label="State" value={patient.state || '-'} />
            <DemoField label="County" value={patient.county || '-'} />
            <DemoField label="Payam" value={patient.payam || '-'} />
            <DemoField label="Boma" value={patient.boma || '-'} />
            <DemoField label="Tribe" value={patient.tribe || '-'} />
            <DemoField label="Registered" value={(patient.registrationDate || patient.registeredAt) ? formatDate(patient.registrationDate || patient.registeredAt) : '-'} />
          </div>
        </section>
      )}

      {activeTab === 'contacts' && (
        <section className="tebra-demo-panel">
          <div className="tebra-demo-columns">
            <DemoField label="Primary Contact" value={patient.nokName || '-'} />
            <DemoField label="Relationship" value={patient.nokRelationship || '-'} />
            <DemoField label="Phone" value={patient.nokPhone ? formatPhoneDisplay(patient.nokPhone) : '-'} />
            <DemoField label="Address" value={patient.nokAddress || '-'} wide />
          </div>
        </section>
      )}

      {(activeTab === 'upcoming' || activeTab === 'past') && (
        <section className="tebra-demo-panel">
          <table className="tebra-demo-table">
            <thead><tr><th>Date</th><th>Time</th><th>Care team</th><th>Context</th><th>Status</th></tr></thead>
            <tbody>
              {(activeTab === 'upcoming' ? upcoming : past).length ? (activeTab === 'upcoming' ? upcoming : past).map(appt => (
                <tr key={appt._id}>
                  <td>{formatDate(appt.appointmentDate)}</td>
                  <td>{formatClockTime(appt.appointmentTime) || '-'}</td>
                  <td>
                    <div className="appointment-card-provider">
                      <strong>{appt.providerName || patient.assignedDoctorName || 'Doctor unassigned'}</strong>
                      <span>{patient.assignedByName || 'Nurse unassigned'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="appointment-card-provider">
                      <strong>{appt.reason || appt.department || '-'}</strong>
                      <span>{appt.department || 'Appointment'}</span>
                    </div>
                  </td>
                  <td>{appt.status}</td>
                </tr>
              )) : (
                <tr><td colSpan={5}>No appointments documented.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'portal' && (
        <section className="tebra-demo-panel">
          <div className="tebra-demo-columns">
            <DemoField label="Portal Status" value="Not invited" />
            <DemoField label="Patient Intake" value="Not sent" />
            <DemoField label="Reminder Channel" value={patient.whatsapp ? 'SMS / WhatsApp' : 'SMS'} />
          </div>
        </section>
      )}
    </div>
  );
}

function DemoField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'tebra-demo-field tebra-demo-field--wide' : 'tebra-demo-field'}>
      <dt>{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * "Next care actions" for the facesheet — the patient's REAL outstanding work,
 * from the same `patient.screenings` model the Care plan tab manages (so the
 * two surfaces can never contradict each other) plus overdue/due vaccine doses.
 * Replaces a hardcoded USPSTF measure list that told every patient to get a
 * colorectal screening regardless of their data.
 */
function buildCareActions(patient: PatientDoc, immunizations: ImmunizationDoc[]) {
  const items: Array<{ key: string; overdue: boolean; category: string; title: string; detail?: string }> = [];
  for (const s of patient.screenings ?? []) {
    if (s.status !== 'due') continue;
    items.push({
      key: `scr-${s.id}`,
      overdue: isScreeningOverdue(s),
      category: 'Screening',
      title: s.type,
      detail: s.dueDate ? `Due ${formatDate(s.dueDate)}` : undefined,
    });
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  for (const imm of immunizations) {
    if (imm.status === 'completed' || !imm.nextDueDate) continue;
    items.push({
      key: `imm-${imm._id}`,
      overdue: imm.status === 'overdue' || imm.nextDueDate < todayIso,
      category: 'Immunization',
      title: `${imm.vaccine}${imm.doseNumber > 0 ? ` · dose ${imm.doseNumber}` : ''}`,
      detail: `Due ${formatDate(imm.nextDueDate)}`,
    });
  }
  // Overdue first, then soonest due.
  return items.sort((a, b) => Number(b.overdue) - Number(a.overdue)).slice(0, 6);
}
