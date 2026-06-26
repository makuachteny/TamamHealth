/**
 * Shared display helpers for ETAT triage priority (RED / YELLOW / GREEN).
 *
 * Previously the same `priority === 'RED' ? '#EF4444' : …` ternary was
 * re-implemented inline in ~9 files (front-desk, ward, triage, handoff,
 * dashboards). Use these instead so the colour mapping stays uniform.
 */

export type TriagePriorityLike = 'RED' | 'YELLOW' | 'GREEN' | 'normal' | string | undefined | null;

/**
 * Colour token for a triage priority. RED is an explicit hex (matches the
 * existing call sites); YELLOW/GREEN map to the theme warning/success tokens;
 * anything else falls back to the accent colour.
 */
export function priorityColor(priority: TriagePriorityLike): string {
  switch (priority) {
    case 'RED': return '#EF4444';
    case 'YELLOW': return 'var(--color-warning)';
    case 'GREEN': return 'var(--color-success)';
    default: return 'var(--accent-primary)';
  }
}

/** Sort weight for a triage priority (RED first … then unknown last). */
export function priorityOrder(priority: TriagePriorityLike): number {
  switch (priority) {
    case 'RED': return 0;
    case 'YELLOW': return 1;
    case 'GREEN': return 2;
    default: return 3;
  }
}
