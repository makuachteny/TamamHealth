'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { apiFetch } from '@/lib/api-fetch';
import {
  Activity, AlertTriangle, CheckCircle2, Database, HardDrive, RefreshCw,
  Server, ShieldCheck, Smartphone, Upload,
} from '@/components/icons/lucide';

interface DbStat {
  key: string;
  label: string;
  count: number;
}

const DB_NAMES = [
  ['tamamhealth_patients', 'Patients'],
  ['tamamhealth_appointments', 'Appointments'],
  ['tamamhealth_medical_records', 'Medical Records'],
  ['tamamhealth_lab_results', 'Lab & Imaging'],
  ['tamamhealth_prescriptions', 'Prescriptions'],
  ['tamamhealth_payments', 'Payments'],
  ['tamamhealth_referrals', 'Referrals'],
  ['tamamhealth_audit_log', 'Audit Log'],
] as const;

export default function ItOperationsPage() {
  const { currentUser, isOnline, syncPaused, lastSync, syncNow } = useApp();
  const settings = useSettings();
  const [dbStats, setDbStats] = useState<DbStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState<'sync' | 'dhis2' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingStats(true);
      const { getDB } = await import('@/lib/db');
      const stats = await Promise.all(DB_NAMES.map(async ([key, label]) => {
        try {
          const info = await getDB(key).info();
          return { key, label, count: info.doc_count };
        } catch {
          return { key, label, count: 0 };
        }
      }));
      if (!cancelled) {
        setDbStats(stats);
        setLoadingStats(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const backupIso = typeof window !== 'undefined' ? window.localStorage.getItem('safeguard_last_backup') : null;
  const backupAgeHours = useMemo(() => {
    if (!backupIso) return null;
    const at = new Date(backupIso).getTime();
    if (Number.isNaN(at)) return null;
    return Math.floor((Date.now() - at) / 3600000);
  }, [backupIso]);
  const backupStatus = backupAgeHours === null
    ? 'unknown'
    : backupAgeHours <= settings.itOperations.backupFrequencyHours
      ? 'healthy'
      : backupAgeHours <= settings.itOperations.backupFrequencyHours * 2
        ? 'warning'
        : 'critical';

  const lastSyncAgeMinutes = useMemo(() => {
    if (!lastSync) return null;
    const at = new Date(lastSync).getTime();
    if (Number.isNaN(at)) return null;
    return Math.floor((Date.now() - at) / 60000);
  }, [lastSync]);
  const syncStatus = syncPaused || !isOnline
    ? 'warning'
    : lastSyncAgeMinutes === null
      ? 'unknown'
      : lastSyncAgeMinutes <= settings.itOperations.syncFailureAlertMinutes
        ? 'healthy'
        : 'warning';

  const runLocalSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      await syncNow();
      setMessage('Local sync started.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not start sync.');
    } finally {
      setSyncing(false);
    }
  };

  const runServerPush = async (kind: 'sync' | 'dhis2') => {
    setPushing(kind);
    setMessage(null);
    try {
      const res = await apiFetch(kind === 'sync' ? '/api/admin/sync-push' : '/api/admin/dhis2-push', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body?.error || `Push failed with status ${res.status}.`);
        return;
      }
      setMessage(kind === 'sync' ? `Sync push complete: ${body.pushed ?? 0} pushed.` : `DHIS2 push complete: ${body.dataValues ?? 0} values.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Push failed.');
    } finally {
      setPushing(null);
    }
  };

  const totalDocs = dbStats.reduce((sum, stat) => sum + stat.count, 0);
  const canRunPlatformPush = currentUser?.role === 'super_admin';

  return (
    <>
      <TopBar title="IT Operations" />
      <main className="page-container page-enter">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          <HealthCard icon={Activity} title="Sync" status={syncStatus} value={syncPaused ? 'Paused' : isOnline ? 'Online' : 'Offline'} detail={lastSync ? `Last sync ${new Date(lastSync).toLocaleString()}` : 'No sync recorded'} />
          <HealthCard icon={HardDrive} title="Backup" status={backupStatus} value={backupAgeHours === null ? 'Unknown' : `${backupAgeHours}h old`} detail={`Expected every ${settings.itOperations.backupFrequencyHours}h`} />
          <HealthCard icon={Smartphone} title="Devices" status={settings.itOperations.requireDeviceRegistration ? 'healthy' : 'warning'} value={settings.itOperations.requireDeviceRegistration ? 'Registration on' : 'Open'} detail={`Review every ${settings.itOperations.deviceReviewDays} days`} />
          <HealthCard icon={ShieldCheck} title="Audit" status="healthy" value={`${settings.itOperations.auditRetentionDays} days`} detail="Retention policy" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <section className="dash-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Operations Console</h2>
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{currentUser?.hospitalName || currentUser?.organization?.name || 'Platform'}</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <ActionButton icon={RefreshCw} label="Start Local Sync" busy={syncing} onClick={runLocalSync} />
              <ActionButton icon={Upload} label="Push Sync Events" busy={pushing === 'sync'} disabled={!canRunPlatformPush} onClick={() => runServerPush('sync')} />
              <ActionButton icon={Upload} label="Push DHIS2" busy={pushing === 'dhis2'} disabled={!canRunPlatformPush} onClick={() => runServerPush('dhis2')} />
            </div>
            {message && (
              <div className="mx-4 mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)' }}>
                {message}
              </div>
            )}
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link className="it-link" href="/data-quality">Data quality monitor</Link>
              <Link className="it-link" href="/admin/conflicts">Conflict queue</Link>
              <Link className="it-link" href="/facility-settings">Workflow settings</Link>
              <Link className="it-link" href="/system-admin">System administration</Link>
            </div>
          </section>

          <section className="dash-card overflow-hidden">
            <div className="flex items-center gap-2 p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <Database className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Data Stores</h2>
            </div>
            <div className="p-4">
              <div className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{loadingStats ? '...' : totalDocs.toLocaleString()}</div>
              <div className="grid gap-2">
                {dbStats.map(stat => (
                  <div key={stat.key} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{stat.label}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{stat.count.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <section className="dash-card p-4">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Configured Integrations</h2>
            <div className="flex flex-wrap gap-2">
              {settings.itOperations.integrations.map(integration => (
                <span key={integration} className="it-pill">{integration.replace(/_/g, ' ').toUpperCase()}</span>
              ))}
            </div>
          </section>
          <section className="dash-card p-4">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Workflow Controls</h2>
            <div className="grid gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>Offline mode: <strong>{settings.itOperations.allowOfflineMode ? 'Allowed' : 'Disabled'}</strong></span>
              <span>Device registration: <strong>{settings.itOperations.requireDeviceRegistration ? 'Required' : 'Optional'}</strong></span>
              <span>Completeness signoff: <strong>{settings.reporting.requireCompletenessSignoff ? 'Required' : 'Optional'}</strong></span>
              <span>Reporting deadline: <strong>Day {settings.reporting.monthlyDeadlineDay}</strong></span>
            </div>
          </section>
        </div>

        <style>{`
          .it-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 38px;
            padding: 8px 12px;
            border: 1px solid var(--border-light);
            border-radius: 8px;
            background: var(--overlay-subtle);
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 700;
            text-decoration: none;
          }
          .it-pill {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 5px 10px;
            border-radius: 999px;
            background: var(--accent-light);
            color: var(--accent-primary);
            font-size: 11px;
            font-weight: 800;
          }
        `}</style>
      </main>
    </>
  );
}

function HealthCard({ icon: Icon, title, status, value, detail }: {
  icon: typeof Activity;
  title: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  value: string;
  detail: string;
}) {
  const color = status === 'healthy'
    ? 'var(--color-success)'
    : status === 'critical'
      ? 'var(--color-danger)'
      : status === 'warning'
        ? 'var(--color-warning)'
        : 'var(--text-muted)';
  const StatusIcon = status === 'healthy' ? CheckCircle2 : AlertTriangle;
  return (
    <section className="dash-card p-4">
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        <StatusIcon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{detail}</p>
    </section>
  );
}

function ActionButton({ icon: Icon, label, busy, disabled, onClick }: {
  icon: typeof RefreshCw;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="btn btn-secondary inline-flex items-center justify-center gap-2"
      title={disabled ? 'Requires platform administrator access' : undefined}
    >
      <Icon className="w-4 h-4" />
      {busy ? 'Working...' : label}
    </button>
  );
}
