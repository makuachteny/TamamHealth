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

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "national-referral-hospital",
    title: "Cutting OPD wait time in half at a national referral hospital",
    client: "National Referral Hospital (illustrative)",
    facilityType: "Level 5 Referral Hospital · ~750 beds",
    location: "Juba",
    state: "Central Equatoria",
    goLiveDate: "Pilot ready",
    productsUsed: ["HMIS", "LIS", "RIS", "PMS", "PFS"],
    accent: "var(--tb-blue-700)",
    bg: "var(--tb-tint-blue)",
    image: "/assets/landing-img.jpg",
    imageAlt: "Health workers at a South Sudan referral facility",
    summary: "What a 750-bed national hospital could expect after replacing paper triage cards with the TamamHealth OPD queue: a projected drop in median outpatient wait time from over three hours to under ninety minutes, and a measurable lift in patient satisfaction within the first quarter.",
    challenge: {
      heading: "The kind of problem we're built for",
      body: [
        "A national referral hospital might handle over 1,200 outpatients on a typical Monday. Under paper triage, patients commonly wait three or more hours before being seen — with no visibility into queue position.",
        "Pharmacy and laboratory communicate by handwritten request slip. A single drug interaction or critical lab result can take 45 minutes to surface back to the consulting clinician.",
        "Monthly HMIS reports get assembled by hand from departmental tally sheets, with the report typically submitted to the Ministry of Health 10–14 days late.",
      ],
    },
    solution: {
      heading: "How TamamHealth changes the day",
      body: [
        "TamamHealth HMIS becomes the single platform for OPD, IPD, ward management, lab, imaging, and pharmacy. Triage happens at a digital kiosk on arrival, with priority and estimated wait visible to both the patient and the consulting room.",
        "Patient feedback kiosks at OPD discharge collect satisfaction in real time. Negative responses route to a duty officer for follow-up within four hours.",
        "DHIS2 sync is configured so the monthly HMIS 105 report assembles itself from the day's activity — eliminating the end-of-month reconciliation marathon.",
      ],
    },
    outcomes: {
      heading: "What we'd expect six months in",
      body: [
        "Median OPD wait time projected to drop from 3h+ to under 90 minutes — based on benchmarks from comparable digital triage rollouts in Kenya and Uganda. The biggest single win comes from removing the registration → file-pull → triage card flow with a single tablet check-in.",
        "Pharmacy receives prescriptions electronically; the noon dispense queue typically clears 60–70% faster.",
        "Monthly HMIS reports submitted by day 3 of the following month rather than day 14. Data-quality audit scores improve in line with what comparable Kenyan county hospitals have shown.",
      ],
    },
    metrics: [
      { label: "Projected OPD wait", value: "< 90 min", delta: "from 3h+", positive: true },
      { label: "Patient satisfaction", value: "+25 pts", delta: "vs paper baseline", positive: true },
      { label: "HMIS submission", value: "Day 3", delta: "from day 14", positive: true },
      { label: "Pharmacy queue", value: "−65%", delta: "at noon", positive: true },
    ],
    pullQuote: {
      quote: "If TamamHealth can take the three nurses we use just to manage the triage card pile and put them back on the ward, the platform pays for itself in the first quarter.",
      author: "Hospital Administration Lead",
      role: "Indicative response from a stakeholder consulted during product design",
    },
  },
  {
    slug: "county-pharmacy-supply",
    title: "Building a pharmacy supply chain that doesn't run out",
    client: "County Referral Hospital (illustrative)",
    facilityType: "County Referral Hospital · ~180 beds",
    location: "Wau",
    state: "Western Bahr el Ghazal",
    goLiveDate: "Pilot ready",
    productsUsed: ["HMIS", "PMS"],
    accent: "var(--tb-green-dark)",
    bg: "var(--tb-tint-green)",
    image: "/assets/dashboard-screenshot.png",
    imageAlt: "Pharmacy inventory dashboard with stock and consumption",
    summary: "What a county referral hospital could expect after rolling out TamamHealth PMS with batch tracking and donor-tagged inventory: stock-out incidents on essential medicines projected to drop from double digits per quarter into the low single digits.",
    challenge: {
      heading: "The kind of problem we're built for",
      body: [
        "A typical county referral hospital receives drug consignments from three or more different funders — the Global Fund, UNICEF, and the State Ministry of Health. Mixing them on a single shelf makes consumption reporting back to each funder painful and inaccurate.",
        "An informal paper bin card system means the pharmacy team often only realises they're out of an essential medicine when a clinician comes down to ask. Antimalarial stock-outs during the rainy season can run 4–6 weeks per year.",
      ],
    },
    solution: {
      heading: "How TamamHealth changes the day",
      body: [
        "Each consignment gets tagged by donor at goods receipt. FEFO + donor-priority dispense logic means short-dated stock and the right donor's stock are picked first, automatically.",
        "Reorder thresholds set per item with an SMS alert to the chief pharmacist when stock dips. Suppliers receive an automatic order PDF when on-hand drops below a 30-day buffer.",
        "Dashboard shows month-on-month consumption per donor, ready to export for funder reporting.",
      ],
    },
    outcomes: {
      heading: "What we'd expect in the first two quarters",
      body: [
        "Stock-out events on the WHO Essential Medicines List could fall by 80%+ — most remaining stock-outs would be national-level supply gaps, not facility-level mismanagement.",
        "Donor-consumption reports generated in five minutes for each funder. Stronger reporting often unlocks additional allocations from international partners.",
        "Expired-stock write-offs typically drop from 4–5% of inventory value to under 1%.",
      ],
    },
    metrics: [
      { label: "Stock-out events", value: "−80%+", delta: "vs paper baseline", positive: true },
      { label: "Expired write-offs", value: "< 1%", delta: "from 4-5%", positive: true },
      { label: "Donor reports time", value: "5 min", delta: "from 2 days", positive: true },
      { label: "On-hand accuracy", value: "98%+", delta: "from 70%", positive: true },
    ],
    pullQuote: {
      quote: "For the first time, a chief pharmacist could tell the medical superintendent today's stock value, today, without doing a count.",
      author: "Indicative outcome",
      role: "Based on benchmarked deployments of comparable pharmacy systems in East Africa",
    },
  },
  {
    slug: "phcu-network-offline",
    title: "Registering 12,000 households offline across a PHCU network",
    client: "County PHCU Network (illustrative)",
    facilityType: "Primary Health Care Units · 14 sites",
    location: "Kajo-keji County",
    state: "Central Equatoria",
    goLiveDate: "Pilot ready",
    productsUsed: ["CMS"],
    accent: "var(--tb-gold-dark)",
    bg: "var(--tb-tint-gold)",
    image: "/assets/village-community.jpg",
    imageAlt: "Children in a rural South Sudan community served by a PHCU",
    summary: "What a county PHCU network could achieve with Boma Health Workers running TamamHealth CMS on offline tablets: tens of thousands of households registered within the first 90 days, with full sync at monthly supervision visits.",
    challenge: {
      heading: "The kind of problem we're built for",
      body: [
        "Many county PHCUs are hours from the nearest reliable internet connection. Each PHCU relies on monthly supervision visits to surface health data up to the State and National levels.",
        "Paper household registers get lost or damaged during seasonal flooding, and Boma-level patient counts that feed into county planning are 12–18 weeks old at the time decisions get made.",
      ],
    },
    solution: {
      heading: "How TamamHealth changes the day",
      body: [
        "Each Boma Health Worker receives a low-cost Android tablet running TamamHealth CMS. Patient registration, ANC visits, immunizations, and household visits all entered offline.",
        "Monthly supervision tablets sync over a hotspot at the Payam supervisor's compound — a 20-minute round trip per BHW, fully automated.",
        "Sync conflicts (rare — typically duplicate household IDs) surface in a queue for the Payam supervisor to resolve.",
      ],
    },
    outcomes: {
      heading: "What we'd expect three months in",
      body: [
        "Tens of thousands of households registered across the network with full geocode anchoring (BOMA-XX-HH#### format).",
        "ANC first-visit registration rate could lift 20+ points as women register at the closest PHCU rather than waiting for a county-hospital visit.",
        "County health team receives a fresh data export every month, on time, every time.",
      ],
    },
    metrics: [
      { label: "Households registered", value: "12,000+", delta: "in 90 days", positive: true },
      { label: "ANC 1st-visit rate", value: "+20 pts", delta: "vs paper baseline", positive: true },
      { label: "Sync data freshness", value: "30 days", delta: "from 12 weeks", positive: true },
      { label: "Tablets per network", value: "1 / PHCU", delta: "low cost", positive: true },
    ],
  },
  {
    slug: "diagnostic-centre-tat",
    title: "Slashing lab report turnaround from 5 days to 8 hours",
    client: "Private Diagnostic Centre (illustrative)",
    facilityType: "Private Diagnostic Centre",
    location: "Juba",
    state: "Central Equatoria",
    goLiveDate: "Pilot ready",
    productsUsed: ["LIS", "RIS"],
    accent: "#1B7FA8",
    bg: "rgba(27, 127, 168, 0.10)",
    image: "/assets/health-data.jpg",
    imageAlt: "Laboratory TAT analytics dashboard",
    summary: "What a Juba private diagnostic centre could expect by integrating their existing analyzers and ultrasound directly into TamamHealth LIS + RIS: median report turnaround projected to drop from 5 days to under 8 hours.",
    challenge: {
      heading: "The kind of problem we're built for",
      body: [
        "Many diagnostic centres handle referrals from over 30 clinics across Juba. Manual transcription from analyzer printouts to handwritten reports is the bottleneck — typists work overtime nightly and reports often go out the next afternoon.",
        "Imaging studies get burned to CD and physically returned to the referring clinic, adding 24–72 hours to the diagnostic loop.",
      ],
    },
    solution: {
      heading: "How TamamHealth changes the day",
      body: [
        "LIS-2A integration to common hematology analyzers (Sysmex, Mindray) — results stream directly into TamamHealth LIS, validated against age-and-sex reference ranges, ready for tech sign-off in seconds.",
        "RIS module configured for ultrasound and X-ray with structured templates per indication. PACS integration via Orthanc lets the reading radiologist view, report, and release without leaving the platform.",
        "Reports auto-deliver to the referring clinic via email + SMS download link. Patients also get an SMS link to their own copy.",
      ],
    },
    outcomes: {
      heading: "What we'd expect in the first quarter",
      body: [
        "Median lab report turnaround drops from 5 days to under 8 hours. The fastest path (FBC + reticulocyte) could run at 18 minutes from venipuncture to clinician's inbox.",
        "Imaging study delivery drops from 24-72 hours to under 30 minutes.",
        "The centre can scale to additional reading stations and satellite collection points without additional infrastructure investment.",
      ],
    },
    metrics: [
      { label: "Lab report TAT", value: "< 8 hours", delta: "from 5 days", positive: true },
      { label: "Imaging delivery", value: "< 30 min", delta: "from 24-72h", positive: true },
      { label: "Daily throughput", value: "+45%", delta: "with same staff", positive: true },
      { label: "Repeat test rate", value: "< 2%", delta: "from 4-5%", positive: true },
    ],
    pullQuote: {
      quote: "Most diagnostic centres bought their analyzer years ago and still don't use it the way the manufacturer intended.",
      author: "Indicative scenario",
      role: "Common pattern observed across the East African private-lab market",
    },
  },
];

export const getCaseStudy = (slug: string): CaseStudy | undefined =>
  CASE_STUDIES.find(c => c.slug === slug);
