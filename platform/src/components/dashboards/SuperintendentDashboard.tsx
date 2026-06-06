'use client';

// Admin-oriented landing for the Medical Superintendent — the clinical
// administrator who runs the hospital. Unlike the doctor/clinical-officer
// `/dashboard` (SOAP / prescribe / lab quick-actions), this surfaces the
// management view: staffing, bed capacity, pending leave decisions, finance
// and facility oversight, plus the disease-surveillance signal an
// administrator needs at a glance. It reuses the same hooks/services as the
// HR dashboard and the clinical dashboard so the numbers stay consistent.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  Users, Stethoscope, HeartPulse, BedDouble, Wallet, Package,
  ClipboardCheck, BarChart3, Activity, AlertTriangle, SendHorizontal,
  ChevronRight, ArrowRight, Building2,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useUsers } from '@/lib/hooks/useUsers';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import type { LeaveRequestDoc } from '@/lib/db-types-hr';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

interface QuickAction {
  href: string;
  labelKey: string;
  descKey: string;
  Icon: typeof Users;
}

const QUICK_ACTIONS: QuickAction[] = [
  { href: '/hr', labelKey: 'superintendent.qaHrLabel', descKey: 'superintendent.qaHrDesc', Icon: Users },
  { href: '/wards', labelKey: 'superintendent.qaWardsLabel', descKey: 'superintendent.qaWardsDesc', Icon: BedDouble },
  { href: '/payments', labelKey: 'superintendent.qaBillsLabel', descKey: 'superintendent.qaBillsDesc', Icon: Wallet },
  { href: '/facility-assessments', labelKey: 'superintendent.qaFacilityLabel', descKey: 'superintendent.qaFacilityDesc', Icon: ClipboardCheck },
  { href: '/equipment', labelKey: 'superintendent.qaEquipmentLabel', descKey: 'superintendent.qaEquipmentDesc', Icon: Package },
  { href: '/reports', labelKey: 'superintendent.qaReportsLabel', descKey: 'superintendent.qaReportsDesc', Icon: BarChart3 },
];

