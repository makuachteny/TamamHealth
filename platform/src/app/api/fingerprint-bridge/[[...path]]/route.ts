/**
 * Server-side proxy to the local fingerprint-bridge (loopback HTTP).
 *
 * Browsers cannot reliably call http://127.0.0.1:7345 from an HTTPS app or
 * under a strict CSP. The platform UI calls /api/fingerprint-bridge/* instead;
 * this route forwards to NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole,
} from '@/lib/api-auth';
import type { UserRole } from '@/lib/db-types';

// Roles permitted to use the fingerprint bridge
const BRIDGE_ROLES: UserRole[] = ['front_desk', 'nurse', 'doctor', 'clinical_officer', 'clinician', 'midwife', 'super_admin', 'org_admin', 'medical_superintendent'];

function bridgeBase(): string {
  return (process.env.NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL || 'http://127.0.0.1:7345').replace(/\/+$/, '');
}

function fingerprintEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FINGERPRINT_ENABLED === 'true';
}

async function proxy(req: NextRequest, pathSegments: string[] | undefined): Promise<NextResponse> {
  // Require a valid authenticated session before forwarding to the bridge.
  const auth = await getAuthPayload(req);
  if (!auth) return unauthorized();
  if (!hasRole(auth, BRIDGE_ROLES)) return forbidden();

  if (!fingerprintEnabled()) {
    return NextResponse.json({ error: 'fingerprint feature disabled' }, { status: 404 });
  }

  const subpath = (pathSegments ?? []).join('/');
  const target = `${bridgeBase()}/${subpath}${req.nextUrl.search}`;

  try {
    const init: RequestInit = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(req.method === 'GET' ? 5000 : 35000),
    };
    if (req.method === 'POST') {
      init.body = await req.text();
    }
    const res = await fetch(target, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'fingerprint bridge unreachable' }, { status: 503 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
