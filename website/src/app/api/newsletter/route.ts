import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/request-utils';
import { createIpRateLimiter } from '@/lib/rate-limit';
import { escapeHtml, isValidEmail, sendMarketingEmail, type EmailMessage } from '@/lib/email';

const isRateLimited = createIpRateLimiter(60 * 60 * 1000, 3);

/**
 * Returns `true` if the email was sent, `false` if no email provider is
 * configured (graceful degrade — the subscriber is still recorded in
 * server logs, we just skip the welcome email). Provider-level failures
 * still throw so the caller decides whether to surface a 500.
 */
async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const msg: EmailMessage = { to, subject, text, html };
  return sendMarketingEmail('newsletter', msg, 'TamamHealth');
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

    // Notify admin of new subscriber. DEMO_NOTIFY_EMAIL must be configured by
    // the operator — never fall back to a hardcoded personal address.
    const notifyTo = (process.env.DEMO_NOTIFY_EMAIL || '').trim();
    if (notifyTo) {
      await sendEmail(
        notifyTo,
        `New Newsletter Subscriber: ${email}`,
        `New newsletter subscriber: ${email}\n\nTimestamp: ${new Date().toISOString()}`,
        `<p><strong>New newsletter subscriber:</strong> ${escapeHtml(email)}</p><p>Timestamp: ${new Date().toISOString()}</p>`,
      );
    } else {
      console.warn('[newsletter] DEMO_NOTIFY_EMAIL not set — admin notification skipped for', email);
    }

    // Send welcome email to subscriber
    const welcomeText = [
      'Welcome to the TamamHealth newsletter!',
      '',
      "You'll receive updates about our platform, healthcare technology insights, and news from our team.",
      '',
      'Best regards,',
      'The TamamHealth Team',
    ].join('\n');
    const welcomeHtml = `
      <h2 style="color: #3B82F6;">Welcome to TamamHealth!</h2>
      <p>Thanks for subscribing to our newsletter. You'll receive updates about our platform, healthcare technology insights, and news from our team.</p>
      <p>Best regards,<br/>The TamamHealth Team</p>
    `;
    await sendEmail(email, 'Welcome to the TamamHealth Newsletter', welcomeText, welcomeHtml);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[newsletter]', err);
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    );
  }
}
