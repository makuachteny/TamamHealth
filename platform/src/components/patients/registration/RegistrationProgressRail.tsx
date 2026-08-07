'use client';

/**
 * The registration form's progress rail.
 *
 * Answers two different questions at once, with two different encodings, so
 * neither is mistaken for the other:
 *
 *  - HOW MUCH IS DONE — the spine fills with the share of required fields
 *    answered, and each section's node carries a conic sweep of its own
 *    fraction (two of three fields reads as two-thirds round).
 *  - WHERE YOU ARE — the current section's node gets a halo. Deliberately a
 *    ring and not a fill: "I am looking at this" must never read as "this is
 *    finished".
 *
 * Both are carried by the markers alone. The rail used to print a running
 * count beside every section as well ("0/5", "0/2", "0/10" at the top), which
 * said the same thing twice and turned a five-line table of contents into a
 * scoreboard the clerk had to read. The counts survive in `aria-label`, where
 * a screen reader still hears them.
 *
 * Presentational. It owns no state — the counts come from
 * `sectionRequirementProgress` and the active section from the form's
 * scroll-spy, so the same rail can be driven by a page or by a dialog.
 *
 * Adds no translation strings: the only word is `patientNew.optionalLabel`,
 * which exists in all eleven locales. A new key would print raw as
 * "patientNew.foo" in the ten that lag `en.ts`.
 */

import type { CSSProperties } from 'react';
import type { SectionProgress } from './registration-progress';

export interface RegistrationProgressRailProps {
  /** Section labels, in `SECTION_ANCHORS` order. */
  steps: string[];
  sectionProgress: SectionProgress[];
  requiredDone: number;
  requiredTotal: number;
  /** Index of the section currently on screen. */
  activeSection: number;
  /** Sections whose fields failed the last validation. */
  errorSections: Set<number>;
  /** Jump to a section of the form. */
  onSelectSection: (index: number) => void;
  /** Open the review step (the last entry). */
  onOpenReview: () => void;
  /** Word for a section with nothing required — pass `t('patientNew.optionalLabel')`. */
  optionalLabel: string;
}

export default function RegistrationProgressRail({
  steps,
  sectionProgress,
  requiredDone,
  requiredTotal,
  activeSection,
  errorSections,
  onSelectSection,
  onOpenReview,
  optionalLabel,
}: RegistrationProgressRailProps) {
  return (
    <nav
      className="omrs-reg-nav"
      // The spine fills to the share of required fields answered. Kept as a CSS
      // variable so the growth animates instead of jumping.
      style={{ '--omrs-reg-fill': `${requiredTotal ? (requiredDone / requiredTotal) * 100 : 0}%` } as CSSProperties}
    >
      <span className="omrs-reg-spine" aria-hidden />
      {steps.map((label, i) => {
        const { done, total } = sectionProgress[i];
        const hasErrors = errorSections.has(i);
        const state = hasErrors ? 'error'
          : total === 0 ? 'optional'
            : done === total ? 'complete'
              : done > 0 ? 'partial' : 'empty';
        // The last step is Review — a destination, not a place in the form — so
        // it opens the read-back instead of scrolling, and it stays locked until
        // the form would actually submit.
        const isReviewStep = i === steps.length - 1;
        const reviewLocked = isReviewStep && requiredDone < requiredTotal;
        // The only trailing marks left: a flag on a section the last submit
        // couldn't accept, and the word "Optional" on one that asks for
        // nothing. Everything else the node already says.
        const meta = hasErrors ? '!' : (!isReviewStep && total === 0) ? optionalLabel : null;
        return (
          <button
            key={label}
            type="button"
            onClick={() => (isReviewStep ? onOpenReview() : onSelectSection(i))}
            disabled={reviewLocked}
            className={`omrs-reg-navitem${hasErrors ? ' has-errors' : ''}${i === activeSection ? ' is-current' : ''}`}
            data-state={reviewLocked ? 'locked' : state}
            aria-current={i === activeSection ? 'true' : undefined}
            // Section name plus its own count — no new strings to leave
            // untranslated, and a screen reader still hears the progress.
            aria-label={total > 0 ? `${label} ${done}/${total}` : label}
          >
            <span
              className="omrs-reg-node"
              aria-hidden
              // Drives the conic sweep on a partly-filled node, so the marker
              // itself shows how far into the section you are.
              style={{ '--omrs-reg-node-pct': `${total ? (done / total) * 100 : 0}%` } as CSSProperties}
            />
            <span className="omrs-reg-navlabel">{label}</span>
            {meta && <span className="omrs-reg-navmeta" aria-hidden>{meta}</span>}
          </button>
        );
      })}
    </nav>
  );
}
