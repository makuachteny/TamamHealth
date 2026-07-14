/**
 * Persisted DHIS2 sync state — replaces the fabricated per-dataset statuses
 * and "last synced: now" strings that used to live directly in the Settings
 * "Facility Sync" tab and the DHIS2 Export page.
 *
 * Storage: one singleton `dhis2-sync-log` doc in the existing
 * `tamamhealth_platform_config` database (same DB/pattern as
 * platform-config-service.ts — a fixed-id doc, not a growing collection).
 * Both pages read/write the same doc, so "last synced" and history are
 * consistent no matter which screen triggered the sync, and survive reload
 * (and replicate to other devices once online, like everything else in
 * PouchDB).
 */
import { platformConfigDB } from '../db';
import type { DHIS2DataSet, DHIS2DataValue, DHIS2PushResult } from './dhis2-export-service';

const DOC_ID = 'dhis2-sync-log';
const MAX_ENTRIES = 50;

export type Dhis2LogStatus = 'success' | 'error' | 'info';

export interface Dhis2LogEntry {
  /** ISO timestamp. */
  time: string;
  message: string;
  status: Dhis2LogStatus;
}

/** Snapshot of the facility-level values from the most recently generated export. */
export interface Dhis2DatasetSnapshot {
  period: string;
  orgUnit: string;
  generatedAt: string;
  /** Facility/summary-level values only (per-facility breakout rows excluded to keep the doc small). */
  dataValues: DHIS2DataValue[];
  totalValueCount: number;
}

export interface Dhis2SyncLogDoc {
  _id: string;
  _rev?: string;
  type: 'dhis2_sync_log';
  /** Set only when a push actually succeeded. */
  lastSyncedAt?: string;
  /** Set on every attempt, success or failure. */
  lastAttemptAt?: string;
  lastPush?: DHIS2PushResult;
  lastDataset?: Dhis2DatasetSnapshot;
  entries: Dhis2LogEntry[];
  updatedAt: string;
}

const EMPTY_LOG: Dhis2SyncLogDoc = {
  _id: DOC_ID,
  type: 'dhis2_sync_log',
  entries: [],
  updatedAt: new Date(0).toISOString(),
};

async function getDocOrNull(): Promise<Dhis2SyncLogDoc | null> {
  try {
    return await platformConfigDB().get(DOC_ID) as Dhis2SyncLogDoc;
  } catch {
    return null;
  }
}

/** Read the persisted sync log, or an empty/never-synced shape if none exists yet. */
export async function getDhis2SyncLog(): Promise<Dhis2SyncLogDoc> {
  const doc = await getDocOrNull();
  return doc ?? { ...EMPTY_LOG };
}

function statusFromPush(push: DHIS2PushResult): Dhis2LogStatus {
  return push.status === 'pushed' ? 'success' : push.status === 'failed' ? 'error' : 'info';
}

