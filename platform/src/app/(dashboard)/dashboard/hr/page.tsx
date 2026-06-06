'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import {
  Users, Calendar, Clock, CheckCircle2, AlertCircle, ChevronRight,
  Plus, ArrowRight, Wallet, Activity,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useUsers } from '@/lib/hooks/useUsers';
import type { LeaveRequestDoc } from '@/lib/db-types-hr';
import type { StaffScheduleDoc } from '@/lib/db-types';

/**
 * HR home — Records & people-ops landing page for HRIO and medical
 * superintendents. Surfaces today's roster status + the queue of
 * pending leave decisions so the day starts with action items, not
 * a wall of charts.
 */
export default function HRDashboardPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { users } = useUsers();
  const [leave, setLeave] = useState<LeaveRequestDoc[]>([]);
  const [schedules, setSchedules] = useState<StaffScheduleDoc[]>([]);
  const [loading, setLoading] = useState(true);

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

  const presentToday = facilityUsers.length - onLeaveToday.length;
  const onCallToday = schedules.filter(s => s.isOnCall).length;
  const morningStaff = schedules.filter(s => s.shiftType === 'morning').length;
  const nightStaff = schedules.filter(s => s.shiftType === 'night').length;

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of facilityUsers) counts[u.role] = (counts[u.role] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [facilityUsers]);

  if (loading) {
    return (
      <>
        <TopBar title={t('hr.dashboardTitle')} />
        <main className="page-container page-enter">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320, color: 'var(--text-muted)' }}>
            <Activity size={44} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
            <span>{t('hr.loadingData')}</span>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('hr.dashboardTitle')} />
      <main className="page-container page-enter">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: -0.3 }}>{t('hr.dashboardTitle')}</h1>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
              {t('hr.facilityWelcome', { facility: facilityName, name: currentUser?.name || t('hr.hrOfficer') })}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/hr" className="btn btn-secondary">
              <Users className="w-4 h-4" /> {t('hr.manageStaff')}
            </Link>
            <Link href="/hr?tab=leave" className="btn btn-primary">
              <Plus className="w-4 h-4" /> {t('hr.newLeaveRequest')}
            </Link>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'stretch' }}>
          {[
            { id: 'activeStaff', label: t('hr.kpiActiveStaff'), value: facilityUsers.length, accent: 'var(--accent-primary)', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.22)' },
            { id: 'presentToday', label: t('hr.kpiPresentToday'), value: presentToday, accent: '#15795C', bg: 'rgba(27, 158, 119, 0.10)', border: 'rgba(27, 158, 119, 0.26)' },
            { id: 'onLeaveToday', label: t('hr.kpiOnLeaveToday'), value: onLeaveToday.length, accent: onLeaveToday.length > 0 ? '#B8741C' : 'var(--accent-primary)', bg: onLeaveToday.length > 0 ? 'rgba(228, 168, 75, 0.12)' : 'rgba(59, 130, 246, 0.08)', border: onLeaveToday.length > 0 ? 'rgba(228, 168, 75, 0.30)' : 'rgba(59, 130, 246, 0.22)' },
            { id: 'pendingDecisions', label: t('hr.kpiPendingDecisions'), value: pendingLeave.length, accent: pendingLeave.length > 0 ? '#C44536' : 'var(--accent-primary)', bg: pendingLeave.length > 0 ? 'rgba(196, 69, 54, 0.10)' : 'rgba(59, 130, 246, 0.08)', border: pendingLeave.length > 0 ? 'rgba(196, 69, 54, 0.28)' : 'rgba(59, 130, 246, 0.22)' },
            { id: 'onCallToday', label: t('hr.kpiOnCallToday'), value: onCallToday, accent: '#3b82f6', bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.26)' },
          ].map(k => (
            <div key={k.id} style={{ padding: '14px 16px', borderRadius: 10, background: k.bg, border: `1px solid ${k.border}`, position: 'relative' }}>
              {k.id === 'pendingDecisions' && pendingLeave.length > 0 && <span className="data-tile__alarm-pulse" aria-hidden="true" />}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: k.accent }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 2 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
          {/* Pending decisions queue (bigger column) */}
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="font-semibold text-sm">{t('hr.pendingLeaveDecisions')}</h3>
              <Link href="/hr?tab=leave" className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                {t('hr.viewAll')} <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {pendingLeave.length === 0 ? (
              <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#15795C', opacity: 0.6 }} />
                {t('hr.noPendingLeave')}
              </div>
            ) : (
              <div>
                {pendingLeave.slice(0, 8).map(r => {
                  const initials = r.userName.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                  return (
                    <Link key={r._id} href="/hr?tab=leave" className="data-row data-row--warning">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1E3A8A 100%)' }}>{initials || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.userName}</span>
                          <span className="text-[10.5px] capitalize" style={{ color: 'var(--text-muted)' }}>{r.role.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="text-[11.5px] mt-0.5" style={{ color: '#B8741C' }}>
                          <span className="capitalize font-semibold">{r.leaveType}</span> · {r.days}d · {r.startDate} → {r.endDate}
                        </div>
                        {r.reason && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>“{r.reason}”</div>}
                      </div>
                      <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column: Today shifts + Upcoming leave + Role breakdown */}
          <div className="space-y-4">
            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm">{t('hr.todaysShifts')}</h3>
              </div>
              <div className="p-4 space-y-2">
                <ShiftRow label={t('hr.shiftMorning')} count={morningStaff} accent="#15795C" />
                <ShiftRow label={t('hr.shiftAfternoon')} count={schedules.filter(s => s.shiftType === 'afternoon').length} accent="#E4A84B" />
                <ShiftRow label={t('hr.shiftNight')} count={nightStaff} accent="#1E3A8A" />
                <ShiftRow label={t('hr.shiftOnCall')} count={onCallToday} accent="#3b82f6" />
              </div>
            </div>

            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm">{t('hr.upcomingLeave')}</h3>
                <Link href="/hr?tab=leave" className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('hr.countApproved', { count: leave.filter(l => l.status === 'approved' && l.startDate > today).length })}</Link>
              </div>
              {upcomingLeave.length === 0 ? (
                <div className="p-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('hr.noUpcomingLeave')}</div>
              ) : (
                <div>
                  {upcomingLeave.map(l => (
                    <div key={l._id} className="data-row" style={{ padding: '10px 14px' }}>
                      <div className="data-row__icon" style={{ width: 28, height: 28 }}>
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{l.userName}</div>
                        <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                          <span className="capitalize">{l.leaveType}</span> · {l.startDate}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(59, 130, 246, 0.14)', color: '#3b82f6' }}>{l.days}d</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dash-card overflow-hidden">
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <h3 className="font-semibold text-sm">{t('hr.rosterByRole')}</h3>
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
        </div>

        {/* Quick actions */}
        <div className="dash-card mt-4 p-4">
          <h3 className="font-semibold text-sm mb-3">{t('hr.quickActions')}</h3>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'stretch' }}>
            <QuickAction href="/hr?tab=roster" icon={<Users className="w-4 h-4" />} label={t('hr.staffRoster')} subtitle={t('hr.staffCount', { count: facilityUsers.length })} />
            <QuickAction href="/hr?tab=leave" icon={<Calendar className="w-4 h-4" />} label={t('hr.leaveQueue')} subtitle={t('hr.pendingCount', { count: pendingLeave.length })} alarm={pendingLeave.length > 0} />
            <QuickAction href="/hr?tab=schedule" icon={<Clock className="w-4 h-4" />} label={t('hr.scheduleShifts')} subtitle={t('hr.todayCount', { count: schedules.length })} />
            <QuickAction href="/hr?tab=payroll" icon={<Wallet className="w-4 h-4" />} label={t('hr.payrollRegister')} subtitle={t('hr.monthlyPayroll')} />
          </div>
        </div>
      </main>
    </>
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

function QuickAction({ href, icon, label, subtitle, alarm }: { href: string; icon: React.ReactNode; label: string; subtitle: string; alarm?: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{
        background: alarm ? 'rgba(196, 69, 54, 0.06)' : 'var(--overlay-subtle)',
        border: alarm ? '1px solid rgba(196, 69, 54, 0.28)' : '1px solid var(--border-light)',
      }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{
        background: alarm ? 'rgba(196, 69, 54, 0.12)' : 'var(--accent-light)',
        color: alarm ? '#C44536' : 'var(--accent-primary)',
      }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
        <div className="text-[10.5px]" style={{ color: alarm ? '#8B2E24' : 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      {alarm ? (
        <AlertCircle className="w-4 h-4" style={{ color: '#C44536' }} />
      ) : (
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      )}
    </Link>
  );
}
