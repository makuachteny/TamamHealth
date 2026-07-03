"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal } from "./MarketingShared";
import { ProductIllustration, type ProductMockVariant } from "./ProductPage";
import { Check } from "@/components/marketing/icons";

interface ExplorerProduct {
  slug: string;
  tab: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  variant: ProductMockVariant;
  modules: { title: string; description: string }[];
  benefits: { title: string; description: string }[];
}

const EXPLORER_PRODUCTS: ExplorerProduct[] = [
  {
    slug: "hospital",
    tab: "Hospital",
    eyebrow: "HOSPITAL MANAGEMENT SYSTEM",
    title: "One platform for the whole hospital.",
    subtitle: "From the OPD queue at 6am to the night-shift handover, TamamHealth HMIS runs every department on one shared patient record.",
    accent: "var(--tb-blue-700)",
    variant: "vitals",
    modules: [
      { title: "Patient Registry", description: "Geocode-anchored identifier, household linkage, dedup across visits." },
      { title: "Outpatient Care", description: "Triage queue, consultation workflow, AI-assisted SOAP notes." },
      { title: "Inpatient Care", description: "Admission orders, progress notes, MAR, discharge summaries." },
      { title: "Ward & Bed Management", description: "Live bed map, occupancy %, isolation flags, turnover workflow." },
      { title: "Laboratory & Imaging", description: "Order setup, sample tracking, modality scheduling, PACS-ready." },
      { title: "Pharmacy & Billing", description: "Batch/expiry inventory, e-Rx, mobile money, insurance claims." },
    ],
    benefits: [
      { title: "Offline-first by design", description: "Local copy on every workstation; syncs when the link returns." },
      { title: "DHIS2 sync out of the box", description: "Monthly HMIS 105 and epi reports push automatically." },
      { title: "Role-based by SS reality", description: "A dashboard for every cadre, from BHW to Med. Superintendent." },
    ],
  },
  {
    slug: "clinic",
    tab: "Clinic",
    eyebrow: "CLINIC MANAGEMENT SYSTEM",
    title: "Everything a clinic needs. Nothing it doesn't.",
    subtitle: "Run your full patient day on one screen — registration, consultation, prescription, dispensing, billing.",
    accent: "var(--tb-green-dark)",
    variant: "clinic",
    modules: [
      { title: "Patient Registration", description: "Walk-in registration with photo and geocode, under 90 seconds." },
      { title: "Consultation", description: "Offline SOAP templates per common condition." },
      { title: "Prescription & Dispensing", description: "Formulary-tied drug picker with weight-based dosing." },
      { title: "Lab Orders", description: "Rapid diagnostics ordered and resulted at the bench." },
      { title: "Billing & Payments", description: "Mobile money collection with daily reconciliation." },
      { title: "Appointments & Reports", description: "SMS reminders, auto-generated monthly HMIS." },
    ],
    benefits: [
      { title: "Up and running in a day", description: "Browser-based — no server install required." },
      { title: "Pay only for what you use", description: "Tier pricing by patient volume." },
      { title: "DHIS2 reports auto-built", description: "No double data entry for your monthly HMIS 105." },
    ],
  },
  {
    slug: "lab",
    tab: "Laboratory",
    eyebrow: "LABORATORY INFORMATION SYSTEM",
    title: "From order to result — without the paperwork.",
    subtitle: "Run the bench workflow with turnaround-time tracking, instrument integration, and critical-value alerts.",
    accent: "var(--tb-gold-dark)",
    variant: "lab",
    modules: [
      { title: "Order Intake", description: "Orders flow in from OPD, IPD, or external clinics." },
      { title: "Specimen Tracking", description: "Barcoded labels tracked accession → bench → released." },
      { title: "Result Capture & QC", description: "Reference-range validation with daily Westgard QC rules." },
      { title: "Instrument Integration", description: "LIS-2A and HL7 connectors for common analyzers." },
      { title: "Critical Result Alerts", description: "Auto-flagged and SMS-notified within 60 seconds." },
      { title: "TAT Dashboards", description: "Turnaround time per test, shift, and technologist." },
    ],
    benefits: [
      { title: "Cuts result-release time in half", description: "Direct instrument integration removes transcription." },
      { title: "Works disconnected", description: "Results queue locally and sync when the link returns." },
      { title: "SS reference ranges built in", description: "High-altitude and pediatric bands pre-configured." },
    ],
  },
  {
    slug: "radiology",
    tab: "Radiology",
    eyebrow: "RADIOLOGY INFORMATION SYSTEM",
    title: "Schedule. Acquire. Report. Send.",
    subtitle: "A modality-first imaging workflow that keeps radiographers and reporting radiologists in sync, even remotely.",
    accent: "#2191D0",
    variant: "imaging",
    modules: [
      { title: "Modality Scheduling", description: "Slot-based scheduling with prep and contrast warnings." },
      { title: "Worklist", description: "Live worklist on the modality console." },
      { title: "Structured Reporting", description: "Templated reports with prior-study comparison." },
      { title: "PACS Integration", description: "Push DICOM studies to a local or cloud PACS." },
      { title: "DICOM Export", description: "Patient CD/USB export with report PDF." },
      { title: "Patient History", description: "Every prior study one click away when reporting." },
    ],
    benefits: [
      { title: "Lossless thumbnails first", description: "See a thumbnail in seconds while the full study loads." },
      { title: "Reads anywhere with internet", description: "Radiologist in Juba, modality in Bor — reports flow back." },
      { title: "Optional PACS, no lock-in", description: "Use Orthanc, your existing PACS, or none at all." },
    ],
  },
  {
    slug: "pharmacy",
    tab: "Pharmacy",
    eyebrow: "PHARMACY MANAGEMENT SYSTEM",
    title: "Stock in. Rx out. Counted right.",
    subtitle: "Tight inventory control with batch + expiry tracking, e-prescription dispensing, and a clean controlled-substance trail.",
    accent: "var(--tb-green-dark)",
    variant: "pharmacy",
    modules: [
      { title: "Inventory & Batches", description: "FIFO + FEFO dispense logic enforced automatically." },
      { title: "Expiry Tracking", description: "30/60/90 day alerts with a quarantined-stock list." },
      { title: "Electronic Rx Dispensing", description: "Indication, dose, and allergies shown before dispensing." },
      { title: "POS for OTC", description: "Walk-in retail sales with mobile money and receipts." },
      { title: "Controlled Substances", description: "Two-staff witness sign-off with daily reconciliation." },
      { title: "Drug-Interaction Checking", description: "Flagged before the patient leaves the counter." },
    ],
    benefits: [
      { title: "Stops expired-stock dispensing", description: "FEFO logic plus barcode scan at dispense." },
      { title: "Mobile money at the counter", description: "M-Gurush, MTN MoMo, Airtel Money supported." },
      { title: "Works with hospital prescriptions", description: "Rx arrive electronically from TamamHealth HMIS." },
    ],
  },
  {
    slug: "feedback",
    tab: "Patient Feedback",
    eyebrow: "PATIENT FEEDBACK SURVEY",
    title: "Hear every patient. Close every loop.",
    subtitle: "Capture satisfaction in person, by SMS, WhatsApp, or kiosk. Negative feedback auto-flags for follow-up.",
    accent: "var(--tb-gold-dark)",
    variant: "feedback",
    modules: [
      { title: "Multi-channel Capture", description: "Bedside tablet, kiosk, SMS link, or WhatsApp short code." },
      { title: "5-star + NPS Scoring", description: "Star rating, NPS question, and free-text comment." },
      { title: "Auto Sentiment Detection", description: "1-2 star ratings route straight to the follow-up queue." },
      { title: "Follow-up Workflow", description: "Each negative response opens an owned, trackable ticket." },
      { title: "Department Trends", description: "Trend by department and by category." },
      { title: "Anonymous Mode", description: "Submit without identification where that's more comfortable." },
    ],
    benefits: [
      { title: "Catch problems before they escalate", description: "A bad kiosk rating today beats a complaint letter next week." },
      { title: "Built for low-literacy + multilingual", description: "Star icons and emoji faces, translated survey questions." },
      { title: "Free with HMIS / CMS", description: "Bundled at no extra cost with any other TamamHealth product." },
    ],
  },
];

