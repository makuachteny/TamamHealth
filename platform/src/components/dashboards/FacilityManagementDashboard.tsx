'use client';
import DashboardHero from '@/components/dashboard/DashboardHero';
import DashboardActionsRow from '@/components/dashboard/DashboardActionsRow';
import TodaysAppointmentsCard from '@/components/dashboard/TodaysAppointmentsCard';
import DashboardGreetingHeader from '@/components/dashboard/DashboardGreetingHeader';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useDataScope } from '@/lib/hooks/useDataScope';
import { useUsers } from '@/lib/hooks/useUsers';
import { usePatients } from '@/lib/hooks/usePatients';
import { useWards } from '@/lib/hooks/useWards';
import { useAppointments } from '@/lib/hooks/useAppointments';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import ChartCard, { tooltipStyle as chartTooltipStyle, axisTick, AreaGradients } from '@/components/ChartCard';
import {
  Stethoscope, Users, HeartPulse, BedDouble, ChevronRight,
  Edit3, Trash2, Eye, ChevronDown, BarChart3,
} from '@/components/icons/lucide';
import { formatMoney } from '@/lib/format-utils';
import type { MessageDoc } from '@/lib/db-types';

const TEAL = 'var(--color-brand-400)';
const PURPLE = 'var(--accent-primary)';
const CORAL = '#FB923C';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** JS getDay() (0=Sun..6=Sat) → our Mon-first index (0=Mon..6=Sun). */
function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

interface BillingSummary {
  totalRevenue: number;
  totalOutstanding: number;
  currency: string;
}

