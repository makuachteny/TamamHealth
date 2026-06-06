'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import SendMessageModal from '@/components/SendMessageModal';
import {
  ArrowLeft, Stethoscope, ArrowRightLeft,
  Heart, AlertTriangle, FileText, FlaskConical,
  Pill, Activity, Brain, ChevronDown, ChevronUp,
  ShieldAlert, TestTubes, MessageSquare, ChevronRight,
  CalendarClock, TrendingUp as TrendingUpIcon, ClipboardList,
  User as UserIcon, Building2, Search, X, Printer, Wallet,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useMedicalRecords } from '@/lib/hooks/useMedicalRecords';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePatientReferrals } from '@/lib/hooks/useReferrals';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useANC } from '@/lib/hooks/useANC';
import { Package, Clock, Building2 as Building2Icon } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';
import VitalsTrends from '@/components/VitalsTrends';
import PatientTimeline from '@/components/PatientTimeline';
import VitalCard from '@/components/VitalCard';
import { Icon as DuotoneInfoIcon } from '@/components/icons';
import { formatDateTime } from '@/lib/format-utils';
import { usePatientAppointments } from '@/lib/hooks/useAppointments';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { useTriage } from '@/lib/hooks/useTriage';
import { usePermissions } from '@/lib/hooks/usePermissions';
import PatientQRCode from '@/components/PatientQRCode';
import { usePatientPayments } from '@/lib/hooks/usePayments';
import BillingTab from '@/components/patients/BillingTab';
import BillingSidebarCard from '@/components/patients/BillingSidebarCard';
import PatientIndex from '@/components/patients/PatientIndex';
import PatientSBAR from '@/components/patients/PatientSBAR';
import ProblemList from '@/components/patients/ProblemList';
import { useProblems } from '@/lib/hooks/useProblems';

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedAI, setExpandedAI] = useState<Set<string>>(new Set());
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [showPlanWizard, setShowPlanWizard] = useState(false);

  // Full History filters & expansion
  const [historySearch, setHistorySearch] = useState('');
  const [historyRange, setHistoryRange] = useState<'all' | '30d' | '90d' | '1y'>('all');
  const [historyVisitType, setHistoryVisitType] = useState<'all' | 'outpatient' | 'inpatient' | 'emergency'>('all');
  const [expandedEncounters, setExpandedEncounters] = useState<Set<string>>(new Set());

  const { t } = useTranslation();
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
  const { canConsult } = usePermissions();
  const { balance: patientBalance, reload: reloadPayments } = usePatientPayments(patient?._id);
  const { problems: patientProblems, active: activeProblems } = useProblems(patient?._id);

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

  const openEditModal = () => {
    if (!patient) return;
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

  const handleEditSubmit = async () => {
    if (!patient) return;
    try {
      setEditSubmitting(true);
      await updatePatient(patient._id, {
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName.trim(),
        surname: editForm.surname.trim(),
        phone: editForm.phone.trim(),
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
    const now = Date.now();
    const cutoff = historyRange === '30d'
      ? now - 30 * 86400_000
      : historyRange === '90d'
      ? now - 90 * 86400_000
      : historyRange === '1y'
      ? now - 365 * 86400_000
      : 0;
    const q = historySearch.trim().toLowerCase();
    return records.filter(r => {
      // Time filter
      if (cutoff > 0) {
        const ts = new Date(r.consultedAt || r.visitDate).getTime();
        if (Number.isNaN(ts) || ts < cutoff) return false;
      }
      // Visit type filter
      if (historyVisitType !== 'all' && r.visitType !== historyVisitType) return false;
      // Search across complaint, history, diagnoses, provider, department
      if (q) {
        const haystack = [
          r.chiefComplaint,
          r.historyOfPresentIllness,
          r.providerName,
          r.department,
          r.hospitalName,
          ...(r.diagnoses || []).map(d => `${d.icd10Code} ${d.name}`),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, historyRange, historyVisitType, historySearch]);

  if (loading || !patient) {
    return (
      <>
        <TopBar title="Patient Record" />
        <main className="page-container flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {loading ? t('status.loading') : t('patient.notFound')}
          </p>
        </main>
      </>
    );
  }

  const age = patient.estimatedAge || (patient.dateOfBirth ? (new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()) : 0);
  const regHospital = hospitals.find(h => h._id === patient.registrationHospital);

  // Counts for the "Related Records" sidebar card
  const consultationsCount = records.length;
  const activeReferralsCount = (patientReferrals || []).filter(r => r.status !== 'completed' && r.status !== 'cancelled').length;
  const labOrdersCount = (allLabResults || []).filter(r => r.patientId === patient._id).length;
  const immunizationsCount = (allImmunizations || []).filter(i => i.patientId === patient._id).length;
  const prescriptionsCount = records.reduce((sum, r) => sum + (r.prescriptions?.length || 0), 0);

  const tabs = [
    { id: 'overview', label: t('tab.overview'), icon: Heart },
    { id: 'index', label: 'Index', icon: ClipboardList },
    { id: 'sbar', label: 'SBAR Handoff', icon: FileText },
    { id: 'problems', label: 'Problems', icon: AlertTriangle },
    { id: 'timeline', label: 'Timeline', icon: ClipboardList },
    { id: 'trends', label: 'Trends', icon: TrendingUpIcon },
    { id: 'history', label: 'Full History', icon: FileText },
    { id: 'vitals', label: t('tab.vitals'), icon: Activity },
    { id: 'labs', label: t('tab.labResults'), icon: FlaskConical },
    { id: 'prescriptions', label: t('tab.prescriptions'), icon: Pill },
    { id: 'referrals', label: t('tab.referrals'), icon: ArrowRightLeft },
    { id: 'billing', label: 'Billing', icon: Wallet },
  ];

  // records[] is sorted newest-first by the service layer.
  const latestRecord = records[0];
  const latestVitals = latestRecord?.vitalSigns;
  const latestDiagnosis = latestRecord?.diagnoses?.[0];

  // Prefer explicit timestamp fields, fall back to legacy date-only values.
  const registeredAtDisplay = formatDateTime(patient.registeredAt || patient.registrationDate);
  const lastConsultedRaw = patient.lastConsultedAt
    || latestRecord?.consultedAt
    || latestRecord?.visitDate
    || patient.lastVisitDate;
  const lastConsultedDisplay = formatDateTime(lastConsultedRaw);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* ───── Print: render the patient record as a clean hospital
           document. Strip out color gradients, decorative glyphs,
           interactive controls, animations, and anything that doesn't
           belong on an official record. ───── */
        .print-only { display: none; }
        @media print {
          /* Page setup */
          @page { margin: 14mm 12mm 16mm; size: A4; }
          html, body { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { font-family: Georgia, 'Times New Roman', Times, serif !important; letter-spacing: 0 !important; animation: none !important; transition: none !important; }

          /* Hide app chrome, interactive controls, and anything marked no-print */
          .no-print, .no-print *,
          nav, .sidebar, [data-sidebar], .topbar, [data-topbar],
          button:not(.print-visible), .mk-mobile-toggle,
          [role="tablist"],
          input, select, textarea, form,
          [type="search"], [role="search"], [role="searchbox"],
          [placeholder*="earch"], [aria-label*="earch"] { display: none !important; }

          /* Layout reset — print is one long column */
          .page-container, .page-enter { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          .grid { display: block !important; }
          .lg\\:col-span-2, .lg\\:col-span-1 { width: 100% !important; }

          /* Flatten cards — no shadow, no gradient, no color wash */
          .card-elevated, .card {
            box-shadow: none !important;
            border: 1px solid #333 !important;
            background: #fff !important;
            background-image: none !important;
            border-radius: 4px !important;
            page-break-inside: avoid;
            margin-bottom: 10px !important;
            padding: 10px 12px !important;
          }

          /* Remove every decorative gradient / colored overlay globally */
          [style*="linear-gradient"], [style*="radial-gradient"] {
            background-image: none !important;
            background: #fff !important;
          }
          [aria-hidden="true"][style*="gradient"] { display: none !important; }

          /* Patient photo — show it in grayscale (looks like an ID photocopy) */
          .patient-photo-card, [data-photo-card] {
            background: #fff !important;
            border: 1px solid #333 !important;
            box-shadow: none !important;
          }
          .patient-photo-card img, [data-photo-card] img { filter: grayscale(100%) contrast(1.05); }

          /* Simple, consistent black-on-white typography */
          h1 { font-size: 18pt !important; font-weight: 700 !important; color: #000 !important; }
          h2 { font-size: 13pt !important; font-weight: 700 !important; color: #000 !important; border-bottom: 1px solid #000; padding-bottom: 3pt; margin-bottom: 6pt !important; }
          h3, h4 { font-size: 11pt !important; font-weight: 700 !important; color: #000 !important; }
          p, span, div, li { color: #000 !important; }
          .badge, [class*="pill"], .rounded-full { border: 1px solid #000 !important; background: #fff !important; color: #000 !important; border-radius: 3px !important; }

          /* Hide every icon — pictorial glyphs would print washed out */
          svg:not(.print-logo) { display: none !important; }

          /* Neutralize colored status banners to a plain bordered block */
          [style*="rgba("] {
            background: #fff !important;
            border-color: #000 !important;
          }

          /* Show every tab panel regardless of active state so the
             printed record is complete */
          [role="tabpanel"], [hidden][data-print-always] { display: block !important; }

          a, button { color: inherit !important; text-decoration: none !important; }

          /* ───── Letterhead: centered logo + title ─────── */
          .print-only { display: block !important; }
          .print-letterhead {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10pt;
            margin-bottom: 14pt;
          }
          .print-letterhead .print-logo {
            display: inline-block !important;
            width: 56pt;
            height: 56pt;
            margin: 0 auto 6pt;
          }
          .print-letterhead .title {
            font-size: 18pt;
            font-weight: 700;
            letter-spacing: 2pt !important;
            margin-top: 2pt;
          }
          .print-letterhead .sub {
            font-size: 9pt;
            color: #444 !important;
            margin-top: 2pt;
          }
          .print-letterhead .doc-meta {
            margin-top: 8pt;
            font-size: 8.5pt;
            color: #444 !important;
            display: flex;
            justify-content: center;
            gap: 16pt;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
          }
          .print-letterhead .doc-meta .doc-meta-label {
            color: #888 !important;
            font-weight: 600;
            margin-right: 4pt;
          }

          /* Footer */
          .print-footer {
            position: fixed;
            bottom: 4mm;
            left: 0;
            right: 0;
            padding: 0 12mm;
            font-size: 8pt;
            color: #666 !important;
            border-top: 1px solid #999;
            display: flex;
            justify-content: space-between;
            padding-top: 4pt;
          }
        }
      ` }} />
      <TopBar title="Patient Record" />
      <main className="page-container page-enter">
          {/* Print-only hospital letterhead */}
          <header className="print-only print-letterhead">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div className="title">TAMAMHEALTH DIGITAL HEALTH</div>
                <div className="sub">{patient.registrationHospital || 'Juba Teaching Hospital'} · Republic of South Sudan</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '9pt' }}>
                <div style={{ fontWeight: 700 }}>PATIENT MEDICAL RECORD</div>
                <div style={{ color: '#444' }}>
                  Printed {new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                </div>
                <div style={{ color: '#444' }}>Record ID: {patient.hospitalNumber || patient.geocodeId}</div>
              </div>
            </div>
          </header>

          {/* Print-only footer with confidentiality notice */}
          <footer className="print-only print-footer">
            <span>Confidential — Patient Medical Record</span>
            <span>TamamHealth Digital Health · {patient.hospitalNumber || patient.geocodeId}</span>
          </footer>

          <button onClick={() => router.push('/patients')} className="flex items-center gap-1.5 text-sm mb-4 no-print" style={{ color: 'var(--tamamhealth-blue)' }}>
            <ArrowLeft className="w-4 h-4" /> {t('action.back')}
          </button>

          {/* Patient Header — TamamHealth-style: avatar | name+pills+info-strip | action row */}
          {(() => {
            const initials = `${(patient.firstName || '?')[0]}${(patient.surname || '?')[0]}`.toUpperCase();
            const isFemale = patient.gender === 'Female';
            const hasAllergy = patient.allergies?.length > 0 && patient.allergies[0] !== 'None known';
            // Pregnancy is signaled via active ANC visits — pull the most recent
            // gestational age if available. An ANC visit is considered "active"
            // until a birth registration is linked back to it (linkedBirthId).
            const patientANC = (allANCVisits || []).filter(a => a.patientId === patient._id);
            const activeANC = patientANC.find(a => !a.linkedBirthId);
            const isPregnant = !!activeANC;

            const infoBits: { icon: 'qr' | 'patient' | 'phone' | 'mapPin' | 'clock'; label: string; value: string; accent: string; mono?: boolean }[] = [
              { icon: 'qr', label: 'Geocode', value: patient.geocodeId || patient.hospitalNumber, accent: '#1E3A8A', mono: true },
              { icon: 'patient', label: 'Age / Sex', value: `${age} y · ${patient.gender}`, accent: 'var(--accent-primary)' },
              ...(patient.phone ? [{ icon: 'phone' as const, label: 'Phone', value: patient.phone, accent: '#3b82f6', mono: true }] : []),
              ...(patient.state ? [{ icon: 'mapPin' as const, label: 'Location', value: patient.state, accent: '#C44536' }] : []),
              { icon: 'clock', label: 'Last Visit', value: lastConsultedDisplay, accent: '#E4A84B' },
            ];

            const photoUrl = (patient as { photoUrl?: string }).photoUrl;

            return (
              <div className="card-elevated p-5 mb-5 relative overflow-hidden">
                <div className="flex items-stretch gap-5">
                  {/* ID-card style patient photo on the left — auto-height to match right column */}
                  <div
                    className="flex-shrink-0 relative overflow-hidden self-stretch"
                    aria-hidden
                    style={{
                      width: 180, borderRadius: 14,
                      background: isFemale
                        ? 'linear-gradient(135deg, #D96E59 0%, #9A2F27 100%)'
                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      boxShadow: '0 4px 14px rgba(26, 58, 58, 0.10), inset 0 0 0 1px rgba(255,255,255,0.08)',
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
                        background: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))',
                        color: '#fff',
                      }}
                    >
                      <div style={{ fontSize: 9.5, letterSpacing: 0.6, opacity: 0.85, textTransform: 'uppercase' }}>Patient ID</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginTop: 2 }}>
                        {patient.hospitalNumber || patient.geocodeId || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="flex-1 min-w-0">
                    {/* Name + status pills */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: -0.4 }}>
                        {`${patient.firstName} ${patient.middleName || ''} ${patient.surname}`.replace(/\s+/g, ' ').trim()}
                      </h1>
                      {isPregnant && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-bold" style={{
                          background: 'rgba(217, 110, 89, 0.12)', color: '#C44536', border: '1px solid rgba(217, 110, 89, 0.32)', letterSpacing: 0.2,
                        }}>
                          <DuotoneInfoIcon name="pregnant" size={11} color="#C44536" accent="#C44536" />
                          Pregnant{activeANC?.gestationalAge ? ` · ${activeANC.gestationalAge} wk` : ''}
                        </span>
                      )}
                      {hasAllergy && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-bold" style={{
                          background: 'rgba(196, 69, 54, 0.12)', color: '#C44536', border: '1px solid rgba(196, 69, 54, 0.32)', letterSpacing: 0.2,
                        }}>
                          <AlertTriangle className="w-3 h-3" />
                          {patient.allergies.length === 1 ? patient.allergies[0] : `${patient.allergies[0]} +${patient.allergies.length - 1}`} allergy
                        </span>
                      )}
                    </div>

                    {/* Inline info strip — single row, all 5 items spread evenly */}
                    <div
                      className="grid mb-5"
                      style={{
                        gridTemplateColumns: `repeat(${infoBits.length}, minmax(0, 1fr))`,
                        gap: 16,
                        rowGap: 12,
                      }}
                    >
                      {infoBits.map(bit => (
                        <div key={bit.label} className="flex items-center gap-2.5 min-w-0">
                          <DuotoneInfoIcon name={bit.icon} size={22} color={bit.accent} accent={bit.accent} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                              {bit.label}
                            </div>
                            <div
                              style={{
                                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                                fontFamily: bit.mono ? 'JetBrains Mono, ui-monospace, monospace' : 'inherit',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3,
                              }}
                            >
                              {bit.value}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action row — primary + secondaries spread evenly, then meta-action icons on the far right */}
                    <div className="flex items-center justify-between gap-3 flex-wrap no-print">
                      <div className="flex items-center gap-2 flex-wrap flex-1">
                        {canConsult && (
                          <button onClick={() => router.push(`/consultation?patientId=${patient._id}`)} className="btn btn-primary">
                            <Stethoscope className="w-4 h-4" /> Start Consultation
                          </button>
                        )}
                        <button onClick={() => setActiveTab('labs')} className="btn btn-secondary">
                          <FlaskConical className="w-4 h-4" style={{ color: '#E4A84B' }} /> Order Lab
                        </button>
                        <button onClick={() => setActiveTab('prescriptions')} className="btn btn-secondary">
                          <Pill className="w-4 h-4" /> Prescribe
                        </button>
                        <button onClick={() => router.push('/referrals')} className="btn btn-secondary">
                          <ArrowRightLeft className="w-4 h-4" /> Refer
                        </button>
                        <button onClick={() => setShowMessageModal(true)} className="btn btn-secondary">
                          <MessageSquare className="w-4 h-4" style={{ color: '#1E3A8A' }} /> Message
                        </button>
                      </div>

                      {/* Meta actions — Edit | Print (which also covers "save as PDF" in browser print dialog) */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={openEditModal}
                          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                          title="Edit demographics"
                          style={{ background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                        >
                          <DuotoneInfoIcon name="edit" size={15} />
                        </button>
                        <button
                          onClick={() => { if (typeof window !== 'undefined') window.print(); }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                          title="Print patient summary"
                          style={{ background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (typeof window === 'undefined') return;
                            // Real export — JSON snapshot of the patient record.
                            // Export the *complete* clinical history. Previously
                            // we sliced each collection to 20 — easy to read in
                            // a code review, but silently truncates exports for
                            // any patient with > 20 records / referrals / labs.
                            // For a clinical handoff or patient-data-rights
                            // export, partial data is worse than no export.
                            const snapshot = {
                              patient,
                              latestRecord: records[0] || null,
                              latestVitals,
                              records,
                              referrals: patientReferrals || [],
                              labResults: (allLabResults || []).filter(l => l.patientId === patient._id),
                              exportedAt: new Date().toISOString(),
                            };
                            const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `patient-${patient.hospitalNumber || patient._id}-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                          title="Download patient record (JSON)"
                          style={{ background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                        >
                          <DuotoneInfoIcon name="download" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tabs — icon + label pills, tinted active surface (TamamHealth-style) */}
          <div
            className="flex gap-1 mb-5 no-print overflow-x-auto"
            style={{
              background: 'var(--bg-card-solid)',
              border: '1px solid var(--border-light)',
              borderRadius: 12,
              padding: 4,
              boxShadow: 'var(--card-shadow)',
            }}
          >
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 transition-all whitespace-nowrap"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'var(--bg-tinted, #F2F5F3)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <tab.icon className="w-4 h-4" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {/* Active triage banner — shows at top whenever a nurse has
                    triaged this patient recently (within 24h). Visible to
                    every role (nurse, doctor, med supt, etc.) so there is a
                    single source of truth for current triage priority. */}
                {patientTriages.length > 0 && (() => {
                  const latest = patientTriages[0];
                  const hoursOld = (Date.now() - new Date(latest.triagedAt).getTime()) / 3600000;
                  if (hoursOld > 24 && latest.status !== 'pending') return null;
                  const bg = latest.priority === 'RED' ? 'rgba(229,46,66,0.14)' : latest.priority === 'YELLOW' ? 'rgba(252,211,77,0.14)' : 'rgba(16,185,129,0.12)';
                  const color = latest.priority === 'RED' ? 'var(--color-danger)' : latest.priority === 'YELLOW' ? 'var(--color-warning)' : 'var(--color-success)';
                  const label = latest.priority === 'RED' ? 'Emergency — immediate care' : latest.priority === 'YELLOW' ? 'Priority — see soon' : 'Non-urgent';
                  return (
                    <div className="card-elevated p-4 flex items-center gap-4" style={{ background: bg, border: `1px solid ${color}40` }}>
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: color, color: '#fff' }}>
                        <span className="text-base font-black">{latest.priority}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                            ETAT Triage · {label}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            {new Date(latest.triagedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {latest.chiefComplaint && (
                          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{latest.chiefComplaint}</p>
                        )}
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          A: {latest.airway} · B: {latest.breathing} · C: {latest.circulation} · AVPU: {latest.consciousness.toUpperCase()[0]}
                          {' · by '}
                          <span className="font-medium">{latest.triagedByName}</span>
                        </p>
                        {(latest.temperature || latest.pulse || latest.oxygenSaturation || latest.systolic) && (
                          <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            {latest.temperature && `T ${latest.temperature}°C  `}
                            {latest.pulse && `HR ${latest.pulse}  `}
                            {latest.respiratoryRate && `RR ${latest.respiratoryRate}  `}
                            {latest.oxygenSaturation && `SpO₂ ${latest.oxygenSaturation}%  `}
                            {(latest.systolic && latest.diastolic) && `BP ${latest.systolic}/${latest.diastolic}`}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'var(--bg-card-solid)', color }}>
                        {latest.status}
                      </span>
                    </div>
                  );
                })()}

                {/* Most Recent Record — hero card, first thing the doctor sees */}
                <div
                  className="card-elevated overflow-hidden relative"
                  style={{
                    boxShadow: '0 8px 32px -12px rgba(43,111,224,0.18), 0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Decorative gradient corner */}
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute', top: 0, right: 0,
                      width: 200, height: 160, pointerEvents: 'none',
                      background: 'radial-gradient(ellipse at top right, rgba(43,111,224,0.08), transparent 70%)',
                    }}
                  />

                  {/* Header: title + date + CTA */}
                  <div
                    className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2 relative"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--accent-light)' }}
                      >
                        <ClipboardList className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                      </div>
                      <h3 className="font-semibold text-sm">Most Recent Record</h3>
                      {latestRecord && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)' }}
                        >
                          <CalendarClock className="w-3 h-3" />
                          {formatDateTime(latestRecord.consultedAt || latestRecord.visitDate)}
                        </span>
                      )}
                      {latestRecord?.visitType && (
                        <span
                          className={`badge text-[10px] ${
                            latestRecord.visitType === 'emergency'
                              ? 'badge-emergency'
                              : latestRecord.visitType === 'inpatient'
                              ? 'badge-warning'
                              : 'badge-normal'
                          }`}
                        >
                          {latestRecord.visitType}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors hover:bg-[var(--accent-light)]"
                      style={{ color: 'var(--tamamhealth-blue)', border: '1px solid var(--accent-border)' }}
                    >
                      View Full History <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {latestRecord ? (
                    <div className="p-5 space-y-4 relative">
                      {/* Hero: chief complaint + diagnosis pill */}
                      <div
                        className="rounded-xl p-4"
                        style={{
                          background: 'linear-gradient(135deg, var(--accent-light) 0%, transparent 100%)',
                          border: '1px solid var(--accent-border)',
                        }}
                      >
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1"
                          style={{ color: 'var(--tamamhealth-blue)' }}
                        >
                          <Stethoscope className="w-3 h-3" /> Chief complaint
                        </p>
                        <p className="text-base font-semibold leading-snug mb-3" style={{ color: 'var(--text-primary)' }}>
                          {latestRecord.chiefComplaint || '—'}
                        </p>
                        {latestDiagnosis && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                              Diagnosis
                            </span>
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{
                                background: 'var(--bg-card)',
                                color: 'var(--tamamhealth-blue)',
                                border: '1px solid var(--accent-border)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                              }}
                            >
                              <span
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--accent-light)' }}
                              >
                                {latestDiagnosis.icd10Code}
                              </span>
                              {latestDiagnosis.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Provider / metadata chip row */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        {latestRecord.providerName && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}
                          >
                            <UserIcon className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {latestRecord.providerName}
                            </span>
                          </span>
                        )}
                        {latestRecord.department && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}
                          >
                            <Activity className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                            {latestRecord.department}
                          </span>
                        )}
                        {latestRecord.hospitalName && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}
                          >
                            <Building2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                            {latestRecord.hospitalName}
                          </span>
                        )}
                      </div>

                      {/* Clinical blocks: medications + treatment plan */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                          className="rounded-xl p-3.5"
                          style={{
                            background: 'var(--overlay-subtle)',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <p
                            className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Pill className="w-3 h-3" style={{ color: '#14B8A6' }} />
                            Current medications
                          </p>
                          {(latestRecord.prescriptions || []).length > 0 ? (
                            <ul className="space-y-1.5">
                              {(latestRecord.prescriptions || []).slice(0, 4).map((p, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs">
                                  <span
                                    className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                                    style={{ background: 'var(--tamamhealth-blue)' }}
                                  />
                                  <span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                      {p.drugName}
                                    </span>{' '}
                                    <span style={{ color: 'var(--text-muted)' }}>
                                      · {p.dose} · {p.frequency}
                                    </span>
                                  </span>
                                </li>
                              ))}
                              {(latestRecord.prescriptions || []).length > 4 && (
                                <li className="text-[10px] pl-2.5" style={{ color: 'var(--text-muted)' }}>
                                  +{(latestRecord.prescriptions || []).length - 4} more
                                </li>
                              )}
                            </ul>
                          ) : (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None prescribed</p>
                          )}
                        </div>

                        <div
                          className="rounded-xl p-3.5"
                          style={{
                            background: 'var(--overlay-subtle)',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <p
                            className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <ClipboardList className="w-3 h-3" style={{ color: 'var(--tamamhealth-blue)' }} />
                            Treatment plan
                          </p>
                          {latestRecord.treatmentPlan ? (
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {latestRecord.treatmentPlan}
                            </p>
                          ) : (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No plan recorded</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center relative">
                      <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No consultations recorded yet for this patient.
                      </p>
                    </div>
                  )}
                </div>

                {/* Latest Vitals */}
                <div className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="icon-box-sm" style={{ background: 'rgba(196, 69, 54, 0.12)' }}>
                        <Activity className="w-4 h-4" style={{ color: '#C44536' }} />
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
                      onClick={() => setActiveTab('trends')}
                      className="text-xs font-semibold inline-flex items-center gap-1 px-2.5 py-1 rounded-md"
                      style={{ color: 'var(--tamamhealth-blue)', background: 'rgba(59, 130, 246, 0.08)' }}
                    >
                      <TrendingUpIcon className="w-3.5 h-3.5" /> View Trends
                    </button>
                  </div>
                  <div className="p-5">
                    {latestVitals ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        <VitalCard vitalKey="pulse"            icon="heart"          label={t('vitals.pulse')}          value={latestVitals.pulse}          unit="bpm" />
                        <VitalCard vitalKey="bp"               icon="bloodPressure"  label={t('vitals.bloodPressure')}  value={`${latestVitals.systolic}/${latestVitals.diastolic}`} systolic={latestVitals.systolic} diastolic={latestVitals.diastolic} unit="mmHg" />
                        <VitalCard vitalKey="temperature"      icon="thermometer"    label={t('vitals.temperature')}    value={latestVitals.temperature}    unit="°C" />
                        <VitalCard vitalKey="oxygenSaturation" icon="oxygen"         label={t('vitals.spo2')}           value={latestVitals.oxygenSaturation} unit="%" />
                        <VitalCard vitalKey="respiratoryRate"  icon="lungs"          label={t('vitals.respRate')}       value={latestVitals.respiratoryRate} unit="/min" />
                        <VitalCard vitalKey="bmi"              icon="weight"         label={t('vitals.bmi')}            value={latestVitals.bmi}            unit="kg/m²" />
                        {/* Weight + height are neutral readings — no universal alarm range. */}
                        <VitalCard vitalKey="none"             icon="weight"         label={t('vitals.weight')}         value={latestVitals.weight}         unit="kg" />
                        <VitalCard vitalKey="none"             icon="patient"        label={t('vitals.height')}         value={latestVitals.height}         unit="cm" />
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No vitals recorded yet for this patient.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Visits */}
                <div className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                      <FileText className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                    </div>
                    <h3 className="font-semibold text-sm">{t('encounters.recent')}</h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--table-row-border)' }}>
                    {records.slice(0, 4).map(rec => {
                      const ai = (rec as unknown as Record<string, unknown>).aiEvaluation as { suggestedDiagnoses: { icd10Code: string; name: string; confidence: number; reasoning: string; severity: string; suggestedTreatment?: string }[]; vitalSignAlerts: string[]; recommendedTests: string[]; severityAssessment: string; clinicalNotes: string; evaluatedAt: string } | undefined;
                      const isAIExpanded = expandedAI.has(rec._id);
                      return (
                      <div key={rec._id} className="px-5 py-4 hover:bg-white/[0.03]">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`badge text-[10px] ${rec.visitType === 'emergency' ? 'badge-emergency' : rec.visitType === 'inpatient' ? 'badge-warning' : 'badge-normal'}`}>
                                {rec.visitType}
                              </span>
                              <span className="text-sm font-medium">{rec.department}</span>
                              {ai && (
                                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                                  <Brain className="w-3 h-3" /> AI Evaluated
                                </span>
                              )}
                            </div>
                            <p className="text-sm mt-1">{rec.chiefComplaint}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatDateTime(rec.consultedAt || rec.visitDate)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{rec.hospitalName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(rec.diagnoses || []).map((d, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)' }}>
                              {d.icd10Code} {d.name}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Provider: {rec.providerName} · {rec.providerRole}
                        </p>
                        {ai && (
                          <>
                            <button
                              onClick={() => setExpandedAI(prev => {
                                const next = new Set(prev);
                                if (next.has(rec._id)) next.delete(rec._id); else next.add(rec._id);
                                return next;
                              })}
                              className="flex items-center gap-1 text-xs mt-2 font-medium"
                              style={{ color: '#8B5CF6' }}
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
                                    <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', fontSize: '10px' }}>{dx.icd10Code}</span>
                                    <span className="font-medium">{dx.name}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>({dx.confidence}%)</span>
                                  </div>
                                ))}
                                {ai.vitalSignAlerts.length > 0 && (
                                  <div className="text-xs" style={{ color: 'var(--color-warning)' }}>
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                    {ai.vitalSignAlerts.length} vital sign alert(s)
                                  </div>
                                )}
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ai.clinicalNotes}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );})}
                  </div>
                </div>
              </div>

              {/* Sidebar info */}
              <div className="space-y-5">
                {/* ── Related Records (deep links) ── */}
                <div className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                      <ClipboardList className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <h3 className="font-semibold text-sm">Related Records</h3>
                  </div>
                  <div className="p-3 space-y-1">
                    {[
                      {
                        icon: FileText,
                        label: 'Past Consultations',
                        count: consultationsCount,
                        action: () => setActiveTab('history'),
                        iconBg: 'var(--accent-light)',
                        iconColor: 'var(--accent-primary)',
                      },
                      {
                        icon: ArrowRightLeft,
                        label: 'Active Referrals',
                        count: activeReferralsCount,
                        action: () => setActiveTab('referrals'),
                        iconBg: 'var(--accent-light)',
                        iconColor: 'var(--accent-primary)',
                      },
                      {
                        icon: FlaskConical,
                        label: 'Lab Orders',
                        count: labOrdersCount,
                        action: () => setActiveTab('labs'),
                        iconBg: 'rgba(139,92,246,0.12)',
                        iconColor: '#8B5CF6',
                      },
                      {
                        icon: Pill,
                        label: 'Prescriptions',
                        count: prescriptionsCount,
                        action: () => setActiveTab('prescriptions'),
                        iconBg: 'rgba(20,184,166,0.12)',
                        iconColor: '#14B8A6',
                      },
                      {
                        icon: Heart,
                        label: 'Immunizations',
                        count: immunizationsCount,
                        action: () => router.push(`/immunizations`),
                        iconBg: 'rgba(236,72,153,0.12)',
                        iconColor: '#EC4899',
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          onClick={item.action}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--accent-light)] text-left"
                          title={`View ${item.label}`}
                        >
                          <div
                            className="icon-box-sm flex-shrink-0"
                            style={{ background: item.iconBg }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: item.iconColor }} />
                          </div>
                          <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center"
                            style={{
                              background: item.count > 0 ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                              color: item.count > 0 ? '#fff' : 'var(--text-muted)',
                            }}
                          >
                            {item.count}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Billing & Financial Summary ── */}
                <BillingSidebarCard
                  patientId={patient._id}
                  onPayClick={() => { setActiveTab('billing'); setShowPaymentPanel(true); }}
                  onViewBilling={() => setActiveTab('billing')}
                />

                {/* ── Patient QR Code ── */}
                <div className="card-elevated no-print">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                      <Search className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <h3 className="font-semibold text-sm">Patient QR Code</h3>
                  </div>
                  <div className="p-5 flex justify-center">
                    <PatientQRCode
                      patientId={patient._id}
                      patientName={`${patient.firstName} ${patient.surname}`}
                      hospitalNumber={patient.hospitalNumber}
                      size={180}
                    />
                  </div>
                </div>

                <div className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="icon-box-sm" style={{ background: 'rgba(43,111,224,0.12)' }}>
                      <UserIcon className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                    </div>
                    <h3 className="font-semibold text-sm">{t('patient.demographics')}</h3>
                  </div>
                  <div className="p-5">
                    {/* Personal Info */}
                    <div className="data-row-divider-sm">
                      {[
                        { l: t('patient.phone'), v: patient.phone },
                        { l: t('patient.bloodType'), v: patient.bloodType },
                        { l: t('patient.location'), v: `${patient.county}, ${patient.state}` },
                        { l: t('patient.tribe'), v: patient.tribe },
                        { l: t('patient.language'), v: patient.primaryLanguage },
                      ].map(item => (
                        <div key={item.l} className="flex justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.l}</span>
                          <span className="text-xs font-medium text-right max-w-[60%] truncate">{item.v}</span>
                        </div>
                      ))}
                    </div>
                    <hr className="section-divider" />
                    {/* Registration Info */}
                    <div className="data-row-divider-sm">
                      {[
                        { l: t('patient.registered'), v: registeredAtDisplay },
                        { l: t('patient.facility'), v: regHospital?.name || 'N/A' },
                      ].map(item => (
                        <div key={item.l} className="flex justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.l}</span>
                          <span className="text-xs font-medium text-right max-w-[60%] truncate">{item.v}</span>
                        </div>
                      ))}
                    </div>
                    <hr className="section-divider" />
                    {/* Next of Kin */}
                    <div className="data-row-divider-sm">
                      {[
                        { l: t('patient.nextOfKin'), v: `${patient.nokName} (${patient.nokRelationship})` },
                        { l: t('patient.nokPhone'), v: patient.nokPhone },
                      ].map(item => (
                        <div key={item.l} className="flex justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.l}</span>
                          <span className="text-xs font-medium text-right max-w-[60%] truncate">{item.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="icon-box-sm" style={{ background: 'rgba(229,46,66,0.12)' }}>
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-red)' }} />
                    </div>
                    <h3 className="font-semibold text-sm">{t('patient.allergies')}</h3>
                  </div>
                  <div className="p-5 data-row-divider-sm">
                    {(patient.allergies || ['None known']).map(a => (
                      <div key={a} className="px-3 py-2 rounded-lg text-sm font-medium"
                        style={{ background: a === 'None known' ? 'var(--overlay-subtle)' : 'rgba(229,46,66,0.14)', color: a === 'None known' ? 'var(--text-secondary)' : '#F87171' }}>
                        {a}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="icon-box-sm" style={{ background: 'rgba(236,72,153,0.12)' }}>
                      <Heart className="w-3.5 h-3.5" style={{ color: '#EC4899' }} />
                    </div>
                    <h3 className="font-semibold text-sm">{t('patient.chronicConditions')}</h3>
                  </div>
                  <div className="p-5 data-row-divider-sm">
                    {(patient.chronicConditions || ['None']).map(c => (
                      <div key={c} className="px-3 py-2 rounded-lg text-sm"
                        style={{ background: c === 'None' ? 'var(--overlay-subtle)' : 'rgba(252,211,77,0.14)', color: c === 'None' ? 'var(--text-secondary)' : 'var(--color-warning)' }}>
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-elevated">
                  <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="icon-box-sm" style={{ background: 'rgba(20,184,166,0.12)' }}>
                      <Pill className="w-3.5 h-3.5" style={{ color: '#14B8A6' }} />
                    </div>
                    <h3 className="font-semibold text-sm">{t('patient.medications')}</h3>
                  </div>
                  <div className="p-5 data-row-divider-sm">
                    {records[0]?.prescriptions?.map((p, i) => (
                      <div key={i} className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                        <p className="text-sm font-medium">{p.drugName}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.dose} · {p.route} · {p.frequency}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Index — Epic-style curated link grid for this patient */}
          {activeTab === 'index' && patient && (
            <PatientIndex
              patient={patient}
              counts={{
                consultations: consultationsCount,
                labs: labOrdersCount,
                prescriptions: prescriptionsCount,
                referrals: (patientReferrals || []).length,
                immunizations: immunizationsCount,
                activeProblems: activeProblems.length,
                criticalLabs: (allLabResults || []).filter(l => l.patientId === patient._id && l.critical).length,
                activeReferrals: activeReferralsCount,
              }}
              onJump={setActiveTab}
            />
          )}

          {/* SBAR Handoff — auto-generated from chart for shift change */}
          {activeTab === 'sbar' && patient && (
            <PatientSBAR
              patient={patient}
              records={records}
              labs={(allLabResults || []).filter(l => l.patientId === patient._id)}
              prescriptions={(allPrescriptions || []).filter(r => r.patientId === patient._id)}
              triages={patientTriages}
              problems={patientProblems}
            />
          )}

          {/* Problem List — longitudinal active/chronic/resolved */}
          {activeTab === 'problems' && patient && (
            <ProblemList
              patientId={patient._id}
              patientName={`${patient.firstName} ${patient.surname}`.trim()}
            />
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

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUpIcon className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
                    Vital Sign Trends
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Chronological trends across all recorded visits. Colored badges flag
                    readings outside the normal range or moving quickly.
                  </p>
                </div>
              </div>
              <VitalsTrends records={records} />
            </div>
          )}

          {/* Medical History Tab */}
          {activeTab === 'history' && (
            <div className="card-elevated">
              <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-light)' }}
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
                  className="px-5 py-3 border-b flex items-center gap-2 flex-wrap"
                  style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
                >
                  {/* Search */}
                  <div
                    className="flex items-center gap-2 flex-1 min-w-[220px] px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
                  >
                    <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search by complaint, diagnosis, ICD-10, or provider…"
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

                  {/* Time range */}
                  <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                    {([
                      { v: 'all', l: 'All time' },
                      { v: '1y', l: 'Past year' },
                      { v: '90d', l: '90 days' },
                      { v: '30d', l: '30 days' },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setHistoryRange(opt.v)}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                        style={{
                          background: historyRange === opt.v ? 'var(--accent-light)' : 'transparent',
                          color: historyRange === opt.v ? 'var(--tamamhealth-blue)' : 'var(--text-muted)',
                        }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>

                  {/* Visit type */}
                  <select
                    value={historyVisitType}
                    onChange={e => setHistoryVisitType(e.target.value as typeof historyVisitType)}
                    className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg outline-none"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="all">All visit types</option>
                    <option value="outpatient">Outpatient</option>
                    <option value="inpatient">Inpatient</option>
                    <option value="emergency">Emergency</option>
                  </select>

                  {(historySearch || historyRange !== 'all' || historyVisitType !== 'all') && (
                    <button
                      onClick={() => { setHistorySearch(''); setHistoryRange('all'); setHistoryVisitType('all'); }}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
              {records.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No encounters recorded yet.</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="p-10 text-center">
                  <Search className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No encounters match the current filters.</p>
                  <button
                    onClick={() => { setHistorySearch(''); setHistoryRange('all'); setHistoryVisitType('all'); }}
                    className="text-xs font-semibold mt-2"
                    style={{ color: 'var(--tamamhealth-blue)' }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
              <div className="relative px-6 py-5" style={{ paddingLeft: 56 }}>
                {/* Vertical spine */}
                <div
                  className="absolute top-5 bottom-5 w-0.5"
                  style={{
                    left: 32,
                    background: 'linear-gradient(180deg, var(--accent-border) 0%, var(--border-light) 100%)',
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
                      className="rounded-xl transition-all hover:shadow-md"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-card)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header strip — clickable to expand */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={toggleExpand}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
                        className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 cursor-pointer hover:bg-[var(--accent-light)] transition-colors"
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
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
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
                      <div className="p-4">
                        <p className="text-sm font-semibold leading-snug mb-1" style={{ color: 'var(--text-primary)' }}>
                          {rec.chiefComplaint}
                        </p>
                        <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {isExpanded
                            ? rec.historyOfPresentIllness
                            : `${rec.historyOfPresentIllness.slice(0, 180)}${rec.historyOfPresentIllness.length > 180 ? '…' : ''}`}
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
                                  <Pill className="w-3 h-3" style={{ color: '#14B8A6' }} />
                                  Prescriptions ({rec.prescriptions!.length})
                                </p>
                                <ul className="space-y-1">
                                  {rec.prescriptions!.map((rx, k) => (
                                    <li key={k} className="text-xs flex items-start gap-2 p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                                      <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--tamamhealth-blue)' }} />
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
                                  <FlaskConical className="w-3 h-3" style={{ color: '#8B5CF6' }} />
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
                            style={{ color: '#8B5CF6' }}
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
                                  <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', fontSize: '10px' }}>{dx.icd10Code}</span>
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
                  <div className="icon-box-sm" style={{ background: 'rgba(139,92,246,0.12)' }}>
                    <FlaskConical className="w-3.5 h-3.5" style={{ color: '#8B5CF6' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('lab.title')}</span>
                </div>
                <button onClick={() => router.push('/lab')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--tamamhealth-blue)' }}>
                  View in Lab Module <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <table className="data-table">
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
          )}

          {/* Prescriptions Tab */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                  <div className="icon-box-sm" style={{ background: 'rgba(20,184,166,0.12)' }}>
                    <Pill className="w-3.5 h-3.5" style={{ color: '#14B8A6' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Prescriptions</span>
                </div>
                <button onClick={() => router.push('/pharmacy')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--tamamhealth-blue)' }}>
                  View in Pharmacy <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {records.map(rec => (
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
                        <div className="icon-box-sm flex-shrink-0" style={{ background: 'rgba(20,184,166,0.12)' }}>
                          <Pill className="w-3.5 h-3.5" style={{ color: '#14B8A6' }} />
                        </div>
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
              ))}
            </div>
          )}

          {/* Vitals Tab */}
          {activeTab === 'vitals' && (
            <div className="card-elevated overflow-hidden">
              <table className="data-table">
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

          {/* Referrals Tab */}
          {activeTab === 'referrals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                  <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                    <ArrowRightLeft className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-blue)' }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('referral.title')}</span>
                </div>
                <button onClick={() => router.push('/referrals')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--tamamhealth-blue)' }}>
                  View in Referrals <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {patientReferrals.length === 0 ? (
                <div className="card-elevated p-6 text-center">
                  <ArrowRightLeft className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('referral.none')}</p>
                </div>
              ) : (
                patientReferrals.map(ref => {
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
                          <Clock className="w-3 h-3" />
                          {ref.referralDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <Building2Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{ref.fromHospital}</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span className="font-medium">{ref.toHospital}</span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--overlay-subtle)' }}>{ref.department}</span>
                      </div>
                      <p className="text-sm mb-1"><span className="font-medium">Reason:</span> {ref.reason}</p>
                      {ref.notes && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Notes: {ref.notes}</p>
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
                })
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <BillingTab
              patient={patient}
              patientBalance={patientBalance}
              showPaymentPanel={showPaymentPanel}
              showPlanWizard={showPlanWizard}
              setShowPaymentPanel={setShowPaymentPanel}
              setShowPlanWizard={setShowPlanWizard}
              reloadPayments={reloadPayments}
            />
          )}
      </main>

      <SendMessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        recipient={patient ? {
          _id: patient._id,
          name: `${patient.firstName} ${patient.middleName || ''} ${patient.surname}`.replace(/\s+/g, ' ').trim(),
          phone: patient.phone || '',
          type: 'patient',
          subtitle: `Patient · ${patient.hospitalNumber || 'No record #'}`,
        } : null}
      />

      {/* Edit Demographics Modal */}
      {showEditModal && patient && (
        <div className="modal-backdrop" onClick={() => !editSubmitting && setShowEditModal(false)}>
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
                <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
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
        </div>
      )}
    </>
  );
}
