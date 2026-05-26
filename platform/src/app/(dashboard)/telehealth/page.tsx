'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import {
  Video, Plus, Phone, PhoneOff, Clock, CheckCircle2, XCircle,
  Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MessageSquare, FileText,
  Star, Shield, X, WifiOff,
  Calendar, DollarSign, Lock,
  Filter, UserPlus, ExternalLink,
} from '@/components/icons/lucide';
import { useTelehealth, useTelehealthStats } from '@/lib/hooks/useTelehealth';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { usePatients } from '@/lib/hooks/usePatients';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import type { TelehealthType, TelehealthStatus, TelehealthSessionDoc } from '@/lib/db-types';

/* ─── Config ─── */
const statusConfig: Record<TelehealthStatus, { color: string; bg: string; label: string; icon: typeof Video }> = {
  scheduled: { color: 'var(--accent-primary)', bg: 'rgba(0,119,215,0.08)', label: 'Scheduled', icon: Calendar },
  waiting_room: { color: 'var(--color-warning)', bg: 'rgba(217,119,6,0.08)', label: 'Waiting', icon: Clock },
  in_session: { color: 'var(--color-success)', bg: 'rgba(5,150,105,0.08)', label: 'In Session', icon: Video },
  completed: { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.08)', label: 'Completed', icon: CheckCircle2 },
  cancelled: { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.08)', label: 'Cancelled', icon: XCircle },
  failed: { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', label: 'Failed', icon: WifiOff },
  no_show: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', label: 'No Show', icon: XCircle },
};

const typeConfig: Record<TelehealthType, { label: string; icon: typeof Video }> = {
  video: { label: 'Video', icon: Video },
  audio: { label: 'Audio', icon: Phone },
  chat: { label: 'Chat', icon: MessageSquare },
};

const paymentLabels: Record<string, { color: string; label: string }> = {
  pending: { color: 'var(--color-warning)', label: 'Pending' },
  paid: { color: 'var(--color-success)', label: 'Paid' },
  waived: { color: '#6B7280', label: 'Waived' },
  insurance: { color: 'var(--accent-primary)', label: 'Insurance' },
};

const timeSlots = Array.from({ length: 24 }, (_, h) =>
  ['00', '30'].map(m => `${h.toString().padStart(2, '0')}:${m}`)
).flat().filter(t => { const h = parseInt(t.split(':')[0]); return h >= 7 && h <= 20; });

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function fmtDate(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

/* ─── Page ─── */
export default function TelehealthPage() {
  const { sessions, create, updateStatus, addNotes, rate, update } = useTelehealth();
  const { stats } = useTelehealthStats();
  const { appointments } = useAppointments();
  const { patients } = usePatients();
  const { currentUser, globalSearch } = useApp();
  const { showToast } = useToast();

  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Calendar
  const todayObj = new Date();
  const [calMonth, setCalMonth] = useState(todayObj.getMonth());
  const [calYear, setCalYear] = useState(todayObj.getFullYear());

  // Form
  const [formPatient, setFormPatient] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState('09:00');
  const [formType, setFormType] = useState<TelehealthType>('video');
  const [formComplaint, setFormComplaint] = useState('');
  const [formFee, setFormFee] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Notes/Rating
  const [notesId, setNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [notesDx, setNotesDx] = useState('');
  const [notesIcd, setNotesIcd] = useState('');
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratingVal, setRatingVal] = useState(5);
  const [ratingFb, setRatingFb] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  // Telehealth appointments (type === 'telehealth')
  const telehealthAppointments = useMemo(() => appointments.filter(a => a.appointmentType === 'telehealth'), [appointments]);

  // Calendar days
  const calDays = useMemo(() => {
    const total = getDaysInMonth(calYear, calMonth);
    const first = getFirstDay(calYear, calMonth);
    const days: { day: number; date: string; isToday: boolean; isCurrent: boolean }[] = [];
    const prevTotal = getDaysInMonth(calYear, calMonth - 1);
    for (let i = first - 1; i >= 0; i--) {
      const d = prevTotal - i;
      const m = calMonth === 0 ? 11 : calMonth - 1;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      days.push({ day: d, date: fmtDate(y, m, d), isToday: false, isCurrent: false });
    }
    for (let d = 1; d <= total; d++) {
      const date = fmtDate(calYear, calMonth, d);
      days.push({ day: d, date, isToday: date === today, isCurrent: true });
    }
    const rem = 42 - days.length;
    for (let d = 1; d <= rem; d++) {
      const m = calMonth === 11 ? 0 : calMonth + 1;
      const y = calMonth === 11 ? calYear + 1 : calYear;
      days.push({ day: d, date: fmtDate(y, m, d), isToday: false, isCurrent: false });
    }
    return days;
  }, [calYear, calMonth, today]);

  // Events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, { telehealth: number; appointments: number; active: number }> = {};
    sessions.forEach(s => {
      if (!map[s.scheduledDate]) map[s.scheduledDate] = { telehealth: 0, appointments: 0, active: 0 };
      map[s.scheduledDate].telehealth++;
      if (s.status === 'in_session' || s.status === 'waiting_room') map[s.scheduledDate].active++;
    });
    telehealthAppointments.forEach(a => {
      if (!map[a.appointmentDate]) map[a.appointmentDate] = { telehealth: 0, appointments: 0, active: 0 };
      map[a.appointmentDate].appointments++;
    });
    return map;
  }, [sessions, telehealthAppointments]);

  // Filtered sessions
  const filtered = useMemo(() => {
    let list = sessions;
    if (selectedDate) list = list.filter(s => s.scheduledDate === selectedDate);
    const q = `${search} ${globalSearch}`.toLowerCase().trim();
    if (q) list = list.filter(s => s.patientName.toLowerCase().includes(q) || s.providerName.toLowerCase().includes(q) || s.chiefComplaint.toLowerCase().includes(q));
    // Copy before sorting so we never mutate the `sessions` state in-place
    // (which would happen when no filter is applied and `list === sessions`).
    return [...list].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [sessions, selectedDate, search, globalSearch]);

  // Filtered telehealth appointments for selected date
  const filteredAppts = useMemo(() => {
    if (!selectedDate) return telehealthAppointments;
    return telehealthAppointments.filter(a => a.appointmentDate === selectedDate);
  }, [telehealthAppointments, selectedDate]);

  const resetForm = () => { setFormPatient(''); setFormComplaint(''); setFormFee(''); setFormDate(new Date().toISOString().slice(0, 10)); setFormTime('09:00'); setFormType('video'); };

  const handleCreate = async () => {
    if (!formPatient || !formDate || !formTime || !formComplaint) { showToast('Fill required fields', 'error'); return; }
    const patient = patients.find(p => p._id === formPatient);
    if (!patient) { showToast('Select a patient', 'error'); return; }
    setSubmitting(true);
    try {
      await create({
        patientId: patient._id, patientName: `${patient.firstName} ${patient.surname}`,
        patientPhone: patient.phone || undefined, providerId: currentUser?._id || '',
        providerName: currentUser?.name || '', providerRole: currentUser?.role || 'doctor',
        facilityId: currentUser?.hospitalId || '', facilityName: currentUser?.hospitalName || '',
        sessionType: formType, scheduledDate: formDate, scheduledTime: formTime,
        status: 'scheduled', chiefComplaint: formComplaint, followUpRequired: false,
        referralRequired: false, connectionDrops: 0, patientConsentGiven: false,
        sessionRecorded: false, consultationFee: formFee ? parseFloat(formFee) : undefined,
        currency: 'USD', paymentStatus: formFee ? 'pending' : undefined,
        state: '', orgId: currentUser?.orgId,
      });
      showToast('Session scheduled', 'success'); setShowNewForm(false); resetForm();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleJoin = useCallback(async (s: TelehealthSessionDoc) => {
    if (!s.patientConsentGiven) await update(s._id, { patientConsentGiven: true, consentTimestamp: new Date().toISOString() });
    await updateStatus(s._id, 'in_session');
    showToast(`Session started — Room: ${s.roomId}`, 'success');
  }, [update, updateStatus, showToast]);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };
  const goToday = () => { setCalMonth(todayObj.getMonth()); setCalYear(todayObj.getFullYear()); setSelectedDate(today); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <TopBar />
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PageHeader
          icon={Video}
          title="Telehealth"
          subtitle="Virtual consultations · ISO 13131 compliant"
          actions={
            <button onClick={() => setShowNewForm(true)} className="btn btn-primary" style={{ gap: 6 }}>
              <Plus size={16} /> New Session
            </button>
          }
        />

        {/* ═══ Quick Stats ═══ */}
        {stats && (
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            {[
              { label: "Today's Sessions", value: stats.todayTotal, icon: Calendar, color: 'var(--accent-primary)' },
              { label: 'Active Now', value: stats.todayActive, icon: Video, color: 'var(--color-success)' },
              { label: 'Completed', value: stats.completedTotal, icon: CheckCircle2, color: 'var(--color-success)' },
              { label: 'Avg Duration', value: `${stats.avgDuration}m`, icon: Clock, color: 'var(--color-warning)' },
              { label: 'Avg Rating', value: stats.avgRating > 0 ? `${stats.avgRating}/5` : '—', icon: Star, color: 'var(--color-warning)' },
              { label: 'Telehealth Bookings', value: telehealthAppointments.length, icon: UserPlus, color: '#7C3AED' },
            ].map((c, i) => (
              <div key={i} className="card-elevated" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <c.icon size={16} style={{ color: c.color, opacity: 0.8 }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
                </div>
                <div className="stat-value text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ Action Bar ═══ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
            {(['calendar', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: view === v ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}>
                {v === 'calendar' ? 'Calendar' : 'List'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary" style={{ gap: 6 }}>
            <Filter size={14} /> Filters
          </button>
          <div style={{ flex: 1 }} />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="card-elevated" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients, providers..." style={{ paddingLeft: 32 }} />
            </div>
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                <X size={12} /> Clear date
              </button>
            )}
          </div>
        )}

        {/* Compliance banner */}
        <div className="card-elevated" style={{
          padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Shield size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--accent-primary)' }}>ISO 13131</strong> &middot; Patient consent required &middot; End-to-end encrypted &middot; Quality monitored
          </span>
        </div>

        {/* ═══ Calendar ═══ */}
        {view === 'calendar' && (
          <div className="card-elevated" style={{ overflow: 'hidden', marginBottom: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-medium)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={prevMonth} style={calBtn}><ChevronLeft size={16} /></button>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', minWidth: 160, textAlign: 'center' }}>{MONTHS[calMonth]} {calYear}</h3>
                <button onClick={nextMonth} style={calBtn}><ChevronRight size={16} /></button>
              </div>
              <button onClick={goToday} className="btn btn-secondary btn-sm">Today</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {WEEKDAYS.map(d => (
                <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-medium)' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gridAutoRows: '1fr' }}>
              {calDays.map((day, i) => {
                const ev = eventsByDate[day.date];
                const isSel = selectedDate === day.date;
                return (
                  <button key={i} onClick={() => setSelectedDate(isSel ? null : day.date)} style={{
                    padding: '10px 4px', minHeight: 0, border: 'none', cursor: 'pointer',
                    background: isSel ? 'var(--accent-light)' : day.isToday ? 'rgba(16,185,129,0.04)' : 'transparent',
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border-medium)' : 'none',
                    borderBottom: '1px solid var(--border-medium)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    opacity: day.isCurrent ? 1 : 0.3, transition: 'background 0.15s',
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: day.isToday ? 700 : 500,
                      color: day.isToday ? '#fff' : isSel ? 'var(--accent-primary)' : 'var(--text-primary)',
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: day.isToday ? 'var(--accent-primary)' : 'transparent',
                    }}>{day.day}</span>
                    {ev && (
                      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        {ev.telehealth > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-success)' }} />}
                        {ev.appointments > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                        {ev.active > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-warning)' }} />}
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{ev.telehealth + ev.appointments}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, padding: '10px 20px', borderTop: '1px solid var(--border-medium)' }}>
              {[{ c: 'var(--color-success)', l: 'Telehealth' }, { c: 'var(--accent-primary)', l: 'Appointments' }, { c: 'var(--color-warning)', l: 'Active' }].map(x => (
                <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: x.c }} />{x.l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Selected date heading */}
        {selectedDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} sessions &middot; {filteredAppts.length} appointments</span>
          </div>
        )}

        {/* ═══ Telehealth Appointments ═══ */}
        {filteredAppts.length > 0 && (
          <div className="card-elevated" style={{ padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Telehealth Appointments ({filteredAppts.length})
            </div>
            {filteredAppts.map(a => (
              <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--border-medium)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 44 }}>{a.appointmentTime}</span>
                <Calendar size={13} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{a.patientName}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.department}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══ Session List ═══ */}
        {(view === 'list' || selectedDate) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 && filteredAppts.length === 0 ? (
              <div className="card-elevated" style={{ textAlign: 'center', padding: 48 }}>
                <Video size={52} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>No sessions {selectedDate ? 'on this date' : 'found'}</p>
                <button onClick={() => setShowNewForm(true)} className="btn btn-primary btn-sm" style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  <Plus size={14} /> Schedule Session
                </button>
              </div>
            ) : (
              filtered.map(session => {
                const sc = statusConfig[session.status];
                const tc = typeConfig[session.sessionType];
                const isExp = expandedId === session._id;
                return (
                  <div key={session._id} className="card-elevated" style={{ overflow: 'hidden' }}>
                    <div onClick={() => setExpandedId(isExp ? null : session._id)} style={{
                      display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 12, flexWrap: 'wrap',
                    }}>
                      <div style={{ minWidth: 52, textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{session.scheduledTime}</div>
                        {!selectedDate && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{session.scheduledDate}</div>}
                      </div>
                      <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: sc.bg, flexShrink: 0 }}>
                        <tc.icon size={16} style={{ color: sc.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {session.patientId ? (
                            <Link
                              href={`/patients/${session.patientId}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                              className="hover:underline"
                              title="View patient record"
                            >
                              {session.patientName}
                              <ExternalLink size={11} style={{ opacity: 0.55 }} />
                            </Link>
                          ) : (
                            session.patientName
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tc.label} &middot; {session.chiefComplaint.slice(0, 40)}{session.chiefComplaint.length > 40 ? '...' : ''}</div>
                      </div>
                      {session.status === 'in_session' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-success)', animation: 'pulse 2s infinite' }} />}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, color: sc.color, background: sc.bg }}>{sc.label}</span>
                      {session.patientConsentGiven && <Lock size={12} style={{ color: 'var(--color-success)' }} />}
                      {isExp ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>

                    {isExp && (
                      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-medium)', paddingTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'stretch', gap: 14, marginBottom: 12 }}>
                          <Detail l="Complaint" v={session.chiefComplaint} />
                          <Detail l="Provider" v={`${session.providerName} (${session.providerRole})`} />
                          <Detail l="Room" v={session.roomId} mono />
                          {session.clinicalNotes && <Detail l="Notes" v={session.clinicalNotes} />}
                          {session.diagnosis && <Detail l="Diagnosis" v={`${session.diagnosis}${session.icd10Code ? ` (${session.icd10Code})` : ''}`} />}
                          {session.consultationFee !== undefined && (
                            <Detail l="Fee" v={`${session.currency} ${session.consultationFee}`} badge={session.paymentStatus ? paymentLabels[session.paymentStatus] : undefined} />
                          )}
                          <Detail l="Consent" v={session.patientConsentGiven ? 'Given' : 'Pending'} color={session.patientConsentGiven ? 'var(--color-success)' : 'var(--color-danger)'} />
                          {session.patientRating && <Detail l="Rating" v={`${session.patientRating}/5`} color="#F59E0B" />}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {session.status === 'scheduled' && <>
                            <Btn c="#D97706" onClick={() => updateStatus(session._id, 'waiting_room')}><Clock size={13} /> Waiting</Btn>
                            <Btn c="#EF4444" onClick={() => updateStatus(session._id, 'cancelled', { cancelledReason: 'Cancelled', cancelledBy: currentUser?.name })}><X size={13} /> Cancel</Btn>
                          </>}
                          {(session.status === 'scheduled' || session.status === 'waiting_room') && (
                            <button onClick={() => handleJoin(session)} className="btn btn-sm" style={{ background: 'var(--color-success)', color: '#fff', border: 'none', gap: 4 }}>
                              <Video size={13} /> Join
                            </button>
                          )}
                          {session.status === 'in_session' && <>
                            <button onClick={() => { updateStatus(session._id, 'completed'); showToast('Completed', 'success'); }} className="btn btn-sm" style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', gap: 4 }}>
                              <PhoneOff size={13} /> End
                            </button>
                            <Btn c="#D97706" onClick={() => update(session._id, { connectionDrops: session.connectionDrops + 1 })}><WifiOff size={13} /> Drop</Btn>
                          </>}
                          {(session.status === 'in_session' || session.status === 'completed') && (
                            <Btn c="#1B9AAA" onClick={() => { setNotesId(session._id); setNotesText(session.clinicalNotes || ''); setNotesDx(session.diagnosis || ''); setNotesIcd(session.icd10Code || ''); }}><FileText size={13} /> Notes</Btn>
                          )}
                          {session.status === 'completed' && !session.patientRating && <Btn c="#F59E0B" onClick={() => setRatingId(session._id)}><Star size={13} /> Rate</Btn>}
                          {session.status === 'completed' && session.paymentStatus === 'pending' && <Btn c="#10B981" onClick={() => update(session._id, { paymentStatus: 'paid' })}><DollarSign size={13} /> Paid</Btn>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══ Modals ═══ */}
        {showNewForm && <Modal title="Schedule Telehealth Session" onClose={() => { setShowNewForm(false); resetForm(); }}>
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--card-radius)', padding: 10, marginBottom: 14, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Patient consent required before session. All sessions documented per ISO 13131.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label>Patient *</label><select value={formPatient} onChange={e => setFormPatient(e.target.value)}><option value="">Select patient...</option>{patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.surname}</option>)}</select></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', alignItems: 'stretch', gap: 10 }}>
              <div><label>Date *</label><input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} min={today} /></div>
              <div><label>Time *</label><select value={formTime} onChange={e => setFormTime(e.target.value)}>{timeSlots.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label>Type</label><select value={formType} onChange={e => setFormType(e.target.value as TelehealthType)}><option value="video">Video</option><option value="audio">Audio</option><option value="chat">Chat</option></select></div>
            </div>
            <div><label>Complaint *</label><textarea value={formComplaint} onChange={e => setFormComplaint(e.target.value)} rows={2} placeholder="Reason for consultation..." /></div>
            <div><label>Fee (USD, optional)</label><input type="number" value={formFee} onChange={e => setFormFee(e.target.value)} placeholder="0.00" /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => { setShowNewForm(false); resetForm(); }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="btn btn-primary" style={{ flex: 1, background: 'var(--color-success)', borderColor: 'var(--color-success)', opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Scheduling...' : 'Schedule'}</button>
            </div>
          </div>
        </Modal>}

        {notesId && <Modal title="Clinical Notes" onClose={() => setNotesId(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><label>Notes</label><textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={3} placeholder="SOAP notes..." /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label>Diagnosis</label><input value={notesDx} onChange={e => setNotesDx(e.target.value)} placeholder="e.g., Malaria" /></div>
              <div><label>ICD-10</label><input value={notesIcd} onChange={e => setNotesIcd(e.target.value)} placeholder="e.g., B50" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setNotesId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => { addNotes(notesId, notesText, notesDx || undefined, notesIcd || undefined); showToast('Saved', 'success'); setNotesId(null); }} className="btn btn-primary" style={{ flex: 1 }}>Save</button>
            </div>
          </div>
        </Modal>}

        {ratingId && <Modal title="Rate Session" onClose={() => setRatingId(null)} sm>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRatingVal(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Star size={56} fill={n <= ratingVal ? 'var(--color-warning)' : 'none'} style={{ color: n <= ratingVal ? 'var(--color-warning)' : '#D1D5DB' }} />
              </button>
            ))}
          </div>
          <textarea value={ratingFb} onChange={e => setRatingFb(e.target.value)} rows={2} placeholder="Optional feedback..." style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setRatingId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button onClick={() => { rate(ratingId, ratingVal, ratingFb || undefined); showToast('Rated', 'success'); setRatingId(null); setRatingFb(''); }} className="btn btn-primary" style={{ flex: 1, background: 'var(--color-warning)', borderColor: 'var(--color-warning)' }}>Submit</button>
          </div>
        </Modal>}

        <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
      </main>
    </div>
  );
}

/* ─── Helpers ─── */
function Modal({ children, title, onClose, sm }: { children: React.ReactNode; title: string; onClose: () => void; sm?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-panel ${sm ? 'modal-panel--sm' : 'modal-panel--md'}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Detail({ l, v, mono, color, badge }: { l: string; v: string; mono?: boolean; color?: string; badge?: { color: string; label: string } }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</div>
      <div style={{ fontSize: 12, color: color || 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined, display: 'flex', alignItems: 'center', gap: 6 }}>
        {v}
        {badge && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, color: badge.color, background: `${badge.color}12` }}>{badge.label}</span>}
      </div>
    </div>
  );
}

function Btn({ c, onClick, children }: { c: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
      borderRadius: 'var(--card-radius)', border: `1px solid ${c}20`, background: `${c}08`,
      color: c, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>{children}</button>
  );
}

const calBtn: React.CSSProperties = {
  background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)',
  borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
};
