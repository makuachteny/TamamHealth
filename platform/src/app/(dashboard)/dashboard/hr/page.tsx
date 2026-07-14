'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Clock, Calendar, Activity } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useUsers } from '@/lib/hooks/useUsers';
import EhrCareDashboard, { type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import { formatDateTitle, toIsoDate } from '@/components/ehr/EhrMiniCalendar';
import type { LeaveRequestDoc } from '@/lib/db-types-hr';
import type { StaffScheduleDoc } from '@/lib/db-types';

/**
 * HR home — Records & people-ops landing page for HRIO and medical
 * superintendents. Surfaces today's roster status + the queue of
 * pending leave decisions so the day starts with action items, not
 * a wall of charts. Rendered on the shared EhrCareDashboard shell so
 * it matches the Clinical Officer / Lab / Radiology look.
 */
export default function HRDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { users } = useUsers();
  const [leave, setLeave] = useState<LeaveRequestDoc[]>([]);
  const [schedules, setSchedules] = useState<StaffScheduleDoc[]>([]);
  const [loading, setLoading] = useState(true);
  // Single work list (pending leave decisions) rendered as shell rows; the tab
  // is kept as state so the shared shell's tab bar stays interactive.
  const [leaveTab, setLeaveTab] = useState('pending');
  const [selectedLeave, setSelectedLeave] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const facilityId = currentUser?.hospitalId;
  const facilityName = currentUser?.hospitalName || t('common.facility');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ getAllLeaveRequests }, { getSchedulesByDate }] = await Promise.all([
          import('@/lib/services/leave-service'),
          import('@/lib/services/staff-scheduling-service'),
        ]);
        const [l, s] = await Promise.all([
          getAllLeaveRequests(),
          getSchedulesByDate(today, facilityId),
        ]);
        if (cancelled) return;
        setLeave(l);
        setSchedules(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [today, facilityId]);

  const facilityUsers = useMemo(
    () => facilityId ? users.filter(u => u.hospitalId === facilityId) : users,
    [users, facilityId],
  );

  const pendingLeave = leave.filter(l => l.status === 'pending');
  const onLeaveToday = leave.filter(l =>
    l.status === 'approved' && l.startDate <= today && l.endDate >= today
  );
  const upcomingLeave = leave
    .filter(l => l.status === 'approved' && l.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5);
  const upcomingApprovedCount = leave.filter(l => l.status === 'approved' && l.startDate > today).length;

  const presentToday = facilityUsers.length - onLeaveToday.length;
  const onCallToday = schedules.filter(s => s.isOnCall).length;
  const morningStaff = schedules.filter(s => s.shiftType === 'morning').length;
  const nightStaff = schedules.filter(s => s.shiftType === 'night').length;

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of facilityUsers) counts[u.role] = (counts[u.role] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [facilityUsers]);

  const dateLabel = formatDateTitle(toIsoDate(new Date()));

  // Search filters the pending-decisions work list by staff name / role / type.
  const query = staffSearch.trim().toLowerCase();
  const filteredPending = query
    ? pendingLeave.filter(r =>
        (r.userName || '').toLowerCase().includes(query) ||
        (r.role || '').toLowerCase().includes(query) ||
        (r.leaveType || '').toLowerCase().includes(query))
    : pendingLeave;

  // Expandable per-row detail (leave window, role, reason) shown inline beneath
  // the row via EhrCareDashboard's `row.detail` slot, gated on the selected row.
  const renderLeaveDetail = (r: LeaveRequestDoc) => (
    <div style={{ margin: '0 0 8px', padding: '12px', borderRadius: 8, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{r.leaveType} · {r.days}d</span>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.startDate} → {r.endDate}</span>
      </div>
      <p className="text-[11px] capitalize" style={{ color: 'var(--text-secondary)' }}>{r.role.replace(/_/g, ' ')}</p>
      {r.reason && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>“{r.reason}”</p>}
    </div>
  );

  if (loading) {
    return (
      <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: 'var(--text-muted)' }}>
          <Activity size={44} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
          <span>{t('hr.loadingData')}</span>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <EhrCareDashboard
        title={t('hr.dashboardTitle')}
        greetingName={currentUser?.name}
        dateLabel={dateLabel}
        centerTitle={t('hr.pendingLeaveDecisions')}
        tabs={[
          { key: 'pending', label: t('hr.kpiPendingDecisions'), count: pendingLeave.length },
        ]}
        activeTab={leaveTab}
        onTabChange={setLeaveTab}
        searchValue={staffSearch}
        searchPlaceholder={t('topbar.searchPlaceholder')}
        onSearchChange={setStaffSearch}
        filters={[]}
        actions={[
          { label: t('hr.manageStaff'), icon: Users, onClick: () => router.push('/hr') },
          { label: t('hr.newLeaveRequest'), icon: Plus, onClick: () => router.push('/hr?tab=leave'), tone: 'primary' },
        ]}
        rows={filteredPending.map((r): EhrCareDashboardRow => {
          const isOpen = selectedLeave === r._id;
          return {
            id: r._id,
            title: r.userName,
            subtitle: `${r.leaveType} · ${r.days}d · ${r.startDate} → ${r.endDate}`,
            compactMeta: `${r.days}d`,
            status: r.leaveType,
            statusTone: 'warning',
            onClick: () => setSelectedLeave(isOpen ? null : r._id),
            detail: isOpen ? renderLeaveDetail(r) : undefined,
          };
        })}
        metrics={[
          { label: t('hr.kpiActiveStaff'), value: facilityUsers.length },
          { label: t('hr.kpiPresentToday'), value: presentToday, tone: 'success' },
          { label: t('hr.kpiOnLeaveToday'), value: onLeaveToday.length, tone: onLeaveToday.length > 0 ? 'warning' : 'neutral' },
          { label: t('hr.kpiPendingDecisions'), value: pendingLeave.length, tone: pendingLeave.length > 0 ? 'danger' : 'neutral' },
          { label: t('hr.kpiOnCallToday'), value: onCallToday },
        ]}
        metricsTitle={t('hr.dashboardTitle')}
        checklist={[
          { label: `${t('hr.staffRoster')} · ${t('hr.staffCount', { count: facilityUsers.length })}`, done: facilityUsers.length > 0, href: '/hr?tab=roster' },
          { label: `${t('hr.leaveQueue')} · ${t('hr.pendingCount', { count: pendingLeave.length })}`, done: pendingLeave.length === 0, href: '/hr?tab=leave' },
          { label: `${t('hr.scheduleShifts')} · ${t('hr.todayCount', { count: schedules.length })}`, done: schedules.length > 0, href: '/hr?tab=schedule' },
          { label: `${t('hr.payrollRegister')} · ${t('hr.monthlyPayroll')}`, done: false, href: '/hr?tab=payroll' },
        ]}
        checklistTitle={t('hr.quickActions')}
        missionTitle={t('hr.dashboardTitle')}
        missionDescription={t('hr.facilityWelcome', { facility: facilityName, name: currentUser?.name || t('hr.hrOfficer') })}
        emptyTitle={t('hr.noPendingLeave')}
        emptyActionLabel={t('hr.viewAll')}
        onEmptyAction={() => router.push('/hr?tab=leave')}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ minWidth: 0 }}>
          {/* Today's shifts */}
          <div className="dash-card">
            <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <Clock className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('hr.todaysShifts')}</span>
            </div>
            <div className="p-4 space-y-2">
              <ShiftRow label={t('hr.shiftMorning')} count={morningStaff} accent="#15795C" />
              <ShiftRow label={t('hr.shiftAfternoon')} count={schedules.filter(s => s.shiftType === 'afternoon').length} accent="#E4A84B" />
              <ShiftRow label={t('hr.shiftNight')} count={nightStaff} accent="#015697" />
              <ShiftRow label={t('hr.shiftOnCall')} count={onCallToday} accent="#2191D0" />
            </div>
          </div>

          {/* Upcoming leave */}
          <div className="dash-card">
            <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('hr.upcomingLeave')}</span>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('hr.countApproved', { count: upcomingApprovedCount })}</span>
            </div>
            {upcomingLeave.length === 0 ? (
              <div className="p-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('hr.noUpcomingLeave')}</div>
            ) : (
              <div className="p-2">
                {upcomingLeave.map(l => (
                  <div key={l._id} className="data-row" style={{ padding: '10px 14px' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{l.userName}</div>
                      <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                        <span className="capitalize">{l.leaveType}</span> · {l.startDate}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(33, 145, 208, 0.14)', color: '#2191D0' }}>{l.days}d</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Roster by role */}
          <div className="dash-card">
            <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <Users className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('hr.rosterByRole')}</span>
            </div>
            <div className="p-4 space-y-2">
              {roleCounts.length === 0 ? (
                <div className="text-[12px] text-center" style={{ color: 'var(--text-muted)' }}>{t('hr.noStaffRegistered')}</div>
              ) : roleCounts.map(([role, count]) => (
                <div key={role} className="flex items-center justify-between text-[12.5px]">
                  <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{role.replace(/_/g, ' ')}</span>
                  <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </EhrCareDashboard>
    </main>
  );
}

function ShiftRow({ label, count, accent }: { label: string; count: number; accent: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
        {label}
      </span>
      <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{count}</span>
    </div>
  );
}
