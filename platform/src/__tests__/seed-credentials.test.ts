/** @jest-environment node */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEMO_USER_PROFILES,
  _resetSeedCredentialsCache,
  getOrCreateSeedCredentials,
} from '@/lib/seed-credentials';

describe('seed credentials', () => {
  let tempDir: string;
  let credentialsPath: string;
  let logSpy: jest.SpyInstance;
  const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
  const originalCredentialsFile = process.env.SEED_CREDENTIALS_FILE;
  const originalAdminPassword = process.env.ADMIN_INITIAL_PASSWORD;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tamamhealth-seed-'));
    credentialsPath = path.join(tempDir, 'credentials.json');
    process.env.SEED_CREDENTIALS_FILE = credentialsPath;
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    delete process.env.ADMIN_INITIAL_PASSWORD;
    _resetSeedCredentialsCache();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    _resetSeedCredentialsCache();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  afterAll(() => {
    if (originalDemoMode === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
    if (originalCredentialsFile === undefined) delete process.env.SEED_CREDENTIALS_FILE;
    else process.env.SEED_CREDENTIALS_FILE = originalCredentialsFile;
    if (originalAdminPassword === undefined) delete process.env.ADMIN_INITIAL_PASSWORD;
    else process.env.ADMIN_INITIAL_PASSWORD = originalAdminPassword;
  });

  test('generates strong per-user passwords and prints each one only once', async () => {
    const first = await getOrCreateSeedCredentials();
    const passwords = Object.values(first.passwords);
    const legacyPassword = ['Dr.Wani@JTH', '2026'].join('');

    expect(Object.keys(first.passwords)).toHaveLength(DEMO_USER_PROFILES.length);
    expect(new Set(passwords).size).toBe(passwords.length);
    expect(passwords).not.toContain(legacyPassword);
    for (const password of passwords) expect(password).toHaveLength(24);

    const outputAfterGeneration = logSpy.mock.calls.flat().join('\n');
    for (const profile of DEMO_USER_PROFILES) {
      expect(outputAfterGeneration).toContain(profile.username);
      expect(outputAfterGeneration).toContain(first.passwords[profile.username]);
    }
    expect(outputAfterGeneration).toContain('will not be printed again');

    const callsAfterGeneration = logSpy.mock.calls.length;
    expect(await getOrCreateSeedCredentials()).toEqual(first);
    expect(logSpy).toHaveBeenCalledTimes(callsAfterGeneration);

    _resetSeedCredentialsCache();
    expect(await getOrCreateSeedCredentials()).toEqual(first);
    expect(logSpy).toHaveBeenCalledTimes(callsAfterGeneration);
    expect((await fs.stat(credentialsPath)).mode & 0o777).toBe(0o600);
  });

  test('creates different credentials for different installations', async () => {
    const first = await getOrCreateSeedCredentials();
    const secondPath = path.join(tempDir, 'second-install.json');

    process.env.SEED_CREDENTIALS_FILE = secondPath;
    _resetSeedCredentialsCache();
    const second = await getOrCreateSeedCredentials();

    expect(second.passwords['dr.wani']).not.toBe(first.passwords['dr.wani']);
  });

  test('does not print an operator-supplied production password', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    process.env.ADMIN_INITIAL_PASSWORD = 'operator-supplied-test-value';
    _resetSeedCredentialsCache();

    const credentials = await getOrCreateSeedCredentials();

    expect(credentials.passwords).toEqual({ admin: 'operator-supplied-test-value' });
    expect(logSpy).not.toHaveBeenCalled();
  });
});
