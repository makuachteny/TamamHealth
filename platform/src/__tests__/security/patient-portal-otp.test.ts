/**
 * Patient portal OTP second factor (KAN-76 / LOW-02).
 */
import {
  issueOtp,
  verifyOtp,
  otpEnabled,
  maskPhone,
  _resetOtpStoreForTest,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
} from '@/lib/patient-portal-otp';
// Mock the SMS layer rather than the provider registry: it lets a test force a
// delivery failure, which no configured provider can do on demand.
jest.mock('@/lib/sms', () => ({
  sendSms: jest.fn(async (input: { to: string; body: string }) => {
    smsOutbox.push(input);
    return smsResult;
  }),
}));

const smsOutbox: Array<{ to: string; body: string }> = [];
let smsResult: { ok: boolean; providerId: string; error?: string } = { ok: true, providerId: 'test' };

const ORIGINAL_ENV = { ...process.env };

/** Pull the code out of the last SMS the module tried to send. */
function lastCode(): string {
  const last = smsOutbox[smsOutbox.length - 1];
  if (!last) throw new Error('no SMS was sent');
  const m = /\b(\d{6})\b/.exec(last.body);
  if (!m) throw new Error(`no 6-digit code in SMS body: ${last.body}`);
  return m[1];
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  smsOutbox.length = 0;
  smsResult = { ok: true, providerId: 'test' };
  _resetOtpStoreForTest();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('otpEnabled', () => {
  test('defaults to off — a deployment without SMS must not lock patients out', () => {
    delete process.env.PATIENT_PORTAL_OTP_ENABLED;
    expect(otpEnabled()).toBe(false);
    process.env.PATIENT_PORTAL_OTP_ENABLED = 'false';
    expect(otpEnabled()).toBe(false);
    process.env.PATIENT_PORTAL_OTP_ENABLED = 'true';
    expect(otpEnabled()).toBe(true);
  });
});

describe('maskPhone', () => {
  test('reveals only the tail', () => {
    expect(maskPhone('+211912345678')).toBe('+211*****5678');
    expect(maskPhone('123')).toBe('****');
  });
});

describe('issueOtp', () => {
  test('sends a 6-digit code and returns the masked number', async () => {
    const r = await issueOtp('pat-001', '+211912345678');
    expect(r.ok).toBe(true);
    expect(r.maskedPhone).toBe('+211*****5678');
    expect(lastCode()).toMatch(/^\d{6}$/);
    expect(smsOutbox[0].to).toBe('+211912345678');
  });

  test('refuses when the patient has no number on file', async () => {
    const r = await issueOtp('pat-001', '');
    expect(r).toEqual({ ok: false, error: 'no-phone' });
  });

  test('fails closed and destroys the challenge when delivery fails', async () => {
    // A code nobody received is not a second factor — and leaving it live only
    // widens the guessing window.
    smsResult = { ok: false, providerId: 'test', error: 'gateway down' };
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const r = await issueOtp('pat-fail', '+211912345678');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('delivery-failed');
    // No live challenge left behind.
    expect(await verifyOtp('pat-fail', '000000')).toEqual({ ok: false, reason: 'no-challenge' });
    errSpy.mockRestore();
  });
});

describe('verifyOtp', () => {
  test('accepts the correct code', async () => {
    await issueOtp('pat-001', '+211912345678');
    const code = lastCode();
    expect(await verifyOtp('pat-001', code)).toEqual({ ok: true });
  });

  test('a code is single-use — it cannot be replayed', async () => {
    await issueOtp('pat-001', '+211912345678');
    const code = lastCode();
    expect(await verifyOtp('pat-001', code)).toEqual({ ok: true });
    expect(await verifyOtp('pat-001', code)).toEqual({ ok: false, reason: 'no-challenge' });
  });

  test('rejects a wrong code', async () => {
    await issueOtp('pat-001', '+211912345678');
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    expect(await verifyOtp('pat-001', wrong)).toEqual({ ok: false, reason: 'mismatch' });
  });

  test('burns the challenge after the attempt cap', async () => {
    // 10^6 of keyspace is brute-forceable without a cap.
    await issueOtp('pat-001', '+211912345678');
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
      expect(await verifyOtp('pat-001', wrong)).toEqual({ ok: false, reason: 'mismatch' });
    }
    expect(await verifyOtp('pat-001', wrong)).toEqual({ ok: false, reason: 'too-many-attempts' });

    // Even the CORRECT code no longer works — the challenge is gone.
    expect(await verifyOtp('pat-001', code)).toEqual({ ok: false, reason: 'no-challenge' });
  });

  test('expires after the TTL', async () => {
    jest.useFakeTimers();
    try {
      await issueOtp('pat-001', '+211912345678');
      const code = lastCode();
      jest.advanceTimersByTime((OTP_TTL_SECONDS + 1) * 1000);
      // Asserts the security property, not the label: past the TTL the code
      // must not work. The in-memory store evicts on read and reports
      // 'no-challenge'; the Upstash store lets Redis TTL do it and can report
      // either. Both are correct — pinning one would make the test fail on a
      // backend swap that changed nothing a caller can observe.
      const verdict = await verifyOtp('pat-001', code);
      expect(verdict.ok).toBe(false);
      expect(['expired', 'no-challenge']).toContain((verdict as { reason: string }).reason);
    } finally {
      jest.useRealTimers();
    }
  });

  test('reports no-challenge for a patient who never started one', async () => {
    expect(await verifyOtp('pat-nobody', '123456')).toEqual({ ok: false, reason: 'no-challenge' });
  });

  test("one patient's code does not unlock another patient", async () => {
    await issueOtp('pat-A', '+211912345678');
    const codeA = lastCode();
    await issueOtp('pat-B', '+211912345679');

    expect(await verifyOtp('pat-B', codeA)).toEqual({ ok: false, reason: 'mismatch' });
  });
});
