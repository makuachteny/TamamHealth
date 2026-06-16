'use client';

/**
 * Facility Management Overview — a facility-scoped mirror of the Ministry of
 * Health national dashboard. Facility-management roles see the same kind of
 * KPIs, trends and performance gauges the Ministry sees, but only for their own
 * facility (every data hook is auto-scoped by `useDataScope`).
 *
 * This is the review tier of the reporting pipeline: clinical staff enter data
 * → it collects here at the facility level → facility management reviews it and
 * submits to the Ministry of Health. Only submitted facilities are counted in
 * the national dashboard (see the government dashboard's reporting gate).
 */
import { useState, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { useBirths } from '@/lib/hooks/useBirths';
import { useDeaths } from '@/lib/hooks/useDeaths';
import { useANC } from '@/lib/hooks/useANC';
import { useImmunizations } from '@/lib/hooks/useImmunizations';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useSurveillance } from '@/lib/hooks/useSurveillance';
import {
  Building2, Users, BedDouble, Activity, Baby, Skull, Syringe, HeartPulse,
  ArrowRightLeft, AlertTriangle, Send, CheckCircle, Clock, Loader2, TrendingUp,
} from '@/components/icons/lucide';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function FacilityOverviewPage() {
  return (
    <RoleGuard>
      <FacilityOverview />
    </RoleGuard>
  );
}

