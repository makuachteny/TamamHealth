'use client';

/**
 * The appointment status dropdown — the front desk's whole ladder in one
 * control: Scheduled, Reminder Sent, Confirmed, Arrived, Checked In, Roomed,
 * Checked Out, then the exits (No Show, Rescheduled, Cancelled).
 *
 * Shared so the front desk, the appointments list and the chart all offer the
 * same options in the same order — the drift this replaces had one surface
 * calling a rung "In Progress" while another called it "Roomed", and two
 * surfaces offering no way to set most rungs at all.
 *
 * Options and order come from `APPOINTMENT_STATUS_OPTIONS`. A status not on
 * that list (`requested`, written by the patient portal) is still shown while
 * it is the current value, so the control never misreports where a booking is.
 */
import { useState } from 'react';
import { APPOINTMENT_STATUS_OPTIONS, appointmentStatusLabel } from '@/lib/appointment-status';
import type { AppointmentStatus } from '@/lib/db-types';
import { CalendarClock } from '@/components/icons/lucide';

export default function AppointmentStatusSelect({
  status,
  disabled,
  onChange,
  layout = 'row',
  label = 'Appointment status',
}: {
  status: AppointmentStatus;
  disabled?: boolean;
  /** May route instead of writing (e.g. check-in opens its own dialog). */
  onChange: (status: AppointmentStatus) => Promise<void> | void;
  /** 'row' gives the labelled line used in a row's expanded detail; 'bare' is
   *  just the select, for an actions strip that already has its own labels. */
  layout?: 'row' | 'bare';
  label?: string;
}) {
  const [saving, setSaving] = useState(false);
  const options = APPOINTMENT_STATUS_OPTIONS.includes(status)
    ? APPOINTMENT_STATUS_OPTIONS
    : [status, ...APPOINTMENT_STATUS_OPTIONS];

  const select = (
    <select
      value={status}
      disabled={disabled || saving}
      aria-label={label}
      onChange={async (event) => {
        const next = event.target.value as AppointmentStatus;
        if (next === status) return;
        setSaving(true);
        try { await onChange(next); } finally { setSaving(false); }
      }}
    >
      {options.map(option => (
        <option key={option} value={option}>{appointmentStatusLabel(option)}</option>
      ))}
    </select>
  );

  if (layout === 'bare') return select;

  return (
    <div className="ehr-care-rooming">
      <CalendarClock className="w-4 h-4" />
      <span>{label}</span>
      {select}
      {saving && <span>Saving…</span>}
    </div>
  );
}
