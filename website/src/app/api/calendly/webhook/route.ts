import { NextRequest, NextResponse } from 'next/server';
import {
  escapeHtml,
  sendMarketingEmail,
  type EmailMessage,
} from '@/lib/email';
import { SUPPORT_EMAIL } from '@/lib/contact';

type CalendlyWebhookPayload = {
  event?: string;
  payload?: {
    name?: string;
    email?: string;
    timezone?: string;
    text_reminder_number?: string;
    event_type?: string;
    questions_and_answers?: Array<{
      question?: string;
      answer?: string;
    }>;
    scheduled_event?: {
      name?: string;
      start_time?: string;
      end_time?: string;
      location?: {
        type?: string;
        location?: string;
      };
    };
  };
};

async function sendEmail(to: string, subject: string, text: string, html?: string, replyTo?: string): Promise<boolean> {
  const msg: EmailMessage = { to, subject, text, html, replyTo };
  return sendMarketingEmail('calendly-webhook', msg, 'Tamam');
}

export async function POST(req: NextRequest) {
  const expectedToken = (process.env.CALENDLY_WEBHOOK_TOKEN || '').trim();
  const providedToken = req.nextUrl.searchParams.get('token') || req.headers.get('x-tamam-calendly-token') || '';

  if (expectedToken && providedToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CalendlyWebhookPayload;
  try {
    body = (await req.json()) as CalendlyWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const invitee = body.payload || {};
  const event = invitee.scheduled_event || {};
  const answers = invitee.questions_and_answers || [];
  const subject = `Calendly booking confirmed: ${invitee.name || 'New invitee'}`;
  const answerLines = answers.map((item) => `${item.question || 'Question'}: ${item.answer || ''}`);

  const text = [
    `Event: ${body.event || 'Calendly webhook'}`,
    `Name: ${invitee.name || ''}`,
    `Email: ${invitee.email || ''}`,
    invitee.text_reminder_number ? `Phone: ${invitee.text_reminder_number}` : null,
    invitee.timezone ? `Timezone: ${invitee.timezone}` : null,
    event.name ? `Meeting: ${event.name}` : null,
    event.start_time ? `Start: ${event.start_time}` : null,
    event.end_time ? `End: ${event.end_time}` : null,
    event.location?.location ? `Location: ${event.location.location}` : null,
    answerLines.length ? ['', 'Questions:', ...answerLines] : null,
  ].flat().filter(Boolean).join('\n');

  const html = `
    <h2>Calendly booking confirmed</h2>
    <p><strong>Event:</strong> ${escapeHtml(body.event || 'Calendly webhook')}</p>
    <p><strong>Name:</strong> ${escapeHtml(invitee.name || '')}</p>
    <p><strong>Email:</strong> ${escapeHtml(invitee.email || '')}</p>
    ${invitee.text_reminder_number ? `<p><strong>Phone:</strong> ${escapeHtml(invitee.text_reminder_number)}</p>` : ''}
    ${invitee.timezone ? `<p><strong>Timezone:</strong> ${escapeHtml(invitee.timezone)}</p>` : ''}
    ${event.name ? `<p><strong>Meeting:</strong> ${escapeHtml(event.name)}</p>` : ''}
    ${event.start_time ? `<p><strong>Start:</strong> ${escapeHtml(event.start_time)}</p>` : ''}
    ${event.end_time ? `<p><strong>End:</strong> ${escapeHtml(event.end_time)}</p>` : ''}
    ${event.location?.location ? `<p><strong>Location:</strong> ${escapeHtml(event.location.location)}</p>` : ''}
    ${answerLines.length ? `<hr/><p>${escapeHtml(answerLines.join('\n')).replace(/\n/g, '<br/>')}</p>` : ''}
  `;

  await sendEmail(SUPPORT_EMAIL, subject, text, html, invitee.email);

  return NextResponse.json({ ok: true });
}