export default function FacilityManagementDashboard() {
  const { currentUser } = useApp();
  const router = useRouter();
  const scope = useDataScope();

  const { users } = useUsers();
  const { patients } = usePatients();
  const { availableBeds } = useWards();
  const { appointments, updateStatus: updateApptStatus } = useAppointments();

  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [enquiries, setEnquiries] = useState<MessageDoc[]>([]);
  const [availableProviderIds, setAvailableProviderIds] = useState<Set<string>>(new Set());

  // Billing (cash flow), enquiries (inbound patient messages) and provider
  // availability are loaded from services — all real data, scope-filtered.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getBillingSummary } = await import('@/lib/services/billing-service');
        const s = await getBillingSummary(scope);
        if (!cancelled) setBilling({ totalRevenue: s.totalRevenue, totalOutstanding: s.totalOutstanding, currency: s.currency });
      } catch { /* leave null */ }
      try {
        const { getInboundPatientMessages } = await import('@/lib/services/message-service');
        const m = await getInboundPatientMessages(scope);
        if (!cancelled) setEnquiries(m.slice(0, 5));
      } catch { /* leave empty */ }
      try {
        const { getAllAvailability } = await import('@/lib/services/availability-service');
        const av = await getAllAvailability(scope);
        const today = new Date().toISOString().slice(0, 10);
        const now = new Date().toTimeString().slice(0, 5);
        const ids = new Set(
          av.filter(a => a.status !== 'cancelled' && a.date === today && a.startTime <= now && a.endTime >= now)
            .map(a => a.providerId),
        );
        if (!cancelled) setAvailableProviderIds(ids);
      } catch { /* leave empty */ }
    })();
    return () => { cancelled = true; };
  }, [scope]);

  // ─── Derived counts ───
  const doctors = useMemo(() => users.filter(u => u.role === 'doctor' || u.role === 'clinical_officer' || u.role === 'clinician'), [users]);
  const nurses = useMemo(() => users.filter(u => u.role === 'nurse' || u.role === 'midwife'), [users]);

  const received = billing?.totalRevenue ?? 0;
  const pending = billing?.totalOutstanding ?? 0;
  const totalInvoice = received + pending;
  const cashData = [
    { name: 'Received', value: received, color: TEAL },
    { name: 'Pending', value: pending, color: PURPLE },
  ].filter(d => d.value > 0);

  // ─── Weekly patient activity (real: registrations, appointments, cancellations) ───
  const weekly = useMemo(() => {
    const rows = WEEKDAYS.map(d => ({ day: d, newPatients: 0, appointments: 0, canceled: 0 }));
    const start = new Date(); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - weekdayIndex(start)); // Monday of this week
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const inWeek = (iso?: string) => {
      if (!iso) return -1;
      const dt = new Date(iso);
      if (dt < start || dt >= end) return -1;
      return weekdayIndex(dt);
    };
    for (const p of patients) {
      const i = inWeek((p as { createdAt?: string }).createdAt);
      if (i >= 0) rows[i].newPatients += 1;
    }
    for (const a of appointments) {
      const i = inWeek(a.appointmentDate);
      if (i < 0) continue;
      if (a.status === 'cancelled') rows[i].canceled += 1;
      else rows[i].appointments += 1;
    }
    return rows;
  }, [patients, appointments]);

  // ─── Upcoming appointments (real) ───
  const ageOf = useMemo(() => {
    const byId = new Map(patients.map(p => [p._id, (p as { age?: number }).age]));
    return (patientId: string) => byId.get(patientId);
  }, [patients]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return appointments
      .filter(a => (a.appointmentDate || '') >= today && a.status !== 'cancelled' && a.status !== 'completed')
      .sort((x, y) => (x.appointmentDate + x.appointmentTime).localeCompare(y.appointmentDate + y.appointmentTime))
      .slice(0, 6);
  }, [appointments]);

  if (!currentUser) return null;

  const statusPill = (status: string) => {
    const ok = /approved|confirmed|scheduled|booked/i.test(status);
    const bad = /cancel/i.test(status);
    const color = bad ? 'var(--color-danger)' : ok ? 'var(--color-success)' : 'var(--text-muted)';
    const bg = bad ? 'rgba(229,46,66,0.10)' : ok ? 'rgba(21,121,92,0.10)' : 'var(--overlay-subtle)';
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ color, background: bg }}>{status}</span>;
  };

  // Row action: cancel an appointment from the dashboard (confirm first).
  const cancelAppointment = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Cancel this appointment?')) return;
    try { await updateApptStatus(id, 'cancelled'); } catch { /* surfaced elsewhere */ }
  };

  const stat = (icon: React.ReactNode, label: React.ReactNode, value: number) => (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
      <div className="icon-box-sm">{icon}</div>
      <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  return (
    <>
      <TopBar title="Dashboard" />
      <main className="page-container page-enter">
        <div className="flex flex-col gap-5">

          <DashboardGreetingHeader />

          <DashboardHero
            stats={[
              { label: 'Patients', value: patients.length },
              { label: 'Doctors', value: doctors.length },
              { label: 'Nurses', value: nurses.length },
              { label: 'Available Beds', value: availableBeds },
            ]}
          />

          <DashboardActionsRow
            actions={[
              { label: 'Patients', icon: Users, href: '/patients' },
              { label: 'Doctors & Staff', icon: Stethoscope, href: '/hr', color: '#0D9488' },
              { label: 'Bed Management', icon: BedDouble, href: '/wards', color: 'var(--accent-primary)' },
              { label: 'Reports', icon: BarChart3, href: '/reports', color: '#F59E0B' },
            ]}
            secondaryCard={<TodaysAppointmentsCard />}
          />

          {/* ═══ ROW 1 — Cash Flow · Stat cards · Weekly activity ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Cash Flow */}
            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cash Flow</h3>
              </div>
              <div className="flex items-center gap-4 p-5">
                <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={cashData.length ? cashData : [{ name: 'None', value: 1, color: 'var(--border-light)' }]}
                        dataKey="value" innerRadius={52} outerRadius={70} paddingAngle={cashData.length > 1 ? 3 : 0} stroke="none">
                        {(cashData.length ? cashData : [{ color: 'var(--border-light)' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{formatMoney(totalInvoice)}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total invoice</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Received Amount</p>
                    <p className="text-base font-bold" style={{ color: PURPLE }}>{formatMoney(received)}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)' }}>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Pending Amount</p>
                    <p className="text-base font-bold" style={{ color: TEAL }}>{formatMoney(pending)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stat cards — no header, matching the reference layout */}
            <div className="dash-card overflow-hidden">
              <div className="p-5 flex flex-col justify-center h-full">
                {stat(<Stethoscope className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />, <>Total <b>Doctors</b></>, doctors.length)}
                {stat(<Users className="w-4 h-4" style={{ color: PURPLE }} />, <>Total <b>Patients</b></>, patients.length)}
                {stat(<HeartPulse className="w-4 h-4" style={{ color: CORAL }} />, <>Total <b>Nurses</b></>, nurses.length)}
                <div className="flex items-center gap-3 pt-2.5">
                  <div className="icon-box-sm"><BedDouble className="w-4 h-4" style={{ color: TEAL }} /></div>
                  <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>Available <b>Beds</b></span>
                  <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{availableBeds}</span>
                </div>
              </div>
            </div>

            {/* Weekly patient activity (titled "Reviews Score" to match the reference) */}
            <ChartCard
              title="Reviews Score"
              defaultType="bar"
              defaultPeriod="week"
            >
              {({ chartType }) => {
                const series = [
                  { key: 'newPatients', name: 'New Patients', color: PURPLE },
                  { key: 'appointments', name: 'Appointments', color: TEAL },
                  { key: 'canceled', name: 'Canceled', color: CORAL },
                ];
                const commonProps = { data: weekly, barGap: 2, barCategoryGap: '20%' };
                const legendProps = { wrapperStyle: { fontSize: 11 }, iconType: 'circle' as const };
                if (chartType === 'area') {
                  return (
                    <ResponsiveContainer width="100%" height={232}>
                      <AreaChart data={weekly} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <AreaGradients />
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={axisTick} />
                        <YAxis tickLine={false} axisLine={false} tick={axisTick} width={28} />
                        <Tooltip {...chartTooltipStyle} />
                        <Legend {...legendProps} />
                        {series.map(s => <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.12} strokeWidth={2} />)}
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                }
                if (chartType === 'line') {
                  return (
                    <ResponsiveContainer width="100%" height={232}>
                      <LineChart data={weekly} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={axisTick} />
                        <YAxis tickLine={false} axisLine={false} tick={axisTick} width={28} />
                        <Tooltip {...chartTooltipStyle} />
                        <Legend {...legendProps} />
                        {series.map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />)}
                      </LineChart>
                    </ResponsiveContainer>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={232}>
                    <BarChart {...commonProps}>
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={axisTick} />
                      <YAxis tickLine={false} axisLine={false} tick={axisTick} width={28} />
                      <Tooltip cursor={{ fill: 'var(--overlay-subtle)' }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend {...legendProps} />
                      {series.map(s => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />)}
                    </BarChart>
                  </ResponsiveContainer>
                );
              }}
            </ChartCard>
          </div>

          {/* ═══ ROW 2 — Upcoming Appointments ═══ */}
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming Appointments</h3>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium inline-flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ color: 'var(--text-secondary)', background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>Sort by <ChevronDown className="w-3 h-3" /></span>
                <button onClick={() => router.push('/appointments')} className="text-[12px] font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    {['Id', 'Patient Name', 'Age', 'Date', 'Time', 'Doctors', 'Status', 'Action'].map(h => (
                      <th key={h} className={`px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider ${h === 'Action' ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-8 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>No upcoming appointments.</td></tr>
                  )}
                  {upcoming.map((a, i) => (
                    <tr key={a._id} role="button" tabIndex={0}
                      className="cursor-pointer hover:bg-[var(--table-row-hover)]"
                      onClick={() => router.push(`/patients/${a.patientId}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/patients/${a.patientId}`); } }}
                      style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td className="px-5 py-2.5 text-[12px] font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>APT{String(i + 1).padStart(3, '0')}</td>
                      <td className="px-5 py-2.5 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{a.patientName}</td>
                      <td className="px-5 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{ageOf(a.patientId) ?? '—'}</td>
                      <td className="px-5 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{a.appointmentDate}</td>
                      <td className="px-5 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{a.appointmentTime}{a.endTime ? ` – ${a.endTime}` : ''}</td>
                      <td className="px-5 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{a.providerName || '—'}</td>
                      <td className="px-5 py-2.5">{statusPill(a.status)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push('/appointments'); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--overlay-medium)]"
                            title="Edit appointment" aria-label="Edit appointment"
                          >
                            <Edit3 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                          </button>
                          <button
                            onClick={(e) => cancelAppointment(e, a._id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--overlay-medium)]"
                            title="Cancel appointment" aria-label="Cancel appointment"
                          >
                            <Trash2 className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ ROW 3 — Enquiries · Doctors ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Enquiries (inbound patient messages) */}
            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Enquiries</h3>
                <button onClick={() => router.push('/messages')} className="text-[12px] font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>View all <ChevronRight className="w-3 h-3" /></button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full" style={{ minWidth: 460 }}>
                  <thead>
                    <tr>
                      {['Full Name', 'Type', 'Date', 'Status', 'Action'].map(h => (
                        <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider ${h === 'Status' || h === 'Action' ? 'text-center' : 'text-left'}`} style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {enquiries.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>No patient enquiries.</td></tr>
                    ) : enquiries.map(m => (
                      <tr key={m._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td className="px-4 py-2.5 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{m.patientName || 'Patient'}</td>
                        <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{m.subject || 'General Inquiry'}</td>
                        <td className="px-4 py-2.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{(m.sentAt || m.createdAt || '').slice(0, 10)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-center">
                            <span className="inline-flex items-center w-9 h-5 rounded-full px-0.5" style={{ background: 'var(--color-success)' }}>
                              <span className="w-4 h-4 rounded-full bg-white ml-auto" />
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-center">
                            <button onClick={() => router.push('/messages')} className="w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors hover:bg-[var(--overlay-medium)]" title="View enquiry" aria-label="View enquiry">
                              <Eye className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Doctors + availability */}
            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Doctors</h3>
                <button onClick={() => router.push('/admin/users')} className="text-[12px] font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>View all <ChevronRight className="w-3 h-3" /></button>
              </div>
              <div className="p-2">
                {/* Column header (No / Name / Status) */}
                <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <span className="w-6 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>No</span>
                  <span className="w-8" aria-hidden />
                  <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</span>
                </div>
                {doctors.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>No doctors on record.</p>
                ) : doctors.slice(0, 6).map((d, i) => {
                  const available = availableProviderIds.has(d._id);
                  return (
                    <div key={d._id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <span className="text-[11px] font-mono w-6" style={{ color: 'var(--text-muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: 'var(--accent-primary)' }}>
                        {(d.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('')}
                      </div>
                      <span className="text-[13px] font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                      <span className="text-[11px] font-semibold" style={{ color: available ? 'var(--color-success)' : 'var(--text-muted)' }}>
                        {available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
