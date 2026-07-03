'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AppointmentDoc, AppointmentStatus } from '@/lib/db-types';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Plus,
  Printer,
  Search,
  SendHorizontal,
  Stethoscope,
  X,
} from '@/components/icons/lucide';
import { initials, stateColor } from '@/lib/patient-utils';
import AvatarLegend from '@/components/patients/AvatarLegend';
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

type OutstandingItem = {
  label: string;
  count: number;
  tone?: 'neutral' | 'warning' | 'danger';
  href?: string;
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
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const [view, setView] = useState<'dashboard' | 'calendar'>('dashboard');
  const [railOpen, setRailOpen] = useState(false);
  const [appointmentLane, setAppointmentLane] = useState<'scheduled' | 'in_office' | 'finished'>('scheduled');
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [openAppointment, setOpenAppointment] = useState<AppointmentDoc | null>(null);
  const [appointmentDetailTab, setAppointmentDetailTab] = useState<'visit' | 'financial'>('visit');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [locationFilter, setLocationFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState<string[]>([]);

  const openPatientRecord = (appointment: AppointmentDoc) => {
    const patientId = appointment.patientId || patients.find(patient => patient.name === appointment.patientName)?._id;
    if (patientId) router.push(`/patients/${patientId}`);
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

  const selectedAppointmentsForDay = useMemo(() => {
    return appointments
      .filter(appointment => appointment.appointmentDate === selectedDate)
      .filter(appointment => locationFilter === 'all' || appointment.facilityName === locationFilter)
      .filter(matchesProviderFilter)
      .sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''));
  }, [appointments, locationFilter, matchesProviderFilter, selectedDate]);

  const scheduledCount = selectedAppointmentsForDay.filter(appointment => ['scheduled', 'confirmed', 'requested'].includes(appointment.status)).length;
  const inOfficeCount = selectedAppointmentsForDay.filter(appointment => ['checked_in', 'in_progress'].includes(appointment.status)).length;
  const finishedCount = selectedAppointmentsForDay.filter(appointment => appointment.status === 'completed').length;
  const selectedAppointments = selectedAppointmentsForDay.filter(appointment => {
    if (appointmentLane === 'scheduled') return ['scheduled', 'confirmed', 'requested'].includes(appointment.status);
    if (appointmentLane === 'in_office') return ['checked_in', 'in_progress'].includes(appointment.status);
    return appointment.status === 'completed';
  });
  const patientRows = patients.slice(0, 6);
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
            <button type="button" className="ehr-greeting-print" aria-label="Print">
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="ehr-schedule-actions">
          {view === 'dashboard' && outstanding.length > 0 && (
            <button
              type="button"
              className={`ehr-rail-toggle ${outstanding.some(item => item.tone === 'danger') ? 'danger' : outstanding.some(item => item.tone === 'warning') ? 'warning' : ''}`}
              aria-label="Toggle outstanding items panel"
              aria-expanded={railOpen}
              onClick={() => setRailOpen(open => !open)}
            >
              <ClipboardList className="w-4 h-4" /> Outstanding <b>{outstanding.reduce((sum, item) => sum + item.count, 0)}</b>
            </button>
          )}
          <button type="button" aria-label="Print"><Printer className="w-4 h-4" /> Print</button>
          <button type="button" className="primary" aria-label="Send intake" onClick={() => router.push('/patient-intake')}>
            <SendHorizontal className="w-4 h-4" /> Send intake
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
        </aside>

        <main className="ehr-center-panel">
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
	                    <button key={item.label} type="button" onClick={() => item.href && router.push(item.href)} className={`ehr-mobile-day-check ${item.tone || 'neutral'}`}>
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
                    <div className="ehr-patient-icon" style={{ background: stateColor(appointmentTriage(appointment.priority)), color: '#fff' }}>{initials(appointment.patientName)}</div>
                    <div className="ehr-appointment-time">
                      <strong>{appointment.appointmentTime}</strong>
                      <span>{typeLabel(appointment.priority)}</span>
                    </div>
                    <div className="ehr-appointment-main">
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        openPatientRecord(appointment);
                      }}>
                        {appointment.patientName}
                      </button>
                      <p>{appointment.reason || 'General review'} · {appointment.department || typeLabel(appointment.appointmentType)}</p>
                    </div>
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

          {view === 'dashboard' && (
            <>
              <div className="ehr-clinical-strip">
                <button type="button" aria-label="Consultation" onClick={() => router.push('/consultation')}><Plus className="w-4 h-4" /> Consultation</button>
                <button type="button" aria-label="Labs and studies" onClick={() => router.push('/lab')}><FlaskConical className="w-4 h-4" /> Labs / studies</button>
                <button type="button" aria-label="Patient search" onClick={() => router.push('/patients')}><Search className="w-4 h-4" /> Patient search</button>
                <button type="button" aria-label="Intake review" onClick={() => router.push('/patient-intake')}><ClipboardList className="w-4 h-4" /> Intake review</button>
              </div>

		              <section className="ehr-worklist-panel">
		                <div>
		                  <h3>Assigned patients</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <AvatarLegend />
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
	                      No patients are assigned to you right now.
                      <button type="button" onClick={() => router.push('/patients')}>Open patient registry</button>
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
            <>
              <button
                type="button"
                className="appointment-detail-backdrop"
                aria-label="Close appointment details"
                onClick={() => setOpenAppointment(null)}
              />
              <aside className="appointment-detail-sidebar" aria-label="Appointment details" role="dialog" aria-modal="true">
                <div className="appointment-detail-sidebar__header">
                  <button type="button" className="appointment-detail-sidebar__back" onClick={() => setOpenAppointment(null)} aria-label="Close appointment details">
                    <ChevronLeft size={22} />
                  </button>
                  <div className="appointment-detail-sidebar__title">
                    <h2>{openAppointment.patientName}</h2>
                    <button
                      type="button"
                      onClick={() => openPatientRecord(openAppointment)}
                    >
                      Open patient record
                    </button>
                    <p className="appointment-detail-sidebar__time">{appointmentTimeRange(openAppointment)}</p>
                    <p>{formatAppointmentDate(openAppointment.appointmentDate)}</p>
                  </div>
                  <div className="appointment-detail-sidebar__status">
                    <span>{statusLabel(openAppointment.status)}</span>
                    <span>{typeLabel(openAppointment.priority)}</span>
                  </div>
                  <button type="button" className="appointment-detail-sidebar__close" onClick={() => setOpenAppointment(null)} aria-label="Close appointment details">
                    <X size={16} />
                  </button>
                </div>

                <div className="appointment-detail-sidebar__tabs" role="tablist" aria-label="Appointment detail sections">
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

                <div className="appointment-detail-sidebar__body" role="tabpanel">
                  {(appointmentDetailTab === 'visit'
                    ? [
                        { label: 'Resources', value: openAppointment.providerName || clinicianName || 'Unassigned' },
                        { label: 'Appointment Mode', value: openAppointment.appointmentType === 'telehealth' ? 'Telehealth' : openAppointment.appointmentType === 'walk_in' ? 'Walk-in' : 'In Office' },
                        { label: 'Date', value: formatAppointmentDate(openAppointment.appointmentDate) },
                        { label: 'Time', value: appointmentTimeRange(openAppointment) },
                        { label: 'Duration', value: `${openAppointment.duration} minutes` },
                        { label: 'Location', value: openAppointment.facilityName || facilityName || 'Not assigned' },
                        { label: 'Department', value: openAppointment.department || 'Not assigned' },
                        { label: 'Visit Reason', value: openAppointment.reason || typeLabel(openAppointment.appointmentType) },
                        { label: 'Phone', value: openAppointment.patientPhone || 'Not recorded' },
                        { label: 'Patient Intake', value: openAppointment.reminderSent ? 'Sent to patient' : 'Not sent to patient' },
                        { label: 'Note', value: openAppointment.notes ? 'Note started' : 'Note not started' },
                        ...(openAppointment.notes ? [{ label: 'Notes', value: openAppointment.notes }] : []),
                      ]
                    : [
                        { label: 'Balance', value: '$0.00' },
                        { label: 'Charge', value: openAppointment.status === 'completed' ? 'Ready for charge capture' : 'Charge not started' },
                        { label: 'Payment Responsibility', value: 'Not recorded' },
                        { label: 'Insurance', value: 'Not recorded' },
                        { label: 'Claim Status', value: 'Not started' },
                        { label: 'Booked By', value: openAppointment.bookedByName || openAppointment.bookedBy || 'Not recorded' },
                        { label: 'Facility', value: openAppointment.facilityName || facilityName || 'Not assigned' },
                        { label: 'Facility Level', value: openAppointment.facilityLevel ? typeLabel(openAppointment.facilityLevel) : 'Not assigned' },
                        { label: 'Reminder', value: openAppointment.reminderSent ? `Sent${openAppointment.reminderChannel ? ` by ${openAppointment.reminderChannel}` : ''}` : 'Not sent' },
                      ]).map(row => (
                    <DetailRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </div>

                <div className="appointment-detail-sidebar__actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => openPatientRecord(openAppointment)}
                  >
                    {openAppointment.patientName}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.push(`/appointments?appointment=${openAppointment._id}`)}>
                    Open schedule
                  </button>
                </div>
              </aside>
            </>
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
                <button key={item.label} type="button" onClick={() => item.href && router.push(item.href)} className={item.tone || 'neutral'}>
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
