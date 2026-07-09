'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Modal from '@/components/Modal';
import { useParams, useRouter } from 'next/navigation';
// Clean single-stroke Tailwind Labs Heroicons via the local compatibility shim.
import {
  ArrowLeft, ArrowRightLeft,
  AlertTriangle, FileText, FlaskConical,
  Pill, Activity, Brain, ChevronDown, ChevronUp,
  ShieldAlert, TestTubes, ChevronRight,
  CalendarClock, TrendingUp as TrendingUpIcon, ClipboardList,
  User as UserIcon, Building2, Search, X, Wallet, Syringe,
  Heart, Printer, History, Plus, Calendar,
} from '@/components/icons/lucide';
import Badge from '@/components/Badge';
import { usePatients } from '@/lib/hooks/usePatients';
import { useMedicalRecords } from '@/lib/hooks/useMedicalRecords';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePatientReferrals } from '@/lib/hooks/useReferrals';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useANC } from '@/lib/hooks/useANC';
import { Package, Clock, MessageSquare } from '@/components/icons/lucide';
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
import { formatDateTime, formatDate } from '@/lib/format-utils';
import { patientFullName, patientInitials, patientAgeLabel, avatarColor } from '@/lib/patient-utils';
import { usePatientAppointments } from '@/lib/hooks/useAppointments';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { useTriage } from '@/lib/hooks/useTriage';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePatientPayments } from '@/lib/hooks/usePayments';
import BillingTab from '@/components/patients/BillingTab';
import PatientSBAR from '@/components/patients/PatientSBAR';
import ProblemList from '@/components/patients/ProblemList';
import RecordSignatureBar from '@/components/patients/RecordSignatureBar';
import AllergyList from '@/components/patients/AllergyList';
import DirectiveList from '@/components/patients/DirectiveList';
import ChartSummaryPanel from '@/components/patients/ChartSummaryPanel';
import CareAlertsBanner from '@/components/patients/CareAlertsBanner';
import PhoneNotes from '@/components/patients/PhoneNotes';
import AssessmentsPanel from '@/components/patients/AssessmentsPanel';
import ScreeningsPanel from '@/components/patients/ScreeningsPanel';
import RemindersPanel from '@/components/patients/RemindersPanel';
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
import { useApp } from '@/lib/context';
import { OrderLabModal, PrescribeModal, ReferModal } from '@/components/patients/PatientActionModals';

// Administrative tabs are the only ones a non-clinical role (e.g. Medical
// Receptionist) may see — the "minimum necessary" rule: contact details,
// referral follow-up, and billing/scheduling, but NOT clinical notes, test
// results, diagnoses, vitals, or medications.
const ADMIN_TAB_IDS = ['overview', 'appointments', 'demographics', 'billing', 'documents', 'recall'];
type FacesheetPanelId = 'medications' | 'problems' | 'vitals' | 'history' | 'labs' | 'recommendations';

const FACESHEET_PANEL_OPTIONS: Array<{ id: FacesheetPanelId; label: string }> = [
  { id: 'medications', label: 'Medications' },
  { id: 'problems', label: 'Problems' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'history', label: 'History' },
  { id: 'labs', label: 'Labs/Studies' },
  { id: 'recommendations', label: 'Clinical Recommendations' },
];

const DEFAULT_FACESHEET_PANELS = FACESHEET_PANEL_OPTIONS.map(panel => panel.id);

