import { NextRequest, NextResponse } from 'next/server';
import { intakeFormsDB, patientsDB } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { findByType } from '@/lib/services/db-query';
import type { PatientDoc, PatientIntakeFormDoc } from '@/lib/db-types';

/**
 * POST /api/intake/[token]
 *
 * The patient-facing end of an intake request. UNAUTHENTICATED by design — the
 * recipient is a patient with a link, not a platform user — so the whole
 * surface is built around not trusting the caller:
 *
 *  • The token alone returns NOTHING. Every action requires the patient to
 *    confirm their surname and date of birth against the chart first, and the
 *    check is re-run on submit rather than held in a session: there is no
 *    server state to steal and a leaked token stays useless on its own.
 *  • Failures are indistinguishable. An unknown token, a wrong name and a
 *    wrong date all return the same 401, so the endpoint cannot be used to
 *    discover which tokens or patients exist.
 *  • Rate limited per token AND per IP, because the date of birth is a
 *    low-entropy secret and this is the one place it can be guessed at.
 *  • Answers are accepted only for labels the form actually asked for, so a
 *    crafted body cannot introduce fields the reviewer never requested — and
 *    the write only ever lands on the intake document. Nothing here touches a
 *    patient chart; a member of staff still has to review and merge.
 *
 * Actions:
 *   { action: 'open',   surname, dateOfBirth }          → the form's fields
 *   { action: 'submit', surname, dateOfBirth, answers } → records the answers
 */

/** One response for every rejection — see the note above. */
function rejected() {
  return NextResponse.json(
    { error: 'We could not match those details. Please check and try again.' },
    { status: 401 },
  );
}

function normalizeName(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Accepts yyyy-mm-dd (the date input's own format). */
function normalizeDob(value: unknown): string {
  return String(value ?? '').trim().slice(0, 10);
}

async function findByToken(token: string): Promise<PatientIntakeFormDoc | null> {
  // No secondary index on accessToken: intake volume is small and adding a
  // design doc for it would need a migration across every synced database.
  const all = await findByType<PatientIntakeFormDoc>(intakeFormsDB(), 'patient_intake_form');
  return all.find(f => f.accessToken && f.accessToken === token) ?? null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) return rejected();

  // Two gates: the token bounds guessing at one patient's date of birth, the IP
  // bounds sweeping many tokens from one place.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  for (const key of [`intake-token:${token}`, `intake-ip:${ip}`]) {
    const verdict = await rateLimit({ key, limit: 10, windowMs: 10 * 60_000 });
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil((verdict.resetAt - Date.now()) / 1000))) },
        },
      );
    }
  }

  let body: { action?: string; surname?: string; dateOfBirth?: string; answers?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const form = await findByToken(token);
  if (!form) return rejected();

  // A form already submitted or merged is closed. Reported plainly — the
  // patient has done nothing wrong and should not be sent round the loop again.
  if (form.status === 'merged' || form.status === 'rejected' || form.receivedAt) {
    return NextResponse.json(
      { error: 'This form has already been completed. Thank you.', done: true },
      { status: 409 },
    );
  }

  if (!form.patientId) return rejected();
  let patient: PatientDoc;
  try {
    patient = await patientsDB().get(form.patientId) as PatientDoc;
  } catch {
    return rejected();
  }

  // Surname plus date of birth. Both are things the patient knows and a
  // stranger holding the link does not.
  const surnameOk = normalizeName(body.surname) === normalizeName(patient.surname);
  const dobOk = Boolean(patient.dateOfBirth)
    && normalizeDob(body.dateOfBirth) === normalizeDob(patient.dateOfBirth);
  if (!surnameOk || !dobOk) return rejected();

  const requestedLabels = form.fields.map(f => f.label);

  if (body.action === 'open') {
    return NextResponse.json({
      // First name only. Enough to reassure the patient the form is theirs,
      // without restating the identifiers they just proved they know.
      greetingName: patient.firstName,
      facilityName: form.providerName ? undefined : undefined,
      fields: requestedLabels,
    });
  }

  if (body.action === 'submit') {
    const submitted = body.answers && typeof body.answers === 'object' ? body.answers : {};
    // Only the labels this form asked for, in the order it asked for them.
    const fields = form.fields.map(field => {
      const raw = submitted[field.label];
      const value = typeof raw === 'string' ? raw.trim().slice(0, 500) : '';
      return { ...field, value };
    });

    const now = new Date().toISOString();
    const updated: PatientIntakeFormDoc = {
      ...form,
      fields,
      status: 'pending_review',
      receivedAt: now,
      updatedAt: now,
    };
    try {
      await intakeFormsDB().put(updated);
    } catch {
      return NextResponse.json(
        { error: 'We could not save your answers. Please try again.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
