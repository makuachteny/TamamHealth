/**
 * Authoritative list of South Sudan administrative states.
 *
 * MIRRORED into `/api/country/metadata` (CountryMetadata.states) — when adding
 * or renaming a state, update both. The metadata endpoint is the canonical
 * source for clients; this constant is the canonical source for server-side
 * services that cannot make an HTTP call to themselves.
 */
export const SOUTH_SUDAN_STATES: readonly string[] = [
  'Central Equatoria', 'Eastern Equatoria', 'Western Equatoria',
  'Jonglei', 'Unity', 'Upper Nile', 'Lakes', 'Warrap',
  'Northern Bahr el Ghazal', 'Western Bahr el Ghazal',
] as const;
