/**
 * Shared prop shapes for the right-drawer workspace panels (Stage 2).
 *
 * `ChartPanelUser` mirrors the same minimal-shape pattern already used by
 * `PatientActionModals`' `ActionUser` — the panels only ever read these
 * fields off `useApp().currentUser`, so they don't need the full (unexported)
 * `AppUser` type from `lib/context.tsx`.
 */

export interface ChartPanelUser {
  _id?: string;
  username?: string;
  name: string;
  role?: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

/** Minimal router shape the panels need — avoids importing Next's full
 *  AppRouterInstance type just to call `.push()`. */
export interface ChartPanelRouter {
  push: (href: string) => void;
}
