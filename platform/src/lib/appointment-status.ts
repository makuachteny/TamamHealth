/**
 * Appointment status vocabulary — the single source of truth for the ladder a
 * visit climbs at the front desk, its labels, its colours, and the sets other
 * code asks about ("is the patient here?", "is this slot still live?").
 *
 * This module exists because the vocabulary used to be copied into six places
 * (two dashboards, the appointments list, the calendar, the front desk and the
 * locale file), so adding a status meant finding all six and labels drifted
 * between them — the list called `in_progress` "In Progress" while the chart
 * called the same value "Roomed".
 *
 * Stored values vs labels: `in_progress` is shown as "Roomed" and `completed`
 * as "Checked Out". The stored names predate the front-desk vocabulary and are
 * written into ~250 call sites and the analytics pipeline, so the label is what
 * moved, not the data.
 */
import type { AppointmentStatus } from './db-types';

/**
 * The forward ladder, in the order reception moves a visit through it:
 * booked → reminded → patient confirms → patient shows up → checked in at the
 * desk → placed in a room → finished and checked out.
 *
 * `arrived` and `checked_in` are deliberately distinct: a patient can be
 * standing in the waiting room (arrived) before the desk has taken payment,
 * verified insurance and opened the visit (checked in).
 */
export const APPOINTMENT_STATUS_FLOW: AppointmentStatus[] = [
  'scheduled',
  'reminder_sent',
  'confirmed',
  'arrived',
  'checked_in',
  'in_progress',
  'completed',
];

/** Ways a visit leaves the ladder without being seen. */
export const APPOINTMENT_STATUS_EXITS: AppointmentStatus[] = ['no_show', 'rescheduled', 'cancelled'];

/**
 * Everything the front desk can set, ladder first then exits — the order the
 * status dropdown renders in. `requested` is absent on purpose: it is written
 * by the patient portal when a patient asks for an appointment, and reception
 * answers it by scheduling or cancelling, never by re-requesting.
 */
export const APPOINTMENT_STATUS_OPTIONS: AppointmentStatus[] = [
  ...APPOINTMENT_STATUS_FLOW,
  ...APPOINTMENT_STATUS_EXITS,
];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  reminder_sent: 'Reminder Sent',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  checked_in: 'Checked In',
  in_progress: 'Roomed',
  completed: 'Checked Out',
  no_show: 'No Show',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
};

/** Locale keys, for the surfaces that translate their status pills. */
export const APPOINTMENT_STATUS_I18N_KEYS: Record<AppointmentStatus, string> = {
  requested: 'appointments.statusRequested',
  scheduled: 'appointments.statusScheduled',
  reminder_sent: 'appointments.statusReminderSent',
  confirmed: 'appointments.statusConfirmed',
  arrived: 'appointments.statusArrived',
  checked_in: 'appointments.statusCheckedIn',
  in_progress: 'appointments.statusInProgress',
  completed: 'appointments.statusCompleted',
  no_show: 'appointments.statusNoShow',
  rescheduled: 'appointments.statusRescheduled',
  cancelled: 'appointments.statusCancelled',
};

/**
 * Pill colours. The ladder warms as the patient gets closer to the clinician
 * (blue booked → amber present → green in the room), and the three exits are
 * muted or red so a wall of rows reads at a glance.
 */
export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, { color: string; bg: string }> = {
  requested:     { color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  scheduled:     { color: '#2191D0', bg: 'rgba(33,145,208,0.10)' },
  reminder_sent: { color: '#0E7490', bg: 'rgba(14,116,144,0.10)' },
  confirmed:     { color: '#015697', bg: 'rgba(1,86,151,0.10)' },
  arrived:       { color: '#B45309', bg: 'rgba(180,83,9,0.10)' },
  checked_in:    { color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  in_progress:   { color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  completed:     { color: '#047857', bg: 'rgba(4,120,87,0.10)' },
  no_show:       { color: '#64748B', bg: 'rgba(100,116,139,0.10)' },
  rescheduled:   { color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  cancelled:     { color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
};

/** Row tone for the shared `status-*` pill classes on the role dashboards. */
export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, 'scheduled' | 'ready' | 'active' | 'done' | 'warning' | 'danger'> = {
  requested: 'scheduled',
  scheduled: 'scheduled',
  reminder_sent: 'scheduled',
  confirmed: 'ready',
  arrived: 'warning',
  checked_in: 'warning',
  in_progress: 'active',
  completed: 'done',
  no_show: 'danger',
  rescheduled: 'scheduled',
  cancelled: 'danger',
};

/**
 * The patient is physically at the facility. `arrived` counts — that is what it
 * means — so anything keyed off presence (queues, wait timers) picks it up
 * without a second list to maintain.
 */
export const APPOINTMENT_PRESENT_STATUSES: AppointmentStatus[] = ['arrived', 'checked_in', 'in_progress', 'completed'];

/** The visit has been opened at the desk: reception's work on it is done. */
export const APPOINTMENT_CHECKED_IN_STATUSES: AppointmentStatus[] = ['checked_in', 'in_progress', 'completed'];

/** The slot is no longer live — nothing further will happen at this time. */
export const APPOINTMENT_CLOSED_STATUSES: AppointmentStatus[] = ['completed', 'cancelled', 'no_show', 'rescheduled'];

/**
 * Still awaiting the patient: reception can remind, confirm, or check them in.
 * `requested` is excluded — it is not a booking yet.
 */
export const APPOINTMENT_PENDING_STATUSES: AppointmentStatus[] = ['scheduled', 'reminder_sent', 'confirmed', 'arrived'];

/**
 * The three-lane view every role dashboard files its queue into — the same
 * lanes the mobile shell shows: Scheduled (booked, patient not yet with us),
 * In Office (visit open at the facility), Finished (the slot is closed —
 * checked out, cancelled, no-show or rescheduled, nothing further today).
 */
export type AppointmentStatusGroup = 'scheduled' | 'in_office' | 'finished';

export const APPOINTMENT_STATUS_GROUPS: AppointmentStatusGroup[] = ['scheduled', 'in_office', 'finished'];

export const APPOINTMENT_STATUS_GROUP_LABELS: Record<AppointmentStatusGroup, string> = {
  scheduled: 'Scheduled',
  in_office: 'In Office',
  finished: 'Finished',
};

export function appointmentStatusGroup(status: AppointmentStatus): AppointmentStatusGroup {
  if (status === 'checked_in' || status === 'in_progress') return 'in_office';
  if (APPOINTMENT_CLOSED_STATUSES.includes(status)) return 'finished';
  // requested/scheduled/reminder_sent/confirmed — and `arrived`: the patient is
  // in the waiting room but the desk has not opened the visit yet, so they
  // still belong to the expected lane, matching APPOINTMENT_PENDING_STATUSES.
  return 'scheduled';
}

export function appointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_LABELS[status]
    // A status written by an older client than this build still reads sanely.
    || String(status).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * The rung below `status`, for undoing a step. Exits reopen to `scheduled`
 * (their own rung is gone), and `scheduled` has nowhere to fall back to.
 */
export function priorAppointmentStatus(status: AppointmentStatus): AppointmentStatus | undefined {
  const rung = APPOINTMENT_STATUS_FLOW.indexOf(status);
  if (rung > 0) return APPOINTMENT_STATUS_FLOW[rung - 1];
  if (APPOINTMENT_STATUS_EXITS.includes(status)) return 'scheduled';
  return undefined;
}
