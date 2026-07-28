/**
 * Backup status — one honest source (KAN-117).
 *
 * ## The problem this replaces
 *
 * Four admin surfaces — `/admin`, `/admin/security`, `/admin/risk` and the IT
 * operations panel — each read `localStorage.getItem('safeguard_last_backup')`
 * directly. **Nothing in the codebase ever wrote that key.** Backups run from a
 * GitHub Actions cron entirely outside the app, so the value could not exist.
 *
 * Worse, the four readers disagreed about what its absence meant:
 *   - `/admin` treated a missing value as `Infinity` hours old, and therefore
 *     reported the backup as definitively OVERDUE — a measured-sounding claim
 *     about something it had never measured.
 *   - `/admin/risk` returned `null` and dropped the backup risk row entirely,
 *     so the same missing data produced a clean bill of health.
 *
 * One of those fabricates a failure and the other fabricates a success, from
 * identical inputs. That is the specific defect this module exists to remove:
 * "unknown" is a real answer, and it is the only correct one until something
 * actually reports a backup.
 *
 * ## Design
 *
 * `state` is deliberately a three-way value, not a boolean. A boolean forces
 * every caller to fold "we don't know" into either "fine" or "broken", which is
 * how the divergence above happened in the first place.
 */

import { platformConfigDB } from '../db';
import type { PlatformConfigDoc } from '../db-types';

const CONFIG_ID = 'platform-config';

export type BackupState = 'ok' | 'overdue' | 'unknown';

export interface BackupStatus {
  state: BackupState;
  /** ISO timestamp of the last reported backup, or null when none has been. */
  lastBackupAt: string | null;
  /** Age in hours, or null when unknown — never Infinity. */
  ageHours: number | null;
  /** The RPO the state was judged against, for display alongside it. */
  rpoHours: number;
  /** Why the state is what it is, in words a reader can act on. */
  detail: string;
}

/**
 * Read the last reported backup.
 *
 * Stored on the platform config document rather than in a new database: it is a
 * single global operational fact, exactly like the policies already living
 * there, and it must be readable by the same admin screens.
 */
export async function getBackupStatus(rpoHoursOverride?: number): Promise<BackupStatus> {
  let config: PlatformConfigDoc | null = null;
  try {
    config = await platformConfigDB().get(CONFIG_ID) as PlatformConfigDoc;
  } catch {
    // No config document yet. That is not evidence of a backup failure — it is
    // the absence of evidence, which is what `unknown` is for.
    config = null;
  }

  const rpoHours = rpoHoursOverride ?? config?.superAdminPolicies?.backupRpoHours ?? 24;
  const lastBackupAt = config?.lastBackupAt ?? null;

  if (!lastBackupAt) {
    return {
      state: 'unknown',
      lastBackupAt: null,
      ageHours: null,
      rpoHours,
      detail: 'No backup has been reported to the platform yet.',
    };
  }

  const parsed = Date.parse(lastBackupAt);
  if (Number.isNaN(parsed)) {
    return {
      state: 'unknown',
      lastBackupAt,
      ageHours: null,
      rpoHours,
      detail: 'The last reported backup timestamp could not be read.',
    };
  }

  const ageHours = (Date.now() - parsed) / 3_600_000;
  const overdue = ageHours > rpoHours;
  return {
    state: overdue ? 'overdue' : 'ok',
    lastBackupAt,
    ageHours,
    rpoHours,
    detail: overdue
      ? `Last backup was ${Math.round(ageHours)}h ago, past the ${rpoHours}h objective.`
      : `Last backup was ${Math.round(ageHours)}h ago, within the ${rpoHours}h objective.`,
  };
}

/**
 * Record that a backup completed.
 *
 * This is the write path that never existed — without it the status can only
 * ever be `unknown`, which is honest but useless. The backup job calls this
 * (via the admin API) once it has actually finished, so the dashboards report
 * something that happened rather than something assumed.
 *
 * `completedAt` is a parameter rather than `now` because the job reports after
 * the fact, and the backup's own completion time is the meaningful one.
 */
export async function recordBackupCompleted(completedAt: string): Promise<void> {
  if (Number.isNaN(Date.parse(completedAt))) {
    throw new Error(`Invalid backup completion timestamp: ${completedAt}`);
  }

  const db = platformConfigDB();
  const now = new Date().toISOString();
  try {
    const existing = await db.get(CONFIG_ID) as PlatformConfigDoc;
    await db.put({ ...existing, lastBackupAt: completedAt, updatedAt: now });
  } catch {
    // No config document yet — reporting a backup should not require one to
    // have been created first.
    await db.put({
      _id: CONFIG_ID,
      type: 'platform_config',
      lastBackupAt: completedAt,
      createdAt: now,
      updatedAt: now,
    } as PlatformConfigDoc);
  }
}
