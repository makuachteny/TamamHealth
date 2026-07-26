/**
 * System Administration config — per-organization overrides for the
 * apps/extensions/global-properties registry (src/lib/admin/system-admin-registry.ts).
 *
 * The registry is the shipped DEFAULT catalog (what apps/extensions exist,
 * their default enabled/disabled state, and each global property's default
 * value). This service stores the org's OVERRIDES on top of those defaults —
 * a toggle flipped off, a property edited — in one doc per organization.
 *
 * Storage: reuses the already-synced, org-scoped `tamamhealth_hospitals`
 * database (same trick as facility-settings.ts: a distinctly-typed doc
 * living alongside `hospital` docs needs no new sync-config entry, no new
 * CouchDB security-role wiring, and replicates to every device in the org
 * for free). Doc id is `system-config:<orgId>` so it never collides with a
 * `hosp-*` hospital doc or a `facility_settings:<hospitalId>` doc.
 */
import { hospitalsDB } from '../db';
import type { BaseDoc } from '../db-types';
import { logAuditSafe } from './audit-service';

export interface SystemConfigDoc extends BaseDoc {
  type: 'system_config';
  orgId: string;
  /** appId -> enabled override (absent = use the registry default). */
  appOverrides: Record<string, boolean>;
  /** extensionId -> enabled override (absent = use the registry default). */
  extensionOverrides: Record<string, boolean>;
  /** globalPropertyId (also reused for a few "configurable" app/extension
   *  notes that have no dedicated settings page) -> current string value
   *  override (absent = use the registry default/currentValue). */
  propertyOverrides: Record<string, string>;
}

function systemConfigId(orgId: string): string {
  return `system-config:${orgId}`;
}

function emptyConfig(orgId: string): SystemConfigDoc {
  const now = new Date().toISOString();
  return {
    _id: systemConfigId(orgId),
    type: 'system_config',
    orgId,
    appOverrides: {},
    extensionOverrides: {},
    propertyOverrides: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Read the org's config doc, or a fresh (unsaved) empty one if none exists yet. */
export async function getSystemConfig(orgId: string): Promise<SystemConfigDoc> {
  if (!orgId) return emptyConfig('');
  try {
    const doc = await hospitalsDB().get(systemConfigId(orgId)) as SystemConfigDoc;
    // Defensive defaults in case an older doc predates one of the maps.
    return {
      ...doc,
      appOverrides: doc.appOverrides || {},
      extensionOverrides: doc.extensionOverrides || {},
      propertyOverrides: doc.propertyOverrides || {},
    };
  } catch {
    return emptyConfig(orgId);
  }
}

async function saveSystemConfig(
  orgId: string,
  patch: Partial<Pick<SystemConfigDoc, 'appOverrides' | 'extensionOverrides' | 'propertyOverrides'>>,
  actorId: string | undefined,
  actorUsername: string | undefined,
  auditDetail: string,
): Promise<SystemConfigDoc> {
  const db = hospitalsDB();
  const existing = await getSystemConfig(orgId);
  const now = new Date().toISOString();
  const updated: SystemConfigDoc = {
    ...existing,
    appOverrides: { ...existing.appOverrides, ...(patch.appOverrides || {}) },
    extensionOverrides: { ...existing.extensionOverrides, ...(patch.extensionOverrides || {}) },
    propertyOverrides: { ...existing.propertyOverrides, ...(patch.propertyOverrides || {}) },
    updatedAt: now,
  };
  const resp = await db.put(updated);
  updated._rev = resp.rev;
  await logAuditSafe('system_config_updated', actorId, actorUsername, auditDetail);
  return updated;
}

/** Flip an app's enabled/disabled state for this org. Persists immediately. */
export async function setAppEnabled(
  orgId: string,
  appId: string,
  enabled: boolean,
  actorId?: string,
  actorUsername?: string,
): Promise<SystemConfigDoc> {
  return saveSystemConfig(
    orgId,
    { appOverrides: { [appId]: enabled } },
    actorId, actorUsername,
    `${enabled ? 'Enabled' : 'Disabled'} app "${appId}"`,
  );
}

/** Flip an extension's enabled/disabled state for this org. Persists immediately. */
export async function setExtensionEnabled(
  orgId: string,
  extensionId: string,
  enabled: boolean,
  actorId?: string,
  actorUsername?: string,
): Promise<SystemConfigDoc> {
  return saveSystemConfig(
    orgId,
    { extensionOverrides: { [extensionId]: enabled } },
    actorId, actorUsername,
    `${enabled ? 'Enabled' : 'Disabled'} extension "${extensionId}"`,
  );
}

/** Set the current value of a global property (or a "configurable" item's
 *  inline note) for this org. Persists immediately. */
export async function setPropertyValue(
  orgId: string,
  propertyId: string,
  value: string,
  actorId?: string,
  actorUsername?: string,
): Promise<SystemConfigDoc> {
  return saveSystemConfig(
    orgId,
    { propertyOverrides: { [propertyId]: value } },
    actorId, actorUsername,
    `Updated property "${propertyId}"`,
  );
}
