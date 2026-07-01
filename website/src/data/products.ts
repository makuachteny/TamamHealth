export interface ProductCard {
  slug: string;
  title: string;
  acronym: string;
  tagline: string;
  description: string;
  modules: string[];
  accent: string;
  bg: string;
  image: string;
  imageAlt: string;
}

export const PRODUCT_CARDS: ProductCard[] = [
  {
    slug: "hospital",
    title: "Hospital Management System",
    acronym: "HMIS",
    tagline: "A single patient record for busy facilities",
    description: "Registration, triage, consultation, pharmacy, lab, billing, and reporting stay connected to the same patient record, even when connectivity is unreliable.",
    modules: ["Patient Registry", "Triage & Consultation", "Lab & Pharmacy", "Billing", "Reporting"],
    accent: "var(--tb-blue-700)",
    bg: "var(--tb-tint-blue)",
    image: "/assets/doctor-nurse-consultation.jpg",
    imageAlt: "Hospital clinicians coordinating patient care",
  },
  {
    slug: "clinic",
    title: "Clinic Management System",
    acronym: "CMS",
    tagline: "Lean records for clinics moving off paper",
    description: "A focused workflow for registration, consultation, prescriptions, dispensing, billing, and follow-up without a heavy hospital system.",
    modules: ["Registration", "Consultation", "Prescriptions", "Billing", "Follow-up"],
    accent: "var(--tb-green-dark)",
    bg: "var(--tb-tint-green)",
    image: "/assets/community-health-worker.jpg",
    imageAlt: "Community health worker at a primary care clinic",
  },
  {
    slug: "lab",
    title: "Laboratory Information System",
    acronym: "LIS",
    tagline: "Orders and results tied to the visit",
    description: "Send lab orders from the encounter, capture results, flag critical findings, and return them to the clinician without paper slips.",
    modules: ["Order Intake", "Result Capture", "Critical Flags", "Reporting"],
    accent: "var(--tb-gold-dark)",
    bg: "var(--tb-tint-gold)",
    image: "/assets/doctor-writing-notes.jpg",
    imageAlt: "Lab staff recording results",
  },
  {
    slug: "pharmacy",
    title: "Pharmacy Management System",
    acronym: "PMS",
    tagline: "Stock, prescriptions, and dispensing",
    description: "Track medicine stock, expiry, prescriptions, dispensing, and payments so pharmacy work stays visible to the care team.",
    modules: ["Inventory", "Expiry Tracking", "Dispensing", "Payments", "Reporting"],
    accent: "var(--tb-green-dark)",
    bg: "var(--tb-tint-green)",
    image: "/assets/doctor-prescription.jpg",
    imageAlt: "Pharmacist preparing a prescription",
  },
];
