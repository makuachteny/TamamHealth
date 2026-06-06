/**
 * Health / readiness probe.
 *
 * GET /api/health
 *
 * Liveness: the route returning at all proves the Next.js server is up.
 * Readiness: we additionally report on the national analytics database.
 *   - DATABASE_URL unset      → db: "not-configured" (still 200; analytics is
 *                               optional for a single-facility offline deploy).
 *   - DATABASE_URL set + OK   → db: "ok" (200).
 *   - DATABASE_URL set + down → db: "unavailable" (503, so orchestrators and
 *                               load balancers can pull the instance).
 *
 * Intentionally unauthenticated and side-effect free so it can be polled by
 * Kubernetes liveness/readiness probes, uptime monitors, and the deploy
 * pipeline's post-rollout smoke check.
 */

import { NextResponse } from 'next/server';

// Always evaluate fresh; never cache a health result.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();
  let db: 'ok' | 'unavailable' | 'not-configured' = 'not-configured';
  let dbLatencyMs: number | null = null;

  if (process.env.DATABASE_URL) {
    const t0 = Date.now();
    try {
      const { query } = await import('@/lib/db/postgres');
      await query('SELECT 1');
      db = 'ok';
      dbLatencyMs = Date.now() - t0;
    } catch (err) {
      db = 'unavailable';
      dbLatencyMs = Date.now() - t0;
      console.warn('[Health] analytics database check failed:', (err as { code?: string; message?: string })?.code || (err as Error)?.message);
    }
  }

  const healthy = db !== 'unavailable';
  const body = {
    status: healthy ? 'ok' : 'degraded',
    service: 'tamamhealth-platform',
    version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || 'unknown',
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      server: 'ok',
      database: db,
      databaseLatencyMs: dbLatencyMs,
    },
    responseMs: Date.now() - startedAt,
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
