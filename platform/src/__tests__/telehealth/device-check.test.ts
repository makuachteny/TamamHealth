/**
 * Pre-visit device check (KAN-124).
 *
 * The point of this step is that a patient learns *which* problem they have.
 * "Could not access your camera" loses the consultation to something one
 * sentence of instruction would have fixed, so these tests pin the mapping
 * from DOMException name → cause → remedy.
 */

import {
  detectBrowser,
  describeFailure,
  runDeviceCheck,
  stopStream,
} from '@/lib/telehealth-device-check';

describe('detectBrowser', () => {
  test.each([
    ['Chrome on Android', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36', 'chrome'],
    ['Chrome on iOS (CriOS)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) CriOS/120.0 Mobile/15E148 Safari/604.1', 'chrome'],
    ['Edge', 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0', 'chrome'],
    ['Firefox', 'Mozilla/5.0 (Windows NT 10.0; rv:121.0) Gecko/20100101 Firefox/121.0', 'firefox'],
    ['Firefox on iOS (FxiOS)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) FxiOS/121.0 Mobile/15E148 Safari/605.1.15', 'firefox'],
    ['Safari on iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', 'safari'],
    ['unknown', 'SomeEmbeddedBrowser/1.0', 'other'],
  ])('%s', (_label, ua, expected) => {
    expect(detectBrowser(ua)).toBe(expected);
  });

  test('Chrome is not misread as Safari despite carrying "Safari" in its UA', () => {
    expect(detectBrowser('Mozilla/5.0 AppleWebKit/537.36 Chrome/120.0 Safari/537.36')).toBe('chrome');
  });
});

describe('describeFailure', () => {
  test('a denied permission points at the browser-specific control', () => {
    expect(describeFailure('denied', 'chrome', true).remedy).toMatch(/address bar|site settings/i);
    expect(describeFailure('denied', 'safari', true).remedy).toMatch(/settings/i);
    expect(describeFailure('denied', 'firefox', true).remedy).toMatch(/padlock/i);
  });

  test('a missing camera offers audio-only rather than a dead end', () => {
    expect(describeFailure('not_found', 'chrome', true).remedy).toMatch(/audio only/i);
  });

  test('a missing microphone does NOT offer audio-only', () => {
    // There is nothing to fall back to; suggesting it would be nonsense.
    const r = describeFailure('not_found', 'chrome', false);
    expect(r.remedy).not.toMatch(/audio only/i);
    expect(r.remedy).toMatch(/phone consultation|headset/i);
  });

  test('a device held by another app says to close it', () => {
    expect(describeFailure('in_use', 'chrome', true).remedy).toMatch(/close/i);
  });

  test('an insecure context is distinguished from an old browser', () => {
    expect(describeFailure('insecure', 'chrome', true).remedy).toMatch(/https/i);
    expect(describeFailure('unsupported', 'other', true).remedy).not.toMatch(/https/i);
  });

  test('every failure produces both a cause and a remedy', () => {
    for (const f of ['denied', 'not_found', 'in_use', 'insecure', 'unsupported', 'unknown'] as const) {
      const r = describeFailure(f, 'chrome', true);
      expect(r.message.length).toBeGreaterThan(0);
      expect(r.remedy.length).toBeGreaterThan(0);
    }
  });
});

describe('runDeviceCheck', () => {
  const originalNavigator = global.navigator;

  function withMedia(getUserMedia: unknown) {
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Chrome/120.0 Safari/537.36', mediaDevices: getUserMedia ? { getUserMedia } : undefined },
      configurable: true,
      writable: true,
    });
  }

  afterEach(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, configurable: true, writable: true });
  });

  test('returns the stream on success', async () => {
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    withMedia(jest.fn().mockResolvedValue(stream));
    const r = await runDeviceCheck({ video: true });
    expect(r.ok).toBe(true);
    expect(r.stream).toBe(stream);
    expect(r.failure).toBeNull();
  });

  test('requests audio with video when video is wanted', async () => {
    const gum = jest.fn().mockResolvedValue({ getTracks: () => [] });
    withMedia(gum);
    await runDeviceCheck({ video: true });
    expect(gum).toHaveBeenCalledWith({ audio: true, video: true });
  });

  test('requests audio only when video is not wanted', async () => {
    const gum = jest.fn().mockResolvedValue({ getTracks: () => [] });
    withMedia(gum);
    await runDeviceCheck({ video: false });
    expect(gum).toHaveBeenCalledWith({ audio: true, video: false });
  });

  test.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not_found'],
    ['OverconstrainedError', 'not_found'],
    ['NotReadableError', 'in_use'],
    ['AbortError', 'in_use'],
    ['WeirdNewError', 'unknown'],
  ])('classifies %s as %s', async (name, expected) => {
    const err = new Error('boom');
    err.name = name;
    withMedia(jest.fn().mockRejectedValue(err));
    const r = await runDeviceCheck({ video: true });
    expect(r.ok).toBe(false);
    expect(r.failure).toBe(expected);
    expect(r.remedy.length).toBeGreaterThan(0);
  });

  test('reports an unsupported browser when mediaDevices is absent', async () => {
    withMedia(undefined);
    const r = await runDeviceCheck({ video: true });
    expect(r.ok).toBe(false);
    // jsdom reports a secure context, so this is the "old browser" branch.
    expect(['unsupported', 'insecure']).toContain(r.failure);
  });
});

describe('stopStream', () => {
  test('stops every track so the camera light goes out', () => {
    const stop = jest.fn();
    stopStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  test('tolerates null', () => {
    expect(() => stopStream(null)).not.toThrow();
  });
});
