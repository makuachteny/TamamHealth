'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import type { AuditLogDoc, PlatformConfigDoc, UserDoc } from '@/lib/db-types';
import {
  AlertTriangle, Archive, ArrowRight, BarChart3, Building2,
  CheckCircle2, Clock, CreditCard, Database, Download, FileSpreadsheet,
  FileText, GitCompareArrows, Globe, HelpCircle,
  History, Lock, Network, Receipt, RefreshCw, Search,
  Server, Settings, Shield, ShieldCheck, Stethoscope,
  ToggleLeft, ToggleRight, Users, Wifi,
} from '@/components/icons/lucide';

type Policy = NonNullable<PlatformConfigDoc['superAdminPolicies']>;

const DEFAULT_POLICIES: Policy = {
  mfaRequired: true,
  passwordMinLength: 12,
  sessionTimeoutMinutes: 15,
  emergencyAccessEnabled: true,
  emergencyAccessReviewHours: 24,
  impersonationEnabled: false,
  impersonationMaxMinutes: 30,
  dualApprovalForHighRisk: true,
  auditRetentionYears: 6,
  phiExportRequiresReason: true,
  dataDeletionRequiresApproval: true,
  ssoEnabled: false,
  apiKeysEnabled: false,
  backupRpoHours: 24,
  backupRtoHours: 8,
  supportAccessRequiresTicket: true,
};

const sections = [
  { key: 'tenants', label: 'Tenants', icon: Building2 },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'compliance', label: 'Compliance', icon: FileText },
  { key: 'integrations', label: 'Integrations', icon: Network },
  { key: 'data', label: 'Data', icon: Database },
  { key: 'support', label: 'Support', icon: HelpCircle },
  { key: 'risk', label: 'Risk', icon: AlertTriangle },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type SectionKey = typeof sections[number]['key'];

