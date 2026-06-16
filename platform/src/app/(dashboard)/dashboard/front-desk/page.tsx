'use client';

import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usePatients } from '@/lib/hooks/usePatients';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { useTriage } from '@/lib/hooks/useTriage';
import { useMessagingDock } from '@/lib/messaging-dock-context';
import type { AppointmentDoc } from '@/lib/db-types';
import { formatCompactDateTime } from '@/lib/format-utils';
import { patientRegisteredAt, patientFullName, patientGenderAge } from '@/lib/patient-utils';
import PatientName from '@/components/PatientName';
import AssignDoctorModal, { type AssignDoctorTarget } from '@/components/AssignDoctorModal';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useSettings } from '@/lib/settings/SettingsProvider';
import {
  Calendar, ClipboardCheck, ArrowRightLeft, MessageSquare,
  UserPlus, ChevronRight, Shield,
  ClipboardList,
  AlertCircle,
  MapPin, LogOut, Wallet, CheckCircle, X,
  QrCode, Search,
} from '@/components/icons/lucide';

// Exam rooms / bays a walk-in patient can be placed in to meet the provider.
// Fallback used only when facility settings provide no rooms.
const ROOM_OPTIONS = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Bay A', 'Bay B', 'Bay C', 'Bay D'];

const ACCENT = 'var(--accent-primary)';

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

// Final-checkout target: closing out a completed visit at the front desk.
interface CheckoutTarget {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  /** Set when the queue entry came from an appointment. */
  appointmentId?: string;
  /** Set when the queue entry came from triage (walk-in). */
  triageId?: string;
}

