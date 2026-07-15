# TamamHealth — Mobile (Patient App)

`tamamhealth-patient` is the Expo / React Native companion app for patients. It
lets a patient view their records, lab results, prescriptions, appointments,
immunizations, billing, and messages — online or offline.

## Getting started

```bash
npm install
npm run dev        # expo start (choose a target from the CLI)
npm run ios        # expo start --ios
npm run android    # expo start --android
npm run web        # expo start --web
npm run lint       # expo lint
```

Native release builds go through EAS: `npm run build:ios` / `npm run build:android`.

## Routing

Navigation is file-based via **expo-router** under `app/`:

- `app/_layout.tsx` — root layout; mounts the provider stack (auth → store →
  network → sync) and gates the app behind the Landing/Login screens.
- `app/(tabs)/*.tsx` — the bottom-tab routes. Each tab file is a **thin
  re-export** of the matching screen in `src/screens/` (e.g.
  `app/(tabs)/labs.tsx` → `src/screens/LabsScreen.tsx`). Put screen logic in
  `src/screens`, not in the route files.

## Architecture — two data paths (important)

The app deliberately runs **two separate data systems**. Knowing which is which
avoids the trap of "editing the wrong layer":

1. **Reads (what screens render)** — `use-cached-fetch.ts` → `api-client.ts`
   (REST against the platform API) → `offline-cache.ts` (encrypted SecureStore
   cache for offline reads). Screens consume this path.

2. **Writes + background sync** — `store.tsx` → `database.ts` (local SQLite) →
   `sync-engine.ts`, orchestrated by `sync-context.tsx`. Local mutations are
   queued in SQLite and pushed when connectivity returns (`network.tsx`).

Because reads come from the REST/cache path, the SQLite **read** getters in
`database.ts` are not on the render path today — don't assume a `getX()` in
`database.ts` is what a screen displays.

## Layout

```
app/                  # expo-router routes (_layout + (tabs))
src/
  screens/            # one screen component per tab (+ Landing/Login)
  components/          # shared UI (Card, Badge, DrawerMenu, Sync*, icons/)
  lib/
    api-client.ts      # REST client for the platform API
    use-cached-fetch.ts# read hook: fetch + offline-cache fallback
    offline-cache.ts   # encrypted SecureStore cache (PHI-safe)
    database.ts        # local SQLite schema + CRUD + sync queue
    sync-engine.ts     # pushes queued mutations to the server
    sync-context.tsx   # drives the sync engine; exposes sync state
    store.tsx          # app data store (writes go through here)
    auth.tsx           # auth/session provider
    network.tsx        # connectivity provider
    theme.ts / types.ts
```
