import type { SmsProvider, SmsSendInput, SmsSendResult } from './provider';

/**
 * Africa's Talking SMS provider.
 *
 * Docs: https://developers.africastalking.com/docs/sms/sending/v1
 *
 * Auth is `apiKey` header + `username` form field. Credentials are read at
 * send-time (not module load) so a missing key never crashes the server on
 * boot — instead the send returns `ok: false, error: 'credentials_missing'`
 * and the caller can decide whether to fall back to in-app delivery.
 */
export const africasTalkingProvider: SmsProvider = {
  name: 'africastalking',
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const username = process.env.AFRICAS_TALKING_USERNAME;
    const apiKey = process.env.AFRICAS_TALKING_API_KEY;
    const senderId = input.sender || process.env.AFRICAS_TALKING_SENDER_ID;

    if (!username || !apiKey) {
      return {
        ok: false,
        providerId: 'africastalking',
        error: 'credentials_missing',
      };
    }

    const form = new URLSearchParams();
    form.set('username', username);
    form.set('to', input.to);
    form.set('message', input.body);
    if (senderId) form.set('from', senderId);

    try {
      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': apiKey,
        },
        body: form.toString(),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          ok: false,
          providerId: 'africastalking',
          error: `http_${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        };
      }

      const json = await res.json().catch(() => null) as
        | { SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string; statusCode?: number }> } }
        | null;

      const recipient = json?.SMSMessageData?.Recipients?.[0];
      // AT returns per-recipient status. "Success" is the green path; anything
      // else (InsufficientBalance, UserInBlacklist, InvalidPhoneNumber, etc.)
      // means the message will not be delivered, so surface it as a failure.
      if (recipient && recipient.status && recipient.status !== 'Success') {
        return {
          ok: false,
          providerId: 'africastalking',
          providerMessageId: recipient.messageId,
          error: recipient.status,
        };
      }

      return {
        ok: true,
        providerId: 'africastalking',
        providerMessageId: recipient?.messageId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        providerId: 'africastalking',
        error: `network_error: ${message}`,
      };
    }
  },
};