export default function FrontDeskDashboardPage() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { canConsult } = usePermissions();
  const { patients } = usePatients();
  const { appointments, updateStatus: updateAppointmentStatus } = useAppointments();
  const { triages, update: updateTriage } = useTriage();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { openDock } = useMessagingDock();
  const { rooms } = useSettings();
  // Reactive room list from facility settings; fall back to the static list.
  const roomOptions = rooms.length ? rooms : ROOM_OPTIONS;

  const [queueFilter, setQueueFilter] = useState<'all' | 'walk-in' | 'appointment' | 'referral'>('all');
  const [queueSearch, setQueueSearch] = useState('');
  const [queueSort, setQueueSort] = useState<'priority' | 'name' | 'time' | 'status'>('priority');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignDoctorTarget | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<AppointmentDoc | null>(null);
  const [roomDraft, setRoomDraft] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // ── Real today's appointments ──
  const todaysAppointments = useMemo(() =>
    appointments
      .filter(a => a.appointmentDate === today && a.status !== 'cancelled')
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)),
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
    type: 'walk-in' | 'appointment' | 'referral' | 'registered';
    priority: 'RED' | 'YELLOW' | 'GREEN' | 'normal';
    complaint: string;
    department: string;
    time: string;
    status: 'WAITING' | 'IN CONSULT' | 'DONE';
    sourceId: string; // triage / appointment / patient ID
    assignedRoom?: string; // OPD exam room/bay (walk-in/triage entries only)
    registeredAt?: string; // registration timestamp (registered entries only — for ordering)
  }

  const queue = useMemo(() => {
    const items: QueueItem[] = [];

    // Add triaged patients (walk-ins and triaged appointments)
    for (const t of todaysTriages) {
      const status = t.status === 'pending' ? 'WAITING' :
                     t.status === 'seen' || t.status === 'admitted' ? 'IN CONSULT' : 'DONE';
      items.push({
        id: `triage-${t._id}`,
        patientId: t.patientId,
        patientName: t.patientName,
        type: 'walk-in',
        priority: t.priority as 'RED' | 'YELLOW' | 'GREEN',
        complaint: t.chiefComplaint || 'ETAT Assessment',
        department: t.chiefComplaint ? suggestDepartment(t.chiefComplaint) : 'Triage',
        time: new Date(t.triagedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status,
        sourceId: t._id,
        assignedRoom: t.assignedRoom,
      });
    }

    // Appointments only join the queue once the patient has CHECKED IN (arrived).
    // Scheduled/confirmed appointments stay in the Today's Appointments card until
    // the receptionist checks them in via the check-in popup.
    const ARRIVED = new Set<AppointmentDoc['status']>(['checked_in', 'in_progress', 'completed']);
    const apptPatientIds = new Set(todaysAppointments.map(a => a.patientId));
    const triagedPatientIds = new Set(todaysTriages.map(t => t.patientId));
    for (const a of todaysAppointments) {
      if (triagedPatientIds.has(a.patientId)) continue;
      if (!ARRIVED.has(a.status)) continue; // not checked in yet → not in the queue
      const status = a.status === 'completed' ? 'DONE' :
                     a.status === 'in_progress' ? 'IN CONSULT' : 'WAITING';
      items.push({
        id: `appt-${a._id}`,
        patientId: a.patientId,
        patientName: a.patientName,
        type: 'appointment',
        priority: a.priority === 'emergency' ? 'RED' : a.priority === 'urgent' ? 'YELLOW' : 'normal',
        complaint: a.reason || 'Scheduled visit',
        department: a.department || 'OPD',
        time: a.appointmentTime,
        status,
        sourceId: a._id,
      });
    }

    // Add recent registrations not already in the queue (replaces the old
    // "Recent Registrations" card — every registered patient awaiting a visit).
    const queuedPatientIds = new Set(items.map(it => it.patientId));
    const recent = [...patients].sort((a, b) =>
      patientRegisteredAt(b).localeCompare(patientRegisteredAt(a)));
    for (const p of recent) {
      if (queuedPatientIds.has(p._id)) continue;
      // A patient with a today's appointment is handled by the check-in flow
      // above — don't also list them as a generic "registered" walk-in.
      if (apptPatientIds.has(p._id)) continue;
      const registeredAt = patientRegisteredAt(p);
      items.push({
        id: `patient-${p._id}`,
        patientId: p._id,
        patientName: patientFullName(p),
        type: 'registered',
        priority: 'normal',
        complaint: 'Newly registered',
        department: patientGenderAge(p),
        time: registeredAt ? formatCompactDateTime(registeredAt) : '—',
        status: 'WAITING',
        sourceId: p._id,
        registeredAt,
      });
    }

    // Sort: RED → YELLOW → GREEN → normal, then registered last (recent first).
    const pOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2, normal: 3 };
    const rank = (it: QueueItem) => it.type === 'registered' ? 4 : (pOrder[it.priority] ?? 3);
    items.sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r) return r;
      if (a.type === 'registered' && b.type === 'registered') {
        return (b.registeredAt || '').localeCompare(a.registeredAt || '');
      }
      return a.time.localeCompare(b.time);
    });

    return items;
  }, [todaysTriages, todaysAppointments, patients]);

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
      const statusOrder: Record<string, number> = { 'WAITING': 0, 'IN CONSULT': 1, 'DONE': 2 };
      items = [...items].sort((a, b) => {
        if (queueSort === 'name') return a.patientName.localeCompare(b.patientName);
        if (queueSort === 'time') return a.time.localeCompare(b.time);
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      });
    }

    return items;
  }, [queue, queueFilter, queueSearch, queueSort]);

  // ── Selected patient previous visit info (from real records) ──
  const selectedPatient = useMemo(() =>
    selectedPatientId ? patients.find(p => p._id === selectedPatientId) : null,
    [selectedPatientId, patients]
  );

  // ── Room assignment (OPD rooming) for triage-sourced queue entries ──
  const handleSaveRoom = useCallback(async (triageId: string, room: string) => {
    setSavingRoom(true);
    try {
      await updateTriage(triageId, { assignedRoom: room || undefined });
      showToast(room ? `Room set to ${room}` : 'Room cleared', 'success');
    } catch {
      showToast('Failed to set room', 'error');
    } finally {
      setSavingRoom(false);
    }
  }, [updateTriage, showToast]);

  // ── Final checkout: close out a completed visit ──
  const handleCompleteCheckout = useCallback(async (target: CheckoutTarget) => {
    try {
      // Stage 10 — Facility checkout gate. Evaluate the documented checkout gate
      // (prescriptions dispensed, critical labs reviewed, …) and advance the
      // clinical encounter to a terminal `discharged` status. Unmet critical
      // items don't block the desk from closing the visit, but they flag it as
      // `discharged_with_pending_items` and warn the receptionist.
      let gateNote = '';
      try {
        const {
          getOpenEncounterForPatient, dischargeEncounter,
        } = await import('@/lib/services/encounter-service');
        const enc = await getOpenEncounterForPatient(target.patientId);
        if (enc) {
          const { getPrescriptionsByPatient } = await import('@/lib/services/prescription-service');
          const { getLabResultsByPatient } = await import('@/lib/services/lab-service');
          const { unmetCriticalGateItems } = await import('@/lib/clinical-flow/encounter-journey');

          const rxs = (await getPrescriptionsByPatient(target.patientId)).filter(r => !r.encounterId || r.encounterId === enc._id);
          // Lab results aren't encounter-linked, so critical labs are checked at
          // patient level (any unreviewed critical result blocks a clean discharge).
          const labs = await getLabResultsByPatient(target.patientId);
          const reviewed = new Set(['reviewed_by_clinician', 'acted_upon', 'communicated_to_patient']);

          const satisfied: string[] = [
            // The clinician closing the visit implies these were handled.
            'all_clinic_visits_closed', 'in_clinic_procedures_complete',
            'required_documentation_generated', 'payment_status_determined',
            'pending_items_flagged',
          ];
          if (rxs.every(r => r.status !== 'pending')) satisfied.push('prescriptions_dispensed');
          if (!labs.some(l => l.critical && l.status === 'completed' && !reviewed.has(l.orderStatus ?? ''))) {
            satisfied.push('critical_labs_reviewed');
          }

          const unmet = unmetCriticalGateItems(satisfied);
          await dischargeEncounter(enc._id, { actorId: currentUser?._id, pendingItems: unmet.length > 0 });
          if (unmet.length > 0) gateNote = ` — flagged: ${unmet.map(u => u.label).join('; ')}`;
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
  const handleCheckIn = useCallback(async (appt: AppointmentDoc) => {
    await updateAppointmentStatus(appt._id, 'checked_in');
    showToast(`${appt.patientName} checked in — added to queue`, 'success');
    setCheckInTarget(null);
  }, [updateAppointmentStatus, showToast]);

  if (!currentUser) return null;

  const hospital = currentUser.hospital;
  const todayDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const priorityColor = (p: string) =>
    p === 'RED' ? '#EF4444' : p === 'YELLOW' ? 'var(--color-warning)' : p === 'GREEN' ? 'var(--color-success)' : 'var(--accent-primary)';
  const statusColor = (s: string) =>
    s === 'WAITING' ? '#2563EB' : s === 'IN CONSULT' ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <TopBar title={t('frontDesk.receptionCenter')} />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* HEADER — stays at top, aligned with the sidebar role card. The extra
            bottom gap drops Quick Actions + Today's Schedule down so they line up
            with the sidebar's "RECEPTION" section label and nav items. */}
        <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 44 }}>
          <div className="flex items-center gap-3">
            <div className="page-header__icon">
              <Shield size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>{t('frontDesk.reception')}</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{todayDate} · {hospital?.name || currentUser.hospitalName || ''}</p>
            </div>
          </div>

          {/* Primary front-desk actions — to the right of the title */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => router.push('/patients')}
              className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
              style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
            >
              <QrCode className="w-[18px] h-[18px]" style={{ color: 'var(--accent-primary)' }} />
              <span className="hidden sm:inline">{t('frontDesk.findPatient')}</span>
            </button>
            <button
              onClick={() => router.push('/patients/new')}
              className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
              style={{ background: 'var(--accent-primary)' }}
            >
              <UserPlus className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">{t('frontDesk.registerNewPatient')}</span>
            </button>
          </div>
        </div>

        {/* PATIENT QUEUE TABLE — below the cards (order: 2) */}
        <div className="dash-card rounded-2xl overflow-hidden mb-4 flex flex-col" style={{ padding: '0', flex: 1, minHeight: 0, order: 2 }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-shrink-0 flex-wrap" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ClipboardList className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('frontDesk.patientQueue')}</span>
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                type="search"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder={t('frontDesk.searchQueue')}
                className="search-icon-input text-xs"
                style={{ background: 'var(--overlay-subtle)', paddingTop: '7px', paddingBottom: '7px' }}
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={queueSort}
                onChange={(e) => setQueueSort(e.target.value as typeof queueSort)}
                aria-label={t('patients.sortBy')}
                className="text-[11px] font-medium px-2 py-1.5 rounded-lg cursor-pointer"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
              >
                <option value="priority">{t('frontDesk.sortPriority')}</option>
                <option value="name">{t('frontDesk.sortName')}</option>
                <option value="time">{t('frontDesk.sortTime')}</option>
                <option value="status">{t('frontDesk.sortStatus')}</option>
              </select>
              <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                {(['all', 'walk-in', 'appointment', 'referral'] as const).map(tab => {
                  const tabCount = tab === 'all' ? queue.length : queue.filter(q => q.type === tab).length;
                  return (
                  <button key={tab} onClick={() => setQueueFilter(tab)} className="px-3 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap" style={{ background: queueFilter === tab ? ACCENT : 'transparent', color: queueFilter === tab ? '#FFF' : 'var(--text-muted)' }}>
                    {tab === 'all' ? t('frontDesk.tabAll') : tab === 'walk-in' ? t('frontDesk.tabWalkIns') : tab === 'appointment' ? t('frontDesk.tabAppts') : t('frontDesk.tabReferrals')}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums" style={{ background: queueFilter === tab ? 'rgba(255,255,255,0.22)' : 'var(--border-light)', color: queueFilter === tab ? '#FFF' : 'var(--text-secondary)' }}>{tabCount}</span>
                  </button>
                  );
                })}
              </div>
              <button onClick={() => router.push('/patients')} className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}>{t('frontDesk.viewAll')} <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                {['23%', '9%', '9%', '21%', '14%', '8%', '8%', '8%'].map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-card, var(--bg-card-solid, #fff))' }}>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {[t('frontDesk.colPatient'), t('frontDesk.colPriority'), t('frontDesk.colType'), t('frontDesk.colComplaint'), t('frontDesk.department'), t('frontDesk.colTime'), t('frontDesk.colStatus'), t('frontDesk.colAction')].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>{t('frontDesk.noPatientsInQueue')}</td></tr>
                ) : filteredQueue.map((entry) => {
                  const pColor = priorityColor(entry.priority);
                  const sColor = statusColor(entry.status);
                  const isOpen = selectedPatientId === entry.patientId;
                  return (
                    <Fragment key={entry.id}>
                    <tr className="cursor-pointer transition-all hover:bg-[var(--overlay-subtle)]" style={{ borderBottom: isOpen ? 'none' : '1px solid var(--border-light)', background: isOpen ? 'var(--overlay-subtle)' : undefined }} onClick={() => setSelectedPatientId(isOpen ? null : entry.patientId)}>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <PatientName name={entry.patientName} size={30} nameClassName="text-[12px] !font-normal" />
                          <div className="flex items-center gap-1 flex-wrap">
                            {entry.assignedRoom && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded w-fit flex items-center gap-0.5" style={{ background: 'var(--accent-light)', color: ACCENT }}>
                                <MapPin className="w-2.5 h-2.5" />{entry.assignedRoom}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><span className="text-[12px] lowercase" style={{ color: pColor }}>{entry.priority}</span></td>
                      <td className="px-3 py-3"><span className="text-[12px] lowercase" style={{ color: entry.type === 'walk-in' ? '#FB923C' : entry.type === 'referral' ? 'var(--color-warning)' : entry.type === 'registered' ? '#64748B' : '#A855F7' }}>{entry.type}</span></td>
                      <td className="px-3 py-3 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{entry.complaint}</td>
                      <td className="px-3 py-3 text-[12px]" style={{ color: 'var(--text-primary)' }}>{entry.department}</td>
                      <td className="px-3 py-3 text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>{entry.time}</td>
                      <td className="px-3 py-3"><span className="text-[12px] lowercase" style={{ color: sColor }}>{entry.status}</span></td>
                      <td className="px-3 py-3">
                        {entry.status !== 'DONE' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const p = patients.find(pp => pp._id === entry.patientId);
                              setAssignTarget({
                                patientId: entry.patientId,
                                patientName: entry.patientName,
                                hospitalNumber: p?.hospitalNumber,
                                triageId: entry.id.startsWith('triage-') ? entry.sourceId : undefined,
                                currentDoctorId: p?.assignedDoctor,
                              });
                            }}
                            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                            style={{ background: ACCENT }}
                          >
                            Assign
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const p = patients.find(pp => pp._id === entry.patientId);
                              setCheckoutTarget({
                                patientId: entry.patientId,
                                patientName: entry.patientName,
                                hospitalNumber: p?.hospitalNumber,
                                appointmentId: entry.id.startsWith('appt-') ? entry.sourceId : undefined,
                                triageId: entry.id.startsWith('triage-') ? entry.sourceId : undefined,
                              });
                            }}
                            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center gap-1"
                            style={{ background: 'var(--color-success)' }}
                          >
                            <LogOut className="w-3 h-3" />Checkout
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && selectedPatient && (
                      <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--overlay-subtle)' }}>
                        <td colSpan={8} className="px-4 pb-3 pt-0">
                          <div className="rounded-xl p-3" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-light)' }}>
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" style={{ color: ACCENT }} />
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{patientFullName(selectedPatient)}</span>
                                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{selectedPatient.hospitalNumber}</span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={(e) => { e.stopPropagation(); router.push(`/patients/${selectedPatient._id}`); }} className="text-[10px] font-semibold px-3 py-1 rounded-md" style={{ color: ACCENT, background: 'var(--accent-light)' }}>{t('frontDesk.viewRecord')}</button>
                                {canConsult && (
                                  <button onClick={(e) => { e.stopPropagation(); router.push(`/consultation?patientId=${selectedPatient._id}`); }} className="text-[10px] font-semibold px-3 py-1 rounded-md text-white" style={{ background: ACCENT }}>{t('frontDesk.startConsultation')}</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setSelectedPatientId(null); }} className="text-[10px] px-2 py-1 rounded-md" style={{ color: 'var(--text-muted)', background: 'var(--overlay-subtle)' }}>{t('action.close')}</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{t('frontDesk.genderAge')}</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{patientGenderAge(selectedPatient)}</p></div>
                              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{t('patient.phone')}</p><p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--text-primary)' }}>{selectedPatient.phone || 'N/A'}</p></div>
                              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{t('patient.location')}</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{selectedPatient.county}, {selectedPatient.state}</p></div>
                              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{t('frontDesk.lastVisit')}</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{selectedPatient.lastConsultedAt ? formatCompactDateTime(selectedPatient.lastConsultedAt) : selectedPatient.lastVisitDate || t('frontDesk.firstVisit')}</p></div>
                            </div>
                            {selectedPatient.allergies?.length > 0 && selectedPatient.allergies[0] !== 'None known' && (
                              <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                <p className="text-[10px] font-semibold" style={{ color: '#EF4444' }}>{t('frontDesk.allergiesLabel', { list: selectedPatient.allergies.join(', ') })}</p>
                              </div>
                            )}
                            {/* OPD rooming — set/edit the exam room/bay (walk-in/triage entries only) */}
                            {entry.id.startsWith('triage-') && (
                              <div className="mt-2.5 pt-2.5 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border-light)' }}>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Exam room</span>
                                </div>
                                <select
                                  value={roomDraft || entry.assignedRoom || ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => { e.stopPropagation(); setRoomDraft(e.target.value); }}
                                  className="text-[11px] rounded-md border px-2 py-1"
                                  style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-input, var(--bg-card-solid))', color: 'var(--text-primary)' }}
                                >
                                  <option value="">— Unassigned —</option>
                                  {roomOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button
                                  disabled={savingRoom}
                                  onClick={(e) => { e.stopPropagation(); handleSaveRoom(entry.sourceId, roomDraft || entry.assignedRoom || ''); setRoomDraft(''); }}
                                  className="text-[10px] font-semibold px-3 py-1 rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                  style={{ background: ACCENT }}
                                >
                                  {savingRoom ? 'Saving…' : entry.assignedRoom ? 'Update room' : 'Assign room'}
                                </button>
                                {entry.assignedRoom && (
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Current: <strong style={{ color: 'var(--text-primary)' }}>{entry.assignedRoom}</strong></span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARDS GRID: Quick Actions + Today's Appointments — above the queue (order: 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3 flex-shrink-0 lg:items-start" style={{ order: 1 }}>

          {/* Quick Actions — compact tile grid (clinician-dashboard style) */}
          <div className="dash-card p-3 flex flex-col lg:self-start" style={{ order: 1 }}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('frontDesk.quickActions')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t('frontDesk.registerNewPatient'), icon: UserPlus, href: '/patients/new', color: 'var(--accent-primary)', bg: 'rgba(59,130,246,0.10)' },
                { label: t('frontDesk.viewReferrals'), icon: ArrowRightLeft, href: '/referrals', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
                { label: t('nav.appointments'), icon: Calendar, href: '/appointments', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
                { label: t('action.sendMessage'), icon: MessageSquare, href: '/messages', color: '#A855F7', bg: 'rgba(168,85,247,0.10)' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => (action.href === '/messages' ? openDock() : router.push(action.href))}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all hover:shadow-sm hover:-translate-y-0.5"
                  style={{ background: action.bg, border: '1px solid var(--border-light)' }}
                >
                  <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-card-solid)' }}>
                    <action.icon className="w-4 h-4" style={{ color: action.color }} />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-left" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Today's Appointments — list card, shows ~one appointment then scrolls */}
          <div className="dash-card overflow-hidden flex flex-col lg:self-start" style={{ order: 2 }}>
            <div className="px-3 py-2.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Calendar className="w-4 h-4" style={{ color: '#2563EB' }} /> {t('frontDesk.todaysAppointments')}
              </h3>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('frontDesk.scheduledCount', { count: todaysAppointments.length })}</span>
                <button onClick={() => router.push('/appointments')} className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}>{t('frontDesk.viewAll')} <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ minHeight: 0, maxHeight: 76 }}>
              {todaysAppointments.length === 0 ? (
                <p className="text-center text-[12px] py-8" style={{ color: 'var(--text-muted)' }}>{t('frontDesk.noAppointmentsToday')}</p>
              ) : todaysAppointments.map(appt => {
                const arrived = appt.status === 'checked_in' || appt.status === 'in_progress' || appt.status === 'completed';
                return (
                <div key={appt._id} onClick={() => setCheckInTarget(appt)} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all hover:bg-[var(--table-row-hover)]" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }} title={t('frontDesk.checkInTitle')}>
                  <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{appt.patientName}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {arrived ? (
                      <span className="text-[10px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle className="w-3 h-3" />{t('frontDesk.checkedIn')}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold" style={{ color: ACCENT }}>{t('frontDesk.checkIn')}</span>
                    )}
                    <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{appt.appointmentTime}</span>
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        </div>

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
            onCollectPayment={(pid) => router.push(`/payments?patientId=${pid}`)}
          />
        )}

        {checkInTarget && (
          <CheckInModal
            appt={checkInTarget}
            onClose={() => setCheckInTarget(null)}
            onCheckIn={handleCheckIn}
            onViewPatient={(pid) => router.push(`/patients/${pid}`)}
          />
        )}
      </main>
    </div>
  );
}

// ── Final-checkout modal: confirm balance settled, mark the visit complete ──
function CheckoutModal({
  target,
  onClose,
  onComplete,
  onCollectPayment,
}: {
  target: CheckoutTarget;
  onClose: () => void;
  onComplete: (target: CheckoutTarget) => Promise<void>;
  onCollectPayment: (patientId: string) => void;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);

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
    })();
    return () => { cancelled = true; };
  }, [target.patientId]);

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
          {balance === null ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Checking balance…</p>
          ) : owes ? (
            <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#EF4444' }}>Outstanding balance</span>
                <Wallet className="w-4 h-4" style={{ color: '#EF4444' }} />
              </div>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#EF4444' }}>SSP {balance.toLocaleString()}</p>
              <button
                onClick={() => onCollectPayment(target.patientId)}
                className="mt-2.5 w-full text-[12px] font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                style={{ background: '#EF4444' }}
              >
                <Wallet className="w-4 h-4" />Collect payment
              </button>
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button
            onClick={async () => { setCompleting(true); await onComplete(target); setCompleting(false); }}
            disabled={completing}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-success)' }}
          >
            <CheckCircle className="w-4 h-4" />
            {completing ? 'Closing…' : 'Complete checkout'}
          </button>
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
  onViewPatient,
}: {
  appt: AppointmentDoc;
  onClose: () => void;
  onCheckIn: (appt: AppointmentDoc) => Promise<void>;
  onViewPatient: (patientId: string) => void;
}) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const alreadyIn = appt.status === 'checked_in' || appt.status === 'in_progress' || appt.status === 'completed';

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
            <DetailRow icon={<Calendar className="w-4 h-4" style={{ color: ACCENT }} />} label={t('frontDesk.colTime')} value={appt.appointmentTime} />
            <DetailRow icon={<ClipboardList className="w-4 h-4" style={{ color: ACCENT }} />} label={t('frontDesk.colComplaint')} value={appt.reason || '—'} />
            <DetailRow icon={<MapPin className="w-4 h-4" style={{ color: ACCENT }} />} label={t('frontDesk.department')} value={appt.department || '—'} />
          </div>
          {alreadyIn && (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-light)' }}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
              <p className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{t('frontDesk.alreadyInQueue')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={() => onViewPatient(appt.patientId)} className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: ACCENT }}>
            {t('frontDesk.viewProfile')}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
              {t('action.cancel')}
            </button>
            {!alreadyIn && (
              <button
                onClick={async () => { setChecking(true); try { await onCheckIn(appt); } finally { setChecking(false); } }}
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
