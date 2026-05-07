import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';

type ContactRequest = {
  name: string;
  email: string;
  facility?: string;
  role?: string;
  subject: string;
  message: string;
};

// Rate limit: 5 requests / hour / IP
const contactRateLimit: Record<string, { count: number; windowStart: number }> = {};
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = contactRateLimit[ip];
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    contactRateLimit[ip] = { count: 1, windowStart: now };
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHeaderValue(value: string): boolean {
  if (value.length > 320) return false;
  return !/[\r\n]/.test(value);
}

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

async function sendEmail(to: string, subject: string, text: string, html?: string, replyTo?: string) {
  if (process.env.RESEND_API_KEY) {
    const fromEmail = process.env.DEMO_FROM_EMAIL || 'noreply@tamamhealth.org';
    const fromName = process.env.DEMO_FROM_NAME || 'TamamHealth Health';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        text,
        html,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend error ${res.status}: ${detail}`);
    }
    return;
  }
  if (process.env.SENDGRID_API_KEY) {
    const fromEmail = process.env.DEMO_FROM_EMAIL || 'noreply@tamamhealth.org';
    const fromName = process.env.DEMO_FROM_NAME || 'TamamHealth Health';
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], ...(replyTo ? { reply_to: { email: replyTo } } : {}) }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          ...(html ? [{ type: 'text/html', value: html }] : []),
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`SendGrid error ${res.status}: ${detail}`);
    }
    return;
  }
  console.warn('[contact] No email provider configured (set RESEND_API_KEY or SENDGRID_API_KEY). Message:', { to, subject });
  throw new Error('Email service not configured. Please contact support.');
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    let body: Partial<ContactRequest>;
    try {
      body = (await req.json()) as Partial<ContactRequest>;
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const contact: ContactRequest = {
      name: (body.name || '').trim().slice(0, 200),
      email: (body.email || '').trim().slice(0, 320),
      facility: (body.facility || '').trim().slice(0, 200),
      role: (body.role || '').trim().slice(0, 100),
      subject: (body.subject || '').trim().slice(0, 300),
      message: (body.message || '').trim().slice(0, 5000),
    };

    if (!contact.name || !contact.email || !contact.subject || !contact.message) {
      return NextResponse.json({ error: 'Missing required fields (name, email, subject, message)' }, { status: 400 });
    }
    if (!isValidEmail(contact.email) || !isSafeHeaderValue(contact.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (!isSafeHeaderValue(contact.name)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const notifyTo = process.env.DEMO_NOTIFY_EMAIL || 'tenymakuach@gmail.com';
    const notifySubject = `Contact Form: ${contact.subject} — ${contact.name}`;
    const notifyText = [
      `Name: ${contact.name}`,
      `Email: ${contact.email}`,
      contact.facility ? `Facility: ${contact.facility}` : null,
      contact.role ? `Role: ${contact.role}` : null,
      `Subject: ${contact.subject}`,
      '',
      `Message:`,
      contact.message,
    ].filter(Boolean).join('\n');

    const safeName = escapeHtml(contact.name);
    const safeSubject = escapeHtml(contact.subject);
    const safeMessage = escapeHtml(contact.message);
    const notifyHtml = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${escapeHtml(contact.email)}</p>
      ${contact.facility ? `<p><strong>Facility:</strong> ${escapeHtml(contact.facility)}</p>` : ''}
      ${contact.role ? `<p><strong>Role:</strong> ${escapeHtml(contact.role)}</p>` : ''}
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <hr/>
      <p>${safeMessage.replace(/\n/g, '<br/>')}</p>
    `;

    // Send notification email
    await sendEmail(notifyTo, notifySubject, notifyText, notifyHtml, contact.email);

    // Send confirmation to requester
    const confirmText = [
      `Hi ${contact.name},`,
      '',
      `Thank you for reaching out to TamamHealth Health. We've received your message and will get back to you within 4 business hours.`,
      '',
      'Best regards,',
      'The TamamHealth Team',
    ].join('\n');
    const confirmHtml = `
      <p>Hi ${safeName},</p>
      <p>Thank you for reaching out to TamamHealth Health. We've received your message and will get back to you within 4 business hours.</p>
      <p>Best regards,<br/>The TamamHealth Team</p>
    `;
    await sendEmail(contact.email, 'We received your message — TamamHealth Health', confirmText, confirmHtml);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 }
    );
  }
}
