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
import { SUPPORT_EMAIL } from '@/lib/contact';
import { createCalendlySchedulingLink } from '@/lib/calendly';

type AppointmentRequest = {
  name: string;
  email: string;
  facility?: string;
  phone?: string;
  location?: string;
  selectedSlot?: string;
  selectedStartTime?: string;
  calendlySchedulingUrl?: string;
  source?: string;
  message?: string;
};

const isRateLimited = createIpRateLimiter(60 * 60 * 1000, 5);

async function sendEmail(to: string, subject: string, text: string, html?: string, replyTo?: string): Promise<boolean> {
  const msg: EmailMessage = { to, subject, text, html, replyTo };
  return sendMarketingEmail('appointment', msg, 'TamamHealth');
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many appointment requests. Please try again later.' },
        { status: 429 }
      );
    }

    let body: Partial<AppointmentRequest>;
    try {
      body = (await req.json()) as Partial<AppointmentRequest>;
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const appointment: AppointmentRequest = {
      name: (body.name || '').trim().slice(0, 200),
      email: (body.email || '').trim().slice(0, 320),
      facility: (body.facility || '').trim().slice(0, 200),
      phone: (body.phone || '').trim().slice(0, 80),
      location: (body.location || '').trim().slice(0, 160),
      selectedSlot: (body.selectedSlot || '').trim().slice(0, 160),
      selectedStartTime: (body.selectedStartTime || '').trim().slice(0, 120),
      calendlySchedulingUrl: (body.calendlySchedulingUrl || '').trim().slice(0, 600),
      source: (body.source || '').trim().slice(0, 140),
      message: (body.message || '').trim().slice(0, 3000),
    };

    if (!appointment.name || !appointment.email) {
      return NextResponse.json({ error: 'Missing required fields (name, email)' }, { status: 400 });
    }
    if (!isValidEmail(appointment.email) || !isSafeHeaderValue(appointment.email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (
      !isSafeHeaderValue(appointment.name) ||
      (appointment.phone && !isSafeHeaderValue(appointment.phone)) ||
      (appointment.source && !isSafeHeaderValue(appointment.source))
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    let schedulingUrl = appointment.calendlySchedulingUrl || '';
    let calendlyWarning = '';
    if (!schedulingUrl) {
      try {
        schedulingUrl = await createCalendlySchedulingLink();
      } catch (err) {
        calendlyWarning = err instanceof Error ? err.message : 'Unable to create Calendly scheduling link.';
        console.error('[appointment calendly]', err);
      }
    }

    const supportSubject = `Appointment request: ${appointment.name}${appointment.facility ? ` - ${appointment.facility}` : ''}`;
    const supportText = [
      `Name: ${appointment.name}`,
      `Email: ${appointment.email}`,
      appointment.phone ? `Phone: ${appointment.phone}` : null,
      appointment.facility ? `Facility: ${appointment.facility}` : null,
      appointment.location ? `Location: ${appointment.location}` : null,
      appointment.selectedSlot ? `Requested slot: ${appointment.selectedSlot}` : null,
      appointment.selectedStartTime ? `Requested start time: ${appointment.selectedStartTime}` : null,
      schedulingUrl ? `Calendly link: ${schedulingUrl}` : null,
      appointment.source ? `Source: ${appointment.source}` : null,
      calendlyWarning ? `Calendly warning: ${calendlyWarning}` : null,
      appointment.message ? ['', 'Message:', appointment.message] : null,
    ].flat().filter(Boolean).join('\n');

    const supportHtml = `
      <h2>New Appointment Request</h2>
      <p><strong>Name:</strong> ${escapeHtml(appointment.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(appointment.email)}</p>
      ${appointment.phone ? `<p><strong>Phone:</strong> ${escapeHtml(appointment.phone)}</p>` : ''}
      ${appointment.facility ? `<p><strong>Facility:</strong> ${escapeHtml(appointment.facility)}</p>` : ''}
      ${appointment.location ? `<p><strong>Location:</strong> ${escapeHtml(appointment.location)}</p>` : ''}
      ${appointment.selectedSlot ? `<p><strong>Requested slot:</strong> ${escapeHtml(appointment.selectedSlot)}</p>` : ''}
      ${appointment.selectedStartTime ? `<p><strong>Requested start time:</strong> ${escapeHtml(appointment.selectedStartTime)}</p>` : ''}
      ${schedulingUrl ? `<p><strong>Calendly link:</strong> <a href="${escapeHtml(schedulingUrl)}">${escapeHtml(schedulingUrl)}</a></p>` : ''}
      ${appointment.source ? `<p><strong>Source:</strong> ${escapeHtml(appointment.source)}</p>` : ''}
      ${calendlyWarning ? `<p><strong>Calendly warning:</strong> ${escapeHtml(calendlyWarning)}</p>` : ''}
      ${appointment.message ? `<hr/><p>${escapeHtml(appointment.message).replace(/\n/g, '<br/>')}</p>` : ''}
    `;

    await sendEmail(SUPPORT_EMAIL, supportSubject, supportText, supportHtml, appointment.email);

    const confirmText = [
      `Hi ${appointment.name},`,
      '',
      appointment.selectedSlot
        ? `We received your appointment request for ${appointment.selectedSlot}.`
        : 'We received your appointment request.',
      schedulingUrl ? `You can finish booking directly here: ${schedulingUrl}` : 'Our team will follow up with a calendar confirmation.',
      '',
      'Best regards,',
      'The TamamHealth Team',
    ].join('\n');
    const confirmHtml = `
      <p>Hi ${escapeHtml(appointment.name)},</p>
      <p>${appointment.selectedSlot ? `We received your appointment request for ${escapeHtml(appointment.selectedSlot)}.` : 'We received your appointment request.'}</p>
      ${schedulingUrl ? `<p>You can finish booking directly here: <a href="${escapeHtml(schedulingUrl)}">${escapeHtml(schedulingUrl)}</a></p>` : '<p>Our team will follow up with a calendar confirmation.</p>'}
      <p>Best regards,<br/>The TamamHealth Team</p>
    `;
    await sendEmail(appointment.email, 'Your TamamHealth appointment request', confirmText, confirmHtml);

    return NextResponse.json({
      ok: true,
      schedulingUrl,
      calendlyWarning: calendlyWarning || undefined,
    });
  } catch (err) {
    console.error('[appointment]', err);
    return NextResponse.json(
      { error: 'Failed to submit appointment request. Please try again.' },
      { status: 500 }
    );
  }
}
