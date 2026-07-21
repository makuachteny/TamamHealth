'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { formatClockTime } from '@/lib/format-utils';
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
import { getDefaultDashboard } from '@/lib/permissions';
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

  // "Open" = submitted but not yet resolved — excludes completed/cancelled
  // referrals, which don't need any more action from the referring clinician.
  const OPEN_REFERRAL_STATUSES = new Set(['sent', 'received', 'seen']);
  const myOpenReferrals = (referrals || [])
    .filter(r => r.createdBy === currentUser._id && OPEN_REFERRAL_STATUSES.has(r.status));
  const referralEntries = myOpenReferrals.map(r => ({
    id: r._id,
    title: r.patientName,
    subtitle: `${r.reason || 'Referral'} → ${r.toHospital || 'receiving facility'}`,
    meta: r.status ? String(r.status).replace(/_/g, ' ') : '',
    href: '/referrals',
  }));

  // Today's telehealth visits for this clinician — each row opens the visit room.
  const todayIso = new Date().toISOString().slice(0, 10);
  const telehealthToday = myUpcomingAppts.filter(a => a.appointmentType === 'telehealth' && a.appointmentDate === todayIso);
  const telehealthEntries = telehealthToday.map(a => ({
    id: a._id,
    title: a.patientName,
    subtitle: `Telehealth · ${formatClockTime(a.appointmentTime)}${a.reason ? ` · ${a.reason}` : ''}`,
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
    { label: 'Open referrals', count: myOpenReferrals.length, href: '/referrals', entries: referralEntries },
    { label: 'Awaiting labs', count: resumableEncounters.length, tone: resumableEncounters.length > 0 ? 'danger' as const : 'neutral' as const, href: '/lab', entries: labEntries },
    { label: 'Telehealth visits', count: telehealthToday.length, tone: telehealthToday.length > 0 ? 'warning' as const : 'neutral' as const, href: '/appointments', entries: telehealthEntries },
  ];

  return (
    <main className="page-container page-enter">
      <EhrClinicalDashboard
        clinicianName={currentUser.name || 'clinician'}
        facilityName={currentUser.hospitalName}
        patients={assignedRows}
        appointments={myUpcomingAppts}
        outstanding={outstandingItems}
        onUpdateAppointmentStatus={updateApptStatus}
      />
    </main>
  );
}
