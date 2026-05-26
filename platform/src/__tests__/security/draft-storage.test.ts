/**
 * Tests for the encrypted, ephemeral draft cache in lib/draft-storage.ts.
 *
 * Covers:
 *   - roundtrip save → load returns the same value
 *   - past-TTL drafts return null and are removed from storage
 *   - tampered ciphertext fails closed (decrypt error → null)
 *   - missing sessionStorage key → null (the per-tab key was lost)
 *   - dropAllDrafts removes only namespaced keys, leaves others alone
 *   - two distinct logical keys don't cross-contaminate
 *
 * jsdom provides window.localStorage / window.sessionStorage. The Web Crypto
 * subtle implementation comes from jest.setup.ts, which patches in Node's
 * webcrypto.
 */

import {
  saveDraft,
  loadDraft,
  dropDraft,
  dropAllDrafts,
  __INTERNAL__,
} from '@/lib/draft-storage';

const { STORAGE_PREFIX, SESSION_KEY_NAME, storageKey } = __INTERNAL__;

describe('draft-storage (AES-GCM, sessionStorage-pinned key)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('roundtrip: save then load returns the same value', async () => {
    const value = {
      chiefComplaint: 'fever 3 days',
      vitals: { temperature: '38.7', systolic: '120' },
      diagnoses: [{ code: 'B54', name: 'Malaria', type: 'primary' }],
    };
    await saveDraft('consultation:patient-42', value);
    const restored = await loadDraft<typeof value>('consultation:patient-42');
    expect(restored).toEqual(value);
  });

  it('persists ciphertext, not plaintext, in localStorage', async () => {
    const secret = 'CONFIDENTIAL_PHI_chief_complaint_42';
    await saveDraft('consultation:secret-test', { complaint: secret });

    // Walk every localStorage value and assert the secret string isn't visible.
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)!;
      const v = window.localStorage.getItem(k) ?? '';
      expect(v).not.toContain(secret);
    }
  });

  it('returns null and removes the entry when the draft is past TTL', async () => {
    const key = 'consultation:expiry-test';
    await saveDraft(key, { foo: 'bar' }, 50 /* ms */);

    // Confirm it's there before expiry.
    expect(await loadDraft(key)).toEqual({ foo: 'bar' });

    // Wait past the TTL.
    await new Promise(resolve => setTimeout(resolve, 75));

    expect(await loadDraft(key)).toBeNull();
    // And the storage entry is gone (lazy expiry).
    expect(window.localStorage.getItem(storageKey(key))).toBeNull();
  });

  it('returns null when the ciphertext is tampered with', async () => {
    const key = 'consultation:tamper-test';
    await saveDraft(key, { complaint: 'tampering victim' });

    const sk = storageKey(key);
    const raw = window.localStorage.getItem(sk);
    expect(raw).not.toBeNull();
    const record = JSON.parse(raw!) as { ciphertext: string };

    // Flip one base64 char near the middle of the ciphertext to corrupt the
    // auth-tag / data without breaking the envelope JSON.
    const ct = record.ciphertext;
    expect(ct.length).toBeGreaterThan(20);
    const mid = Math.floor(ct.length / 2);
    const replacement = ct[mid] === 'A' ? 'B' : 'A';
    record.ciphertext = ct.slice(0, mid) + replacement + ct.slice(mid + 1);
    window.localStorage.setItem(sk, JSON.stringify(record));

    expect(await loadDraft(key)).toBeNull();
  });

  it('returns null when the sessionStorage key is missing (lost the AES key)', async () => {
    const key = 'consultation:lost-key-test';
    await saveDraft(key, { complaint: 'will be unreadable' });

    // Simulate tab close / different tab — kill the per-tab key but leave
    // the encrypted draft in localStorage.
    window.sessionStorage.removeItem(SESSION_KEY_NAME);

    const restored = await loadDraft(key);
    expect(restored).toBeNull();
  });

  it('dropDraft removes a single key and leaves others alone', async () => {
    await saveDraft('consultation:p-A', { v: 1 });
    await saveDraft('consultation:p-B', { v: 2 });

    await dropDraft('consultation:p-A');

    expect(await loadDraft('consultation:p-A')).toBeNull();
    expect(await loadDraft('consultation:p-B')).toEqual({ v: 2 });
  });

  it('dropAllDrafts removes only namespaced keys, leaves other localStorage entries alone', async () => {
    await saveDraft('consultation:p-A', { v: 'A' });
    await saveDraft('consultation:p-B', { v: 'B' });

    // Unrelated app state under different keys — must survive.
    window.localStorage.setItem('tamamhealth-token', 'fake-jwt');
    window.localStorage.setItem('user-pref:theme', 'dark');

    await dropAllDrafts();

    // Every namespaced key gone.
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)!;
      expect(k.startsWith(STORAGE_PREFIX)).toBe(false);
    }
    // Unrelated keys preserved.
    expect(window.localStorage.getItem('tamamhealth-token')).toBe('fake-jwt');
    expect(window.localStorage.getItem('user-pref:theme')).toBe('dark');
    // The per-tab AES key was also wiped.
    expect(window.sessionStorage.getItem(SESSION_KEY_NAME)).toBeNull();
  });

  it('two distinct logical keys do not cross-contaminate', async () => {
    await saveDraft('consultation:patient-A', { who: 'Alice' });
    await saveDraft('consultation:patient-B', { who: 'Bob' });

    expect(await loadDraft('consultation:patient-A')).toEqual({ who: 'Alice' });
    expect(await loadDraft('consultation:patient-B')).toEqual({ who: 'Bob' });

    await dropDraft('consultation:patient-A');
    expect(await loadDraft('consultation:patient-A')).toBeNull();
    // B is untouched.
    expect(await loadDraft('consultation:patient-B')).toEqual({ who: 'Bob' });
  });

  it('loadDraft returns null for a key that was never saved', async () => {
    expect(await loadDraft('consultation:nonexistent')).toBeNull();
  });
});
