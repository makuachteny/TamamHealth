import { platformConfigDB } from '../db';
import type { PlatformConfigDoc } from '../db-types';

const CONFIG_ID = 'platform-config';

const DEFAULT_CONFIG: Omit<PlatformConfigDoc, '_id' | '_rev' | 'createdAt' | 'updatedAt'> = {
  type: 'platform_config',
  platformName: 'TamamHealth',
  maintenanceMode: false,
  globalFeatureFlags: {
    signupsEnabled: true,
    trialDays: 30,
    maxOrganizations: 100,
  },
  defaultPrimaryColor: '#2191D0',
  defaultSecondaryColor: '#1E40AF',
};

export async function getPlatformConfig(): Promise<PlatformConfigDoc> {
  const db = platformConfigDB();
  try {
    return await db.get(CONFIG_ID) as PlatformConfigDoc;
  } catch {
    // Create default config if it doesn't exist
    const now = new Date().toISOString();
    const doc: PlatformConfigDoc = {
      ...DEFAULT_CONFIG,
      _id: CONFIG_ID,
      createdAt: now,
      updatedAt: now,
    };
    const resp = await db.put(doc);
    doc._rev = resp.rev;
    return doc;
  }
}

export async function updatePlatformConfig(
  data: Partial<Omit<PlatformConfigDoc, '_id' | '_rev' | 'type' | 'createdAt'>>,
  actorId?: string,
  actorUsername?: string
): Promise<PlatformConfigDoc> {
  const db = platformConfigDB();
  const existing = await getPlatformConfig();

  const updated: PlatformConfigDoc = {
    ...existing,
    ...data,
    _id: existing._id,
    _rev: existing._rev,
    updatedAt: new Date().toISOString(),
  };

  const resp = await db.put(updated);
  updated._rev = resp.rev;
  const { logAudit } = await import('./audit-service');
  await logAudit('platform_config_updated', actorId, actorUsername, 'Updated platform configuration', true);
  return updated;
}
