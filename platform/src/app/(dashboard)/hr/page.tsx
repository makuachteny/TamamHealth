'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { useSearchParams, useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  Users, Plus, X, Trash2, Search,
} from '@/components/icons/lucide';
import RowActionsMenu from '@/components/RowActionsMenu';
import { useApp } from '@/lib/context';
import { useUsers } from '@/lib/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { LeaveRequestDoc, LeaveType, PayrollEntryDoc } from '@/lib/db-types-hr';
import type { LeaveSummary } from '@/lib/services/leave-service';
import type { PayrollSummary } from '@/lib/services/payroll-service';
import type { StaffScheduleDoc } from '@/lib/db-types';
import { formatMoney } from '@/lib/format-utils';

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
  pending:   { label: 'Pending',   color: 'var(--color-warning-text)', bg: 'rgba(228, 168, 75, 0.16)' },
  approved:  { label: 'Approved',  color: 'var(--color-success-text)', bg: 'rgba(27, 158, 119, 0.12)' },
  rejected:  { label: 'Rejected',  color: 'var(--color-danger-500)', bg: 'rgba(196, 69, 54, 0.14)' },
  cancelled: { label: 'Cancelled', color: '#5A7370', bg: 'rgba(90, 115, 112, 0.14)' },
  taken:     { label: 'Taken',     color: 'var(--accent-primary)', bg: 'rgba(33, 145, 208, 0.14)' },
};

const PAYROLL_STATUS_TOKENS: Record<PayrollEntryDoc['status'], { label: string; color: string; bg: string }> = {
  draft:    { label: 'Draft',    color: '#5A7370', bg: 'rgba(90, 115, 112, 0.14)' },
  approved: { label: 'Approved', color: 'var(--accent-primary)', bg: 'rgba(33, 145, 208, 0.14)' },
  paid:     { label: 'Paid',     color: 'var(--color-success-text)', bg: 'rgba(27, 158, 119, 0.14)' },
  reversed: { label: 'Reversed', color: 'var(--color-danger-500)', bg: 'rgba(196, 69, 54, 0.14)' },
};

const SHIFT_TYPES: StaffScheduleDoc['shiftType'][] = ['morning', 'afternoon', 'night', 'on_call'];

type TabId = 'roster' | 'leave' | 'schedule' | 'payroll';

