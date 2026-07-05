/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for platform-config-service.ts
 * Covers platform configuration management and defaults.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-plat-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import {
  getPlatformConfig,
  updatePlatformConfig,
} from '@/lib/services/platform-config-service';

afterEach(async () => { await teardownTestDBs(); uuidCounter = 0; });

describe('Platform Config Service', () => {
  test('returns default config on first access', async () => {
    const config = await getPlatformConfig();

    expect(config).toBeDefined();
    expect(config._id).toBe('platform-config');
    expect(config.type).toBe('platform_config');
    expect(config.platformName).toBe('TamamHealth');
    expect(config.maintenanceMode).toBe(false);
    expect(config.defaultPrimaryColor).toBe('#2191D0');
    expect(config.defaultSecondaryColor).toBe('#015697');
  });

  test('default config has default feature flags', async () => {
    const config = await getPlatformConfig();

    expect(config.globalFeatureFlags).toBeDefined();
    expect(config.globalFeatureFlags.signupsEnabled).toBe(true);
    expect(config.globalFeatureFlags.trialDays).toBe(30);
    expect(config.globalFeatureFlags.maxOrganizations).toBe(100);
  });

  test('default config has timestamps', async () => {
    const config = await getPlatformConfig();

    expect(config.createdAt).toBeTruthy();
    expect(config.updatedAt).toBeTruthy();
    expect(config._rev).toBeTruthy();
  });

  test('returns same config on subsequent access', async () => {
    const config1 = await getPlatformConfig();
    const config2 = await getPlatformConfig();

    expect(config1._id).toBe(config2._id);
    expect(config1.createdAt).toBe(config2.createdAt);
  });

  test('updates maintenance mode', async () => {
    let config = await getPlatformConfig();
    expect(config.maintenanceMode).toBe(false);

    const updated = await updatePlatformConfig(
      { maintenanceMode: true },
      'admin-001',
      'admin'
    );

    expect(updated.maintenanceMode).toBe(true);

    // Verify persistence
    config = await getPlatformConfig();
    expect(config.maintenanceMode).toBe(true);
  });

  test('updates global feature flags', async () => {
    const updated = await updatePlatformConfig(
      {
        globalFeatureFlags: {
          signupsEnabled: false,
          trialDays: 14,
          maxOrganizations: 50,
        },
      },
      'admin-001',
      'admin'
    );

    expect(updated.globalFeatureFlags.signupsEnabled).toBe(false);
    expect(updated.globalFeatureFlags.trialDays).toBe(14);
    expect(updated.globalFeatureFlags.maxOrganizations).toBe(50);
  });

  test('updates primary and secondary colors', async () => {
    const updated = await updatePlatformConfig(
      {
        defaultPrimaryColor: '#FF0000',
        defaultSecondaryColor: '#00FF00',
      },
      'admin-001',
      'admin'
    );

    expect(updated.defaultPrimaryColor).toBe('#FF0000');
    expect(updated.defaultSecondaryColor).toBe('#00FF00');
  });

  test('preserves type and platform name on update', async () => {
    const updated = await updatePlatformConfig(
      {
        maintenanceMode: true,
      },
      'admin-001',
      'admin'
    );

    expect(updated.type).toBe('platform_config');
    expect(updated.platformName).toBe('TamamHealth');
    expect(updated._id).toBe('platform-config');
  });

  test('updates timestamps on config changes', async () => {
    const config1 = await getPlatformConfig();
    const originalUpdatedAt = config1.updatedAt;

    // Wait a tiny bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const config2 = await updatePlatformConfig(
      { maintenanceMode: true },
      'admin-001',
      'admin'
    );

    expect(config2.updatedAt).not.toBe(originalUpdatedAt);
    expect(config2.createdAt).toBe(config1.createdAt);
  });

  test('supports partial updates preserving existing config', async () => {
    // Get initial config
    let config = await getPlatformConfig();
    const initialTrial = config.globalFeatureFlags.trialDays;

    // Update only maintenance mode
    await updatePlatformConfig({ maintenanceMode: true }, 'admin-001', 'admin');

    // Verify other settings remain unchanged
    config = await getPlatformConfig();
    expect(config.maintenanceMode).toBe(true);
    expect(config.globalFeatureFlags.trialDays).toBe(initialTrial);
    expect(config.platformName).toBe('TamamHealth');
  });

  test('handles multiple sequential updates', async () => {
    const update1 = await updatePlatformConfig(
      { maintenanceMode: true },
      'admin-001',
      'admin'
    );
    expect(update1.maintenanceMode).toBe(true);

    const update2 = await updatePlatformConfig(
      { maintenanceMode: false },
      'admin-001',
      'admin'
    );
    expect(update2.maintenanceMode).toBe(false);

    const current = await getPlatformConfig();
    expect(current.maintenanceMode).toBe(false);
  });

  test('config has proper structure for feature flags nested object', async () => {
    const updated = await updatePlatformConfig(
      {
        globalFeatureFlags: {
          signupsEnabled: false,
          trialDays: 60,
          maxOrganizations: 200,
        },
      }
    );

    expect(typeof updated.globalFeatureFlags).toBe('object');
    expect(updated.globalFeatureFlags.signupsEnabled).toBe(false);
    expect(updated.globalFeatureFlags.trialDays).toBe(60);
    expect(updated.globalFeatureFlags.maxOrganizations).toBe(200);
  });

  test('idempotent color updates', async () => {
    const color1 = '#ABC123';
    const color2 = '#DEF456';

    const update1 = await updatePlatformConfig({
      defaultPrimaryColor: color1,
      defaultSecondaryColor: color2,
    });

    expect(update1.defaultPrimaryColor).toBe(color1);
    expect(update1.defaultSecondaryColor).toBe(color2);

    // Update again with same values
    const update2 = await updatePlatformConfig({
      defaultPrimaryColor: color1,
      defaultSecondaryColor: color2,
    });

    expect(update2.defaultPrimaryColor).toBe(color1);
    expect(update2.defaultSecondaryColor).toBe(color2);
  });
});
