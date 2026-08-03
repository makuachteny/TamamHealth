/**
 * API: /api/telehealth/maintenance
 * POST — Run the telehealth reconciliation + stale-session sweep
 *        (lib/services/telehealth-reconciliation): expire abandoned
 *        waiting-rooms, mark no-shows, close stuck in_session records,
 *        cancel sessions whose appointment was cancelled, and report
 *        appointment/session divergences.
 *
 * ## Why this endpoint has to exist
 *
 * expireStaleSessions/reconcileTelehealth were implemented and tested but had
 * no caller (KAN-127/128/143/144): a session left in `waiting_room` or
 * `in_session` stayed there forever, `todayActive` counted ghosts, and
 * divergent appointment/session pairs were never surfaced. Nothing in an
 * offline-first client can be trusted to run a sweep — the browser that opened
 * the visit may be closed or offline. This is the missing server-side caller.
 *
 * Intended callers: the hourly job in
 * .github/workflows/telehealth-maintenance-cron.yml, or an administrator
 * triggering it by hand.
 *
 * The response carries counts and finding kinds only — session/appointment
 * ids, never patient data — so a cron log leaks no PHI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole } from '@/lib/db-types';

/** Who may trigger a manual sweep from a session. */
const MAINTENANCE_ROLES: UserRole[] = ['super_admin', 'org_admin', 'medical_superintendent'];

/**
 * Machine caller. A scheduled job has no user session, so it authenticates
 * with a shared secret — the same shape as the reminder-dispatch and
 * transfer-sweep jobs. Compared in constant time so the secret cannot be
 * recovered byte-by-byte from response timing.
 *
 * Unset secret = no machine access at all, rather than open access.
 */
function isAuthorizedScheduler(request: NextRequest): boolean {
  const expected = process.env.TELEHEALTH_MAINTENANCE_SECRET;
  if (!expected) return false;
  const provided = request.headers.get('x-telehealth-maintenance-secret');
  if (!provided) return false;
  const a = new Uint8Array(Buffer.from(provided, 'utf8'));
  const b = new Uint8Array(Buffer.from(expected, 'utf8'));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function postHandler(request: NextRequest) {
  try {
    const isScheduler = isAuthorizedScheduler(request);
    if (!isScheduler) {
      const auth = await getAuthPayload(request);
      if (!auth) return unauthorized();
      if (!hasRole(auth, MAINTENANCE_ROLES)) {
        return forbidden('Only administrators can run telehealth maintenance.');
      }
    }

    // `asOf` lets an operator replay the sweep at a specific instant when
    // reconciling a missed run. Rejected if unparseable rather than silently
    // falling back to now — a typo'd timestamp that quietly means "right now"
    // would close sessions the operator did not intend to close yet.
    const asOfParam = new URL(request.url).searchParams.get('asOf');
    let asOf = Date.now();
    if (asOfParam) {
      const parsed = new Date(asOfParam);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: `Invalid asOf timestamp: ${asOfParam}` },
          { status: 400 },
        );
      }
      asOf = parsed.getTime();
    }

    const { getAllAppointments } = await import('@/lib/services/appointment-service');
    const { reconcileTelehealth } = await import('@/lib/services/telehealth-reconciliation');

    // Deliberately unscoped, like the transfer sweep: server-side getDB talks
    // to CouchDB with admin credentials, and a per-tenant sweep would quietly
    // stop for any tenant with no active admin.
    const appointments = await getAllAppointments();
    const report = await reconcileTelehealth(appointments, { now: asOf, repair: true });

    const byKind: Record<string, number> = {};
    for (const finding of report.findings) {
      byKind[finding.kind] = (byKind[finding.kind] || 0) + 1;
    }

    // Persist a run record so "when did this last run?" has an answer beyond
    // the cron provider's own logs (KAN-143/144 admin-visibility gap).
    try {
      const { logAuditSafe } = await import('@/lib/services/audit-service');
      await logAuditSafe(
        'TELEHEALTH_MAINTENANCE_RUN', 'system', 'Telehealth maintenance sweep',
        `scanned ${report.scannedSessions} sessions / ${report.scannedAppointments} appointments, ` +
        `${report.findings.length} finding(s), ${report.repaired} repaired`,
      );
    } catch {
      // The sweep already ran; a failed audit write must not fail the job.
    }

    return NextResponse.json({
      ok: true,
      sweptAt: new Date(asOf).toISOString(),
      scannedSessions: report.scannedSessions,
      scannedAppointments: report.scannedAppointments,
      findingCount: report.findings.length,
      repaired: report.repaired,
      byKind,
      // Ids only — enough for an operator to look a record up in the app.
      findings: report.findings.map(f => ({
        kind: f.kind,
        sessionId: f.sessionId,
        appointmentId: f.appointmentId,
        repaired: f.repaired,
      })),
    });
  } catch (err) {
    logApiError('[API /telehealth/maintenance POST]', err);
    return serverError();
  }
}

export const POST = withAuditLog(postHandler, { action: 'telehealth.maintenance.sweep' });
