'use client';

/**
 * Super-admin → Interoperability.
 * Honest inventory of the integrations that actually exist in this codebase
 * — DHIS2 aggregate export, country-node document replication, and the
 * platform REST API gate. No FHIR/webhook endpoints are wired up yet, so
 * those are shown as explicit "none registered" rows rather than omitted or
 * invented.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SaPage, SaCard, SaStatusDot, SaPill, SaTable, formatWhen } from '@/components/admin/sa-ui';
import { useToast } from '@/components/Toast';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import {
  getDhis2SyncLog, isDhis2Configured, getDhis2BaseUrlHost, isFullySynced,
  type Dhis2SyncLogDoc,
} from '@/lib/services/dhis2-sync-log-service';
import { getSyncEventStats, pushPendingToCountryNode } from '@/lib/services/sync-event-service';
import { syncEventsDB } from '@/lib/db';
import { findByType } from '@/lib/services/db-query';
import type { SyncEventDoc } from '@/lib/db-types';
import { ArrowRight, RefreshCw } from '@/components/icons/lucide';

interface QueueHealth {
  total: number;
  pending: number;
  failed: number;
  newestEvent?: string;
}

const RESULT_TONE: Record<string, 'ok' | 'danger' | 'info'> = {
  success: 'ok',
  error: 'danger',
  info: 'info',
};

export default function AdminInteropPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { config, loading: configLoading } = usePlatformConfig();

  const [dhisLog, setDhisLog] = useState<Dhis2SyncLogDoc | null>(null);
  const [queue, setQueue] = useState<QueueHealth | null>(null);
  const [failedEvents, setFailedEvents] = useState<SyncEventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [log, stats, allEvents] = await Promise.all([
        getDhis2SyncLog(),
        getSyncEventStats(),
        findByType<SyncEventDoc>(syncEventsDB(), 'sync_event'),
      ]);
      setDhisLog(log);
      setQueue({ total: stats.total, pending: stats.pending, failed: stats.failed, newestEvent: stats.newestEvent });
      setFailedEvents(
        allEvents
          .filter(e => e.syncStatus === 'failed')
          .sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || ''))
          .slice(0, 50)
      );
    } catch (err) {
      console.error('Failed to load interop data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRetryBatch = async () => {
    setRetrying(true);
    try {
      const result = await pushPendingToCountryNode(50);
      if (result.skipped) {
        showToast('Country-node sync is not configured on this facility (SYNC_PUSH_URL unset) — no retry attempted.', 'error');
      } else if (result.error) {
        showToast(`Retry push failed: ${result.error}`, 'error');
      } else {
        showToast(`Retry batch: pushed ${result.pushed}, acknowledged ${result.acknowledged}.`, 'success');
      }
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Retry failed.', 'error');
    } finally {
      setRetrying(false);
    }
  };

  const dhisConfigured = isDhis2Configured();
  const dhisHost = getDhis2BaseUrlHost();
  const dhisSynced = dhisLog ? isFullySynced(dhisLog) : false;
  const dhisTone = !dhisConfigured ? 'muted' : dhisSynced ? 'ok' : 'warn';
  const dhisLabel = !dhisConfigured ? 'Not configured' : dhisSynced ? 'Synced' : 'Configured, awaiting sync';
  const dhisLastActivity = dhisLog ? formatWhen(dhisLog.lastSyncedAt || dhisLog.lastAttemptAt) : '—';

  const queueTone = !queue || queue.total === 0 ? 'muted' : queue.failed > 0 ? 'danger' : queue.pending > 0 ? 'warn' : 'ok';
  const queueLabel = !queue || queue.total === 0
    ? 'No events yet'
    : queue.failed > 0
      ? `${queue.failed} failed`
      : queue.pending > 0
        ? `${queue.pending} pending`
        : 'Drained';

  const apiKeysEnabled = !!config?.superAdminPolicies?.apiKeysEnabled;

  const entries = dhisLog?.entries ?? [];

  return (
    <SaPage title="Interoperability" subtitle="Integration endpoints, DHIS2 push history, and code mappings actually shipped in this build.">
      <SaCard title="Integration endpoints" meta={loading || configLoading ? 'Loading…' : undefined}>
        <SaTable columns={['Endpoint', 'Kind', 'Target', 'Status', 'Last activity']} minWidth={720}>
          <tr>
            <td><strong>DHIS2 export</strong></td>
            <td>Aggregate export</td>
            <td>{dhisHost || 'Not configured'}</td>
            <td><SaStatusDot tone={dhisTone} label={dhisLabel} /></td>
            <td>{dhisLastActivity}</td>
          </tr>
          <tr>
            <td><strong>Country-node replication</strong></td>
            <td>Document sync</td>
            <td>Local outbox → country node</td>
            <td><SaStatusDot tone={queueTone} label={queueLabel} /></td>
            <td>{queue ? formatWhen(queue.newestEvent) : '—'}</td>
          </tr>
          <tr>
            <td><strong>API keys</strong></td>
            <td>REST API</td>
            <td>Platform REST endpoints</td>
            <td><SaStatusDot tone={apiKeysEnabled ? 'ok' : 'muted'} label={apiKeysEnabled ? 'Enabled by policy' : 'Disabled by policy'} /></td>
            <td>—</td>
          </tr>
        </SaTable>
        <div className="sa-kv">
          <div className="sa-kv-row">
            <span>FHIR endpoints</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontWeight: 600 }}>None registered</span>
          </div>
          <div className="sa-kv-row">
            <span>Webhooks</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontWeight: 600 }}>None registered</span>
          </div>
        </div>
      </SaCard>

      <SaCard title="DHIS2 push log" meta={loading ? undefined : `${entries.length} entries`}>
        <SaTable
          columns={['When', 'Dataset', 'Period', 'Result', 'Detail']}
          empty={loading ? 'Loading…' : 'No DHIS2 push attempts recorded yet.'}
          minWidth={680}
        >
          {entries.map((e, i) => (
            <tr key={`${e.time}-${i}`}>
              <td>{formatWhen(e.time)}</td>
              <td>DHIS2 export</td>
              <td>{i === 0 && dhisLog?.lastDataset ? dhisLog.lastDataset.period : '—'}</td>
              <td><SaPill tone={RESULT_TONE[e.status] || 'muted'}>{e.status}</SaPill></td>
              <td>{e.message}</td>
            </tr>
          ))}
        </SaTable>
      </SaCard>

      <SaCard
        title="Failed pushes & retry"
        meta={loading ? undefined : `${failedEvents.length} shown${failedEvents.length === 50 ? ' (capped at 50)' : ''}`}
        actions={
          <button type="button" className="sa-btn" disabled={retrying} onClick={handleRetryBatch}>
            <RefreshCw className="w-3.5 h-3.5" />
            {retrying ? 'Retrying…' : 'Retry batch'}
          </button>
        }
      >
        <SaTable
          columns={['When', 'Resource', 'Operation', 'Error']}
          empty={loading ? 'Loading…' : 'No failed pushes.'}
          minWidth={620}
        >
          {failedEvents.map(ev => (
            <tr key={ev._id}>
              <td>{formatWhen(ev.occurredAt)}</td>
              <td><strong>{ev.resourceType}</strong> <span style={{ color: 'var(--text-muted)' }}>{ev.resourceId.slice(0, 12)}</span></td>
              <td>{ev.operation}</td>
              <td>{ev.syncError || '—'}</td>
            </tr>
          ))}
        </SaTable>
      </SaCard>

      <SaCard
        title="Terminology & code mappings"
        actions={
          <button type="button" className="sa-btn" onClick={() => router.push('/dhis2-export')}>
            Open DHIS2 export
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="sa-kv">
          <div className="sa-kv-row">
            <span>ICD-11 reference set</span>
            <span style={{ fontFamily: 'inherit', fontWeight: 600 }}>Bundled client-side (icd11-codes.ts) for diagnosis coding</span>
          </div>
          <div className="sa-kv-row">
            <span>DHIS2 data-element mappings</span>
            <span style={{ fontFamily: 'inherit', fontWeight: 600 }}>
              Facility &amp; workforce, births/deaths (CRVS), laboratory, pharmacy, immunizations, ANC, disease surveillance, data quality
            </span>
          </div>
        </div>
      </SaCard>
    </SaPage>
  );
}
