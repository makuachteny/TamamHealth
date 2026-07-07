'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api-fetch';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Settings, Save, Database, ToggleLeft, ToggleRight,
  Shield, AlertTriangle, Server, HardDrive, Activity,
  RefreshCw, Clock, Upload, Send,
} from '@/components/icons/lucide';

interface DBStats {
  name: string;
  docCount: number;
}

export default function AdminSystemPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const { config, loading, update } = usePlatformConfig();
  const { organizations, loading: orgsLoading } = useOrganizations();

  const [platformName, setPlatformName] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [trialDays, setTrialDays] = useState(30);
  const [maxOrganizations, setMaxOrganizations] = useState(100);
  const [defaultPrimaryColor, setDefaultPrimaryColor] = useState('var(--accent-primary)');
  const [defaultSecondaryColor, setDefaultSecondaryColor] = useState('#0F47AF');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dbStats, setDbStats] = useState<DBStats[]>([]);
  const [dbStatsLoading, setDbStatsLoading] = useState(true);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [syncPushing, setSyncPushing] = useState(false);
  const [dhis2Pushing, setDhis2Pushing] = useState(false);

  // Access control
  useEffect(() => {
    if (currentUser && currentUser.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Populate form from config
  useEffect(() => {
    if (config) {
      setPlatformName(config.platformName);
      setMaintenanceMode(config.maintenanceMode);
      setSignupsEnabled(config.globalFeatureFlags.signupsEnabled);
      setTrialDays(config.globalFeatureFlags.trialDays);
      setMaxOrganizations(config.globalFeatureFlags.maxOrganizations);
      setDefaultPrimaryColor(config.defaultPrimaryColor);
      setDefaultSecondaryColor(config.defaultSecondaryColor);
    }
  }, [config]);

  // Load DB stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const { getDB } = await import('@/lib/db');
        const dbNames = [
          { key: 'tamamhealth_users', label: t('system.dbUsers') },
          { key: 'tamamhealth_patients', label: t('system.dbPatients') },
          { key: 'tamamhealth_hospitals', label: t('system.dbHospitals') },
          { key: 'tamamhealth_medical_records', label: t('system.dbMedicalRecords') },
          { key: 'tamamhealth_referrals', label: t('system.dbReferrals') },
          { key: 'tamamhealth_lab_results', label: t('system.dbLabResults') },
          { key: 'tamamhealth_disease_alerts', label: t('system.dbDiseaseAlerts') },
          { key: 'tamamhealth_prescriptions', label: t('system.dbPrescriptions') },
          { key: 'tamamhealth_audit_log', label: t('system.dbAuditLog') },
          { key: 'tamamhealth_messages', label: t('system.dbMessages') },
          { key: 'tamamhealth_births', label: t('system.dbBirths') },
          { key: 'tamamhealth_deaths', label: t('system.dbDeaths') },
          { key: 'tamamhealth_immunizations', label: t('system.dbImmunizations') },
          { key: 'tamamhealth_anc', label: t('system.dbAncVisits') },
          { key: 'tamamhealth_follow_ups', label: t('system.dbFollowUps') },
          { key: 'tamamhealth_organizations', label: t('system.dbOrganizations') },
          { key: 'tamamhealth_platform_config', label: t('system.dbPlatformConfig') },
        ];
        // Run all db.info() calls concurrently — sequential awaits across 18
        // databases meant 18 round-trips on every page load.
        const stats: DBStats[] = await Promise.all(
          dbNames.map(async ({ key, label }) => {
            try {
              const db = getDB(key);
              const info = await db.info();
              return { name: label, docCount: info.doc_count };
            } catch {
              return { name: label, docCount: 0 };
            }
          })
        );
        setDbStats(stats);

        // Check last backup from localStorage
        const backup = typeof window !== 'undefined' ? localStorage.getItem('safeguard_last_backup') : null;
        setLastBackupTime(backup);
      } catch (err) {
        console.error('Failed to load DB stats:', err);
      } finally {
        setDbStatsLoading(false);
      }
    };
    loadStats();
  }, [t]);

  if (!currentUser || currentUser.role !== 'super_admin') return null;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await update({
        platformName,
        maintenanceMode,
        globalFeatureFlags: {
          signupsEnabled,
          trialDays,
          maxOrganizations,
        },
        defaultPrimaryColor,
        defaultSecondaryColor,
      }, currentUser._id, currentUser.username);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Drains the local outbox of unsynced sync events to the country node.
  // Calls the same /api/admin/sync-push endpoint that a cron sidecar would.
  const handleSyncPush = async () => {
    if (!window.confirm(t('system.confirmSyncPush'))) return;
    setSyncPushing(true);
    try {
      const res = await apiFetch('/api/admin/sync-push', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(body?.error || t('system.syncPushFailedHttp', { status: res.status }), 'error');
        return;
      }
      const pushed = typeof body.pushed === 'number' ? body.pushed : 0;
      const acked = typeof body.acknowledged === 'number' ? body.acknowledged : 0;
      const errors = Array.isArray(body.errors) ? body.errors.length : 0;
      const summary = errors > 0
        ? t('system.syncPushSummaryErrors', { pushed, acked, errors })
        : t('system.syncPushSummary', { pushed, acked });
      showToast(summary, errors > 0 ? 'error' : 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('system.syncPushFailed'), 'error');
    } finally {
      setSyncPushing(false);
    }
  };

  // Generates the current month's DHIS2 dataset and pushes it to the
  // configured DHIS2 server. Period defaults to current YYYYMM server-side.
  const handleDhis2Push = async () => {
    if (!window.confirm(t('system.confirmDhis2Push'))) return;
    setDhis2Pushing(true);
    try {
      const res = await apiFetch('/api/admin/dhis2-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body?.result?.message || body?.error || t('system.dhis2PushFailedHttp', { status: res.status });
        showToast(msg, 'error');
        return;
      }
      const period = body.period ?? '';
      const values = typeof body.dataValues === 'number' ? body.dataValues : 0;
      const ok = body.result?.ok !== false;
      showToast(
        ok ? t('system.dhis2PushOk', { values, period }) : (body.result?.message || t('system.dhis2PushFailed')),
        ok ? 'success' : 'error',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('system.dhis2PushFailed'), 'error');
    } finally {
      setDhis2Pushing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)',
    borderRadius: '4px', padding: '10px 14px', color: 'var(--text-primary)',
    fontSize: '14px', width: '100%', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block',
  };

  const totalDocs = dbStats.reduce((sum, s) => sum + s.docCount, 0);

  // Health indicators
  const backupAge = lastBackupTime ? Math.floor((Date.now() - new Date(lastBackupTime).getTime()) / 3600000) : null;
  const backupHealth = backupAge === null ? 'unknown' : backupAge < 24 ? 'healthy' : backupAge < 72 ? 'warning' : 'critical';

  const healthColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'synced': return 'var(--color-success)';
      case 'warning': return 'var(--color-warning)';
      case 'critical': return 'var(--color-danger)';
      default: return 'var(--text-muted)';
    }
  };

  const syncStatuses = !orgsLoading ? organizations.map(o => ({
    org: o.name,
    status: o.isActive ? 'synced' as const : 'inactive' as const,
  })) : [];

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <TopBar title={t('system.title')} />
      <main className="page-container page-enter">

        {/* SYNC OPERATIONS — manual triggers for the same endpoints that the
            scheduled cron sidecar calls. Useful for verifying end-to-end push
            after a config change without waiting for the next scheduled run. */}
        <div className="dash-card overflow-hidden mb-4">
          <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.syncOperations')}</h3>
          </div>
          <div className="p-4">
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            {t('system.syncOperationsDesc')}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSyncPush}
              disabled={syncPushing}
              aria-busy={syncPushing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'var(--accent-primary)', opacity: syncPushing ? 0.6 : 1, cursor: syncPushing ? 'not-allowed' : 'pointer' }}
            >
              <Upload className={`w-4 h-4 ${syncPushing ? 'animate-spin' : ''}`} />
              {syncPushing ? t('system.pushing') : t('system.syncPush')}
            </button>
            <button
              type="button"
              onClick={handleDhis2Push}
              disabled={dhis2Pushing}
              aria-busy={dhis2Pushing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--overlay-subtle)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                opacity: dhis2Pushing ? 0.6 : 1,
                cursor: dhis2Pushing ? 'not-allowed' : 'pointer',
              }}
            >
              <Send className={`w-4 h-4 ${dhis2Pushing ? 'animate-spin' : ''}`} />
              {dhis2Pushing ? t('system.pushing') : t('system.dhis2Push')}
            </button>
          </div>
          </div>
        </div>

        {/* SYSTEM HEALTH DASHBOARD */}
        <div className="dash-card overflow-hidden mb-4">
          <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <Activity className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.systemHealth')}</h3>
          </div>
          <div className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Database */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('system.database')}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: totalDocs > 0 ? 'var(--color-success)' : 'var(--text-muted)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{dbStatsLoading ? '...' : totalDocs.toLocaleString()}</p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t('system.databasesCount', { count: dbStats.length })}</p>
            </div>

            {/* Sync */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('system.orgSync')}</span>
                <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {syncStatuses.filter(s => s.status === 'synced').length}/{syncStatuses.length}
              </p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t('system.activeOrgsSynced')}</p>
            </div>

            {/* Backup */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('system.backup')}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: healthColor(backupHealth) }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {lastBackupTime ? (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimestamp(lastBackupTime)}</span>
                ) : t('system.noBackup')}
              </p>
              <p className="text-[9px]" style={{ color: healthColor(backupHealth) }}>
                {backupHealth === 'healthy' ? t('system.backupRecent') : backupHealth === 'warning' ? t('system.backup24h') : backupHealth === 'critical' ? t('system.backup72h') : t('system.backupNotSet')}
              </p>
            </div>

            {/* Platform */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('system.platform')}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: maintenanceMode ? 'var(--color-warning)' : 'var(--color-success)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: maintenanceMode ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {maintenanceMode ? t('system.maintenance') : t('system.operational')}
              </p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                {maintenanceMode ? t('system.adminOnlyAccess') : t('system.allSystemsGo')}
              </p>
            </div>
          </div>

          {/* Org Sync List */}
          {syncStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {syncStatuses.map(s => (
                <span key={s.org} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.status === 'synced' ? 'var(--color-success)' : 'var(--color-danger)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{s.org}</span>
                </span>
              ))}
            </div>
          )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: Configuration Form */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Platform Settings */}
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Settings className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.platformSettings')}</h3>
              </div>
              <div className="p-4">
              {loading ? (
                <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>{t('system.loadingConfiguration')}</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label style={labelStyle}>{t('system.platformName')}</label>
                    <input type="text" value={platformName} onChange={e => setPlatformName(e.target.value)} style={inputStyle} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>{t('system.defaultPrimaryColor')}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={defaultPrimaryColor} onChange={e => setDefaultPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <input type="text" value={defaultPrimaryColor} onChange={e => setDefaultPrimaryColor(e.target.value)}
                          style={{ ...inputStyle, fontFamily: 'var(--font-platform-mono)', fontSize: '12px' }} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('system.defaultSecondaryColor')}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={defaultSecondaryColor} onChange={e => setDefaultSecondaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <input type="text" value={defaultSecondaryColor} onChange={e => setDefaultSecondaryColor(e.target.value)}
                          style={{ ...inputStyle, fontFamily: 'var(--font-platform-mono)', fontSize: '12px' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Toggles */}
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Shield className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.featureToggles')}</h3>
              </div>
              <div className="p-4">

              <div className="space-y-4">
                {/* Maintenance Mode */}
                <div className="flex items-center justify-between p-4 rounded-xl" style={{
                  background: maintenanceMode ? 'rgba(239,68,68,0.05)' : 'var(--overlay-subtle)',
                  border: `1px solid ${maintenanceMode ? 'rgba(239,68,68,0.2)' : 'var(--border-light)'}`,
                }}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" style={{ color: maintenanceMode ? 'var(--color-danger)' : 'var(--text-muted)' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.maintenanceMode')}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('system.maintenanceModeDesc')}</p>
                    </div>
                  </div>
                  <button onClick={() => setMaintenanceMode(!maintenanceMode)}>
                    {maintenanceMode ? (
                      <ToggleRight className="w-10 h-10" style={{ color: 'var(--color-danger)' }} />
                    ) : (
                      <ToggleLeft className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </div>

                {/* Signups Enabled */}
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.newSignupsEnabled')}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('system.newSignupsEnabledDesc')}</p>
                  </div>
                  <button onClick={() => setSignupsEnabled(!signupsEnabled)}>
                    {signupsEnabled ? (
                      <ToggleRight className="w-10 h-10" style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <ToggleLeft className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </div>

                {/* Trial Days & Max Orgs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>{t('system.trialDays')}</label>
                    <input type="number" min="1" max="365" value={trialDays} onChange={e => setTrialDays(parseInt(e.target.value) || 30)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('system.maxOrganizations')}</label>
                    <input type="number" min="1" value={maxOrganizations} onChange={e => setMaxOrganizations(parseInt(e.target.value) || 100)} style={inputStyle} />
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: 'var(--accent-primary)', opacity: saving ? 0.6 : 1 }}>
                <Save className="w-4 h-4" />
                {saving ? t('system.saving') : t('system.saveConfiguration')}
              </button>
              {saved && (
                <span className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>{t('system.configurationSaved')}</span>
              )}
            </div>
          </div>

          {/* Right: DB Statistics */}
          <div className="flex flex-col gap-4">
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Database className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.databaseStatistics')}</h3>
              </div>
              <div className="p-4">

              {/* Total docs */}
              <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('system.totalDocuments')}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{dbStatsLoading ? '...' : totalDocs.toLocaleString()}</p>
              </div>

              {/* Per-DB */}
              <div className="space-y-1">
                {dbStatsLoading ? (
                  <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('system.loadingStats')}</p>
                ) : (
                  dbStats.map(db => (
                    <div key={db.name} className="flex items-center justify-between py-2 px-2 rounded-lg transition-colors" style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <div className="flex items-center gap-2">
                        <Server className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{db.name}</span>
                      </div>
                      <span className="text-xs font-bold font-mono" style={{ color: db.docCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {db.docCount.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
              </div>
            </div>

            {/* System Info */}
            <div className="dash-card overflow-hidden">
              <div className="flex items-center gap-2 p-4 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Server className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('system.systemInfo')}</h3>
              </div>
              <div className="p-4">
              <div className="space-y-2.5">
                {[
                  { label: t('system.storageEngine'), value: 'PouchDB (IndexedDB)' },
                  { label: t('system.platform'), value: 'Next.js 14' },
                  { label: t('system.uiFramework'), value: 'Tailwind CSS' },
                  { label: t('system.auth'), value: 'JWT (Client-side)' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
