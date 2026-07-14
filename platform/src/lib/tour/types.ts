export interface TourStep {
  id: string;
  /** Path to navigate to before this step is shown (e.g. '/dashboard'). */
  route: string;
  /** CSS selector for the element this step's card points at. */
  target: string;
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Selector to click once, before measuring `target`, if it exists on the
   * page — used to reveal a wizard stage / collapsed panel the target lives
   * inside (e.g. the consultation wizard's stage buttons).
   */
  preClickSelector?: string;
}

export interface TourDefinition {
  /** Unique key for this tour's persistence (e.g. 'clinical-officer'). */
  key: string;
  steps: TourStep[];
}
