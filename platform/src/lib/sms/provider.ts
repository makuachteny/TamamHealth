/**
 * SMS provider contract.
 *
 * The platform talks to SMS gateways through this interface so individual
 * deployments can pick Africa's Talking, Twilio, or a no-op stub via env
 * (`SMS_PROVIDER=africastalking|twilio|noop`) without changes to callers.
 */

export interface SmsSendInput {
  /** Recipient phone. E.164 preferred; provider may normalize. */
  to: string;
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
