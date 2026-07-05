export const HOME_PRINCIPLES = [
  {
    number: "01",
    title: "One record across every visit",
    body: "Registration, triage, consultation, lab, pharmacy, referral, billing, and reporting stay connected to the same patient story.",
    icon: "record",
  },
  {
    number: "02",
    title: "Care that keeps working offline",
    body: "Clinics keep working through unreliable internet, power interruptions, and paper-heavy workflows, then sync safely when connection returns.",
    icon: "offline",
  },
  {
    number: "03",
    title: "Accountable Data",
    body: "Facility and country layers protect sensitive health records while making encounter-level reporting easier to trust.",
    icon: "shield",
  },
  {
    number: "04",
    title: "Facility data to national insight",
    body: "Clean clinical records become facility dashboards, surveillance signals, DHIS2-ready reports, and better national health planning.",
    icon: "network",
  },
] as const;

/* The Problem — every figure is cited in the sources strip below the section.
   Sources: WHO, UNFPA South Sudan, UN OCHA HNRP 2026, World Bank. */
export const HOME_CRISIS_STATS = [
  {
    value: "1,223",
    unit: "maternal deaths per 100,000 live births",
    context: "The highest maternal mortality rate in the world. In the US, the rate is under 20.",
    source: "WHO",
  },
  {
    value: "1 : 65,000",
    unit: "doctors to people",
    context: "One physician serves roughly 65,000 people — among the lowest ratios on Earth.",
    source: "WHO / UNFPA",
  },
  {
    value: "40%",
    unit: "of health facilities are functional",
    context: "Fewer than half of clinics and hospitals can actually deliver care.",
    source: "UNFPA",
  },
  {
    value: "10M+",
    unit: "people need humanitarian assistance",
    context: "Two-thirds of the entire population, projected for 2026.",
    source: "UN OCHA",
  },
] as const;

export const HOME_GOAL_STATS = [
  { value: "$100K", label: "pilot goal to launch across 10 clinics" },
  { value: "10", label: "clinics in Juba and greater South Sudan" },
  { value: "12mo", label: "from equipment to measurement and scale" },
] as const;

export const HOME_TEAM = [
  { name: "Teny Makuach", role: "Founder", image: "/assets/founder-teny.jpg", initials: "TM" },
  { name: "Ekow Williams", role: "Community & Partnerships", image: "/assets/founder-ekow.jpg", initials: "EW" },
  { name: "Toye Adebayo", role: "Project Manager", image: "/assets/founder-toye.jpg", initials: "TA" },
  { name: "Mark Dosu", role: "Software Developer", image: "/assets/Mark-Dosu.jpeg", initials: "MD" },
  { name: "Chinonye Hycent", role: "Research Lead", image: "/assets/chinonye-hycent.jpg", initials: "CH" },
  { name: "Isaac Kyalo", role: "Technical Lead", image: "/assets/isaac-kyalo.jpg", initials: "IK" },
] as const;
