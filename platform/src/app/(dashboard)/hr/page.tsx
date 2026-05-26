'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import {
  Users, Plus, X, Calendar, CheckCircle2, AlertCircle, Clock, Trash2,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useUsers } from '@/lib/hooks/useUsers';
import { useToast } from '@/components/Toast';
import type { LeaveRequestDoc, LeaveType, PayrollEntryDoc } from '@/lib/db-types-hr';
import type { LeaveSummary } from '@/lib/services/leave-service';
import type { PayrollSummary } from '@/lib/services/payroll-service';
import type { StaffScheduleDoc } from '@/lib/db-types';

const LEAVE_TYPES: { id: LeaveType; label: string }[] = [
  { id: 'annual', label: 'Annual' },
  { id: 'sick', label: 'Sick' },
  { id: 'maternity', label: 'Maternity' },
  { id: 'paternity', label: 'Paternity' },
  { id: 'compassionate', label: 'Compassionate' },
  { id: 'study', label: 'Study' },
  { id: 'unpaid', label: 'Unpaid' },
];

const STATUS_TOKENS: Record<LeaveRequestDoc['status'], { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#B8741C', bg: 'rgba(228, 168, 75, 0.16)' },
  approved:  { label: 'Approved',  color: '#15795C', bg: 'rgba(27, 158, 119, 0.12)' },
  rejected:  { label: 'Rejected',  color: '#C44536', bg: 'rgba(196, 69, 54, 0.14)' },
  cancelled: { label: 'Cancelled', color: '#5A7370', bg: 'rgba(90, 115, 112, 0.14)' },
  taken:     { label: 'Taken',     color: '#1B9AAA', bg: 'rgba(27, 154, 170, 0.14)' },
};

const PAYROLL_STATUS_TOKENS: Record<PayrollEntryDoc['status'], { label: string; color: string; bg: string }> = {
  draft:    { label: 'Draft',    color: '#5A7370', bg: 'rgba(90, 115, 112, 0.14)' },
  approved: { label: 'Approved', color: '#1B9AAA', bg: 'rgba(27, 154, 170, 0.14)' },
  paid:     { label: 'Paid',     color: '#15795C', bg: 'rgba(27, 158, 119, 0.14)' },
  reversed: { label: 'Reversed', color: '#C44536', bg: 'rgba(196, 69, 54, 0.14)' },
};

const SHIFT_TYPES: StaffScheduleDoc['shiftType'][] = ['morning', 'afternoon', 'night', 'on_call'];

type TabId = 'roster' | 'leave' | 'schedule' | 'payroll';

