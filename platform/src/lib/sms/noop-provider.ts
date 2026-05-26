import type { SmsProvider, SmsSendInput, SmsSendResult } from './provider';

/**
 * Default provider used when `SMS_PROVIDER` is unset or set to `noop`.
 *
 * Logs the would-be send and returns success, so the rest of the messaging
 * pipeline (audit log, sync events, UI delivery status) keeps working in
 * environments without SMS credentials — e.g. local dev, CI, fresh deploys.
 */
export const noopProvider: SmsProvider = {
  name: 'noop',
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const preview = input.body.length > 60
      ? `${input.body.slice(0, 60)}...`
      : input.body;
    console.warn(`[sms:noop] would send to ${input.to}: ${preview}`);
    return { ok: true, providerId: 'noop' };
  },
};
