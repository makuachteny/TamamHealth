'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import {
  Building2, Users, HeartPulse, CreditCard, ChevronRight, ChevronLeft,
  TrendingUp, Shield, Activity, Settings, BarChart3,
  Search, Clock, Database, RefreshCw,
} from '@/components/icons/lucide';
import type { AuditLogDoc } from '@/lib/db-types';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { organizations, loading: orgsLoading } = useOrganizations();
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [countsLoading, setCountsLoading] = useState(true);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(0);
  const AUDIT_PAGE_SIZE = 20;

  // System health state
  const [dbStats, setDbStats] = useState<Array<{ name: string; docCount: number }>>([]);
  const [dbStatsLoading, setDbStatsLoading] = useState(true);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<Array<{ org: string; status: string }>>([]);

  // Access control: only super_admin
  useEffect(() => {
    if (currentUser && currentUser.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Load aggregate counts
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const { getAllUsers } = await import('@/lib/services/user-service');
        const { getAllPatients } = await import('@/lib/services/patient-service');
        const [users, patients] = await Promise.all([getAllUsers(), getAllPatients()]);
        setTotalUsers(users.length);
        setTotalPatients(patients.length);
      } catch (err) {
        console.error('Failed to load counts:', err);
      } finally {
        setCountsLoading(false);
      }
    };
    loadCounts();
  }, []);

  // Load audit logs
  useEffect(() => {
    const loadAudit = async () => {
      try {
        const { getRecentAuditLogs } = await import('@/lib/services/audit-service');
        const logs = await getRecentAuditLogs(200);
        setAuditLogs(logs);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setAuditLoading(false);
      }
    };
    loadAudit();
  }, []);

  // Load system health: DB stats, sync status, backup time
  useEffect(() => {
    const loadHealth = async () => {
      try {
        const { getDB } = await import('@/lib/db');
        const dbNames = [
          { key: 'tamamhealth_users', label: t('admin.dbUsers') },
          { key: 'tamamhealth_patients', label: t('admin.dbPatients') },
          { key: 'tamamhealth_hospitals', label: t('admin.dbHospitals') },
          { key: 'tamamhealth_medical_records', label: t('admin.dbMedicalRecords') },
          { key: 'tamamhealth_referrals', label: t('admin.dbReferrals') },
          { key: 'tamamhealth_lab_results', label: t('admin.dbLabResults') },
          { key: 'tamamhealth_disease_alerts', label: t('admin.dbDiseaseAlerts') },
          { key: 'tamamhealth_prescriptions', label: t('admin.dbPrescriptions') },
          { key: 'tamamhealth_audit_log', label: t('admin.dbAuditLog') },
          { key: 'tamamhealth_organizations', label: t('admin.dbOrganizations') },
          { key: 'tamamhealth_immunizations', label: t('admin.dbImmunizations') },
          { key: 'tamamhealth_births', label: t('admin.dbBirths') },
          { key: 'tamamhealth_deaths', label: t('admin.dbDeaths') },
        ];
        const stats: Array<{ name: string; docCount: number }> = [];
        for (const { key, label } of dbNames) {
          try {
            const db = getDB(key);
            const info = await db.info();
            stats.push({ name: label, docCount: info.doc_count });
          } catch {
            stats.push({ name: label, docCount: 0 });
          }
        }
        setDbStats(stats);

        // Check last backup from localStorage
        const backup = typeof window !== 'undefined' ? localStorage.getItem('safeguard_last_backup') : null;
        setLastBackupTime(backup);
      } catch (err) {
        console.error('Failed to load health stats:', err);
      } finally {
        setDbStatsLoading(false);
      }
    };
    loadHealth();
  }, []);

  // Derive org sync statuses once orgs are loaded
  useEffect(() => {
    if (!orgsLoading && organizations.length > 0) {
      setSyncStatuses(organizations.map(o => ({
        org: o.name,
        status: o.isActive ? 'synced' : 'inactive',
      })));
    }
  }, [organizations, orgsLoading]);

  // Filtered & paginated audit logs
  const filteredAuditLogs = useMemo(() => {
    if (!auditSearch.trim()) return auditLogs;
    const q = auditSearch.toLowerCase();
    return auditLogs.filter(log =>
      (log.username?.toLowerCase().includes(q)) ||
      (log.action?.toLowerCase().includes(q)) ||
      (log.details?.toLowerCase().includes(q))
    );
  }, [auditLogs, auditSearch]);

  const totalAuditPages = Math.ceil(filteredAuditLogs.length / AUDIT_PAGE_SIZE);
  const paginatedLogs = filteredAuditLogs.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE);

  // System health indicators
  const totalDocs = dbStats.reduce((s, d) => s + d.docCount, 0);
  const dbHealth = totalDocs > 0 ? 'healthy' : 'empty';
  const backupAge = lastBackupTime ? Math.floor((Date.now() - new Date(lastBackupTime).getTime()) / 3600000) : null;
  const backupHealth = backupAge === null ? 'unknown' : backupAge < 24 ? 'healthy' : backupAge < 72 ? 'warning' : 'critical';

  if (!currentUser || currentUser.role !== 'super_admin') return null;

  const activeOrgs = organizations.filter(o => o.isActive);
  const activeSubscriptions = organizations.filter(o => o.subscriptionStatus === 'active').length;
  const trialOrgs = organizations.filter(o => o.subscriptionStatus === 'trial').length;
  const suspendedOrgs = organizations.filter(o => o.subscriptionStatus === 'suspended').length;

  const planCounts = {
    basic: organizations.filter(o => o.subscriptionPlan === 'basic').length,
    professional: organizations.filter(o => o.subscriptionPlan === 'professional').length,
    enterprise: organizations.filter(o => o.subscriptionPlan === 'enterprise').length,
  };

  const recentOrgs = [...organizations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const quickLinks = [
    { label: t('admin.linkOrganizations'), icon: Building2, href: '/admin/organizations', color: 'var(--accent-primary)' },
    { label: t('admin.linkAllUsers'), icon: Users, href: '/admin/users', color: 'var(--accent-primary)' },
    { label: t('admin.linkSystemConfig'), icon: Settings, href: '/admin/system', color: 'var(--accent-primary)' },
    { label: t('admin.linkBilling'), icon: CreditCard, href: '/admin/billing', color: 'var(--accent-primary)' },
    { label: t('admin.linkAnalytics'), icon: BarChart3, href: '/admin/analytics', color: 'var(--accent-primary)' },
  ];

  const healthColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'synced': return 'var(--color-success)';
      case 'warning': return 'var(--color-warning)';
      case 'critical': case 'inactive': return 'var(--color-danger)';
      default: return 'var(--text-muted)';
    }
  };

  const healthLabel = (status: string) => {
    switch (status) {
      case 'healthy': return t('admin.healthHealthy');
      case 'synced': return t('admin.healthSynced');
      case 'warning': return t('admin.healthWarning');
      case 'critical': return t('admin.healthCritical');
      case 'inactive': return t('admin.healthInactive');
      default: return t('admin.healthUnknown');
    }
  };

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <TopBar title={t('admin.topBarTitle')} />
      <main className="page-container page-enter">

        <PageHeader
          icon={Shield}
          title={t('admin.pageTitle')}
          subtitle={t('admin.pageSubtitle')}
        />

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              id: 'totalOrgs',
              label: t('admin.kpiTotalOrganizations'),
              value: orgsLoading ? '...' : organizations.length.toString(),
              sub: t('admin.kpiOrgsActive', { count: activeOrgs.length }),
              icon: Building2,
              accent: 'var(--accent-primary)',
            },
            {
              id: 'totalUsers',
              label: t('admin.kpiTotalUsers'),
              value: countsLoading ? '...' : totalUsers.toLocaleString(),
              sub: t('admin.kpiAcrossAllOrgs'),
              icon: Users,
              accent: 'var(--accent-primary)',
            },
            {
              id: 'totalPatients',
              label: t('admin.kpiTotalPatients'),
              value: countsLoading ? '...' : totalPatients.toLocaleString(),
              sub: t('admin.kpiAcrossAllOrgs'),
              icon: HeartPulse,
              accent: 'var(--accent-primary)',
            },
            {
              id: 'activeSubs',
              label: t('admin.kpiActiveSubscriptions'),
              value: orgsLoading ? '...' : activeSubscriptions.toString(),
              sub: t('admin.kpiSubsBreakdown', { trial: trialOrgs, suspended: suspendedOrgs }),
              icon: CreditCard,
              accent: 'var(--accent-primary)',
            },
          ].map((stat) => (
            <div key={stat.id} className="p-5 rounded-xl cursor-pointer" onClick={() => {
              const routes: Record<string, string> = { totalOrgs: '/admin/organizations', totalUsers: '/admin/users', totalPatients: '/patients', activeSubs: '/admin/billing' };
              if (routes[stat.id]) router.push(routes[stat.id]);
            }} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="icon-box-sm" style={{ background: `${stat.accent}15` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.accent }} />
                </div>
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* SYSTEM HEALTH DASHBOARD */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('admin.systemHealthDashboard')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Database Health */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('admin.healthDatabase')}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: healthColor(dbHealth) }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{dbStatsLoading ? '...' : totalDocs.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('admin.healthTotalDocuments', { count: dbStats.length })}</p>
            </div>

            {/* Sync Status */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('admin.healthSyncStatus')}</span>
                <RefreshCw className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {syncStatuses.filter(s => s.status === 'synced').length}/{syncStatuses.length}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('admin.healthOrgsSynced')}</p>
            </div>

            {/* Last Backup */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('admin.healthLastBackup')}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: healthColor(backupHealth) }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {lastBackupTime ? formatTimestamp(lastBackupTime) : t('admin.healthNoBackup')}
              </p>
              <p className="text-[10px]" style={{ color: healthColor(backupHealth) }}>
                {backupHealth === 'healthy' ? t('admin.backupRecent') : backupHealth === 'warning' ? t('admin.backupOver24h') : backupHealth === 'critical' ? t('admin.backupOver72h') : t('admin.backupNotConfigured')}
              </p>
            </div>

            {/* Overall Platform */}
            <div className="p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('admin.healthPlatform')}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-success)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{t('admin.healthOperational')}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('admin.healthAllSystemsRunning')}</p>
            </div>
          </div>

          <hr className="section-divider" />

          {/* DB Size per database */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {dbStats.slice(0, 12).map(db => (
              <div key={db.name} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-1.5">
                  <Database className="w-3 h-3" style={{ color: db.docCount > 0 ? '#7C3AED' : 'var(--text-muted)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{db.name}</span>
                </div>
                <span className="text-[10px] font-bold font-mono" style={{ color: db.docCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {db.docCount}
                </span>
              </div>
            ))}
          </div>

          {/* Org Sync Statuses */}
          {syncStatuses.length > 0 && (
            <div className="mt-0">
              <hr className="section-divider" />
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t('admin.organizationSync')}</p>
              <div className="flex flex-wrap gap-2">
                {syncStatuses.map(s => (
                  <span key={s.org} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: healthColor(s.status) }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{s.org}</span>
                    <span className="font-semibold" style={{ color: healthColor(s.status) }}>{healthLabel(s.status)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Recent Organizations Table */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.recentOrganizations')}</span>
              </div>
              <button onClick={() => router.push('/admin/organizations')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                {t('admin.viewAll')} <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    { key: 'name', label: t('admin.colName') },
                    { key: 'plan', label: t('admin.colPlan') },
                    { key: 'status', label: t('admin.colStatus') },
                    { key: 'type', label: t('admin.colType') },
                    { key: 'created', label: t('admin.colCreated') },
                  ].map(h => (
                    <th key={h.key} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgsLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('admin.loading')}</td></tr>
                ) : recentOrgs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('admin.noOrganizationsYet')}</td></tr>
                ) : recentOrgs.map(org => (
                  <tr key={org._id} className="cursor-pointer transition-colors" onClick={() => router.push('/admin/organizations')}
                      style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: org.primaryColor || 'var(--color-danger)' }}>
                          {org.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{org.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{org.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                        background: org.subscriptionPlan === 'enterprise' ? 'rgba(124,58,237,0.12)' : org.subscriptionPlan === 'professional' ? 'rgba(59, 130, 246,0.12)' : 'rgba(107,114,128,0.12)',
                        color: org.subscriptionPlan === 'enterprise' ? '#7C3AED' : org.subscriptionPlan === 'professional' ? '#3b82f6' : '#6B7280',
                      }}>{org.subscriptionPlan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full" style={{
                          background: org.subscriptionStatus === 'active' ? 'var(--color-success)' : org.subscriptionStatus === 'trial' ? 'var(--color-warning)' : 'var(--color-danger)',
                        }} />
                        <span style={{
                          color: org.subscriptionStatus === 'active' ? 'var(--color-success)' : org.subscriptionStatus === 'trial' ? 'var(--color-warning)' : 'var(--color-danger)',
                        }}>{org.subscriptionStatus}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full" style={{
                        background: org.orgType === 'public' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
                        color: org.orgType === 'public' ? 'var(--color-success)' : 'var(--color-danger)',
                      }}>{org.orgType}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">

            {/* Quick Links */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('admin.quickActions')}</p>
              <div className="data-row-divider-sm">
                {quickLinks.map(link => (
                  <button
                    key={link.label}
                    onClick={() => router.push(link.href)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left"
                    style={{ background: `${link.color}08`, border: `1px solid ${link.color}15` }}
                  >
                    <link.icon className="w-4 h-4" style={{ color: link.color }} />
                    <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{link.label}</span>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Plan Distribution */}
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('admin.planDistribution')}</p>
              <div className="data-row-divider-sm">
                {[
                  { id: 'enterprise', plan: t('admin.planEnterprise'), count: planCounts.enterprise, color: '#7C3AED' },
                  { id: 'professional', plan: t('admin.planProfessional'), count: planCounts.professional, color: '#3b82f6' },
                  { id: 'basic', plan: t('admin.planBasic'), count: planCounts.basic, color: '#6B7280' },
                ].map(p => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{p.plan}</span>
                      <span className="text-sm font-bold" style={{ color: p.color }}>{p.count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--overlay-subtle)' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: organizations.length > 0 ? `${(p.count / organizations.length) * 100}%` : '0%',
                        background: p.color,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AUDIT LOG VIEWER */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.auditLog')}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                {t('admin.auditEntries', { count: filteredAuditLogs.length })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={e => { setAuditSearch(e.target.value); setAuditPage(0); }}
                  placeholder={t('admin.searchPlaceholder')}
                  className="text-xs pl-8 pr-3 py-2 rounded-lg outline-none"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', width: '200px' }}
                />
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    { key: 'timestamp', label: t('admin.colTimestamp') },
                    { key: 'user', label: t('admin.colUser') },
                    { key: 'action', label: t('admin.colAction') },
                    { key: 'details', label: t('admin.colDetails') },
                    { key: 'status', label: t('admin.colStatus') },
                  ].map(h => (
                    <th key={h.key} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('admin.loadingAuditLog')}</td></tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    {auditSearch ? t('admin.noMatchingEntries') : t('admin.noAuditEntriesYet')}
                  </td></tr>
                ) : paginatedLogs.map(log => (
                  <tr key={log._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td className="px-4 py-3">
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.username || t('admin.systemUser')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>
                      {log.details}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                        background: log.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        color: log.success ? 'var(--color-success)' : 'var(--color-danger)',
                      }}>
                        {log.success ? t('admin.statusSuccess') : t('admin.statusFailed')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalAuditPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-light)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('admin.pageOf', { current: auditPage + 1, total: totalAuditPages })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage(p => Math.max(0, p - 1))}
                  disabled={auditPage === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: 'var(--overlay-subtle)',
                    border: '1px solid var(--border-light)',
                    color: auditPage === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    opacity: auditPage === 0 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> {t('admin.prev')}
                </button>
                <button
                  onClick={() => setAuditPage(p => Math.min(totalAuditPages - 1, p + 1))}
                  disabled={auditPage >= totalAuditPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: 'var(--overlay-subtle)',
                    border: '1px solid var(--border-light)',
                    color: auditPage >= totalAuditPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    opacity: auditPage >= totalAuditPages - 1 ? 0.5 : 1,
                  }}
                >
                  {t('admin.next')} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
