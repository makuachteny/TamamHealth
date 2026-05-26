/**
 * Browser-side CouchDB session login.
 *
 * After the platform server has authenticated the user (and provisioned a
 * matching CouchDB user via lib/sync/couch-auth.ts), the browser logs into
 * CouchDB directly. CouchDB sets an `AuthSession` cookie on the response,
 * scoped to the CouchDB host. Subsequent fetches with `credentials:'include'`
 * — including those issued by PouchDB during sync — carry that cookie.
 *
 * Why client-side and not server-mediated?  Because CouchDB's cookie binds to
 * its own host (e.g., couch.tamamhealth.org). A Next.js Set-Cookie response
 * can't write a cookie scoped to a different host, so the browser has to
 * make the call itself. CORS already allows credentials (see setup-couchdb.sh).
 */

import { getCouchDBUrl } from './sync-config';

const SESSION_PATH = '/_session';

export interface CouchSessionResult {
  ok: boolean;
  /** CouchDB returns the user's roles in the session response */
  roles?: string[];
  /** HTTP status from /_session — useful for diagnostics */
  status: number;
  /** Free-form error text from CouchDB on failure */
  error?: string;
}

/**
 * POST /_session with form-encoded credentials. Per CouchDB docs the endpoint
 * also accepts JSON, but form encoding is the documented happy path and works
 * with CouchDB 2.x and 3.x identically.
 *
 * Returns ok=true on success. The browser will now hold an `AuthSession`
 * cookie on the CouchDB host that it sends on credentialled requests.
 */
export async function loginCouch(
  username: string,
  password: string,
): Promise<CouchSessionResult> {
  if (typeof window === 'undefined') {
    return { ok: false, status: 0, error: 'loginCouch must run in the browser' };
  }
  const couchUrl = getCouchDBUrl();
  if (!couchUrl) {
    return { ok: false, status: 0, error: 'NEXT_PUBLIC_COUCHDB_URL is not set' };
  }
  try {
    const res = await fetch(`${couchUrl.replace(/\/+$/, '')}${SESSION_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: username, password }).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text || res.statusText };
    }
    const body = (await res.json().catch(() => ({}))) as { roles?: string[] };
    return { ok: true, status: res.status, roles: body.roles ?? [] };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'network error',
    };
  }
}

/**
 * DELETE /_session — drops the AuthSession cookie. Called on logout so a
 * subsequent user on the same browser cannot replay the previous session.
 */
export async function logoutCouch(): Promise<void> {
  if (typeof window === 'undefined') return;
  const couchUrl = getCouchDBUrl();
  if (!couchUrl) return;
  try {
    await fetch(`${couchUrl.replace(/\/+$/, '')}${SESSION_PATH}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // best-effort; offline logout is fine
  }
}

/**
 * GET /_session — returns the current session info, used by sync init to
 * decide whether the cookie is still good before starting replication.
 */
export async function whoamiCouch(): Promise<{
  ok: boolean;
  username?: string;
  roles?: string[];
}> {
  if (typeof window === 'undefined') return { ok: false };
  const couchUrl = getCouchDBUrl();
  if (!couchUrl) return { ok: false };
  try {
    const res = await fetch(`${couchUrl.replace(/\/+$/, '')}${SESSION_PATH}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as {
      userCtx?: { name: string | null; roles: string[] };
    };
    if (!body.userCtx?.name) return { ok: false };
    return { ok: true, username: body.userCtx.name, roles: body.userCtx.roles };
  } catch {
    return { ok: false };
  }
}
