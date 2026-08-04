'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePatients } from '@/lib/hooks/usePatients';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { useTriage } from '@/lib/hooks/useTriage';
import type { AppointmentDoc, AppointmentStatus, EncounterDoc, PatientDoc, TriageDoc } from '@/lib/db-types';
import {
  APPOINTMENT_STATUS_OPTIONS, APPOINTMENT_STATUS_TONES, APPOINTMENT_CHECKED_IN_STATUSES,
  APPOINTMENT_PENDING_STATUSES, appointmentStatusLabel,
} from '@/lib/appointment-status';
import { formatCompactDateTime, formatMoney, formatClockTime } from '@/lib/format-utils';
import { patientRegisteredAt, patientFullName, patientGenderAge, patientAgeLabel } from '@/lib/patient-utils';
import { priorityColor } from '@/lib/clinical/triage-display';
import { buildQueueFromTriage, STAGE_LABELS, type QueueStage } from '@/lib/services/patient-queue-service';
import { waitLabel } from '@/components/ehr/EhrVisitPopup';
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import Modal from '@/components/Modal';
import PatientCheckInForm from '@/components/check-in/PatientCheckInForm';
import { PatientRegistrationForm } from '@/app/(dashboard)/patients/new/page';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { getRoleConfig } from '@/lib/permissions';
import EhrCareDashboard, { type EhrCareDashboardAction, type EhrCareDashboardMetric, type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import {
  Calendar, CalendarClock, ClipboardCheck, ArrowRightLeft,
  UserPlus, ClipboardList,
  MapPin, LogIn, LogOut, Wallet, CheckCircle, X, Maximize2,
  Send, Stethoscope, FileText, Ban, RotateCcw, type LucideIcon,
} from '@/components/icons/lucide';
import { formatPhoneDisplay } from '@/lib/field-formats';

/**
 * Front-desk operations workspace.
 *
 * Shows the live queue, today's appointments, and registry snapshots in one
 * view so reception can move patients without jumping between screens.
 */

// Exam rooms / bays a walk-in patient can be placed in to meet the provider.
// Fallback used only when facility settings provide no rooms.
const ROOM_OPTIONS = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Bay A', 'Bay B', 'Bay C', 'Bay D'];

// Half-hour clinic slots (07:00–18:30) offered when reception reschedules.
const RESCHEDULE_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = 7 + Math.floor(i / 2);
  return `${String(hour).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
});

const COMPLAINT_DEPARTMENT_MAP: Record<string, string> = {
  fever: 'General Medicine', malaria: 'General Medicine', cough: 'General Medicine',
  headache: 'General Medicine', pregnancy: 'Maternity', anc: 'Maternity',
  antenatal: 'Maternity', injury: 'Emergency', wound: 'Emergency',
  fracture: 'Emergency', accident: 'Emergency', child: 'Pediatrics',
  pediatric: 'Pediatrics', infant: 'Pediatrics', eye: 'Ophthalmology',
  vision: 'Ophthalmology', dental: 'Dental', tooth: 'Dental',
  skin: 'Dermatology', rash: 'Dermatology',
};

function suggestDepartment(complaint: string): string {
  const lower = complaint.toLowerCase();
  for (const [keyword, dept] of Object.entries(COMPLAINT_DEPARTMENT_MAP)) {
    if (lower.includes(keyword)) return dept;
  }
  return 'General Medicine';
}

// Split a timestamp into separate date / time pieces so the queue can show them
// in their own columns. Date-only values (e.g. "YYYY-MM-DD") yield an empty time.
function splitDateTime(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '—', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = /T\d{2}:\d{2}/.test(iso) ? formatClockTime(d) : '';
  return { date, time };
}

// Combine an appointment's day with its "HH:MM" slot into one real moment, so
// the schedule row can count down to it ("in 2h 15m"). Parsed without a zone
// suffix on purpose: appointment slots are wall-clock times at the facility,
// which is how the rest of the client reads "today".
function appointmentMoment(appointmentDate?: string | null, appointmentTime?: string | null): string | undefined {
  const slot = (appointmentTime || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!slot) return undefined;
  const day = isoDateKey(appointmentDate);
  const at = new Date(`${day}T${slot[1].padStart(2, '0')}:${slot[2]}:00`);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}

function formatDayMonthYear(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isoDateKey(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

// Final-checkout target: closing out a completed visit at the front desk.
interface CheckoutTarget {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  encounterId?: string;
  /** Set when the queue entry came from an appointment. */
  appointmentId?: string;
  /** Set when the queue entry came from triage (walk-in). */
  triageId?: string;
}

function patientFacilityName(patient: PatientDoc | undefined, fallback = 'Facility'): string {
  return (patient as (PatientDoc & { registrationHospitalName?: string }) | undefined)?.registrationHospitalName || fallback;
}

export default function FrontDeskDashboardPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { canConsult, canManageAppointmentSchedule, canCheckInAppointments } = usePermissions();
  // Reception schedules and checks in; a role that can do neither may look at
  // the ladder but not move a booking along it.
  const canSetAppointmentStatus = canManageAppointmentSchedule || canCheckInAppointments;
  const { patients } = usePatients();
  const { appointments, updateStatus: updateAppointmentStatus, reschedule: rescheduleAppointment } = useAppointments();
  const { triages, update: updateTriage } = useTriage();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { rooms } = useSettings();
  // Reactive room list from facility settings; fall back to the static list.
  const roomOptions = rooms.length ? rooms : ROOM_OPTIONS;

  const [queueFilter, setQueueFilter] = useState<'all' | 'walk-in' | 'appointment'>('all');
  const [panelView, setPanelView] = useState<'all' | 'appointments' | 'pending' | 'queue' | 'registered'>('all');
  const queueSort: 'priority' | 'name' | 'time' | 'status' = 'priority';
  const [queueSearch, setQueueSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<AppointmentDoc | null>(null);
  // Reception can move an appointment to a new slot or mark it a no-show from
  // the row itself — both are front-desk calls that shouldn't need the
  // full appointments page.
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDoc | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [reschedSaving, setReschedSaving] = useState(false);
  const [noShowTarget, setNoShowTarget] = useState<AppointmentDoc | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [encounters, setEncounters] = useState<EncounterDoc[]>([]);

  const [queueNowMs, setQueueNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setQueueNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    let changes: { cancel: () => void } | null = null;
    const load = async () => {
      try {
        const { getAllEncounters } = await import('@/lib/services/encounter-service');
        const rows = await getAllEncounters({
          orgId: currentUser.orgId,
          hospitalId: currentUser.hospitalId || currentUser.hospital?._id,
          role: currentUser.role,
        });
        if (!cancelled) setEncounters(rows);
      } catch (err) {
        console.warn('Failed to load front-desk encounter queue', err);
      }
    };
    load();
    import('@/lib/db').then(({ encountersDB }) => {
      if (cancelled) return;
      changes = encountersDB().changes({ since: 'now', live: true, include_docs: false })
        .on('change', load)
        .on('error', err => console.warn('Encounter queue subscription failed', err));
    }).catch(() => {});
    return () => {
      cancelled = true;
      try { changes?.cancel(); } catch { /* noop */ }
    };
  }, [currentUser, currentUser?.hospital?._id, currentUser?.hospitalId, currentUser?.orgId, currentUser?.role]);

  // ── Real today's appointments ──
  const todaysAppointments = useMemo(() =>
    appointments
      .filter(a => a.appointmentDate === today && a.status !== 'cancelled')
      // appointmentTime can be missing on seeded/synced rows — guard before sort
      .sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || '')),
    [appointments, today]
  );

  // ── Real today's triages (pending/seen = still in queue) ──
  const todaysTriages = useMemo(() =>
    triages
      .filter(t => (t.triagedAt || '').startsWith(today))
      .sort((a, b) => {
        const pOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
        return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
      }),
    [triages, today]
  );


  // ── Unified queue: triaged walk-ins + appointments + recent registrations ──
  interface QueueItem {
    id: string;
    patientId: string;
    patientName: string;
    type: 'walk-in' | 'appointment' | 'registered';
    priority: 'RED' | 'YELLOW' | 'GREEN' | 'normal';
    complaint: string;
    department: string;
    gender: string;
    age: string;
    date: string;
    time: string;
    /** Full timestamp behind `time` — drives the row's "in 2h 15m" countdown. */
    timeAt?: string;
    calendarDate: string;
    status: 'WAITING' | 'IN CONSULT' | 'DONE';
    /** Raw stage code from patient-queue-service (triage-sourced entries only) —
     *  drives the Context column via STAGE_LABELS, the same vocabulary the
     *  doctor's Queue column uses for this patient. */
    stage?: QueueStage;
    /** Stage-based label from patient-queue-service (triage-sourced entries only). */
    stageLabel?: string;
    waitMinutes?: number;
    overTarget?: boolean;
    /** Ordering weight — the service's acuity+wait score for triage-sourced
     *  entries, an equivalent estimate for the rest. Higher sorts first. */
    score: number;
    sourceId: string; // triage / appointment / patient ID
    encounterId?: string;
    assignedRoom?: string; // OPD exam room/bay (walk-in/triage entries only)
    assignedDoctorName?: string;
    assignedNurseName?: string;
    location?: string;
  }

  const queue = useMemo(() => {
    const items: QueueItem[] = [];
    // Look up gender/age per queue entry from the patient record (all entry
    // types carry a patientId), so Gender and Age render in their own columns.
    const patientById = new Map(patients.map(p => [p._id, p]));
    const genderOf = (pid: string) => patientById.get(pid)?.gender || '—';
    const ageOf = (pid: string) => { const p = patientById.get(pid); return p ? patientAgeLabel(p) : '—'; };
    const doctorOf = (pid: string) => patientById.get(pid)?.assignedDoctorName || '';
    const nurseOf = (pid: string) => patientById.get(pid)?.assignedByName || '';
    const locationOf = (pid: string, fallback?: string) => {
      const p = patientById.get(pid);
      return fallback || patientFacilityName(p, currentUser?.hospitalName || 'Facility');
    };
    const checkoutStatuses = new Set<EncounterDoc['status']>([
      'ready_for_clinic_checkout',
      'in_clinic_checkout',
      'clinic_complete_awaiting_next_station',
      'awaiting_facility_checkout',
      'in_facility_checkout',
    ]);
    const checkoutEncounterByPatient = new Map<string, EncounterDoc>();
    for (const enc of encounters) {
      if (!checkoutStatuses.has(enc.status)) continue;
      const dateKey = isoDateKey(enc.updatedAt || enc.closedAt || enc.startedAt || enc.createdAt);
      if (dateKey !== today) continue;
      const current = checkoutEncounterByPatient.get(enc.patientId);
      if (!current || (enc.updatedAt || enc.createdAt || '').localeCompare(current.updatedAt || current.createdAt || '') > 0) {
        checkoutEncounterByPatient.set(enc.patientId, enc);
      }
    }

    // Active triage per patient, driving the stage-based live queue — same
    // 24h cutoff + newest-per-patient dedupe as the clinical dashboard's
    // queue (older triage docs are unclosed visits, not still-waiting
    // patients).
    const activeTriageByPatient = new Map<string, TriageDoc>();
    const triageCutoff = queueNowMs - 24 * 60 * 60 * 1000;
    for (const doc of triages) {
      if (new Date(doc.triagedAt).getTime() < triageCutoff) continue;
      const held = activeTriageByPatient.get(doc.patientId);
      if (!held || doc.triagedAt > held.triagedAt) activeTriageByPatient.set(doc.patientId, doc);
    }

    // Add triaged patients (walk-ins and triaged appointments) via the
    // shared queue-stage service — no lab/pharmacy args since this page
    // doesn't load prescriptions or lab results.
    const stageEntries = buildQueueFromTriage([...activeTriageByPatient.values()]);
    for (const entry of stageEntries) {
      const triageDoc = activeTriageByPatient.get(entry.patientId);
      const checkoutEncounter = checkoutEncounterByPatient.get(entry.patientId);
      const isCheckout = Boolean(checkoutEncounter);
      const room = triageDoc?.assignedRoom;
      // A clinician has taken the patient when the triage records a handoff
      // (entry.assignedToId) or was marked seen — the same "in service"
      // signal the doctor/nurse boards derive from this engine, so reception
      // can tell who is actually with a clinician vs still queued.
      const inConsult = Boolean(entry.assignedToId) || triageDoc?.status === 'seen';
      items.push({
        id: `triage-${entry.triageId}`,
        patientId: entry.patientId,
        patientName: entry.patientName,
        type: 'walk-in',
        priority: entry.acuity,
        complaint: entry.chiefComplaint || 'ETAT Assessment',
        department: entry.chiefComplaint ? suggestDepartment(entry.chiefComplaint) : 'Triage',
        gender: genderOf(entry.patientId),
        age: ageOf(entry.patientId),
        ...splitDateTime(entry.enteredStageAt),
        timeAt: entry.enteredStageAt,
        calendarDate: isoDateKey(entry.enteredStageAt),
        status: isCheckout ? 'DONE' : inConsult ? 'IN CONSULT' : 'WAITING',
        stage: entry.stage,
        stageLabel: isCheckout ? 'Ready for checkout' : STAGE_LABELS[entry.stage],
        waitMinutes: entry.minutesWaiting,
        overTarget: entry.flaggedForReassessment,
        score: entry.score,
        sourceId: entry.triageId,
        encounterId: checkoutEncounter?._id,
        assignedRoom: room,
        assignedDoctorName: doctorOf(entry.patientId),
        assignedNurseName: nurseOf(entry.patientId),
        location: locationOf(entry.patientId, room || (entry.chiefComplaint ? suggestDepartment(entry.chiefComplaint) : 'Triage')),
      });
    }

    // Appointments only join the queue once the desk has CHECKED THEM IN.
    // Scheduled/reminded/confirmed appointments — and ones merely marked
    // `arrived`, where the patient is in the waiting room but the desk has not
    // opened the visit — stay in the Today's Appointments card until the
    // receptionist checks them in via the check-in popup.
    const ARRIVED = new Set<AppointmentDoc['status']>(APPOINTMENT_CHECKED_IN_STATUSES);
    const triagedPatientIds = new Set(activeTriageByPatient.keys());
    const APPT_SCORE: Record<string, number> = { emergency: 3, urgent: 2 };
    for (const a of todaysAppointments) {
      if (triagedPatientIds.has(a.patientId)) continue;
      if (!ARRIVED.has(a.status)) continue; // not checked in yet → not in the queue
      const checkoutEncounter = checkoutEncounterByPatient.get(a.patientId);
      const status = checkoutEncounter ? 'DONE' :
                     a.status === 'completed' ? 'DONE' :
                     a.status === 'in_progress' ? 'IN CONSULT' : 'WAITING';
      items.push({
        id: `appt-${a._id}`,
        patientId: a.patientId,
        patientName: a.patientName,
        type: 'appointment',
        priority: a.priority === 'emergency' ? 'RED' : a.priority === 'urgent' ? 'YELLOW' : 'normal',
        complaint: a.reason || 'Scheduled visit',
        department: a.department || 'OPD',
        gender: genderOf(a.patientId),
        age: ageOf(a.patientId),
        date: splitDateTime(a.appointmentDate).date,
        time: formatClockTime(a.appointmentTime),
        timeAt: appointmentMoment(a.appointmentDate, a.appointmentTime),
        calendarDate: isoDateKey(a.appointmentDate),
        status,
        score: APPT_SCORE[a.priority ?? ''] ?? 1,
        sourceId: a._id,
        encounterId: checkoutEncounter?._id,
        assignedDoctorName: a.providerName || doctorOf(a.patientId),
        assignedNurseName: nurseOf(a.patientId),
        location: a.department || a.facilityName || locationOf(a.patientId),
      });
    }

    const queuedPatientIds = new Set(items.map(it => it.patientId));
    for (const enc of checkoutEncounterByPatient.values()) {
      if (queuedPatientIds.has(enc.patientId)) continue;
      const patient = patientById.get(enc.patientId);
      items.push({
        id: `encounter-${enc._id}`,
        patientId: enc.patientId,
        patientName: enc.patientName || (patient ? patientFullName(patient) : 'Patient'),
        type: 'walk-in',
        priority: 'normal',
        complaint: String(enc.snapshot?.chiefComplaint || 'Clinical checkout'),
        department: 'Checkout',
        gender: genderOf(enc.patientId),
        age: ageOf(enc.patientId),
        ...splitDateTime(enc.updatedAt || enc.closedAt || enc.startedAt),
        timeAt: enc.updatedAt || enc.closedAt || enc.startedAt,
        calendarDate: isoDateKey(enc.updatedAt || enc.closedAt || enc.startedAt),
        status: 'DONE',
        score: 0,
        sourceId: enc._id,
        encounterId: enc._id,
        assignedDoctorName: doctorOf(enc.patientId),
        assignedNurseName: nurseOf(enc.patientId),
        location: 'Checkout',
      });
      queuedPatientIds.add(enc.patientId);
    }

    // Order by the queue-stage service's acuity+wait score (desc) — highest
    // priority, longest-waiting patients surface first. Same-score rows keep
    // a stable time-based tiebreak.
    items.sort((a, b) => (b.score - a.score) || (a.time || '').localeCompare(b.time || ''));

    return items;
  }, [currentUser?.hospitalName, encounters, patients, queueNowMs, today, todaysAppointments, triages]);

  const filteredQueue = useMemo(() => {
    let items = queueFilter === 'all' ? queue : queue.filter(q => q.type === queueFilter);

    const q = queueSearch.trim().toLowerCase();
    if (q) {
      items = items.filter(it =>
        it.patientName.toLowerCase().includes(q) ||
        it.complaint.toLowerCase().includes(q) ||
        it.department.toLowerCase().includes(q)
      );
    }

    if (queueSort !== 'priority') {
      const statusOrder: Record<string, number> = { 'WAITING': 0, 'IN CONSULT': 1, 'DONE': 2, 'ADMITTED': 3, 'REFERRED': 4 };
      items = [...items].sort((a, b) => {
        if (queueSort === 'name') return (a.patientName || '').localeCompare(b.patientName || '');
        if (queueSort === 'time') return (a.time || '').localeCompare(b.time || '');
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      });
    }

    return items;
  }, [queue, queueFilter, queueSearch, queueSort]);

  const filteredRegisteredPatients = useMemo(() => {
    const sorted = [...patients].sort((a, b) =>
      patientRegisteredAt(b).localeCompare(patientRegisteredAt(a)));
    const q = queueSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(patient => {
      const name = patientFullName(patient).toLowerCase();
      const phone = (patient.phone || '').toLowerCase();
      const hospitalNumber = (patient.hospitalNumber || '').toLowerCase();
      const location = [patient.county, patient.state].filter(Boolean).join(' ').toLowerCase();
      return name.includes(q) || phone.includes(q) || hospitalNumber.includes(q) || location.includes(q);
    });
  }, [patients, queueSearch]);

  // ── Room assignment (OPD rooming) for triage-sourced queue entries ──
  // The saving flag now lives on RoomAssignmentControl itself (one control
  // mounts per expanded row), so this just does the write + toast.
  const handleSaveRoom = useCallback(async (triageId: string, room: string) => {
    try {
      await updateTriage(triageId, { assignedRoom: room || undefined });
      showToast(room ? `Room set to ${room}` : 'Room cleared', 'success');
      // Only assigning a room (not clearing one) counts as "roomed a walk-in".
    } catch {
      showToast('Failed to set room', 'error');
    }
  }, [updateTriage, showToast]);

  // ── Final checkout: close out a completed visit ──
  // Stage 10 — Facility checkout gate (KAN-96). The gate decision comes from
  // evaluateCheckoutGate against LIVE data — never from a hand-asserted key
  // list, which is exactly the self-satisfying behaviour the ticket removed.
  // Unmet critical conditions BLOCK the discharge; the desk may override only
  // with an explicit reason, which is audited naming the overridden conditions.
  const handleCompleteCheckout = useCallback(async (target: CheckoutTarget, override?: { reason: string }) => {
    try {
      let gateNote = '';
      try {
        const {
          getEncounter, getOpenEncounterForPatient, dischargeEncounter,
        } = await import('@/lib/services/encounter-service');
        const enc = target.encounterId
          ? await getEncounter(target.encounterId)
          : await getOpenEncounterForPatient(target.patientId);
        if (enc) {
          const { evaluateCheckoutGate } = await import('@/lib/services/checkout-gate-service');
          const evaluation = await evaluateCheckoutGate(target.patientId, enc as never);

          if (!evaluation.canDischarge && !override) {
            showToast(
              `Cannot check out — unresolved: ${evaluation.blocking.map(b => b.label).join('; ')}`,
              'error',
            );
            return;
          }
          if (!evaluation.canDischarge && override) {
            const { logAuditSafe } = await import('@/lib/services/audit-service');
            await logAuditSafe(
              'CHECKOUT_GATE_OVERRIDDEN', currentUser?._id, currentUser?.name,
              `Discharged ${target.patientName} over unmet gate conditions ` +
              `[${evaluation.blocking.map(b => b.key).join(', ')}] — ${override.reason}`,
            );
            gateNote = ` — override: ${evaluation.blocking.map(b => b.label).join('; ')}`;
          }
          await dischargeEncounter(enc._id, {
            actorId: currentUser?._id,
            pendingItems: !evaluation.canDischarge,
          });
        }
      } catch (e) {
        console.warn('Encounter discharge during checkout failed', e);
      }

      if (target.appointmentId) {
        await updateAppointmentStatus(target.appointmentId, 'completed');
      } else if (target.triageId) {
        // 'discharged' is the terminal status in the TriageDoc status union.
        await updateTriage(target.triageId, { status: 'discharged' });
      }
      showToast(`${target.patientName} checked out${gateNote}`, 'success');
      setCheckoutTarget(null);
    } catch {
      showToast('Failed to complete checkout', 'error');
    }
  }, [updateAppointmentStatus, updateTriage, showToast, currentUser]);

  // ── Appointment check-in: mark the patient as arrived → joins the queue ──
  // Also creates/joins the visit encounter (arrivalChannel: 'appointment',
  // appointmentId threaded through, attendanceType captured) so this arrival
  // door produces the same visit thread walk-ins get via checkInPatient —
  // see docs/EMR-FIELD-AUDIT-2026-07.md §3. Best-effort: the appointment
  // status flip is what actually gets the patient into the live queue, so an
  // encounter-creation failure doesn't block check-in.
  const handleCheckIn = useCallback(async (appt: AppointmentDoc, attendanceType: 'new' | 'repeat') => {
    await updateAppointmentStatus(appt._id, 'checked_in');
    try {
      const { findOpenEncounterForPatient, createArrivalEncounter } = await import('@/lib/services/encounter-service');
      const existing = await findOpenEncounterForPatient(appt.patientId, currentUser?.hospitalId || '');
      if (!existing) {
        await createArrivalEncounter({
          patientId: appt.patientId,
          patientName: appt.patientName,
          hospitalId: currentUser?.hospitalId || '',
          hospitalName: currentUser?.hospitalName || '',
          orgId: currentUser?.orgId,
          arrivalChannel: 'appointment',
          appointmentId: appt._id,
          attendanceType,
          actorId: currentUser?._id,
        });
      }
    } catch {
      // encounter creation is best-effort; the appointment check-in itself still succeeded
    }
    showToast(`${appt.patientName} checked in — added to queue`, 'success');
    setCheckInTarget(null);
  }, [updateAppointmentStatus, showToast, currentUser]);

  // ── Mark an appointment a no-show. Confirmed first: a mistaken no-show
  //    hides the patient from the arrivals list, so reception gets one beat to
  //    check the waiting room before it lands. ──
  const handleNoShow = useCallback(async (appt: AppointmentDoc) => {
    try {
      await updateAppointmentStatus(appt._id, 'no_show');
      showToast(`${appt.patientName} marked as no-show`, 'success');
    } catch {
      showToast('Failed to mark no-show', 'error');
    } finally {
      setNoShowTarget(null);
    }
  }, [updateAppointmentStatus, showToast]);

  // ── Set any rung on the ladder straight from the row's status dropdown.
  //    Checking in and no-show keep their own buttons: those two do more than
  //    move a status (open the visit thread; confirm before hiding the patient
  //    from arrivals), so the dropdown routes to them rather than writing the
  //    status behind their backs. ──
  const handleAppointmentStatusChange = useCallback(async (appt: AppointmentDoc, status: AppointmentStatus) => {
    if (status === 'checked_in') { setCheckInTarget(appt); return; }
    if (status === 'no_show') { setNoShowTarget(appt); return; }
    // 'rescheduled' is set directly, and means "not happening at this time, to
    // be rebooked" — the Reschedule action beside it moves a booking to a known
    // new slot in place, which leaves it scheduled, not rescheduled.
    try {
      await updateAppointmentStatus(appt._id, status, {
        actorId: currentUser?._id,
        actorName: currentUser?.name || currentUser?.username,
        actorRole: currentUser?.role,
      });
      showToast(`${appt.patientName} — ${appointmentStatusLabel(status).toLowerCase()}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update the appointment status', 'error');
    }
  }, [updateAppointmentStatus, showToast, currentUser]);

  // ── Move an appointment to a new date/time without leaving the desk. ──
  const openReschedule = useCallback((appt: AppointmentDoc) => {
    setRescheduleDate(isoDateKey(appt.appointmentDate));
    setRescheduleTime(appt.appointmentTime || '09:00');
    setRescheduleTarget(appt);
  }, []);

  const submitReschedule = useCallback(async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    setReschedSaving(true);
    try {
      await rescheduleAppointment(rescheduleTarget._id, rescheduleDate, rescheduleTime);
      showToast(`${rescheduleTarget.patientName} moved to ${formatDayMonthYear(rescheduleDate)} ${formatClockTime(rescheduleTime)}`, 'success');
      setRescheduleTarget(null);
    } catch {
      showToast('Failed to reschedule appointment', 'error');
    } finally {
      setReschedSaving(false);
    }
  }, [rescheduleTarget, rescheduleDate, rescheduleTime, rescheduleAppointment, showToast]);

  // ── Reverse an appointment check-in: send the patient back to scheduled so
  //    a mistaken "arrived" can be corrected. Appointment status has no
  //    forward-only guard, so this round-trips cleanly. (Triage check-in has
  //    no equivalent here — see BACKEND GAPS.) ──
  const handleUndoCheckIn = useCallback(async (appt: AppointmentDoc) => {
    try {
      await updateAppointmentStatus(appt._id, 'scheduled');
      showToast(`${appt.patientName} check-in reversed`, 'success');
      setCheckInTarget(null);
    } catch {
      showToast('Failed to reverse check-in', 'error');
    }
  }, [updateAppointmentStatus, showToast]);

  // ── Reverse a completed checkout for an APPOINTMENT-sourced visit: set the
  //    appointment back to checked_in so the patient re-enters the live queue.
  //    Only appointment checkouts are reversible — a triage checkout writes the
  //    terminal `discharged` status (see BACKEND GAPS). ──
  const handleUndoCheckout = useCallback(async (appointmentId: string, patientName: string) => {
    try {
      await updateAppointmentStatus(appointmentId, 'checked_in');
      showToast(`Checkout reversed for ${patientName}`, 'success');
    } catch {
      showToast('Failed to reverse checkout', 'error');
    }
  }, [updateAppointmentStatus, showToast]);

  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;
  const canUseRoute = useCallback((href: string) => {
    if (!roleConfig) return false;
    return roleConfig.allowedRoutes.includes(href);
  }, [roleConfig]);

  const pendingAppointments = useMemo(() => {
    // Every rung that still expects the patient — including the two the desk
    // itself sets, Reminder Sent and Arrived. Hardcoding the old three meant
    // reminding or marking someone arrived dropped their row off this list.
    // `requested` joins them: a portal ask is reception's to answer.
    const pendingStatuses = new Set<AppointmentDoc['status']>(['requested', ...APPOINTMENT_PENDING_STATUSES]);
    const triagedPatientIds = new Set(todaysTriages.map(item => item.patientId));
    return todaysAppointments.filter(appointment => pendingStatuses.has(appointment.status) && !triagedPatientIds.has(appointment.patientId));
  }, [todaysAppointments, todaysTriages]);

  const dateLabel = useMemo(() => (
    new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date())
  ), []);

  const tabs = useMemo(() => ([
    { key: 'all', label: 'All', count: queue.length + pendingAppointments.length },
    { key: 'walk-in', label: 'Walk-ins', count: queue.filter(q => q.type === 'walk-in').length },
    { key: 'appointment', label: 'Appointments', count: queue.filter(q => q.type === 'appointment').length + pendingAppointments.length },
  ]), [queue, pendingAppointments.length]);

  const handleTabChange = useCallback((tab: string) => {
    const next = tab as typeof queueFilter;
    setQueueFilter(next);
    setPanelView(next === 'appointment' ? 'appointments' : next === 'all' ? 'all' : 'queue');
  }, []);

  const openFullRegistration = useCallback(() => {
    setRegisterOpen(false);
    router.push('/patients/new');
  }, [router]);

  const visiblePendingAppointments = useMemo(() => {
    if (queueFilter !== 'all' && queueFilter !== 'appointment') return [];
    const q = queueSearch.trim().toLowerCase();
    const items = q
      ? pendingAppointments.filter(appointment =>
          appointment.patientName.toLowerCase().includes(q) ||
          (appointment.reason || '').toLowerCase().includes(q) ||
          (appointment.department || '').toLowerCase().includes(q)
        )
      : pendingAppointments;
    return items.sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''));
  }, [pendingAppointments, queueFilter, queueSearch]);

  const actions = useMemo<EhrCareDashboardAction[]>(() => ([
    ...(canUseRoute('/check-in') ? [{ label: 'Check in', icon: LogIn, onClick: () => setCheckInOpen(true), tone: 'primary' as const }] : []),
    ...(canUseRoute('/patient-intake') ? [{ label: 'Send intake', icon: Send, onClick: () => router.push('/patient-intake'), tone: 'primary' as const }] : []),
    ...(canUseRoute('/patients') ? [{ label: t('frontDesk.registerNewPatient'), icon: UserPlus, onClick: () => setRegisterOpen(true) }] : []),
  ]), [canUseRoute, router, t]);

  // "View Referrals" / "Appointments" now live as labeled nav links in the top
  // rail (next to the module dropdown), not as shortcuts inside this card.

  // Quick-navigation strip mirroring the Clinical Officer dashboard's clinical
  // strip. Route-guarded so a clinic clerk never sees a shortcut they can't open.
  const actionStrip = useMemo<EhrCareDashboardAction[]>(() => ([
    ...(canUseRoute('/patients') ? [{ label: 'Patient registry', icon: ClipboardList, onClick: () => router.push('/patients') }] : []),
    ...(canUseRoute('/appointments') ? [{ label: 'Appointments', icon: Calendar, onClick: () => router.push('/appointments') }] : []),
    ...(canUseRoute('/referrals') ? [{ label: 'Referrals', icon: ArrowRightLeft, onClick: () => router.push('/referrals') }] : []),
  ]), [canUseRoute, router]);

  const frontDeskRows = useMemo<EhrCareDashboardRow[]>(() => {
    const patientById = new Map(patients.map(patient => [patient._id, patient]));
    const appointmentRows: EhrCareDashboardRow[] = visiblePendingAppointments.map(appointment => {
      const patient = patientById.get(appointment.patientId);
      const patientMeta = patient
        ? `${patientAgeLabel(patient)}${patient.gender ? ` · ${String(patient.gender).charAt(0).toUpperCase()}` : ''}`
        : '';
      return {
        id: `pending-appt-${appointment._id}`,
        photoUrl: (patient as { photoUrl?: string } | undefined)?.photoUrl,
        title: appointment.patientName,
        subtitle: [appointment.reason || 'Scheduled visit', patientMeta].filter(Boolean).join(' · '),
        meta: `${formatClockTime(appointment.appointmentTime) || 'No time'} · ${appointment.providerName || patient?.assignedDoctorName || 'Unassigned'} · ${appointment.facilityName || currentUser?.hospitalName || 'Facility'}`,
        compactMeta: formatClockTime(appointment.appointmentTime) || 'No time',
        time: formatClockTime(appointment.appointmentTime) || undefined,
        timeSecondary: isoDateKey(appointment.appointmentDate),
        timeAt: appointmentMoment(appointment.appointmentDate, appointment.appointmentTime),
        careTeam: appointment.providerName || patient?.assignedDoctorName || 'Doctor unassigned',
        careTeamSecondary: patient?.assignedByName || 'Nurse unassigned',
        careTeamLabel: 'Care team',
        location: appointment.department || appointment.facilityName || patientFacilityName(patient, currentUser?.hospitalName || 'Facility'),
        locationSecondary: appointment.department ? patientFacilityName(patient, currentUser?.hospitalName || 'Facility') : 'Location',
        locationLabel: appointment.department ? 'Department' : 'Location',
        // The pill states the rung the booking is actually on — Reminder Sent
        // and Arrived used to collapse into a flat "Scheduled", which hid the
        // desk's own work from it.
        status: appointment.status,
        statusLabel: appointmentStatusLabel(appointment.status),
        statusSecondary: appointment.priority === 'emergency' ? 'Emergency' : appointment.priority === 'urgent' ? 'Urgent' : 'Appointment',
        statusTone: APPOINTMENT_STATUS_TONES[appointment.status],
        // Only a real acuity gets the RED/YELLOW pill — routine appointments
        // show no priority pill rather than a free-text 'Appointment' label.
        priority: appointment.priority === 'emergency' ? 'RED' : appointment.priority === 'urgent' ? 'YELLOW' : undefined,
        date: isoDateKey(appointment.appointmentDate),
        patientId: appointment.patientId,
        popupDetail: (
          <>
            <FrontDeskDetailActions actions={[
              { icon: LogIn, label: 'Check in', onClick: () => setCheckInTarget(appointment), primary: true },
              { icon: FileText, label: 'Open chart', onClick: () => router.push(`/patients/${appointment.patientId}`) },
              { icon: Calendar, label: 'Reschedule', onClick: () => openReschedule(appointment) },
              { icon: Ban, label: 'No show', onClick: () => setNoShowTarget(appointment) },
            ]} />
            {/* The whole ladder in one control. The buttons above stay: they are
                the two moves the desk makes constantly and each does more than
                set a status (check-in opens a visit, no-show asks for a note).
                This is for every other rung — reminded, confirmed, arrived,
                roomed, checked out, rescheduled. */}
            <AppointmentStatusPicker
              appointment={appointment}
              disabled={!canSetAppointmentStatus}
              onChange={handleAppointmentStatusChange}
            />
            <FrontDeskDetailFacts facts={[
              { label: 'Reason', value: appointment.reason || 'Scheduled visit' },
              { label: t('patient.phone'), value: patient?.phone ? formatPhoneDisplay(patient.phone) : undefined },
              { label: 'Hospital number', value: patient?.hospitalNumber },
            ]} />
          </>
        ),
      };
    });

    const queueRows = filteredQueue.map(entry => {
      const patient = patients.find(pp => pp._id === entry.patientId);
      const activeForCare = entry.status === 'WAITING' || entry.status === 'IN CONSULT';
      const checkoutReady = entry.status === 'DONE';
      const statusTone: EhrCareDashboardRow['statusTone'] = entry.status === 'DONE'
        ? 'done'
        : entry.status === 'IN CONSULT'
          ? 'active'
          : entry.overTarget
            ? 'warning'
            : entry.priority === 'RED'
              ? 'danger'
              : entry.priority === 'YELLOW'
                ? 'warning'
                : 'ready';
      // Triage-sourced rows carry the real acuity code, so they get the same
      // RED/YELLOW/GREEN pill the doctor and nurse see for this patient.
      // Appointment/registration rows have no acuity — the pill falls back
      // to the status label instead (handled by the shared row renderer).
      const acuity = entry.priority === 'RED' || entry.priority === 'YELLOW' || entry.priority === 'GREEN'
        ? entry.priority
        : undefined;
      // Status column: the plain human state, distinct from the stage
      // vocabulary now shown in Context.
      const statusLabel = entry.status === 'DONE'
        ? (entry.stageLabel || 'Done')
        : entry.status === 'IN CONSULT'
          ? 'In consult'
          : 'Waiting';
      // Context column: for triage-sourced rows, the same stage vocabulary
      // (STAGE_LABELS) the doctor's Queue column shows for this patient;
      // arrived-but-untriaged appointments show their department instead;
      // checkout-only rows (no triage/appointment on file today) keep the
      // honest 'Checkout' state already on the entry.
      const context = entry.stage ? STAGE_LABELS[entry.stage]
        : entry.type === 'appointment' ? entry.department
        : entry.location || entry.department;
      const statusContext = entry.priority === 'RED'
        ? 'Critical'
        : entry.priority === 'YELLOW'
          ? 'Urgent'
          : entry.priority === 'GREEN'
            ? 'Routine'
            : entry.stageLabel || context;
      // Wait column: actual queue/slot time on the first line; the shared
      // dashboard row renders hours/minutes underneath from `timeAt`.
      const waitTime = entry.time || entry.date || undefined;

      // Icon actions for the row's inline panel. "Open chart" is always
      // offered; the primary desk action (Checkout/Assign) and the secondary
      // one (Undo/Start consultation) mirror the same state machine the old
      // popup's buttons used — a plain "Record" fallback isn't needed here
      // since Open chart already covers it.
      const popupActions: { icon: LucideIcon; label: string; onClick: () => void; primary?: boolean }[] = [
        { icon: FileText, label: 'Open chart', onClick: () => router.push(`/patients/${entry.patientId}`) },
      ];
      if (checkoutReady) {
        popupActions.push({
          icon: LogOut,
          label: t('frontDesk.checkout'),
          primary: true,
          onClick: () => setCheckoutTarget({
            patientId: entry.patientId,
            patientName: entry.patientName,
            hospitalNumber: patient?.hospitalNumber,
            encounterId: entry.encounterId,
            appointmentId: entry.id.startsWith('appt-') ? entry.sourceId : undefined,
            triageId: entry.id.startsWith('triage-') ? entry.sourceId : undefined,
          }),
        });
      } else if (activeForCare) {
        popupActions.push({
          icon: Stethoscope,
          label: t('frontDesk.assign'),
          primary: true,
          onClick: () => setAssignTarget({
            patientId: entry.patientId,
            patientName: entry.patientName,
            hospitalNumber: patient?.hospitalNumber,
            triageId: entry.id.startsWith('triage-') ? entry.sourceId : undefined,
            currentDoctorId: patient?.assignedDoctor,
          }),
        });
      }
      if (checkoutReady && entry.id.startsWith('appt-')) {
        popupActions.push({ icon: RotateCcw, label: t('action.undo'), onClick: () => handleUndoCheckout(entry.sourceId, entry.patientName) });
      } else if (canConsult && activeForCare) {
        popupActions.push({ icon: Stethoscope, label: t('frontDesk.startConsultation'), onClick: () => router.push(`/consultation?patientId=${entry.patientId}`) });
      }
      const hasAllergies = Boolean(patient?.allergies?.length) && patient?.allergies[0] !== 'None known';

      return {
        id: entry.id,
        photoUrl: (patient as { photoUrl?: string } | undefined)?.photoUrl,
        title: entry.patientName,
        subtitle: `${entry.complaint} · ${entry.department}`,
        meta: `${entry.gender} · ${entry.age}${entry.assignedDoctorName ? ` · ${entry.assignedDoctorName}` : ''}`,
        compactMeta: entry.waitMinutes != null ? waitLabel(entry.waitMinutes) : (entry.time || entry.date),
        time: waitTime,
        timeSecondary: entry.waitMinutes != null ? waitLabel(entry.waitMinutes) : entry.calendarDate,
        timeAt: entry.timeAt,
        status: entry.status.toLowerCase(),
        statusLabel,
        statusSecondary: statusContext,
        statusTone,
        priority: acuity,
        room: entry.assignedRoom,
        careTeam: entry.assignedDoctorName || 'Doctor unassigned',
        careTeamSecondary: entry.assignedNurseName || 'Nurse unassigned',
        careTeamLabel: 'Care team',
        location: context,
        locationSecondary: entry.stage ? entry.department : entry.location || entry.department,
        locationLabel: entry.stage ? 'Stage' : entry.type === 'appointment' ? 'Department' : 'Location',
        date: entry.calendarDate,
        patientId: entry.patientId,
        popupDetail: (
          <>
            <FrontDeskDetailActions actions={popupActions} />
            <FrontDeskDetailFacts facts={[
              { label: t('patient.phone'), value: patient?.phone ? formatPhoneDisplay(patient.phone) : undefined },
              { label: 'Hospital number', value: patient?.hospitalNumber },
            ]} />
            {hasAllergies && (
              <p className="ehr-care-alert">{t('frontDesk.allergiesLabel', { list: (patient?.allergies ?? []).join(', ') })}</p>
            )}
            {entry.id.startsWith('triage-') && (
              <RoomAssignmentControl
                triageId={entry.sourceId}
                currentRoom={entry.assignedRoom}
                priority={entry.priority}
                roomOptions={roomOptions}
                onSave={handleSaveRoom}
              />
            )}
          </>
        ),
      };
    });

    const makeRegisteredRow = (patient: PatientDoc): EhrCareDashboardRow => {
      const registered = splitDateTime(patientRegisteredAt(patient));
      return {
        id: `registered-${patient._id}`,
        photoUrl: (patient as { photoUrl?: string }).photoUrl,
        title: patientFullName(patient),
        subtitle: patient.hospitalNumber || patientGenderAge(patient),
        meta: `${patientGenderAge(patient)} · ${registered.date}${registered.time ? ` · ${registered.time}` : ''}`,
        compactMeta: registered.time || registered.date,
        time: registered.time || undefined,
        timeSecondary: registered.date,
        timeAt: registered.time ? patientRegisteredAt(patient) : undefined,
        careTeam: patient.assignedDoctorName || 'Doctor unassigned',
        careTeamSecondary: patient.assignedByName || 'Nurse unassigned',
        careTeamLabel: 'Care team',
        location: patientFacilityName(patient, currentUser?.hospitalName || 'Registration'),
        locationSecondary: [patient.county, patient.state].filter(Boolean).join(', ') || 'Location',
        locationLabel: 'Location',
        status: 'registered',
        statusLabel: 'Registered',
        statusSecondary: patient.assignmentStatus === 'completed'
          ? 'Visit completed'
          : patient.assignmentStatus === 'accepted' || patient.assignmentStatus === 'in_progress'
            ? 'Provider accepted'
            : patient.assignedDoctor
              ? 'Assigned'
              : 'Needs care team',
        statusTone: 'ready',
        date: isoDateKey(patientRegisteredAt(patient)),
        patientId: patient._id,
        popupDetail: (
          <>
            <FrontDeskDetailActions actions={[
              { icon: FileText, label: 'Open chart', onClick: () => router.push(`/patients/${patient._id}`), primary: true },
              {
                icon: Stethoscope,
                label: patient.assignedDoctor ? t('frontDesk.reassign') : t('frontDesk.assign'),
                onClick: () => setAssignTarget({
                  patientId: patient._id,
                  patientName: patientFullName(patient),
                  hospitalNumber: patient.hospitalNumber,
                  currentDoctorId: patient.assignedDoctor,
                }),
              },
            ]} />
            <FrontDeskDetailFacts facts={[
              { label: t('patient.phone'), value: patient.phone ? formatPhoneDisplay(patient.phone) : undefined },
              { label: 'Assigned doctor', value: patient.assignedDoctorName },
              {
                label: t('frontDesk.lastVisit'),
                value: patient.lastConsultedAt ? formatCompactDateTime(patient.lastConsultedAt) : (patient.lastVisitDate || t('frontDesk.firstVisit')),
              },
            ]} />
          </>
        ),
      };
    };

    const registeredRows: EhrCareDashboardRow[] = filteredRegisteredPatients.map(makeRegisteredRow);

    if (panelView === 'pending') return appointmentRows;
    if (panelView === 'queue') return queueRows;
    if (panelView === 'registered') return registeredRows;
    return [...appointmentRows, ...queueRows];
  }, [
    canConsult,
    currentUser?.hospitalName,
    filteredQueue,
    filteredRegisteredPatients,
    handleSaveRoom,
    handleUndoCheckout,
    patients,
    panelView,
    openReschedule,
    roomOptions,
    router,
    t,
    visiblePendingAppointments,
  ]);

  const metrics = useMemo<EhrCareDashboardMetric[]>(() => ([
    {
      label: "Today's appointments",
      value: todaysAppointments.length,
      active: panelView === 'appointments',
      onClick: () => {
        setQueueFilter('appointment');
        setPanelView('appointments');
      },
    },
    {
      label: 'Pending arrivals',
      value: pendingAppointments.length,
      tone: pendingAppointments.length > 0 ? 'warning' : 'neutral',
      active: panelView === 'pending',
      onClick: () => {
        setQueueFilter('appointment');
        setPanelView('pending');
      },
    },
    {
      label: 'Live queue',
      value: queue.length,
      active: panelView === 'queue',
      onClick: () => {
        setQueueFilter('all');
        setPanelView('queue');
      },
    },
  ]), [panelView, pendingAppointments.length, queue.length, todaysAppointments.length]);

  const centerCopy = useMemo(() => {
    if (panelView === 'appointments') {
      return {
        title: "Today's appointments",
        subtitle: `${frontDeskRows.length} appointment${frontDeskRows.length === 1 ? '' : 's'} scheduled or arrived today`,
        emptyTitle: 'No appointments for this view',
        emptyActionLabel: 'Book appointment',
      };
    }
    if (panelView === 'pending') {
      return {
        title: 'Pending arrivals',
        subtitle: `${frontDeskRows.length} patient${frontDeskRows.length === 1 ? '' : 's'} waiting to check in`,
        emptyTitle: 'No pending arrivals',
        emptyActionLabel: 'Open check-in',
      };
    }
    if (panelView === 'queue') {
      return {
        title: 'Live queue',
        subtitle: `${frontDeskRows.length} patient${frontDeskRows.length === 1 ? '' : 's'} ready for desk action`,
        emptyTitle: t('frontDesk.noPatientsInQueue'),
        emptyActionLabel: 'Register patient',
      };
    }
    if (panelView === 'registered') {
      return {
        title: 'Registered patients',
        subtitle: `${frontDeskRows.length} registered record${frontDeskRows.length === 1 ? '' : 's'}`,
        emptyTitle: 'No registered patients',
        emptyActionLabel: 'Register patient',
      };
    }
    return {
      title: dateLabel,
      subtitle: `${frontDeskRows.length} active item${frontDeskRows.length === 1 ? '' : 's'}`,
      emptyTitle: t('frontDesk.noPatientsInQueue'),
      emptyActionLabel: 'Register patient',
    };
  }, [dateLabel, frontDeskRows.length, panelView, t]);

  if (!currentUser) return null;

  return (
    <>
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <EhrCareDashboard
          title=""
          greetingName={currentUser.name || 'front desk'}
          dateLabel={dateLabel}
          tabs={tabs}
          activeTab={queueFilter}
          onTabChange={handleTabChange}
          searchValue={queueSearch}
          searchPlaceholder="Search patients, reasons, departments"
          onSearchChange={setQueueSearch}
          filters={[]}
          actions={actions}
          actionStrip={actionStrip}
          // Rows now carry `time`; the done→series1 default already matches
          // this queue (checked-out visits are 'done', everything still
          // scheduled/waiting/in consult is not).
          chartSeriesNames={['Active', 'Completed']}
          rows={frontDeskRows}
          metrics={metrics}
          calendarEventDates={appointments.map(appointment => appointment.appointmentDate)}
          metricsTitle="Reception today"
          centerTitle={centerCopy.title}
          centerSubtitle={centerCopy.subtitle}
          missionTitle="Keep the desk moving"
          missionDescription="Show the next action clearly so reception can register, check in, route, and close visits."
          showMissionCard
          // Reception rows already open the patient detail on click, so the
          // per-row pencil is redundant.
          showRowOpenAction={false}
          emptyTitle={centerCopy.emptyTitle}
          emptyActionLabel={centerCopy.emptyActionLabel}
          onEmptyAction={() => {
            if (panelView === 'appointments') {
              router.push('/appointments');
              return;
            }
            if (panelView === 'pending') {
              setCheckInOpen(true);
              return;
            }
            setRegisterOpen(true);
          }}
        />

        {assignTarget && (
          <AssignDoctorModal
            target={assignTarget}
            onClose={() => setAssignTarget(null)}
          />
        )}

        {checkoutTarget && (
          <CheckoutModal
            target={checkoutTarget}
            onClose={() => setCheckoutTarget(null)}
            onComplete={handleCompleteCheckout}
            canCollectPayment={canUseRoute('/payments')}
            onCollectPayment={(pid) => {
              router.push(`/payments?patientId=${pid}`);
            }}
          />
        )}

        {registerOpen && (
          <Modal onClose={() => setRegisterOpen(false)} width={1180} align="center" disableBackdropClose labelledBy="patient-registration-dialog-title">
            <div className="ehr-checkin-dialog ehr-registration-dialog">
              <div className="ehr-checkin-dialog-header">
                <div>
                  <h2 id="patient-registration-dialog-title">Register new patient</h2>
                  <p>Complete the full patient registration without leaving the front desk.</p>
                </div>
                <div className="ehr-registration-dialog-actions">
                  <button type="button" onClick={openFullRegistration} aria-label="Expand patient registration">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => setRegisterOpen(false)} aria-label="Close patient registration">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="ehr-checkin-dialog-body">
                <PatientRegistrationForm
                  embedded
                  onCancel={() => setRegisterOpen(false)}
                  onRegistered={() => {
                    setRegisterOpen(false);
                    setPanelView('registered');
                    router.refresh();
                  }}
                />
              </div>
            </div>
          </Modal>
        )}

        {checkInOpen && (
          <Modal onClose={() => setCheckInOpen(false)} width={760} align="top" labelledBy="patient-check-in-dialog-title">
            <div className="ehr-checkin-dialog">
              <div className="ehr-checkin-dialog-header">
                <div>
                  <h2 id="patient-check-in-dialog-title">Patient check-in</h2>
                  <p>Search the patient, record arrival details, and add them to the live queue.</p>
                </div>
                <button type="button" onClick={() => setCheckInOpen(false)} aria-label="Close check-in form">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="ehr-checkin-dialog-body">
                <PatientCheckInForm
                  mode="modal"
                  onCancel={() => setCheckInOpen(false)}
                  onComplete={() => {
                    setCheckInOpen(false);
                    setQueueFilter('all');
                    setPanelView('queue');
                  }}
                  onRegisterPatient={() => {
                    setCheckInOpen(false);
                    setRegisterOpen(true);
                  }}
                />
              </div>
            </div>
          </Modal>
        )}

        {rescheduleTarget && (
          <Modal onClose={() => !reschedSaving && setRescheduleTarget(null)} width={420} labelledBy="reschedule-dialog-title">
            <div className="card-elevated" style={{ padding: 24, borderRadius: 16, background: 'var(--bg-card)' }}>
              <h2 id="reschedule-dialog-title" className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                Reschedule appointment
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {rescheduleTarget.patientName} · currently {formatDayMonthYear(rescheduleTarget.appointmentDate)} {formatClockTime(rescheduleTarget.appointmentTime)}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>New date</label>
                  <input type="date" value={rescheduleDate} min={today} onChange={e => setRescheduleDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>New time</label>
                  <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}>
                    {RESCHEDULE_SLOTS.map(slot => <option key={slot} value={slot}>{formatClockTime(slot)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRescheduleTarget(null)} disabled={reschedSaving}>
                  {t('action.cancel')}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={submitReschedule} disabled={reschedSaving || !rescheduleDate || !rescheduleTime}>
                  {reschedSaving ? 'Saving…' : 'Reschedule'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {noShowTarget && (
          <Modal onClose={() => setNoShowTarget(null)} width={380} labelledBy="no-show-dialog-title">
            <div className="card-elevated" style={{ padding: 24, borderRadius: 16, background: 'var(--bg-card)' }}>
              <h2 id="no-show-dialog-title" className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Mark as no-show?</h2>
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                {noShowTarget.patientName} — {formatClockTime(noShowTarget.appointmentTime)}. Check the waiting room first; this removes them from today&apos;s arrivals.
              </p>
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNoShowTarget(null)}>{t('action.cancel')}</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleNoShow(noShowTarget)}>Mark no-show</button>
              </div>
            </div>
          </Modal>
        )}

        {checkInTarget && (
          <CheckInModal
            appt={checkInTarget}
            onClose={() => setCheckInTarget(null)}
            onCheckIn={handleCheckIn}
            onUndoCheckIn={handleUndoCheckIn}
            onViewPatient={(pid) => router.push(`/patients/${pid}`)}
          />
        )}
      </main>
    </>
  );
}

/* ─── Row-detail panel pieces (inline expansion) ───
   The queue row's popup used to be a Modal; it now drops open in place under
   the row (EhrCareDashboard's shared inline-expansion shell). These three
   pieces reproduce that popup's shape without the dialog chrome: an icon
   action line matching the doctor worklist's ehr-visit-pop-* classes, a
   label/value fact grid for what the row itself doesn't already show, and —
   for triage-sourced rows — the exam-room control. */

// Icon actions on the panel's first line (Open chart / Check in / Assign /
// etc.), reusing EhrVisitPopup's classes so every role's inline panel reads
// the same way. No tabs here — front desk has one view per row — so the
// "tabs" row is just the flex/border-bottom line the icons sit on.
function FrontDeskDetailActions({ actions }: {
  actions: { icon: LucideIcon; label: string; onClick: () => void; primary?: boolean }[];
}) {
  return (
    <div className="ehr-visit-pop-tabs">
      <div className="ehr-visit-pop-actions">
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            className={`ehr-visit-pop-icon${action.primary ? ' is-primary' : ''}`}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <action.icon className="w-4 h-4" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The appointment's rung on the desk's ladder, as one dropdown: Scheduled,
 * Reminder Sent, Confirmed, Arrived, Checked In, Roomed, Checked Out, then the
 * three exits (No Show, Rescheduled, Cancelled). Options and order come from
 * the shared vocabulary, so this control and the clinician's chart offer the
 * same list.
 *
 * A `requested` booking (patient-portal ask) keeps its own option while it is
 * the current value — reception answers it by picking a real rung — but
 * `requested` is never offered as a destination.
 */
function AppointmentStatusPicker({ appointment, disabled, onChange }: {
  appointment: AppointmentDoc;
  disabled?: boolean;
  onChange: (appointment: AppointmentDoc, status: AppointmentStatus) => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const options = APPOINTMENT_STATUS_OPTIONS.includes(appointment.status)
    ? APPOINTMENT_STATUS_OPTIONS
    : [appointment.status, ...APPOINTMENT_STATUS_OPTIONS];
  return (
    <div className="ehr-care-rooming">
      <CalendarClock className="w-4 h-4" />
      <span>Appointment status</span>
      <select
        value={appointment.status}
        disabled={disabled || saving}
        aria-label="Appointment status"
        onChange={async (event) => {
          const next = event.target.value as AppointmentStatus;
          if (next === appointment.status) return;
          setSaving(true);
          try { await onChange(appointment, next); } finally { setSaving(false); }
        }}
      >
        {options.map(status => (
          <option key={status} value={status}>{appointmentStatusLabel(status)}</option>
        ))}
      </select>
      {saving && <span>Saving…</span>}
    </div>
  );
}

// Label/value facts unique to this row — never the name/time/status the row
// above already shows. Empty values are dropped rather than rendered blank.
function FrontDeskDetailFacts({ facts }: { facts: { label: string; value?: string }[] }) {
  const visible = facts.filter((f): f is { label: string; value: string } => Boolean(f.value));
  if (visible.length === 0) return null;
  return (
    <div className="ehr-row-detail__body">
      {visible.map(f => (
        <div className="appointment-detail-row" key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </div>
  );
}

// Exam-room assignment for a triage-sourced queue row. Saving state is local
// to this component (not page-level) because it now mounts fresh each time
// its row expands, rather than being the single target of a page-level modal.
function RoomAssignmentControl({
  triageId,
  currentRoom,
  priority,
  roomOptions,
  onSave,
}: {
  triageId: string;
  currentRoom?: string;
  priority: 'RED' | 'YELLOW' | 'GREEN' | 'normal';
  roomOptions: string[];
  onSave: (triageId: string, room: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(currentRoom || '');
  const [saving, setSaving] = useState(false);
  return (
    <div className="ehr-care-rooming">
      <MapPin className="w-4 h-4" />
      <span>Exam room</span>
      <select value={draft} onChange={(event) => setDraft(event.target.value)}>
        <option value="">Unassigned</option>
        {roomOptions.map(room => <option key={room} value={room}>{room}</option>)}
      </select>
      <button
        type="button"
        disabled={saving}
        onClick={async () => { setSaving(true); try { await onSave(triageId, draft); } finally { setSaving(false); } }}
      >
        {saving ? 'Saving...' : currentRoom ? 'Update room' : 'Assign room'}
      </button>
      <span style={{ color: priorityColor(priority) }}>
        {priority === 'RED' ? t('appointments.priorityEmergency') : priority === 'YELLOW' ? t('appointments.priorityUrgent') : t('appointments.priorityRoutine')}
      </span>
    </div>
  );
}

// ── Final-checkout modal: confirm balance settled, mark the visit complete ──
function CheckoutModal({
  target,
  onClose,
  onComplete,
  canCollectPayment,
  onCollectPayment,
}: {
  target: CheckoutTarget;
  onClose: () => void;
  onComplete: (target: CheckoutTarget, override?: { reason: string }) => Promise<void>;
  canCollectPayment: boolean;
  onCollectPayment: (patientId: string) => void;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [charges, setCharges] = useState<{ description: string; amount: number }[]>([]);
  const [completing, setCompleting] = useState(false);
  // Live checkout-gate evaluation (KAN-96): unmet critical conditions render
  // here with a route to resolve each, and block the button until either
  // resolved or explicitly overridden with a reason.
  const [gate, setGate] = useState<import('@/lib/services/checkout-gate-service').CheckoutGateEvaluation | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getPatientBalance } = await import('@/lib/services/ledger-service');
        const b = await getPatientBalance(target.patientId);
        if (!cancelled) setBalance(b);
      } catch {
        if (!cancelled) setBalance(0);
      }
      // Itemized fee ticket for this visit so the desk sees what was billed.
      try {
        const { getEncounter, getOpenEncounterForPatient } = await import('@/lib/services/encounter-service');
        const enc = target.encounterId
          ? await getEncounter(target.encounterId)
          : await getOpenEncounterForPatient(target.patientId);
        if (enc) {
          const { getChargesByEncounter } = await import('@/lib/services/payment-service');
          const ch = await getChargesByEncounter(enc._id);
          if (!cancelled) setCharges(ch.map(c => ({ description: c.description, amount: c.billedAmount })));
        }
        // The same evaluation the discharge handler runs, shown up front so
        // the desk can resolve conditions before pressing the button.
        const { evaluateCheckoutGate } = await import('@/lib/services/checkout-gate-service');
        const evaluation = await evaluateCheckoutGate(target.patientId, (enc ?? undefined) as never);
        if (!cancelled) setGate(evaluation);
      } catch { /* non-fatal — balance still shows */ }
    })();
    return () => { cancelled = true; };
  }, [target.encounterId, target.patientId]);

  const owes = (balance ?? 0) > 0;

  return (
    <Modal onClose={onClose} width={440}>
      <div className="modal-content card-elevated" style={{ width: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Final checkout</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {target.patientName}{target.hospitalNumber ? ` · ${target.hospitalNumber}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-black/5" aria-label="Close">
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {charges.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Visit charges</p>
              <ul className="space-y-1">
                {charges.map((c, i) => (
                  <li key={i} className="flex justify-between text-[12px]">
                    <span style={{ color: 'var(--text-primary)' }}>{c.description}</span>
                    <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatMoney(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {balance === null ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Checking balance…</p>
          ) : owes ? (
            <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#EF4444' }}>Outstanding balance</span>
                <Wallet className="w-4 h-4" style={{ color: '#EF4444' }} />
              </div>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#EF4444' }}>{formatMoney(balance)}</p>
              {canCollectPayment ? (
                <button
                  onClick={() => onCollectPayment(target.patientId)}
                  className="mt-2.5 w-full text-[12px] font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                  style={{ background: '#EF4444' }}
                >
                  <Wallet className="w-4 h-4" />Collect payment
                </button>
              ) : (
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Send this patient to cashier or billing to collect payment.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-light)' }}>
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Balance settled</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No outstanding charges on this account.</p>
              </div>
            </div>
          )}

          {gate && gate.blocking.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#B45309' }}>
                Checkout blocked — unresolved items
              </p>
              <ul className="space-y-1.5">
                {gate.blocking.map(condition => (
                  <li key={condition.key} className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                    <span className="font-semibold">{condition.label}</span>
                    {condition.detail && <span style={{ color: 'var(--text-secondary)' }}> — {condition.detail}</span>}
                    {condition.resolveHref && (
                      <Link href={condition.resolveHref} className="ml-1.5 font-semibold underline" style={{ color: 'var(--accent-primary)' }}>
                        Resolve
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <input
                type="text"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="Override reason (required to check out anyway)"
                className="mt-2.5 w-full rounded-lg px-3 py-2 text-[12px]"
                style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card-solid)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
          {(() => {
            const blocked = !!gate && gate.blocking.length > 0;
            const canSubmit = !completing && (!blocked || overrideReason.trim().length > 0);
            return (
              <button
                onClick={async () => {
                  setCompleting(true);
                  await onComplete(target, blocked ? { reason: overrideReason.trim() } : undefined);
                  setCompleting(false);
                }}
                disabled={!canSubmit}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: blocked ? '#B45309' : 'var(--color-success)' }}
              >
                <CheckCircle className="w-4 h-4" />
                {completing ? 'Closing…' : blocked ? 'Override & check out' : 'Complete checkout'}
              </button>
            );
          })()}
        </div>
      </div>
    </Modal>
  );
}

// ── Appointment check-in modal: confirm the patient has arrived; on check-in
//    they're added to the live patient queue. ──
function CheckInModal({
  appt,
  onClose,
  onCheckIn,
  onUndoCheckIn,
  onViewPatient,
}: {
  appt: AppointmentDoc;
  onClose: () => void;
  onCheckIn: (appt: AppointmentDoc, attendanceType: 'new' | 'repeat') => Promise<void>;
  onUndoCheckIn: (appt: AppointmentDoc) => Promise<void>;
  onViewPatient: (patientId: string) => void;
}) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [reversing, setReversing] = useState(false);
  const alreadyIn = appt.status === 'checked_in' || appt.status === 'in_progress' || appt.status === 'completed';
  // Only a plain check-in (not yet in consult / completed) can be cleanly
  // reversed back to scheduled without stepping over later workflow state.
  const canReverseCheckIn = appt.status === 'checked_in';

  // Visit type (new vs re-attendance) — auto-derived from the patient's
  // history when the modal opens; the clerk can override before confirming.
  const [attendanceType, setAttendanceType] = useState<'new' | 'repeat'>('new');
  const attendanceTouchedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { deriveAttendanceType } = await import('@/lib/services/check-in-service');
        const derived = await deriveAttendanceType(appt.patientId);
        if (!cancelled && !attendanceTouchedRef.current) setAttendanceType(derived);
      } catch {
        if (!cancelled && !attendanceTouchedRef.current) setAttendanceType('new');
      }
    })();
    return () => { cancelled = true; };
  }, [appt.patientId]);

  return (
    <Modal onClose={onClose} width={440}>
      <div className="modal-content card-elevated" style={{ width: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{t('frontDesk.checkInTitle')}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{appt.patientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-black/5" aria-label="Close">
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body — appointment detail */}
        <div className="p-4 space-y-2.5">
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
            <DetailRow icon={<Calendar className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />} label={t('frontDesk.colTime')} value={formatClockTime(appt.appointmentTime)} />
            <DetailRow icon={<ClipboardList className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />} label={t('frontDesk.colComplaint')} value={appt.reason || '—'} />
            <DetailRow icon={<MapPin className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />} label={t('frontDesk.department')} value={appt.department || '—'} />
          </div>
          {!alreadyIn && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('frontDesk.visitType')}
              </label>
              <div className="flex gap-2">
                {([['new', t('frontDesk.newVisit')], ['repeat', t('frontDesk.reAttendance')]] as const).map(([key, lbl]) => {
                  const on = attendanceType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { attendanceTouchedRef.current = true; setAttendanceType(key); }}
                      className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                      style={on
                        ? { background: 'var(--accent-light)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }
                        : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {alreadyIn && (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-light)' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{t('frontDesk.alreadyInQueue')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={() => onViewPatient(appt.patientId)} className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--accent-primary)' }}>
            {t('frontDesk.viewProfile')}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
              {t('action.cancel')}
            </button>
            {/* Reverse a mistaken check-in — sends the appointment back to
                scheduled and drops it from the live queue. */}
            {canReverseCheckIn && (
              <button
                onClick={async () => { setReversing(true); try { await onUndoCheckIn(appt); } finally { setReversing(false); } }}
                disabled={reversing}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5 disabled:opacity-50"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}
              >
                <ArrowRightLeft className="w-4 h-4" />
                {reversing ? '…' : t('action.undo')}
              </button>
            )}
            {!alreadyIn && (
              <button
                onClick={async () => { setChecking(true); try { await onCheckIn(appt, attendanceType); } finally { setChecking(false); } }}
                disabled={checking}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: 'var(--color-success)' }}
              >
                <CheckCircle className="w-4 h-4" />
                {checking ? t('frontDesk.checkingIn') : t('frontDesk.checkIn')}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 78 }}>{label}</span>
      <span className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