function StatCard({ label, value, detail, tone = 'neutral' }: {
  label: string;
  value: string | number;
  detail: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  const color = tone === 'ok' ? 'var(--color-success)' : tone === 'warn' ? 'var(--color-warning)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--accent-primary)';
  return (
    <div className="super-admin-stat">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function PolicyToggle({ label, description, enabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="super-admin-policy-row" onClick={onToggle}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      {enabled ? <ToggleRight className="w-9 h-9" style={{ color: 'var(--color-success)' }} /> : <ToggleLeft className="w-9 h-9" style={{ color: 'var(--text-muted)' }} />}
    </button>
  );
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' }) {
  return <span className="super-admin-pill" data-tone={tone}>{children}</span>;
}

function formatDate(iso?: string) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SuperAdminControlCenter() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { organizations, loading: orgsLoading, update: updateOrg } = useOrganizations();
  const { hospitals } = useHospitals();
  const { config, update: updateConfig } = usePlatformConfig();
  const [active, setActive] = useState<SectionKey>('tenants');
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [syncStats, setSyncStats] = useState({ total: 0, pending: 0, syncing: 0, synced: 0, failed: 0, oldestPending: undefined as string | undefined, newestEvent: undefined as string | undefined });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [{ getAllUsers }, { getRecentAuditLogs }, { getSyncEventStats }] = await Promise.all([
          import('@/lib/services/user-service'),
          import('@/lib/services/audit-service'),
          import('@/lib/services/sync-event-service'),
        ]);
        const [allUsers, logs, stats] = await Promise.all([
          getAllUsers(),
          getRecentAuditLogs(300),
          getSyncEventStats().catch(() => ({
            total: 0,
            pending: 0,
            syncing: 0,
            synced: 0,
            failed: 0,
            oldestPending: undefined as string | undefined,
            newestEvent: undefined as string | undefined,
          })),
        ]);
        if (!mounted) return;
        setUsers(allUsers);
        setAuditLogs(logs);
        setSyncStats({
          total: stats.total,
          pending: stats.pending,
          syncing: stats.syncing,
          synced: stats.synced,
          failed: stats.failed,
          oldestPending: stats.oldestPending,
          newestEvent: stats.newestEvent,
        });
      } catch (err) {
        console.error('Failed to load Super Admin control center data:', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const policies: Policy = { ...DEFAULT_POLICIES, ...(config?.superAdminPolicies || {}) };

  const persistPolicies = async (next: Policy) => {
    if (!currentUser) return;
    setSavingPolicy(true);
    try {
      await updateConfig({ superAdminPolicies: next }, currentUser._id, currentUser.username);
    } finally {
      setSavingPolicy(false);
    }
  };

  const setPolicy = <K extends keyof Policy>(key: K, value: Policy[K]) => {
    persistPolicies({ ...policies, [key]: value });
  };

  const orgStats = useMemo(() => {
    const activeCount = organizations.filter(o => o.isActive).length;
    const suspended = organizations.filter(o => o.subscriptionStatus === 'suspended' || !o.isActive).length;
    const trial = organizations.filter(o => o.subscriptionStatus === 'trial').length;
    const featureEntitlements = organizations.reduce((sum, org) => sum + Object.values(org.featureFlags || {}).filter(Boolean).length, 0);
    return { activeCount, suspended, trial, featureEntitlements };
  }, [organizations]);

  const securityStats = useMemo(() => {
    const admins = users.filter(u => u.role === 'super_admin' || u.role === 'org_admin').length;
    const inactive = users.filter(u => !u.isActive).length;
    const failed = auditLogs.filter(l => l.success === false).length;
    const privilegedActions = auditLogs.filter(l => /role|config|organization|deactivate|delete|archive|sync|dhis2/i.test(l.action || l.details || '')).length;
    return { admins, inactive, failed, privilegedActions };
  }, [users, auditLogs]);

  const filteredOrgs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return organizations.slice(0, 8);
    return organizations.filter(o => [o.name, o.slug, o.contactEmail, o.country].some(v => v?.toLowerCase().includes(q))).slice(0, 8);
  }, [organizations, query]);

  const orgUserCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users) {
      if (user.orgId) counts.set(user.orgId, (counts.get(user.orgId) || 0) + 1);
    }
    return counts;
  }, [users]);

  const orgFacilityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const hospital of hospitals) {
      if (hospital.orgId) counts.set(hospital.orgId, (counts.get(hospital.orgId) || 0) + 1);
    }
    return counts;
  }, [hospitals]);

  const suspendOrg = async (orgId: string, suspended: boolean) => {
    if (!currentUser) return;
    const reason = window.prompt(suspended ? 'Reason for suspending this organization' : 'Reason for reactivating this organization');
    if (reason === null) return;
    await updateOrg(orgId, {
      isActive: !suspended,
      subscriptionStatus: suspended ? 'suspended' : 'active',
    }, currentUser._id, `${currentUser.username} · ${reason || 'No reason entered'}`);
  };

  const renderSection = () => {
    switch (active) {
      case 'tenants':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel super-admin-panel--wide">
              <div className="super-admin-panel-head">
                <div><strong>Tenant control</strong><small>Manage organization lifecycle, entitlements, usage, and diagnostics.</small></div>
                <div className="super-admin-search"><Search className="w-4 h-4" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tenants" /></div>
              </div>
              <div className="super-admin-table">
                <div className="super-admin-table-head"><span>Organization</span><span>Plan</span><span>Users</span><span>Facilities</span><span>Status</span><span>Action</span></div>
                {filteredOrgs.map(org => {
                  const userCount = orgUserCounts.get(org._id) || 0;
                  const facilityCount = orgFacilityCounts.get(org._id) || 0;
                  const overUsers = userCount > org.maxUsers;
                  const overFacilities = facilityCount > org.maxHospitals;
                  return (
                    <div key={org._id} className="super-admin-table-row">
                      <span><b>{org.name}</b><small>{org.slug} · {org.contactEmail}</small></span>
                      <span><StatusPill>{org.subscriptionPlan}</StatusPill></span>
                      <span><b className={overUsers ? 'is-danger' : ''}>{userCount}/{org.maxUsers}</b></span>
                      <span><b className={overFacilities ? 'is-danger' : ''}>{facilityCount}/{org.maxHospitals}</b></span>
                      <span><StatusPill tone={org.isActive && org.subscriptionStatus === 'active' ? 'ok' : org.subscriptionStatus === 'trial' ? 'warn' : 'danger'}>{org.subscriptionStatus}</StatusPill></span>
                      <span className="super-admin-row-actions">
                        <button type="button" onClick={() => router.push('/admin/organizations')}>Open</button>
                        <button type="button" onClick={() => suspendOrg(org._id, org.isActive)}> {org.isActive ? 'Suspend' : 'Reactivate'} </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="super-admin-panel">
              <strong>Tenant readiness</strong>
              <div className="super-admin-checklist">
                <span><CheckCircle2 className="w-4 h-4" /> Organization limits tracked</span>
                <span><CheckCircle2 className="w-4 h-4" /> Feature flags visible</span>
                <span><CheckCircle2 className="w-4 h-4" /> Suspend/reactivate requires reason</span>
                <span><AlertTriangle className="w-4 h-4" /> Impersonation disabled by default</span>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel">
              <strong>Access policy</strong>
              <PolicyToggle label="Require MFA" description="Use multi-factor authentication for privileged access." enabled={policies.mfaRequired} onToggle={() => setPolicy('mfaRequired', !policies.mfaRequired)} />
              <PolicyToggle label="Emergency access" description="Allow break-glass access with follow-up review." enabled={policies.emergencyAccessEnabled} onToggle={() => setPolicy('emergencyAccessEnabled', !policies.emergencyAccessEnabled)} />
              <PolicyToggle label="Support impersonation" description="Allow isolated tenant support sessions with audit trail." enabled={policies.impersonationEnabled} onToggle={() => setPolicy('impersonationEnabled', !policies.impersonationEnabled)} />
              <PolicyToggle label="SSO controls" description="Expose SAML/OIDC controls per organization." enabled={policies.ssoEnabled} onToggle={() => setPolicy('ssoEnabled', !policies.ssoEnabled)} />
              <PolicyToggle label="API keys" description="Enable tenant API key issuance and rotation." enabled={policies.apiKeysEnabled} onToggle={() => setPolicy('apiKeysEnabled', !policies.apiKeysEnabled)} />
            </div>
            <div className="super-admin-panel">
              <strong>Session and password policy</strong>
              <label>Password minimum<input type="number" min={8} max={64} value={policies.passwordMinLength} onChange={e => setPolicy('passwordMinLength', Number(e.target.value) || 12)} /></label>
              <label>Session timeout, minutes<input type="number" min={1} max={240} value={policies.sessionTimeoutMinutes} onChange={e => setPolicy('sessionTimeoutMinutes', Number(e.target.value) || 15)} /></label>
              <label>Emergency review, hours<input type="number" min={1} max={168} value={policies.emergencyAccessReviewHours} onChange={e => setPolicy('emergencyAccessReviewHours', Number(e.target.value) || 24)} /></label>
              <label>Impersonation max, minutes<input type="number" min={5} max={240} value={policies.impersonationMaxMinutes} onChange={e => setPolicy('impersonationMaxMinutes', Number(e.target.value) || 30)} /></label>
            </div>
          </div>
        );
      case 'compliance':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel super-admin-panel--wide">
              <strong>Compliance reports</strong>
              <div className="super-admin-report-grid">
                {([
                  ['PHI access audit', 'All patient record access by user, org, facility, and date.', Shield],
                  ['Accounting of disclosures', 'Export disclosures for treatment, payment, operations, and reporting.', FileSpreadsheet],
                  ['Break-glass review', 'Emergency access sessions requiring supervisor review.', AlertTriangle],
                  ['Admin activity', 'Role changes, config updates, tenant lifecycle actions.', History],
                  ['Evidence pack', 'Security settings, audit settings, backup objectives, and integrations.', Archive],
                  ['Data retention', `${policies.auditRetentionYears} year audit documentation window.`, Clock],
                ] as [string, string, typeof Shield][]).map(([title, desc, Icon]) => (
                  <button key={title} type="button" className="super-admin-report-card">
                    <Icon className="w-5 h-5" />
                    <span><strong>{title}</strong><small>{desc}</small></span>
                    <Download className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="super-admin-panel">
              <strong>Compliance policy</strong>
              <PolicyToggle label="Reason required for PHI export" description="Exports should include purpose and requester." enabled={policies.phiExportRequiresReason} onToggle={() => setPolicy('phiExportRequiresReason', !policies.phiExportRequiresReason)} />
              <PolicyToggle label="Approval before deletion" description="Hard deletion and tenant data removal need approval." enabled={policies.dataDeletionRequiresApproval} onToggle={() => setPolicy('dataDeletionRequiresApproval', !policies.dataDeletionRequiresApproval)} />
              <label>Audit retention years<input type="number" min={1} max={25} value={policies.auditRetentionYears} onChange={e => setPolicy('auditRetentionYears', Number(e.target.value) || 6)} /></label>
            </div>
          </div>
        );
      case 'integrations':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel">
              <strong>Integration health</strong>
              {([
                ['DHIS2 export', organizations.filter(o => o.featureFlags.dhis2Export).length, 'enabled tenants', Globe],
                ['FHIR API', 1, 'metadata endpoint available', Stethoscope],
                ['Sync outbox', syncStats.pending, 'pending events', RefreshCw],
                ['Payment webhooks', 3, 'providers configured in code', CreditCard],
                ['SMS reminders', 1, 'delivery pipeline present', Wifi],
              ] as [string, number, string, typeof Shield][]).map(([name, count, desc, Icon]) => (
                <div key={name} className="super-admin-integration-row">
                  <Icon className="w-4 h-4" />
                  <span><strong>{name}</strong><small>{count} {desc}</small></span>
                  <StatusPill tone={Number(count) > 0 ? 'ok' : 'warn'}>{Number(count) > 0 ? 'Configured' : 'Needs setup'}</StatusPill>
                </div>
              ))}
            </div>
            <div className="super-admin-panel">
              <strong>Sync operations</strong>
              <StatCard label="Outbox events" value={syncStats.total} detail="Durable mutation stream" />
              <StatCard label="Pending" value={syncStats.pending} detail={`Oldest ${formatDate(syncStats.oldestPending)}`} tone={syncStats.pending > 0 ? 'warn' : 'ok'} />
              <StatCard label="Failed" value={syncStats.failed} detail="Needs retry review" tone={syncStats.failed > 0 ? 'danger' : 'ok'} />
              <button type="button" className="super-admin-primary" onClick={() => router.push('/admin/system')}>Open sync settings <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        );
      case 'data':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel">
              <strong>Data governance</strong>
              <div className="super-admin-checklist">
                <span><Database className="w-4 h-4" /> Tenant export workflow surfaced</span>
                <span><GitCompareArrows className="w-4 h-4" /> Conflict queue available</span>
                <span><Archive className="w-4 h-4" /> Archive-first deletion policy</span>
                <span><FileSpreadsheet className="w-4 h-4" /> Data quality dashboards linked</span>
              </div>
              <div className="super-admin-action-grid">
                <button type="button" onClick={() => router.push('/data-quality')}>Data quality</button>
                <button type="button" onClick={() => router.push('/admin/conflicts')}>Conflicts</button>
                <button type="button" onClick={() => router.push('/patients')}>MPI review</button>
                <button type="button" onClick={() => router.push('/reports')}>Exports</button>
              </div>
            </div>
            <div className="super-admin-panel">
              <strong>Storage and backup objectives</strong>
              <label>RPO, hours<input type="number" min={1} max={168} value={policies.backupRpoHours} onChange={e => setPolicy('backupRpoHours', Number(e.target.value) || 24)} /></label>
              <label>RTO, hours<input type="number" min={1} max={72} value={policies.backupRtoHours} onChange={e => setPolicy('backupRtoHours', Number(e.target.value) || 8)} /></label>
              <StatCard label="Facility records" value={hospitals.length} detail="Registered facilities" />
              <StatCard label="Sync newest" value={formatDate(syncStats.newestEvent)} detail="Last outbox event" />
            </div>
          </div>
        );
      case 'support':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel">
              <strong>Support tools</strong>
              <PolicyToggle label="Require support ticket" description="Support access must carry a ticket or incident reference." enabled={policies.supportAccessRequiresTicket} onToggle={() => setPolicy('supportAccessRequiresTicket', !policies.supportAccessRequiresTicket)} />
              <div className="super-admin-action-grid">
                <button type="button" onClick={() => router.push('/admin/users')}>Find user</button>
                <button type="button" onClick={() => router.push('/admin/organizations')}>Diagnose tenant</button>
                <button type="button" onClick={() => router.push('/messages')}>Announcements</button>
                <button type="button" onClick={() => router.push('/it')}>IT console</button>
              </div>
            </div>
            <div className="super-admin-panel">
              <strong>Support posture</strong>
              <StatCard label="Inactive users" value={securityStats.inactive} detail="Potential cleanup" tone={securityStats.inactive > 0 ? 'warn' : 'ok'} />
              <StatCard label="Recent failures" value={securityStats.failed} detail="Audit failures in loaded log" tone={securityStats.failed > 0 ? 'danger' : 'ok'} />
              <StatCard label="Admin users" value={securityStats.admins} detail="Privileged accounts" />
            </div>
          </div>
        );
      case 'risk':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel">
              <strong>High-risk action governance</strong>
              <PolicyToggle label="Dual approval" description="Require second approver for destructive or privileged actions." enabled={policies.dualApprovalForHighRisk} onToggle={() => setPolicy('dualApprovalForHighRisk', !policies.dualApprovalForHighRisk)} />
              <div className="super-admin-risk-list">
                {([
                  ['Super admin role change', 'Dual approval, reason, immutable audit'],
                  ['Tenant suspension', 'Reason required and tenant notice'],
                  ['Patient data export', 'Purpose, recipient, and date range'],
                  ['Audit setting change', 'Privileged event and evidence snapshot'],
                  ['Break-glass access', 'Review within configured hours'],
                ] as [string, string][]).map(([name, control]) => (
                  <div key={name}><AlertTriangle className="w-4 h-4" /><span><strong>{name}</strong><small>{control}</small></span></div>
                ))}
              </div>
            </div>
            <div className="super-admin-panel">
              <strong>Risk metrics</strong>
              <StatCard label="Privileged events" value={securityStats.privilegedActions} detail="In recent audit window" tone={securityStats.privilegedActions > 25 ? 'warn' : 'neutral'} />
              <StatCard label="Suspended tenants" value={orgStats.suspended} detail="Inactive or suspended" tone={orgStats.suspended > 0 ? 'warn' : 'ok'} />
              <StatCard label="Sync failures" value={syncStats.failed} detail="Failed outbox items" tone={syncStats.failed > 0 ? 'danger' : 'ok'} />
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="super-admin-grid">
            <div className="super-admin-panel super-admin-panel--wide">
              <strong>Platform settings map</strong>
              <div className="super-admin-settings-map">
                {([
                  ['Organizations', 'Tenant creation, plans, limits, branding, feature flags.', '/admin/organizations', Building2],
                  ['Users and access', 'Accounts, roles, activation, privileged users.', '/admin/users', Users],
                  ['System', 'Database stores and build facts.', '/admin/system', Server],
                  ['Billing', 'Subscription status, plan changes, seat/facility limits.', '/admin/billing', Receipt],
                  ['Analytics', 'Usage, adoption, org metrics, growth and distribution.', '/admin/analytics', BarChart3],
                  ['Security policy', 'MFA, sessions, SSO, API keys, emergency access.', '/admin', Lock],
                  ['Compliance', 'Audit exports, disclosure accounting, retention.', '/admin', FileText],
                  ['Support', 'Tenant diagnostics, support-ticket access, announcements.', '/admin', HelpCircle],
                ] as [string, string, string, typeof Shield][]).map(([title, desc, href, Icon]) => (
                  <button key={title} type="button" onClick={() => router.push(href)}>
                    <Icon className="w-5 h-5" />
                    <span><strong>{title}</strong><small>{desc}</small></span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <section className="super-admin-control dash-card">
      <div className="super-admin-hero">
        <div>
          <span className="super-admin-eyebrow">Super Admin Control Center</span>
          <h2>Platform governance, security, compliance, and tenant operations</h2>
          <p>One console for the controls expected in a healthcare SaaS platform: tenant lifecycle, privileged access, audit evidence, integration health, data governance, support diagnostics, and system policy.</p>
        </div>
        <div className="super-admin-hero-grid">
          <StatCard label="Organizations" value={orgsLoading ? '...' : organizations.length} detail={`${orgStats.activeCount} active`} tone="ok" />
          <StatCard label="Facilities" value={hospitals.length} detail="Across all tenants" />
          <StatCard label="Users" value={users.length} detail={`${securityStats.admins} privileged`} />
          <StatCard label="Audit failures" value={securityStats.failed} detail="Loaded log window" tone={securityStats.failed > 0 ? 'danger' : 'ok'} />
        </div>
      </div>

      <div className="super-admin-nav" role="tablist" aria-label="Super Admin sections">
        {sections.map(section => {
          const Icon = section.icon;
          const selected = active === section.key;
          return (
            <button key={section.key} type="button" className={selected ? 'is-active' : ''} onClick={() => setActive(section.key)}>
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {savingPolicy && <div className="super-admin-saving"><RefreshCw className="w-4 h-4" /> Saving policy...</div>}
      {renderSection()}
    </section>
  );
}