export default function PatientDetailPage() {
  const routeParams = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(routeParams?.id) ? routeParams.id[0] : routeParams?.id;
  const router = useRouter();
  const contentRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState('overview');
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
  const [expandedAI, setExpandedAI] = useState<Set<string>>(new Set());
  const [encSearch, setEncSearch] = useState('');
  const [encFilter, setEncFilter] = useState('all');
  const [encSort, setEncSort] = useState<'newest' | 'oldest' | 'provider' | 'complaint'>('newest');
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
  const [showTriagePopup, setShowTriagePopup] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSignature, setPrintSignature] = useState('');
  const [printSigned, setPrintSigned] = useState(false);
  // Trigger print AFTER React commits the DOM update so printSigned content is present
  useEffect(() => {
    if (printSigned) { window.print(); }
  }, [printSigned]);

  // Full History filters & expansion
  const [historySearch, setHistorySearch] = useState('');
  const [expandedEncounters, setExpandedEncounters] = useState<Set<string>>(new Set());
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
  const { currentUser } = useApp();
  const { patients, loading, update: updatePatient } = usePatients();
  const { hospitals } = useHospitals();

  const patient = patients.find(p => p._id === id);
  const { records } = useMedicalRecords(patient?._id);
  const { referrals: patientReferrals } = usePatientReferrals(patient?._id);
  const { results: allLabResults } = useLabResults();
  const { immunizations: allImmunizations } = useImmunizations();
  const { visits: allANCVisits } = useANC();
  const { appointments: patientAppointments } = usePatientAppointments(patient?._id);
  const { prescriptions: allPrescriptions } = usePrescriptions();
  const { triages: patientTriages } = useTriage(patient?._id);
  const { canConsult, canViewClinical, canOrderLabs, canPrescribe, canBookAppointments } = usePermissions();

  // Defence in depth: if a non-clinical viewer lands on (or deep-links to) a
  // clinical tab, snap them back to the overview so clinical panels never render.
  useEffect(() => {
    if (!canViewClinical && !ADMIN_TAB_IDS.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [canViewClinical, activeTab]);
  const { balance: patientBalance, reload: reloadPayments } = usePatientPayments(patient?._id);
  const { problems: patientProblems } = useProblems(patient?._id);

  // Patient care notes (free-text staff notes) — surfaced on the overview only
  // when present, so the page never shows an empty "Notes" placeholder.
  const [patientNotes, setPatientNotes] = useState<PatientNoteDoc[]>([]);
  const patientIdForNotes = patient?._id;
  useEffect(() => {
    if (!patientIdForNotes) { setPatientNotes([]); return; }
    let cancelled = false;
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

  const openAllergiesFromHeader = () => {
    setActiveTab(canViewClinical ? 'allergies' : 'overview');
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

  // ── Filtered Full History ──────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return records.filter(r => {
      if (q) {
        const haystack = [
          JSON.stringify(r),
          formatDateTime(r.consultedAt || r.visitDate),
          r.chiefComplaint,
          r.historyOfPresentIllness,
          r.providerName,
          r.department,
          r.hospitalName,
          r.visitType,
          ...(r.diagnoses || []).map(d => `${d.icd10Code} ${d.name}`),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, historySearch]);

  if (loading || !patient) {
    return (
      <>
        <main className="page-container flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {loading ? t('status.loading') : t('patient.notFound')}
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

  // Last & next appointment (surfaced on the overview only when they exist).
  const apptTs = (a: { appointmentDate: string; appointmentTime?: string }) =>
    new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}:00`).getTime();
  const upcomingAppts = [...(patientAppointments || [])]
    .filter(a => a.status !== 'cancelled' && a.status !== 'no_show')
    .sort((x, y) => apptTs(x) - apptTs(y));
  const nextAppt = upcomingAppts.find(a => apptTs(a) >= Date.now());
  const lastAppt = [...upcomingAppts].reverse().find(a => apptTs(a) < Date.now());
  const latestNote = patientNotes[0];

  const allTabs = [
    { id: 'overview', label: 'Facesheet', icon: Heart },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'history', label: 'History', icon: FileText },
    { id: 'problems', label: 'Problems', icon: AlertTriangle },
    { id: 'prescriptions', label: 'Medications', icon: Pill },
    { id: 'immunizations', label: 'Immunizations', icon: Syringe },
    { id: 'allergies', label: 'Allergies', icon: ShieldAlert },
    { id: 'vitals', label: 'Vitals', icon: Activity },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'labs', label: 'Labs/Studies', icon: FlaskConical },
    { id: 'demographics', label: 'Demographics', icon: UserIcon },
    { id: 'billing', label: 'Account', icon: Wallet },
    { id: 'careChecklist', label: 'Care Checklist', icon: ClipboardList },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'recall', label: 'Recall', icon: CalendarClock },
  ];
  const tabs = canViewClinical ? allTabs : allTabs.filter(tb => ADMIN_TAB_IDS.includes(tb.id));

  // records[] is sorted newest-first by the service layer.
  const latestRecord = records[0];
  const latestVitals = latestRecord?.vitalSigns;

  const lastConsultedRaw = patient.lastConsultedAt || latestRecord?.consultedAt || latestRecord?.visitDate || patient.lastVisitDate;
  const lastConsultedDisplay = formatDateTime(lastConsultedRaw);

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
                      <img src="/assets/logos/SVG/Tamam_Style_Guide-33.svg" alt="TamamHealth" />
                    </div>
                    <div>
                      <div className="rx-facility-name">{patient.registrationHospital || 'Juba Teaching Hospital'}</div>
                      <div className="rx-facility-sub">TamamHealth Digital Health · Republic of South Sudan</div>
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
                    <div className="rx-patient-field"><label>Facility</label><span>{patient.registrationHospital || 'Juba Teaching Hospital'}</span></div>
                    <div className="rx-patient-field"><label>Visit Date</label><span>{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</span></div>
                    <div className="rx-patient-field"><label>Blood Group</label><span>{(patient as unknown as Record<string, string>).bloodGroup || '—'}</span></div>
                  </div>
                </div>

                {/* ── Document body ── */}
                <div className="rx-body">

                  {/* Consultation Note */}
                  {latestRecord && (
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
                        {latestRecord.treatmentPlan && <div className="rx-field" style={{ marginTop: 4 }}><b>Treatment plan:</b> {latestRecord.treatmentPlan}</div>}
                      </div>
                    </div>
                  )}

                  {/* Diagnoses + Active Problems side by side */}
                  <div className="rx-two-col">
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
                  </div>

                  {/* Vital Signs */}
                  {latestVitals && (
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
                  {currentMeds.length > 0 && (
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
                  {(activeAllergies.length > 0 || legacyAllergies.length > 0) && (
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
                  {patientLabs.length > 0 && (
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
                  {patientImms.length > 0 && (
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
                  {upcomingPrint && (
                    <div className="rx-section">
                      <div className="rx-section-title">Next Appointment</div>
                      <div className="rx-section-body rx-two-col">
                        <div className="rx-field"><b>Date &amp; Time:</b> {new Date(`${upcomingPrint.appointmentDate}T${upcomingPrint.appointmentTime || '00:00'}`).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</div>
                        {upcomingPrint.reason && <div className="rx-field"><b>Reason:</b> {upcomingPrint.reason}</div>}
                        {upcomingPrint.providerName && <div className="rx-field"><b>Provider:</b> {upcomingPrint.providerName}</div>}
                        <div className="rx-field"><b>Facility:</b> {patient.registrationHospital || 'Juba Teaching Hospital'}</div>
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
                  <span>TamamHealth Digital Health · {patient.hospitalNumber || patient.geocodeId} · {patient.registrationHospital || 'Juba Teaching Hospital'}</span>
                  <span>Printed: {printedAt}</span>
                </div>

              </div>
            );
          })()}

          {/* ══════ SIGN BEFORE PRINT MODAL ══════ */}
          {showPrintModal && (
            <Modal onClose={() => setShowPrintModal(false)} width={440} labelledBy="print-sign-title">
              <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <div className="flex items-center justify-between">
                  <h2 id="print-sign-title" className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Sign before printing</h2>
                  <button className="p-1 rounded" onClick={() => setShowPrintModal(false)} style={{ color: 'var(--text-muted)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Enter your full name and credentials to sign this patient record. Your signature will appear on the printed document.
                </p>
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
                      if (e.key === 'Enter' && printSignature.trim()) {
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
                    disabled={!printSignature.trim()}
                    onClick={() => {
                      setShowPrintModal(false);
                      setPrintSigned(true);
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" /> Sign &amp; Print
                  </button>
                </div>
              </div>
            </Modal>
          )}

          <button onClick={() => router.push('/patients')} className="ehr-chart-back flex items-center gap-1.5 text-sm mb-4 no-print" style={{ color: 'var(--tamamhealth-blue)' }}>
            <ArrowLeft className="w-4 h-4" /> {t('action.back')}
          </button>

          <div className="ehr-chart-shell">
          <div className="ehr-chart-layout">
          {/* Chart navigation — a left sidebar running alongside both the
              patient header and the tab content, not just the content. */}
          <div
            className="ehr-chart-nav flex mb-5 no-print overflow-x-auto"
            style={{ borderBottom: '1px solid var(--border-light)' }}
          >
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={isActive ? 'ehr-chart-nav-button is-active' : 'ehr-chart-nav-button'}
                  style={{
                    background: 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: `2px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                >
                  <tab.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="ehr-chart-main">
          {/* Patient Header — TamamHealth-style: avatar | name+pills+info-strip | action row */}
          {(() => {
            const initials = patientInitials(patient);
            const patientANC = (allANCVisits || []).filter(a => a.patientId === patient._id);
            const activeANC = patientANC.find(a => !a.linkedBirthId);
            const isPregnant = !!activeANC;

            const patientIdDisplay = patient.hospitalNumber || patient.geocodeId || '—';
            const patientDemographicDisplay = `${patientAgeLabel(patient)} · ${patient.gender || '—'}`;

            const photoUrl = (patient as { photoUrl?: string }).photoUrl;

            return (
              <div className="card-elevated ehr-patient-banner p-5 mb-5 relative overflow-hidden">
                <div className="flex items-stretch gap-5">
                  {/* ID-card style patient photo on the left — auto-height to match right column */}
                  <div
                    className="ehr-patient-photo flex-shrink-0 relative overflow-hidden self-stretch"
                    aria-hidden
                    style={{
                      width: 180, borderRadius: 14,
                      background: avatarColor(patientFullName(patient)),
                      boxShadow: 'none',
                    }}
                  >
                    {photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photoUrl}
                        alt={`${patient.firstName} ${patient.surname}`}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-white font-bold"
                        style={{ fontSize: 64, letterSpacing: 1, textShadow: '0 2px 8px rgba(0,0,0,0.20)' }}
                      >
                        {initials}
                      </div>
                    )}
                    {/* bottom gradient with patient ID for ID-card feel */}
                    <div
                      style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0,
                        padding: '12px 12px 10px',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                      }}
                    >
                      <div style={{ fontSize: 9.5, letterSpacing: 0.6, opacity: 0.85, textTransform: 'uppercase' }}>Patient ID</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-platform-mono)', marginTop: 2 }}>
                        {patient.hospitalNumber || patient.geocodeId || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="ehr-patient-summary flex-1 min-w-0">
                    {/* Name + status pills */}
                    <div className="ehr-patient-heading">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h1 className="ehr-patient-name">
                          {patientFullName(patient)}
                        </h1>
                      {/* Triage warning icon — only shown when there is an active / recent triage */}
                        {patientTriages.length > 0 && (() => {
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
                        })()}
                        {isPregnant && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-bold" style={{
                            background: 'rgba(217, 110, 89, 0.12)', color: 'var(--color-danger-500)', border: '1px solid rgba(217, 110, 89, 0.32)', letterSpacing: 0.2,
                          }}>
                            <DuotoneInfoIcon name="pregnant" size={11} color="var(--color-danger-500)" accent="var(--color-danger-500)" />
                            Pregnant{activeANC?.gestationalAge ? ` · ${activeANC.gestationalAge} wk` : ''}
                          </span>
                        )}
                      </div>
                      <div className="ehr-patient-meta-line">
                        <span>{patientIdDisplay}</span>
                        <span>{patientDemographicDisplay}</span>
                      </div>
                      <div className="ehr-patient-meta-line ehr-patient-meta-line--subtle">
                        <span>{lastConsultedDisplay}</span>
                      </div>
                    </div>

                    <div className="ehr-patient-strip">
                      <button type="button" onClick={openPaymentFromHeader} title="Collect payment for this patient">
                        <span>Collect Payment</span>
                        <strong style={{ color: patientBalance > 0 ? 'var(--color-danger)' : 'var(--ehr-muted)' }}>
                          ${patientBalance.toFixed(2)} due
                        </strong>
                      </button>
                    </div>

                    <div className="ehr-chart-actions no-print" aria-label="Patient chart actions">
                      <button type="button" onClick={() => setShowMessageModal(true)} title="Patient message">
                        <MessageSquare className="w-4 h-4" />
                        <span>Pt. Msg</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPrintSignature(currentUser?.name || ''); setPrintSigned(false); setShowPrintModal(true); }}
                        title="Print patient record"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print</span>
                      </button>
                      <button type="button" onClick={() => setActiveTab('documents')} title="Patient education and documents">
                        <FileText className="w-4 h-4" />
                        <span>Pt. Ed.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => canConsult ? router.push(`/consultation?patientId=${patient._id}`) : setActiveTab('notes')}
                        title="Create note"
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>+ Note</span>
                      </button>
                      <button type="button" onClick={() => canPrescribe ? setShowPrescribeModal(true) : setActiveTab('prescriptions')} title="Scripts">
                        <Pill className="w-4 h-4" />
                        <span>Scripts</span>
                      </button>
                      <button type="button" onClick={() => canOrderLabs ? setShowOrderLabModal(true) : setActiveTab('labs')} title="Orders">
                        <FlaskConical className="w-4 h-4" />
                        <span>Orders</span>
                      </button>
                      <button type="button" onClick={() => canViewClinical ? setShowReferModal(true) : setActiveTab('recall')} title="Exchange">
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>Exchange</span>
                      </button>
                      <button type="button" onClick={openEditModal} title="Edit profile">
                        <DuotoneInfoIcon name="edit" size={15} />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <section className="ehr-chart-content">

          {activeTab === 'overview' && (
            <PatientFacesheetView
              patient={patient}
              latestVitals={latestVitals}
              problems={patientProblems}
              prescriptions={(allPrescriptions || []).filter(rx => rx.patientId === patient._id)}
              labResults={(allLabResults || []).filter(lab => lab.patientId === patient._id)}
              immunizations={(allImmunizations || []).filter(imm => imm.patientId === patient._id)}
              records={records}
              canViewClinical={canViewClinical}
              onOpenTab={setActiveTab}
              visiblePanelIds={facesheetPanels}
              customizeOpen={showCustomizeView}
              onToggleCustomize={() => setShowCustomizeView(open => !open)}
              onTogglePanel={toggleFacesheetPanel}
              onResetPanels={() => setFacesheetPanels(new Set(DEFAULT_FACESHEET_PANELS))}
            />
          )}

          {activeTab === 'appointments' && patient && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Appointments</h2>
                  {nextAppt ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      Next: {formatDate(nextAppt.appointmentDate)} {nextAppt.appointmentTime || ''} · {nextAppt.providerName || 'Unassigned'}
                    </p>
                  ) : (
                    <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No upcoming appointments.</p>
                  )}
                </div>
                {canBookAppointments && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => router.push(`/appointments?new=1&patientId=${patient._id}`)}
                  >
                    <Plus className="w-3.5 h-3.5" /> New appointment
                  </button>
                )}
              </div>
              <div className="card-elevated overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Provider</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                          No appointments recorded for this patient.
                        </td>
                      </tr>
                    ) : [...patientAppointments].sort((a, b) => apptTs(b) - apptTs(a)).map(appt => (
                      <tr key={appt._id}>
                        <td className="font-mono text-xs">{formatDate(appt.appointmentDate)}</td>
                        <td>{appt.appointmentTime || '—'}</td>
                        <td>{appt.providerName || '—'}</td>
                        <td>{appt.reason || appt.department || 'Follow-up'}</td>
                        <td><span className="badge badge-normal text-[10px]">{appt.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overview Tab — full clinical overview (clinical roles only) */}
          {activeTab === '__legacy_overview' && canViewClinical && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                {/* Chart-permanent care alerts — patient-safety banner shown
                    on every visit (Centricity care alert). */}
                <CareAlertsBanner patient={patient} hideAddButton />
                {/* Unified chart summary — Problems, Medications, Allergies,
                    Directives, and Most Recent Record in one full-width card. */}
                <ChartSummaryPanel
                  patient={patient}
                  problems={patientProblems}
                  prescriptions={(allPrescriptions || []).filter(r => r.patientId === patient._id)}
                  onOpenProblems={() => setActiveTab('problems')}
                />

                {/* Latest Vitals */}
                <div className="card-elevated ehr-vitals-panel lg:col-span-2 lg:order-2">
                  <div className="ehr-vitals-header px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="icon-box-sm">
                        <Activity className="w-4 h-4" style={{ color: 'var(--color-danger-500)' }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm" style={{ letterSpacing: -0.1 }}>{t('vitals.title')}</h3>
                        {latestVitals && (
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)', marginTop: 1 }}>
                            Today · Updated automatically from latest consultation
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setActiveTab('vitals'); setVitalsView('flowsheet'); }}
                      className="text-xs font-semibold inline-flex items-center gap-1 px-2.5 py-1 rounded-md"
                      style={{ color: 'var(--tamamhealth-blue)', background: 'rgba(33, 145, 208, 0.08)' }}
                    >
                      <TrendingUpIcon className="w-3.5 h-3.5" /> View Trends
                    </button>
                  </div>
                  <div className="ehr-vitals-body">
                    {latestVitals ? (
                      <div className="ehr-vitals-grid">
                        {[
                          { label: t('vitals.pulse'), value: latestVitals.pulse, unit: 'bpm' },
                          { label: t('vitals.bloodPressure'), value: latestVitals.systolic && latestVitals.diastolic ? `${latestVitals.systolic}/${latestVitals.diastolic}` : null, unit: 'mmHg' },
                          { label: t('vitals.temperature'), value: latestVitals.temperature, unit: '°C' },
                          { label: t('vitals.spo2'), value: latestVitals.oxygenSaturation, unit: '%' },
                          { label: t('vitals.respRate'), value: latestVitals.respiratoryRate, unit: '/min' },
                          { label: t('vitals.bmi'), value: latestVitals.bmi, unit: 'kg/m²' },
                          { label: t('vitals.weight'), value: latestVitals.weight, unit: 'kg' },
                          { label: t('vitals.height'), value: latestVitals.height, unit: 'cm' },
                        ].map(item => (
                          <div className="ehr-vital-row" key={item.label}>
                            <span className="ehr-vital-label">{item.label}</span>
                            <strong>{item.value ?? '—'}</strong>
                            {item.value != null && <span className="ehr-vital-unit">{item.unit}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ehr-vitals-empty flex items-center justify-center text-center rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No vitals recorded yet for this patient.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Encounters — compact summary, click row or View full history for detail */}
                {records.length > 0 && (() => {
                  const q = encSearch.toLowerCase();
                  const filtered = records
                    .filter(rec => {
                      const matchSearch = !q || rec.chiefComplaint?.toLowerCase().includes(q) || rec.providerName?.toLowerCase().includes(q) || (rec.diagnoses || []).some(d => d.name.toLowerCase().includes(q) || d.icd10Code?.toLowerCase().includes(q));
                      const matchFilter = encFilter === 'all' || rec.visitType === encFilter || (encFilter === 'signed' && (rec as unknown as Record<string,string>).status === 'signed') || (encFilter === 'draft' && (rec as unknown as Record<string,string>).status !== 'signed');
                      return matchSearch && matchFilter;
                    })
                    .sort((a, b) => {
                      const da = a.consultedAt || a.visitDate || '';
                      const db = b.consultedAt || b.visitDate || '';
                      if (encSort === 'newest') return db.localeCompare(da);
                      if (encSort === 'oldest') return da.localeCompare(db);
                      if (encSort === 'provider') return (a.providerName || '').localeCompare(b.providerName || '');
                      return 0;
                    });
                  const preview = filtered.slice(0, 5);
                  return (
                  <div className="card-elevated lg:col-span-3 lg:order-5" style={{ overflow: 'hidden' }}>
                    {/* ── Header ── */}
                    <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Recent Encounters</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>{records.length}</span>
                      </div>
                      {/* Search + combined filter on one row */}
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                          <input
                            type="search"
                            value={encSearch}
                            onChange={e => setEncSearch(e.target.value)}
                            placeholder="Search…"
                            style={{ paddingLeft: 26, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 6, border: '1px solid var(--border-light)', background: 'transparent', fontSize: 12, width: 160, outline: 'none', color: 'var(--text-primary)' }}
                          />
                        </div>
                        <select
                          value={`${encFilter}|${encSort}`}
                          onChange={e => {
                            const [f, s] = e.target.value.split('|');
                            setEncFilter(f);
                            setEncSort(s as typeof encSort);
                          }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-light)', background: 'transparent', fontSize: 12, cursor: 'pointer', outline: 'none', color: 'var(--text-primary)' }}
                        >
                          <option value="all|newest">All · Newest first</option>
                          <option value="all|oldest">All · Oldest first</option>
                          <option value="outpatient|newest">Outpatient</option>
                          <option value="inpatient|newest">Inpatient</option>
                          <option value="emergency|newest">Emergency</option>
                          <option value="signed|newest">Signed only</option>
                          <option value="draft|newest">Unsigned only</option>
                        </select>
                      </div>
                    </div>

                    {/* ── Compact row list ── */}
                    {filtered.length === 0 ? (
                      <div className="px-5 py-8 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>No encounters match.</div>
                    ) : (
                      <>
                        {preview.map((rec, idx) => {
                          const primaryDx = (rec.diagnoses || [])[0];
                          return (
                            <div
                              key={rec._id}
                              className="flex items-center gap-3 cursor-pointer hover:bg-[var(--table-row-hover)] transition-colors"
                              style={{ padding: '10px 20px', borderBottom: idx < preview.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                              onClick={() => setActiveTab('history')}
                            >
                              {/* Date */}
                              <div className="flex-shrink-0 text-right" style={{ minWidth: 82 }}>
                                <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatDate(rec.consultedAt || rec.visitDate)}</div>
                              </div>
                              {/* Visit type badge */}
                              <span className={`badge text-[10px] flex-shrink-0 ${rec.visitType === 'emergency' ? 'badge-emergency' : rec.visitType === 'inpatient' ? 'badge-warning' : 'badge-normal'}`}>
                                {rec.visitType}
                              </span>
                              {/* Chief complaint */}
                              <span className="flex-1 min-w-0 text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{rec.chiefComplaint || '—'}</span>
                              {/* Primary diagnosis */}
                              <span className="flex-shrink-0 text-[11px] truncate" style={{ color: 'var(--text-muted)', width: 200 }}>
                                {primaryDx ? <>{primaryDx.icd10Code && <span className="font-mono">{primaryDx.icd10Code} · </span>}{primaryDx.name}</> : '—'}
                              </span>
                              {/* Provider */}
                              {rec.providerName && (
                                <span className="text-[11px] flex-shrink-0 truncate" style={{ color: 'var(--text-muted)', maxWidth: 140 }}>{rec.providerName}</span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--border-light)' }} />
                            </div>
                          );
                        })}
                        {/* View full history footer */}
                        <div className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: '1px solid var(--border-light)' }}>
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Showing {preview.length} of {filtered.length} encounter{filtered.length !== 1 ? 's' : ''}
                          </span>
                          <button
                            className="flex items-center gap-1 text-[12px] font-semibold"
                            style={{ color: 'var(--tamamhealth-blue)' }}
                            onClick={() => setActiveTab('history')}
                          >
                            View full history <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  );
                })()}

                {/* Outcome measures — scored intake assessments, held then signed (P2.2). */}
                <div className="card-elevated lg:col-span-3 lg:order-6 p-5">
                  <AssessmentsPanel patient={patient} />
                </div>

                {/* Phone notes — log patient calls and route to a provider (P1.4). */}
                <div className="card-elevated lg:col-span-3 lg:order-7 p-5">
                  <PhoneNotes patient={patient} />
                </div>

                {/* Preventive-care screening reminders (health maintenance). */}
                <div className="lg:col-span-3 lg:order-8">
                  <ScreeningsPanel patient={patient} />
                </div>

                {/* Queued patient reminders (e.g. follow-up "come fasted"). */}
                <div className="lg:col-span-3 lg:order-8">
                  <RemindersPanel patient={patient} />
                </div>

                {/* Scanned / uploaded chart documents (radiology, letters, IDs). */}
                <div className="lg:col-span-3 lg:order-9">
                  <DocumentsPanel patient={patient} />
                </div>

              {/* Sidebar info — only data that is NOT already its own tab.
                  Allergies (header flag) and chronic conditions (Problems tab)
                  live elsewhere; records with dedicated tabs (history, referrals,
                  labs, prescriptions, immunizations, billing) are on the tab bar.
                  Cards stretch to fill the column beside the main content. */}
              <div className="lg:col-span-1 lg:order-2 lg:self-stretch flex flex-col gap-5">
                <div className="card-elevated flex-1">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <UserIcon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                    <h3 className="font-semibold text-sm">{t('patient.demographics')}</h3>
                  </div>
                  <div className="p-5 data-row-divider-sm">
                    {/* Full demographics — every contact, identity, and registration
                        detail lives here now that the header only carries identity. */}
                    {[
                      { l: 'Name', v: patientFullName(patient) },
                      { l: 'Hospital No.', v: patient.hospitalNumber },
                      { l: 'Gender', v: patient.gender },
                      { l: t('patient.phone'), v: patient.phone ? formatPhoneDisplay(patient.phone) : null },
                      { l: t('patient.bloodType'), v: patient.bloodType },
                      { l: 'Date of Birth', v: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null },
                      { l: 'National ID', v: patient.nationalId },
                      { l: t('patient.location'), v: [patient.county, patient.state].filter(Boolean).join(', ') || null },
                      { l: t('patient.tribe'), v: patient.tribe },
                      { l: t('patient.language'), v: patient.primaryLanguage },
                      { l: t('patient.registered'), v: (patient.registrationDate || patient.registeredAt) ? formatDate(patient.registrationDate || patient.registeredAt) : null },
                      { l: t('patient.facility'), v: regHospital?.name || patient.registrationHospital || null },
                      { l: t('patient.nextOfKin'), v: patient.nokName ? `${patient.nokName}${patient.nokRelationship ? ` (${patient.nokRelationship})` : ''}` : null },
                      { l: t('patient.nokPhone'), v: patient.nokPhone ? formatPhoneDisplay(patient.nokPhone) : null },
                    ].filter(item => item.v).map(item => (
                      <div key={item.l} className="flex justify-between gap-3">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.l}</span>
                        <span className="text-xs font-medium text-right max-w-[60%] truncate">{item.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Appointments — shown only when the patient has one on record */}
                {(lastAppt || nextAppt) && (
                  <div className="card-elevated">
                    <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                      <div className="icon-box-sm">
                        <CalendarClock className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <h3 className="font-semibold text-sm">Appointments</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      {lastAppt && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Last visit</p>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDate(`${lastAppt.appointmentDate}T${lastAppt.appointmentTime || '00:00'}:00`)} · {lastAppt.appointmentTime}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{lastAppt.providerName} · {lastAppt.department || lastAppt.reason}</p>
                        </div>
                      )}
                      {nextAppt && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent-primary)' }}>Next visit</p>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDate(`${nextAppt.appointmentDate}T${nextAppt.appointmentTime || '00:00'}:00`)} · {nextAppt.appointmentTime}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{nextAppt.providerName} · {nextAppt.department || nextAppt.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Care Notes — shown only when a note exists */}
                {latestNote && (
                  <div className="card-elevated">
                    <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                      <div className="icon-box-sm">
                        <FileText className="w-3.5 h-3.5" style={{ color: 'var(--color-warning-400)' }} />
                      </div>
                      <h3 className="font-semibold text-sm">Care Notes</h3>
                    </div>
                    <div className="p-5">
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{latestNote.body}</p>
                      <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3 h-3" /> {latestNote.authorName} · {formatDate(latestNote.createdAt)}
                        {patientNotes.length > 1 && ` · +${patientNotes.length - 1} more`}
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Overview Tab — administrative-only summary (non-clinical roles, e.g. Medical Receptionist).
              Minimum-necessary: contact + registration + next of kin, with shortcuts to the
              admin tabs. No clinical notes, diagnoses, vitals, labs, or medications. */}
          {activeTab === '__legacy_overview_admin' && !canViewClinical && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="card-elevated">
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="icon-box-sm">
                    <UserIcon className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                  </div>
                  <h3 className="font-semibold text-sm">{t('patient.demographics')}</h3>
                </div>
                <div className="p-5 data-row-divider-sm">
                  {/* Header already shows Phone, Location, Next of Kin name and
                      Registered date — only the fields it omits are repeated here. */}
                  {[
                    { l: t('patient.language'), v: patient.primaryLanguage },
                    { l: t('patient.facility'), v: regHospital?.name || 'N/A' },
                    { l: t('patient.nokPhone'), v: patient.nokPhone },
                  ].map(item => (
                    <div key={item.l} className="flex justify-between gap-3">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.l}</span>
                      <span className="text-xs font-medium text-right max-w-[60%] truncate">{item.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-elevated p-5">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Clinical information (notes, test results, diagnoses, vitals, and medications) is restricted for your role. Use the tabs below for the administrative tasks you handle.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => setActiveTab('billing')} className="btn btn-secondary btn-sm"><Wallet className="w-4 h-4" /> {t('billing.sidebarTitle')}</button>
                  <button onClick={() => setActiveTab('referrals')} className="btn btn-secondary btn-sm"><ArrowRightLeft className="w-4 h-4" /> {t('tab.referrals')}</button>
                  <button onClick={() => router.push(`/appointments?patientId=${patient._id}`)} className="btn btn-secondary btn-sm"><ClipboardList className="w-4 h-4" /> {t('nav.appointments')}</button>
                </div>
              </div>
              {/* Intake / outcome measures — front desk enters these at check-in
                  and they are held for the provider to review and sign (P2.2). */}
              <div className="lg:col-span-2 card-elevated p-5">
                <AssessmentsPanel patient={patient} />
              </div>
            </div>
          )}

          {/* SBAR Handoff — auto-generated from chart for shift change */}
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
          {activeTab === 'problems' && patient && (
            <div className="space-y-4">
              <ProblemList
                patientId={patient._id}
                patientName={patientFullName(patient)}
              />
              <div className="card-elevated p-5">
                <AllergyList patient={patient} />
              </div>
              <div className="card-elevated p-5">
                <DirectiveList patient={patient} />
              </div>
            </div>
          )}

          {activeTab === 'allergies' && patient && (
            <div className="space-y-4">
              <div className="card-elevated p-5">
                <AllergyList patient={patient} />
              </div>
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
              <div className="card-elevated overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                  <div>
                    <h3 className="font-semibold text-sm">Clinical Notes</h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Encounter notes and signed chart records.</p>
                  </div>
                  {canConsult && (
                    <button onClick={() => router.push(`/consultation?patientId=${patient._id}`)} className="btn btn-primary btn-sm">
                      <ClipboardList className="w-4 h-4" /> Create Note
                    </button>
                  )}
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Chief Complaint</th>
                      <th>Provider</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                          No clinical notes recorded yet.
                        </td>
                      </tr>
                    ) : records.map(rec => (
                      <tr key={rec._id}>
                        <td className="font-mono text-xs">{formatDateTime(rec.consultedAt || rec.visitDate)}</td>
                        <td className="text-xs uppercase">{rec.visitType || 'SOAP'}</td>
                        <td className="font-medium text-sm">{rec.chiefComplaint || 'Clinical encounter'}</td>
                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{rec.providerName || '—'}</td>
                        <td><span className="badge badge-normal text-[10px]">Open</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

          {activeTab === '__legacy_demographics' && patient && (
            <div className="card-elevated overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <div>
                  <h3 className="font-semibold text-sm">{t('patient.demographics')}</h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Identity, contact, registration, and next-of-kin information.</p>
                </div>
                <button onClick={openEditModal} className="btn btn-secondary btn-sm">
                  <DuotoneInfoIcon name="edit" size={14} /> Edit
                </button>
              </div>
              <div className="ehr-demo-grid p-5">
                {[
                  { l: 'Legal Name', v: patientFullName(patient) },
                  { l: 'Hospital No.', v: patient.hospitalNumber },
                  { l: 'Geocode ID', v: patient.geocodeId },
                  { l: 'Date of Birth', v: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null },
                  { l: 'Sex', v: patient.gender },
                  { l: 'Blood Type', v: patient.bloodType },
                  { l: 'Primary Phone', v: patient.phone ? formatPhoneDisplay(patient.phone) : null },
                  { l: 'National ID', v: patient.nationalId },
                  { l: 'State', v: patient.state },
                  { l: 'County', v: patient.county },
                  { l: 'Tribe', v: patient.tribe },
                  { l: 'Language', v: patient.primaryLanguage },
                  { l: 'Registered', v: (patient.registrationDate || patient.registeredAt) ? formatDate(patient.registrationDate || patient.registeredAt) : null },
                  { l: 'Facility', v: regHospital?.name || patient.registrationHospital },
                  { l: 'Next of Kin', v: patient.nokName ? `${patient.nokName}${patient.nokRelationship ? ` (${patient.nokRelationship})` : ''}` : null },
                  { l: 'NOK Phone', v: patient.nokPhone ? formatPhoneDisplay(patient.nokPhone) : null },
                ].map(item => (
                  <div className="ehr-demo-row" key={item.l}>
                    <span>{item.l}</span>
                    <strong>{item.v || '—'}</strong>
                  </div>
                ))}
              </div>
            </div>
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
              <div className="card-elevated p-5">
                <AssessmentsPanel patient={patient} />
              </div>
            </div>
          )}

          {activeTab === 'recall' && patient && (
            <div className="space-y-4">
              <RemindersPanel patient={patient} />
              <div className="card-elevated overflow-hidden">
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <h3 className="font-semibold text-sm">Recall</h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Upcoming and prior appointments for follow-up planning.</p>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Provider</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                          No appointments recorded for this patient.
                        </td>
                      </tr>
                    ) : patientAppointments.map(appt => (
                      <tr key={appt._id}>
                        <td className="font-mono text-xs">{formatDate(appt.appointmentDate)}</td>
                        <td>{appt.appointmentTime || '—'}</td>
                        <td>{appt.providerName || '—'}</td>
                        <td>{appt.reason || appt.department || 'Follow-up'}</td>
                        <td><span className="badge badge-normal text-[10px]">{appt.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && patient && (
            <PatientTimeline
              medicalRecords={records}
              labResults={(allLabResults || []).filter(l => l.patientId === patient._id)}
              prescriptions={(allPrescriptions || []).filter(r => r.patientId === patient._id)}
              immunizations={(allImmunizations || []).filter(i => i.patientId === patient._id)}
              referrals={patientReferrals}
              appointments={patientAppointments}
              triages={patientTriages}
            />
          )}

          {/* Medical History Tab */}
          {activeTab === 'history' && (
            <div className="card-elevated">
              <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'transparent' }}
                  >
                    <FileText className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{t('encounters.history')}</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Showing {filteredHistory.length} of {records.length} encounter{records.length === 1 ? '' : 's'}, most recent first
                    </p>
                  </div>
                </div>
                {records.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}
                  >
                    <CalendarClock className="w-3 h-3" />
                    First visit: {formatDateTime(records[records.length - 1]?.consultedAt || records[records.length - 1]?.visitDate)}
                  </span>
                )}
              </div>

              {/* Filter bar */}
              {records.length > 0 && (
                <div
                  className="px-5 py-3 border-b"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
                >
                  <div
                    className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
                  >
                    <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search all encounters by complaint, diagnosis, ICD-10, provider, visit type, date, notes, or recorded details…"
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="flex-1 bg-transparent text-xs outline-none"
                      style={{ color: 'var(--text-primary)' }}
                    />
                    {historySearch && (
                      <button
                        onClick={() => setHistorySearch('')}
                        className="flex-shrink-0"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {records.length === 0 ? (
                <div className="px-6 py-7 text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No encounters recorded yet.</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="px-6 py-7 text-center">
                  <Search className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No encounters match the current search.</p>
                  <button
                    onClick={() => setHistorySearch('')}
                    className="text-xs font-semibold mt-2"
                    style={{ color: 'var(--tamamhealth-blue)' }}
                  >
                    Clear search
                  </button>
                </div>
              ) : (
              <div className="relative px-6 py-5" style={{ paddingLeft: 56, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                {/* Vertical spine */}
                <div
                  className="absolute top-5 bottom-5 w-0.5"
                  style={{
                    left: 32,
                    background: 'var(--accent-primary)',
                  }}
                />
                {filteredHistory.map((rec) => {
                  const ai = (rec as unknown as Record<string, unknown>).aiEvaluation as { suggestedDiagnoses: { icd10Code: string; name: string; confidence: number; reasoning: string; severity: string; suggestedTreatment?: string }[]; vitalSignAlerts: string[]; recommendedTests: string[]; severityAssessment: string; clinicalNotes: string; evaluatedAt: string } | undefined;
                  const isAIExpanded = expandedAI.has(rec._id + '-history');
                  const isExpanded = expandedEncounters.has(rec._id);
                  const isEmergency = rec.visitType === 'emergency';
                  const isInpatient = rec.visitType === 'inpatient';
                  const markerColor = isEmergency ? 'var(--tamamhealth-red)' : isInpatient ? 'var(--color-warning)' : 'var(--tamamhealth-blue)';
                  const labCount = (rec.labResults || []).length;
                  const rxCount = (rec.prescriptions || []).length;
                  const toggleExpand = () => setExpandedEncounters(prev => {
                    const next = new Set(prev);
                    if (next.has(rec._id)) next.delete(rec._id); else next.add(rec._id);
                    return next;
                  });
                  return (
                  <div key={rec._id} className="relative pb-5 last:pb-0">
                    {/* Timeline marker */}
                    <button
                      onClick={toggleExpand}
                      className="absolute flex items-center justify-center"
                      style={{
                        left: -30,
                        top: 14,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'var(--bg-card)',
                        border: `2px solid ${markerColor}`,
                        boxShadow: `0 0 0 4px var(--bg-card), 0 2px 8px ${markerColor}33`,
                        cursor: 'pointer',
                      }}
                      aria-label={isExpanded ? 'Collapse encounter' : 'Expand encounter'}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: markerColor,
                        }}
                      />
                    </button>

                    {/* Encounter card */}
                    <div
                      className="ehr-encounter-card rounded-xl transition-all hover:shadow-md"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-card)',
                        boxShadow: 'none',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header strip — clickable to expand */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={toggleExpand}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
                        className="ehr-encounter-card__head px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 cursor-pointer hover:bg-[var(--accent-light)] transition-colors"
                        style={{
                          background: 'var(--overlay-subtle)',
                          borderBottom: '1px solid var(--border-light)',
                        }}
                        title={isExpanded ? 'Collapse details' : 'Click to view full record details'}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                          >
                            <CalendarClock className="w-3 h-3" style={{ color: markerColor }} />
                            {formatDateTime(rec.consultedAt || rec.visitDate)}
                          </span>
                          <span className={`badge text-[10px] ${isEmergency ? 'badge-emergency' : isInpatient ? 'badge-warning' : 'badge-normal'}`}>
                            {rec.visitType}
                          </span>
                          {ai && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--color-purple-500)', border: '1px solid rgba(139,92,246,0.2)' }}>
                              <Brain className="w-3 h-3" /> AI
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {labCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)' }}>
                              <FlaskConical className="w-2.5 h-2.5" /> {labCount} lab{labCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {rxCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)' }}>
                              <Pill className="w-2.5 h-2.5" /> {rxCount} rx
                            </span>
                          )}
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="ehr-encounter-card__body p-4">
                        <p className="text-sm font-semibold leading-snug mb-1" style={{ color: 'var(--text-primary)' }}>
                          {rec.chiefComplaint}
                        </p>
                        <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {isExpanded
                            ? (rec.historyOfPresentIllness || '')
                            : `${(rec.historyOfPresentIllness || '').slice(0, 180)}${(rec.historyOfPresentIllness || '').length > 180 ? '…' : ''}`}
                        </p>
                        {(rec.diagnoses || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(rec.diagnoses || []).map((d, j) => (
                              <span
                                key={j}
                                className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  background: 'var(--bg-card)',
                                  color: 'var(--tamamhealth-blue)',
                                  border: '1px solid var(--accent-border)',
                                }}
                              >
                                <span className="font-mono text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--accent-light)' }}>
                                  {d.icd10Code}
                                </span>
                                {d.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          <span className="inline-flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{rec.providerName}</span>
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {rec.department}
                          </span>
                          {rec.hospitalName && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {rec.hospitalName}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Expanded details: vitals, treatment plan, prescriptions, labs */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px dashed var(--border-light)' }}>
                            {rec.vitalSigns && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                                  Vital signs at this visit
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {[
                                    { l: 'Temp', v: `${rec.vitalSigns.temperature}°C` },
                                    { l: 'BP', v: `${rec.vitalSigns.systolic}/${rec.vitalSigns.diastolic}` },
                                    { l: 'Pulse', v: `${rec.vitalSigns.pulse} bpm` },
                                    { l: 'SpO₂', v: `${rec.vitalSigns.oxygenSaturation}%` },
                                  ].map(v => (
                                    <div key={v.l} className="px-2 py-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                                      <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{v.l}</p>
                                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{v.v}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {rec.treatmentPlan && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                  <ClipboardList className="w-3 h-3" style={{ color: 'var(--tamamhealth-blue)' }} />
                                  Treatment plan
                                </p>
                                <p className="text-xs leading-relaxed p-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}>
                                  {rec.treatmentPlan}
                                </p>
                              </div>
                            )}
                            {(rec.prescriptions || []).length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                  <Pill className="w-3 h-3" style={{ color: '#2191D0' }} />
                                  Prescriptions ({rec.prescriptions!.length})
                                </p>
                                <ul className="space-y-1">
                                  {rec.prescriptions!.map((rx, k) => (
                                    <li key={k} className="text-xs p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                                      <span>
                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{rx.drugName}</span>{' '}
                                        <span style={{ color: 'var(--text-muted)' }}>· {rx.dose} · {rx.route} · {rx.frequency} · {rx.duration}</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(rec.labResults || []).length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                  <FlaskConical className="w-3 h-3" style={{ color: 'var(--color-purple-500)' }} />
                                  Lab results ({rec.labResults!.length})
                                </p>
                                <ul className="space-y-1">
                                  {rec.labResults!.map((lab, k) => (
                                    <li key={k} className="text-xs flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                                      <span className="font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{lab.testName}</span>
                                      <span className={lab.abnormal ? 'font-semibold' : ''} style={{ color: lab.abnormal ? (lab.critical ? 'var(--color-danger)' : 'var(--color-warning)') : 'var(--text-secondary)' }}>
                                        {lab.result} {lab.unit}
                                      </span>
                                      {lab.abnormal && (
                                        <span className={`badge text-[9px] ${lab.critical ? 'badge-emergency' : 'badge-warning'}`}>
                                          {lab.critical ? 'CRIT' : 'ABN'}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      {ai && (
                        <>
                          <button
                            onClick={() => setExpandedAI(prev => {
                              const next = new Set(prev);
                              const key = rec._id + '-history';
                              if (next.has(key)) next.delete(key); else next.add(key);
                              return next;
                            })}
                            className="flex items-center gap-1 text-xs mt-2 font-medium"
                            style={{ color: 'var(--color-purple-500)' }}
                          >
                            <Brain className="w-3 h-3" />
                            {isAIExpanded ? 'Hide' : 'View'} AI Evaluation
                            {isAIExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {isAIExpanded && (
                            <div className="mt-2 p-3 rounded-lg space-y-2" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="w-3.5 h-3.5" style={{ color: ai.severityAssessment.includes('HIGH') ? 'var(--tamamhealth-red)' : ai.severityAssessment.includes('MODERATE') ? 'var(--color-warning)' : 'var(--accent-primary)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{ai.severityAssessment}</span>
                              </div>
                              {ai.suggestedDiagnoses.slice(0, 3).map(dx => (
                                <div key={dx.icd10Code} className="flex items-center gap-2 text-xs">
                                  <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--color-purple-500)', fontSize: '10px' }}>{dx.icd10Code}</span>
                                  <span className="font-medium">{dx.name}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>({dx.confidence}%)</span>
                                </div>
                              ))}
                              {ai.recommendedTests.length > 0 && (
                                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--tamamhealth-blue)' }}>
                                  <TestTubes className="w-3 h-3" />
                                  Recommended: {ai.recommendedTests.join(', ')}
                                </div>
                              )}
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ai.clinicalNotes}</p>
                            </div>
                          )}
                        </>
                      )}
                      <div className="mt-3">
                        <RecordSignatureBar record={rec} />
                      </div>
                      </div>
                    </div>
                  </div>
                );})}
              </div>
              )}
            </div>
          )}

          {/* Labs Tab */}
          {activeTab === 'labs' && (
            <div className="card-elevated overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <div className="icon-box-sm">
                    <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--color-purple-500)' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.title')}</span>
                </div>
                <button onClick={() => router.push(`/lab?patient=${encodeURIComponent(patientFullName(patient))}`)} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--tamamhealth-blue)' }}>
                  View in Lab Module <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              <table className="data-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Test</th>
                    <th>Result</th>
                    <th>Unit</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.every(r => (r.labResults || []).length === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                        No lab results recorded yet for this patient.
                      </td>
                    </tr>
                  )}
                  {records.flatMap(r => (r.labResults || []).map(lab => ({ ...lab, visitDate: r.visitDate, hospital: r.hospitalName }))).map((lab, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{lab.date}</td>
                      <td className="font-medium text-sm">{lab.testName}</td>
                      <td className={lab.abnormal ? 'font-semibold' : ''} style={{ color: lab.abnormal ? (lab.critical ? 'var(--color-danger)' : 'var(--color-warning)') : 'inherit' }}>
                        {lab.result}
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{lab.unit}</td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{lab.referenceRange}</td>
                      <td>
                        {lab.abnormal ? (
                          <span className={`badge text-[10px] ${lab.critical ? 'badge-emergency' : 'badge-warning'}`}>
                            {lab.critical ? 'CRITICAL' : 'Abnormal'}
                          </span>
                        ) : (
                          <span className="badge badge-normal text-[10px]">Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Prescriptions Tab */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                  <div className="icon-box-sm">
                    <Pill className="w-3.5 h-3.5" style={{ color: '#2191D0' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Prescriptions</span>
                </div>
                <button onClick={() => router.push(`/pharmacy?patient=${encodeURIComponent(patientFullName(patient))}`)} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--tamamhealth-blue)' }}>
                  View in Pharmacy <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
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
              <div className="space-y-4" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
              {records.filter(rec => (rec.prescriptions || []).length > 0).length === 0 ? (
                <div className="card-elevated p-8 text-center">
                  <Pill className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No prescriptions recorded yet for this patient.</p>
                </div>
              ) : (
                records.filter(rec => (rec.prescriptions || []).length > 0).map(rec => (
                <div key={rec._id} className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                    <div>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{rec.visitDate}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{rec.hospitalName}</span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rec.providerName}</span>
                  </div>
                  <div className="divide-y data-row-divider-sm" style={{ borderColor: 'var(--table-row-border)' }}>
                    {(rec.prescriptions || []).map((rx, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{rx.drugName}</p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {rx.dose} · {rx.route} · {rx.frequency} · {rx.duration}
                          </p>
                        </div>
                        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{rx.instructions}</p>
                      </div>
                    ))}
                  </div>
                </div>
                ))
              )}
              </div>
            </div>
          )}

          {/* Vitals Tab */}
          {activeTab === 'vitals' && (
            <div className="card-elevated overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: 'var(--border-light)' }}>
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {vitalsView === 'flowsheet' ? (
                      <TrendingUpIcon className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
                    ) : (
                      <Activity className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
                    )}
                    {vitalsView === 'flowsheet' ? 'Vital Sign Flowsheet' : 'Vitals'}
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {vitalsView === 'flowsheet'
                      ? 'Chronological trends across all recorded visits.'
                      : 'Recorded vital signs from patient encounters.'}
                  </p>
                </div>
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
              </div>
              {vitalsView === 'flowsheet' ? (
                <div className="p-5">
                  <VitalsTrends records={records} />
                </div>
              ) : (
                <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                <table className="data-table" style={{ minWidth: 1080 }}>
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
                          <td className="font-mono text-xs">{rec.visitDate}</td>
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
            </div>
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
              <div className="card-elevated overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="icon-box-sm">
                      <Syringe className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Immunizations</h3>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{immRecords.length} record{immRecords.length === 1 ? '' : 's'} on file</p>
                    </div>
                  </div>
                  <button onClick={() => router.push('/immunizations')} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors" style={{ color: 'var(--accent-primary)', border: '1px solid var(--accent-border)' }}>
                    Immunization registry <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {immRecords.length === 0 ? (
                  <div className="p-8 text-center">
                    <Syringe className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No immunizations recorded for this patient.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                  <table className="w-full text-left" style={{ minWidth: 840 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        {['Vaccine', 'Dose', 'Date given', 'Next due', 'Site', 'Batch', 'Status'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', position: 'sticky', top: 0, background: 'var(--bg-card-solid)', zIndex: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {immRecords.map(im => {
                        const s = statusStyle[im.status] || statusStyle.scheduled;
                        return (
                          <tr key={im._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{im.vaccine}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{im.doseNumber ? `Dose ${im.doseNumber}` : '—'}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{im.dateGiven ? formatDate(im.dateGiven) : '—'}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{im.nextDueDate ? formatDate(im.nextDueDate) : '—'}</td>
                            <td className="px-4 py-3 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{im.site || '—'}</td>
                            <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{im.batchNumber || '—'}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{im.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Referrals Tab */}
          {activeTab === 'referrals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                  <div className="icon-box-sm">
                    <ArrowRightLeft className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('referral.title')}</span>
                </div>
                <button onClick={() => router.push(`/referrals?patient=${encodeURIComponent(patientFullName(patient))}`)} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--tamamhealth-blue)' }}>
                  View in Referrals <ChevronRight className="w-3.5 h-3.5" />
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
          </section>
          </div>

          {/* Right rail — demographics + allergies at a glance, mirroring the
              dashboard's three-panel layout. The allergies box that used to sit
              in the patient header lives here now. */}
          <aside className="ehr-chart-right-rail no-print" aria-label="Patient summary rail">
            <div className="ehr-chart-side-card">
              <div className="ehr-chart-side-card-head">
                <h3>Demographics</h3>
                <button type="button" onClick={() => setActiveTab('demographics')}>View all</button>
              </div>
              <dl className="ehr-chart-side-rows">
                <div><dt>Patient ID</dt><dd>{patient.hospitalNumber || patient.geocodeId || '—'}</dd></div>
                <div><dt>Age</dt><dd>{patientAgeLabel(patient)}</dd></div>
                <div><dt>Gender</dt><dd>{patient.gender || '—'}</dd></div>
                <div><dt>Date of birth</dt><dd>{patient.dateOfBirth || '—'}</dd></div>
                <div><dt>Phone</dt><dd>{patient.phone || '—'}</dd></div>
                <div><dt>Blood type</dt><dd>{patient.bloodType || '—'}</dd></div>
                <div><dt>Address</dt><dd>{patient.address || [patient.boma, patient.payam, patient.county].filter(Boolean).join(', ') || '—'}</dd></div>
                <div><dt>Language</dt><dd>{patient.primaryLanguage || '—'}</dd></div>
              </dl>
            </div>
            {(() => {
              const activeAllergies = patient.structuredAllergies !== undefined
                ? patient.structuredAllergies.filter(a => a.status === 'active')
                : (patient.allergies || []).filter(a => a && a.toLowerCase() !== 'none known' && a.toLowerCase() !== 'none');
              return (
                <div className={activeAllergies.length ? 'ehr-chart-side-card ehr-chart-side-card--alert' : 'ehr-chart-side-card'}>
                  <div className="ehr-chart-side-card-head">
                    <h3>
                      {activeAllergies.length > 0 && <AlertTriangle className="ehr-allergy-icon" aria-hidden />}
                      Allergies
                    </h3>
                    <button type="button" onClick={openAllergiesFromHeader}>View all</button>
                  </div>
                  {activeAllergies.length ? (
                    <ul className="ehr-chart-side-allergies">
                      {activeAllergies.map((a, i) => {
                        const name = typeof a === 'string' ? a : a.substance;
                        const detail = typeof a === 'string' ? undefined : (a.reaction || a.criticality);
                        return (
                          <li key={`${name}-${i}`}>
                            <strong>{name}</strong>
                            {detail && <span>{detail}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="ehr-chart-side-empty">No known allergies documented</p>
                  )}
                </div>
              );
            })()}
          </aside>
          </div>
          </div>
      </main>

      {/* Edit Demographics Modal */}
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
          <div className="modal-content card-elevated p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Edit Patient Demographics</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>First Name</label>
                  <input type="text" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Middle Name</label>
                  <input type="text" value={editForm.middleName} onChange={e => setEditForm({ ...editForm, middleName: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Surname</label>
                  <input type="text" value={editForm.surname} onChange={e => setEditForm({ ...editForm, surname: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                  <input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Gender</label>
                  <select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value as 'Male' | 'Female' })}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Phone</label>
                <input type="tel" value={editForm.phone} onChange={e => { setEditForm({ ...editForm, phone: e.target.value }); if (editErrors.phone) setEditErrors({}); }} aria-invalid={!!editErrors.phone} style={editErrors.phone ? { borderColor: 'var(--color-danger)' } : {}} />
                {editErrors.phone && <p className="text-[11px] mt-1" role="alert" style={{ color: 'var(--color-danger)' }}>{editErrors.phone}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>State</label>
                  <input type="text" value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>County</label>
                  <input type="text" value={editForm.county} onChange={e => setEditForm({ ...editForm, county: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1" disabled={editSubmitting}>Cancel</button>
              <button onClick={handleEditSubmit} className="btn btn-primary flex-1" disabled={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save Changes'}
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
    </>
  );
}

function PatientFacesheetView({
  patient,
  latestVitals,
  problems,
  prescriptions,
  labResults,
  immunizations,
  records,
  canViewClinical,
  onOpenTab,
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
  records: MedicalRecordDoc[];
  canViewClinical: boolean;
  onOpenTab: (tab: string) => void;
  visiblePanelIds: Set<FacesheetPanelId>;
  customizeOpen: boolean;
  onToggleCustomize: () => void;
  onTogglePanel: (panelId: FacesheetPanelId) => void;
  onResetPanels: () => void;
}) {
  const activeProblems = problems.filter(problem => problem.status === 'active' || problem.status === 'chronic');
  const currentMeds = prescriptions.filter(rx => rx.status !== 'dispensed').slice(0, 4);
  const recentLabs = [...labResults]
    .sort((a, b) => (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || ''))
    .slice(0, 4);
  const latestHistory = records[0];
  const recommendations = buildClinicalRecommendations(patient, immunizations, activeProblems);
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
        <h1>Facesheet</h1>
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
        <h2><Pill className="tebra-panel-icon" aria-hidden /> Medications</h2>
        {currentMeds.length ? (
          <div className="tebra-list">
            {currentMeds.map(rx => (
              <div key={rx._id} className="tebra-list-row">
                <strong>{rx.medication}</strong>
                <span>{[rx.dose, rx.frequency, rx.duration].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
          </div>
        ) : <p className="tebra-none">(None documented)</p>}
      </section>
      )}

      {showPanel('problems') && (
      <section className="tebra-panel" onClick={() => onOpenTab('problems')}>
        <h2><AlertTriangle className="tebra-panel-icon" aria-hidden /> Problems</h2>
        {activeProblems.length ? (
          <div className="tebra-list">
            {activeProblems.slice(0, 5).map(problem => (
              <div key={problem._id} className="tebra-list-row">
                <strong>{problem.name}</strong>
                <span className="tebra-list-row-meta">
                  {problem.icd10Code && <span>{problem.icd10Code}</span>}
                  <Badge tone={problem.status === 'chronic' ? 'warning' : 'success'}>{problem.status}</Badge>
                </span>
              </div>
            ))}
          </div>
        ) : <p className="tebra-none">(None documented)</p>}
      </section>
      )}

      {showPanel('vitals') && (() => {
        const bpElevated = !!(latestVitals?.systolic && latestVitals.systolic >= 140) || !!(latestVitals?.diastolic && latestVitals.diastolic >= 90);
        const tempElevated = !!(latestVitals?.temperature && latestVitals.temperature >= 38);
        const spo2Low = !!(latestVitals?.oxygenSaturation && latestVitals.oxygenSaturation < 94);
        return (
      <section className="tebra-panel tebra-panel--highlight" onClick={() => onOpenTab('vitals')}>
        <h2><Activity className="tebra-panel-icon" aria-hidden /> Vitals</h2>
        {latestVitals ? (
          <div className="tebra-vitals">
            <span className={bpElevated ? 'is-out-of-range' : ''}>BP <strong>{latestVitals.systolic && latestVitals.diastolic ? `${latestVitals.systolic}/${latestVitals.diastolic}` : '-'}</strong></span>
            <span>Pulse <strong>{latestVitals.pulse ?? '-'}</strong></span>
            <span className={tempElevated ? 'is-out-of-range' : ''}>Temp <strong>{latestVitals.temperature ?? '-'}</strong></span>
            <span className={spo2Low ? 'is-out-of-range' : ''}>SpO2 <strong>{latestVitals.oxygenSaturation ?? '-'}</strong></span>
          </div>
        ) : <p className="tebra-none">(None documented)</p>}
      </section>
        );
      })()}

      {showPanel('history') && (
      <section className="tebra-panel" onClick={() => onOpenTab('history')}>
        <h2><History className="tebra-panel-icon" aria-hidden /> History</h2>
        {latestHistory ? (
          <div className="tebra-list-row">
            <strong>{latestHistory.chiefComplaint || 'Recent encounter'}</strong>
            <span>{formatDateTime(latestHistory.consultedAt || latestHistory.visitDate)} · {latestHistory.providerName || 'Provider not listed'}</span>
          </div>
        ) : <p className="tebra-none">(None Documented)</p>}
      </section>
      )}

      {showPanel('labs') && (
      <section className="tebra-panel" onClick={() => onOpenTab('labs')}>
        <h2><FlaskConical className="tebra-panel-icon" aria-hidden /> Labs/Studies</h2>
        {recentLabs.length ? (
          <div className="tebra-list">
            {recentLabs.map(lab => {
              const resultText = /positive|reactive|abnormal/i.test(lab.result || '') ? 'danger'
                : /negative|non-reactive|normal/i.test(lab.result || '') ? 'success'
                : null;
              return (
                <div key={lab._id} className="tebra-list-row">
                  <strong>{lab.testName}</strong>
                  <span className="tebra-list-row-meta">
                    {lab.result && (
                      <span className={resultText ? `tebra-lab-result is-${resultText}` : 'tebra-lab-result'}>
                        {[lab.result, lab.unit].filter(Boolean).join(' ')}
                      </span>
                    )}
                    {lab.status && <span>{lab.status}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ) : <p className="tebra-none">(None documented)</p>}
      </section>
      )}

      {showPanel('recommendations') && (
      <section className="tebra-panel tebra-recommendations" onClick={() => onOpenTab('careChecklist')}>
        <h2><ClipboardList className="tebra-panel-icon" aria-hidden /> Clinical Recommendations</h2>
        <div className="tebra-reco-list">
          {recommendations.map(item => (
            <div key={item.title} className="tebra-reco-row">
              <span className={item.grade === 'A' ? 'tebra-reco-grade is-rec' : 'tebra-reco-grade is-info'}>{item.grade}</span>
              <div>
                <small>{item.category}</small>
                <strong>{item.title}</strong>
              </div>
            </div>
          ))}
        </div>
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
            <thead><tr><th>Date</th><th>Time</th><th>Provider</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {(activeTab === 'upcoming' ? upcoming : past).length ? (activeTab === 'upcoming' ? upcoming : past).map(appt => (
                <tr key={appt._id}>
                  <td>{formatDate(appt.appointmentDate)}</td>
                  <td>{appt.appointmentTime || '-'}</td>
                  <td>{appt.providerName || '-'}</td>
                  <td>{appt.reason || appt.department || '-'}</td>
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

function buildClinicalRecommendations(patient: PatientDoc, immunizations: ImmunizationDoc[], problems: ProblemDoc[]) {
  const hasInfluenza = immunizations.some(imm => /influenza|flu/i.test(imm.vaccine || ''));
  const hasHivScreen = problems.some(problem => /hiv/i.test(problem.name));
  const ageText = patientAgeLabel(patient);
  const adult = !ageText.includes('mo') && !ageText.includes('day') && !ageText.includes('week');
  return [
    { grade: 'i', category: 'Preventive Care and Screening:', title: 'Colorectal Cancer Screening' },
    { grade: 'i', category: 'Documentation of Current Medications in the Medical Record:', title: 'Maintain current medication list' },
    { grade: 'i', category: 'Preventive Care and Screening:', title: hasInfluenza ? 'Influenza immunization documented' : 'Influenza Immunizations' },
    { grade: 'A', category: 'Colorectal Cancer: Screening', title: 'Colorectal Cancer: Screening - Adults aged 50 to 75 years' },
    { grade: 'A', category: 'Human Immunodeficiency Virus (HIV) Infection: Screening', title: hasHivScreen || adult ? 'HIV Infection: Screening - Adolescents and adults aged 15 to 65 years' : 'HIV Infection: Screening' },
  ];
}
