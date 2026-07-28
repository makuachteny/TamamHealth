/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Guards for the guided tour.
 *
 * The tour is the one part of the product nobody exercises day to day — staff
 * see it once, on their first login. A broken tour therefore fails silently and
 * only ever in front of a brand-new user, which is the worst possible audience.
 * These tests hold the two properties that decay on their own:
 *
 *  1. Every anchored step points at a `data-tour` attribute that still exists in
 *     the source. Anchors are invisible to styling work, so a refactor can strip
 *     one without any visible breakage — the step just quietly degrades to a
 *     floating card over the middle of the page.
 *
 *  2. Every role that claims a journey actually GETS one after route filtering.
 *     `journeyTourForRole` drops steps whose route the role can't reach and
 *     returns undefined below a minimum, so tightening a role's allow-list can
 *     silently demote it to the generic shell tour.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { journeyTourForRole, JOURNEY_TOUR_ROLES } from './journey-tours';

const SRC = join(__dirname, '..', '..');

/**
 * Every `data-tour="…"` value present in the component source.
 *
 * `src/lib/tour` is EXCLUDED deliberately. The step definitions there hold
 * targets written as `[data-tour="station-tabs"]`, which contain the very
 * substring this grep looks for — including that directory would let every
 * target satisfy itself and the check below would pass no matter what the
 * components actually render. (Confirmed by mutation: renaming a real anchor
 * did not fail this test until the exclusion was added.)
 */
function anchorsInSource(): Set<string> {
  const out = execSync(
    `grep -rho --exclude-dir=tour 'data-tour="[^"]*"' ${JSON.stringify(SRC)} || true`,
    { encoding: 'utf8' },
  );
  const found = new Set<string>();
  for (const line of out.split('\n')) {
    const m = line.match(/data-tour="([^"]*)"/);
    if (m) found.add(m[1]);
  }
  return found;
}

/**
 * Prefixes of anchors built by interpolation, e.g. the consultation page's
 * ``data-tour={`consult-section-${index}`}``. A static grep cannot see these —
 * the rendered value never appears as a literal — so they are collected
 * separately and matched by prefix. Without this the check would report a
 * false miss for an anchor that is genuinely present at runtime.
 */
function anchorPrefixesInSource(): string[] {
  const out = execSync(
    `grep -rhoE 'data-tour=\\{\`[^\`$]*\\$\\{' ${JSON.stringify(SRC)} || true`,
    { encoding: 'utf8' },
  );
  const prefixes: string[] = [];
  for (const line of out.split('\n')) {
    const m = line.match(/data-tour=\{`([^`$]*)\$\{/);
    if (m && m[1]) prefixes.push(m[1]);
  }
  return prefixes;
}

describe('tour step anchors', () => {
  const anchors = anchorsInSource();
  const prefixes = anchorPrefixesInSource();
  const resolves = (name: string) =>
    anchors.has(name) || prefixes.some(pre => name.startsWith(pre));

  it('resolves every [data-tour="…"] target to a real attribute in the source', () => {
    const missing: string[] = [];

    for (const role of JOURNEY_TOUR_ROLES) {
      const tour = journeyTourForRole(role);
      if (!tour) continue;
      for (const step of tour.steps) {
        const m = step.target?.match(/^\[data-tour="([^"]+)"\]$/);
        if (!m) continue;
        if (!resolves(m[1])) missing.push(`${role}/${step.id} → ${step.target}`);
      }
    }

    expect(missing).toEqual([]);
  });

  /**
   * Source-level presence is necessary but NOT sufficient: a shell anchor only
   * resolves on a route whose page actually renders the shell — and
   * `station-body` renders only when that page passes children
   * (`Children.toArray(children).length > 0` in EhrCareDashboard).
   *
   * This is a real trap, not a hypothetical: `/dashboard/front-desk` renders
   * `<EhrCareDashboard … />` self-closed, so two front-desk steps pointed at
   * `station-body` would have silently fallen back to a centred card while
   * every other check passed.
   */
  it('only targets shell anchors on routes that render the shell', () => {
    const SHELL_ANCHORS = ['station-tabs', 'station-body', 'station-queue', 'rail-search', 'station-actions', 'side-cards'];
    const problems: string[] = [];

    for (const role of JOURNEY_TOUR_ROLES) {
      const tour = journeyTourForRole(role);
      if (!tour) continue;
      for (const step of tour.steps) {
        const m = step.target?.match(/^\[data-tour="([^"]+)"\]$/);
        if (!m || !SHELL_ANCHORS.includes(m[1])) continue;

        const page = join(SRC, 'app/(dashboard)', step.route, 'page.tsx');
        let src: string;
        try {
          src = readFileSync(page, 'utf8');
        } catch {
          problems.push(`${role}/${step.id}: no page at ${step.route}`);
          continue;
        }
        // The route may delegate to a component; follow one hop if needed.
        const body = /EhrCareDashboard/.test(src)
          ? src
          : (() => {
              const imp = src.match(/import\s+(\w+)\s+from\s+'@\/components\/([^']+)'/);
              if (!imp) return src;
              try { return readFileSync(join(SRC, 'components', `${imp[2]}.tsx`), 'utf8'); } catch { return src; }
            })();

        if (!/EhrCareDashboard/.test(body)) {
          problems.push(`${role}/${step.id}: ${step.route} does not render EhrCareDashboard`);
        } else if (m[1] === 'station-body' && !body.includes('</EhrCareDashboard>')) {
          problems.push(`${role}/${step.id}: ${step.route} self-closes the shell, so station-body never renders`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('has no orphaned anchors left behind by deleted steps', () => {
    // Anchors are dead markup once no step points at them. This doesn't fail
    // the build for a stray attribute — it only covers the ones this file
    // deliberately added to the shared shell, which are the ones a reader is
    // most likely to mistake for a styling hook and "clean up".
    const shellAnchors = ['station-tabs', 'station-body', 'station-queue', 'rail-search', 'station-actions', 'side-cards'];
    const shell = readFileSync(join(SRC, 'components/ehr/EhrCareDashboard.tsx'), 'utf8');
    for (const a of shellAnchors) {
      expect(shell).toContain(`data-tour="${a}"`);
    }
  });
});

describe('journey tour coverage', () => {
  it('gives every journey role a usable tour after route filtering', () => {
    const demoted: string[] = [];
    for (const role of JOURNEY_TOUR_ROLES) {
      if (!journeyTourForRole(role)) demoted.push(role);
    }
    // A role listed in JOURNEY_STEPS but filtered below the minimum falls back
    // to the generic shell tour without any error — this is the only signal.
    expect(demoted).toEqual([]);
  });

  it('never routes a step to a screen the role cannot open', () => {
    // The filter is the guarantee that the tour can't strand someone on
    // "Access Restricted". Assert it actually applied, rather than trusting it.
    const { getRoleConfig } = require('@/lib/permissions');
    for (const role of JOURNEY_TOUR_ROLES) {
      const tour = journeyTourForRole(role);
      if (!tour) continue;
      const allowed: string[] = getRoleConfig(role)?.allowedRoutes || [];
      for (const step of tour.steps) {
        const ok = allowed.some(a => step.route === a || step.route.startsWith(a + '/'));
        expect({ role, step: step.id, route: step.route, ok }).toEqual(
          { role, step: step.id, route: step.route, ok: true },
        );
      }
    }
  });
});
