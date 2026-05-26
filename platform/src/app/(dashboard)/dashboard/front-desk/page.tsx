'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { useTriage } from '@/lib/hooks/useTriage';
import { formatCompactDateTime } from '@/lib/format-utils';
import { useToast } from '@/components/Toast';
import {
  Users, Calendar, ClipboardCheck, ArrowRightLeft, MessageSquare,
  UserPlus, Clock, ChevronRight, Shield, Wifi,
  LogIn, Bell, ClipboardList,
  Eye, EyeOff, CheckCircle, AlertTriangle, Zap, Stethoscope,
  AlertCircle,
} from '@/components/icons/lucide';

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

export default function FrontDeskDashboardPage() {
  const router = useRouter();
  const { currentUser, globalSearch } = useApp();
  const { patients } = usePatients();
  const { referrals, updateStatus } = useReferrals();
  const { appointments, updateStatus: updateAppointmentStatus } = useAppointments();
  const { triages } = useTriage();
  const { showToast } = useToast();

  const [queueFilter, setQueueFilter] = useState<'all' | 'walk-in' | 'appointment' | 'referral'>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [expandedReferralId, setExpandedReferralId] = useState<string | null>(null);
  const [patientBalances, setPatientBalances] = useState<Record<string, number>>({});

  const today = new Date().toISOString().slice(0, 10);
  const facilityId = currentUser?.hospitalId || '';

  // Load patient balances
  useEffect(() => {
    const loadBalances = async () => {
      try {
        const { getPatientBalance } = await import('@/lib/services/ledger-service');
        const balanceMap: Record<string, number> = {};
        const patientIds = [...new Set(appointments.map(a => a.patientId).filter(Boolean))];
        for (const pid of patientIds) {
          const balance = await getPatientBalance(pid);
          if (balance > 0) balanceMap[pid] = balance;
        }
        setPatientBalances(balanceMap);
      } catch {
        // Silently ignore errors in loading balances
      }
    };
    if (appointments.length > 0) loadBalances();
  }, [appointments]);

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

  const activeTriages = useMemo(() =>
    todaysTriages.filter(t => t.status === 'pending' || t.status === 'seen'),
    [todaysTriages]
  );

  // ── Unified queue: triaged walk-ins + appointments ──
  interface QueueItem {
    id: string;
    patientId: string;
    patientName: string;
    type: 'walk-in' | 'appointment' | 'referral';
    priority: 'RED' | 'YELLOW' | 'GREEN' | 'normal';
    complaint: string;
    department: string;
    time: string;
    status: 'WAITING' | 'IN CONSULT' | 'DONE';
    sourceId: string; // triage or appointment ID
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
      });
    }

    // Add appointments not already triaged
    const triagedPatientIds = new Set(todaysTriages.map(t => t.patientId));
    for (const a of todaysAppointments) {
      if (triagedPatientIds.has(a.patientId)) continue;
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

    // Sort: RED first, then YELLOW, then GREEN, then normal. Within same priority, by time.
    const pOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2, normal: 3 };
    items.sort((a, b) => (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3) || a.time.localeCompare(b.time));

    return items;
  }, [todaysTriages, todaysAppointments]);

  const filteredQueue = useMemo(() => {
    if (queueFilter === 'all') return queue;
    return queue.filter(q => q.type === queueFilter);
  }, [queue, queueFilter]);

  // ── Incoming referrals ──
  const incomingReferrals = useMemo(() =>
    referrals
      .filter(r => r.toHospitalId === facilityId && (r.status === 'sent' || r.status === 'received'))
      .sort((a, b) => {
        const urgencyOrder: Record<string, number> = { emergency: 0, urgent: 1, routine: 2 };
        return (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2);
      }),
    [referrals, facilityId]
  );

  // ── Selected patient previous visit info (from real records) ──
  const selectedPatient = useMemo(() =>
    selectedPatientId ? patients.find(p => p._id === selectedPatientId) : null,
    [selectedPatientId, patients]
  );

  // ── Recent registrations (today) ──
  const recentPatients = useMemo(() =>
    [...patients]
      .sort((a, b) => (b.registeredAt || b.registrationDate || '').localeCompare(a.registeredAt || a.registrationDate || ''))
      .filter(p =>
        !globalSearch ||
        `${p.firstName} ${p.surname}`.toLowerCase().includes(globalSearch.toLowerCase()) ||
        p.hospitalNumber.toLowerCase().includes(globalSearch.toLowerCase())
      )
      .slice(0, 8),
    [patients, globalSearch]
  );

  const pendingReferrals = referrals.filter(r => r.status === 'sent' || r.status === 'received');

  // ── Handle referral check-in ──
  const handleReferralCheckIn = useCallback(async (referral: typeof referrals[0]) => {
    try {
      await updateStatus(referral._id, 'received');
      showToast(`Patient ${referral.patientName} checked in from referral`, 'success');
    } catch {
      showToast('Failed to check in referral patient', 'error');
    }
  }, [updateStatus, showToast]);

  // ── Handle appointment check-in ──
  const handleCheckIn = useCallback(async (appointmentId: string, patientName: string) => {
    try {
      await updateAppointmentStatus(appointmentId, 'checked_in');
      showToast(`${patientName} checked in successfully`, 'success');
    } catch {
      showToast('Failed to check in patient', 'error');
    }
  }, [updateAppointmentStatus, showToast]);

  if (!currentUser) return null;

  const hospital = currentUser.hospital;
  const todayDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const waitingCount = queue.filter(q => q.status === 'WAITING').length;
  const inConsultCount = queue.filter(q => q.status === 'IN CONSULT').length;

  const priorityColor = (p: string) =>
    p === 'RED' ? '#EF4444' : p === 'YELLOW' ? 'var(--color-warning)' : p === 'GREEN' ? 'var(--color-success)' : 'var(--accent-primary)';
  const statusColor = (s: string) =>
    s === 'WAITING' ? '#5CB8A8' : s === 'IN CONSULT' ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <TopBar title="Reception Center" />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: ACCENT }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>Reception</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{todayDate} · {hospital?.name || currentUser.hospitalName || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <Wifi className="w-3 h-3" style={{ color: 'var(--color-success)' }} />
            <span>Connected</span>
          </div>
        </div>

        {/* KPI STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {[
            { label: 'Total Queue', value: queue.length, icon: ClipboardList, color: ACCENT },
            { label: 'Waiting', value: waitingCount, icon: Clock, color: '#FB923C' },
            { label: 'In Consult', value: inConsultCount, icon: Stethoscope, color: 'var(--color-success)' },
            { label: 'Appointments', value: todaysAppointments.length, icon: Calendar, color: '#5CB8A8' },
            { label: 'Triaged', value: todaysTriages.length, icon: AlertTriangle, color: '#EC4899' },
            { label: 'Referrals In', value: incomingReferrals.length, icon: ArrowRightLeft, color: 'var(--color-warning)' },
            { label: 'Registered', value: recentPatients.length, icon: UserPlus, color: '#5CB8A8' },
            { label: 'RED Priority', value: activeTriages.filter(t => t.priority === 'RED').length, icon: Bell, color: '#EF4444' },
          ].map((kpi) => (
            <div key={kpi.label} className="dash-stat">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className="w-3 h-3" style={{ color: kpi.color }} />
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{kpi.label}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* INCOMING REFERRALS */}
        {incomingReferrals.length > 0 && (
          <div className="dash-card rounded-2xl overflow-hidden mb-4 flex flex-col" style={{ padding: '0', maxHeight: 280 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" style={{ color: '#FB923C' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Incoming Referrals</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(251,146,60,0.12)', color: '#FB923C' }}>{incomingReferrals.length}</span>
              </div>
            </div>
            <div className="p-3 space-y-2" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {incomingReferrals.map(ref => {
                const isExpanded = expandedReferralId === ref._id;
                const urgencyColor = ref.urgency === 'emergency' ? '#EF4444' : ref.urgency === 'urgent' ? 'var(--color-warning)' : 'var(--color-success)';
                const UrgencyIcon = ref.urgency === 'emergency' ? Zap : ref.urgency === 'urgent' ? AlertTriangle : CheckCircle;
                return (
                  <div key={ref._id} className="rounded-xl overflow-hidden" style={{ background: ref.urgency === 'emergency' ? 'rgba(239,68,68,0.04)' : 'var(--overlay-subtle)', border: `1px solid ${ref.urgency === 'emergency' ? 'rgba(239,68,68,0.2)' : 'var(--border-light)'}` }}>
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: ref.urgency === 'emergency' ? '#EF4444' : ACCENT }}>
                        {ref.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ref.patientName}</span>
                          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${urgencyColor}12`, color: urgencyColor }}>
                            <UrgencyIcon className="w-2.5 h-2.5" style={{ color: urgencyColor }} />
                            {ref.urgency.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>From: {ref.fromHospital} · {ref.reason}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setExpandedReferralId(isExpanded ? null : ref._id)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                          {isExpanded ? <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} /> : <Eye className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />}
                        </button>
                        <button onClick={() => handleReferralCheckIn(ref)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-white" style={{ background: ACCENT }}>
                          <LogIn className="w-3 h-3" /> Check In
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg mt-2" style={{ background: 'var(--overlay-subtle)' }}>
                          <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Reason</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{ref.reason}</p></div>
                          <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Doctor</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{ref.referringDoctor}</p></div>
                          <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Department</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{ref.department}</p></div>
                          <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Date</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{new Date(ref.referralDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PATIENT QUEUE TABLE */}
        <div className="dash-card rounded-2xl overflow-hidden mb-4 flex flex-col" style={{ padding: '0', maxHeight: 'min(50vh, 480px)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Patient Queue</span>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6' }}>LIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                {(['all', 'walk-in', 'appointment', 'referral'] as const).map(tab => (
                  <button key={tab} onClick={() => setQueueFilter(tab)} className="px-3 py-1 rounded-md text-[10px] font-semibold transition-all" style={{ background: queueFilter === tab ? ACCENT : 'transparent', color: queueFilter === tab ? '#FFF' : 'var(--text-muted)' }}>
                    {tab === 'all' ? 'All' : tab === 'walk-in' ? 'Walk-ins' : tab === 'appointment' ? 'Appts' : 'Referrals'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{filteredQueue.length} patients</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table className="w-full">
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-card, var(--bg-card-solid, #fff))' }}>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {['#', 'Patient', 'Priority', 'Type', 'Complaint', 'Department', 'Time', 'Status', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>No patients in queue</td></tr>
                ) : filteredQueue.map((entry, idx) => {
                  const pColor = priorityColor(entry.priority);
                  const sColor = statusColor(entry.status);
                  return (
                    <tr key={entry.id} className="cursor-pointer transition-all hover:bg-[var(--overlay-subtle)]" style={{ borderBottom: '1px solid var(--border-light)' }} onClick={() => setSelectedPatientId(entry.patientId)}>
                      <td className="px-3 py-2.5 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: ACCENT }}>
                            {entry.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{entry.patientName}</span>
                            {patientBalances[entry.patientId] && (
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded w-fit" style={{ background: '#EF444415', color: '#EF4444' }}>
                                Balance: SSP {patientBalances[entry.patientId]}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${pColor}15`, color: pColor }}>{entry.priority}</span></td>
                      <td className="px-3 py-2.5"><span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: entry.type === 'walk-in' ? 'rgba(251,146,60,0.1)' : entry.type === 'referral' ? 'rgba(234,179,8,0.1)' : 'rgba(168,85,247,0.1)', color: entry.type === 'walk-in' ? '#FB923C' : entry.type === 'referral' ? 'var(--color-warning)' : '#A855F7' }}>{entry.type.toUpperCase()}</span></td>
                      <td className="px-3 py-2.5 text-[10px] max-w-[160px] truncate" style={{ color: 'var(--text-secondary)' }}>{entry.complaint}</td>
                      <td className="px-3 py-2.5 text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>{entry.department}</td>
                      <td className="px-3 py-2.5 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{entry.time}</td>
                      <td className="px-3 py-2.5"><span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${sColor}15`, color: sColor }}>{entry.status}</span></td>
                      <td className="px-3 py-2.5">
                        {entry.status === 'WAITING' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/consultation?patientId=${entry.patientId}`);
                            }}
                            className="text-[9px] font-bold px-2 py-1 rounded-md text-white"
                            style={{ background: ACCENT }}
                          >
                            Send to Doctor
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SELECTED PATIENT INFO */}
        {selectedPatient && (
          <div className="dash-card rounded-2xl overflow-hidden mb-4 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedPatient.firstName} {selectedPatient.surname}</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{selectedPatient.hospitalNumber}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => router.push(`/patients/${selectedPatient._id}`)} className="text-[10px] font-semibold px-3 py-1 rounded-md" style={{ color: ACCENT, background: 'var(--accent-light)' }}>View Record</button>
                <button onClick={() => router.push(`/consultation?patientId=${selectedPatient._id}`)} className="text-[10px] font-semibold px-3 py-1 rounded-md text-white" style={{ background: ACCENT }}>Start Consultation</button>
                <button onClick={() => setSelectedPatientId(null)} className="text-[10px] px-2 py-1 rounded-md" style={{ color: 'var(--text-muted)', background: 'var(--overlay-subtle)' }}>Close</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Gender / Age</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{selectedPatient.gender} · {selectedPatient.estimatedAge || (selectedPatient.dateOfBirth ? new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear() : '?')}y</p></div>
              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Phone</p><p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--text-primary)' }}>{selectedPatient.phone || 'N/A'}</p></div>
              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Location</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{selectedPatient.county}, {selectedPatient.state}</p></div>
              <div><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Last Visit</p><p className="text-[11px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{selectedPatient.lastConsultedAt ? formatCompactDateTime(selectedPatient.lastConsultedAt) : selectedPatient.lastVisitDate || 'First visit'}</p></div>
            </div>
            {selectedPatient.allergies?.length > 0 && selectedPatient.allergies[0] !== 'None known' && (
              <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#EF4444' }}>Allergies: {selectedPatient.allergies.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM GRID: Appointments + Registrations + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" style={{ flex: 1, minHeight: 340 }}>

          {/* Today's Appointments */}
          <div className="dash-card rounded-2xl overflow-hidden flex flex-col" style={{ padding: '0' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: '#5CB8A8' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Today&apos;s Appointments</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{todaysAppointments.length} scheduled</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ minHeight: 0 }}>
              {todaysAppointments.length === 0 ? (
                <p className="text-center text-xs py-6" style={{ color: 'var(--text-muted)' }}>No appointments scheduled for today</p>
              ) : todaysAppointments.map(appt => {
                const sColor = appt.status === 'completed' ? 'var(--color-success)' : appt.status === 'checked_in' || appt.status === 'in_progress' ? 'var(--color-warning)' : '#5CB8A8';
                return (
                  <div key={appt._id} className="p-2.5 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{appt.patientName}</span>
                        {patientBalances[appt.patientId] && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: '#EF444415', color: '#EF4444' }}>
                            Balance: SSP {patientBalances[appt.patientId]}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${sColor}15`, color: sColor }}>{appt.status.toUpperCase().replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{appt.department} · {appt.providerName}</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{appt.appointmentTime}</span>
                    </div>
                    {appt.status === 'scheduled' || appt.status === 'confirmed' ? (
                      <button onClick={() => handleCheckIn(appt._id, appt.patientName)} className="mt-1.5 w-full text-[10px] font-semibold py-1 rounded-md text-white" style={{ background: ACCENT }}>
                        Check In
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Registrations */}
          <div className="dash-card rounded-2xl overflow-hidden flex flex-col" style={{ padding: '0' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Registrations</span>
              </div>
              <button onClick={() => router.push('/patients')} className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}>View all <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ minHeight: 0 }}>
              {recentPatients.map(patient => (
                <div key={patient._id} className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-[var(--accent-light)]" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }} onClick={() => router.push(`/patients/${patient._id}`)}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: ACCENT }}>
                    {(patient.firstName || '?')[0]}{(patient.surname || '?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{patient.firstName} {patient.surname}</p>
                    <p className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{patient.hospitalNumber} · {patient.gender} · {patient.estimatedAge || (patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : '?')}y</p>
                  </div>
                  <span className="text-[9px] font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{formatCompactDateTime(patient.registeredAt || patient.registrationDate)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dash-card rounded-2xl p-4 flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: 'Register New Patient', icon: UserPlus, href: '/patients/new', color: ACCENT },
                { label: 'Find Patient (QR / ID)', icon: ClipboardCheck, href: '/patients', color: 'var(--color-success)' },
                { label: 'View Referrals', icon: ArrowRightLeft, href: '/referrals', color: 'var(--color-warning)' },
                { label: 'Appointments', icon: Calendar, href: '/appointments', color: '#5CB8A8' },
                { label: 'Send Message', icon: MessageSquare, href: '/messages', color: '#A855F7' },
              ].map(action => (
                <button key={action.label} onClick={() => router.push(action.href)} className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-[var(--accent-light)]" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${action.color}12` }}>
                    <action.icon className="w-4 h-4" style={{ color: action.color }} />
                  </div>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>

            {/* Queue Summary */}
            <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Queue Summary</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Waiting', value: waitingCount, color: '#5CB8A8' },
                  { label: 'In Consult', value: inConsultCount, color: 'var(--color-warning)' },
                  { label: 'Referrals', value: pendingReferrals.length, color: '#FB923C' },
                ].map(stat => (
                  <div key={stat.label} className="text-center p-2 rounded-lg" style={{ background: `${stat.color}08` }}>
                    <p className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
