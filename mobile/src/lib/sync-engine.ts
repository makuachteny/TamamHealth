/**
 * Sync engine — pushes local changes to the platform API and pulls
 * remote updates into SQLite.
 *
 * Strategy:
 *   PUSH  — drain the sync_queue (local creates/updates → API POST/PATCH).
 *   PULL  — fetch each patient-portal endpoint and upsert into SQLite.
 *
 * Conflict resolution: server-wins for pull data.  Locally-created
 * records (synced=0) are protected from overwrites until pushed.
 */

import {
  getPendingSyncItems,
  markSyncItemDone,
  markSyncItemFailed,
  markRecordSynced,
  getSyncQueueCount,
  setLastSyncTime,
  getLastSyncTime,
  upsertMedicalRecords,
  upsertLabResults,
  upsertPrescriptions,
  upsertAppointments,
  upsertImmunizations,
  upsertMessages,
  upsertPayments,
  upsertCharges,
} from './database';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Set this to your platform's base URL.
 * In production, load from an env config or secure store.
 */
let _apiBaseUrl = '';
let _authToken = '';

export function configureSyncEngine(opts: { apiBaseUrl: string; authToken: string }) {
  _apiBaseUrl = opts.apiBaseUrl.replace(/\/$/, '');
  _authToken = opts.authToken;
}

export function updateAuthToken(token: string) {
  _authToken = token;
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ..._authToken ? { Authorization: `Bearer ${_authToken}` } : {},
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncState = 'idle' | 'pushing' | 'pulling' | 'error' | 'offline' | 'disabled';

export type SyncResult = {
  pushed: number;
  pushErrors: number;
  pulled: number;
  pullErrors: number;
  timestamp: string;
};

type SyncListener = (state: SyncState, result?: SyncResult) => void;

const listeners = new Set<SyncListener>();

export function addSyncListener(fn: SyncListener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(state: SyncState, result?: SyncResult) {
  listeners.forEach((fn) => fn(state, result));
}

// ---------------------------------------------------------------------------
// Endpoint mapping for PUSH
// ---------------------------------------------------------------------------

const PUSH_ENDPOINTS: Record<string, string> = {
  appointments: '/api/patient-portal/appointments',
  payments: '/api/patient-portal/payments',
  messages: '/api/patient-portal/messages',
};

// ---------------------------------------------------------------------------
// PUSH — drain the sync queue
// ---------------------------------------------------------------------------

async function pushChanges(): Promise<{ pushed: number; errors: number }> {
  const items = await getPendingSyncItems();
  let pushed = 0;
  let errors = 0;

  for (const item of items) {
    const endpoint = PUSH_ENDPOINTS[item.tableName];
    if (!endpoint) {
      // No push endpoint for this table (e.g. read-only data)
      await markSyncItemDone(item.id);
      pushed++;
      continue;
    }

    try {
      const url = `${_apiBaseUrl}${endpoint}`;
      const method = item.action === 'create' ? 'POST' : item.action === 'update' ? 'PATCH' : 'DELETE';

      const res = await fetch(url, {
        method,
        headers: headers(),
        body: method !== 'DELETE' ? JSON.stringify(item.payload) : undefined,
      });

      if (res.ok) {
        await markSyncItemDone(item.id);
        await markRecordSynced(item.tableName, item.recordId);
        pushed++;
      } else if (res.status === 409) {
        // Conflict — server has a newer version.  Accept server version
        // on next pull and discard local change.
        await markSyncItemDone(item.id);
        pushed++;
      } else {
        const text = await res.text().catch(() => 'unknown');
        await markSyncItemFailed(item.id, `HTTP ${res.status}: ${text}`);
        errors++;
      }
    } catch (err: any) {
      await markSyncItemFailed(item.id, err.message ?? 'network error');
      errors++;
    }
  }

  return { pushed, errors };
}

// ---------------------------------------------------------------------------
// PULL — fetch remote data and upsert into SQLite
// ---------------------------------------------------------------------------

type PullSpec = {
  endpoint: string;
  responseKey: string;
  upsert: (data: any[]) => Promise<number>;
};

const PULL_SPECS: PullSpec[] = [
  { endpoint: '/api/patient-portal/records', responseKey: 'records', upsert: upsertMedicalRecords },
  { endpoint: '/api/patient-portal/labs', responseKey: 'results', upsert: upsertLabResults },
  { endpoint: '/api/patient-portal/prescriptions', responseKey: 'prescriptions', upsert: upsertPrescriptions },
  { endpoint: '/api/patient-portal/appointments', responseKey: 'appointments', upsert: upsertAppointments },
  { endpoint: '/api/patient-portal/immunizations', responseKey: 'immunizations', upsert: upsertImmunizations },
  { endpoint: '/api/patient-portal/messages', responseKey: 'messages', upsert: upsertMessages },
];

async function pullChanges(): Promise<{ pulled: number; errors: number }> {
  if (!_apiBaseUrl || !_authToken) return { pulled: 0, errors: 0 };

  let pulled = 0;
  let errors = 0;

  for (const spec of PULL_SPECS) {
    try {
      const res = await fetch(`${_apiBaseUrl}${spec.endpoint}`, {
        method: 'GET',
        headers: headers(),
      });

      if (!res.ok) {
        errors++;
        continue;
      }

      const json = await res.json();
      const data = json[spec.responseKey];
      if (Array.isArray(data) && data.length > 0) {
        const count = await spec.upsert(data);
        pulled += count;
      }
    } catch {
      errors++;
    }
  }

  // Also pull billing (payments + charges)
  try {
    const res = await fetch(`${_apiBaseUrl}/api/patient-portal/billing`, {
      method: 'GET',
      headers: headers(),
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.payments)) {
        pulled += await upsertPayments(json.payments);
      }
      if (Array.isArray(json.charges)) {
        pulled += await upsertCharges(json.charges);
      }
    }
  } catch {
    errors++;
  }

  return { pulled, errors };
}

// ---------------------------------------------------------------------------
// Full sync cycle
// ---------------------------------------------------------------------------

let _syncing = false;

export async function syncNow(isOnline: boolean): Promise<SyncResult> {
  if (_syncing) return { pushed: 0, pushErrors: 0, pulled: 0, pullErrors: 0, timestamp: new Date().toISOString() };

  if (!isOnline) {
    notify('offline');
    return { pushed: 0, pushErrors: 0, pulled: 0, pullErrors: 0, timestamp: new Date().toISOString() };
  }

  if (!_apiBaseUrl) {
    notify('disabled');
    return { pushed: 0, pushErrors: 0, pulled: 0, pullErrors: 0, timestamp: new Date().toISOString() };
  }

  _syncing = true;

  let push = { pushed: 0, errors: 0 };
  let pull = { pulled: 0, errors: 0 };

  try {
    // 1. Push local changes first
    notify('pushing');
    push = await pushChanges();

    // 2. Pull remote updates
    notify('pulling');
    pull = await pullChanges();
  } catch {
    // Partial failure — still record what we managed to do
  }

  const timestamp = new Date().toISOString();
  try { await setLastSyncTime(timestamp); } catch { /* non-fatal */ }

  const result: SyncResult = {
    pushed: push.pushed,
    pushErrors: push.errors,
    pulled: pull.pulled,
    pullErrors: pull.errors,
    timestamp,
  };

  const hasErrors = push.errors > 0 || pull.errors > 0;
  notify(hasErrors ? 'error' : 'idle', result);
  _syncing = false;
  return result;
}

export { getSyncQueueCount, getLastSyncTime };
