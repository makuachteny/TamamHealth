/**
 * API: /api/admin/sync-health
 * GET — Operational health view for the platform sync pipeline.
 *
 * Returns outbox backlog, per-status counts, oldest pending event timestamp,
 * and per-facility tallies so ops can see "facility X hasn't synced in Y hours"
 * at a glance.
 *
 * Admin / super-admin / medical-superintendent only.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import type { UserRole, SyncEventDoc } from '@/lib/db-types';

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'org_admin', 'medical_superintendent', 'hrio', 'government'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, ALLOWED_ROLES)) return forbidden();

    const { getSyncEventStats } = await import('@/lib/services/sync-event-service');
    const { syncEventsDB } = await import('@/lib/db');

    const stats = await getSyncEventStats();

    // Per-facility rollup (last 24h)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const db = syncEventsDB();
    const all = await db.allDocs({ include_docs: true });
    const recent = all.rows
      .map((r) => r.doc as SyncEventDoc)
      .filter((d) => d && d.type === 'sync_event' && d.occurredAt >= since);

    const perFacility: Record<string, { total: number; pending: number; failed: number; lastSeen?: string }> = {};
    for (const ev of recent) {
      const key = ev.hospitalId || 'unknown';
      if (!perFacility[key]) {
        perFacility[key] = { total: 0, pending: 0, failed: 0 };
      }
      perFacility[key].total += 1;
      if (ev.syncStatus === 'pending') perFacility[key].pending += 1;
      if (ev.syncStatus === 'failed') perFacility[key].failed += 1;
      if (!perFacility[key].lastSeen || ev.occurredAt > perFacility[key].lastSeen!) {
        perFacility[key].lastSeen = ev.occurredAt;
      }
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      outbox: stats,
      perFacilityLast24h: perFacility,
      windowHours: 24,
    });
  } catch (err) {
    logApiError('[API /admin/sync-health GET]', err);
    return serverError();
  }
}
