/**
 * @jest-environment jsdom
 */
import {
  track,
  flushUsageQueue,
  getOrCreateSessionId,
  setUsageIdentity,
  __test,
} from '@/lib/usage/tracker';

describe('usage tracker', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setUsageIdentity({ userId: 'u1', orgId: 'org1', role: 'doctor' });
    jest.restoreAllMocks();
  });

  test('getOrCreateSessionId is stable within a session', () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBe(b);
    expect(a.startsWith('sess-')).toBe(true);
  });

  test('track enqueues sanitized events and flush posts a batch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = fetchMock as unknown as typeof fetch;

    track('page_view', { path: '/patients/abc-12345' });
    track('click', { path: '/dashboard', element: 'nav.home' });

    const queued = __test.loadQueue();
    expect(queued.length).toBe(2);
    expect(queued[0].path).toBe('/patients/[id]');
    expect(queued[0].eventName).toBe('page_view');

    await flushUsageQueue();

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/usage/events');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.events).toHaveLength(2);
    expect(__test.loadQueue()).toHaveLength(0);
  });

  test('queue is capped at MAX_QUEUE', () => {
    for (let i = 0; i < __test.MAX_QUEUE + 50; i++) {
      track('click', { path: '/dashboard', element: `btn-${i}` });
    }
    expect(__test.loadQueue().length).toBeLessThanOrEqual(__test.MAX_QUEUE);
  });
});
