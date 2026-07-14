'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import EhrClinicalDashboard from '@/components/ehr/EhrClinicalDashboard';
import { usePatients } from '@/lib/hooks/usePatients';
import { useResumableEncounters } from '@/lib/hooks/useResumableEncounters';
import { useSigningInbox } from '@/lib/hooks/useSigningInbox';
import { usePhoneNotesInbox } from '@/lib/hooks/usePhoneNotesInbox';
import { useTriage } from '@/lib/hooks/useTriage';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { patientFullName, patientAge } from '@/lib/patient-utils';
import { getDefaultDashboard, getRoleConfig } from '@/lib/permissions';
import SuperintendentDashboard from '@/components/dashboards/SuperintendentDashboard';

const DEPARTMENTS = ['OPD', 'Emergency', 'Maternity', 'Pediatrics', 'Surgery', 'Lab', 'Pharmacy', 'ICU'];

// In production we suppress fabricated demo values (e.g. sampled ward/division
// labels) so users never see invented data. Set NEXT_PUBLIC_DEMO_MODE=false on
// real deploys and these collapse to blank.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { patients } = usePatients();
  // Consultations this clinician paused while waiting on lab/imaging results.
  const { encounters: resumableEncounters } = useResumableEncounters();
  // Documents awaiting signature / co-signature — the "to sign" inbox.
  const { unsignedDrafts, awaitingCosign, heldAssessments } = useSigningInbox();
  // Open patient phone notes routed to me — callbacks worklist.
  const { notes: phoneNotesInbox } = usePhoneNotesInbox();
  // Referrals — drives the "My Referrals" / "Open referrals" outstanding item.
  const { referrals } = useReferrals();
  // Appointments — drives the schedule board + check-in action.
  const { appointments, updateStatus: updateApptStatus } = useAppointments();
  const { triages } = useTriage();

  // Resolve a patient display name for the signing inbox from the loaded roster.
  const signingPatientName = useCallback(
    (patientId: string): string => {
      const p = patients.find((pt) => pt._id === patientId);
      return p ? patientFullName(p) : patientId;
    },
    [patients],
  );

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

  // Patients a nurse has assigned to this clinician for care.
  const myAssigned = useMemo(
    () => patients
      .filter(p => p.assignedDoctor && p.assignedDoctor === currentUser?._id)
      .sort((a, b) => (b.assignedAt ?? '').localeCompare(a.assignedAt ?? '')),
    [patients, currentUser?._id],
  );

  // `/dashboard` is shared. Doctors / clinical officers / clinicians get the
  // clinical view; the medical superintendent gets its own admin view (rendered
  // below). Its defaultDashboard IS `/dashboard`, so it must be excluded from
  // the redirect or it would bounce to itself. Every other role is sent home.
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

  if (!currentUser) return null;
  // Medical superintendent → admin-oriented hospital dashboard.
  if (currentUser.role === 'medical_superintendent') return <SuperintendentDashboard />;
  // Anyone who isn't a doctor / clinical officer / clinician is mid-redirect.
  if (currentUser.role !== 'doctor' && currentUser.role !== 'clinical_officer' && currentUser.role !== 'clinician') return null;
  const legacyCurrentUser = currentUser as NonNullable<typeof currentUser>;

  // Worklist rows: patients assigned to the signed-in clinician. Ward/division
  // are sampled in demo mode for visual richness and left blank in production.
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

  // Total documents awaiting the clinician's signature.
  const signCount = unsignedDrafts.length + awaitingCosign.length + heldAssessments.length;
  const myReferralsCount = (referrals || []).filter(r => r.createdBy === currentUser._id).length;

  // Upcoming appointments for this clinician (drives the schedule board).
  const apptKey = (a: { appointmentDate: string; appointmentTime?: string }) => `${a.appointmentDate}T${a.appointmentTime || '00:00'}`;
  const myUpcomingAppts = (appointments || [])
    .filter(a => a.providerId === currentUser._id && a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show')
    .sort((x, y) => apptKey(x).localeCompare(apptKey(y)));

  // Per-item worklists behind the outstanding counts.
  const shortDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

  const documentEntries = [
    ...unsignedDrafts.map(r => ({
      id: r._id,
      title: signingPatientName(r.patientId),
      subtitle: 'Draft consult note — needs signature',
      meta: shortDate(r.visitDate || r.createdAt),
      tone: 'warning' as const,
      href: `/patients/${r.patientId}`,
    })),
    ...awaitingCosign.map(r => ({
      id: r._id,
      title: signingPatientName(r.patientId),
      subtitle: 'Trainee note — awaiting co-signature',
      meta: shortDate(r.visitDate || r.createdAt),
      tone: 'warning' as const,
      href: `/patients/${r.patientId}`,
    })),
    ...heldAssessments.map(a => ({
      id: a._id,
      title: signingPatientName(a.patientId),
      subtitle: 'Outcome assessment — review & sign',
      meta: shortDate(a.createdAt),
      href: `/patients/${a.patientId}`,
    })),
  ];

  const phoneNoteEntries = phoneNotesInbox.map(n => ({
    id: n._id,
    title: n.patientName || n.callerName || 'Phone note',
    subtitle: n.subject || n.message,
    meta: shortDate(n.createdAt),
    tone: 'warning' as const,
    href: '/messages',
  }));

  const referralEntries = (referrals || [])
    .filter(r => r.createdBy === currentUser._id)
    .map(r => ({
      id: r._id,
      title: r.patientName,
      subtitle: `${r.reason || 'Referral'} → ${r.toHospital || 'receiving facility'}`,
      meta: r.status ? String(r.status).replace(/_/g, ' ') : '',
      href: '/referrals',
    }));

  const intakeEntries = assignedRows.slice(0, 4).map(r => ({
    id: r._id,
    title: r.name,
    subtitle: [r.id, r.ward].filter(Boolean).join(' · ') || 'Intake review pending',
    href: '/patient-intake',
  }));

  // Today's telehealth visits for this clinician — each row opens the visit room.
  const todayIso = new Date().toISOString().slice(0, 10);
  const telehealthToday = myUpcomingAppts.filter(a => a.appointmentType === 'telehealth' && a.appointmentDate === todayIso);
  const telehealthEntries = telehealthToday.map(a => ({
    id: a._id,
    title: a.patientName,
    subtitle: `Telehealth · ${a.appointmentTime}${a.reason ? ` · ${a.reason}` : ''}`,
    meta: a.status ? String(a.status).replace(/_/g, ' ') : '',
    tone: 'warning' as const,
    href: `/telehealth/visit/${encodeURIComponent(a._id)}`,
  }));

  const labEntries = resumableEncounters.map(e => ({
    id: e._id,
    title: e.patientName,
    subtitle: e.allResultsBack
      ? 'All results back — resume the visit'
      : `${e.resultsReady} of ${e.resultsTotal} results back`,
    meta: shortDate(e.createdAt),
    tone: e.allResultsBack ? ('danger' as const) : ('neutral' as const),
    href: e.allResultsBack ? `/consultation?encounter=${e._id}` : '/lab',
  }));

  const outstandingItems = [
    { label: 'Documents to sign', count: signCount, tone: signCount > 0 ? 'warning' as const : 'neutral' as const, href: '/consultation', entries: documentEntries },
    { label: 'Phone notes', count: phoneNotesInbox.length, tone: phoneNotesInbox.length > 0 ? 'warning' as const : 'neutral' as const, href: '/messages', entries: phoneNoteEntries },
    { label: 'Open referrals', count: myReferralsCount, href: '/referrals', entries: referralEntries },
    { label: 'Patient intake', count: Math.max(0, assignedRows.length ? Math.min(assignedRows.length, 4) : 0), href: '/patient-intake', entries: intakeEntries },
    { label: 'Awaiting labs', count: resumableEncounters.length, tone: resumableEncounters.length > 0 ? 'danger' as const : 'neutral' as const, href: '/lab', entries: labEntries },
    { label: 'Telehealth visits', count: telehealthToday.length, tone: telehealthToday.length > 0 ? 'warning' as const : 'neutral' as const, href: '/appointments', entries: telehealthEntries },
  ];
  const canAccessBilling = !!getRoleConfig(currentUser.role)?.allowedRoutes.includes('/payments');

  return (
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
