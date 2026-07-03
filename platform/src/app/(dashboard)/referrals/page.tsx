'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import Badge, { toneForStatus } from '@/components/Badge';
import {
  ArrowRightLeft, Plus, Send, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, X,
  Stethoscope, Package, FileText, Image as ImageIcon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  User, Activity, FlaskConical, Paperclip, XCircle, MessageSquarePlus,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ClipboardCheck, Bell, RotateCcw,
} from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { useToast } from '@/components/Toast';
import FileUpload from '@/components/FileUpload';
import ReferralFilters, { type ReferralFilterState } from '@/components/referrals/ReferralFilters';
import RowActionsMenu, { type RowAction } from '@/components/referrals/RowActionsMenu';
import type { Attachment, TransferPackage, ReferralDisposition } from '@/data/mock';
import { formatPhoneDisplay } from '@/lib/field-formats';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Fallback list used only when the facility hasn't configured its departments
// in Facility Settings (settings.departments drives the picker when present).
const FALLBACK_DEPARTMENTS = [
  'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'Surgery',
  'Emergency', 'Cardiology', 'Orthopedics', 'Ophthalmology', 'Neurology',
  'Dermatology', 'ENT', 'Outpatient'
];

const DISPOSITION_OPTIONS: ReferralDisposition[] = [
  'treated_discharged', 'admitted', 'referred_onward', 'did_not_arrive', 'deceased',
];