export default function SuperintendentDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { users } = useUsers();
  const { referrals } = useReferrals();
  const { alerts: diseaseAlerts } = useSurveillance();
  const [leave, setLeave] = useState<LeaveRequestDoc[]>([]);

  const facilityId = currentUser?.hospitalId;
  const facilityName = currentUser?.hospitalName || currentUser?.hospital?.name || t('common.facility');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getAllLeaveRequests } = await import('@/lib/services/leave-service');
        const l = await getAllLeaveRequests();
        if (!cancelled) setLeave(l);
      } catch {
        // Leave service is optional context here — fail soft to an empty queue.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const facilityUsers = useMemo(
    () => (facilityId ? users.filter(u => u.hospitalId === facilityId) : users),
    [users, facilityId],
  );

  const pendingLeave = leave.filter(l => l.status === 'pending');
  const onLeaveToday = leave.filter(
    l => l.status === 'approved' && l.startDate <= today && l.endDate >= today,
  );

  const hospital = currentUser?.hospital;
  const totalDoctors = hospital?.doctors || 0;
  const totalNurses = hospital?.nurses || 0;
  const bedTotal = hospital?.totalBeds || 0;
  // Same demo-mode occupancy derivation as the clinical dashboard so the two
  // views agree; collapses to 0 in production until a real occupancy feed exists.
  const bedOccupancy = bedTotal && IS_DEMO ? Math.round(bedTotal * 0.72) : 0;
  const occupancyPct = bedTotal ? Math.round((bedOccupancy / bedTotal) * 100) : 0;

  const activeAlerts = diseaseAlerts.filter(a => a.alertLevel === 'emergency' || a.alertLevel === 'warning');
  const pendingReferrals = referrals.filter(r => r.status === 'sent' || r.status === 'received');

  const kpis = [
    { id: 'staff', label: t('dashboard.activeStaff'), value: facilityUsers.length || (totalDoctors + totalNurses), sub: t('superintendent.staffSub', { doctors: totalDoctors, nurses: totalNurses }), Icon: Users, color: 'var(--accent-primary)', href: '/hr' },
    { id: 'beds', label: t('dashboard.bedOccupancy'), value: `${occupancyPct}%`, sub: t('superintendent.bedsSub', { occupied: bedOccupancy, total: bedTotal }), Icon: BedDouble, color: '#15795C', href: '/wards' },
    { id: 'leave', label: t('hr.kpiPendingLeave'), value: pendingLeave.length, sub: t('superintendent.leaveSub', { count: onLeaveToday.length }), Icon: ClipboardCheck, color: pendingLeave.length > 0 ? '#C44536' : 'var(--accent-primary)', href: '/hr?tab=leave', alarm: pendingLeave.length > 0 },
    { id: 'alerts', label: t('dashboard.activeAlerts'), value: activeAlerts.length, sub: t('superintendent.alertsSub', { count: pendingReferrals.length }), Icon: AlertTriangle, color: activeAlerts.length > 0 ? '#C44536' : 'var(--accent-primary)', href: '/surveillance', alarm: activeAlerts.length > 0 },
  ];

  return (
    <>
      <TopBar title={t('superintendent.topBarTitle')} />
      <main className="page-container page-enter">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: -0.3 }}>
              {facilityName}
            </h1>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
              {t('superintendent.roleLine', { name: currentUser?.name || '' })}
            </p>
          </div>
          <button onClick={() => router.push('/my-facility')} className="btn btn-secondary">
            <Building2 className="w-4 h-4" /> {t('breadcrumb.myFacility')}
          </button>
        </div>

        {/* ═══ KPI ROW ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {kpis.map(k => (
            <button
              key={k.id}
              type="button"
              onClick={() => router.push(k.href)}
              className="dash-card text-left transition-colors"
              style={{ padding: '14px 16px', position: 'relative', cursor: 'pointer' }}
            >
              {k.alarm && <span className="data-tile__alarm-pulse" aria-hidden="true" />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
                </div>
                <span className="kpi-card-title">{k.label}</span>
              </div>
              <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{k.sub}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          {/* ═══ ADMIN QUICK ACTIONS ═══ */}
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('superintendent.administration')}</h3>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a.href}
                  onClick={() => router.push(a.href)}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-[var(--accent-light)]"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', textAlign: 'left' }}
                >
                  <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                    <a.Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t(a.labelKey)}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t(a.descKey)}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          </div>

          {/* ═══ SURVEILLANCE / ALERTS ═══ */}
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('superintendent.surveillanceSignal')}</h3>
              <button onClick={() => router.push('/surveillance')} className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                {t('hr.viewAll')} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {activeAlerts.length === 0 ? (
              <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
                <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: '#15795C', opacity: 0.6 }} />
                {t('epidemic.noActiveDiseaseAlerts')}
              </div>
            ) : (
              <div>
                {activeAlerts.slice(0, 6).map((a, i) => (
                  <button
                    key={a._id || i}
                    onClick={() => router.push('/surveillance')}
                    className="data-row data-row--warning w-full"
                    style={{ textAlign: 'left' }}
                  >
                    <div className="icon-box-sm flex-shrink-0" style={{ background: a.alertLevel === 'emergency' ? 'rgba(196, 69, 54, 0.14)' : 'rgba(228, 168, 75, 0.16)' }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: a.alertLevel === 'emergency' ? '#C44536' : '#B8741C' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.disease || t('superintendent.alertFallback')}</div>
                      <div className="text-[11.5px] mt-0.5 capitalize" style={{ color: a.alertLevel === 'emergency' ? '#C44536' : '#B8741C' }}>
                        {a.alertLevel} · {[a.county, a.state].filter(Boolean).join(', ') || t('superintendent.locationFallback')} · {t('dashboard.casesCount', { count: a.cases })}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ STAFF MIX + REFERRALS strip ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {[
            { Icon: Stethoscope, label: t('dashboard.doctors'), value: totalDoctors, href: '/hr' },
            { Icon: HeartPulse, label: t('dataEntry.nurses'), value: totalNurses, href: '/hr' },
            { Icon: SendHorizontal, label: t('dashboard.pendingReferrals'), value: pendingReferrals.length, href: '/referrals' },
          ].map(s => (
            <button key={s.label} onClick={() => router.push(s.href)} className="dash-card flex items-center gap-3" style={{ padding: '14px 16px', textAlign: 'left' }}>
              <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                <s.Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
              <span className="stat-value" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</span>
            </button>
          ))}
        </div>
      </main>
    </>
  );
}
