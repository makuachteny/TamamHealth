/**
 * Thin API client for the TamamHealth platform.
 *
 * Responsibilities:
 *   - Resolve the API base URL from `EXPO_PUBLIC_API_BASE_URL`
 *     (default: http://localhost:3000 for dev).
 *   - Persist the auth JWT in `expo-secure-store` under a single key.
 *   - Attach `Authorization: Bearer <token>` to every outbound request
 *     when a token is present.
 *   - Auto-clear the stored token on a 401 response and notify any
 *     registered listener (e.g. AuthProvider) so UI state can react.
 *
 * The platform's patient-portal endpoints (under /api/patient-portal/*)
 * authenticate via the Authorization header — see verifyPatientToken
 * in platform/src/lib/patient-portal-auth.ts.
 */

import * as SecureStore from 'expo-secure-store';

/** Single secure-store slot for the patient session payload. */
export const SESSION_STORAGE_KEY = 'tamamhealth.session';

const DEFAULT_BASE_URL = 'http://localhost:3000';

/** Resolve base URL once per call so tests / EAS builds can override at runtime. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) {
    // Strip any trailing slash so callers can safely prepend "/api/...".
    return fromEnv.replace(/\/+$/, '');
  }
  return DEFAULT_BASE_URL;
}

/**
 * In-memory cache of the bearer token. Hydrated from SecureStore at startup
 * via `loadStoredSession`, then kept in sync with every set/clear call so
 * synchronous request paths don't have to await the keychain.
 */
let cachedToken: string | null = null;

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Register a callback fired whenever a request returns 401. The AuthProvider
 * uses this to drop session state from React when the server invalidates the
 * token (logout-elsewhere, expiry, JWT secret rotation, ...).
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/** Get the current in-memory token without touching SecureStore. */
export function getAuthToken(): string | null {
  return cachedToken;
}

/**
 * Persist (or clear) the auth token. Passing `null` removes the entry from
 * SecureStore entirely so a stale token can't survive a crash mid-logout.
 */
export async function setAuthToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token === null) {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY).catch(() => {
      // Deleting a missing key throws on some platforms — ignore.
    });
    return;
  }
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, token);
}

/**
 * Hydrate the in-memory token from SecureStore. Call once on app start
 * before rendering protected screens.
 */
export async function loadStoredToken(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    cachedToken = stored ?? null;
    return cachedToken;
  } catch {
    cachedToken = null;
    return null;
  }
}

/**
 * Drop session state both in memory and on disk, then notify the registered
 * unauthorized handler if any. Safe to call from anywhere (logout button,
 * 401 interceptor, app reset).
 */
export async function clearSession(): Promise<void> {
  await setAuthToken(null);
  if (unauthorizedHandler) {
    unauthorizedHandler();
  }
}

export type ApiFetchOptions = RequestInit & {
  /** Skip attaching the Authorization header even if a token is present. */
  skipAuth?: boolean;
  /**
   * Skip the automatic clearSession() on 401. Used by the login endpoint
   * itself, which legitimately returns 401 on bad credentials without
   * meaning the existing session should be torn down.
   */
  skipUnauthorizedHandler?: boolean;
};

/**
 * Issue a request against the platform API. `path` should start with `/`
 * (e.g. "/api/patient-portal/labs") — the base URL is prefixed automatically.
 */
export async function apiFetch(
  path: string,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const { skipAuth, skipUnauthorizedHandler, headers, ...rest } = init;

  const finalHeaders = new Headers(headers);
  if (!skipAuth && cachedToken) {
    finalHeaders.set('Authorization', `Bearer ${cachedToken}`);
  }
  // Only set a default Content-Type for requests with a body; don't override
  // an explicit one (e.g. multipart/form-data) the caller supplied.
  if (rest.body != null && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, { ...rest, headers: finalHeaders });

  if (response.status === 401 && !skipUnauthorizedHandler) {
    await clearSession();
  }

  return response;
}