export default function ReferralsPage() {
  const { t } = useTranslation();
  const { referrals, createWithTransfer, accept, updateStatus, updateNotes, completeWithOutcome } = useReferrals();
  const { showToast } = useToast();
  const { hospitals } = useHospitals();
  const { patients } = usePatients();
  const { currentUser } = useApp();
  const [localSearch, setLocalSearch] = useState('');
  const { canManageReferrals } = usePermissions();
  const { departments: facilityDepartments } = useSettings();
  const departments = facilityDepartments.length ? facilityDepartments : FALLBACK_DEPARTMENTS;
  const OUR_HOSPITAL_ID = currentUser?.hospitalId || '';

  const searchParams = useSearchParams();
  // Deep link from consultation (?tab=outgoing) after a referral is created,
  // so the clinician lands on the tab that actually shows what they just sent.
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>(() => (
    searchParams?.get('tab') === 'outgoing' ? 'outgoing' : 'incoming'
  ));
  const [showNewReferral, setShowNewReferral] = useState(false);
  const [expandedReferral, setExpandedReferral] = useState<string | null>(null);
  // Structured filters — surfaced in a popover beside the platform search bar.
  const [colFilters, setColFilters] = useState<ReferralFilterState>({ patient: '', route: '', department: '', urgency: '', status: '' });
  // Deep link from a patient chart: /referrals?patient=<name> pre-filters.
  useEffect(() => {
    const patientParam = searchParams?.get('patient');
    if (patientParam) setColFilters(f => ({ ...f, patient: patientParam }));
  }, [searchParams]);
  const setColFilter = (k: keyof ReferralFilterState, v: string) => setColFilters(f => ({ ...f, [k]: v }));
  const clearColFilters = () => setColFilters({ patient: '', route: '', department: '', urgency: '', status: '' });

  // New referral form state
  const [formPatient, setFormPatient] = useState('');
  const [formPatientSearch, setFormPatientSearch] = useState('');
  const [formHospital, setFormHospital] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formUrgency, setFormUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Modal state for decline, complete, and add note
  const [declineModalId, setDeclineModalId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [completeModalId, setCompleteModalId] = useState<string | null>(null);
  const [completeOutcome, setCompleteOutcome] = useState('');
  const [completeDisposition, setCompleteDisposition] = useState<ReferralDisposition>('treated_discharged');
  const [completeFollowUp, setCompleteFollowUp] = useState('');
  const [noteModalId, setNoteModalId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Reverse a referral status transition back to its prior state. Clinical
  // status changes are confirmed before they are undone. Backed by the existing
  // referral-service `updateReferralStatus`, which accepts any target status.
  const [reverseModal, setReverseModal] = useState<{ id: string; to: 'sent' | 'received'; name: string } | null>(null);

  const handleReverseStatus = async () => {
    if (!reverseModal) return;
    try {
      setActionSubmitting(true);
      await updateStatus(reverseModal.id, reverseModal.to);
      showToast(t('action.undo'), 'success');
      setReverseModal(null);
    } catch {
      showToast(t('error.title'), 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Track viewed referrals for notification badge
  const [viewedReferralIds, setViewedReferralIds] = useState<Set<string>>(new Set());

  // Transfer package viewer state
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  // Filter referrals
  const incomingReferrals = referrals.filter(r => r.toHospitalId === OUR_HOSPITAL_ID);
  const outgoingReferrals = referrals.filter(r => r.fromHospitalId === OUR_HOSPITAL_ID);
  const activeReferrals = activeTab === 'incoming' ? incomingReferrals : outgoingReferrals;

  // Referral network analytics: top destinations + acceptance rate.
  // For each receiving facility, count how many referrals we sent there
  // and what fraction were accepted (status sent → received → seen → completed).
  // New incoming referrals (status 'sent') for notification badge
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const newIncomingCount = incomingReferrals.filter(r => r.status === 'sent' && !viewedReferralIds.has(r._id)).length;

  // Auto-mark as 'received' when user expands an incoming referral with status 'sent'
  useEffect(() => {
    if (expandedReferral && activeTab === 'incoming') {
      const ref = incomingReferrals.find(r => r._id === expandedReferral && r.status === 'sent');
      if (ref) {
        setViewedReferralIds(prev => new Set(prev).add(ref._id));
        updateStatus(ref._id, 'received').catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedReferral]);

  // Search filtering (+ status filter)
  const combinedSearch = localSearch.toLowerCase().trim();
  const filteredReferrals = activeReferrals.filter(r => {
    const f = colFilters;
    if (combinedSearch) {
      const haystack = `${r.patientName} ${r.fromHospital} ${r.toHospital} ${r.department} ${r.referringDoctor} ${r.notes} ${r.reason}`.toLowerCase();
      if (!combinedSearch.split(/\s+/).every(term => haystack.includes(term))) return false;
    }
    if (f.patient && !`${r.patientName} ${r.patientId}`.toLowerCase().includes(f.patient.toLowerCase())) return false;
    if (f.route && !`${r.fromHospital} ${r.toHospital}`.toLowerCase().includes(f.route.toLowerCase())) return false;
    if (f.department && !(r.department || '').toLowerCase().includes(f.department.toLowerCase())) return false;
    if (f.urgency && r.urgency !== f.urgency) return false;
    if (f.status && r.status !== f.status) return false;
    return true;
  });

  // Patient _id → hospital number, so the table can show the facility-facing ID
  // (e.g. JTH-00012) rather than the internal record id.
  const hospitalNoByPatient = new Map(patients.map(p => [p._id, p.hospitalNumber]));
  const hospitalNoFor = (pid: string) => hospitalNoByPatient.get(pid) || pid;

  // Urgency / status option lists shared by the filter popover.
  const urgencyOptions = [
    { v: 'routine', l: t('referrals.urgency_routine') },
    { v: 'urgent', l: t('referrals.urgency_urgent') },
    { v: 'emergency', l: t('referrals.urgency_emergency') },
  ];

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      sent: t('referral.sent'),
      received: t('referral.received'),
      seen: t('referral.seen'),
      completed: t('referral.completed'),
      cancelled: t('referral.cancelled'),
    };
    return map[status] || status;
  };

  const handleSubmitReferral = async () => {
    try {
      setSubmitting(true);
      const patient = patients.find(p => p._id === formPatient);
      const toHospital = hospitals.find(h => h._id === formHospital);
      const fromHospital = hospitals.find(h => h._id === OUR_HOSPITAL_ID);
      await createWithTransfer(
        {
          patientId: formPatient,
          // Guard the optional middleName — `${undefined}` would otherwise
          // persist a literal "John undefined Doe" into the referral payload.
          patientName: patient
            ? `${patient.firstName} ${patient.middleName || ''} ${patient.surname}`.replace(/\s+/g, ' ').trim()
            : '',
          fromHospitalId: OUR_HOSPITAL_ID,
          fromHospital: fromHospital?.name || '',
          toHospitalId: formHospital,
          toHospital: toHospital?.name || '',
          department: formDepartment,
          urgency: formUrgency,
          reason: formReason,
          notes: formNotes,
          referringDoctor: currentUser?.name || '',
          referralDate: new Date().toISOString().split('T')[0],
          status: 'sent',
        },
        formAttachments,
        currentUser?.name || 'Unknown'
      );
      showToast(t('referrals.toastSent'), 'success');
      setShowNewReferral(false);
      setFormPatient('');
      setFormPatientSearch('');
      setFormHospital('');
      setFormDepartment('');
      setFormUrgency('routine');
      setFormReason('');
      setFormNotes('');
      setFormAttachments([]);
    } catch (err) {
      console.error('Failed to submit referral:', err);
      showToast(t('referrals.toastSubmitFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineModalId || !declineReason.trim()) return;
    try {
      setActionSubmitting(true);
      const ref = referrals.find(r => r._id === declineModalId);
      const existingNotes = ref?.notes || '';
      const declineNote = `[${new Date().toISOString().split('T')[0]} ${currentUser?.name || 'Unknown'}] DECLINED: ${declineReason.trim()}`;
      const updatedNotes = existingNotes ? `${existingNotes}\n\n${declineNote}` : declineNote;
      await updateStatus(declineModalId, 'cancelled');
      await updateNotes(declineModalId, updatedNotes);
      showToast(t('referrals.toastDeclined'), 'success');
      setDeclineModalId(null);
      setDeclineReason('');
    } catch {
      showToast(t('referrals.toastDeclineFailed'), 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!completeModalId || !completeOutcome.trim()) return;
    try {
      setActionSubmitting(true);
      await completeWithOutcome(completeModalId, {
        disposition: completeDisposition,
        summary: completeOutcome.trim(),
        followUp: completeFollowUp.trim() || undefined,
        recordedBy: currentUser?.name || 'Unknown',
        recordedAt: new Date().toISOString(),
      });
      showToast(t('referrals.toastCompleted'), 'success');
      setCompleteModalId(null);
      setCompleteOutcome('');
      setCompleteDisposition('treated_discharged');
      setCompleteFollowUp('');
    } catch {
      showToast(t('referrals.toastCompleteFailed'), 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteModalId || !noteText.trim()) return;
    try {
      setActionSubmitting(true);
      const ref = referrals.find(r => r._id === noteModalId);
      const existingNotes = ref?.notes || '';
      const newNote = `[${new Date().toISOString().split('T')[0]} ${currentUser?.name || 'Unknown'}] ${noteText.trim()}`;
      const updatedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;
      await updateNotes(noteModalId, updatedNotes);
      showToast(t('referrals.toastNoteAdded'), 'success');
      setNoteModalId(null);
      setNoteText('');
    } catch {
      showToast(t('referrals.toastNoteFailed'), 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Hierarchical referral destinations based on facility level
  // Boma(PHCU) → Payam(PHCC), Payam(PHCC) → County/State/National,
  // County → State/National, State → National, National → National/State
  const currentFacilityType = currentUser?.hospital?.facilityType;
  const ALLOWED_DESTINATION_TYPES: Record<string, string[]> = {
    phcu: ['phcc'],
    phcc: ['county_hospital', 'state_hospital', 'national_referral'],
    county_hospital: ['state_hospital', 'national_referral'],
    state_hospital: ['national_referral'],
    national_referral: ['national_referral', 'state_hospital'],
  };
  const allowedTypes = currentFacilityType ? ALLOWED_DESTINATION_TYPES[currentFacilityType] : undefined;
  const otherHospitals = hospitals.filter(h =>
    h._id !== OUR_HOSPITAL_ID &&
    (!allowedTypes || allowedTypes.includes(h.facilityType))
  );

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  const TransferPackageViewer = ({ pkg, refAttachments, reason, notes }: { pkg: TransferPackage; refAttachments?: Attachment[]; reason: string; notes: string }) => {
    const demo = pkg.patientDemographics;
    return (
      <div className="space-y-4 mt-4">
        {/* Reason & Notes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('referrals.reasonForReferral')}</p>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{reason}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('referral.notes')}</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{notes || t('referrals.none')}</p>
          </div>
        </div>

        <hr className="section-divider" />

        {/* Referral Attachments */}
        {refAttachments && refAttachments.length > 0 && (
          <div className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-box-sm">
                <Paperclip className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('referrals.referralAttachments', { count: refAttachments.length })}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {refAttachments.map(att => (
                <button key={att.id} onClick={() => setPreviewAttachment(att)} className="flex items-center gap-2 p-2 rounded-lg text-left transition-colors" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  {isImage(att.mimeType) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`data:${att.mimeType};base64,${att.base64Data}`} alt={att.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{att.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatFileSize(att.sizeBytes)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <hr className="section-divider" />

        {/* Patient Demographics */}
        <div className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-box-sm">
              <User className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('referrals.patientDemographics')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: t('referrals.demoName'), v: `${demo.firstName} ${demo.middleName || ''} ${demo.surname}`.replace(/\s+/g, ' ').trim() },
              { l: t('referrals.demoHospitalNo'), v: demo.hospitalNumber },
              { l: t('referrals.demoDob'), v: demo.dateOfBirth },
              { l: t('patient.gender'), v: demo.gender },
              { l: t('patient.phone'), v: formatPhoneDisplay(demo.phone) },
              { l: t('patient.location'), v: `${demo.county}, ${demo.state}` },
              { l: t('patient.tribe'), v: demo.tribe },
              { l: t('patient.bloodType'), v: demo.bloodType },
            ].map(item => (
              <div key={item.l}>
                <p className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>{item.l}</p>
                <p className="text-sm font-medium">{item.v}</p>
              </div>
            ))}
          </div>
          {demo.allergies?.length > 0 && demo.allergies[0] !== 'None known' && (
            <div className="mt-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
              <span className="text-xs font-medium" style={{ color: '#F87171' }}>
                {t('referrals.allergiesLabel', { list: demo.allergies.join(', ') })}
              </span>
            </div>
          )}
          {demo.chronicConditions?.length > 0 && demo.chronicConditions[0] !== 'None' && (
            <div className="mt-1 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>
                {t('referrals.chronicLabel', { list: demo.chronicConditions.join(', ') })}
              </span>
            </div>
          )}
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('referrals.nokLabel', { name: demo.nokName, relationship: demo.nokRelationship, phone: demo.nokPhone })}
          </div>
        </div>

        <hr className="section-divider" />

        {/* Medical Records Timeline */}
        {pkg.medicalRecords.length > 0 && (
          <div className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-box-sm">
                <Stethoscope className="w-4 h-4" style={{ color: '#2191D0' }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('referrals.medicalRecords', { count: pkg.medicalRecords.length })}</span>
            </div>
            <div className="data-row-divider-sm">
              {pkg.medicalRecords.map(rec => {
                const isExpanded = expandedRecords.has(rec.id);
                return (
                  <div key={rec.id} className="rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                    <button
                      onClick={() => setExpandedRecords(prev => {
                        const next = new Set(prev);
                        if (next.has(rec.id)) next.delete(rec.id); else next.add(rec.id);
                        return next;
                      })}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{rec.visitDate}</span>
                        <Badge tone={rec.visitType === 'emergency' ? 'danger' : rec.visitType === 'inpatient' ? 'warning' : 'neutral'}>
                          {rec.visitType}
                        </Badge>
                        <span className="text-sm font-medium">{rec.department}</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-xs"><span className="font-medium">{t('referrals.complaintLabel')}</span> {rec.chiefComplaint}</p>
                        <p className="text-xs"><span className="font-medium">{t('referrals.providerLabel')}</span> {rec.providerName} ({rec.providerRole}) {t('referrals.atFacility')} {rec.hospitalName}</p>
                        {rec.diagnoses.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{t('referrals.diagnoses')}</p>
                            <div className="flex flex-wrap gap-1">
                              {rec.diagnoses.map((d, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)' }}>
                                  {d.icd10Code} {d.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {rec.vitalSigns && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <span>Temp: {rec.vitalSigns.temperature}°C</span>
                            <span>BP: {rec.vitalSigns.systolic}/{rec.vitalSigns.diastolic}</span>
                            <span>Pulse: {rec.vitalSigns.pulse}</span>
                            <span>SpO2: {rec.vitalSigns.oxygenSaturation}%</span>
                          </div>
                        )}
                        {rec.prescriptions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{t('tab.prescriptions')}</p>
                            <div className="data-row-divider-sm">
                              {rec.prescriptions.map((rx, i) => (
                                <p key={i} className="text-xs">{rx.drugName} — {rx.dose} {rx.route} {rx.frequency} x {rx.duration}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {rec.treatmentPlan && (
                          <p className="text-xs"><span className="font-medium">{t('referrals.planLabel')}</span> {rec.treatmentPlan}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <hr className="section-divider" />

        {/* Lab Results */}
        {pkg.labResults.length > 0 && (
          <div className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-box-sm">
                <FlaskConical className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('referrals.labResults', { count: pkg.labResults.length })}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <th className="text-left py-1.5 pr-3 font-medium" style={{ color: 'var(--text-muted)' }}>{t('lab.testName')}</th>
                    <th className="text-left py-1.5 pr-3 font-medium" style={{ color: 'var(--text-muted)' }}>{t('lab.result')}</th>
                    <th className="text-left py-1.5 pr-3 font-medium" style={{ color: 'var(--text-muted)' }}>{t('lab.reference')}</th>
                    <th className="text-left py-1.5 pr-3 font-medium" style={{ color: 'var(--text-muted)' }}>{t('referrals.date')}</th>
                    <th className="text-left py-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>{t('lab.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.labResults.map((lab, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td className="py-1.5 pr-3 font-medium">{lab.testName}</td>
                      <td className="py-1.5 pr-3" style={{ color: lab.abnormal ? (lab.critical ? 'var(--color-danger)' : 'var(--color-warning)') : 'inherit', fontWeight: lab.abnormal ? 600 : 400 }}>
                        {lab.result} {lab.unit}
                      </td>
                      <td className="py-1.5 pr-3" style={{ color: 'var(--text-muted)' }}>{lab.referenceRange}</td>
                      <td className="py-1.5 pr-3 font-mono" style={{ color: 'var(--text-muted)' }}>{lab.date}</td>
                      <td className="py-1.5">
                        {lab.abnormal ? (
                          <Badge tone={lab.critical ? 'danger' : 'warning'}>
                            {lab.critical ? t('referrals.labCritical') : t('lab.abnormal')}
                          </Badge>
                        ) : (
                          <Badge tone="success">{t('lab.normal')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <hr className="section-divider" />

        {/* All Patient Attachments */}
        {pkg.attachments.length > 0 && (
          <div className="p-4 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-box-sm">
                <ImageIcon className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('referrals.patientAttachments', { count: pkg.attachments.length })}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {pkg.attachments.map(att => (
                <button key={att.id} onClick={() => setPreviewAttachment(att)} className="flex flex-col items-center gap-1 p-3 rounded-lg text-center transition-colors" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                  {isImage(att.mimeType) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`data:${att.mimeType};base64,${att.base64Data}`} alt={att.name} className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <FileText className="w-8 h-8" style={{ color: 'var(--color-danger)' }} />
                  )}
                  <p className="text-[10px] font-medium truncate w-full">{att.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatFileSize(att.sizeBytes)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <hr className="section-divider" />

        {/* Package Metadata */}
        <div className="flex items-center gap-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(33, 145, 208, 0.06)', border: '1px solid var(--accent-border)' }}>
          <div className="icon-box-sm flex-shrink-0">
            <Package className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
          </div>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('referrals.packagedByPrefix')} <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{pkg.packagedBy}</span> {t('referrals.packagedOnAt', { date: new Date(pkg.packagedAt).toLocaleDateString(), time: new Date(pkg.packagedAt).toLocaleTimeString() })}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('referrals.totalSize')} <span className="font-medium">{formatFileSize(pkg.packageSizeBytes)}</span>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {t('referrals.packageCounts', { records: pkg.medicalRecords.length, labs: pkg.labResults.length, files: pkg.attachments.length })}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

        <div className="dash-card overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          {/* ── Card toolbar ── */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-light)' }}>
            {/* Tabs as big titles + stats on right */}
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="flex items-end gap-6">
                <button
                  onClick={() => setActiveTab('incoming')}
                  className="transition-colors focus:outline-none"
                  style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 24, lineHeight: '100%', letterSpacing: 0, color: activeTab === 'incoming' ? '#000000' : 'rgba(0,0,0,0.30)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  {t('referrals.incoming')}
                  {newIncomingCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: 'var(--color-danger)', color: '#fff', verticalAlign: 'middle' }}>
                      {newIncomingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('outgoing')}
                  className="transition-colors focus:outline-none"
                  style={{ fontFamily: "var(--font-platform)", fontWeight: 500, fontSize: 24, lineHeight: '100%', letterSpacing: 0, color: activeTab === 'outgoing' ? '#000000' : 'rgba(0,0,0,0.30)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  {t('referrals.outgoing')}
                </button>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 pb-0.5">
                <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#2191D0' }} />
                  Incoming ({incomingReferrals.length})
                </span>
                <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#D97706' }} />
                  Outgoing ({outgoingReferrals.length})
                </span>
              </div>
            </div>
            {/* Search + filter row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  value={localSearch}
                  onChange={e => setLocalSearch(e.target.value)}
                  placeholder="Search by patient, hospital, or department…"
                  style={{ padding: '9px 18px', height: 38, borderRadius: 999, border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <ReferralFilters
                filters={colFilters}
                setFilter={setColFilter}
                clearAll={clearColFilters}
                urgencyOptions={urgencyOptions}
                statusOptions={[
                  { v: 'sent', l: getStatusLabel('sent') },
                  { v: 'received', l: getStatusLabel('received') },
                  { v: 'seen', l: getStatusLabel('seen') },
                  { v: 'completed', l: getStatusLabel('completed') },
                  { v: 'cancelled', l: getStatusLabel('cancelled') },
                ]}
              />
              {canManageReferrals && (
                <button
                  onClick={() => setShowNewReferral(!showNewReferral)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', borderRadius: 999, background: showNewReferral ? 'var(--bg-card-solid)' : '#2191D0', color: showNewReferral ? 'var(--text-secondary)' : '#fff', border: showNewReferral ? '1px solid var(--border-light)' : 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {showNewReferral ? <><X className="w-4 h-4" /> {t('action.cancel')}</> : <><Plus className="w-4 h-4" /> {t('referrals.newReferral')}</>}
                </button>
              )}
            </div>
          </div>
          {/* Scrollable body */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

          {/* New Referral Form */}
          {showNewReferral && (
            <div className="card-elevated p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-5 h-5" style={{ color: 'var(--tamamhealth-blue)' }} />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('referrals.createNew')}
                </h2>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)' }}>
                  {t('referrals.autoPackages')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {/* Patient */}
                <div>
                  <label>{t('referrals.patient')}</label>
                  {(() => {
                    const selected = formPatient ? patients.find(p => p._id === formPatient) : null;
                    if (selected) {
                      return (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {t('referrals.selectedPrefix')} <span className="font-medium">{selected.firstName} {selected.surname}</span>
                            <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({selected.hospitalNumber})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => { setFormPatient(''); setFormPatientSearch(''); }}
                            className="text-xs underline"
                            style={{ color: 'var(--accent-primary)' }}
                          >
                            {t('referrals.change')}
                          </button>
                        </div>
                      );
                    }
                    const q = formPatientSearch.trim().toLowerCase();
                    const matches = q.length >= 1
                      ? patients.filter(p => {
                          const name = `${p.firstName || ''} ${p.middleName || ''} ${p.surname || ''}`.toLowerCase();
                          return name.includes(q)
                            || (p.hospitalNumber || '').toLowerCase().includes(q)
                            || (p.phone || '').toLowerCase().includes(q);
                        }).slice(0, 8)
                      : [];
                    return (
                      <div>
                        <input
                          type="search"
                          value={formPatientSearch}
                          onChange={e => setFormPatientSearch(e.target.value)}
                          placeholder={t('referrals.patientSearchPlaceholder')}
                          className="w-full p-2.5 rounded-lg outline-none text-sm"
                          style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                        />
                        {matches.length > 0 && (
                          <div className="mt-1 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                            {matches.map(p => (
                              <button
                                key={p._id}
                                type="button"
                                onClick={() => { setFormPatient(p._id); setFormPatientSearch(''); }}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                                style={{ borderBottom: '1px solid var(--border-light)' }}
                              >
                                <span className="text-sm font-medium truncate">{p.firstName} {p.surname}</span>
                                <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{p.hospitalNumber}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {q.length >= 1 && matches.length === 0 && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('referrals.noPatientsMatch')}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Destination Hospital */}
                <div>
                  <label>{t('referrals.destinationHospital')}</label>
                  <select value={formHospital} onChange={(e) => setFormHospital(e.target.value)}>
                    <option value="">{t('referrals.selectHospital')}</option>
                    {otherHospitals.map(h => (
                      <option key={h._id} value={h._id}>
                        {h.name} ({h.state})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label>{t('referrals.department')}</label>
                  <select value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)}>
                    <option value="">{t('referrals.selectDepartment')}</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Urgency */}
                <div>
                  <label>{t('referrals.urgency')}</label>
                  <div className="flex gap-3 mt-1">
                    {(['routine', 'urgent', 'emergency'] as const).map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormUrgency(level)}
                        className={`badge urgency-${level} cursor-pointer px-4 py-2 text-sm transition-all`}
                        style={{
                          opacity: formUrgency === level ? 1 : 0.45,
                          transform: formUrgency === level ? 'scale(1.05)' : 'scale(1)',
                          border: formUrgency === level ? '2px solid currentColor' : '2px solid transparent',
                          borderRadius: '4px',
                        }}
                      >
                        {level === 'emergency' && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                        {t(`referrals.urgency_${level}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div className="col-span-2">
                  <label>{t('referrals.reasonForReferral')}</label>
                  <textarea
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    rows={2}
                    placeholder={t('referrals.reasonPlaceholder')}
                  />
                </div>

                {/* Clinical Notes */}
                <div className="col-span-2">
                  <label>{t('referral.notes')}</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    placeholder={t('referrals.notesPlaceholder')}
                  />
                </div>

                {/* Referral Attachments */}
                <div className="col-span-2">
                  <label>{t('referrals.attachmentsOptional')}</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('referrals.attachmentsHint')}
                  </p>
                  <FileUpload
                    attachments={formAttachments}
                    onAdd={(att) => setFormAttachments(prev => [...prev, att])}
                    onRemove={(id) => setFormAttachments(prev => prev.filter(a => a.id !== id))}
                    uploaderName={currentUser?.name || 'Unknown'}
                    maxFiles={5}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <button
                  onClick={() => setShowNewReferral(false)}
                  className="btn btn-secondary"
                >
                  {t('action.cancel')}
                </button>
                <button
                  onClick={handleSubmitReferral}
                  className="btn btn-primary"
                  disabled={!formPatient || !formHospital || !formDepartment || !formReason || submitting}
                  style={{
                    opacity: (!formPatient || !formHospital || !formDepartment || !formReason || submitting) ? 0.5 : 1,
                    cursor: (!formPatient || !formHospital || !formDepartment || !formReason || submitting) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Package className="w-4 h-4" />
                  {submitting ? t('referrals.packagingSending') : t('referrals.sendWithPackage')}
                </button>
              </div>
            </div>
          )}

          {/* Referrals table */}
          <div className="overflow-hidden">
            <div style={{ overflowX: 'auto' }}>
            {filteredReferrals.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={ArrowRightLeft}
                  title={activeTab === 'outgoing' ? t('referrals.emptyOutgoingTitle') : t('referrals.emptyIncomingTitle')}
                  message={activeTab === 'outgoing'
                    ? t('referrals.emptyOutgoingMsg')
                    : t('referrals.emptyIncomingMsg')}
                  action={activeTab === 'outgoing' ? { label: t('referrals.createReferral'), onClick: () => setShowNewReferral(true) } : undefined}
                />
              </div>
            ) : (
            <table className="data-table referral-table" style={{ minWidth: 1040 }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Hospital ID</th>
                  <th>Route</th>
                  <th>Department</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="ref-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map(ref => {
                const isExpanded = expandedReferral === ref._id;
                const tp = ref.transferPackage as TransferPackage | undefined;
                const refAtts = ref.referralAttachments as Attachment[] | undefined;
                // Status-driven actions, collapsed into a single kebab menu.
                const rowActions: RowAction[] = [
                  ...(canManageReferrals && activeTab === 'incoming' && (ref.status === 'sent' || ref.status === 'received') ? [
                    { key: 'accept', label: t('referrals.accept'), tone: 'success' as const, icon: <CheckCircle2 className="w-4 h-4" />, onClick: async () => {
                      try { await accept(ref._id); showToast(t('referrals.toastAccepted', { name: ref.patientName }), 'success'); }
                      catch { showToast(t('referrals.toastAcceptFailed'), 'error'); }
                    } },
                    { key: 'decline', label: t('referrals.decline'), tone: 'danger' as const, icon: <XCircle className="w-4 h-4" />, onClick: () => { setDeclineModalId(ref._id); setDeclineReason(''); } },
                  ] : []),
                  ...(canManageReferrals && activeTab === 'incoming' && ref.status === 'seen' ? [
                    { key: 'complete', label: t('referrals.markComplete'), tone: 'success' as const, icon: <ClipboardCheck className="w-4 h-4" />, onClick: () => { setCompleteModalId(ref._id); setCompleteOutcome(''); } },
                    { key: 'undo', label: t('action.undo'), tone: 'default' as const, icon: <RotateCcw className="w-4 h-4" />, onClick: () => setReverseModal({ id: ref._id, to: 'received', name: ref.patientName }) },
                  ] : []),
                  ...(canManageReferrals && activeTab === 'incoming' && ref.status === 'cancelled' ? [
                    { key: 'reopen', label: t('action.reopen'), tone: 'default' as const, icon: <RotateCcw className="w-4 h-4" />, onClick: () => setReverseModal({ id: ref._id, to: 'received', name: ref.patientName }) },
                  ] : []),
                  ...(canManageReferrals && ref.status !== 'cancelled' ? [
                    { key: 'note', label: t('action.addNote'), tone: 'default' as const, icon: <MessageSquarePlus className="w-4 h-4" />, onClick: () => { setNoteModalId(ref._id); setNoteText(''); } },
                  ] : []),
                ];
                return (
                  <Fragment key={ref._id}>
                    <tr
                      className="cursor-pointer hover:bg-[var(--table-row-hover)]"
                      onClick={() => setExpandedReferral(isExpanded ? null : ref._id)}
                    >
                      <td>
                        {ref.patientId && !ref.patientId.startsWith('demo-') && !ref.patientId.includes('_demo') ? (
                          <Link
                            href={`/patients/${ref.patientId}`}
                            onClick={e => e.stopPropagation()}
                            className="font-normal text-[13px] truncate block hover:underline"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {ref.patientName}
                          </Link>
                        ) : (
                          <span
                            className="font-normal text-[13px] truncate block"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {ref.patientName}
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>{hospitalNoFor(ref.patientId)}</td>
                      <td className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{ref.fromHospital} → {ref.toHospital}</td>
                      <td className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{ref.department}</td>
                      <td>
                        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: ref.urgency === 'emergency' ? '#C24435' : ref.urgency === 'urgent' ? '#8F6823' : '#157E5F' }}>
                          {t(`referrals.urgency_${ref.urgency}`)}
                        </span>
                        </td>
                        <td>
                        <Badge tone={toneForStatus(ref.status)}>
                          {getStatusLabel(ref.status)}
                        </Badge>
                        {tp && (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium ml-1" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)', border: '1px solid var(--accent-border)' }}>
                            <Package className="w-3 h-3" /> {t('referrals.dataPackage')}
                          </span>
                        )}
                        </td>
                        <td className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{ref.referralDate}</td>
                        <td>
                          <div className="flex items-center justify-end">
                            <RowActionsMenu actions={rowActions} ariaLabel="Actions" />
                          </div>
                        </td>
                    </tr>

                    {/* Expanded View: Transfer Package */}
                    {isExpanded && (
                      <tr><td colSpan={8} style={{ padding: 0, background: 'var(--overlay-subtle)' }}>
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                        {ref.outcome && (
                          <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <ClipboardCheck className="w-4 h-4" style={{ color: '#16A34A' }} />
                              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#16A34A' }}>{t('referrals.outcomeReceived')}</p>
                              <Badge tone="success">{t(`referrals.disposition_${ref.outcome.disposition}`)}</Badge>
                            </div>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{ref.outcome.summary}</p>
                            {ref.outcome.followUp && (
                              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                                <span className="font-semibold">{t('referrals.outcomeFollowUp')}: </span>{ref.outcome.followUp}
                              </p>
                            )}
                            <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                              {t('referrals.outcomeRecordedBy', { name: ref.outcome.recordedBy, date: ref.outcome.recordedAt.slice(0, 10) })}
                            </p>
                          </div>
                        )}
                        {tp ? (
                          <TransferPackageViewer pkg={tp} refAttachments={refAtts} reason={ref.reason} notes={ref.notes} />
                        ) : (
                          <div className="mt-4 space-y-3">
                            <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('referral.reason')}</p>
                              <p className="text-sm">{ref.reason}</p>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{t('referral.notes')}</p>
                              <p className="text-sm whitespace-pre-wrap">{ref.notes || t('referrals.none')}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <div className="icon-box-sm">
                                <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                              </div>
                              {t('referrals.noDataPackage')}
                            </div>
                          </div>
                        )}
                      </div>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
              </tbody>
            </table>
            )}
            </div>
          </div>

          {/* Reverse status confirmation — undo an acceptance or reopen a
              declined referral. Clinical reversals are confirmed first. */}
          {reverseModal && (
            <Modal onClose={() => setReverseModal(null)}>
              <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('action.reverse')}</h3>
                  <button onClick={() => setReverseModal(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {reverseModal.name} &middot; {getStatusLabel(reverseModal.to)}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setReverseModal(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                  <button onClick={handleReverseStatus} disabled={actionSubmitting} className="btn btn-primary flex-1">
                    {actionSubmitting ? t('referrals.saving') : t('action.confirm')}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Add Note Modal */}
          {noteModalId && (
            <Modal onClose={() => setNoteModalId(null)}>
              <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('action.addNote')}</h3>
                  <button onClick={() => setNoteModalId(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {t('referrals.addNoteHint')}
                </p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={4}
                  placeholder={t('referrals.notePlaceholder')}
                  className="w-full mb-4"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setNoteModalId(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                  <button onClick={handleAddNote} disabled={!noteText.trim() || actionSubmitting} className="btn btn-primary flex-1" style={{ opacity: !noteText.trim() ? 0.5 : 1 }}>
                    {actionSubmitting ? t('referrals.saving') : t('action.addNote')}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Decline Modal */}
          {declineModalId && (
            <Modal onClose={() => setDeclineModalId(null)}>
              <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('referrals.declineReferral')}</h3>
                  <button onClick={() => setDeclineModalId(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {t('referrals.declineHint')}
                </p>
                <textarea
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  rows={3}
                  placeholder={t('referrals.declinePlaceholder')}
                  className="w-full mb-4"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setDeclineModalId(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                  <button onClick={handleDecline} disabled={!declineReason.trim() || actionSubmitting} className="btn btn-primary flex-1" style={{ opacity: !declineReason.trim() ? 0.5 : 1, background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                    {actionSubmitting ? t('referrals.declining') : t('referrals.confirmDecline')}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Complete Modal */}
          {completeModalId && (
            <Modal onClose={() => setCompleteModalId(null)}>
              <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('referrals.completeReferral')}</h3>
                  <button onClick={() => setCompleteModalId(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {t('referrals.completeHint')}
                </p>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('referrals.outcomeDisposition')}</label>
                <select
                  value={completeDisposition}
                  onChange={e => setCompleteDisposition(e.target.value as ReferralDisposition)}
                  className="w-full mb-3"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                >
                  {DISPOSITION_OPTIONS.map(d => (
                    <option key={d} value={d}>{t(`referrals.disposition_${d}`)}</option>
                  ))}
                </select>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('referrals.outcomeSummary')}</label>
                <textarea
                  value={completeOutcome}
                  onChange={e => setCompleteOutcome(e.target.value)}
                  rows={3}
                  placeholder={t('referrals.completePlaceholder')}
                  className="w-full mb-3"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('referrals.outcomeFollowUp')}</label>
                <textarea
                  value={completeFollowUp}
                  onChange={e => setCompleteFollowUp(e.target.value)}
                  rows={2}
                  placeholder={t('referrals.outcomeFollowUpPlaceholder')}
                  className="w-full mb-4"
                  style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setCompleteModalId(null)} className="btn btn-secondary flex-1">{t('action.cancel')}</button>
                  <button onClick={handleComplete} disabled={!completeOutcome.trim() || actionSubmitting} className="btn btn-primary flex-1" style={{ opacity: !completeOutcome.trim() ? 0.5 : 1, background: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                    {actionSubmitting ? t('referrals.completing') : t('referrals.markComplete')}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Preview Modal for attachments */}
          {previewAttachment && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-8"
              style={{ background: 'rgba(0,0,0,0.75)' }}
              onClick={() => setPreviewAttachment(null)}
            >
              <div
                className="relative max-w-4xl max-h-[90vh] rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-card)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center gap-2">
                    {isImage(previewAttachment.mimeType) ? <ImageIcon className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} /> : <FileText className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />}
                    <span className="text-sm font-medium">{previewAttachment.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatFileSize(previewAttachment.sizeBytes)}</span>
                  </div>
                  <button onClick={() => setPreviewAttachment(null)} className="p-1 rounded" style={{ background: 'var(--overlay-subtle)' }}>
                    <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
                <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
                  {isImage(previewAttachment.mimeType) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:${previewAttachment.mimeType};base64,${previewAttachment.base64Data}`}
                      alt={previewAttachment.name}
                      className="max-w-full h-auto rounded"
                    />
                  ) : previewAttachment.mimeType === 'application/pdf' ? (
                    <iframe
                      src={`data:application/pdf;base64,${previewAttachment.base64Data}`}
                      className="w-full rounded"
                      style={{ height: '70vh' }}
                      title={previewAttachment.name}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('referrals.previewNotAvailable')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>{/* end scrollable body */}
        </div>{/* end dash-card */}
      </main>
    </>
  );
}
