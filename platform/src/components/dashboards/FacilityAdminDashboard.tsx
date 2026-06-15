'use client';

// Facility Administration dashboard — for the non-clinical facility_administrator
// who runs a single facility's operations: staffing/HR, bed capacity, finance,
// assets, compliance (controlled substances), emergency readiness, blood bank,
// and reporting. NOT a clinician (no SOAP/prescribe/lab tools) and NOT the
// network/hospital view — this is scoped to one facility only.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  Users, BedDouble, Wallet, Package, ClipboardCheck, BarChart3,
  Activity, AlertTriangle, ChevronRight, ArrowRight, Building2,
  Heart, Database, ArrowRightLeft,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { useUsers } from '@/lib/hooks/useUsers';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import { useWards } from '@/lib/hooks/useWards';
import type { LeaveRequestDoc } from '@/lib/db-types-hr';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

const QUICK_ACTIONS: { href: string; label: string; desc: string; Icon: typeof Users }[] = [
  { href: '/hr', label: 'HR & Leave', desc: 'Staff roster, schedules, leave approvals', Icon: Users },
  { href: '/wards', label: 'Wards & Beds', desc: 'Admissions and bed occupancy', Icon: BedDouble },
  { href: '/payments', label: 'Bills & Payments', desc: 'Collections, refunds, write-offs', Icon: Wallet },
  { href: '/equipment', label: 'Assets', desc: 'Biomedical equipment & maintenance', Icon: Package },
  { href: '/facility-assessments', label: 'Facility Assessments', desc: 'Readiness scoring & gaps', Icon: ClipboardCheck },
  { href: '/emergency-preparedness', label: 'Emergency Prep', desc: 'Surge plans & incident command', Icon: Activity },
  { href: '/blood-bank', label: 'Blood Bank', desc: 'Units, availability & expiry', Icon: Heart },
  { href: '/controlled-substances', label: 'Controlled Substances', desc: 'Two-signature drug register', Icon: ClipboardCheck },
  { href: '/reports', label: 'Reports', desc: 'Facility & HMIS reporting', Icon: BarChart3 },
  { href: '/data-quality', label: 'Data Quality', desc: 'Completeness & validation', Icon: Database },
];

export default function FacilityAdminDashboard() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { users } = useUsers();
  const { referrals } = useReferrals();
  const { alerts: diseaseAlerts } = useSurveillance();
  const { totalBeds, occupiedBeds, occupancyRate } = useWards();
  const [leave, setLeave] = useState<LeaveRequestDoc[]>([]);

  const facilityId = currentUser?.hospitalId;
  const facilityName = currentUser?.hospitalName || currentUser?.hospital?.name || 'My Facility';
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getAllLeaveRequests } = await import('@/lib/services/leave-service');
        const l = await getAllLeaveRequests();
        if (!cancelled) setLeave(l);
      } catch { /* optional context */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const facilityUsers = useMemo(
    () => (facilityId ? users.filter(u => u.hospitalId === facilityId) : users),
    [users, facilityId],
  );

  const pendingLeave = leave.filter(l => l.status === 'pending');
  const onLeaveToday = leave.filter(l => l.status === 'approved' && l.startDate <= today && l.endDate >= today);

  // Bed occupancy: prefer the real ward feed; fall back to the hospital's
  // configured bed count in demo mode so the tile isn't empty.
  const hospitalBeds = currentUser?.hospital?.totalBeds || 0;
  const bedTotal = totalBeds || hospitalBeds;
  const bedsOccupied = totalBeds ? occupiedBeds : (hospitalBeds && IS_DEMO ? Math.round(hospitalBeds * 0.72) : 0);
  const occPct = totalBeds ? occupancyRate : (bedTotal ? Math.round((bedsOccupied / bedTotal) * 100) : 0);

  const activeAlerts = diseaseAlerts.filter(a => a.alertLevel === 'emergency' || a.alertLevel === 'warning');
  const pendingReferrals = referrals.filter(r => r.status === 'sent' || r.status === 'received');

  const kpis = [
    { id: 'staff', label: 'Active staff', value: facilityUsers.length, sub: 'Across all roles', Icon: Users, color: 'var(--accent-primary)', href: '/hr' },
    { id: 'beds', label: 'Bed occupancy', value: `${occPct}%`, sub: `${bedsOccupied} / ${bedTotal} beds`, Icon: BedDouble, color: '#15795C', href: '/wards' },
    { id: 'leave', label: 'Pending leave', value: pendingLeave.length, sub: `${onLeaveToday.length} on leave today`, Icon: ClipboardCheck, color: pendingLeave.length > 0 ? '#C44536' : 'var(--accent-primary)', href: '/hr', alarm: pendingLeave.length > 0 },
    { id: 'alerts', label: 'Active alerts', value: activeAlerts.length, sub: `${pendingReferrals.length} referrals pending`, Icon: AlertTriangle, color: activeAlerts.length > 0 ? '#C44536' : 'var(--accent-primary)', href: '/surveillance', alarm: activeAlerts.length > 0 },
  ];

  return (
    <>
      <TopBar title="Facility Administration" />
      <main className="page-container page-enter">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: -0.3 }}>{facilityName}</h1>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
              Facility administration · {currentUser?.name || ''}
            </p>
          </div>
          <button onClick={() => router.push('/my-facility')} className="btn btn-secondary">
            <Building2 className="w-4 h-4" /> My Facility
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
          {/* ═══ ADMINISTRATION QUICK ACTIONS ═══ */}
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Administration</h3>
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
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{a.label}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{a.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          </div>

          {/* ═══ SURVEILLANCE / ALERTS ═══ */}
          <div className="dash-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Surveillance signal</h3>
              <button onClick={() => router.push('/surveillance')} className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {activeAlerts.length === 0 ? (
              <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
                <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: '#15795C', opacity: 0.6 }} />
                No active disease alerts.
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
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.disease || 'Alert'}</div>
                      <div className="text-[11.5px] mt-0.5 capitalize" style={{ color: a.alertLevel === 'emergency' ? '#C44536' : '#B8741C' }}>
                        {a.alertLevel} · {[a.county, a.state].filter(Boolean).join(', ') || 'Unspecified'} · {a.cases} cases
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ STAFF + REFERRALS strip ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {[
            { Icon: Users, label: 'Staff on duty', value: facilityUsers.length, href: '/hr' },
            { Icon: ArrowRightLeft, label: 'Pending referrals', value: pendingReferrals.length, href: '/referrals' },
            { Icon: ClipboardCheck, label: 'Leave to review', value: pendingLeave.length, href: '/hr' },
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