function FacilityOverview() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { hospitals, loading: hospitalsLoading, update } = useHospitals();
  const { births } = useBirths();
  const { deaths } = useDeaths();
  const { visits: ancVisits } = useANC();
  const { immunizations } = useImmunizations();
  const { referrals } = useReferrals();
  const { alerts } = useSurveillance();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const hospitalId = currentUser?.hospitalId;
  const hospital = hospitals.find(h => h._id === hospitalId);

  const handleSubmit = useCallback(async () => {
    if (!hospitalId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await update(hospitalId, {
        mohSubmission: {
          submittedAt: new Date().toISOString(),
          submittedBy: currentUser?._id || '',
          submittedByName: currentUser?.name,
        },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit to the Ministry of Health.');
    } finally {
      setSubmitting(false);
    }
  }, [hospitalId, update, currentUser]);

  // Not assigned to a facility — the dashboard has nothing to scope to.
  if (!hospitalId) {
    return (
      <>
        <TopBar title="Facility Overview" />
        <main className="page-container page-enter">
          <div className="card-elevated p-8 text-center max-w-md mx-auto mt-16">
            <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('myFacility.notAssignedTitle')}</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('myFacility.notAssignedDesc')}</p>
          </div>
        </main>
      </>
    );
  }

  if (hospitalsLoading && !hospital) {
    return (
      <>
        <TopBar title="Facility Overview" />
        <main className="page-container page-enter flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </main>
      </>
    );
  }

  // ── Facility-scoped aggregates ───────────────────────────────────────────
  const staff = (hospital?.doctors || 0) + (hospital?.nurses || 0) + (hospital?.clinicalOfficers || 0);
  const perf = hospital?.performance;
  const dataQuality = perf?.qualityScore ?? perf?.reportingCompleteness ?? 0;

  const referralsOut = referrals.filter(r => r.fromHospitalId === hospitalId).length;
  const referralsIn = referrals.filter(r => r.toHospitalId === hospitalId).length;
  const activeAlerts = alerts.filter(a => a.alertLevel === 'emergency' || a.alertLevel === 'warning').length;

  const MONTH_ABBR: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
  };
  const trend = (hospital?.monthlyTrends || []).map(r => ({
    month: MONTH_ABBR[r.month?.slice(5)] || r.month,
    'OPD Visits': r.opdVisits || 0,
    'ANC Visits': r.ancVisits || 0,
    'Immunizations': r.immunizations || 0,
  }));

  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    functional: { bg: 'rgba(74,222,128,0.12)', color: 'var(--color-success)', label: t('myFacility.statusFunctional') },
    partially_functional: { bg: 'rgba(252,211,77,0.12)', color: 'var(--color-warning)', label: t('myFacility.statusPartiallyFunctional') },
    non_functional: { bg: 'rgba(229,46,66,0.12)', color: 'var(--color-danger)', label: t('myFacility.statusNonFunctional') },
    closed: { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)', label: t('myFacility.statusClosed') },
  };
  const opStatus = hospital?.operationalStatus || 'functional';

  // ── Ministry of Health submission state ──────────────────────────────────
  const submission = hospital?.mohSubmission;
  const submittedAt = submission?.submittedAt;
  const hasPendingChanges = !!submittedAt && !!hospital?.updatedAt && hospital.updatedAt > submittedAt;

  return (
    <>
      <TopBar title="Facility Overview" />
      <main className="page-container page-enter">
        <PageHeader
          icon={Building2}
          title={hospital?.name || 'Facility Overview'}
          subtitle={`${hospital?.state || ''} · Facility management — your facility's data, as reported to the Ministry of Health`}
        />

        {/* ═══ MINISTRY OF HEALTH SUBMISSION GATE ═══ */}
        <div className="card-elevated p-5 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
                  <Send className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ministry of Health Reporting</h3>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                Review your facility&apos;s data below, then submit it to the Ministry of Health. Data is reported
                only when you submit it here — it is not sent automatically.
              </p>
              {!submittedAt ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} /> Not yet submitted
                </span>
              ) : hasPendingChanges ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(252,211,77,0.12)', color: 'var(--color-warning)' }}>
                  <Clock className="w-3 h-3" /> Changes pending submission
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--color-success)' }}>
                  <CheckCircle className="w-3 h-3" /> Submitted to Ministry of Health
                </span>
              )}
              {submittedAt && (
                <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Last submitted {new Date(submittedAt).toLocaleString()}
                  {submission?.submittedByName ? ` by ${submission.submittedByName}` : ''}.
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || (!!submittedAt && !hasPendingChanges)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: submitting ? 'var(--text-muted)' : 'linear-gradient(135deg, #3b82f6, #1E40AF)',
                  boxShadow: '0 2px 8px rgba(0,119,215,0.3)',
                }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submittedAt && !hasPendingChanges ? 'Submitted' : 'Submit to Ministry of Health'}
              </button>
              {submitError && (
                <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> {submitError}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ═══ KPI STRIP ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <StatCard icon={Users} label="Patients" value={String(hospital?.patientCount ?? 0)} tint="var(--accent-primary)" />
          <StatCard icon={BedDouble} label="Beds" value={String(hospital?.totalBeds ?? 0)} tint="var(--color-warning)" />
          <StatCard icon={Users} label="Clinical Staff" value={String(staff)} tint="var(--accent-primary)" />
          <StatCard icon={Activity} label="Today's Visits" value={String(hospital?.todayVisits ?? 0)} tint="var(--accent-primary)" />
          <StatCard icon={ArrowRightLeft} label="Referrals (in / out)" value={`${referralsIn} / ${referralsOut}`} tint="var(--accent-primary)" />
          <StatCard icon={AlertTriangle} label="Active Alerts" value={String(activeAlerts)} tint={activeAlerts > 0 ? 'var(--color-danger)' : 'var(--color-success)'} />
          <StatCard icon={CheckCircle} label="Data Quality" value={`${Math.round(dataQuality)}%`} tint={dataQuality >= 80 ? 'var(--color-success)' : dataQuality >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'} />
        </div>

        {/* ═══ OPERATIONAL STATUS + PERFORMANCE GAUGES ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="card-elevated p-5">
            <SectionTitle icon={<Activity className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />} title="Operational Status" />
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: statusColors[opStatus]?.bg, color: statusColors[opStatus]?.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors[opStatus]?.color }} />
                {statusColors[opStatus]?.label}
              </span>
            </div>
          </div>
          <div className="card-elevated p-5 lg:col-span-2">
            <SectionTitle icon={<TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />} title="Facility Performance" />
            <div className="grid grid-cols-3 gap-4 mt-3">
              <Gauge label="Reporting" value={perf?.reportingCompleteness ?? 0} />
              <Gauge label="Service Readiness" value={perf?.serviceReadinessScore ?? 0} />
              <Gauge label="Immunization Coverage" value={perf?.immunizationCoverage ?? 0} />
            </div>
          </div>
        </div>

        {/* ═══ HEALTH VISITS TREND ═══ */}
        <div className="card-elevated p-5 mt-4">
          <SectionTitle icon={<TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />} title="Health Visits Trend" />
          {trend.length > 0 ? (
            <div className="mt-3" style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gOpd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gAnc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} /><stop offset="95%" stopColor="#ec4899" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gImm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="OPD Visits" stroke="#3b82f6" fill="url(#gOpd)" strokeWidth={2} />
                  <Area type="monotone" dataKey="ANC Visits" stroke="#ec4899" fill="url(#gAnc)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Immunizations" stroke="#22c55e" fill="url(#gImm)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>No monthly trend data recorded for this facility yet.</p>
          )}
        </div>

        {/* ═══ VITAL EVENTS ═══ */}
        <div className="card-elevated p-5 mt-4 mb-2">
          <SectionTitle icon={<HeartPulse className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />} title="Vital Events & Care Programs" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
            <StatCard icon={Baby} label="Births Registered" value={String(births.length)} tint="var(--accent-primary)" />
            <StatCard icon={Skull} label="Deaths Registered" value={String(deaths.length)} tint="var(--text-muted)" />
            <StatCard icon={HeartPulse} label="ANC Visits" value={String(ancVisits.length)} tint="#ec4899" />
            <StatCard icon={Syringe} label="Immunizations" value={String(immunizations.length)} tint="var(--color-success)" />
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: string; tint: string }) {
  return (
    <div className="dash-card" style={{ padding: '14px 16px' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: tint }} />
        </div>
        <span className="kpi-card-title">{label}</span>
      </div>
      <div className="stat-value text-3xl" style={{ color: 'var(--text-primary)', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em' }}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
      <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}>{icon}</div>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
    </div>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
  return (
    <div className="flex flex-col items-center text-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border-light)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 40 40)"
        />
        <text x="40" y="45" textAnchor="middle" style={{ fontSize: 16, fontWeight: 700, fill: 'var(--text-primary)' }}>{pct}%</text>
      </svg>
      <span className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
