import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';

// Rate limit: 3 subscribes / hour / IP
const rateLimit: Record<string, { count: number; windowStart: number }> = {};
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit[ip];
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimit[ip] = { count: 1, windowStart: now };
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value) && value.length <= 320 && !/[\r\n]/.test(value);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail(to: string, subject: string, text: string, html?: string) {
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
        personalizations: [{ to: [{ email: to }] }],
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
  console.warn('[newsletter] No email provider configured (set RESEND_API_KEY or SENDGRID_API_KEY). Subscriber:', to);
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

    let body: { email?: string };
    try {
      body = (await req.json()) as { email?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const email = (body.email || '').trim();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Notify admin of new subscriber
    const notifyTo = process.env.DEMO_NOTIFY_EMAIL || 'tenymakuach@gmail.com';
    await sendEmail(
      notifyTo,
      `New Newsletter Subscriber: ${email}`,
      `New newsletter subscriber: ${email}\n\nTimestamp: ${new Date().toISOString()}`,
      `<p><strong>New newsletter subscriber:</strong> ${escapeHtml(email)}</p><p>Timestamp: ${new Date().toISOString()}</p>`,
    );

    // Send welcome email to subscriber
    const welcomeText = [
      'Welcome to the TamamHealth Health newsletter!',
      '',
      "You'll receive updates about our platform, healthcare technology insights, and news from our team.",
      '',
      'Best regards,',
      'The TamamHealth Team',
    ].join('\n');
    const welcomeHtml = `
      <h2 style="color: #2D9B6A;">Welcome to TamamHealth Health!</h2>
      <p>Thanks for subscribing to our newsletter. You'll receive updates about our platform, healthcare technology insights, and news from our team.</p>
      <p>Best regards,<br/>The TamamHealth Team</p>
    `;
    await sendEmail(email, 'Welcome to the TamamHealth Health Newsletter', welcomeText, welcomeHtml);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[newsletter]', err);
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    );
  }
}
