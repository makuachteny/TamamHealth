export const HOME_PROBLEM_STATS = [
  {
    value: "67%",
    label: "of health facilities don't report into the national health information system",
  },
  {
    value: "15k+",
    label: "health workers currently track patients on paper, or not at all",
  },
  {
    value: "2,400+",
    label: "Boma health units operating without any shared digital record",
  },
] as const;

export const HOME_AUDIENCES = [
  {
    title: "Health workers",
    body: "Register, triage, consult, and prescribe from one screen — even when the connection drops. Nothing to re-key when it comes back.",
    href: "/products",
    image: "/assets/doctor-tablet-review.jpg",
  },
  {
    title: "Facility leaders",
    body: "See beds, stock, staffing, and patient flow across every department in one place, without chasing a single paper register.",
    href: "/products",
    image: "/assets/doctor-nurse-consultation.jpg",
  },
  {
    title: "Ministries & partners",
    body: "Get facility-level reporting that's ready for national systems from day one — not months into a rollout.",
    href: "/about/contact",
    image: "/assets/community-health-worker.jpg",
  },
] as const;

export const HOME_LEARN_MORE = [
  {
    title: "For health workers",
    body: "See how TamamHealth supports registration, triage, consultation, lab, pharmacy, wards, referrals, and follow-up without adding paperwork.",
    href: "/products/hospital",
  },
  {
    title: "For partners",
    body: "Explore pilot conversations, implementation needs, and ways to support connected care in South Sudan.",
    href: "/about/contact",
  },
  {
    title: "For builders",
    body: "Learn how offline-first sync, secure records, FHIR, DHIS2, and low-bandwidth workflows fit together.",
    href: "/resources/api-docs",
  },
] as const;