export default function HRPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { users } = useUsers();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams?.get('tab') as TabId) || 'roster';
  const [tab, setTab] = useState<TabId>(initialTab);

  // Roster search + role filter
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterRole, setRosterRole] = useState('all');

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
  const facilityName = currentUser?.hospitalName || t('hr.defaultFacility');
  const isApprover = currentUser?.role && ['org_admin', 'medical_superintendent', 'hospital_manager', 'super_admin'].includes(currentUser.role);

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

  const filteredRosterUsers = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return facilityUsers.filter(u => {
      if (rosterRole !== 'all' && u.role !== rosterRole) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.role.replace(/_/g, ' ').toLowerCase().includes(q) ||
        (u.hospitalName || '').toLowerCase().includes(q)
      );
    });
  }, [facilityUsers, rosterSearch, rosterRole]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handleRequestLeave = async () => {
    if (!leaveForm.userId) { showToast(t('hr.selectStaffMember'), 'error'); return; }
    if (leaveForm.endDate < leaveForm.startDate) { showToast(t('hr.endDateAfterStart'), 'error'); return; }
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
      showToast(t('hr.leaveSubmittedFor', { name: user.name }), 'success');
      setLeaveOpen(false);
      setLeaveForm({ userId: '', leaveType: 'annual', startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), reason: '' });
      reloadLeave();
    } catch (err) {
      console.error(err);
      showToast(t('hr.leaveSubmitFailed'), 'error');
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
      showToast(status === 'approved' ? t('hr.leaveApproved') : t('hr.leaveRejected'), 'success');
      reloadLeave();
    } catch (err) {
      console.error(err);
      showToast(status === 'approved' ? t('hr.leaveApproveFailed') : t('hr.leaveRejectFailed'), 'error');
    }
  };

  const handleAddShift = async () => {
    const user = users.find(u => u._id === scheduleForm.userId);
    if (!user) { showToast(t('hr.selectStaffMember'), 'error'); return; }
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
      showToast(t('hr.shiftScheduledFor', { name: user.name, shift: scheduleForm.shiftType }), 'success');
      setScheduleOpen(false);
      setScheduleForm({ ...scheduleForm, userId: '', notes: '' });
      reloadSchedules();
    } catch (err) {
      console.error(err);
      showToast(t('hr.scheduleCreateFailed'), 'error');
    }
  };

  const removeShift = async (id: string) => {
    try {
      const { deleteSchedule } = await import('@/lib/services/staff-scheduling-service');
      await deleteSchedule(id);
      reloadSchedules();
    } catch {
      showToast(t('hr.shiftRemoveFailed'), 'error');
    }
  };

  const handleAddPayroll = async () => {
    const user = users.find(u => u._id === payrollForm.userId);
    if (!user) { showToast(t('hr.selectStaffMember'), 'error'); return; }
    if (payrollForm.baseSalary <= 0) { showToast(t('hr.baseSalaryPositive'), 'error'); return; }
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
      showToast(t('hr.payrollEntryCreatedFor', { name: user.name }), 'success');
      setPayrollOpen(false);
      setPayrollForm({ userId: '', baseSalary: 0, allowances: 0, deductions: 0, currency: 'SSP', notes: '' });
      reloadPayroll();
    } catch (err) {
      console.error(err);
      showToast(t('hr.payrollCreateFailed'), 'error');
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
      showToast(t('hr.payrollStatusFailed'), 'error');
    }
  };

  return (
    <>
      <TopBar title={t('hr.topBarTitle')} actions={
        <div className="flex gap-2">
          {tab === 'leave' && (
            <button onClick={() => setLeaveOpen(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('hr.requestLeave')}
            </button>
          )}
          {tab === 'schedule' && (
            <button onClick={() => setScheduleOpen(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('hr.scheduleShift')}
            </button>
          )}
          {tab === 'payroll' && (
            <button onClick={() => setPayrollOpen(true)} className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('hr.addPayrollEntry')}
            </button>
          )}
        </div>
      } />
      <main className="page-container page-enter">
        {/* Summary KPIs (leave-focused — stays useful across tabs) */}
        {leaveSummary && (
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch' }}>
            {[
              { label: t('hr.kpiActiveStaff'), value: facilityUsers.length, accent: 'var(--accent-primary)', bg: 'rgba(33, 145, 208, 0.08)', border: 'rgba(59, 130, 246, 0.22)' },
              { label: t('hr.kpiPendingLeave'), value: leaveSummary.pending, accent: 'var(--color-warning-text)', bg: 'rgba(228, 168, 75, 0.12)', border: 'rgba(228, 168, 75, 0.30)' },
              { label: t('hr.kpiApprovedUpcoming'), value: leaveSummary.upcoming, accent: 'var(--accent-primary)', bg: 'rgba(33, 145, 208, 0.10)', border: 'rgba(59, 130, 246, 0.26)' },
              { label: t('hr.kpiDaysOffThisMonth'), value: leaveSummary.daysApprovedThisMonth, accent: 'var(--color-success-text)', bg: 'rgba(27, 158, 119, 0.10)', border: 'rgba(27, 158, 119, 0.26)' },
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
            { id: 'roster', label: t('hr.staffRoster') },
            { id: 'leave', label: t('hr.leaveRequests') },
            { id: 'schedule', label: t('hr.shiftSchedule') },
            { id: 'payroll', label: t('hr.payrollTab') },
          ] as { id: TabId; label: string }[]).map(tabItem => {
            const isActive = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => setTabAndUrl(tabItem.id)}
                className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-colors"
                style={{
                  background: isActive ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                }}
              >
                {tabItem.label}
              </button>
            );
          })}
        </div>

        {/* ── ROSTER ──────────────────────────────────────── */}
        {tab === 'roster' && (
          <div className="dash-card overflow-hidden">
            <div className="p-4 pb-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('hr.activeRoster')}</h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={rosterSearch}
                      onChange={e => setRosterSearch(e.target.value)}
                      placeholder={t('hr.searchStaffPlaceholder')}
                      className="text-[12px] rounded-full pl-7 pr-3 py-1.5 outline-none"
                      style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', minWidth: 200 }}
                    />
                  </div>
                  <select
                    value={rosterRole}
                    onChange={e => setRosterRole(e.target.value)}
                    className="text-[12px] font-medium capitalize rounded-full px-3 py-1.5 outline-none"
                    style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                  >
                    <option value="all">{t('hr.allRoles')} ({facilityUsers.length})</option>
                    {Object.entries(roleCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([role, count]) => (
                      <option key={role} value={role} className="capitalize">
                        {role.replace(/_/g, ' ')} ({count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>{t('hr.colStaff')}</th>
                  <th>{t('hr.colRole')}</th>
                  <th>{t('hr.colUsername')}</th>
                  <th>{t('hr.colFacility')}</th>
                  <th>{t('hr.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRosterUsers.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    {facilityUsers.length === 0 ? t('hr.noStaffForFacility') : t('hr.noStaffMatchFilters')}
                  </td></tr>
                )}
                {filteredRosterUsers.map(u => {
                  const initials = u.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2191D0 0%, #015697 100%)' }}>{initials || '?'}</div>
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
                          color: u.isActive === false ? 'var(--color-danger-text)' : 'var(--color-success-text)',
                        }}>
                          {u.isActive === false ? t('hr.inactive') : t('hr.active')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* ── LEAVE ──────────────────────────────────────── */}
        {tab === 'leave' && (
          <div className="dash-card">
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm">{t('hr.leaveRequests')}</h3>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('hr.totalCount', { count: leave.length })}</span>
            </div>
            {leave.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                {t('hr.noLeaveRequestsYet')} <strong>{t('hr.requestLeave')}</strong> {t('hr.above')}
              </div>
            ) : (
              <div>
                {leave.map(r => {
                  const tok = STATUS_TOKENS[r.status];
                  return (
                    <div key={r._id} className={`data-row ${r.status === 'pending' ? 'data-row--warning' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="data-row__label">{r.userName} · <span className="capitalize">{r.role.replace(/_/g, ' ')}</span></div>
                        <div className="data-row__value">
                          <span className="capitalize">{r.leaveType}</span> · {r.days}d · {r.startDate} → {r.endDate}
                        </div>
                        {r.reason && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>“{r.reason}”</div>}
                        {r.decisionNotes && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('hr.noteLabel', { note: r.decisionNotes })}</div>}
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: tok.bg, color: tok.color, border: `1px solid ${tok.color}40` }}>
                        {t(`hr.leaveStatus_${r.status}`)}
                      </span>
                      {isApprover && r.status === 'pending' && (
                        <div className="ml-2">
                          <RowActionsMenu
                            actions={[
                              { key: 'approve', label: t('hr.approve'), tone: 'success', onClick: () => decideLeave(r._id, 'approved') },
                              { key: 'reject', label: t('hr.reject'), tone: 'danger', onClick: () => decideLeave(r._id, 'rejected') },
                            ]}
                          />
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
              <h3 className="font-semibold text-sm">{t('hr.shiftSchedule')}</h3>
              <div className="flex items-center gap-2">
                <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('hr.date')}</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ width: 160 }} />
                <span className="text-[11px] ml-2" style={{ color: 'var(--text-muted)' }}>{t('hr.shiftsCount', { count: schedules.length })}</span>
              </div>
            </div>
            {schedules.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                {t('hr.noShiftsScheduled', { date: scheduleDate })} <strong>{t('hr.scheduleShift')}</strong> {t('hr.aboveToAddOne')}
              </div>
            ) : (
              <div>
                {SHIFT_TYPES.map(shift => {
                  const list = schedules.filter(s => s.shiftType === shift);
                  if (list.length === 0) return null;
                  const shiftColor = shift === 'morning' ? 'var(--color-success-text)' : shift === 'afternoon' ? 'var(--color-warning-400)' : shift === 'night' ? '#015697' : 'var(--accent-primary)';
                  return (
                    <div key={shift}>
                      <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: shiftColor, background: 'var(--overlay-subtle)', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: shiftColor }} />
                          {t(`hr.shiftType_${shift}`)} · {list.length}
                        </span>
                      </div>
                      {list.map(s => (
                        <div key={s._id} className="data-row">
                          <div className="flex-1 min-w-0">
                            <div className="data-row__value">{s.userName}</div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              <span className="capitalize">{s.role.replace(/_/g, ' ')}</span>
                              {s.department && ` · ${s.department}`}
                              {' · '}{s.startTime}–{s.endTime}
                              {s.isOnCall && <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(59, 130, 246, 0.16)', color: 'var(--accent-primary)' }}>{t('hr.onCall')}</span>}
                            </div>
                          </div>
                          <RowActionsMenu
                            actions={[
                              { key: 'remove', label: t('hr.removeShift'), tone: 'danger', icon: <Trash2 className="w-4 h-4" />, onClick: () => removeShift(s._id) },
                            ]}
                          />
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
              <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('hr.period')}</label>
              <input type="month" value={payrollPeriod} onChange={e => setPayrollPeriod(e.target.value)} style={{ width: 160 }} />
              {payrollSummary && (
                <div className="flex gap-2 flex-wrap ml-auto">
                  <Pill label={t('hr.pillEntries')} value={String(payrollSummary.total)} />
                  <Pill label={t('hr.pillGross')} value={formatMoney(payrollSummary.totalGross)} accent="var(--accent-primary)" />
                  <Pill label={t('hr.pillDeductions')} value={formatMoney(payrollSummary.totalDeductions)} accent="var(--color-warning-text)" />
                  <Pill label={t('hr.pillNet')} value={formatMoney(payrollSummary.totalNet)} accent="var(--color-success-text)" />
                  <Pill label={t('hr.pillPaid')} value={`${payrollSummary.paid}/${payrollSummary.total}`} accent="var(--color-success-text)" />
                </div>
              )}
            </div>
            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm">{t('hr.payrollRegisterPeriod', { period: payrollPeriod })}</h3>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('hr.entriesCount', { count: payroll.length })}</span>
              </div>
              {payroll.length === 0 ? (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {t('hr.noPayrollEntries', { period: payrollPeriod })} <strong>{t('hr.addPayrollEntry')}</strong> {t('hr.aboveToStartRegister')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="data-table" style={{ minWidth: 840 }}>
                  <thead>
                    <tr>
                      <th>{t('hr.colStaff')}</th>
                      <th className="text-right">{t('hr.colBase')}</th>
                      <th className="text-right">{t('hr.colAllowances')}</th>
                      <th className="text-right">{t('hr.colDeductions')}</th>
                      <th className="text-right">{t('hr.colNetPay')}</th>
                      <th>{t('hr.colStatus')}</th>
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
                          <td className="text-xs text-right font-mono" style={{ color: 'var(--text-primary)' }}>{formatMoney(e.baseSalary, { currency: e.currency })}</td>
                          <td className="text-xs text-right font-mono" style={{ color: 'var(--accent-primary)' }}>+{formatMoney(e.allowances, { currency: e.currency })}</td>
                          <td className="text-xs text-right font-mono" style={{ color: 'var(--color-warning-text)' }}>-{formatMoney(e.deductions, { currency: e.currency })}</td>
                          <td className="text-sm text-right font-mono font-bold" style={{ color: 'var(--color-success-text)' }}>{formatMoney(e.netPay, { currency: e.currency })}</td>
                          <td>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{ background: tok.bg, color: tok.color, border: `1px solid ${tok.color}40` }}>
                              {t(`hr.payrollStatus_${e.status}`)}
                            </span>
                          </td>
                          <td>
                            <div className="flex justify-end">
                              <RowActionsMenu
                                actions={[
                                  ...(e.status === 'draft' && isApprover ? [{ key: 'approve', label: t('hr.approve'), tone: 'success' as const, onClick: () => setPayStatus(e._id, 'approved') }] : []),
                                  ...(e.status === 'approved' && isApprover ? [{ key: 'paid', label: t('hr.markPaid'), tone: 'success' as const, onClick: () => setPayStatus(e._id, 'paid') }] : []),
                                  ...(e.status === 'paid' && isApprover ? [{ key: 'reverse', label: t('hr.reverse'), onClick: () => setPayStatus(e._id, 'reversed') }] : []),
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Modals ────────────────────────────────────── */}
        {leaveOpen && (
          <Modal onClose={() => setLeaveOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('hr.requestLeave')}</h3>
                <button onClick={() => setLeaveOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelStaffRequired')}</label>
                  <select value={leaveForm.userId} onChange={e => setLeaveForm({ ...leaveForm, userId: e.target.value })}>
                    <option value="">{t('hr.selectStaffOption')}</option>
                    {(isApprover ? users : users.filter(u => u._id === currentUser?._id)).map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelType')}</label>
                    <select value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value as LeaveType })}>
                      {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{t(`hr.leaveType_${lt.id}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelStart')}</label>
                    <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelEnd')}</label>
                    <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelReason')}</label>
                  <textarea rows={2} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder={t('hr.optional')} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setLeaveOpen(false)} className="btn btn-secondary flex-1">{t('hr.cancel')}</button>
                <button onClick={handleRequestLeave} className="btn btn-primary flex-1">{t('hr.submit')}</button>
              </div>
            </div>
          </Modal>
        )}

        {scheduleOpen && (
          <Modal onClose={() => setScheduleOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('hr.scheduleShift')}</h3>
                <button onClick={() => setScheduleOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelStaffRequired')}</label>
                  <select value={scheduleForm.userId} onChange={e => setScheduleForm({ ...scheduleForm, userId: e.target.value })}>
                    <option value="">{t('hr.selectStaffOption')}</option>
                    {facilityUsers.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelShift')}</label>
                    <select value={scheduleForm.shiftType} onChange={e => setScheduleForm({ ...scheduleForm, shiftType: e.target.value as StaffScheduleDoc['shiftType'] })}>
                      {SHIFT_TYPES.map(s => <option key={s} value={s} className="capitalize">{t(`hr.shiftType_${s}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.date')}</label>
                    <input type="date" value={scheduleForm.shiftDate} onChange={e => setScheduleForm({ ...scheduleForm, shiftDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelStart')}</label>
                    <input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelEnd')}</label>
                    <input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelDepartment')}</label>
                  <input value={scheduleForm.department} onChange={e => setScheduleForm({ ...scheduleForm, department: e.target.value })} placeholder={t('hr.departmentPlaceholder')} />
                </div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={scheduleForm.isOnCall} onChange={e => setScheduleForm({ ...scheduleForm, isOnCall: e.target.checked })} />
                  {t('hr.onCallShift')}
                </label>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelNotes')}</label>
                  <textarea rows={2} value={scheduleForm.notes} onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setScheduleOpen(false)} className="btn btn-secondary flex-1">{t('hr.cancel')}</button>
                <button onClick={handleAddShift} className="btn btn-primary flex-1">{t('hr.saveShift')}</button>
              </div>
            </div>
          </Modal>
        )}

        {payrollOpen && (
          <Modal onClose={() => setPayrollOpen(false)}>
            <div className="modal-content card-elevated p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{t('hr.addPayrollEntryPeriod', { period: payrollPeriod })}</h3>
                <button onClick={() => setPayrollOpen(false)} className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelStaffRequired')}</label>
                  <select value={payrollForm.userId} onChange={e => setPayrollForm({ ...payrollForm, userId: e.target.value })}>
                    <option value="">{t('hr.selectStaffOption')}</option>
                    {facilityUsers.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelCurrency')}</label>
                    <select value={payrollForm.currency} onChange={e => setPayrollForm({ ...payrollForm, currency: e.target.value })}>
                      <option value="SSP">SSP</option><option value="USD">USD</option><option value="KES">KES</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelBaseSalary')}</label>
                    <input type="number" min={0} value={payrollForm.baseSalary || ''} onChange={e => setPayrollForm({ ...payrollForm, baseSalary: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelAllowances')}</label>
                    <input type="number" min={0} value={payrollForm.allowances || ''} onChange={e => setPayrollForm({ ...payrollForm, allowances: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelDeductions')}</label>
                    <input type="number" min={0} value={payrollForm.deductions || ''} onChange={e => setPayrollForm({ ...payrollForm, deductions: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--overlay-subtle)' }}>
                  <div className="flex justify-between text-[12px]"><span style={{ color: 'var(--text-muted)' }}>{t('hr.netPay')}</span><span className="font-bold font-mono" style={{ color: 'var(--color-success-text)' }}>{formatMoney(payrollForm.baseSalary + payrollForm.allowances - payrollForm.deductions, { currency: payrollForm.currency })}</span></div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('hr.labelNotes')}</label>
                  <textarea rows={2} value={payrollForm.notes} onChange={e => setPayrollForm({ ...payrollForm, notes: e.target.value })} />
                </div>
              </div>
              <hr className="section-divider" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setPayrollOpen(false)} className="btn btn-secondary flex-1">{t('hr.cancel')}</button>
                <button onClick={handleAddPayroll} className="btn btn-primary flex-1">{t('hr.addEntry')}</button>
              </div>
            </div>
          </Modal>
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