/** Append a log line without touching the last-sync/dataset state (e.g. "Sync starting…"). */
export async function appendDhis2LogEntry(message: string, status: Dhis2LogStatus = 'info'): Promise<Dhis2SyncLogDoc> {
  const db = platformConfigDB();
  const existing = await getDocOrNull();
  const now = new Date().toISOString();
  const entries = [{ time: now, message, status }, ...(existing?.entries ?? [])].slice(0, MAX_ENTRIES);
  const doc: Dhis2SyncLogDoc = {
    ...(existing ?? EMPTY_LOG),
    _id: DOC_ID,
    _rev: existing?._rev,
    type: 'dhis2_sync_log',
    entries,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  return doc;
}

/**
 * Record an attempt that failed BEFORE a real push result existed — e.g.
 * generateDHIS2Export() threw. Marks lastPush as failed and stamps
 * lastAttemptAt so the Settings/Export banners reflect the error instead of
 * showing a stale "synced" state from a previous success. lastSyncedAt and
 * lastDataset are intentionally preserved (the last *good* sync still stands).
 */
export async function recordDhis2SyncFailure(message: string): Promise<Dhis2SyncLogDoc> {
  const db = platformConfigDB();
  const existing = await getDocOrNull();
  const now = new Date().toISOString();
  const failedPush: DHIS2PushResult = { ok: false, status: 'failed', message };
  const entries = [{ time: now, message, status: 'error' as const }, ...(existing?.entries ?? [])].slice(0, MAX_ENTRIES);
  const doc: Dhis2SyncLogDoc = {
    ...(existing ?? EMPTY_LOG),
    _id: DOC_ID,
    _rev: existing?._rev,
    type: 'dhis2_sync_log',
    lastAttemptAt: now,
    lastPush: failedPush,
    entries,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  return doc;
}

/**
 * Record the outcome of a real generateDHIS2Export() + pushDataSetToDHIS2()
 * attempt. Always logs an entry and updates lastAttemptAt/lastPush/lastDataset;
 * only advances lastSyncedAt when the push actually succeeded.
 */
export async function recordDhis2SyncResult(params: {
  dataset: DHIS2DataSet;
  push: DHIS2PushResult;
  /** Override the log message shown for this attempt (defaults to push.message). */
  message?: string;
}): Promise<Dhis2SyncLogDoc> {
  const db = platformConfigDB();
  const existing = await getDocOrNull();
  const now = new Date().toISOString();
  const { dataset, push } = params;

  const entry: Dhis2LogEntry = { time: now, message: params.message ?? push.message, status: statusFromPush(push) };
  const entries = [entry, ...(existing?.entries ?? [])].slice(0, MAX_ENTRIES);

  // Per-facility breakout rows (FACILITY_BIRTHS/FACILITY_DEATHS, one pair per
  // hospital) carry a distinct orgUnit from the requested export scope —
  // exclude them from the persisted snapshot so the doc stays small and the
  // UI shows the facility/summary-level indicators that actually apply to
  // "this sync", not every hospital in the network.
  const summaryValues = dataset.dataValues.filter(v => v.orgUnit === dataset.orgUnit);

  const doc: Dhis2SyncLogDoc = {
    _id: DOC_ID,
    _rev: existing?._rev,
    type: 'dhis2_sync_log',
    lastAttemptAt: now,
    lastSyncedAt: push.status === 'pushed' ? now : existing?.lastSyncedAt,
    lastPush: push,
    lastDataset: {
      period: dataset.period,
      orgUnit: dataset.orgUnit,
      generatedAt: dataset.exportDate,
      dataValues: summaryValues,
      totalValueCount: dataset.dataValues.length,
    },
    entries,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  return doc;
}

/** True once a push has actually succeeded — used to decide "synced" vs "never synced" UI. */
export function isFullySynced(log: Dhis2SyncLogDoc): boolean {
  return !!log.lastPush && log.lastPush.status === 'pushed';
}

/** Whether NEXT_PUBLIC_DHIS2_BASE_URL is set — the only DHIS2 endpoint config visible client-side. */
export function isDhis2Configured(): boolean {
  return typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_DHIS2_BASE_URL;
}

export function getDhis2BaseUrlHost(): string | null {
  const url = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DHIS2_BASE_URL : undefined;
  if (!url) return null;
  try { return new URL(url).host; } catch { return url; }
}

export interface Dhis2ElementGroup {
  label: string;
  elements: DHIS2DataValue[];
}

// Maps the real internal dataElement codes emitted by generateDHIS2Export()
// into the human-readable groupings the Facility Sync / Data Elements UIs
// show. Every code below is one actually pushed by dhis2-export-service.ts —
// nothing here is invented data, only a display grouping for real codes.
const GROUP_RULES: { test: (dataElement: string) => boolean; label: string }[] = [
  { test: de => /^TOTAL_(HOSPITALS|PATIENTS|BEDS|DOCTORS|NURSES|CLINICAL_OFFICERS)$/.test(de), label: 'Facility & Workforce' },
  { test: de => /^(BIRTHS_|DEATHS_|MATERNAL_DEATHS|UNDER5_DEATHS|NEONATAL_DEATHS|DEATH_)/.test(de), label: 'Births & Deaths (CRVS)' },
  { test: de => de === 'ACTIVE_DISEASE_ALERTS' || de === 'TOTAL_REFERRALS', label: 'Disease Surveillance & Referrals' },
  { test: de => de.startsWith('LAB_'), label: 'Laboratory' },
  { test: de => de.startsWith('PRESCRIPTIONS_'), label: 'Pharmacy' },
  { test: de => de.startsWith('IMM_'), label: 'Immunizations' },
  { test: de => de.startsWith('ANC_'), label: 'Antenatal Care' },
  { test: de => /^(REPORTING_|DATA_QUALITY_SCORE|DHIS2_ADOPTION_RATE|FACILITIES_ASSESSED|HIS_WORKFORCE)/.test(de), label: 'Data Quality' },
];

/** Group a dataset's real dataValues into the display sections the UI renders. */
export function groupDhis2DataValues(values: DHIS2DataValue[]): Dhis2ElementGroup[] {
  const map = new Map<string, Dhis2ElementGroup>();
  for (const v of values) {
    const rule = GROUP_RULES.find(r => r.test(v.dataElement));
    const label = rule?.label ?? 'Other';
    if (!map.has(label)) map.set(label, { label, elements: [] });
    map.get(label)!.elements.push(v);
  }
  return [...map.values()];
}

/** Pull a single named metric's real value out of a dataset (e.g. REPORTING_COMPLETENESS). */
export function getMetric(values: DHIS2DataValue[] | undefined, dataElement: string): number | null {
  const v = values?.find(x => x.dataElement === dataElement);
  if (!v) return null;
  const n = Number(v.value);
  return Number.isFinite(n) ? n : null;
}
