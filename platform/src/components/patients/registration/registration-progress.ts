/**
 * Registration section identity and progress arithmetic.
 *
 * Kept out of the form component so the rail, the review read-back and the
 * form all agree on what a section is and when it is finished, and so the
 * counting can be tested without rendering anything.
 */

/** Anchor ids for the rail's jump links, in the same order as the step labels. */
export const SECTION_ANCHORS = [
  'demographics', 'contact', 'nextofkin', 'biometrics', 'coverage', 'review',
] as const;

export type SectionAnchor = typeof SECTION_ANCHORS[number];

/** Index of the Review step — a destination rather than a part of the form. */
export const REVIEW_SECTION = SECTION_ANCHORS.length - 1;

export interface SectionProgress {
  /** Required fields answered in this section. */
  done: number;
  /** Required fields the section has at all; 0 means the section is optional. */
  total: number;
}

/** The subset of the registration form the progress count depends on. */
export interface RegistrationRequirementInput {
  firstName: string;
  surname: string;
  gender: string;
  dateOfBirth: string;
  estimatedAge: string;
  primaryLanguage: string;
  state: string;
  county: string;
  nokName: string;
  nokRelationship: string;
  nokPhone: string;
}

const filled = (value: string) => Boolean(value && value.trim());

/**
 * What each section still needs, mirroring the form's `validateStep` exactly.
 *
 * The rail must count the same things Register refuses to submit without, or it
 * promises a section is finished and the submit then bounces off it. Sections
 * with nothing required (biometrics, coverage, review) report a total of 0 and
 * read as optional rather than as permanently unfinished.
 */
export function sectionRequirementProgress(form: RegistrationRequirementInput): SectionProgress[] {
  const requirements: boolean[][] = [
    [filled(form.firstName), filled(form.surname), filled(form.gender),
      filled(form.dateOfBirth) || filled(form.estimatedAge), filled(form.primaryLanguage)],
    [filled(form.state), filled(form.county)],
    [filled(form.nokName), filled(form.nokRelationship), filled(form.nokPhone)],
    [],
    [],
    [],
  ];
  return requirements.map(flags => ({
    done: flags.filter(Boolean).length,
    total: flags.length,
  }));
}

/**
 * Nearest ancestor that actually scrolls, or null for the viewport.
 *
 * The form renders both as a full page and inside the front desk's
 * registration dialog. In the dialog the window never scrolls — the modal body
 * does — so anything that reasons about scroll position (the rail's scroll-spy,
 * "jump to top" when review opens) has to find the real container instead of
 * assuming the viewport.
 */
export function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}
