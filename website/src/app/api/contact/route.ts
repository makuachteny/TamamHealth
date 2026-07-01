import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';
import { createIpRateLimiter } from '@/lib/rate-limit';
import {
  escapeHtml,
  isSafeHeaderValue,
  isValidEmail,
  sendMarketingEmail,
  type EmailMessage,
} from '@/lib/email';

type ContactRequest = {
  name: string;
  email: string;
  facility?: string;
  role?: string;
  intent?: string;
  phone?: string;
  location?: string;
  source?: string;
  subject: string;
  message: string;
};

const isRateLimited = createIpRateLimiter(60 * 60 * 1000, 5);

/**
 * Returns `true` if the email was actually sent, `false` if no email
 * provider is configured (gracefully degrades — the request is still
 * accepted, we just skip the email). Throws only on a provider-level
 * error so the route can decide whether to return 500.
 */
async function sendEmail(to: string, subject: string, text: string, html?: string, replyTo?: string): Promise<boolean> {
  const msg: EmailMessage = { to, subject, text, html, replyTo };
  return sendMarketingEmail('contact', msg, 'Tamam');
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
      intent: (body.intent || '').trim().slice(0, 100),
      phone: (body.phone || '').trim().slice(0, 80),
      location: (body.location || '').trim().slice(0, 160),
      source: (body.source || '').trim().slice(0, 140),
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
    if (
      (contact.phone && !isSafeHeaderValue(contact.phone)) ||
      (contact.intent && !isSafeHeaderValue(contact.intent)) ||
      (contact.source && !isSafeHeaderValue(contact.source))
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // DEMO_NOTIFY_EMAIL must be configured by the operator — never fall back
    // to a hardcoded personal address. If unset, we still confirm to the
    // requester but log a warning rather than emailing nobody.
    const notifyTo = (process.env.DEMO_NOTIFY_EMAIL || '').trim();
    const notifySubject = `Contact Form: ${contact.subject} — ${contact.name}`;
    const notifyText = [
      `Name: ${contact.name}`,
      `Email: ${contact.email}`,
      contact.facility ? `Facility: ${contact.facility}` : null,
      contact.role ? `Role: ${contact.role}` : null,
      contact.intent ? `Intent: ${contact.intent}` : null,
      contact.phone ? `Phone: ${contact.phone}` : null,
      contact.location ? `Location: ${contact.location}` : null,
      contact.source ? `Source: ${contact.source}` : null,
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
      ${contact.intent ? `<p><strong>Intent:</strong> ${escapeHtml(contact.intent)}</p>` : ''}
      ${contact.phone ? `<p><strong>Phone:</strong> ${escapeHtml(contact.phone)}</p>` : ''}
      ${contact.location ? `<p><strong>Location:</strong> ${escapeHtml(contact.location)}</p>` : ''}
      ${contact.source ? `<p><strong>Source:</strong> ${escapeHtml(contact.source)}</p>` : ''}
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <hr/>
      <p>${safeMessage.replace(/\n/g, '<br/>')}</p>
    `;

    // Send notification email (skip if no notify recipient is configured).
    if (notifyTo) {
      await sendEmail(notifyTo, notifySubject, notifyText, notifyHtml, contact.email);
    } else {
      console.warn('[contact] DEMO_NOTIFY_EMAIL not set — admin notification skipped for', contact.email);
    }

    // Send confirmation to requester
    const confirmText = [
      `Hi ${contact.name},`,
      '',
      `Thank you for reaching out to Tamam. We've received your message and will get back to you within 4 business hours.`,
      '',
      'Best regards,',
      'The Tamam Team',
    ].join('\n');
    const confirmHtml = `
      <p>Hi ${safeName},</p>
      <p>Thank you for reaching out to Tamam. We've received your message and will get back to you within 4 business hours.</p>
      <p>Best regards,<br/>The Tamam Team</p>
    `;
    await sendEmail(contact.email, 'We received your message — Tamam', confirmText, confirmHtml);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 }
    );
  }
}
