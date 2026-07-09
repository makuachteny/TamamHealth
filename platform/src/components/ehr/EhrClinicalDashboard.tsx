'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AppointmentDoc, AppointmentStatus } from '@/lib/db-types';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Plus,
  Printer,
  Search,
  SendHorizontal,
  Stethoscope,
  Video,
  X,
} from '@/components/icons/lucide';
import { initials, stateColor } from '@/lib/patient-utils';
import { useToast } from '@/components/Toast';
import { useInsuredPatientIds } from '@/lib/hooks/usePayments';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePatients } from '@/lib/hooks/usePatients';
import { useWards } from '@/lib/hooks/useWards';
import Modal from '@/components/Modal';
import InsuranceSnapshot from '@/components/payments/InsuranceSnapshot';
import {
  toIsoDate,
  parseIsoDate,
  startOfMonth,
  addMonths,
  addDays,
  formatDateTitle,
  formatMonthTitle,
} from '@/components/ehr/EhrMiniCalendar';

function appointmentTriage(priority: AppointmentDoc['priority']) {
  if (priority === 'emergency') return 'RED';
  if (priority === 'urgent') return 'YELLOW';
  return 'GREEN';
}

type WorklistPatient = {
  _id: string;
  name: string;
  age: number | null;
  gender: string;
  id?: string;
  ward?: string;
  doctor?: string;
  nurse?: string;
  division?: string;
  triagePriority?: 'RED' | 'YELLOW' | 'GREEN';
};

/** One row inside an outstanding-item worklist (a document to sign, an open
 *  referral, a paused encounter, …) rendered inline in the centre panel. */
export type OutstandingEntry = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: 'neutral' | 'warning' | 'danger';
  href?: string;
};

type OutstandingItem = {
  label: string;
  count: number;
  tone?: 'neutral' | 'warning' | 'danger';
  href?: string;
  /** The actual items behind the count — clicking the card swaps the centre
   *  panel (schedule area) for this list instead of navigating away. */
  entries?: OutstandingEntry[];
};

