/**
 * Email provider contract.
 *
 * Deliberately the same shape as `lib/sms/provider.ts`: the platform talks to
 * mail gateways through this interface so a deployment can pick SendGrid,
 * Resend, SMTP, or a no-op stub via env (`EMAIL_PROVIDER=sendgrid|resend|smtp|
 * log`) without changes to callers.
 *
 * Note: the provider *credentials* only exist server-side, so a call made from
 * the browser resolves to the no-op and logs the intended send. That mirrors
 * how SMS already behaves here — the surrounding pipeline (delivery status on
 * the document, audit, sync) keeps working without credentials.
 */

export interface EmailSendInput {
  /** Recipient address. */
  to: string;
  subject: string;
  /** Plain-text body. Providers that require HTML wrap it. */
  body: string;
  /** Optional sender. Falls back to FROM_EMAIL, then a platform default. */
  from?: string;
}

export interface EmailSendResult {
  ok: boolean;
  providerId: string;
  providerMessageId?: string;
  error?: string;
}

export interface EmailProvider {
  name: string;
  send(input: EmailSendInput): Promise<EmailSendResult>;
}
