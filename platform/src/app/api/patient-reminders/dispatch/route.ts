/**
 * API: /api/patient-reminders/dispatch
 * POST — Dispatch due patient reminders (status 'queued', sendDate reached)
 *        through the configured SMS gateway (lib/sms). Opt-in per deployment
 *        via PATIENT_REMINDER_SMS_ENABLED='true'; without it the endpoint
 *        reports gatewayEnabled:false and sends nothing, preserving the
 *        staff-worked reminder queue.
 *
 * Intended callers: a scheduled job (cron hitting this route once daily) or
 * an admin/records officer triggering a manual dispatch from the UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';

const DISPATCH_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'hrio', 'front_desk', 'nurse',
];

async function postHandler(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, DISPATCH_ROLES)) return forbidden();

    const { dispatchDueReminders } = await import('@/lib/services/patient-reminder-service');
    const url = new URL(request.url);
    const asOf = url.searchParams.get('asOf') || undefined;
    const outcome = await dispatchDueReminders(asOf);

    return NextResponse.json(outcome, { status: outcome.gatewayEnabled ? 200 : 202 });
  } catch (err) {
    logApiError('[API /patient-reminders/dispatch POST]', err);
    return serverError();
  }
}

export const POST = withAuditLog(postHandler, { action: 'patient.reminder.dispatch' });