const statusOptions: AppointmentStatus[] = ['requested', 'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];

function statusLabel(status: AppointmentStatus) {
  if (status === 'checked_in') return 'Checked in';
  if (status === 'in_progress') return 'Roomed';
  if (status === 'completed') return 'Checked out';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function typeLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatAppointmentDate(value: string) {
  const date = parseIsoDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(date);
}

function appointmentTimeRange(appointment: AppointmentDoc) {
  const start = appointment.appointmentTime || '00:00';
  if (appointment.endTime) return `${start} - ${appointment.endTime}`;
  return `${start} · ${appointment.duration}m`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="appointment-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function statusTone(status: AppointmentStatus) {
  if (status === 'completed') return 'done';
  if (status === 'checked_in' || status === 'in_progress') return 'active';
  if (status === 'confirmed') return 'ready';
  return 'scheduled';
}

function departmentTone(value?: string) {
  const department = (value || '').toLowerCase();
  if (department.includes('emergency')) return 'emergency';
  if (department.includes('maternity')) return 'maternity';
  if (department.includes('pediatric')) return 'pediatrics';
  if (department.includes('surgery')) return 'surgery';
  if (department.includes('lab')) return 'lab';
  return 'opd';
}

export default function EhrClinicalDashboard({
  clinicianName,
  facilityName,
  patients,
  appointments,
  outstanding,
  onUpdateAppointmentStatus,
  canAccessBilling = false,
}: {
  clinicianName: string;
  facilityName?: string;
  patients: WorklistPatient[];
  appointments: AppointmentDoc[];
  outstanding: OutstandingItem[];
  onUpdateAppointmentStatus?: (appointmentId: string, status: AppointmentStatus) => Promise<void> | void;
  canAccessBilling?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  // Gate the "Start consultation" action to roles that can actually consult.
  const { canConsult, canBookAppointments } = usePermissions();
  // Coverage lives in insurance_policy docs, not on the appointment — one
  // bulk set of covered patient ids badges every row as Insured/Not insured.
  const insuredIds = useInsuredPatientIds();
  // Inpatient = the appointment's patient currently holds an active ward
  // admission; everyone else counts as outpatient (day-activity chart).
  const { activeAdmissions } = useWards();
  const admittedPatientIds = useMemo(() => new Set(activeAdmissions.map(admission => admission.patientId)), [activeAdmissions]);
  // Preferred language also lives on the patient record, not the appointment.
  const { patients: patientDocs } = usePatients();
  const patientLanguages = useMemo(() => {
    const map = new Map<string, string>();
    for (const patient of patientDocs) {
      if (patient.primaryLanguage) map.set(patient._id, patient.primaryLanguage);
    }
    return map;
  }, [patientDocs]);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const [view, setView] = useState<'dashboard' | 'calendar'>('dashboard');
  const [railOpen, setRailOpen] = useState(false);
  const [appointmentLane, setAppointmentLane] = useState<'scheduled' | 'in_office' | 'finished'>('scheduled');
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [openAppointment, setOpenAppointment] = useState<AppointmentDoc | null>(null);
  const [appointmentDetailTab, setAppointmentDetailTab] = useState<'visit' | 'financial'>('visit');
  // Which action dropdown (if any) is open in the appointment detail popup.
  const [detailMenuOpen, setDetailMenuOpen] = useState<'note' | 'more' | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close whichever action dropdown is open on an outside click.
  useEffect(() => {
    if (!detailMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const ref = detailMenuOpen === 'note' ? noteMenuRef : moreMenuRef;
      if (ref.current && !ref.current.contains(event.target as Node)) setDetailMenuOpen(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [detailMenuOpen]);

  // A fresh appointment (or none) shouldn't inherit the previous one's open menu.
  useEffect(() => { setDetailMenuOpen(null); }, [openAppointment?._id]);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [locationFilter, setLocationFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  const [worklistSearch, setWorklistSearch] = useState('');
  // Which outstanding item's worklist occupies the centre panel (null = the
  // normal schedule). Keyed by item label.
  const [outstandingView, setOutstandingView] = useState<string | null>(null);

  const activeOutstanding = outstandingView
    ? outstanding.find(item => item.label === outstandingView) ?? null
    : null;

  const openOutstanding = (item: OutstandingItem) => {
    setView('dashboard');
    setOutstandingView(current => (current === item.label ? null : item.label));
    setRailOpen(false);
  };

  const openPatientRecord = (appointment: AppointmentDoc) => {
    const patientId = appointment.patientId || patients.find(patient => patient.name === appointment.patientName)?._id;
    if (patientId) {
      router.push(`/patients/${patientId}`);
    } else {
      // Both the direct id and the name-match fallback failed — say so
      // instead of silently doing nothing.
      showToast(`No patient record found for ${appointment.patientName}`, 'error');
    }
  };

  const isTelehealth = (appointment: AppointmentDoc) => appointment.appointmentType === 'telehealth';
  const joinTelehealth = (appointment: AppointmentDoc) => {
    router.push(`/telehealth/visit/${encodeURIComponent(appointment._id)}`);
  };

  // Clicking an outstanding-item entry normally follows its href. But a
  // telehealth entry must NOT jump straight into the video call — it opens the
  // appointment detail popover first (matching the appointment card), and the
  // Join button inside that popover launches the visit.
  const openOutstandingEntry = (entry: OutstandingEntry) => {
    const appointment = appointments.find(a => a._id === entry.id);
    if (appointment && isTelehealth(appointment)) {
      setAppointmentDetailTab('visit');
      setOpenAppointment(appointment);
      return;
    }
    if (entry.href) router.push(entry.href);
  };

  const locationOptions = useMemo(() => {
    const names = appointments
      .map(appointment => appointment.facilityName || facilityName)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [appointments, facilityName]);

  const providerOptions = useMemo(() => {
    const names = [clinicianName, ...appointments.map(appointment => appointment.providerName)]
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names));
  }, [appointments, clinicianName]);

  useEffect(() => {
    setProviderFilter(current => {
      const active = current.filter(provider => providerOptions.includes(provider));
      if (active.length === providerOptions.length) return active;
      if (current.length > 0 && active.length > 0) return active;
      return providerOptions;
    });
  }, [providerOptions]);

  useEffect(() => {
    setView(searchParams.get('view') === 'calendar' ? 'calendar' : 'dashboard');
  }, [searchParams]);

  const matchesProviderFilter = useCallback((appointment: AppointmentDoc) => {
    if (providerOptions.length === 0 || providerFilter.length === 0) return true;
    return providerFilter.includes(appointment.providerName || clinicianName);
  }, [clinicianName, providerFilter, providerOptions.length]);

  const appointmentCounts = useMemo(() => {
    return appointments.reduce<Map<string, number>>((counts, appointment) => {
      if (locationFilter !== 'all' && appointment.facilityName !== locationFilter) return counts;
      if (!matchesProviderFilter(appointment)) return counts;
      counts.set(appointment.appointmentDate, (counts.get(appointment.appointmentDate) || 0) + 1);
      return counts;
    }, new Map());
  }, [appointments, locationFilter, matchesProviderFilter]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    return Array.from({ length: 42 }).map((_, index) => {
      const date = addDays(gridStart, index);
      const iso = toIsoDate(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === calendarMonth.getMonth(),
        isToday: iso === todayIso,
        isSelected: iso === selectedDate,
        count: appointmentCounts.get(iso) || 0,
      };
    });
  }, [appointmentCounts, calendarMonth, selectedDate, todayIso]);

  // Provider/location-scoped but NOT date-scoped — the day-activity chart
  // needs adjacent days too, for its two-day comparison.
  const filteredAppointments = useMemo(() => (
    appointments
      .filter(appointment => locationFilter === 'all' || appointment.facilityName === locationFilter)
      .filter(matchesProviderFilter)
  ), [appointments, locationFilter, matchesProviderFilter]);

  const selectedAppointmentsForDay = useMemo(() => {
    return filteredAppointments
      .filter(appointment => appointment.appointmentDate === selectedDate)
      .sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''));
  }, [filteredAppointments, selectedDate]);

  const scheduledCount = selectedAppointmentsForDay.filter(appointment => ['scheduled', 'confirmed', 'requested'].includes(appointment.status)).length;
  const inOfficeCount = selectedAppointmentsForDay.filter(appointment => ['checked_in', 'in_progress'].includes(appointment.status)).length;
  const finishedCount = selectedAppointmentsForDay.filter(appointment => appointment.status === 'completed').length;
  const selectedAppointments = selectedAppointmentsForDay.filter(appointment => {
    if (appointmentLane === 'scheduled') return ['scheduled', 'confirmed', 'requested'].includes(appointment.status);
    if (appointmentLane === 'in_office') return ['checked_in', 'in_progress'].includes(appointment.status);
    return appointment.status === 'completed';
  });
  const worklistQuery = worklistSearch.trim().toLowerCase();
  const patientRows = (worklistQuery
    ? patients.filter(patient => [patient.name, patient.id, patient.ward, patient.division, patient.doctor, patient.nurse]
        .some(value => value?.toLowerCase().includes(worklistQuery)))
    : patients
  ).slice(0, 6);
  const workflowChecklist = [
    { label: 'Patient intake', done: (outstanding.find(item => item.label === 'Patient intake')?.count || 0) === 0, href: '/patient-intake' },
    { label: 'Clinical note', done: (outstanding.find(item => item.label === 'Documents to sign')?.count || 0) === 0, href: '/consultation' },
    { label: 'Lab order', done: (outstanding.find(item => item.label === 'Awaiting labs')?.count || 0) === 0, href: '/lab' },
    { label: 'Medication plan', done: true, href: '/pharmacy' },
    ...(canAccessBilling ? [{ label: 'Charge draft', done: finishedCount === 0 || selectedAppointments.some(appointment => appointment.status === 'completed'), href: '/payments' }] : []),
  ];

  return (
    <div className="ehr-schedule-shell">
      <section className="ehr-schedule-header ehr-clinical-dashboard-header">
        <div className="ehr-clinical-dashboard-tabs">
          <div className="ehr-segmented" role="tablist">
            <button type="button" className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')} aria-label="Dashboard">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button type="button" className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')} aria-label="Calendar">
              <Calendar className="w-4 h-4" /> Calendar
            </button>
          </div>
        </div>
        <div className="ehr-schedule-primary-controls ehr-clinical-dashboard-header-main">
          <div className="ehr-greeting-row">
            <p className="ehr-care-greeting">Welcome, {clinicianName}</p>
          </div>
        </div>
        <div className="ehr-schedule-actions">
          {canBookAppointments && (
            <button
              type="button"
              aria-label="New appointment"
              style={{ background: '#fff', borderColor: 'var(--border-light)', color: '#000' }}
              onClick={() => router.push('/appointments?new=1')}
            >
              <Plus className="w-4 h-4" color="#000" /> New appointment
            </button>
          )}
          <button
            type="button"
            aria-label="Send intake"
            style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: '#fff' }}
            onClick={() => router.push('/patient-intake')}
          >
            <SendHorizontal className="w-4 h-4" color="#fff" /> Send intake
          </button>
        </div>
      </section>

      <section className={`ehr-workspace-grid ${view === 'dashboard' ? 'is-dashboard' : 'is-calendar'}`}>
        <aside className="ehr-left-rail">
          <button
            type="button"
            className="ehr-today-button"
            onClick={() => {
              setSelectedDate(todayIso);
              setAppointmentLane('scheduled');
              setCalendarMonth(startOfMonth(new Date()));
            }}
          >
            Go to today
          </button>
          <div className="ehr-mini-calendar">
            <div className="ehr-mini-calendar-title">
              <button type="button" onClick={() => setCalendarMonth(current => addMonths(current, -1))} aria-label="Previous month">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{formatMonthTitle(calendarMonth)}</span>
              <button type="button" onClick={() => setCalendarMonth(current => addMonths(current, 1))} aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="ehr-mini-calendar-grid">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}
              {calendarCells.map(cell => (
                <button
                  key={cell.iso}
                  type="button"
                  data-date={cell.iso}
                  className={[
                    cell.isToday ? 'today' : '',
                    cell.isSelected ? 'selected' : '',
                    !cell.inMonth ? 'muted' : '',
                    cell.count > 0 ? 'has-events' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSelectedDate(cell.iso);
                    setAppointmentLane('scheduled');
                    if (!cell.inMonth) setCalendarMonth(startOfMonth(parseIsoDate(cell.iso)));
                  }}
                  aria-label={`${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIsoDate(cell.iso))}${cell.count ? `, ${cell.count} appointment${cell.count === 1 ? '' : 's'}` : ''}`}
                  aria-pressed={cell.isSelected}
                >
                  <span>{cell.day}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ehr-filter-group">
            <label>
              <input
                type="checkbox"
                checked={providerOptions.length === 0 || providerFilter.length === providerOptions.length}
                onChange={event => setProviderFilter(event.target.checked ? providerOptions : [])}
              />
              Providers
            </label>
            {providerOptions.map(provider => (
              <label key={provider}>
                <input
                  type="checkbox"
                  checked={providerFilter.includes(provider)}
                  onChange={() => setProviderFilter(current => (
                    current.includes(provider)
                      ? current.filter(item => item !== provider)
                      : [...current, provider]
                  ))}
                />
                {provider}
              </label>
            ))}
          </div>
          <div className="ehr-filter-group">
            <label>
              <input
                type="checkbox"
                checked={locationFilter === 'all'}
                onChange={() => setLocationFilter('all')}
              />
              All service locations
            </label>
            {(locationOptions.length ? locationOptions : [facilityName || 'Tamam facility']).map(location => (
              <label key={location}>
                <input
                  type="checkbox"
                  checked={locationFilter === 'all' || locationFilter === location}
                  onChange={() => setLocationFilter(locationFilter === location ? 'all' : location)}
                />
                {location}
              </label>
            ))}
          </div>
          <DayActivityChart appointments={filteredAppointments} selectedDate={selectedDate} todayIso={todayIso} admittedPatientIds={admittedPatientIds} />
        </aside>

        <main className="ehr-center-panel">
          {view === 'dashboard' && activeOutstanding ? (
            <>
              <div className="ehr-daybar">
                <h2 className="ehr-outstanding-title">
                  <button
                    type="button"
                    className="ehr-outstanding-back"
                    onClick={() => setOutstandingView(null)}
                  >
                    <ChevronLeft className="w-4 h-4" /> Schedule
                  </button>
                  {activeOutstanding.label}
                </h2>
                <div className="ehr-day-tabs">
                  <button type="button" className="active">
                    {activeOutstanding.count} {activeOutstanding.count === 1 ? 'item' : 'items'}
                  </button>
                  {activeOutstanding.href && (
                    <button type="button" onClick={() => router.push(activeOutstanding.href!)}>
                      Open full page
                    </button>
                  )}
                </div>
              </div>

              <div className="ehr-appointment-list">
                {(activeOutstanding.entries?.length ?? 0) === 0 && (
                  <div className="ehr-empty-state">
                    <ClipboardList className="w-8 h-8" />
                    <strong>Nothing outstanding</strong>
                    <span>{activeOutstanding.label} is clear — no items need your attention.</span>
                    <button type="button" onClick={() => setOutstandingView(null)}>Back to schedule</button>
                  </div>
                )}

                {(activeOutstanding.entries ?? []).map(entry => {
                  // Telehealth visits render as full appointment cards (same
                  // columns as the schedule) with a Status column in place of
                  // Language. Clicking opens the appointment popover; Join lives
                  // inside it.
                  const appointment = appointments.find(a => a._id === entry.id);
                  if (appointment && isTelehealth(appointment)) {
                    return (
                      <article
                        key={entry.id}
                        className="ehr-appointment-row"
                        data-triage={appointmentTriage(appointment.priority)}
                        role="button"
                        tabIndex={0}
                        onClick={() => openOutstandingEntry(entry)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openOutstandingEntry(entry);
                          }
                        }}
                      >
                        <div className="ehr-appointment-identity">
                          <div className="ehr-patient-icon" style={{ background: stateColor(appointmentTriage(appointment.priority)), color: '#fff' }}>{initials(appointment.patientName)}</div>
                          <div className="ehr-appointment-main">
                            <button type="button" onClick={event => { event.stopPropagation(); openPatientRecord(appointment); }}>
                              {appointment.patientName}
                            </button>
                            <p>{appointment.reason || 'Telehealth visit'}</p>
                          </div>
                        </div>
                        <div className="ehr-appointment-time">
                          <strong>{appointment.appointmentTime}</strong>
                          <span>{typeLabel(appointment.priority)}</span>
                        </div>
                        <div className="ehr-appointment-language">
                          <strong>{statusLabel(appointment.status)}</strong>
                          <span>Status</span>
                        </div>
                        <span className="ehr-appointment-department">
                          <b className={`ehr-department-pill ${departmentTone(appointment.department)}`}>{typeLabel(appointment.department || 'Telemedicine')}</b>
                        </span>
                        <span className="ehr-appointment-insurance">
                          <b className={`ehr-insurance-pill ${appointment.status === 'confirmed' || appointment.status === 'checked_in' || appointment.status === 'in_progress' ? 'insured' : 'not-insured'}`}>
                            {appointment.status === 'confirmed' || appointment.status === 'checked_in' || appointment.status === 'in_progress' ? 'Confirmed' : 'Not confirmed'}
                          </b>
                        </span>
                      </article>
                    );
                  }
                  return (
                  <article
                    key={entry.id}
                    className="ehr-appointment-row ehr-outstanding-entry"
                    role="button"
                    tabIndex={0}
                    onClick={() => openOutstandingEntry(entry)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openOutstandingEntry(entry);
                      }
                    }}
                  >
                    <div
                      className="ehr-patient-icon"
                      style={{ background: stateColor(entry.tone === 'danger' ? 'RED' : entry.tone === 'warning' ? 'YELLOW' : 'GREEN'), color: '#fff' }}
                    >
                      {initials(entry.title)}
                    </div>
                    <div className="ehr-appointment-main">
                      <button type="button" onClick={event => { event.stopPropagation(); openOutstandingEntry(entry); }}>
                        {entry.title}
                      </button>
                      {entry.subtitle && <p>{entry.subtitle}</p>}
                    </div>
                    {entry.meta && <span className="ehr-outstanding-entry-meta">{entry.meta}</span>}
                    <ChevronRight className="w-4 h-4 ehr-outstanding-entry-chevron" />
                  </article>
                  );
                })}
              </div>
            </>
          ) : (
            <>
	          <div className="ehr-daybar">
	            <h2>{formatDateTitle(selectedDate)}</h2>
	            <div className="ehr-day-tabs">
              {view === 'dashboard' ? (
                <>
                  <button type="button" className={appointmentLane === 'scheduled' ? 'active' : ''} onClick={() => setAppointmentLane('scheduled')}>
                    {scheduledCount} Scheduled
                  </button>
                  <button type="button" className={appointmentLane === 'in_office' ? 'active' : ''} onClick={() => setAppointmentLane('in_office')}>
                    {inOfficeCount} In Office
                  </button>
	                  <button type="button" className={appointmentLane === 'finished' ? 'active' : ''} onClick={() => setAppointmentLane('finished')}>
	                    {finishedCount} Finished
	                  </button>
	                  {outstanding.map(item => (
	                    <button key={item.label} type="button" onClick={() => openOutstanding(item)} className={`ehr-mobile-day-check ${item.tone || 'neutral'}`}>
	                      <b>{item.count}</b> {item.label}
	                    </button>
	                  ))}
	                </>
	              ) : (
	                <button type="button" className="active">
	                  {selectedAppointmentsForDay.length} Appointment{selectedAppointmentsForDay.length === 1 ? '' : 's'}
	                </button>
	              )}
	            </div>
	          </div>

	          <div className="ehr-appointment-list">
            {(view === 'calendar' ? selectedAppointmentsForDay : selectedAppointments).length === 0 && (
              <div className="ehr-empty-state">
                <Calendar className="w-8 h-8" />
                <strong>{view === 'calendar' ? 'No appointments for this day' : 'No appointments in this lane'}</strong>
                <span>{locationFilter === 'all' ? 'Select another date, status, or provider.' : 'Clear the location filter or choose another service location.'}</span>
                <button type="button" onClick={() => router.push('/appointments?new=1')}>Book appointment</button>
              </div>
            )}

            {(view === 'calendar' ? selectedAppointmentsForDay : selectedAppointments).map((appointment) => (
                  <article
                    key={appointment._id}
                    className="ehr-appointment-row"
                    data-triage={appointmentTriage(appointment.priority)}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setAppointmentDetailTab('visit');
                      setOpenAppointment(appointment);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setAppointmentDetailTab('visit');
                        setOpenAppointment(appointment);
                      }
                    }}
                  >
                    <div className="ehr-appointment-identity">
                      <div className="ehr-patient-icon" style={{ background: stateColor(appointmentTriage(appointment.priority)), color: '#fff' }}>{initials(appointment.patientName)}</div>
                      <div className="ehr-appointment-main">
                        <button type="button" onClick={(event) => {
                          event.stopPropagation();
                          openPatientRecord(appointment);
                        }}>
                          {appointment.patientName}
                        </button>
                        <p>{appointment.reason || 'General review'}</p>
                      </div>
                    </div>
                    <div className="ehr-appointment-time">
                      <strong>{appointment.appointmentTime}</strong>
                      <span>{typeLabel(appointment.priority)}</span>
                    </div>
                    <div className="ehr-appointment-language">
                      {isTelehealth(appointment) ? (
                        <>
                          <strong>{statusLabel(appointment.status)}</strong>
                          <span>Status</span>
                        </>
                      ) : (
                        <>
                          <strong>{patientLanguages.get(appointment.patientId) || '—'}</strong>
                          <span>Language</span>
                        </>
                      )}
                    </div>
                    <span className="ehr-appointment-department">
                      <b className={`ehr-department-pill ${departmentTone(appointment.department)}`}>{typeLabel(appointment.department || appointment.appointmentType)}</b>
                    </span>
                    <span className="ehr-appointment-insurance">
                      <b className={`ehr-insurance-pill ${insuredIds.has(appointment.patientId) ? 'insured' : 'not-insured'}`}>
                        {insuredIds.has(appointment.patientId) ? 'Insured' : 'Not insured'}
                      </b>
                    </span>
                    <div className="ehr-status-menu">
                      <select
                        value={appointment.status}
                        className={statusTone(appointment.status)}
                        onClick={event => event.stopPropagation()}
                        onKeyDown={event => event.stopPropagation()}
                        onChange={event => {
                          void onUpdateAppointmentStatus?.(appointment._id, event.target.value as AppointmentStatus);
                        }}
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                      </select>
                    </div>
                  </article>
            ))}
          </div>
            </>
          )}

          {view === 'dashboard' && (
            <>
		              <section className="ehr-worklist-panel">
		                <div>
		                  <h3>Assigned patients</h3>
                          <label className="ehr-care-search ehr-worklist-search">
                            <Search className="w-4 h-4" />
                            <input
                              type="search"
                              value={worklistSearch}
                              onChange={event => setWorklistSearch(event.target.value)}
                              placeholder="Search patient, ID, room, or care team"
                              aria-label="Search assigned patients"
                            />
                          </label>
                          <div className="ehr-worklist-meta">
                            <span>{patientRows.length} today</span>
                          </div>
		                </div>
		                <div className="ehr-worklist-table">
                    {patientRows.length > 0 && (
                      <div className="ehr-worklist-head">
                        <span>Patient</span>
                        <span>Room</span>
                        <span>Department</span>
                        <span>Care team</span>
                        <span>Status</span>
                      </div>
                    )}
	                  {patientRows.length === 0 && (
	                    <div className="ehr-worklist-empty">
	                      {worklistQuery ? 'No assigned patients match your search.' : 'No patients are assigned to you right now.'}
                      {worklistQuery ? (
                        <button type="button" onClick={() => setWorklistSearch('')}>Clear search</button>
                      ) : (
                        <button type="button" onClick={() => router.push('/patients')}>Open patient registry</button>
                      )}
                    </div>
                  )}
	                  {patientRows.map(patient => (
                      (() => {
                        const matchingAppointment = selectedAppointmentsForDay.find(appointment => (
                          appointment.patientId === patient._id || appointment.patientName === patient.name
                        ));
                        const status = matchingAppointment?.status || (patient.triagePriority === 'RED' ? 'checked_in' : 'scheduled');
                        const department = patient.division || patient.ward?.split('-')[0] || matchingAppointment?.department || 'OPD';
                        return (
                          <button key={patient._id} type="button" className="ehr-worklist-row" data-triage={patient.triagePriority || 'GREEN'} onClick={() => router.push(`/consultation?patientId=${patient._id}`)}>
                            <span className="ehr-worklist-name">
                              <span className="ehr-patient-icon ehr-patient-icon--sm" style={{ background: stateColor(patient.triagePriority), color: '#fff' }}>{initials(patient.name)}</span>
                              <span>
                                <strong>{patient.name}</strong>
                                <small>{patient.id || 'No ID'} · {patient.age ? `${patient.age}y` : 'Age unknown'} · {patient.gender || 'Not recorded'}</small>
                              </span>
                            </span>
                            <span className="ehr-worklist-room">{patient.ward || matchingAppointment?.department || 'OPD-1'}</span>
                            <span><b className={`ehr-department-pill ${departmentTone(department)}`}>{typeLabel(department)}</b></span>
                            <span className="ehr-worklist-care">
                              <strong>{patient.doctor || clinicianName || matchingAppointment?.providerName || 'Not assigned'}</strong>
                              <small>{patient.nurse || 'Nursing team'}</small>
                            </span>
                            <span><b className={`ehr-worklist-status ${statusTone(status as AppointmentStatus)}`}>{statusLabel(status as AppointmentStatus)}</b></span>
                          </button>
                        );
                      })()
                  ))}
                </div>
              </section>
            </>
          )}

          {openAppointment && (
            <Modal onClose={() => setOpenAppointment(null)} width={560}>
              <div
                className="modal-panel modal-panel--md"
                style={{ width: '100%', maxHeight: 'min(85vh, 720px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
                aria-label="Appointment details"
                role="dialog"
                aria-modal="true"
              >
                <div className="appointment-detail-modal__header">
                  <div className="appointment-detail-modal__header-row">
                    <h2 className="appointment-detail-modal__time">{appointmentTimeRange(openAppointment)}</h2>
                    <div className="appointment-detail-modal__header-right">
                      <select
                        value={openAppointment.status}
                        className="appointment-detail-modal__status-select"
                        aria-label="Appointment status"
                        onChange={event => {
                          const status = event.target.value as AppointmentStatus;
                          void onUpdateAppointmentStatus?.(openAppointment._id, status);
                          setOpenAppointment({ ...openAppointment, status });
                        }}
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                      </select>
                      <button type="button" className="appointment-detail-modal__close" onClick={() => setOpenAppointment(null)} aria-label="Close appointment details">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="appointment-detail-modal__subrow">
                    <button type="button" className="appointment-detail-modal__patient-link" onClick={() => openPatientRecord(openAppointment)}>
                      {openAppointment.patientName}
                    </button>
                    <span className="appointment-detail-modal__priority-badge">{typeLabel(openAppointment.priority)}</span>
                    {isTelehealth(openAppointment) && (
                      <button type="button" className="appointment-detail-join-pill" onClick={() => joinTelehealth(openAppointment)}>
                        <Video className="w-3.5 h-3.5" /> Join
                      </button>
                    )}
                  </div>
                </div>

                <div className="appointment-detail-modal__tabs" role="tablist" aria-label="Appointment detail sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={appointmentDetailTab === 'visit'}
                    className={appointmentDetailTab === 'visit' ? 'active' : undefined}
                    onClick={() => setAppointmentDetailTab('visit')}
                  >
                    Visit Information
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={appointmentDetailTab === 'financial'}
                    className={appointmentDetailTab === 'financial' ? 'active' : undefined}
                    onClick={() => setAppointmentDetailTab('financial')}
                  >
                    Financial Information
                  </button>
                </div>

                <div className="appointment-detail-modal__body" role="tabpanel">
                  {appointmentDetailTab === 'visit' ? (
                    [
                      { label: 'Resources', value: openAppointment.providerName || clinicianName || 'Unassigned' },
                      { label: 'Appointment Mode', value: openAppointment.appointmentType === 'telehealth' ? 'Telehealth' : openAppointment.appointmentType === 'walk_in' ? 'Walk-in' : 'In Office' },
                      { label: 'Date', value: formatAppointmentDate(openAppointment.appointmentDate) },
                      { label: 'Time', value: appointmentTimeRange(openAppointment) },
                      { label: 'Duration', value: `${openAppointment.duration} minutes` },
                      { label: 'Location', value: openAppointment.facilityName || facilityName || 'Not assigned' },
                      { label: 'Department', value: openAppointment.department || 'Not assigned' },
                      { label: 'Visit Reason', value: openAppointment.reason || typeLabel(openAppointment.appointmentType) },
                      { label: 'Phone', value: openAppointment.patientPhone || 'Not recorded' },
                      { label: 'Language', value: patientLanguages.get(openAppointment.patientId) || 'Not recorded' },
                      { label: 'Patient Intake', value: openAppointment.reminderSent ? 'Sent to patient' : 'Not sent to patient' },
                      { label: 'Note', value: openAppointment.notes ? 'Note started' : 'Note not started' },
                      ...(openAppointment.notes ? [{ label: 'Notes', value: openAppointment.notes }] : []),
                    ].map(row => <DetailRow key={row.label} label={row.label} value={row.value} />)
                  ) : (
                    <>
                      {[
                        { label: 'Balance', value: '$0.00' },
                        { label: 'Charge', value: openAppointment.status === 'completed' ? 'Ready for charge capture' : 'Charge not started' },
                        { label: 'Payment Responsibility', value: 'Not recorded' },
                        { label: 'Claim Status', value: 'Not started' },
                        { label: 'Booked By', value: openAppointment.bookedByName || openAppointment.bookedBy || 'Not recorded' },
                        { label: 'Facility', value: openAppointment.facilityName || facilityName || 'Not assigned' },
                        { label: 'Facility Level', value: openAppointment.facilityLevel ? typeLabel(openAppointment.facilityLevel) : 'Not assigned' },
                        { label: 'Reminder', value: openAppointment.reminderSent ? `Sent${openAppointment.reminderChannel ? ` by ${openAppointment.reminderChannel}` : ''}` : 'Not sent' },
                      ].map(row => <DetailRow key={row.label} label={row.label} value={row.value} />)}
                      <div className="appointment-detail-modal__insurance">
                        <div className="appointment-detail-modal__insurance-label">Insurance &amp; Eligibility</div>
                        {openAppointment.patientId ? (
                          <InsuranceSnapshot patientId={openAppointment.patientId} editable />
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No patient linked to this appointment.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="appointment-detail-modal__actions">
                  {isTelehealth(openAppointment) && (
                    <button
                      type="button"
                      className="btn btn-sm appointment-detail-join-btn"
                      onClick={() => joinTelehealth(openAppointment)}
                    >
                      <Video className="w-4 h-4" /> Join Telehealth Visit
                    </button>
                  )}
                  {canConsult && openAppointment.patientId ? (
                    <div className="appointment-detail-modal__split" ref={noteMenuRef}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm appointment-detail-modal__split-main"
                        onClick={() => router.push(`/consultation?patientId=${encodeURIComponent(openAppointment.patientId)}`)}
                      >
                        <Stethoscope className="w-4 h-4" /> Create Clinical Note
                      </button>
                      <button
                        type="button"
                        className="appointment-detail-modal__split-toggle"
                        aria-label="More clinical note options"
                        aria-expanded={detailMenuOpen === 'note'}
                        onClick={() => setDetailMenuOpen(current => (current === 'note' ? null : 'note'))}
                      >
                        {detailMenuOpen === 'note' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {detailMenuOpen === 'note' && (
                        <div className="appointment-detail-modal__menu">
                          <button
                            type="button"
                            onClick={() => { setDetailMenuOpen(null); router.push(`/consultation?patientId=${encodeURIComponent(openAppointment.patientId)}`); }}
                          >
                            <Stethoscope size={14} /> Start consultation
                          </button>
                          <button type="button" onClick={() => { setDetailMenuOpen(null); openPatientRecord(openAppointment); }}>
                            <ClipboardList size={14} /> Open patient record
                          </button>
                          {isTelehealth(openAppointment) && (
                            <button type="button" onClick={() => { setDetailMenuOpen(null); joinTelehealth(openAppointment); }}>
                              <Video size={14} /> Join telehealth visit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => openPatientRecord(openAppointment)}
                    >
                      Open patient record
                    </button>
                  )}
                  <div className="appointment-detail-modal__split" ref={moreMenuRef}>
                    <button
                      type="button"
                      className="appointment-detail-modal__more-toggle"
                      aria-expanded={detailMenuOpen === 'more'}
                      onClick={() => setDetailMenuOpen(current => (current === 'more' ? null : 'more'))}
                    >
                      More Options {detailMenuOpen === 'more' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {detailMenuOpen === 'more' && (
                      <div className="appointment-detail-modal__menu appointment-detail-modal__menu--right">
                        <button
                          type="button"
                          onClick={() => { const id = openAppointment._id; setDetailMenuOpen(null); setOpenAppointment(null); router.push(`/appointments?appointment=${id}`); }}
                        >
                          <Calendar size={14} /> Reschedule or cancel
                        </button>
                        <button type="button" onClick={() => { setDetailMenuOpen(null); window.print(); }}>
                          <Printer size={14} /> Print appointment
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Modal>
          )}
        </main>

        {view === 'dashboard' && railOpen && (
          <button type="button" className="ehr-rail-backdrop" aria-label="Close outstanding items panel" onClick={() => setRailOpen(false)} />
        )}
        {view === 'dashboard' && (
        <aside className={`ehr-right-rail ${railOpen ? 'is-open' : ''}`}>
          <button type="button" className="ehr-rail-close" aria-label="Close panel" onClick={() => setRailOpen(false)}>
            <X className="w-4 h-4" />
          </button>
	          <section className="ehr-side-card ehr-outstanding-card">
	            <div className="ehr-side-card-head">
	              <ClipboardList className="w-5 h-5" />
	              <h2>Outstanding items</h2>
	            </div>
            <div className="ehr-outstanding-chips">
              {outstanding.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => openOutstanding(item)}
                  className={`${item.tone || 'neutral'}${outstandingView === item.label ? ' is-open' : ''}`}
                >
                  <span>{item.label}</span>
                  <b>{item.count}</b>
                </button>
              ))}
            </div>
          </section>

          <section className="ehr-side-card">
            <div className="ehr-side-card-head">
              <ClipboardCheck className="w-5 h-5" />
              <h2>Tamam checklist</h2>
            </div>
            <p>Core workflow coverage for South Sudan facility teams.</p>
            {workflowChecklist.map(item => (
              <label key={item.label} onClick={() => router.push(item.href)}>
                <input type="checkbox" checked={item.done} readOnly />
                {item.label}
              </label>
            ))}
          </section>

          <section className="ehr-side-card ehr-mission-card">
            <div className="ehr-side-card-head ehr-mission-head">
              <Stethoscope className="w-5 h-5" />
              <h2>Direct care first</h2>
            </div>
            <p>Keep the screen dense, fast, and useful for clinics with limited time, bandwidth, and staffing.</p>
          </section>
        </aside>
        )}
      </section>
    </div>
  );
}

/* ─── Day activity chart (left rail) ───
   Compact grouped-bar chart of one day's appointments in two-hour blocks,
   split Inpatient (blue — the patient holds an active ward admission) vs
   Outpatient (orange — everyone else). The ‹ › controls step the focused
   day and stay visible even when the day is empty, so navigation is never
   dead-ended. Cancelled and no-show visits are excluded. Series colors come
   from the --viz-* custom properties on .ehr-day-stats so dark mode swaps
   validated steps rather than dimming the light ones. */
const CHART_HIDDEN_STATUSES: AppointmentStatus[] = ['cancelled', 'no_show'];

function DayActivityChart({ appointments, selectedDate, todayIso, admittedPatientIds }: {
  appointments: AppointmentDoc[]; selectedDate: string; todayIso: string; admittedPatientIds: Set<string>;
}) {
  // Chart-local focus day: follows the dashboard's selected date, but the
  // ‹ › controls can step it independently without changing the schedule.
  const [focusDate, setFocusDate] = useState(selectedDate);
  useEffect(() => { setFocusDate(selectedDate); }, [selectedDate]);
  const stepFocus = (days: number) => setFocusDate(current => toIsoDate(addDays(parseIsoDate(current), days)));

  const dayLabel = focusDate === todayIso
    ? 'Today'
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parseIsoDate(focusDate));
  const seriesNames = ['Inpatient', 'Outpatient'];

  // Two-hour buckets covering the bookable day (07:00–19:00); earlier/later
  // appointments clamp into the first/last block.
  const buckets = [7, 9, 11, 13, 15, 17].map(start => ({ start, counts: [0, 0] }));
  const totals = [0, 0];
  for (const appointment of appointments) {
    if (appointment.appointmentDate !== focusDate || CHART_HIDDEN_STATUSES.includes(appointment.status)) continue;
    const seriesIndex = admittedPatientIds.has(appointment.patientId) ? 0 : 1;
    const hour = parseInt((appointment.appointmentTime || '0').split(':')[0], 10) || 0;
    const bucketIndex = Math.min(Math.max(Math.floor((hour - 7) / 2), 0), buckets.length - 1);
    buckets[bucketIndex].counts[seriesIndex] += 1;
    totals[seriesIndex] += 1;
  }
  const total = totals[0] + totals[1];
  const peak = Math.max(...buckets.map(bucket => Math.max(bucket.counts[0], bucket.counts[1])));
  // Even headroom so the midpoint gridline lands on a whole number.
  const yMax = Math.max(4, Math.ceil(peak / 2) * 2);

  // Geometry: 216×132 viewBox, plot from y=8 (top) to y=112 (baseline),
  // x from 20 (after tick labels) in 32px groups of two 7px bars + 2px gap.
  const plotTop = 8;
  const baseline = 112;
  const plotHeight = baseline - plotTop;
  const barY = (value: number) => baseline - (value / yMax) * plotHeight;
  const ticks = [0, yMax / 2, yMax];
  const seriesFill = ['var(--viz-inpatient)', 'var(--viz-outpatient)'];

  return (
    <div className="ehr-day-stats">
      <div className="ehr-day-stats-head">
        <h3>Day statistics</h3>
        <div className="ehr-day-stats-nav">
          <button type="button" aria-label="Previous day" onClick={() => stepFocus(-1)}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Next day" onClick={() => stepFocus(1)}>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p>
        {dayLabel} · {totals[0]} inpatient · {totals[1]} outpatient
      </p>
      {total === 0 ? (
        <p className="ehr-day-stats-empty">No appointments on this day.</p>
      ) : (
        <>
          <svg viewBox="0 0 216 132" role="img" aria-label={`${dayLabel} appointments by time of day: ${totals[0]} inpatient, ${totals[1]} outpatient`}>
            {ticks.map(tick => (
              <g key={tick}>
                <line x1={20} x2={212} y1={barY(tick)} y2={barY(tick)} stroke="var(--ehr-border)" strokeWidth={1} />
                <text x={16} y={barY(tick) + 2.5} textAnchor="end" fontSize={8} fill="var(--ehr-muted)">{tick}</text>
              </g>
            ))}
            {buckets.map((bucket, index) => {
              const x0 = 20 + index * 32 + 8;
              const hourLabel = `${String(bucket.start).padStart(2, '0')}:00`;
              return (
                <g key={bucket.start}>
                  {bucket.counts.map((count, seriesIndex) => count > 0 && (
                    <rect
                      key={seriesIndex}
                      className="ehr-day-stats-bar"
                      x={x0 + seriesIndex * 9}
                      y={barY(count)}
                      width={7}
                      height={baseline - barY(count)}
                      rx={2}
                      fill={seriesFill[seriesIndex]}
                    >
                      <title>{`${hourLabel} — ${count} ${seriesNames[seriesIndex].toLowerCase()}`}</title>
                    </rect>
                  ))}
                  <text x={x0 + 8} y={126} textAnchor="middle" fontSize={8} fill="var(--ehr-muted)">{hourLabel}</text>
                </g>
              );
            })}
          </svg>
          <div className="ehr-day-stats-legend">
            <span><i style={{ background: 'var(--viz-inpatient)' }} /> Inpatient</span>
            <span><i style={{ background: 'var(--viz-outpatient)' }} /> Outpatient</span>
          </div>
        </>
      )}
    </div>
  );
}
