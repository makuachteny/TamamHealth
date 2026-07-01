export const HOME_PRINCIPLES = [
  {
    number: "01",
    title: "One record across every visit",
    body: "Registration, triage, consultation, lab, pharmacy, referral, billing, and reporting stay connected to the same patient story.",
    href: "/ehr",
    icon: "record",
  },
  {
    number: "02",
    title: "Care that keeps working offline",
    body: "Clinics keep working through unreliable internet, power interruptions, and paper-heavy workflows, then sync safely when connection returns.",
    href: "/products",
    icon: "offline",
  },
  {
    number: "03",
    title: "Accountable Data",
    body: "Facility and country layers protect sensitive health records while making encounter-level reporting easier to trust.",
    href: "/resources/api-docs",
    icon: "shield",
  },
  {
    number: "04",
    title: "Facility data to national insight",
    body: "Clean clinical records become facility dashboards, surveillance signals, DHIS2-ready reports, and better national health planning.",
    href: "/analytics",
    icon: "network",
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
