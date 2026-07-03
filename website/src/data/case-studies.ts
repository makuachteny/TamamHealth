/**
 * Source of truth for marketing scenarios.
 *
 * IMPORTANT — these are NOT case studies of real deployments.
 * TamamHealth is pre-launch. Every story below is a forward-looking
 * scenario showing what a Juba-area hospital, PHCU, lab, or
 * pharmacy could expect to see when they roll TamamHealth out.
 *
 * Numbers are projections derived from comparable HMIS deployments
 * elsewhere in East Africa (Kenya, Uganda, Rwanda) and from
 * benchmark studies on paper-vs-digital workflow time.
 *
 * The hub page and detail pages flag this clearly so prospective
 * customers can't mistake them for installed-base claims.
 */
export interface CaseStudyMetric {
  label: string;
  value: string;
  delta?: string;       // e.g. "+30%", "-2 days"
  positive?: boolean;
}

export interface CaseStudySection {
  heading: string;
  body: string[];       // each entry is a paragraph
}

export interface CaseStudy {
  slug: string;
  title: string;
  client: string;            // hypothetical facility name
  facilityType: string;
  location: string;
  state: string;
  goLiveDate: string;        // YYYY-MM — when a partner facility could go live
  productsUsed: string[];    // e.g. ["HMIS", "PMS", "PFS"]
  accent: string;
  bg: string;
  /** Stock photo URL (Unsplash) used in the card + detail hero. */
  image: string;
  imageAlt: string;
  summary: string;
  challenge: CaseStudySection;
  solution: CaseStudySection;
  outcomes: CaseStudySection;
  metrics: CaseStudyMetric[];
  pullQuote?: { quote: string; author: string; role: string };
}

// No case studies published yet — TamamHealth is pre-launch and has no real
// deployments to report on. Add entries here once a pilot facility goes live.
export const CASE_STUDIES: CaseStudy[] = [];

export const getCaseStudy = (slug: string): CaseStudy | undefined =>
  CASE_STUDIES.find(c => c.slug === slug);
