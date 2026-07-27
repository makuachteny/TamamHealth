'use client';

/**
 * Super-admin → Sync & Jobs.
 * Operational view of the local sync-event outbox: what's queued for the
 * country node, manual job runners for draining it, and a pointer into the
 * conflict reconciliation queue. All data is read live from PouchDB via
 * sync-event-service — nothing here is fabricated.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import EhrListHeader, { LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { SaPage, SaCard, SaPill, SaTable, formatWhen } from '@/components/admin/sa-ui';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api-fetch';
import { useHospitals } from '@/lib/hooks/useHospitals';
import {
  getSyncEventStats,
  getPendingSyncEvents,
  pushPendingToCountryNode,
} from '@/lib/services/sync-event-service';
import type { SyncEventDoc } from '@/lib/db-types';
import { RefreshCw, Upload, Send, ArrowRight } from '@/components/icons/lucide';

interface SyncStats {
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  oldestPending?: string;
  newestEvent?: string;
}

const STATUS_TONE: Record<SyncEventDoc['syncStatus'], 'ok' | 'warn' | 'danger' | 'info'> = {
  pending: 'warn',
  syncing: 'info',
  synced: 'ok',
  failed: 'danger',
};

export default function AdminSyncPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { hospitals } = useHospitals();

  const [stats, setStats] = useState<SyncStats | null>(null);
  const [events, setEvents] = useState<SyncEventDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [pendingConflicts, setPendingConflicts] = useState<number | null>(null);
  const [conflictsError, setConflictsError] = useState(false);

  const [pushingCountryNode, setPushingCountryNode] = useState(false);
  const [syncPushing, setSyncPushing] = useState(false);
  const [dhis2Pushing, setDhis2Pushing] = useState(false);

  const hospitalNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hospitals) map.set(h._id, h.name);
    return map;
  }, [hospitals]);

  const loadQueue = useCallback(async () => {
    try {
      const [s, ev] = await Promise.all([getSyncEventStats(), getPendingSyncEvents(100)]);
      setStats(s);
      setEvents(ev);
    } catch (err) {
      console.error('Failed to load sync queue', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConflicts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/conflicts?status=pending');
      if (!res.ok) { setConflictsError(true); return; }
      const body = await res.json();
      setPendingConflicts(Array.isArray(body.conflicts) ? body.conflicts.length : 0);
      setConflictsError(false);
    } catch {
      setConflictsError(true);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  const handlePushCountryNode = async () => {
    setPushingCountryNode(true);
    try {
      const result = await pushPendingToCountryNode(50);
      if (result.skipped) {
        showToast('Country-node sync is not configured on this facility (SYNC_PUSH_URL unset) — no events pushed.', 'error');
      } else if (result.error) {
        showToast(`Push failed after ${result.pushed} queued: ${result.error}`, 'error');
      } else {
        showToast(`Pushed ${result.pushed}, acknowledged ${result.acknowledged}.`, 'success');
      }
      await loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Push to country node failed.', 'error');
    } finally {
      setPushingCountryNode(false);
    }
  };

  const handleSyncPush = async () => {
    setSyncPushing(true);
    try {
      const res = await apiFetch('/api/admin/sync-push', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(body?.error || `Sync push failed (HTTP ${res.status}).`, 'error');
      } else {
        const pushed = typeof body.pushed === 'number' ? body.pushed : 0;
        const acked = typeof body.acknowledged === 'number' ? body.acknowledged : 0;
        showToast(`Server sync push: pushed ${pushed}, acknowledged ${acked}.`, 'success');
      }
      await loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync push failed.', 'error');
    } finally {
      setSyncPushing(false);
    }
  };

  const handleDhis2Push = async () => {
    setDhis2Pushing(true);
    try {
      const res = await apiFetch('/api/admin/dhis2-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body?.result?.message || body?.error || `DHIS2 push failed (HTTP ${res.status}).`;
        showToast(msg, 'error');
      } else {
        const ok = body.result?.ok !== false;
        const values = typeof body.dataValues === 'number' ? body.dataValues : 0;
        showToast(
          ok ? `DHIS2 export pushed — ${values} data values for period ${body.period}.` : (body.result?.message || 'DHIS2 push failed.'),
          ok ? 'success' : 'error',
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'DHIS2 push failed.', 'error');
    } finally {
      setDhis2Pushing(false);
    }
  };

  const anyRunning = pushingCountryNode || syncPushing || dhis2Pushing;

  return (
    <SaPage>
      <SaCard>
        <EhrListHeader
          title="Sync &amp; Jobs"
          stats={[
            { label: 'Pending', value: loading ? '—' : stats?.pending ?? 0, color: stats && stats.pending > 0 ? LIST_STAT_COLORS.amber : LIST_STAT_COLORS.muted },
            { label: 'Syncing', value: loading ? '—' : stats?.syncing ?? 0, color: LIST_STAT_COLORS.blue },
            { label: 'Synced', value: loading ? '—' : stats?.synced ?? 0, color: LIST_STAT_COLORS.green },
            { label: 'Failed', value: loading ? '—' : stats?.failed ?? 0, color: stats && stats.failed > 0 ? 'var(--color-danger)' : LIST_STAT_COLORS.muted },
            { label: 'Oldest pending', value: loading ? '—' : formatWhen(stats?.oldestPending), color: LIST_STAT_COLORS.muted },
          ]}
        />
        <div style={{ padding: '2px 16px 0', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
          {!loading && `${events.length} shown${events.length === 100 ? ' (capped at 100)' : ''}`}
        </div>
        <SaTable
          columns={['When', 'Resource', 'Operation', 'Facility', 'Status', 'Error']}
          empty={loading ? 'Loading…' : 'Queue is drained — all events synced.'}
          minWidth={760}
        >
          {events.map(ev => (
            <tr key={ev._id}>
              <td>{formatWhen(ev.occurredAt)}</td>
              <td><strong>{ev.resourceType}</strong> <span style={{ color: 'var(--text-muted)' }}>{ev.resourceId.slice(0, 12)}</span></td>
              <td>{ev.operation}</td>
              <td>{(ev.hospitalId && hospitalNames.get(ev.hospitalId)) || ev.hospitalId || '—'}</td>
              <td><SaPill tone={STATUS_TONE[ev.syncStatus]}>{ev.syncStatus}</SaPill></td>
              <td>{ev.syncError || '—'}</td>
            </tr>
          ))}
        </SaTable>
      </SaCard>

      <div className="sa-split">
        <SaCard title="Job runners">
          <div className="sa-kv">
            <div className="sa-kv-row">
              <span>Push pending to country node</span>
              <button type="button" className="sa-btn" disabled={anyRunning} onClick={handlePushCountryNode}>
                <Upload className="w-3.5 h-3.5" />
                {pushingCountryNode ? 'Pushing…' : 'Run'}
              </button>
            </div>
            <div className="sa-kv-row">
              <span>Server sync push</span>
              <button type="button" className="sa-btn" disabled={anyRunning} onClick={handleSyncPush}>
                <RefreshCw className="w-3.5 h-3.5" />
                {syncPushing ? 'Pushing…' : 'Run'}
              </button>
            </div>
            <div className="sa-kv-row">
              <span>DHIS2 export push</span>
              <button type="button" className="sa-btn" disabled={anyRunning} onClick={handleDhis2Push}>
                <Send className="w-3.5 h-3.5" />
                {dhis2Pushing ? 'Pushing…' : 'Run'}
              </button>
            </div>
          </div>
        </SaCard>

        <SaCard title="Conflicts">
          <div className="sa-kv">
            <div className="sa-kv-row">
              <span>Pending reconciliation</span>
              <span>{conflictsError ? '—' : pendingConflicts ?? '…'}</span>
            </div>
          </div>
          <div style={{ padding: '0 14px 14px' }}>
            <button type="button" className="sa-btn primary" onClick={() => router.push('/admin/conflicts')}>
              Open reconciliation queue
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </SaCard>
      </div>
    </SaPage>
  );
}
