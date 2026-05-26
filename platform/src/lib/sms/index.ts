import type { SmsProvider, SmsSendInput, SmsSendResult } from './provider';
import { noopProvider } from './noop-provider';
import { africasTalkingProvider } from './africas-talking-provider';
import { twilioProvider } from './twilio-provider';

let cached: SmsProvider | null = null;

/**
 * Resolve the configured SMS provider from `SMS_PROVIDER` env. Defaults to
 * the no-op so a deploy without credentials does not block the messaging UI.
 * The result is memoised; tests that need to swap providers must call
 * `resetSmsProviderForTest()`.
 */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const choice = (process.env.SMS_PROVIDER || 'noop').toLowerCase();
  switch (choice) {
    case 'africastalking':
    case 'africas-talking':
      cached = africasTalkingProvider;
      break;
    case 'twilio':
      cached = twilioProvider;
      break;
    default:
      cached = noopProvider;
  }
  return cached;
}

/** Test hook: clear the memoised provider so a new env value takes effect. */
export function resetSmsProviderForTest(): void {
  cached = null;
}

/**
 * Normalise a raw phone number to E.164.
 *
 * Defaults assume South Sudan (+211) since that is the platform's primary
 * deployment. Numbers that already have a country code (start with `+` or
 * `211`) are kept as-is; a leading `0` is treated as the SS trunk prefix
 * and rewritten. Everything else is prefixed with `+` and digits only.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('211')) return '+' + digits;
  if (digits.startsWith('0')) return '+211' + digits.slice(1);
  if (raw.startsWith('+')) return raw;
  return '+' + digits;
}

export async function sendSms(input: SmsSendInput): Promise<SmsSendResult> {
  const provider = getSmsProvider();
  const to = normalizePhone(input.to);
  return provider.send({ ...input, to });
}

export type { SmsProvider, SmsSendInput, SmsSendResult };
