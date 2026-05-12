/**
 * Auth context — manages the patient session against the TamamHealth platform.
 *
 * The mobile app is patient-facing. We talk to /api/patient-portal/login
 * (see platform/src/app/api/patient-portal/login/route.ts), which accepts
 * either {hospitalNumber, phone} or {firstName, surname, dateOfBirth, phone}
 * and returns `{ token, patient }`. The token is a JWT issued for the
 * "tamamhealth-patient" audience and is stored via expo-secure-store by
 * the api-client module.
 *
 * On startup we hydrate any persisted session optimistically (no /me endpoint
 * exists yet on the platform). Subsequent requests carry the bearer token; a
 * 401 response from any call clears the session via setUnauthorizedHandler.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Patient } from './types';
import {
  apiFetch,
  loadStoredToken,
  setAuthToken,
  clearSession,
  setUnauthorizedHandler,
} from './api-client';
import { clearAllCachedPhi } from './offline-cache';

/**
 * The authenticated user as far as the patient mobile app is concerned.
 * Re-exported under a friendlier name so call-sites read naturally.
 */
export type PatientUser = Patient;

export type Session = {
  token: string;
  user: PatientUser;
};

export type SignInOptions = {
  hospitalNumber?: string;
  phone: string;
  firstName?: string;
  surname?: string;
  dateOfBirth?: string;
};

type AuthState = {
  /** True while the initial token hydration / login request is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  session: Session | null;
  /** Convenience: the authenticated patient or null. */
  patient: PatientUser | null;
  signIn: (opts: SignInOptions) => Promise<void>;
  signOut: () => Promise<void>;
  /** @deprecated retained as a no-op so the older Landing flow still type-checks. */
  setBypass: (enabled: boolean) => void;
  /** Alias for signOut, kept for legacy callers. */
  logout: () => void;
};

const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
  session: null,
  patient: null,
  signIn: async () => {},
  signOut: async () => {},
  setBypass: () => {},
  logout: () => {},
});

/** Cached patient profile lives next to the token so we can rehydrate offline. */
const PATIENT_CACHE_KEY = 'tamamhealth.session.patient';

/**
 * Translate raw error strings from the login endpoint into messages we can
 * safely show end-users. We never want to surface stack traces or internal
 * error codes verbatim.
 */
function friendlyLoginError(status: number, raw: string | undefined): string {
  if (status === 401) {
    return 'No matching patient found. Check your details and try again.';
  }
  if (status === 429) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (status >= 500) {
    return 'The server is having trouble right now. Please try again shortly.';
  }
  if (raw && raw.length > 0 && raw.length < 200) {
    return raw;
  }
  return 'Login failed. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Wire the api-client's 401 handler to drop our React state when the
  // server tells us the token is no good. We also opportunistically clear
  // the PHI offline cache so a 401 doesn't leave clinical records readable
  // by the next person to launch the app.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      const expiredPatientId = session?.user.id;
      setSession(null);
      // Best-effort: forget the cached profile alongside the token.
      SecureStore.deleteItemAsync(PATIENT_CACHE_KEY).catch(() => {});
      if (expiredPatientId) {
        void clearAllCachedPhi(expiredPatientId);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [session]);

  // Hydrate any persisted session on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await loadStoredToken();
        if (!token) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        const cached = await SecureStore.getItemAsync(PATIENT_CACHE_KEY);
        if (!cached) {
          // Token without profile — can't render protected screens safely.
          await clearSession();
          if (!cancelled) setIsLoading(false);
          return;
        }
        try {
          const user = JSON.parse(cached) as PatientUser;
          if (!cancelled) setSession({ token, user });
        } catch {
          await clearSession();
        }
      } catch (err) {
        // Hydration failures should never block the login screen.
        console.warn('[auth] hydrate failed', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (opts: SignInOptions) => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/patient-portal/login', {
        method: 'POST',
        body: JSON.stringify(opts),
        skipAuth: true,
        skipUnauthorizedHandler: true,
      });

      if (!response.ok) {
        let serverMessage: string | undefined;
        try {
          const errBody = (await response.json()) as { error?: string };
          serverMessage = errBody?.error;
        } catch {
          // Non-JSON error body — ignore, fall back to generic message.
        }
        throw new Error(friendlyLoginError(response.status, serverMessage));
      }

      const data = (await response.json()) as { token: string; patient: PatientUser };
      if (!data.token || !data.patient) {
        throw new Error('Login failed. Please try again.');
      }

      await setAuthToken(data.token);
      await SecureStore.setItemAsync(
        PATIENT_CACHE_KEY,
        JSON.stringify(data.patient)
      );
      setSession({ token: data.token, user: data.patient });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Capture the id BEFORE we null out session — otherwise we can't target
    // the right cache namespace for this patient's PHI.
    const departingPatientId = session?.user.id;
    setSession(null);
    await SecureStore.deleteItemAsync(PATIENT_CACHE_KEY).catch(() => {});
    if (departingPatientId) {
      // Drop labs / records / prescriptions / appointments / messages / etc.
      // so the next sign-in on this device starts from the server, never
      // from another patient's locally-cached snapshot.
      await clearAllCachedPhi(departingPatientId);
    }
    await clearSession();
    // The platform staff /api/auth/logout exists but the patient portal
    // currently has no equivalent. The token is short-lived (8h) and
    // discarded client-side, which is sufficient for v1.
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isAuthenticated: session !== null,
      session,
      patient: session?.user ?? null,
      signIn,
      signOut,
      setBypass: () => {
        // Intentional no-op. Bypass mode was removed in favor of a real
        // login flow. Kept on the surface so legacy callers continue to
        // type-check while we migrate them.
      },
      logout: () => {
        // Fire-and-forget for the legacy synchronous shape. The async
        // version is signOut().
        void signOut();
      },
    }),
    [isLoading, session, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
