'use client';

/**
 * Super-admin Platform Dashboard — the command center. Answers "is the
 * platform healthy today?" in one screen: operational stat strip, risk
 * queue, tenant health matrix, activity trend, sync/interop rail, security
 * watchlist, business snapshot, and quick command navigation. Every number
 * comes from real local stores (PouchDB docs, audit log, sync events,
 * conflicts API) — nothing simulated.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import {
  SaPage, SaCard, SaStat, SaStatusDot, SaPill, SaTable,
  classifyAuditRisk, SEVERITY_TONE, formatWhen, type SaSeverity,
} from '@/components/admin/sa-ui';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { AuditLogDoc, EncounterDoc, UserDoc } from '@/lib/db-types';

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dailySeries(dates: string[], days: number): Array<{ day: string; count: number }> {
  const counts = new Map<string, number>();
  for (const iso of dates) {
    if (iso) counts.set(dayKey(iso), (counts.get(dayKey(iso)) || 0) + 1);
  }
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    const key = dayKey(d.toISOString());
    return { day: key, count: counts.get(key) || 0 };
  });
}

interface RiskRow {
  severity: SaSeverity;
  title: string;
  detail: string;
  when?: string;
  href: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { organizations } = useOrganizations();
  const { hospitals } = useHospitals();
  const { config } = usePlatformConfig();

  const [users, setUsers] = useState<UserDoc[]>([]);
  const [patientAgg, setPatientAgg] = useState({ total: 0, byOrg: new Map<string, number>() });
  const [encounters, setEncounters] = useState<EncounterDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [syncStats, setSyncStats] = useState({ total: 0, pending: 0, synced: 0, failed: 0, oldestPending: undefined as string | undefined });
  const [conflictCount, setConflictCount] = useState(0);
  const [dhis2, setDhis2] = useState<{ configured: boolean; host: string; lastPush?: string }>({ configured: false, host: 'Not configured' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ getAllUsers }, { getAllPatients }, { getAllEncounters }, { getRecentAuditLogs }, { getSyncEventStats }] =
          await Promise.all([
            import('@/lib/services/user-service'),
            import('@/lib/services/patient-service'),
            import('@/lib/services/encounter-service'),
            import('@/lib/services/audit-service'),
            import('@/lib/services/sync-event-service'),
          ]);
        const [allUsers, allPatients, allEncounters, logs, sync] = await Promise.all([
          getAllUsers(), getAllPatients(), getAllEncounters(), getRecentAuditLogs(500), getSyncEventStats(),
        ]);
        if (cancelled) return;
        setUsers(allUsers);
        const byOrg = new Map<string, number>();
        for (const p of allPatients) {
          if (p.orgId) byOrg.set(p.orgId, (byOrg.get(p.orgId) || 0) + 1);
        }
        setPatientAgg({ total: allPatients.length, byOrg });
        setEncounters(allEncounters);
        setAuditLogs(logs);
        setSyncStats({ total: sync.total, pending: sync.pending, synced: sync.synced, failed: sync.failed, oldestPending: sync.oldestPending });
      } catch (err) {
        console.error('Failed to load platform dashboard data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/admin/conflicts?status=pending');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setConflictCount(Array.isArray(data.conflicts) ? data.conflicts.length : Array.isArray(data) ? data.length : 0);
        }
      } catch { /* offline — conflicts stay 0 */ }
    })();

    (async () => {
      try {
        const mod = await import('@/lib/services/dhis2-sync-log-service');
        const configured = mod.isDhis2Configured();
        const host = configured ? (mod.getDhis2BaseUrlHost() || 'Configured') : 'Not configured';
        const log = await mod.getDhis2SyncLog();
        if (!cancelled) setDhis2({ configured, host, lastPush: log.lastSyncedAt || log.lastAttemptAt });
      } catch { /* DHIS2 module unavailable */ }
    })();

    return () => { cancelled = true; };
  }, []);

  /* ── Derived signals ─────────────────────────────────────────────── */

  const activeOrgs = organizations.filter(o => o.isActive && o.subscriptionStatus !== 'suspended' && o.subscriptionStatus !== 'cancelled');
  const suspendedOrgs = organizations.filter(o => o.subscriptionStatus === 'suspended' || o.subscriptionStatus === 'cancelled' || !o.isActive);
  const trialOrgs = organizations.filter(o => o.subscriptionStatus === 'trial');

  const weekAgo = Date.now() - 7 * 86400000;
  const failedAudits = useMemo(
    () => auditLogs.filter(l => l.success === false && new Date(l.createdAt).getTime() >= weekAgo),
    [auditLogs, weekAgo],
  );
  const highRiskAudits = useMemo(
    () => auditLogs.filter(l => {
      const sev = classifyAuditRisk(l.action, l.success);
      return (sev === 'critical' || sev === 'high' || sev === 'medium') && new Date(l.createdAt).getTime() >= weekAgo;
    }).slice(0, 6),
    [auditLogs, weekAgo],
  );

  const todayKey = dayKey(new Date().toISOString());
  const encountersToday = useMemo(
    () => encounters.filter(e => dayKey(e.createdAt || e.startedAt || '') === todayKey).length,
    [encounters, todayKey],
  );

  const syncRate = syncStats.total > 0 ? Math.round((syncStats.synced / syncStats.total) * 100) : 100;

  const backupIso = typeof window !== 'undefined' ? localStorage.getItem('safeguard_last_backup') : null;
  const rpoHours = config?.superAdminPolicies?.backupRpoHours ?? 24;
  const backupAgeHours = backupIso ? (Date.now() - new Date(backupIso).getTime()) / 3600000 : Infinity;
  const backupOverdue = backupAgeHours > rpoHours;

  const readiness = Math.max(0, Math.min(100,
    100
    - suspendedOrgs.length * 8
    - failedAudits.length * 5
    - syncStats.failed * 6
    - conflictCount * 4
    - (syncStats.pending > 0 ? 4 : 0)
    - (backupOverdue ? 6 : 0)
    - (config?.maintenanceMode ? 10 : 0),
  ));
  const readinessTone = readiness >= 88 ? 'ok' : readiness >= 70 ? 'warn' : 'danger';

  /* Zone 2 — risk & incident queue, worst first. */
  const riskQueue = useMemo(() => {
    const rows: RiskRow[] = [];
    for (const log of failedAudits.slice(0, 3)) {
      rows.push({
        severity: classifyAuditRisk(log.action, log.success),
        title: `Audit failure — ${log.action}`,
        detail: log.username ? `${log.username} · ${log.details}` : log.details,
        when: log.createdAt,
        href: '/admin/audit',
      });
    }
    if (syncStats.failed > 0) {
      rows.push({ severity: 'high', title: `${syncStats.failed} sync job${syncStats.failed === 1 ? '' : 's'} failed`, detail: 'Replication to country node', href: '/admin/sync' });
    }
    if (conflictCount > 0) {
      rows.push({ severity: 'medium', title: `${conflictCount} unresolved data conflict${conflictCount === 1 ? '' : 's'}`, detail: 'Reconciliation queue', href: '/admin/conflicts' });
    }
    for (const org of suspendedOrgs) {
      rows.push({ severity: 'medium', title: `Tenant ${org.subscriptionStatus === 'cancelled' ? 'cancelled' : 'suspended'} — ${org.name}`, detail: `${org.subscriptionPlan} plan`, href: '/admin/organizations' });
    }
    if (backupOverdue) {
      rows.push({
        severity: 'high',
        title: 'Backup overdue',
        detail: backupIso ? `Last backup ${formatWhen(backupIso)} · RPO ${rpoHours}h` : `No backup recorded · RPO ${rpoHours}h`,
        href: '/admin/system',
      });
    }
    if (config?.maintenanceMode) {
      rows.push({ severity: 'medium', title: 'Maintenance mode is ON', detail: 'Tenant access is restricted', href: '/admin/config' });
    }
    for (const org of trialOrgs) {
      rows.push({ severity: 'low', title: `Trial tenant — ${org.name}`, detail: `${org.maxUsers} seat limit`, href: '/admin/billing' });
    }
    const order: SaSeverity[] = ['critical', 'high', 'medium', 'low'];
    return rows.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)).slice(0, 8);
  }, [failedAudits, syncStats.failed, conflictCount, suspendedOrgs, trialOrgs, backupOverdue, backupIso, rpoHours, config?.maintenanceMode]);

  /* Zone 3 — tenant health matrix. */
  const tenantMatrix = useMemo(() => organizations.map(org => {
    const orgUsers = users.filter(u => u.orgId === org._id).length;
    const orgFacilities = hospitals.filter(h => h.orgId === org._id);
    const offline = orgFacilities.filter(h => h.syncStatus === 'offline').length;
    const lastActivity = auditLogs.find(l => l.orgId === org._id)?.createdAt;
    return {
      org,
      users: orgUsers,
      facilities: orgFacilities.length,
      offline,
      patients: patientAgg.byOrg.get(org._id) || 0,
      lastActivity,
    };
  }), [organizations, users, hospitals, auditLogs, patientAgg]);

  /* Zone 4 — 14-day activity trend (encounters vs audit failures). */
  const trend = useMemo(() => {
    const enc = dailySeries(encounters.map(e => e.createdAt || e.startedAt || '').filter(Boolean), 14);
    const fails = dailySeries(auditLogs.filter(l => !l.success).map(l => l.createdAt), 14);
    return enc.map((p, i) => ({
      day: new Date(`${p.day}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      encounters: p.count,
      failures: fails[i]?.count || 0,
    }));
  }, [encounters, auditLogs]);

  /* Zone 7 — business snapshot. */
  const licensedSeats = organizations.reduce((sum, o) => sum + (o.maxUsers || 0), 0);
  const planCounts = ['enterprise', 'professional', 'basic'].map(plan => ({
    plan,
    count: organizations.filter(o => o.subscriptionPlan === plan).length,
  })).filter(p => p.count > 0);

  const statusTone = (s: string): 'ok' | 'warn' | 'danger' | 'muted' =>
    s === 'active' ? 'ok' : s === 'trial' ? 'warn' : s === 'suspended' || s === 'cancelled' ? 'danger' : 'muted';

  return (
    <SaPage
      title="Platform Dashboard"
      subtitle="Tenant governance, security, and system health across every organization"
      actions={(
        <>
          <button type="button" className="sa-btn" onClick={() => router.push('/admin/audit')}>Audit logs</button>
          <button type="button" className="sa-btn primary" onClick={() => router.push('/admin/risk')}>Open Risk Center</button>
        </>
      )}
    >
      {/* Zone 1 — operational health summary */}
      <div className="sa-stat-strip">
        <SaStat label="Readiness" value={loading ? '…' : readiness} tone={readinessTone} note={readinessTone === 'ok' ? 'Platform steady' : readinessTone === 'warn' ? 'Watch list active' : 'Attention required'} />
        <SaStat label="Organizations" value={organizations.length} note={`${activeOrgs.length} active · ${trialOrgs.length} trial`} tone={suspendedOrgs.length ? 'warn' : undefined} />
        <SaStat label="Facilities" value={hospitals.length} note={`${hospitals.filter(h => h.syncStatus === 'online').length} online`} />
        <SaStat label="Users" value={users.length.toLocaleString()} note={`${users.filter(u => u.isActive).length} active`} />
        <SaStat label="Patients" value={patientAgg.total.toLocaleString()} note="All tenants" />
        <SaStat label="Encounters today" value={loading ? '…' : encountersToday} tone="ok" note="Across all facilities" />
        <SaStat label="Sync health" value={`${syncRate}%`} tone={syncStats.failed > 0 ? 'danger' : syncStats.pending > 0 ? 'warn' : 'ok'} note={`${syncStats.pending} pending · ${syncStats.failed} failed`} />
        <SaStat label="Open risks" value={riskQueue.length} tone={riskQueue.some(r => r.severity === 'critical' || r.severity === 'high') ? 'danger' : riskQueue.length ? 'warn' : 'ok'} note={`${failedAudits.length} audit failures 7d`} />
      </div>

      <div className="sa-grid">
        {/* Left rail — risk queue + security watchlist */}
        <div className="sa-col">
          <SaCard
            title="Risk & incident queue"
            meta={`${riskQueue.length} open`}
            actions={<button type="button" className="sa-btn" onClick={() => router.push('/admin/risk')}>All</button>}
          >
            <div className="sa-risk-list" style={{ padding: 0 }}>
              {riskQueue.length === 0 && <div className="sa-empty">No open risk signals — platform steady.</div>}
              {riskQueue.map((row, i) => (
                <button key={`${row.title}-${i}`} type="button" className="sa-risk-row" onClick={() => router.push(row.href)}>
                  <SaPill tone={SEVERITY_TONE[row.severity]}>{row.severity}</SaPill>
                  <span className="sa-risk-text">
                    <strong>{row.title}</strong>
                    <span>{row.detail}</span>
                  </span>
                  {row.when && <time>{formatWhen(row.when)}</time>}
                </button>
              ))}
            </div>
          </SaCard>

          <SaCard
            title="Security watchlist"
            meta="High-risk actions · 7d"
            actions={<button type="button" className="sa-btn" onClick={() => router.push('/admin/audit')}>Audit</button>}
          >
            <div className="sa-risk-list" style={{ padding: 0 }}>
              {highRiskAudits.length === 0 && <div className="sa-empty">No high-risk actions recorded this week.</div>}
              {highRiskAudits.map(log => (
                <button key={log._id} type="button" className="sa-risk-row" onClick={() => router.push('/admin/audit')}>
                  <SaPill tone={log.success ? 'warn' : 'danger'}>{log.success ? 'action' : 'failed'}</SaPill>
                  <span className="sa-risk-text">
                    <strong>{log.action}</strong>
                    <span>{log.username || 'system'} · {log.details}</span>
                  </span>
                  <time>{formatWhen(log.createdAt)}</time>
                </button>
              ))}
            </div>
          </SaCard>
        </div>

        {/* Centre — tenant matrix + activity trend */}
        <div className="sa-col">
          <SaCard
            title="Tenant health matrix"
            meta={`${organizations.length} organizations`}
            actions={<button type="button" className="sa-btn" onClick={() => router.push('/admin/organizations')}>Manage</button>}
          >
            <SaTable columns={['Organization', 'Status', 'Plan', 'Users', 'Facilities', 'Patients', 'Last activity']} minWidth={640} empty="No organizations yet.">
              {tenantMatrix.map(row => (
                <tr key={row.org._id} onClick={() => router.push('/admin/organizations')} style={{ cursor: 'pointer' }}>
                  <td><strong>{row.org.name}</strong></td>
                  <td><SaPill tone={statusTone(row.org.subscriptionStatus)}>{row.org.subscriptionStatus}</SaPill></td>
                  <td style={{ textTransform: 'capitalize' }}>{row.org.subscriptionPlan}</td>
                  <td className="sa-num">{row.users} / {row.org.maxUsers}</td>
                  <td className="sa-num">
                    {row.facilities} / {row.org.maxHospitals}
                    {row.offline > 0 && <> <SaPill tone="warn">{row.offline} offline</SaPill></>}
                  </td>
                  <td className="sa-num">{row.patients.toLocaleString()}</td>
                  <td>{formatWhen(row.lastActivity)}</td>
                </tr>
              ))}
            </SaTable>
          </SaCard>

          <SaCard title="Platform activity" meta="Encounters vs audit failures · 14 days">
            <div style={{ height: 190, padding: '10px 8px 4px 0' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="encounters" name="Encounters" stroke="#2191D0" fill="rgba(33,145,208,0.14)" strokeWidth={2} />
                  <Area type="monotone" dataKey="failures" name="Audit failures" stroke="#C24135" fill="rgba(194,65,53,0.10)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SaCard>
        </div>

        {/* Right rail — sync/interop, business, quick nav */}
        <div className="sa-col">
          <SaCard
            title="Sync & interoperability"
            actions={<button type="button" className="sa-btn" onClick={() => router.push('/admin/sync')}>Open</button>}
          >
            <div className="sa-kv">
              <div className="sa-kv-row"><span>Replication</span><SaStatusDot tone={syncStats.failed > 0 ? 'danger' : syncStats.pending > 0 ? 'warn' : 'ok'} label={syncStats.failed > 0 ? 'Failing' : syncStats.pending > 0 ? 'Backlog' : 'Healthy'} /></div>
              <div className="sa-kv-row"><span>Pending events</span><b>{syncStats.pending}</b></div>
              <div className="sa-kv-row"><span>Failed events</span><b>{syncStats.failed}</b></div>
              <div className="sa-kv-row"><span>Oldest pending</span><b>{formatWhen(syncStats.oldestPending)}</b></div>
              <div className="sa-kv-row"><span>DHIS2 endpoint</span><SaStatusDot tone={dhis2.configured ? 'ok' : 'muted'} label={dhis2.host} /></div>
              <div className="sa-kv-row"><span>Last DHIS2 push</span><b>{formatWhen(dhis2.lastPush)}</b></div>
              <div className="sa-kv-row"><span>Data conflicts</span><b>{conflictCount}</b></div>
            </div>
          </SaCard>

          <SaCard
            title="Business snapshot"
            actions={<button type="button" className="sa-btn" onClick={() => router.push('/admin/billing')}>Billing</button>}
          >
            <div className="sa-kv">
              <div className="sa-kv-row"><span>Active subscriptions</span><b>{organizations.filter(o => o.subscriptionStatus === 'active').length}</b></div>
              <div className="sa-kv-row"><span>Trials</span><b>{trialOrgs.length}</b></div>
              <div className="sa-kv-row"><span>Suspended / cancelled</span><b>{suspendedOrgs.length}</b></div>
              <div className="sa-kv-row"><span>Seats in use</span><b>{users.length} / {licensedSeats}</b></div>
              {planCounts.map(p => (
                <div className="sa-kv-row" key={p.plan}>
                  <span style={{ textTransform: 'capitalize' }}>{p.plan} plan</span>
                  <b>{p.count}</b>
                </div>
              ))}
            </div>
          </SaCard>

          <SaCard title="Quick commands">
            <nav className="sa-nav-grid" style={{ paddingInline: 14 }} aria-label="Quick command navigation">
              <Link className="sa-nav-chip" href="/admin/risk"><strong>Risk Center</strong><span>Incidents & reviews</span></Link>
              <Link className="sa-nav-chip" href="/admin/audit"><strong>Audit Logs</strong><span>Evidence & export</span></Link>
              <Link className="sa-nav-chip" href="/admin/organizations"><strong>Organizations</strong><span>Tenant registry</span></Link>
              <Link className="sa-nav-chip" href="/admin/users"><strong>Users & Access</strong><span>Roles & accounts</span></Link>
              <Link className="sa-nav-chip" href="/admin/system"><strong>System Health</strong><span>Stores & backups</span></Link>
              <Link className="sa-nav-chip" href="/admin/security"><strong>Security</strong><span>Policies & posture</span></Link>
            </nav>
          </SaCard>
        </div>
      </div>
    </SaPage>
  );
}
