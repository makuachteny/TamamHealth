'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardGreetingHeader from '@/components/dashboard/DashboardGreetingHeader';
import { useApp } from '@/lib/context';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import {
  Activity, ArrowRight, BarChart3, Building2, CreditCard,
  Calendar, Database, FileText, Microscope, Pill, Send, Server, Shield, Users,
} from '@/components/icons/lucide';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { AuditLogDoc, EncounterDoc } from '@/lib/db-types';

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildDailyCounts(isoDates: string[], days: number): Array<{ day: string; count: number }> {
  const counts = new Map<string, number>();
  for (const iso of isoDates) {
    if (!iso) continue;
    counts.set(localDayKey(iso), (counts.get(localDayKey(iso)) || 0) + 1);
  }
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const offset = days - 1 - index;
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: key, count: counts.get(key) || 0 };
  });
}

function chartLabel(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString([], { weekday: 'short' });
}

function MetricTile({ label, value, note, tone = 'neutral' }: {
  label: string;
  value: string | number;
  note: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className="admin-command-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function ActivitySignal({ label, value, icon: Icon, tone = 'neutral' }: {
  label: string;
  value: string | number;
  icon: typeof Activity;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className="admin-activity-signal" data-tone={tone}>
      <span><Icon className="w-3.5 h-3.5" />{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { organizations, loading: orgsLoading } = useOrganizations();
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [countsLoading, setCountsLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [encounters, setEncounters] = useState<EncounterDoc[]>([]);
  const [encountersLoading, setEncountersLoading] = useState(true);
  const [activityDates, setActivityDates] = useState({
    users: [] as string[],
    patients: [] as string[],
    appointments: [] as string[],
    prescriptions: [] as string[],
    labs: [] as string[],
    referrals: [] as string[],
  });
  const [dbStats, setDbStats] = useState<Array<{ name: string; docCount: number }>>([]);
  const [dbStatsLoading, setDbStatsLoading] = useState(true);
  const [syncStats, setSyncStats] = useState({ total: 0, pending: 0, synced: 0, failed: 0 });

  useEffect(() => {
    if (currentUser && currentUser.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const { getAllUsers } = await import('@/lib/services/user-service');
        const { getAllPatients } = await import('@/lib/services/patient-service');
        const [users, patients] = await Promise.all([getAllUsers(), getAllPatients()]);
        setTotalUsers(users.length);
        setTotalPatients(patients.length);
        setActivityDates(prev => ({
          ...prev,
          users: users.map(user => user.createdAt).filter(Boolean),
          patients: patients.map(patient => patient.createdAt).filter(Boolean),
        }));
      } catch (err) {
        console.error('Failed to load admin counts:', err);
      } finally {
        setCountsLoading(false);
      }
    };
    loadCounts();
  }, []);

  useEffect(() => {
    const loadPlatformActivity = async () => {
      try {
        const { getAllAppointments } = await import('@/lib/services/appointment-service');
        const { getAllPrescriptions } = await import('@/lib/services/prescription-service');
        const { getAllLabResults } = await import('@/lib/services/lab-service');
        const { getAllReferrals } = await import('@/lib/services/referral-service');
        const [appointments, prescriptions, labs, referrals] = await Promise.all([
          getAllAppointments(),
          getAllPrescriptions(),
          getAllLabResults(),
          getAllReferrals(),
        ]);
        setActivityDates(prev => ({
          ...prev,
          appointments: appointments.map(item => item.createdAt).filter(Boolean),
          prescriptions: prescriptions.map(item => item.createdAt).filter(Boolean),
          labs: labs.map(item => item.createdAt).filter(Boolean),
          referrals: referrals.map(item => item.createdAt).filter(Boolean),
        }));
      } catch (err) {
        console.error('Failed to load platform activity:', err);
      }
    };
    loadPlatformActivity();
  }, []);

  useEffect(() => {
    const loadAudit = async () => {
      try {
        const { getRecentAuditLogs } = await import('@/lib/services/audit-service');
        setAuditLogs(await getRecentAuditLogs(200));
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setAuditLoading(false);
      }
    };
    loadAudit();
  }, []);

  useEffect(() => {
    const loadEncounters = async () => {
      try {
        const { getAllEncounters } = await import('@/lib/services/encounter-service');
        setEncounters(await getAllEncounters());
      } catch (err) {
        console.error('Failed to load encounters:', err);
      } finally {
        setEncountersLoading(false);
      }
    };
    loadEncounters();
  }, []);

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const { getDB } = await import('@/lib/db');
        const dbNames = [
          { key: 'tamamhealth_users', label: 'Users' },
          { key: 'tamamhealth_patients', label: 'Patients' },
          { key: 'tamamhealth_hospitals', label: 'Facilities' },
          { key: 'tamamhealth_medical_records', label: 'Records' },
          { key: 'tamamhealth_referrals', label: 'Referrals' },
          { key: 'tamamhealth_lab_results', label: 'Labs' },
          { key: 'tamamhealth_prescriptions', label: 'Prescriptions' },
          { key: 'tamamhealth_audit_log', label: 'Audit' },
        ];
        const stats = await Promise.all(dbNames.map(async ({ key, label }) => {
          try {
            const info = await getDB(key).info();
            return { name: label, docCount: info.doc_count };
          } catch {
            return { name: label, docCount: 0 };
          }
        }));
        setDbStats(stats);
      } catch (err) {
        console.error('Failed to load database health:', err);
      } finally {
        setDbStatsLoading(false);
      }
    };
    loadHealth();
  }, []);

  useEffect(() => {
    const loadSync = async () => {
      try {
        const { getSyncEventStats } = await import('@/lib/services/sync-event-service');
        const stats = await getSyncEventStats();
        setSyncStats({ total: stats.total, pending: stats.pending, synced: stats.synced, failed: stats.failed });
      } catch {
        setSyncStats({ total: 0, pending: 0, synced: 0, failed: 0 });
      }
    };
    loadSync();
  }, []);

  const orgSignupSeries = useMemo(() => {
    if (organizations.length === 0) return [];
    const counts = new Map<string, number>();
    for (const org of organizations) {
      counts.set(localDayKey(org.createdAt), (counts.get(localDayKey(org.createdAt)) || 0) + 1);
    }
    const days = Array.from(counts.keys()).sort();
    let cumulative = 0;
    return days.map(day => {
      cumulative += counts.get(day) || 0;
      return { day: chartLabel(day), organizations: cumulative };
    });
  }, [organizations]);

  const encountersPerDaySeries = useMemo(() => {
    const dates = encounters.map(e => e.createdAt || e.startedAt).filter(Boolean) as string[];
    return buildDailyCounts(dates, 7);
  }, [encounters]);

  const auditErrorSeries = useMemo(() => {
    const failed = auditLogs.filter(l => l.success === false).map(l => l.createdAt);
    return buildDailyCounts(failed, 7);
  }, [auditLogs]);

  const usersPerDaySeries = useMemo(() => buildDailyCounts(activityDates.users, 7), [activityDates.users]);
  const patientsPerDaySeries = useMemo(() => buildDailyCounts(activityDates.patients, 7), [activityDates.patients]);
  const appointmentsPerDaySeries = useMemo(() => buildDailyCounts(activityDates.appointments, 7), [activityDates.appointments]);
  const prescriptionsPerDaySeries = useMemo(() => buildDailyCounts(activityDates.prescriptions, 7), [activityDates.prescriptions]);
  const labsPerDaySeries = useMemo(() => buildDailyCounts(activityDates.labs, 7), [activityDates.labs]);
  const referralsPerDaySeries = useMemo(() => buildDailyCounts(activityDates.referrals, 7), [activityDates.referrals]);

  const activitySeries = useMemo(() => {
    return encountersPerDaySeries.map((point, index) => ({
      day: chartLabel(point.day),
      encounters: point.count,
      patients: patientsPerDaySeries[index]?.count || 0,
      users: usersPerDaySeries[index]?.count || 0,
      appointments: appointmentsPerDaySeries[index]?.count || 0,
      prescriptions: prescriptionsPerDaySeries[index]?.count || 0,
      labs: labsPerDaySeries[index]?.count || 0,
      referrals: referralsPerDaySeries[index]?.count || 0,
      auditErrors: auditErrorSeries[index]?.count || 0,
    }));
  }, [
    appointmentsPerDaySeries,
    auditErrorSeries,
    encountersPerDaySeries,
    labsPerDaySeries,
    patientsPerDaySeries,
    prescriptionsPerDaySeries,
    referralsPerDaySeries,
    usersPerDaySeries,
  ]);

  const auditErrorCount = auditErrorSeries.reduce((sum, item) => sum + item.count, 0);
  const encountersToday = encountersPerDaySeries[encountersPerDaySeries.length - 1]?.count || 0;
  const patientsThisWeek = patientsPerDaySeries.reduce((sum, item) => sum + item.count, 0);
  const usersThisWeek = usersPerDaySeries.reduce((sum, item) => sum + item.count, 0);
  const appointmentsThisWeek = appointmentsPerDaySeries.reduce((sum, item) => sum + item.count, 0);
  const prescriptionsThisWeek = prescriptionsPerDaySeries.reduce((sum, item) => sum + item.count, 0);
  const labsThisWeek = labsPerDaySeries.reduce((sum, item) => sum + item.count, 0);
  const referralsThisWeek = referralsPerDaySeries.reduce((sum, item) => sum + item.count, 0);
  const trackedEventsThisWeek = encountersPerDaySeries.reduce((sum, item) => sum + item.count, 0)
    + patientsThisWeek
    + usersThisWeek
    + appointmentsThisWeek
    + prescriptionsThisWeek
    + labsThisWeek
    + referralsThisWeek;
  const activeOrgs = organizations.filter(o => o.isActive).length;
  const suspendedOrgs = organizations.filter(o => o.subscriptionStatus === 'suspended' || !o.isActive).length;
  const activeSubscriptions = organizations.filter(o => o.subscriptionStatus === 'active').length;
  const trialOrgs = organizations.filter(o => o.subscriptionStatus === 'trial').length;
  const totalDocs = dbStats.reduce((sum, db) => sum + db.docCount, 0);
  const syncRate = syncStats.total > 0 ? Math.round((syncStats.synced / syncStats.total) * 100) : 100;
  const readinessScore = Math.max(
    0,
    Math.min(100, 100 - (suspendedOrgs * 8) - (auditErrorCount * 5) - (syncStats.failed * 6) - (syncStats.pending > 0 ? 4 : 0)),
  );
  const operatingTone: 'ok' | 'warn' | 'danger' = readinessScore < 70 || auditErrorCount > 2 || syncStats.failed > 0
    ? 'danger'
    : readinessScore < 88 || suspendedOrgs > 0 || syncStats.pending > 0
      ? 'warn'
      : 'ok';
  const operatingLabel = operatingTone === 'danger' ? 'Attention required' : operatingTone === 'warn' ? 'Watch list active' : 'Platform steady';
  const riskItems = [
    { label: 'Suspended tenants', value: suspendedOrgs, note: `${activeOrgs} active organizations`, tone: suspendedOrgs > 0 ? 'warn' : 'ok' as const },
    { label: 'Sync backlog', value: syncStats.pending, note: `${syncRate}% synced`, tone: syncStats.failed > 0 ? 'danger' : syncStats.pending > 0 ? 'warn' : 'ok' as const },
    { label: 'Audit failures', value: auditErrorCount, note: 'Last 7 days', tone: auditErrorCount > 0 ? 'danger' : 'ok' as const },
  ];
  const dataHotspots = dbStats.slice(0, 4);

  const planData = [
    { name: 'Enterprise', value: organizations.filter(o => o.subscriptionPlan === 'enterprise').length, color: 'var(--accent-primary)' },
    { name: 'Professional', value: organizations.filter(o => o.subscriptionPlan === 'professional').length, color: '#2191D0' },
    { name: 'Basic', value: organizations.filter(o => o.subscriptionPlan === 'basic').length, color: '#8395A8' },
  ].filter(item => item.value > 0);

  const navItems = [
    { label: 'Control Center', desc: 'Security, compliance, risk, support, data governance', href: '/admin/control', icon: Shield },
    { label: 'Tenants & users', desc: 'Organizations, facilities, users, privileged access', href: '/admin/organizations', icon: Building2 },
    { label: 'System & IT', desc: 'Sync, DHIS2, database, maintenance, operations', href: '/admin/system', icon: Server },
    { label: 'Billing & revenue', desc: 'Plans, subscriptions, payments, claims', href: '/admin/billing', icon: CreditCard },
    { label: 'Analytics', desc: 'Org metrics and platform trends', href: '/admin/analytics', icon: BarChart3 },
  ];

  if (!currentUser || currentUser.role !== 'super_admin') return null;

  return (
    <main className="page-container page-enter admin-onepage">
      <DashboardGreetingHeader />

      <section className="admin-command-shell">
        <div className="admin-command-top admin-command-top--ops">
          <MetricTile label={operatingLabel} value={readinessScore} note={`${trackedEventsThisWeek.toLocaleString()} tracked signals`} tone={operatingTone} />
          <MetricTile label="Tenants" value={orgsLoading ? '...' : organizations.length} note={`${activeOrgs} active · ${trialOrgs} trial`} tone={suspendedOrgs > 0 ? 'warn' : 'ok'} />
          <MetricTile label="Staff accounts" value={countsLoading ? '...' : totalUsers.toLocaleString()} note={`${usersThisWeek} new this week`} />
          <MetricTile label="Patient registry" value={countsLoading ? '...' : totalPatients.toLocaleString()} note={`${patientsThisWeek} new this week`} />
          <MetricTile label="Care today" value={encountersLoading ? '...' : encountersToday} note={`${appointmentsThisWeek} appointments this week`} tone="ok" />
          <MetricTile label="Sync health" value={`${syncRate}%`} note={`${syncStats.pending} pending · ${syncStats.failed} failed`} tone={syncStats.failed > 0 ? 'danger' : syncStats.pending > 0 ? 'warn' : 'ok'} />
        </div>

        <div className="admin-command-main">
          <div className="admin-command-card admin-command-card--wide admin-command-card--pulse">
            <div className="admin-command-card-head">
              <span><Activity className="w-4 h-4" /> Live operations pulse</span>
              <small>{trackedEventsThisWeek.toLocaleString()} events · readiness {readinessScore}/100</small>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activitySeries} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminEncounters" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2191D0" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#2191D0" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="adminErrors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E34948" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#E34948" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="patients" stroke="#199E70" fill="transparent" strokeWidth={2} name="New patients" />
                <Area type="monotone" dataKey="users" stroke="#64748B" fill="transparent" strokeWidth={2} name="New users" />
                <Area type="monotone" dataKey="appointments" stroke="#B55E13" fill="transparent" strokeWidth={2} name="Appointments" />
                <Area type="monotone" dataKey="encounters" stroke="#2191D0" fill="url(#adminEncounters)" strokeWidth={2} name="Encounters" />
                <Area type="monotone" dataKey="prescriptions" stroke="#7C3AED" fill="transparent" strokeWidth={2} name="Prescriptions" />
                <Area type="monotone" dataKey="labs" stroke="#0E7490" fill="transparent" strokeWidth={2} name="Lab results" />
                <Area type="monotone" dataKey="referrals" stroke="#475569" fill="transparent" strokeWidth={2} name="Referrals" />
                <Area type="monotone" dataKey="auditErrors" stroke="#E34948" fill="url(#adminErrors)" strokeWidth={2} name="Audit errors" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="admin-activity-signals">
              <ActivitySignal label="Users" value={usersThisWeek} icon={Users} />
              <ActivitySignal label="Patients" value={patientsThisWeek} icon={Users} tone="ok" />
              <ActivitySignal label="Appointments" value={appointmentsThisWeek} icon={Calendar} />
              <ActivitySignal label="Prescriptions" value={prescriptionsThisWeek} icon={Pill} />
              <ActivitySignal label="Labs" value={labsThisWeek} icon={Microscope} />
              <ActivitySignal label="Referrals" value={referralsThisWeek} icon={Send} />
              <ActivitySignal label="Audit failures" value={auditErrorCount} icon={FileText} tone={auditErrorCount > 0 ? 'danger' : 'ok'} />
            </div>
          </div>

          <div className="admin-command-card admin-command-card--risk">
            <div className="admin-command-card-head">
              <span><Shield className="w-4 h-4" /> Operator watch</span>
              <small>{operatingLabel}</small>
            </div>
            <div className="admin-risk-stack">
              {riskItems.map(item => (
                <div key={item.label} className="admin-risk-row" data-tone={item.tone}>
                  <span>{item.label}<small>{item.note}</small></span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-command-card admin-command-card--plans">
            <div className="admin-command-card-head">
              <span><CreditCard className="w-4 h-4" /> Plans</span>
              <small>{activeSubscriptions} active · {trialOrgs} trial</small>
            </div>
            <div className="admin-plan-viz">
              <ResponsiveContainer width="52%" height="100%">
                <PieChart>
                  <Pie data={planData} dataKey="value" innerRadius="58%" outerRadius="86%" paddingAngle={3}>
                    {planData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="admin-plan-legend">
                {planData.map(item => (
                  <span key={item.name}><i style={{ background: item.color }} />{item.name}<b>{item.value}</b></span>
                ))}
              </div>
            </div>
          </div>

          <div className="admin-command-card admin-command-card--stores">
            <div className="admin-command-card-head">
              <span><Database className="w-4 h-4" /> Data stores</span>
              <small>{dbStatsLoading ? 'Loading' : `${totalDocs.toLocaleString()} docs`}</small>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dbStats.slice(0, 6)} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="docCount" fill="#015697" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
            <div className="admin-store-strip">
              {dataHotspots.map(store => (
                <span key={store.name}>{store.name}<b>{store.docCount.toLocaleString()}</b></span>
              ))}
            </div>
          </div>

          <div className="admin-command-card admin-command-card--growth">
            <div className="admin-command-card-head">
              <span><Building2 className="w-4 h-4" /> Org growth</span>
              <small>Cumulative</small>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orgSignupSeries} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="organizations" stroke="#199E70" fill="#DDF3EA" strokeWidth={2} name="Organizations" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <nav className="admin-command-nav admin-command-nav--console" aria-label="Super Admin navigation">
            {navItems.map(item => (
              <button key={item.href} type="button" onClick={() => router.push(item.href)}>
                <item.icon className="w-4 h-4" />
                <span><strong>{item.label}</strong><small>{item.desc}</small></span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
