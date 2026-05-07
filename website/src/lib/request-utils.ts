import type { NextRequest } from 'next/server';

/**
 * Best-effort client IP extraction for API routes. Reads the standard
 * upstream-proxy headers first, then falls back to a literal so the return
 * value can be used as a stable rate-limit key. Never returns an empty
 * string.
 *
 * Runtime note: `request.ip` is not available in every Next.js runtime
 * (Edge vs. Node.js), which is why we rely on headers.
 */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
