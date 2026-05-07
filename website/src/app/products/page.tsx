import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/marketing/MarketingShared";
import { DuoIcon } from "@/components/marketing/DuoIcon";

export const metadata: Metadata = {
  title: "Services · TamamHealth Digital Health",
  description: "Specialty-focused digital health services for South Sudan — hospitals, clinics, labs, radiology, pharmacy, and patient feedback.",
};

interface ProductCard {
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

const PRODUCTS: ProductCard[] = [
  {
    slug: "hospital",
    title: "Hospital Management System",
    acronym: "HMIS",
    tagline: "Comprehensive ERP for State, County & Referral hospitals",
    description: "Single platform that runs every department of a Level 3+ hospital — OPD, IPD, ward management, laboratory, imaging, pharmacy, billing, HR, and reporting — built for the realities of intermittent connectivity in South Sudan.",
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
    description: "Everything a single-site clinic needs to run a full patient day — registration, consultation, prescriptions, basic lab, pharmacy dispensing, billing, and offline-first records — without paying for inpatient features it doesn't need.",
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
    description: "Receive orders from any clinician, run the workflow on bench, capture results, validate, and release — with TAT tracking, instrument integration, and outbound HL7 to the referring EMR.",
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
    description: "Schedule modalities, accession studies, capture findings, and deliver reports back to the ordering clinician — with PACS integration and DICOM export when you need it.",
    modules: ["Modality Scheduling", "Accession Numbers", "Study Worklist", "Structured Reporting", "PACS Integration", "DICOM Export", "Patient History", "Reporting"],
    accent: "#1B7FA8",
    bg: "rgba(27, 127, 168, 0.10)",
    image: "/assets/doctor-tablet-review.jpg",
    imageAlt: "Radiologist reviewing imaging on a workstation",
  },
  {
    slug: "pharmacy",
    title: "Pharmacy Management System",
    acronym: "PMS",
    tagline: "Stock-to-dispense for retail pharmacies & hospital pharmacies",
    description: "Receive stock with batch + expiry, manage reorder thresholds, dispense against electronic prescriptions, run POS for over-the-counter sales, and reconcile at end of day — with controlled-substance audit trail.",
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
    description: "Collect satisfaction ratings + open-ended comments at the bedside, kiosk, SMS, or WhatsApp. Negative feedback auto-flags for follow-up so nothing falls through the cracks.",
    modules: ["Multi-channel Capture", "5-star + NPS Scoring", "Auto Sentiment Detection", "Follow-up Workflow", "Department Trends", "Anonymous Mode"],
    accent: "var(--tb-gold-dark)",
    bg: "var(--tb-tint-gold)",
    image: "/assets/african-nurse.jpg",
    imageAlt: "Health worker capturing patient feedback on a phone",
  },
];

export default function ProductsPage() {
  return (
    <>
      
      <main className="mk-main">
        {/* Hero — side-by-side */}
        <section className="mk-hero-split">
          <div className="mk-container">
            <div className="mk-hero-split-grid">
              <Reveal>
                <div className="mk-hero-split-text">
                  <p className="mk-label">OUR SERVICES</p>
                  <h1 className="mk-h1">Specialty-focused digital health services</h1>
                  <p>
                    Six purpose-built services on one platform — pick what fits the kind of facility you run.
                    Every service shares the same patient record, same offline sync, and same DHIS2 reporting.
                  </p>
                  <div className="mk-hero-split-actions">
                    <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-lg">Request a demo</Link>
                    <Link href="#products-grid" className="mk-btn mk-btn-outline mk-btn-lg">Browse services</Link>
                  </div>
                  <span className="mk-hero-split-meta">
                    <DuoIcon name="info" size={12} />
                    Pre-launch · Pilot facilities welcome
                  </span>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="mk-hero-split-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/doctor-tablet-smiling.jpg"
                    alt="African clinician reviewing patient records on a tablet"
                    loading="eager"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Product grid */}
        <section id="products-grid" className="mk-section mk-section-after-hero mk-section-white">
          <div className="mk-container">
            <Reveal>
              <div className="mk-section-heading">
                <h2 className="mk-h2">The management systems we serve</h2>
              </div>
            </Reveal>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
                gap: 24,
              }}
            >
              {PRODUCTS.map((p, i) => (
                <Reveal key={p.slug} delay={i * 0.04}>
                  <Link
                    href={`/products/${p.slug}`}
                    style={{ textDecoration: "none", display: "block", height: "100%" }}
                  >
                    <div
                      style={{
                        background: "var(--tb-cream-50)",
                        border: "1px solid var(--tb-cream-300)",
                        borderRadius: 16,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
                      }}
                      className="mk-product-list-card"
                    >
                      {/* Image hero */}
                      <div style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "16 / 9",
                        background: p.bg,
                        overflow: "hidden",
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image}
                          alt={p.imageAlt}
                          loading="lazy"
                          style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            objectPosition: "center 25%",
                          }}
                        />
                      </div>

                      <div style={{ padding: "22px 24px 24px", display: "flex", flexDirection: "column", flex: 1 }}>
                        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "var(--tb-text-pri)" }}>{p.title}</h3>
                        <p style={{ fontSize: 14, color: p.accent, fontWeight: 600, margin: "0 0 14px" }}>{p.tagline}</p>
                      <p style={{ fontSize: 14.5, color: "var(--tb-text-sec)", lineHeight: 1.55, marginBottom: 16, flex: 1 }}>
                        {p.description}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                        {p.modules.slice(0, 6).map(m => (
                          <span
                            key={m}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--tb-text-sec)",
                              background: "var(--tb-cream-100)",
                              border: "1px solid var(--tb-cream-300)",
                              padding: "3px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {m}
                          </span>
                        ))}
                        {p.modules.length > 6 && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: p.accent,
                              padding: "3px 8px",
                            }}
                          >
                            +{p.modules.length - 6} more
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 14, fontWeight: 700,
                          color: p.accent,
                          display: "inline-flex", alignItems: "center", gap: 6,
                          marginTop: "auto",
                        }}
                      >
                        Learn more
                        <DuoIcon name="arrow-right" size={14} />
                      </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mk-cta-banner">
          <div className="mk-container mk-cta-narrow">
            <h2 className="mk-h2" style={{ marginBottom: 16 }}>Not sure which service fits?</h2>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--tb-text-sec)", marginBottom: 28 }}>
              Tell us about your facility — we&rsquo;ll recommend the right combination and walk you through pricing.
            </p>
            <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-lg">Talk to our team</Link>
          </div>
        </section>

      </main>
      
    </>
  );
}
