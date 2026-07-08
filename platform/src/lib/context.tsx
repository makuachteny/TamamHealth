'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import type { HospitalDoc, OrganizationDoc, UserRole, UserDoc } from './db-types';
import type { OrgBranding } from './branding';
import type { AggregateStatus } from './sync/sync-manager';
// Eagerly bundle the critical login path. These modules are tiny and used at
// the most user-facing flow — lazy-loading them via dynamic import() created
// a separate webpack chunk that could 404 if the browser tab outlived a dev
// rebuild ("Loading chunk _app-pages-browser_src_lib_auth_ts-*.js failed").
import { usersDB } from './db';
import { verifyPassword } from './auth';
import { createToken } from './auth-token';
import { logAudit } from './services/audit-service';
import { captureException } from './observability';
import { CSRF_COOKIE_NAME } from './csrf';

/** True when an error came from a failed dynamic-chunk fetch (stale tab after
 *  a hot-reload, network blip, etc.). The recovery for these is always a
 *  full page reload. */
function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /ChunkLoadError|Loading chunk .*failed|Failed to fetch dynamically imported module/i.test(msg);
}

interface AppUser {
  _id: string;
  username: string;
  name: string;
  role: UserRole;
  hospitalId?: string;
  hospitalName?: string;
  hospital?: HospitalDoc;
  orgId?: string;
  organization?: OrganizationDoc;
  /** Geographic scope claims propagated from JWT/UserDoc for tier-aware
   *  dashboards (state/county/payam pages, DHIS2 export level picker). */
  payam?: string;
  county?: string;
  state?: string;
  /** True when the user must set a new password before using the app. */
  mustChangePassword?: boolean;
  branding: OrgBranding;
}

interface AppState {
  isAuthenticated: boolean;
  currentUser: AppUser | null;
  /** Effective online status: user-preference AND OS-level navigator.onLine */
  isOnline: boolean;
  /** True when the OS reports the network is up (independent of user preference) */
  isNetworkUp: boolean;
  /** True when the user has explicitly paused sync via toggleOnline */
  syncPaused: boolean;
  lastSync: string;
  dbReady: boolean;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  login: (username: string, password: string, hospitalId?: string) => Promise<UserRole | false>;
  logout: () => void;
  toggleOnline: () => void;
  /** Sync state from the SyncManager (null when sync is disabled) */
  syncStatus: AggregateStatus | null;
  /** Trigger a one-shot sync across all databases */
  syncNow: () => Promise<void>;
}

/** localStorage key for persisting the user's sync on/off preference */
const SYNC_PREFERENCE_KEY = 'tamamhealth.sync.preference';

function readSyncPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(SYNC_PREFERENCE_KEY);
    if (v === 'paused') return false;
    return true;
  } catch {
    return true;
  }
}