const fmtMoney = (n: number, currency = 'SSP') => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function HRPage() {
  const { currentUser } = useApp();
  const { users } = useUsers();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams?.get('tab') as TabId) || 'roster';
  const [tab, setTab] = useState<TabId>(initialTab);

  // Sync tab → URL so deep links from dashboard work both ways
  useEffect(() => { setTab((searchParams?.get('tab') as TabId) || 'roster'); }, [searchParams]);

  const setTabAndUrl = (next: TabId) => {
    setTab(next);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', next);
    router.replace(`/hr?${params.toString()}`, { scroll: false });
  };

  // ── Leave state ─────────────────────────────────────────────────────
  const [leave, setLeave] = useState<LeaveRequestDoc[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<LeaveSummary | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    userId: '', leaveType: 'annual' as LeaveType,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    reason: '',
  });

  // ── Schedule state ──────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<StaffScheduleDoc[]>([]);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    userId: '',
    shiftType: 'morning' as StaffScheduleDoc['shiftType'],
    shiftDate: new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '16:00',
    department: '',
    isOnCall: false,
    notes: '',
  });

  // ── Payroll state ───────────────────────────────────────────────────
  const [payroll, setPayroll] = useState<PayrollEntryDoc[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [payrollPeriod, setPayrollPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    userId: '', baseSalary: 0, allowances: 0, deductions: 0, currency: 'SSP', notes: '',
  });

  const facilityId = currentUser?.hospitalId;
  const facilityName = currentUser?.hospitalName || 'Facility';
  const isApprover = currentUser?.role && ['org_admin', 'medical_superintendent', 'hrio', 'super_admin'].includes(currentUser.role);

  // ── Loaders ─────────────────────────────────────────────────────────
  const reloadLeave = useCallback(async () => {
    const { getAllLeaveRequests, getLeaveSummary } = await import('@/lib/services/leave-service');
    const [list, sum] = await Promise.all([getAllLeaveRequests(), getLeaveSummary()]);
    setLeave(list);
    setLeaveSummary(sum);
  }, []);

  const reloadSchedules = useCallback(async () => {
    const { getSchedulesByDate } = await import('@/lib/services/staff-scheduling-service');
    setSchedules(await getSchedulesByDate(scheduleDate, facilityId));
  }, [scheduleDate, facilityId]);

  const reloadPayroll = useCallback(async () => {
    const { getPayrollByPeriod, getPayrollSummary } = await import('@/lib/services/payroll-service');
    const [list, sum] = await Promise.all([
      getPayrollByPeriod(payrollPeriod),
      getPayrollSummary(payrollPeriod),
    ]);
    setPayroll(list);
    setPayrollSummary(sum);
  }, [payrollPeriod]);

  useEffect(() => { reloadLeave(); }, [reloadLeave]);
  useEffect(() => { reloadSchedules(); }, [reloadSchedules]);
  useEffect(() => { reloadPayroll(); }, [reloadPayroll]);

  const facilityUsers = useMemo(
    () => facilityId ? users.filter(u => u.hospitalId === facilityId) : users,
    [users, facilityId],
  );

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of facilityUsers) counts[u.role] = (counts[u.role] || 0) + 1;
    return counts;
  }, [facilityUsers]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handleRequestLeave = async () => {
    if (!leaveForm.userId) { showToast('Select a staff member', 'error'); return; }
    if (leaveForm.endDate < leaveForm.startDate) { showToast('End date must be after start date', 'error'); return; }
    const user = users.find(u => u._id === leaveForm.userId);
    if (!user) return;
    try {
      const { requestLeave } = await import('@/lib/services/leave-service');
      await requestLeave({
        userId: user._id, userName: user.name, role: user.role,
        facilityId: user.hospitalId || facilityId || '',
        facilityName: user.hospitalName || facilityName,
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate, endDate: leaveForm.endDate,
        reason: leaveForm.reason.trim() || undefined,
        orgId: user.orgId,
      });
      showToast(`Leave request submitted for ${user.name}`, 'success');
      setLeaveOpen(false);
      setLeaveForm({ userId: '', leaveType: 'annual', startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), reason: '' });
      reloadLeave();
    } catch (err) {
      console.error(err);
      showToast('Failed to submit leave request', 'error');
    }
  };

  const decideLeave = async (id: string, status: 'approved' | 'rejected') => {
    if (!currentUser) return;
    try {
      const { decideLeave } = await import('@/lib/services/leave-service');
      await decideLeave(id, {
        status,
        decidedBy: currentUser._id || currentUser.username || 'unknown',
        decidedByName: currentUser.name,
      });
      showToast(`Leave ${status}`, 'success');
      reloadLeave();
    } catch (err) {
      console.error(err);
      showToast(`Failed to ${status} leave`, 'error');
    }
  };

  const handleAddShift = async () => {
    const user = users.find(u => u._id === scheduleForm.userId);
    if (!user) { showToast('Select a staff member', 'error'); return; }
    try {
      const { createSchedule } = await import('@/lib/services/staff-scheduling-service');
      await createSchedule({
        userId: user._id, userName: user.name, role: user.role,
        facilityId: user.hospitalId || facilityId || '',
        facilityName: user.hospitalName || facilityName,
        shiftType: scheduleForm.shiftType,
        shiftDate: scheduleForm.shiftDate,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        department: scheduleForm.department || undefined,
        isOnCall: scheduleForm.isOnCall,
        notes: scheduleForm.notes || undefined,
        status: 'scheduled',
        orgId: user.orgId,
      });
      showToast(`Scheduled ${user.name} for ${scheduleForm.shiftType}`, 'success');
      setScheduleOpen(false);
      setScheduleForm({ ...scheduleForm, userId: '', notes: '' });
      reloadSchedules();
    } catch (err) {
      console.error(err);
      showToast('Failed to create schedule', 'error');
    }
  };

  const removeShift = async (id: string) => {
    try {
      const { deleteSchedule } = await import('@/lib/services/staff-scheduling-service');
      await deleteSchedule(id);
      reloadSchedules();
    } catch {
      showToast('Failed to remove shift', 'error');
    }
  };

  const handleAddPayroll = async () => {
    const user = users.find(u => u._id === payrollForm.userId);
    if (!user) { showToast('Select a staff member', 'error'); return; }
    if (payrollForm.baseSalary <= 0) { showToast('Base salary must be > 0', 'error'); return; }
    try {
      const { createPayrollEntry } = await import('@/lib/services/payroll-service');
      await createPayrollEntry({
        userId: user._id, userName: user.name, role: user.role,
        facilityId: user.hospitalId || facilityId || '',
        facilityName: user.hospitalName || facilityName,
        period: payrollPeriod,
        baseSalary: payrollForm.baseSalary,
        allowances: payrollForm.allowances,
        deductions: payrollForm.deductions,
        currency: payrollForm.currency,
        notes: payrollForm.notes || undefined,
        orgId: user.orgId,
      });
      showToast(`Payroll entry created for ${user.name}`, 'success');
      setPayrollOpen(false);
      setPayrollForm({ userId: '', baseSalary: 0, allowances: 0, deductions: 0, currency: 'SSP', notes: '' });
      reloadPayroll();
    } catch (err) {
      console.error(err);
      showToast('Failed to create payroll entry', 'error');
    }
  };

  const setPayStatus = async (id: string, status: PayrollEntryDoc['status']) => {
    if (!currentUser) return;
    try {
      const { setPayrollStatus } = await import('@/lib/services/payroll-service');
      await setPayrollStatus(id, status, {
        id: currentUser._id || currentUser.username || 'unknown',
        name: currentUser.name,
      });
      reloadPayroll();
    } catch {
      showToast('Failed to update payroll status', 'error');
    }
  };

  return (
    <>
      <TopBar title="HR" />
      <main className="page-container page-enter">
        <PageHeader
          icon={Users}
          title="HR · People Operations"
          subtitle={`${facilityName} · ${facilityUsers.length} staff`}
          actions={
            <div className="flex gap-2">
              {tab === 'leave' && (
                <button onClick={() => setLeaveOpen(true)} className="btn btn-primary">
                  <Plus className="w-4 h-4" /> Request Leave
                </button>
              )}
              {tab === 'schedule' && (
                <button onClick={() => setScheduleOpen(true)} className="btn btn-primary">
                  <Plus className="w-4 h-4" /> Schedule Shift
                </button>
              )}
              {tab === 'payroll' && (
                <button onClick={() => setPayrollOpen(true)} className="btn btn-primary">
                  <Plus className="w-4 h-4" /> Add Payroll Entry
                </button>
              )}
            </div>
          }
        />

        {/* Summary KPIs (leave-focused — stays useful across tabs) */}
        {leaveSummary && (
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch' }}>
            {[
              { label: 'Active Staff', value: facilityUsers.length, accent: 'var(--accent-primary)', bg: 'rgba(27, 154, 170, 0.08)', border: 'rgba(27, 154, 170, 0.22)' },
              { label: 'Pending Leave', value: leaveSummary.pending, accent: '#B8741C', bg: 'rgba(228, 168, 75, 0.12)', border: 'rgba(228, 168, 75, 0.30)' },
              { label: 'Approved Upcoming', value: leaveSummary.upcoming, accent: '#1B9AAA', bg: 'rgba(27, 154, 170, 0.10)', border: 'rgba(27, 154, 170, 0.26)' },
              { label: 'Days Off (this month)', value: leaveSummary.daysApprovedThisMonth, accent: '#15795C', bg: 'rgba(27, 158, 119, 0.10)', border: 'rgba(27, 158, 119, 0.26)' },
            ].map(k => (
              <div key={k.label} style={{ padding: '14px 16px', borderRadius: 10, background: k.bg, border: `1px solid ${k.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: k.accent }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {([
            { id: 'roster', label: 'Staff Roster' },
            { id: 'leave', label: 'Leave Requests' },
            { id: 'schedule', label: 'Shift Schedule' },
            { id: 'payroll', label: 'Payroll' },
          ] as { id: TabId; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTabAndUrl(t.id)}
              className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ROSTER ──────────────────────────────────────── */}
        {tab === 'roster' && (
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-sm">Active Roster</h3>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(roleCounts).map(([role, count]) => (
                    <span key={role} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}>
                      {role.replace(/_/g, ' ')} · {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Role</th>
                  <th>Username</th>
                  <th>Facility</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {facilityUsers.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No staff registered for this facility.</td></tr>
                )}
                {facilityUsers.map(u => {
                  const initials = u.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1B9AAA 0%, #1A3A3A 100%)' }}>{initials || '?'}</div>
                          <div>
                            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{u.name}</div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{u.role.replace(/_/g, ' ')}</td>
                      <td className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>@{u.username}</td>
                      <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.hospitalName || '—'}</td>
                      <td>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{
                          background: u.isActive === false ? 'rgba(196, 69, 54, 0.14)' : 'rgba(27, 158, 119, 0.12)',
                          color: u.isActive === false ? '#8B2E24' : '#15795C',
                        }}>
                          {u.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── LEAVE ──────────────────────────────────────── */}
        {tab === 'leave' && (
          <div className="dash-card">
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm">Leave Requests</h3>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{leave.length} total</span>
            </div>
            {leave.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                No leave requests yet. Click <strong>Request Leave</strong> above.
              </div>
            ) : (
              <div>
                {leave.map(r => {
                  const tok = STATUS_TOKENS[r.status];
                  return (
                    <div key={r._id} className={`data-row ${r.status === 'pending' ? 'data-row--warning' : ''}`}>
                      <div className="data-row__icon" style={{ background: tok.bg, color: tok.color }}>
                        {r.status === 'pending' ? <Clock className="w-4 h-4" /> : r.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : r.status === 'rejected' ? <AlertCircle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="data-row__label">{r.userName} · <span className="capitalize">{r.role.replace(/_/g, ' ')}</span></div>
                        <div className="data-row__value">
                          <span className="capitalize">{r.leaveType}</span> · {r.days}d · {r.startDate} → {r.endDate}
                        </div>
                        {r.reason && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>“{r.reason}”</div>}
                        {r.decisionNotes && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Note: {r.decisionNotes}</div>}
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: tok.bg, color: tok.color, border: `1px solid ${tok.color}40` }}>
                        {tok.label}
                      </span>
                      {isApprover && r.status === 'pending' && (
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => decideLeave(r._id, 'approved')} className="btn btn-primary btn-sm">Approve</button>
                          <button onClick={() => decideLeave(r._id, 'rejected')} className="btn btn-secondary btn-sm">Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE ───────────────────────────────────── */}
        {tab === 'schedule' && (
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm">Shift Schedule</h3>
              <div className="flex items-center gap-2">
                <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Date</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ width: 160 }} />
                <span className="text-[11px] ml-2" style={{ color: 'var(--text-muted)' }}>{schedules.length} shifts</span>
              </div>
            </div>
            {schedules.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                No shifts scheduled for {scheduleDate}. Click <strong>Schedule Shift</strong> above to add one.
              </div>
            ) : (
              <div>
                {SHIFT_TYPES.map(shift => {
                  const list = schedules.filter(s => s.shiftType === shift);
                  if (list.length === 0) return null;
                  const shiftColor = shift === 'morning' ? '#15795C' : shift === 'afternoon' ? '#E4A84B' : shift === 'night' ? '#1A3A3A' : '#1B9AAA';
                  return (
                    <div key={shift}>
                      <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: shiftColor, background: 'var(--overlay-subtle)', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: shiftColor }} />
                          {shift.replace('_', ' ')} · {list.length}
                        </span>
                      </div>
                      {list.map(s => (
                        <div key={s._id} className="data-row">
                          <div className="data-row__icon" style={{ background: `${shiftColor}1A`, color: shiftColor }}>
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="data-row__value">{s.userName}</div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              <span className="capitalize">{s.role.replace(/_/g, ' ')}</span>
                              {s.department && ` · ${s.department}`}
                              {' · '}{s.startTime}–{s.endTime}
                              {s.isOnCall && <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(27, 154, 170, 0.16)', color: '#1B9AAA' }}>On call</span>}
                            </div>
                          </div>
                          <button onClick={() => removeShift(s._id)} className="btn btn-secondary btn-sm" title="Remove shift">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PAYROLL ───────────────────────────────────── */}
        {tab === 'payroll' && (
          <>
            <div className="dash-card p-3 mb-3 flex items-center gap-3 flex-wrap">
              <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Period</label>
              <input type="month" value={payrollPeriod} onChange={e => setPayrollPeriod(e.target.value)} style={{ width: 160 }} />
              {payrollSummary && (
                <div className="flex gap-2 flex-wrap ml-auto">
                  <Pill label="Entries" value={String(payrollSummary.total)} />
                  <Pill label="Gross" value={fmtMoney(payrollSummary.totalGross)} accent="#1B9AAA" />
                  <Pill label="Deductions" value={fmtMoney(payrollSummary.totalDeductions)} accent="#B8741C" />
                  <Pill label="Net" value={fmtMoney(payrollSummary.totalNet)} accent="#15795C" />
                  <Pill label="Paid" value={`${payrollSummary.paid}/${payrollSummary.total}`} accent="#15795C" />
                </div>
              )}
            </div>
            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm">Payroll Register · {payrollPeriod}</h3>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{payroll.length} entries</span>
              </div>
              {payroll.length === 0 ? (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  No payroll entries for {payrollPeriod}. Click <strong>Add Payroll Entry</strong> above to start the register.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th className="text-right">Base</th>
                      <th className="text-right">Allowances</th>
                      <th className="text-right">Deductions</th>
                      <th className="text-right">Net Pay</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payroll.map(e => {
                      const tok = PAYROLL_STATUS_TOKENS[e.status];
                      return (
                        <tr key={e._id}>
                          <td>
                            <div className="font-semibold text-sm">{e.userName}</div>
                            <div className="text-[11px] capitalize" style={{ color: 'var(--text-muted)' }}>{e.role.replace(/_/g, ' ')}</div>
                          </td>
                          <td className="text-xs text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmtMoney(e.baseSalary, e.currency)}</td>
                          <td className="text-xs text-right font-mono" style={{ color: '#1B9AAA' }}>+{fmtMoney(e.allowances, e.currency)}</td>
                          <td className="text-xs text-right font-mono" style={{ color: '#B8741C' }}>-{fmtMoney(e.deductions, e.currency)}</td>
                          <td className="text-sm text-right font-mono font-bold" style={{ color: '#15795C' }}>{fmtMoney(e.netPay, e.currency)}</td>
                          <td>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: tok.bg, color: tok.color, border: `1px solid ${tok.color}40` }}>
                              {tok.label}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-1 justify-end">
                              {e.status === 'draft' && isApprover && (
                                <button onClick={() => setPayStatus(e._id, 'approved')} className="btn btn-secondary btn-sm">Approve</button>
                              )}
                              {e.status === 'approved' && isApprover && (
                                <button onClick={() => setPayStatus(e._id, 'paid')} className="btn btn-primary btn-sm">Mark Paid</button>
                              )}
                              {e.status === 'paid' && isApprover && (
                                <button onClick={() => setPayStatus(e._id, 'reversed')} className="btn btn-secondary btn-sm">Reverse</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── Modals ────────────────────────────────────── */}
        {leaveOpen && (
          <div className="modal-backdrop" onClick={() => setLeaveOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Request Leave</h3>
                <button onClick={() => setLeaveOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Staff *</label>
                  <select value={leaveForm.userId} onChange={e => setLeaveForm({ ...leaveForm, userId: e.target.value })}>
                    <option value="">Select staff…</option>
                    {(isApprover ? users : users.filter(u => u._id === currentUser?._id)).map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Type</label>
                    <select value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value as LeaveType })}>
                      {LEAVE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Start</label>
                    <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>End</label>
                    <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Reason</label>
                  <textarea rows={2} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setLeaveOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleRequestLeave} className="btn btn-primary flex-1">Submit</button>
              </div>
            </div>
          </div>
        )}

        {scheduleOpen && (
          <div className="modal-backdrop" onClick={() => setScheduleOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Schedule Shift</h3>
                <button onClick={() => setScheduleOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Staff *</label>
                  <select value={scheduleForm.userId} onChange={e => setScheduleForm({ ...scheduleForm, userId: e.target.value })}>
                    <option value="">Select staff…</option>
                    {facilityUsers.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Shift</label>
                    <select value={scheduleForm.shiftType} onChange={e => setScheduleForm({ ...scheduleForm, shiftType: e.target.value as StaffScheduleDoc['shiftType'] })}>
                      {SHIFT_TYPES.map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Date</label>
                    <input type="date" value={scheduleForm.shiftDate} onChange={e => setScheduleForm({ ...scheduleForm, shiftDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Start</label>
                    <input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>End</label>
                    <input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Department</label>
                  <input value={scheduleForm.department} onChange={e => setScheduleForm({ ...scheduleForm, department: e.target.value })} placeholder="e.g. OPD, Maternity" />
                </div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={scheduleForm.isOnCall} onChange={e => setScheduleForm({ ...scheduleForm, isOnCall: e.target.checked })} />
                  On-call shift
                </label>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
                  <textarea rows={2} value={scheduleForm.notes} onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setScheduleOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleAddShift} className="btn btn-primary flex-1">Save Shift</button>
              </div>
            </div>
          </div>
        )}

        {payrollOpen && (
          <div className="modal-backdrop" onClick={() => setPayrollOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Add Payroll Entry · {payrollPeriod}</h3>
                <button onClick={() => setPayrollOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Staff *</label>
                  <select value={payrollForm.userId} onChange={e => setPayrollForm({ ...payrollForm, userId: e.target.value })}>
                    <option value="">Select staff…</option>
                    {facilityUsers.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Currency</label>
                    <select value={payrollForm.currency} onChange={e => setPayrollForm({ ...payrollForm, currency: e.target.value })}>
                      <option value="SSP">SSP</option><option value="USD">USD</option><option value="KES">KES</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Base Salary *</label>
                    <input type="number" min={0} value={payrollForm.baseSalary || ''} onChange={e => setPayrollForm({ ...payrollForm, baseSalary: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Allowances</label>
                    <input type="number" min={0} value={payrollForm.allowances || ''} onChange={e => setPayrollForm({ ...payrollForm, allowances: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Deductions</label>
                    <input type="number" min={0} value={payrollForm.deductions || ''} onChange={e => setPayrollForm({ ...payrollForm, deductions: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <div className="flex justify-between text-[12px]"><span style={{ color: 'var(--text-muted)' }}>Net pay</span><span className="font-bold font-mono" style={{ color: '#15795C' }}>{fmtMoney(payrollForm.baseSalary + payrollForm.allowances - payrollForm.deductions, payrollForm.currency)}</span></div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
                  <textarea rows={2} value={payrollForm.notes} onChange={e => setPayrollForm({ ...payrollForm, notes: e.target.value })} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setPayrollOpen(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleAddPayroll} className="btn btn-primary flex-1">Add Entry</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]" style={{ background: 'var(--overlay-subtle)' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span className="font-bold font-mono" style={{ color: accent || 'var(--text-primary)' }}>{value}</span>
    </span>
  );
}
