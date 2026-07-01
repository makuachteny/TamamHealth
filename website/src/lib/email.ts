import { SUPPORT_EMAIL } from '@/lib/contact';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeHeaderValue(value: string): boolean {
  if (value.length > 320) return false;
  return !/[\r\n]/.test(value);
}

export function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value) && isSafeHeaderValue(value);
}

function getFromAddress(defaultName: string) {
  const fromEmail = process.env.DEMO_FROM_EMAIL || SUPPORT_EMAIL;
  const fromName = process.env.DEMO_FROM_NAME || defaultName;
  const resendFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  return { fromEmail, fromName, resendFrom };
}

async function sendWithResend(msg: EmailMessage, defaultFromName: string): Promise<void> {
  const { resendFrom } = getFromAddress(defaultFromName);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      reply_to: msg.replyTo,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend error ${res.status}: ${detail}`);
  }
}

async function sendWithSendGrid(msg: EmailMessage, defaultFromName: string): Promise<void> {
  const { fromEmail, fromName } = getFromAddress(defaultFromName);
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: msg.to }],
          ...(msg.replyTo ? { reply_to: { email: msg.replyTo } } : {}),
        },
      ],
      from: { email: fromEmail, name: fromName },
      subject: msg.subject,
      content: [
        { type: 'text/plain', value: msg.text },
        ...(msg.html ? [{ type: 'text/html', value: msg.html }] : []),
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${detail}`);
  }
}

export async function sendMarketingEmail(
  context: string,
  msg: EmailMessage,
  defaultFromName = 'Tamam',
): Promise<boolean> {
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(msg, defaultFromName);
    return true;
  }

  if (process.env.SENDGRID_API_KEY) {
    await sendWithSendGrid(msg, defaultFromName);
    return true;
  }

  console.warn(`[${context}] No email provider configured (RESEND_API_KEY / SENDGRID_API_KEY); skipping email to`, msg.to);
  return false;
}

