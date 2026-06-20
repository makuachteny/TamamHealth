'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from '@/components/icons/lucide';
import type { AppointmentStatus, AppointmentDoc } from '@/lib/db-types';
import { Calendar as BigCalendar, dateFnsLocalizer, type View, type ToolbarProps } from 'react-big-calendar';
import { format as dfFormat, parse as dfParse, startOfWeek as dfStartOfWeek, getDay as dfGetDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { jubaNow } from '@/lib/time-juba';

// Google-Calendar-style localizer (date-fns, MIT) shared by the calendar view.
const calendarLocalizer = dateFnsLocalizer({
  format: dfFormat,
  parse: dfParse,
  startOfWeek: () => dfStartOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay: dfGetDay,
  locales: { 'en-US': enUS },
});

// Event shape fed to react-big-calendar; keeps the full appointment on `resource`.
export type CalEvent = { id: string; title: string; start: Date; end: Date; resource: AppointmentDoc };

// Calendar toolbar: icon prev/next + the period label on the left, and the
// day/week/month view switcher docked on the right (mirrors the same filter
// that lives beside the search bar — both drive the calendar granularity).
const rbcNavBtn: React.CSSProperties = {
  background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)',
  borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
};
const CAL_VIEWS: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
function CalToolbar({ label, onNavigate, onView, view }: ToolbarProps<CalEvent, object>) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <button type="button" onClick={() => onNavigate('PREV')} aria-label="Previous" style={rbcNavBtn}><ChevronLeft size={18} /></button>
      <button type="button" onClick={() => onNavigate('NEXT')} aria-label="Next" style={rbcNavBtn}><ChevronRight size={18} /></button>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{label}</h3>
      {/* View switcher — right-aligned in the calendar header card. */}
      <div style={{ marginLeft: 'auto', display: 'flex', height: 34, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
        {CAL_VIEWS.map(v => (
          <button key={v} type="button" onClick={() => onView(v as View)} style={{
            display: 'flex', alignItems: 'center', padding: '0 14px', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
            background: view === v ? 'var(--accent-primary)' : 'var(--bg-card)',
            color: view === v ? '#fff' : 'var(--text-secondary)',
            transition: 'background 0.15s, color 0.15s',
          }}>{v}</button>
        ))}
      </div>
    </div>
  );
}

type AppointmentsCalendarProps = {
  events: CalEvent[];
  calView: 'month' | 'week' | 'day';
  calDate: Date;
  today: string;
  statusConfig: Record<AppointmentStatus, { color: string; bg: string; label: string }>;
  onNavigate: (d: Date) => void;
  onView: (v: 'month' | 'week' | 'day') => void;
  onSelectEvent: (apt: AppointmentDoc) => void;
  onSelectSlot: (slot: { start: Date }) => void;
};

export default function AppointmentsCalendar({
  events, calView, calDate, today, statusConfig,
  onNavigate, onView, onSelectEvent, onSelectSlot,
}: AppointmentsCalendarProps) {
  return (
    <BigCalendar<CalEvent, object>
      localizer={calendarLocalizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      date={calDate}
      getNow={jubaNow}
      onNavigate={(d: Date) => onNavigate(d)}
      view={calView as View}
      onView={(v: View) => onView(v as 'month' | 'week' | 'day')}
      views={['month', 'week', 'day']}
      popup
      style={{ height: '100%' }}
      scrollToTime={new Date(1970, 0, 1, 7, 0, 0)}
      // No hover tooltip — it just repeated the time + title already shown in the
      // event block. And blank the in-event time label in day/week views since
      // the time gutter on the left already conveys the time (no repetition).
      tooltipAccessor={() => ''}
      formats={{ eventTimeRangeFormat: () => '' }}
      components={{ toolbar: CalToolbar }}
      onSelectEvent={(e: { resource: AppointmentDoc }) => onSelectEvent(e.resource)}
      selectable
      onSelectSlot={(slot: { start: Date }) => onSelectSlot(slot)}
      eventPropGetter={(e: { resource: AppointmentDoc }) => {
        const a = e.resource;
        const color = a.appointmentType === 'walk_in'
          ? '#7C3AED'
          : (statusConfig[a.status]?.color || 'var(--accent-primary)');
        return { style: { backgroundColor: color, borderColor: color, color: '#fff', borderRadius: 6, border: 'none', fontSize: 12, padding: '1px 6px' } };
      }}
      dayPropGetter={(d: Date) => {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return iso === today ? { style: { backgroundColor: 'var(--accent-light)' } } : {};
      }}
    />
  );
}
