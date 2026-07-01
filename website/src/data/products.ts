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
    tagline: "Comprehensive ERP for State, County & Referral hospitals",
    description: "A connected facility platform for OPD, IPD, ward management, laboratory, imaging, pharmacy, billing, HR, and reporting, all tied to the same patient record and built for intermittent connectivity.",
    modules: ["Patient Registry", "Outpatient & Inpatient", "Ward & Bed Management", "Laboratory", "Imaging", "Pharmacy", "Billing & Payments", "HR & Payroll", "Reporting & BI", "DHIS2 Sync"],
    accent: "var(--tb-blue-700)",
    bg: "var(--tb-tint-blue)",
    image: "/assets/doctor-nurse-consultation.jpg",
    imageAlt: "Hospital clinicians coordinating patient care",
  },
  {
    slug: "clinic",
    title: "Clinic Management System",
    acronym: "CMS",
    tagline: "Lean platform for PHCUs, private practices & faith-based clinics",
    description: "Everything a single-site clinic needs to run a full patient day: registration, consultation, prescriptions, basic lab, pharmacy dispensing, billing, and offline-first records without duplicating paperwork.",
    modules: ["Patient Registry", "Outpatient Consultation", "Lab Orders", "Pharmacy Dispensing", "Billing", "Reporting", "HR Records", "DHIS2 Sync"],
    accent: "var(--tb-green-dark)",
    bg: "var(--tb-tint-green)",
    image: "/assets/community-health-worker.jpg",
    imageAlt: "Community health worker at a primary care clinic",
  },
  {
    slug: "lab",
    title: "Laboratory Information System",
    acronym: "LIS",
    tagline: "Order-to-result for diagnostic centres & hospital labs",
    description: "Receive orders from any clinician, run bench workflows, capture results, validate, and release them back into the encounter so lab data stays connected to clinical care.",
    modules: ["Order Intake", "Specimen Tracking", "Result Capture", "Quality Control", "TAT Dashboards", "Instrument Integration (LIS-2A)", "Critical Result Alerts", "Reporting"],
    accent: "var(--tb-gold-dark)",
    bg: "var(--tb-tint-gold)",
    image: "/assets/doctor-writing-notes.jpg",
    imageAlt: "Lab staff recording results",
  },
  {
    slug: "radiology",
    title: "Radiology Information System",
    acronym: "RIS",
    tagline: "Imaging workflow for radiology centres & hospital imaging departments",
    description: "Schedule modalities, accession studies, capture findings, and deliver reports back to the ordering clinician with patient history and imaging workflows connected to the same record.",
    modules: ["Modality Scheduling", "Accession Numbers", "Study Worklist", "Structured Reporting", "PACS Integration", "DICOM Export", "Patient History", "Reporting"],
    accent: "var(--tb-blue-700)",
    bg: "var(--tb-tint-blue)",
    image: "/assets/doctor-tablet-review.jpg",
    imageAlt: "Radiologist reviewing imaging on a workstation",
  },
  {
    slug: "pharmacy",
    title: "Pharmacy Management System",
    acronym: "PMS",
    tagline: "Stock-to-dispense for retail pharmacies & hospital pharmacies",
    description: "Track medicines from stock to dispense, manage batches and expiry, fill electronic prescriptions, reconcile payments, and keep pharmacy activity visible to facility teams.",
    modules: ["Inventory & Batches", "Expiry Tracking", "Reorder Alerts", "Electronic Rx Dispensing", "POS for OTC", "Controlled Substances Log", "Supplier Orders", "Reporting"],
    accent: "var(--tb-green-dark)",
    bg: "var(--tb-tint-green)",
    image: "/assets/doctor-prescription.jpg",
    imageAlt: "Pharmacist preparing a prescription",
  },
  {
    slug: "feedback",
    title: "Patient Feedback Survey",
    acronym: "PFS",
    tagline: "Closed-loop patient experience capture",
    description: "Collect satisfaction ratings and open-ended comments at the bedside, kiosk, SMS, or WhatsApp, then connect follow-up workflows to the facility view.",
    modules: ["Multi-channel Capture", "5-star + NPS Scoring", "Auto Sentiment Detection", "Follow-up Workflow", "Department Trends", "Anonymous Mode"],
    accent: "var(--tb-gold-dark)",
    bg: "var(--tb-tint-gold)",
    image: "/assets/african-nurse.jpg",
    imageAlt: "Health worker capturing patient feedback on a phone",
  },
];
