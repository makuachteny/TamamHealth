import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getClientIp } from '@/lib/request-utils';

type DemoRequest = {
  name: string;
  email: string;
  org: string;
  role: string;
  phone?: string;
  message?: string;
};

// Rate limit the public demo-request endpoint. Without this, an attacker
// could spam the form to burn our email-provider quota and flood the
// notification inbox. Simple per-IP sliding window, process-local.
const demoRateLimit: Record<string, { count: number; windowStart: number }> = {};
const DEMO_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEMO_RATE_MAX = 5;                     // 5 requests / hour / IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = demoRateLimit[ip];
  if (!entry || now - entry.windowStart > DEMO_RATE_WINDOW_MS) {
    demoRateLimit[ip] = { count: 1, windowStart: now };
    return false;
  }
  entry.count++;
  return entry.count > DEMO_RATE_MAX;
}

/**
 * Escape user-supplied text before interpolating into HTML email bodies.
 * Without this, a requester name like `<img src=x onerror=...>` would land
 * unescaped in the outbound HTML mail and execute in any client that
 * renders it.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Reject email addresses containing CRLF sequences — these are the primary
 * vector for SMTP header injection. We also cap length defensively so an
 * attacker can't stuff megabytes into a field.
 */
function isSafeHeaderValue(value: string): boolean {
  if (value.length > 320) return false;
  return !/[\r\n]/.test(value);
}

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

function isValidEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

function getFromAddress(): { fromEmail: string; fromName: string; resendFrom: string } {
  const fromEmail = process.env.DEMO_FROM_EMAIL;
  const fromName = process.env.DEMO_FROM_NAME || 'TamamHealth Demo';
  if (!fromEmail) {
    throw new Error('DEMO_FROM_EMAIL is not configured');
  }
  const resendFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  return { fromEmail, fromName, resendFrom };
}

async function sendWithResend(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  const { resendFrom } = getFromAddress();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

async function sendWithSendGrid(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is not configured');
  }
  const { fromEmail, fromName } = getFromAddress();
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: msg.to }],
          ...(msg.replyTo ? { reply_to: { email: msg.replyTo } } : {}),
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: msg.subject,
      content: [
        {
          type: 'text/plain',
          value: msg.text,
        },
        ...(msg.html ? [{ type: 'text/html', value: msg.html }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${detail}`);
  }
}

async function sendEmail(msg: EmailMessage): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(msg);
    return;
  }
  if (process.env.SENDGRID_API_KEY) {
    await sendWithSendGrid(msg);
    return;
  }
  throw new Error('No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY)');
}

function buildNotifyEmail(req: DemoRequest, requestId: string, scheduleUrl?: string): EmailMessage {
  const subject = `New Demo Request — ${req.name} (${req.org})`;
  const lines = [
    `Request ID: ${requestId}`,
    `Name: ${req.name}`,
    `Email: ${req.email}`,
    `Organization: ${req.org}`,
    `Role: ${req.role}`,
    req.phone ? `Phone: ${req.phone}` : null,
    req.message ? `Message: ${req.message}` : null,
    scheduleUrl ? `Scheduling: ${scheduleUrl}` : null,
  ].filter(Boolean) as string[];

  return {
    to: process.env.DEMO_NOTIFY_EMAIL || 'tenymakuach@gmail.com',
    subject,
    text: lines.join('\n'),
    replyTo: req.email,
  };
}

function buildRequesterEmail(req: DemoRequest, scheduleUrl?: string): EmailMessage {
  const subject = 'Your TamamHealth Demo Request';
  const textLines = [
    `Hi ${req.name},`,
    '',
    'Thanks for requesting a demo of TamamHealth. We will contact you within 24 hours.',
    scheduleUrl ? `You can schedule a time here: ${scheduleUrl}` : 'We will follow up shortly to schedule a time.',
    '',
    'Best,',
    'TamamHealth Team',
  ];

  // Escape every interpolated field so a poisoned `name` or `scheduleUrl`
  // cannot inject tags, scripts, or off-domain anchors into the email body.
  const safeName = escapeHtml(req.name);
  const safeSchedule = scheduleUrl ? escapeHtml(scheduleUrl) : null;
  const html = [
    `<p>Hi ${safeName},</p>`,
    '<p>Thanks for requesting a demo of TamamHealth. We will contact you within 24 hours.</p>',
    safeSchedule
      ? `<p>You can schedule a time here: <a href="${safeSchedule}">${safeSchedule}</a></p>`
      : '<p>We will follow up shortly to schedule a time.</p>',
    '<p>Best,<br/>TamamHealth Team</p>',
  ].join('');

  return {
    to: req.email,
    subject,
    text: textLines.join('\n'),
    html,
  };
}

export async function POST(req: NextRequest) {
  try {
    // Per-IP rate limit to stop abuse of the unauthenticated endpoint.
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    let body: Partial<DemoRequest>;
    try {
      body = (await req.json()) as Partial<DemoRequest>;
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const demo: DemoRequest = {
      name: (body.name || '').trim().slice(0, 200),
      email: (body.email || '').trim().slice(0, 320),
      org: (body.org || '').trim().slice(0, 200),
      role: (body.role || '').trim().slice(0, 100),
      phone: body.phone?.trim().slice(0, 40),
      message: body.message?.trim().slice(0, 2000),
    };

    if (!demo.name || !demo.email || !demo.org || !demo.role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!isValidEmail(demo.email) || !isSafeHeaderValue(demo.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    // Refuse CRLF in any free-text header-bound field (name/org) to block
    // SMTP header injection if a provider ever lifts these into headers.
    if (!isSafeHeaderValue(demo.name) || !isSafeHeaderValue(demo.org)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const requestId = randomUUID();
    const scheduleUrl = process.env.DEMO_SCHEDULING_URL;

    const notifyEmail = buildNotifyEmail(demo, requestId, scheduleUrl);
    const requesterEmail = buildRequesterEmail(demo, scheduleUrl);

    await sendEmail(notifyEmail);
    await sendEmail(requesterEmail);

    return NextResponse.json({
      ok: true,
      requestId,
      scheduleUrl: scheduleUrl || null,
    });
  } catch (err) {
    // Don't leak internal error details (API keys in stack traces, provider
    // responses, etc.) to an unauthenticated endpoint.
    console.error('[demo-request]', err);
    return NextResponse.json(
      { error: 'Failed to submit demo request' },
      { status: 500 }
    );
  }
}
