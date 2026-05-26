'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api-fetch';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
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
          { key: 'tamamhealth_users', label: 'Users' },
          { key: 'tamamhealth_patients', label: 'Patients' },
          { key: 'tamamhealth_hospitals', label: 'Hospitals' },
          { key: 'tamamhealth_medical_records', label: 'Medical Records' },
          { key: 'tamamhealth_referrals', label: 'Referrals' },
          { key: 'tamamhealth_lab_results', label: 'Lab Results' },
          { key: 'tamamhealth_disease_alerts', label: 'Disease Alerts' },
          { key: 'tamamhealth_prescriptions', label: 'Prescriptions' },
          { key: 'tamamhealth_audit_log', label: 'Audit Log' },
          { key: 'tamamhealth_messages', label: 'Messages' },
          { key: 'tamamhealth_births', label: 'Births' },
          { key: 'tamamhealth_deaths', label: 'Deaths' },
          { key: 'tamamhealth_immunizations', label: 'Immunizations' },
          { key: 'tamamhealth_anc', label: 'ANC Visits' },
          { key: 'tamamhealth_boma_visits', label: 'Boma Visits' },
          { key: 'tamamhealth_follow_ups', label: 'Follow-Ups' },
          { key: 'tamamhealth_organizations', label: 'Organizations' },
          { key: 'tamamhealth_platform_config', label: 'Platform Config' },
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
  }, []);

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
    if (!window.confirm('Push pending sync events to the country node now?')) return;
    setSyncPushing(true);
    try {
      const res = await apiFetch('/api/admin/sync-push', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(body?.error || `Sync push failed (HTTP ${res.status})`, 'error');
        return;
      }
      const pushed = typeof body.pushed === 'number' ? body.pushed : 0;
      const acked = typeof body.acknowledged === 'number' ? body.acknowledged : 0;
      const errors = Array.isArray(body.errors) ? body.errors.length : 0;
      const summary = errors > 0
        ? `Pushed ${pushed}, acked ${acked}, ${errors} error(s)`
        : `Pushed ${pushed}, acked ${acked}`;
      showToast(summary, errors > 0 ? 'error' : 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync push failed', 'error');
    } finally {
      setSyncPushing(false);
    }
  };

  // Generates the current month's DHIS2 dataset and pushes it to the
  // configured DHIS2 server. Period defaults to current YYYYMM server-side.
  const handleDhis2Push = async () => {
    if (!window.confirm('Generate and push the current period DHIS2 dataset?')) return;
    setDhis2Pushing(true);
    try {
      const res = await apiFetch('/api/admin/dhis2-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body?.result?.message || body?.error || `DHIS2 push failed (HTTP ${res.status})`;
        showToast(msg, 'error');
        return;
      }
      const period = body.period ?? '';
      const values = typeof body.dataValues === 'number' ? body.dataValues : 0;
      const ok = body.result?.ok !== false;
      showToast(
        ok ? `DHIS2 push ok — ${values} data value(s) for ${period}` : (body.result?.message || 'DHIS2 push failed'),
        ok ? 'success' : 'error',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'DHIS2 push failed', 'error');
    } finally {
      setDhis2Pushing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)',
    borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)',
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
      <TopBar title="System Configuration" />
      <main className="page-container page-enter">

        {/* SYNC OPERATIONS — manual triggers for the same endpoints that the
            scheduled cron sidecar calls. Useful for verifying end-to-end push
            after a config change without waiting for the next scheduled run. */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Sync Operations</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Manually trigger the country-node and DHIS2 push pipelines. Both are normally driven by a cron sidecar; use these for ad-hoc verification.
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
              {syncPushing ? 'Pushing…' : 'Sync push'}
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
              {dhis2Pushing ? 'Pushing…' : 'DHIS2 push'}
            </button>
          </div>
        </div>

        {/* SYSTEM HEALTH DASHBOARD */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>System Health</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Database */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Database</span>
                <span className="w-2 h-2 rounded-full" style={{ background: totalDocs > 0 ? 'var(--color-success)' : 'var(--text-muted)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{dbStatsLoading ? '...' : totalDocs.toLocaleString()}</p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{dbStats.length} databases</p>
            </div>

            {/* Sync */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Org Sync</span>
                <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {syncStatuses.filter(s => s.status === 'synced').length}/{syncStatuses.length}
              </p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Active orgs synced</p>
            </div>

            {/* Backup */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Backup</span>
                <span className="w-2 h-2 rounded-full" style={{ background: healthColor(backupHealth) }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {lastBackupTime ? (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimestamp(lastBackupTime)}</span>
                ) : 'No backup'}
              </p>
              <p className="text-[9px]" style={{ color: healthColor(backupHealth) }}>
                {backupHealth === 'healthy' ? 'Recent' : backupHealth === 'warning' ? '>24h ago' : backupHealth === 'critical' ? '>72h ago' : 'Not set'}
              </p>
            </div>

            {/* Platform */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Platform</span>
                <span className="w-2 h-2 rounded-full" style={{ background: maintenanceMode ? 'var(--color-warning)' : 'var(--color-success)' }} />
              </div>
              <p className="text-lg font-bold" style={{ color: maintenanceMode ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {maintenanceMode ? 'Maintenance' : 'Operational'}
              </p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                {maintenanceMode ? 'Admin-only access' : 'All systems go'}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Configuration Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Platform Settings */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}>
                  <Settings className="w-5 h-5" style={{ color: '#7C3AED' }} />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Platform Settings</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure global platform parameters</p>
                </div>
              </div>

              {loading ? (
                <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>Loading configuration...</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label style={labelStyle}>Platform Name</label>
                    <input type="text" value={platformName} onChange={e => setPlatformName(e.target.value)} style={inputStyle} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Default Primary Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={defaultPrimaryColor} onChange={e => setDefaultPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <input type="text" value={defaultPrimaryColor} onChange={e => setDefaultPrimaryColor(e.target.value)}
                          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Default Secondary Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={defaultSecondaryColor} onChange={e => setDefaultSecondaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <input type="text" value={defaultSecondaryColor} onChange={e => setDefaultSecondaryColor(e.target.value)}
                          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
                  <Shield className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Feature Toggles</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enable or disable global features</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Maintenance Mode */}
                <div className="flex items-center justify-between p-4 rounded-xl" style={{
                  background: maintenanceMode ? 'rgba(239,68,68,0.05)' : 'var(--overlay-subtle)',
                  border: `1px solid ${maintenanceMode ? 'rgba(239,68,68,0.2)' : 'var(--border-light)'}`,
                }}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" style={{ color: maintenanceMode ? 'var(--color-danger)' : 'var(--text-muted)' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Maintenance Mode</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>When enabled, only super admins can access the platform</p>
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
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Signups Enabled</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Allow new organization registrations</p>
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
                    <label style={labelStyle}>Trial Days</label>
                    <input type="number" min="1" max="365" value={trialDays} onChange={e => setTrialDays(parseInt(e.target.value) || 30)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Max Organizations</label>
                    <input type="number" min="1" value={maxOrganizations} onChange={e => setMaxOrganizations(parseInt(e.target.value) || 100)} style={inputStyle} />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: '#7C3AED', opacity: saving ? 0.6 : 1 }}>
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              {saved && (
                <span className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>Configuration saved successfully</span>
              )}
            </div>
          </div>

          {/* Right: DB Statistics */}
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-4 h-4" style={{ color: '#7C3AED' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Database Statistics</span>
              </div>

              {/* Total docs */}
              <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className="w-4 h-4" style={{ color: '#7C3AED' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Documents</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: '#7C3AED' }}>{dbStatsLoading ? '...' : totalDocs.toLocaleString()}</p>
              </div>

              {/* Per-DB */}
              <div className="space-y-1">
                {dbStatsLoading ? (
                  <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading stats...</p>
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

            {/* System Info */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>System Info</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Storage Engine', value: 'PouchDB (IndexedDB)' },
                  { label: 'Platform', value: 'Next.js 14' },
                  { label: 'UI Framework', value: 'Tailwind CSS' },
                  { label: 'Auth', value: 'JWT (Client-side)' },
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
      </main>
    </>
  );
}
