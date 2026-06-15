'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/EmptyState';
import {
  ArrowRightLeft, Plus, Send, Eye, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, X, Building2,
  Stethoscope, Package, FileText, Image as ImageIcon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  User, Activity, FlaskConical, Paperclip, XCircle, MessageSquarePlus,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ClipboardCheck, Bell,
} from '@/components/icons/lucide';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { FilterBar, SearchInput, FilterSelect } from '@/components/filters';
import PageHeader from '@/components/PageHeader';
import PatientName from '@/components/PatientName';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useToast } from '@/components/Toast';
import FileUpload from '@/components/FileUpload';
import type { Attachment, TransferPackage, ReferralDisposition } from '@/data/mock';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const departments = [
  'Internal Medicine', 'Pediatrics', 'Obstetrics & Gynecology', 'Surgery',
  'Emergency', 'Cardiology', 'Orthopedics', 'Ophthalmology', 'Neurology',
  'Dermatology', 'ENT', 'Outpatient'
];

const DISPOSITION_OPTIONS: ReferralDisposition[] = [
  'treated_discharged', 'admitted', 'referred_onward', 'did_not_arrive', 'deceased',
];

export default function ReferralsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { referrals, createWithTransfer, accept, updateStatus, updateNotes, completeWithOutcome } = useReferrals();
  const { showToast } = useToast();
  const { hospitals } = useHospitals();
  const { patients } = usePatients();
  const { currentUser, globalSearch } = useApp();
  const { canManageReferrals } = usePermissions();
  const OUR_HOSPITAL_ID = currentUser?.hospitalId || '';

  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [showNewReferral, setShowNewReferral] = useState(false);
  const [expandedReferral, setExpandedReferral] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
  const combinedSearch = `${search} ${globalSearch}`.toLowerCase().trim();
  const filteredReferrals = activeReferrals.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!combinedSearch) return true;
    const haystack = `${r.patientName} ${r.fromHospital} ${r.toHospital} ${r.department} ${r.referringDoctor} ${r.notes} ${r.reason}`.toLowerCase();
    return combinedSearch.split(/\s+/).every(term => haystack.includes(term));
  });

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

  const getStatusClass = (status: string) => {
    const map: Record<string, string> = {
      sent: 'ref-sent',
      received: 'ref-received',
      seen: 'ref-seen',
      completed: 'ref-completed',
      cancelled: 'ref-cancelled',
    };
    return map[status] || '';
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
              <div className="icon-box-sm" style={{ background: 'rgba(59, 130, 246,0.12)' }}>
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
            <div className="icon-box-sm" style={{ background: 'rgba(59, 130, 246,0.12)' }}>
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
              { l: t('patient.phone'), v: demo.phone },
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
              <div className="icon-box-sm" style={{ background: 'rgba(92,184,168,0.12)' }}>
                <Stethoscope className="w-4 h-4" style={{ color: '#2563EB' }} />
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
                        <span className={`badge text-[10px] ${rec.visitType === 'emergency' ? 'badge-emergency' : rec.visitType === 'inpatient' ? 'badge-warning' : 'badge-normal'}`}>
                          {rec.visitType}
                        </span>
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
              <div className="icon-box-sm" style={{ background: 'rgba(59, 130, 246,0.12)' }}>
                <FlaskConical className="w-4 h-4" style={{ color: 'var(--tamamhealth-blue)' }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('referrals.labResults', { count: pkg.labResults.length })}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
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
                          <span className={`badge text-[10px] ${lab.critical ? 'badge-emergency' : 'badge-warning'}`}>
                            {lab.critical ? t('referrals.labCritical') : t('lab.abnormal')}
                          </span>
                        ) : (
                          <span className="badge badge-normal text-[10px]">{t('lab.normal')}</span>
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
              <div className="icon-box-sm" style={{ background: 'rgba(59, 130, 246,0.12)' }}>
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
        <div className="flex items-center gap-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(59, 130, 246,0.06)', border: '1px solid var(--accent-border)' }}>
          <div className="icon-box-sm flex-shrink-0" style={{ background: 'rgba(59, 130, 246,0.12)' }}>
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
      <TopBar title={t('nav.referrals')} />
      <main className="page-container page-enter">
          <PageHeader
            icon={ArrowRightLeft}
            title={t('referrals.pageTitle')}
            subtitle={t('referrals.pageSubtitle')}
            actions={canManageReferrals && (
              <button
                onClick={() => setShowNewReferral(!showNewReferral)}
                className="btn btn-primary"
              >
                {showNewReferral ? (
                  <><X className="w-4 h-4" /> {t('action.cancel')}</>
                ) : (
                  <><Plus className="w-4 h-4" /> {t('referrals.newReferral')}</>
                )}
              </button>
            )}
          />

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
                          borderRadius: '8px',
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

          {/* Tabs */}
          <div className="flex items-center gap-0 mb-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <button
              onClick={() => setActiveTab('incoming')}
              className={`px-5 py-3 text-sm font-medium transition-colors relative ${activeTab === 'incoming' ? 'tab-active' : ''}`}
              style={{ color: activeTab === 'incoming' ? 'var(--tamamhealth-blue)' : 'var(--text-muted)' }}
            >
              <span className="flex items-center gap-2">
                {t('referrals.incoming')}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: activeTab === 'incoming' ? 'rgba(59, 130, 246,0.12)' : 'rgba(100,116,139,0.12)',
                    color: activeTab === 'incoming' ? 'var(--tamamhealth-blue)' : 'var(--text-muted)',
                  }}
                >
                  {incomingReferrals.length}
                </span>
                {newIncomingCount > 0 && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'var(--color-danger)',
                      color: '#fff',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                  >
                    <Bell className="w-3 h-3" />
                    {t('referrals.newCount', { count: newIncomingCount })}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              className={`px-5 py-3 text-sm font-medium transition-colors relative ${activeTab === 'outgoing' ? 'tab-active' : ''}`}
              style={{ color: activeTab === 'outgoing' ? 'var(--tamamhealth-blue)' : 'var(--text-muted)' }}
            >
              <span className="flex items-center gap-2">
                {t('referrals.outgoing')}
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: activeTab === 'outgoing' ? 'rgba(59, 130, 246,0.12)' : 'rgba(100,116,139,0.12)',
                    color: activeTab === 'outgoing' ? 'var(--tamamhealth-blue)' : 'var(--text-muted)',
                  }}
                >
                  {outgoingReferrals.length}
                </span>
              </span>
            </button>
          </div>

          {/* Search */}
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder={t('referrals.searchPlaceholder')} />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'sent', label: getStatusLabel('sent') },
                { value: 'received', label: getStatusLabel('received') },
                { value: 'seen', label: getStatusLabel('seen') },
                { value: 'completed', label: getStatusLabel('completed') },
                { value: 'cancelled', label: getStatusLabel('cancelled') },
              ]}
              aria-label="Filter by status"
            />
          </FilterBar>

          {/* Referrals List */}
          <div className="space-y-3">
            {filteredReferrals.length === 0 ? (
              <div className="card-elevated">
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
              filteredReferrals.map(ref => {
                const isExpanded = expandedReferral === ref._id;
                const tp = ref.transferPackage as TransferPackage | undefined;
                const refAtts = ref.referralAttachments as Attachment[] | undefined;
                return (
                  <div key={ref._id} className="card-elevated overflow-hidden">
                    {/* Referral row */}
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); if (ref.patientId) router.push(`/patients/${ref.patientId}`); }}>
                            <PatientName name={ref.patientName} size={36} />
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{ref.patientId}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <div className="icon-box-sm" style={{ background: 'rgba(13,148,136,0.12)' }}>
                            <Building2 className="w-3.5 h-3.5" style={{ color: '#1E3A8A' }} />
                          </div>
                          {ref.fromHospital} → {ref.toHospital}
                          <span>&middot;</span>
                          <span>{ref.department}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge urgency-${ref.urgency} text-[11px]`}>
                          {ref.urgency === 'emergency' && <AlertTriangle className="w-3 h-3" />}
                          {t(`referrals.urgency_${ref.urgency}`)}
                        </span>
                        <span className={`badge ${getStatusClass(ref.status)} text-[11px]`}>
                          {getStatusLabel(ref.status)}
                        </span>
                        {tp && (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: 'var(--accent-light)', color: 'var(--tamamhealth-blue)', border: '1px solid var(--accent-border)' }}>
                            <Package className="w-3 h-3" /> {t('referrals.dataPackage')}
                          </span>
                        )}
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{ref.referralDate}</span>
                        <button
                          onClick={() => setExpandedReferral(isExpanded ? null : ref._id)}
                          className="btn btn-secondary btn-sm"
                          title={t('referrals.viewDetails')}
                          style={{ padding: '5px 10px' }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {canManageReferrals && activeTab === 'incoming' && (ref.status === 'sent' || ref.status === 'received') && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              title={t('referrals.acceptTitle')}
                              style={{ padding: '5px 10px' }}
                              onClick={async () => {
                                try {
                                  await accept(ref._id);
                                  showToast(t('referrals.toastAccepted', { name: ref.patientName }), 'success');
                                } catch {
                                  showToast(t('referrals.toastAcceptFailed'), 'error');
                                }
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t('referrals.accept')}
                            </button>
                            <button
                              className="btn btn-sm"
                              title={t('referrals.declineTitle')}
                              style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.25)' }}
                              onClick={() => { setDeclineModalId(ref._id); setDeclineReason(''); }}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {t('referrals.decline')}
                            </button>
                          </>
                        )}
                        {canManageReferrals && activeTab === 'incoming' && ref.status === 'seen' && (
                          <button
                            className="btn btn-sm"
                            title={t('referrals.markCompleteTitle')}
                            style={{ padding: '5px 10px', background: 'rgba(34,197,94,0.12)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.25)' }}
                            onClick={() => { setCompleteModalId(ref._id); setCompleteOutcome(''); }}
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            {t('referrals.markComplete')}
                          </button>
                        )}
                        {canManageReferrals && ref.status !== 'cancelled' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            title={t('referrals.addNoteTitle')}
                            style={{ padding: '5px 10px' }}
                            onClick={(e) => { e.stopPropagation(); setNoteModalId(ref._id); setNoteText(''); }}
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                            {t('action.addNote')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded View: Transfer Package */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                        {ref.outcome && (
                          <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <ClipboardCheck className="w-4 h-4" style={{ color: '#16A34A' }} />
                              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#16A34A' }}>{t('referrals.outcomeReceived')}</p>
                              <span className="badge ref-completed text-[10px]">{t(`referrals.disposition_${ref.outcome.disposition}`)}</span>
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
                              <div className="icon-box-sm" style={{ background: 'rgba(239,68,68,0.12)' }}>
                                <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                              </div>
                              {t('referrals.noDataPackage')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

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
      </main>
    </>
  );
}
