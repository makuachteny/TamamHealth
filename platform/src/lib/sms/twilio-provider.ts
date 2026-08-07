import type { SmsProvider, SmsSendInput, SmsSendResult } from './provider';

/**
 * Twilio SMS provider.
 *
 * Docs: https://www.twilio.com/docs/sms/api/message-resource
 *
 * Auth is HTTP Basic with `AccountSid:AuthToken`. Credentials are read at
 * send-time so missing env never crashes the server — the send just returns
 * `ok: false, error: 'credentials_missing'`.
 */
export const twilioProvider: SmsProvider = {
  name: 'twilio',
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    // WhatsApp sends from a WhatsApp-enabled sender, which is a different
    // number from the SMS long code on most accounts — fall back to the SMS
    // one so a single-number account still works.
    const whatsapp = input.channel === 'whatsapp';
    const from = input.sender
      || (whatsapp ? process.env.TWILIO_WHATSAPP_FROM : undefined)
      || process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return {
        ok: false,
        providerId: 'twilio',
        error: 'credentials_missing',
      };
    }

    // Same Messages endpoint for both channels; WhatsApp is addressed by
    // prefixing both ends. Prefixes are not doubled if the caller already
    // supplied them.
    const address = (raw: string) =>
      whatsapp && !raw.startsWith('whatsapp:') ? `whatsapp:${raw}` : raw;

    const form = new URLSearchParams();
    form.set('To', address(input.to));
    form.set('From', address(from));
    form.set('Body', input.body);

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });

      const json = await res.json().catch(() => null) as
        | { sid?: string; status?: string; error_code?: number; message?: string }
        | null;

      if (!res.ok) {
        return {
          ok: false,
          providerId: 'twilio',
          providerMessageId: json?.sid,
          error: json?.message || `http_${res.status}`,
        };
      }

      // Twilio returns "queued"/"sending"/"sent" on the green path; "failed"
      // and "undelivered" are terminal failures.
      const status = json?.status;
      if (status === 'failed' || status === 'undelivered') {
        return {
          ok: false,
          providerId: 'twilio',
          providerMessageId: json?.sid,
          error: status,
        };
      }

      return {
        ok: true,
        providerId: 'twilio',
        providerMessageId: json?.sid,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        providerId: 'twilio',
        error: `network_error: ${message}`,
      };
    }
  },
};