export function PlatformExplorer() {
  const [activeSlug, setActiveSlug] = useState(EXPLORER_PRODUCTS[0].slug);
  const active = EXPLORER_PRODUCTS.find((p) => p.slug === activeSlug) ?? EXPLORER_PRODUCTS[0];

  return (
    <section className="mk-section mk-section-white mk-platform-explorer">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-heading">
            <p className="mk-label">Explore the platform</p>
            <h2 className="mk-h2">Six systems. One shared record.</h2>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-platform-explorer-tabs" role="tablist" aria-label="TamamHealth products">
            {EXPLORER_PRODUCTS.map((product) => (
              <button
                key={product.slug}
                type="button"
                role="tab"
                aria-selected={product.slug === activeSlug}
                className={`mk-platform-explorer-tab${product.slug === activeSlug ? " is-active" : ""}`}
                style={{ "--tab-accent": product.accent } as React.CSSProperties}
                onClick={() => setActiveSlug(product.slug)}
              >
                {product.tab}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal key={active.slug}>
          <div className="mk-platform-explorer-panel">
            <div className="mk-platform-explorer-intro">
              <p className="mk-label" style={{ color: active.accent }}>{active.eyebrow}</p>
              <h3 className="mk-h3">{active.title}</h3>
              <p className="mk-body">{active.subtitle}</p>
              <Link
                href={`/products/${active.slug}`}
                className="mk-platform-explorer-link"
                style={{ color: active.accent }}
              >
                See full details →
              </Link>
              <div className="mk-platform-explorer-illustration">
                <ProductIllustration accent={active.accent} variant={active.variant} />
              </div>
            </div>

            <div className="mk-platform-explorer-content">
              <div className="mk-platform-explorer-modules">
                {active.modules.map((moduleItem) => (
                  <div className="mk-platform-explorer-module" key={moduleItem.title}>
                    <strong>{moduleItem.title}</strong>
                    <p>{moduleItem.description}</p>
                  </div>
                ))}
              </div>

              <div className="mk-platform-explorer-benefits">
                {active.benefits.map((benefit) => (
                  <div className="mk-platform-explorer-benefit" key={benefit.title}>
                    <span className="mk-platform-explorer-check" style={{ background: active.accent }}>
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                    <div>
                      <strong>{benefit.title}</strong>
                      <p>{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
