import { isIdleExpired, IDLE_TIMEOUT_MS } from '@/lib/session-idle';

describe('isIdleExpired', () => {
  const now = 1_000_000_000_000;

  it('is not expired when the marker is missing (upgrade / first request)', () => {
    expect(isIdleExpired(undefined, now)).toBe(false);
  });

  it('is not expired when the marker is malformed', () => {
    expect(isIdleExpired('not-a-number', now)).toBe(false);
  });

  it('is not expired inside the idle window', () => {
    const lastActivity = now - (IDLE_TIMEOUT_MS - 1000);
    expect(isIdleExpired(String(lastActivity), now)).toBe(false);
  });

  it('is expired once the idle window has elapsed', () => {
    const lastActivity = now - (IDLE_TIMEOUT_MS + 1000);
    expect(isIdleExpired(String(lastActivity), now)).toBe(true);
  });

  it('is not expired exactly at the boundary', () => {
    const lastActivity = now - IDLE_TIMEOUT_MS;
    expect(isIdleExpired(String(lastActivity), now)).toBe(false);
  });
});