function writeSyncPreference(wantsOnline: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYNC_PREFERENCE_KEY, wantsOnline ? 'online' : 'paused');
  } catch {
    // best-effort
  }
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  // User-preference: do they want sync running? Persisted in localStorage.
  const [wantsOnline, setWantsOnline] = useState<boolean>(true);
  // OS-level: is the network actually up?
  const [isNetworkUp, setIsNetworkUp] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState('');
  const [dbReady, setDbReady] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<AggregateStatus | null>(null);
  const syncManagerRef = useRef<import('./sync/sync-manager').SyncManager | null>(null);
  // Bumped each time the sync manager is (re)created so the gating effect
  // re-runs once the manager is ready, instead of needing to peek at refs.
  const [managerEpoch, setManagerEpoch] = useState(0);

  // Initialize database and check session
  useEffect(() => {
    const init = async () => {
      // Seed database on first load (client-side only)
      // In production, seeding only runs if DB is empty (isSeeded check inside seedDatabase)
      try {
        const { seedDatabase } = await import('./db-seed');
        await seedDatabase();
      } catch (err) {
        console.error('[TamamHealth] Database seed error:', err);
      }

      // Check for existing session via cookie (skip API call if no cookie).
      // `tamamhealth-token` is httpOnly on the server-issued (online) login
      // path, so it's invisible to document.cookie — check the readable
      // CSRF cookie (set alongside it) too, or this always misses online
      // sessions and force-logs-out the user on every hard refresh. The
      // offline/PouchDB fallback login sets `tamamhealth-token` itself
      // (non-httpOnly), so that name still needs checking directly.
      const hasCookie = document.cookie.split(';').some(c => {
        const name = c.trim().split('=')[0];
        return name === 'tamamhealth-token' || name === CSRF_COOKIE_NAME;
      });
      if (hasCookie) {
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              // Load hospital data if user has a hospitalId
              let hospital: HospitalDoc | undefined;
              if (data.user.hospitalId) {
                try {
                  const { getHospitalById } = await import('./services/hospital-service');
                  const h = await getHospitalById(data.user.hospitalId);
                  if (h) hospital = h;
                } catch {
                  // OK
                }
              }

              // Load organization data
              let organization: OrganizationDoc | undefined;
              if (data.user.orgId) {
                try {
                  const { getOrganizationById } = await import('./services/organization-service');
                  const org = await getOrganizationById(data.user.orgId);
                  if (org) organization = org;
                } catch {
                  // OK
                }
              }

              const { getOrgBranding, brandingToCSSVars } = await import('./branding');
              const branding = getOrgBranding(organization);
              const vars = brandingToCSSVars(branding);
              for (const [key, value] of Object.entries(vars)) {
                document.documentElement.style.setProperty(key, value);
              }

              // Apply org language setting
              if (organization?.locale) {
                const { initLocaleFromOrg } = await import('./i18n/useTranslation');
                initLocaleFromOrg(organization.locale);
              }

              setCurrentUser({ ...data.user, hospital, organization, branding });
              setIsAuthenticated(true);
            }
          }
        } catch {
          // Offline - OK
        }
      }

      // Gate route-guarding on dbReady only once the session check above has
      // resolved — flipping this before that finishes lets DashboardLayout's
      // isAuthenticated effect fire on a false negative and bounce a
      // logged-in user to /login (which then redirects to the *default*
      // dashboard, not the page they actually requested).
      setDbReady(true);
    };

    init();

    // Register service worker with a cache-busting version tag so a new
    // deploy forces the browser to fetch and install the new worker instead
    // of serving stale assets from the previous CACHE_NAME. Skipped in local
    // dev — its cache-first strategy for /_next/static/ otherwise serves
    // stale CSS/JS across reloads and fights the dev server's hot-reload.
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const buildId = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
      navigator.serviceWorker.register(`/sw.js?v=${buildId}`).catch(() => {});
    }

    // Hydrate user-preference from localStorage so the sync-paused choice
    // survives reloads.
    setWantsOnline(readSyncPreference());

    // Online/offline detection — the OS-level signal. We never auto-resume
    // sync if the user has explicitly paused it; that's checked in the
    // dedicated effect that watches wantsOnline + isNetworkUp.
    const handleOnline = () => {
      setIsNetworkUp(true);
      // Notify service worker to flush sync queue
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage('ONLINE');
      }
    };
    const handleOffline = () => setIsNetworkUp(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsNetworkUp(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Effective online: user wants to be online AND network is up.
  const isOnline = wantsOnline && isNetworkUp;

  // --- Sync lifecycle: create the manager on login, destroy on logout.
  // The actual start/stop based on user preference + network state is handled
  // by the next effect, so a paused user doesn't start sync at all.
  //
  // The dynamic import('./sync/sync-manager') is async, so we have to guard
  // against the case where the user logs out (or switches org) before the
  // import resolves — without an `aborted` flag the .then() body would
  // happily install a zombie manager AFTER the cleanup ran, and the next
  // teardown would never destroy it.
  useEffect(() => {
    let aborted = false;

    if (!isAuthenticated || !currentUser) {
      // Tear down sync when logged out
      if (syncManagerRef.current) {
        import('./sync/sync-manager').then(({ destroySyncManager }) => {
          if (aborted) return;
          destroySyncManager();
          syncManagerRef.current = null;
          setSyncStatus(null);
        });
      }
      return () => { aborted = true; };
    }

    // Create the manager (does not start sync yet — the gating effect below
    // calls startAll() once it confirms the user is online + network is up).
    import('./sync/sync-manager').then(({ createSyncManager, destroySyncManager }) => {
      if (aborted) {
        // The user logged out (or switched orgs) while we were waiting on the
        // dynamic import. Don't install the manager we were about to build —
        // and proactively destroy any singleton that the cleanup path already
        // created/left behind so we don't leak a syncing tab in a logged-out
        // session.
        destroySyncManager();
        return;
      }
      const manager = createSyncManager({
        orgId: currentUser.orgId,
        onChange: (status) => {
          setSyncStatus(status);
          // Update lastSync from real data
          if (status.lastSync) {
            setLastSync(status.lastSync);
          }
        },
      });
      syncManagerRef.current = manager;
      setSyncStatus(manager.getStatus());
      setManagerEpoch(e => e + 1);
    });

    return () => {
      aborted = true;
      import('./sync/sync-manager').then(({ destroySyncManager }) => {
        destroySyncManager();
        syncManagerRef.current = null;
      });
    };
  }, [isAuthenticated, currentUser?.orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Sync gating: the manager runs only when the user wants to be online
  // AND the OS reports the network is up. If either drops, stopAll(). When
  // both come back, startAll() and trigger an immediate syncNow().
  //
  // We deliberately do NOT poke setLastSync() here. The previous version
  // wrote `new Date().toISOString()` the instant startAll() was called, which
  // produced a badge reading "Last synced: just now" before any data had
  // actually been replicated (and stayed misleading when this tab landed as
  // a follower with no SyncService running at all). The manager's onChange
  // callback now drives lastSync from real per-DB status updates.
  useEffect(() => {
    if (!isAuthenticated) return;
    const manager = syncManagerRef.current;
    if (!manager) return;

    if (isOnline) {
      if (!manager.isRunning) {
        manager.startAll();
        // Best-effort kickoff — failures surface via per-DB status.
        manager.syncNow().catch(() => {});
      }
    } else {
      if (manager.isRunning) {
        manager.stopAll();
      }
    }
  }, [isOnline, isAuthenticated, managerEpoch]);

  const syncNow = useCallback(async () => {
    if (syncManagerRef.current) {
      await syncManagerRef.current.syncNow();
    }
  }, []);

  const login = useCallback(async (username: string, password: string, hospitalId?: string): Promise<UserRole | false> => {
    try {
      const sanitizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

      // Prefer server-side auth (/api/auth/login). The server reads from a
      // static user registry (server-users.ts) so it works even if the
      // browser's PouchDB has not been seeded yet. It also issues the httpOnly
      // cookie in its response, so we don't have to forge it client-side.
      //
      // Only if the request itself fails (offline / network error) do we fall
      // back to the PouchDB-local path so previously-logged-in users can still
      // sign in without connectivity.
      let user: Pick<UserDoc, '_id' | 'username' | 'name' | 'role' | 'hospitalId' | 'hospitalName' | 'orgId' | 'isActive' | 'passwordHash'> | null = null;
      let usedApi = false;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: sanitizedUsername, password, hospitalId }),
        });
        if (res.ok) {
          const body = await res.json();
          user = {
            _id: body.user._id,
            username: body.user.username,
            name: body.user.name,
            role: body.user.role,
            hospitalId: body.user.hospitalId,
            hospitalName: body.user.hospitalName,
            orgId: body.user.orgId,
            isActive: true,
            passwordHash: '',
          };
          usedApi = true;

          // Establish a CouchDB session cookie in the browser. The server
          // provisioned/updated the matching CouchDB user as part of the
          // login route, so the same plaintext password works for /_session.
          // Best-effort: a failure here means sync won't run this session
          // (offline-first PouchDB still works), so we don't fail login.
          if (process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true') {
            try {
              const { loginCouch } = await import('./sync/couch-client-auth');
              const result = await loginCouch(sanitizedUsername, password);
              if (!result.ok) {
                console.warn('[login] CouchDB /_session failed', result.status, result.error);
              }
            } catch (err) {
              console.warn('[login] CouchDB session establishment threw', err);
            }
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 429) {
          // Server explicitly rejected — do not fall back silently.
          await logAudit('login_failed', undefined, sanitizedUsername, `API rejected (${res.status})`, false);
          return false;
        }
        // Any other status (500, 502, etc.) falls through to the offline path.
      } catch {
        // Network error — fall through to PouchDB.
      }

      // Offline fallback: verify against local PouchDB.
      if (!user) {
        const db = usersDB();
        let localUser: UserDoc;
        try {
          localUser = await db.get(`user-${sanitizedUsername}`) as UserDoc;
        } catch {
          await logAudit('login_failed', undefined, sanitizedUsername, 'User not found (offline)', false);
          return false;
        }

        if (!localUser.isActive) {
          await logAudit('login_failed', localUser._id, sanitizedUsername, 'Account disabled', false);
          return false;
        }

        const valid = await verifyPassword(password, localUser.passwordHash);
        if (!valid) {
          await logAudit('login_failed', localUser._id, sanitizedUsername, 'Invalid password (offline)', false);
          return false;
        }

        const ROLES_WITHOUT_HOSPITAL = ['super_admin', 'org_admin', 'government'];
        if (!ROLES_WITHOUT_HOSPITAL.includes(localUser.role) && hospitalId && localUser.hospitalId && localUser.hospitalId !== hospitalId) {
          await logAudit('login_failed', localUser._id, sanitizedUsername, 'Hospital mismatch', false);
          return false;
        }

        // Mint a local token + set cookie ourselves since no server call happened.
        const token = await createToken({
          _id: localUser._id,
          username: localUser.username,
          role: localUser.role,
          name: localUser.name,
          hospitalId: localUser.hospitalId,
          orgId: localUser.orgId,
        });
        document.cookie = `tamamhealth-token=${token}; path=/; max-age=${60 * 60 * 24}; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}`;

        user = localUser;
      }

      await logAudit('login_success', user._id, user.username, usedApi ? 'API login' : 'Offline PouchDB login', true);

      // Load hospital data
      let hospital: HospitalDoc | undefined;
      if (user.hospitalId) {
        try {
          const { getHospitalById } = await import('./services/hospital-service');
          const h = await getHospitalById(user.hospitalId);
          if (h) hospital = h;
        } catch {
          // OK
        }
      }

      // Load organization data and branding
      let organization: OrganizationDoc | undefined;
      if (user.orgId) {
        try {
          const { getOrganizationById } = await import('./services/organization-service');
          const org = await getOrganizationById(user.orgId);
          if (org) organization = org;
        } catch {
          // OK
        }
      }

      const { getOrgBranding, brandingToCSSVars } = await import('./branding');
      const branding = getOrgBranding(organization);

      // Apply branding CSS variables
      const vars = brandingToCSSVars(branding);
      for (const [key, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(key, value);
      }

      // Apply org language setting
      if (organization?.locale) {
        const { initLocaleFromOrg } = await import('./i18n/useTranslation');
        initLocaleFromOrg(organization.locale);
      }

      // Geographic claims may live on UserDoc (server augment) or the auth
      // response shape. Read defensively so we still populate them when the
      // server-side login returns them but the local PouchDB record doesn't.
      const geo = user as unknown as { payam?: string; county?: string; state?: string; mustChangePassword?: boolean };
      setCurrentUser({
        _id: user._id,
        username: user.username,
        name: user.name,
        role: user.role as UserRole,
        hospitalId: user.hospitalId,
        hospitalName: user.hospitalName,
        hospital,
        orgId: user.orgId,
        organization,
        payam: geo.payam,
        county: geo.county,
        state: geo.state,
        mustChangePassword: geo.mustChangePassword,
        branding,
      });
      setIsAuthenticated(true);
      return user.role as UserRole;
    } catch (err) {
      console.error('Login error:', err);
      captureException(err, { tag: '[client/login]' });

      // Stale-chunk recovery: this happens when a long-lived browser tab tries
      // to lazy-load a JS chunk that the dev server already rebuilt under a
      // new hash. The fix is always a hard reload — offer it directly.
      if (isChunkLoadError(err)) {
        const reload = confirm(
          'A code update was detected and one of the page resources is out of date. ' +
          'Click OK to reload the page and try again.'
        );
        if (reload) window.location.reload();
        return false;
      }

      // Surface the failure to the caller (the login form renders a friendly
      // message). We intentionally do NOT use a raw alert() or leak the
      // internal error text to the user — diagnostics go to the console and
      // Sentry above.
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    // Server-side logout. The session cookie (`tamamhealth-token`) is httpOnly,
    // so `document.cookie = ...` cannot clear it from JavaScript — only the
    // server can. Hitting /api/auth/logout: (1) clears the httpOnly token and
    // CSRF cookies via Set-Cookie, (2) inserts the token into the persisted
    // revocation list so it can't be replayed within its 8h JWT life. Skip on
    // SSR-only paths and on unexpected errors so a network blip can't trap
    // the user in an unloggable state.
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // best-effort — fall through to the client-side teardown below
    }
    // Drop any in-progress encrypted PHI drafts (consultation autosave, etc.)
    // so the next user on a shared workstation can't recover them. The
    // per-tab AES-GCM key already dies with the tab, but explicitly clearing
    // localStorage here is defence-in-depth and tightens the window.
    // Best-effort — do not block logout on a storage error.
    try {
      const { dropAllDrafts } = await import('./draft-storage');
      await dropAllDrafts();
    } catch {
      // best-effort
    }
    // Drop the CouchDB AuthSession cookie so the next user on this browser
    // can't replay this session against the sync endpoint.
    if (process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true') {
      try {
        const { logoutCouch } = await import('./sync/couch-client-auth');
        await logoutCouch();
      } catch {
        // best-effort
      }
    }
    try {
      const { logAudit } = await import('./services/audit-service');
      await logAudit('logout', currentUser?._id, currentUser?.username, 'Logged out', true);
    } catch {
      // OK
    }
    // Wipe the browser's PouchDB IndexedDB stores. Without this, a shared
    // tablet retains the prior user's locally-replicated PHI documents — when
    // a different clinician (or a patient) logs in, the next sync resumes
    // against the new user but the old user's docs remain readable in the
    // local stores until the schema-version replay clears them. On a single-
    // user workstation this is a no-op (next login re-syncs anyway); on a
    // shared device this is the only thing that prevents PHI cross-leakage.
    //
    // CRITICAL ORDERING: we must stop replication BEFORE destroying the
    // databases, otherwise pouchdb-browser's IndexedDB deleteDatabase will
    // hang behind the open replication-side connection. Doing this via the
    // teardown effect (which fires on the isAuthenticated → false render)
    // is racy because resetAllDatabases() runs in the same callback before
    // React commits. So we destroy the sync manager synchronously here, then
    // flip auth state, then wipe the local DBs. The teardown effect remains
    // as a backstop for any path that flips isAuthenticated without going
    // through logout().
    try {
      const { destroySyncManager } = await import('./sync/sync-manager');
      destroySyncManager();
      syncManagerRef.current = null;
    } catch {
      // best-effort
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSyncStatus(null);
    try {
      const { resetAllDatabases } = await import('./db');
      await resetAllDatabases();
    } catch {
      // best-effort — IndexedDB.deleteDatabase can hang behind an open
      // connection, but we've already invalidated the session server-side.
    }
  }, [currentUser]);

  /**
   * Toggle the user's "I want to be online and syncing" preference. This
   * actually pauses/resumes the SyncManager (the gating effect above reacts
   * to wantsOnline) and persists the choice across reloads. The browser's
   * online/offline events still override the preference: if the network is
   * genuinely down, sync stays stopped regardless of preference.
   */
  const toggleOnline = useCallback(() => {
    setWantsOnline(prev => {
      const next = !prev;
      writeSyncPreference(next);
      if (next) setLastSync(new Date().toISOString());
      return next;
    });
  }, []);

  const syncPaused = !wantsOnline;

  // Memoize the context value so consumers (TopBar, Sidebar, every page that
  // calls useApp) don't re-render on each provider render — only when one of
  // these values actually changes. setState setters and the useCallback'd
  // actions are stable, so they don't need to be in the dependency list.
  const value = useMemo<AppState>(() => ({
    isAuthenticated, currentUser, isOnline, isNetworkUp, syncPaused,
    lastSync, dbReady,
    globalSearch, setGlobalSearch,
    sidebarOpen, setSidebarOpen,
    sidebarCollapsed, setSidebarCollapsed,
    login, logout, toggleOnline,
    syncStatus, syncNow,
  }), [
    isAuthenticated, currentUser, isOnline, isNetworkUp, syncPaused,
    lastSync, dbReady, globalSearch, sidebarOpen, sidebarCollapsed,
    syncStatus, login, logout, toggleOnline, syncNow,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
