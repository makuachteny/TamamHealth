/**
 * SMS provider contract.
 *
 * The platform talks to SMS gateways through this interface so individual
 * deployments can pick Africa's Talking, Twilio, or a no-op stub via env
 * (`SMS_PROVIDER=africastalking|twilio|noop`) without changes to callers.
 */

/**
 * Which messaging channel to use. Both ride the same provider API at Twilio —
 * WhatsApp is the same Messages endpoint with a `whatsapp:` prefix on the
 * addresses — so this is a per-send choice rather than a second provider.
 */
export type SmsChannel = 'sms' | 'whatsapp';

export interface SmsSendInput {
  /** Recipient phone. E.164 preferred; provider may normalize. */
  to: string;
  /**
   * Delivery channel. Defaults to 'sms'. Callers pick per patient: reception
   * records a phone, a WhatsApp number, or both, and the message follows
   * whichever the patient actually uses.
   */
  channel?: SmsChannel;
  /** Message text. Providers may split long bodies into segments. */
  body: string;
  /** Optional sender ID / from-number. Falls back to env when omitted. */
  sender?: string;
}

export interface SmsSendResult {
  ok: boolean;
  providerId: string;
  providerMessageId?: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}
