/**
 * Central-provisioning contract for user mutations.
 *
 * In a real browser, createUser/updateUser/resetPassword/deactivateUser must
 * go through POST /api/users (the central CouchDB write path) and must NOT
 * write to the browser-local PouchDB: the users database replicates PULL-ONLY,
 * so a local write produces an account that can never authenticate on the
 * server or any other device.
 *
 * The service gates on JEST_WORKER_ID (tests exercise the server/DB path by
 * default); these tests remove the guard to simulate the browser runtime.
 */
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

const apiFetchMock = jest.fn();
jest.mock('@/lib/api-fetch', () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }));

import { usersDB } from '@/lib/db';
import {
  createUser, updateUser, resetPassword, deactivateUser,
} from '@/lib/services/user-service';

const savedWorkerId = process.env.JEST_WORKER_ID;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  apiFetchMock.mockReset();
  // Simulate the browser runtime: jsdom provides `window`; removing the Jest
  // worker guard flips isBrowserRuntime() to true.
  delete process.env.JEST_WORKER_ID;
});

afterEach(() => {
  process.env.JEST_WORKER_ID = savedWorkerId;
});

describe('browser-side user mutations route through /api/users', () => {
  test('createUser POSTs to the API and returns the server doc', async () => {
    const serverUser = { _id: 'user-jane', type: 'user', username: 'jane', name: 'Jane', role: 'nurse', isActive: true };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ user: serverUser }, 201));

    const result = await createUser({
      username: 'jane', password: 'secret123', name: 'Jane', role: 'nurse',
      hospitalId: 'hosp-1', hospitalName: 'Juba Teaching Hospital', orgId: 'org-1',
    });

    expect(result).toEqual(serverUser);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = apiFetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/users');
    expect(opts.method).toBe('POST');
    const sent = JSON.parse(String(opts.body));
    expect(sent).toMatchObject({ username: 'jane', role: 'nurse', hospitalId: 'hosp-1' });

    // The whole point: nothing may be written to the local (pull-only) DB.
    const local = await usersDB().allDocs({ include_docs: true });
    expect(local.rows.filter((r: { id: string }) => r.id === 'user-jane')).toHaveLength(0);
  });

  test('createUser surfaces the server error (409 duplicate) verbatim', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Username "jane" already exists' }, 409));
    await expect(createUser({ username: 'jane', password: 'x', name: 'Jane', role: 'nurse' }))
      .rejects.toThrow('Username "jane" already exists');
  });

  test('createUser translates a network failure into an honest offline error', async () => {
    apiFetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(createUser({ username: 'jane', password: 'x', name: 'Jane', role: 'nurse' }))
      .rejects.toThrow(/managed centrally and require a connection/i);
    // No stranded local account on failure either.
    const local = await usersDB().allDocs({ include_docs: true });
    expect(local.rows).toHaveLength(0);
  });

  test('updateUser routes through the API with action=update', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ user: { _id: 'user-jane', name: 'Jane B' } }));
    const updated = await updateUser('user-jane', { name: 'Jane B' });
    expect(updated).toMatchObject({ name: 'Jane B' });
    const sent = JSON.parse(String((apiFetchMock.mock.calls[0][1] as RequestInit).body));
    expect(sent).toMatchObject({ action: 'update', userId: 'user-jane', name: 'Jane B' });
  });

  test('resetPassword routes through the API with action=reset_password', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await resetPassword('user-jane', 'newpass123');
    const sent = JSON.parse(String((apiFetchMock.mock.calls[0][1] as RequestInit).body));
    expect(sent).toEqual({ action: 'reset_password', userId: 'user-jane', newPassword: 'newpass123' });
  });

  test('deactivateUser routes through the API with action=deactivate', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await deactivateUser('user-jane');
    const sent = JSON.parse(String((apiFetchMock.mock.calls[0][1] as RequestInit).body));
    expect(sent).toEqual({ action: 'deactivate', userId: 'user-jane' });
  });
});
