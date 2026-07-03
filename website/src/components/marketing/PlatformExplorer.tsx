"use client";

import { useState } from "react";
import Image from "next/image";
import { Reveal } from "./MarketingShared";
import { PlatformWorkflowPlayer } from "./PlatformWorkflowPlayer";

interface ExplorerProduct {
  slug: string;
  tab: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
}

const EXPLORER_PRODUCTS: ExplorerProduct[] = [
  {
    slug: "hospital",
    tab: "Hospital",
    eyebrow: "HOSPITAL MANAGEMENT SYSTEM",
    title: "One platform for the whole hospital.",
    subtitle: "From the OPD queue at 6am to the night-shift handover, TamamHealth HMIS runs every department on one shared patient record.",
    accent: "var(--tb-blue-700)",
  },
  {
    slug: "clinic",
    tab: "Clinic",
    eyebrow: "CLINIC MANAGEMENT SYSTEM",
    title: "Everything a clinic needs. Nothing it doesn't.",
    subtitle: "Run your full patient day on one screen — registration, consultation, prescription, dispensing, billing.",
    accent: "var(--tb-green-dark)",
  },
  {
    slug: "lab",
    tab: "Laboratory",
    eyebrow: "LABORATORY INFORMATION SYSTEM",
    title: "From order to result — without the paperwork.",
    subtitle: "Run the bench workflow with turnaround-time tracking, instrument integration, and critical-value alerts.",
    accent: "var(--tb-gold-dark)",
  },
  {
    slug: "radiology",
    tab: "Radiology",
    eyebrow: "RADIOLOGY INFORMATION SYSTEM",
    title: "Schedule. Acquire. Report. Send.",
    subtitle: "A modality-first imaging workflow that keeps radiographers and reporting radiologists in sync, even remotely.",
    accent: "#2191D0",
  },
  {
    slug: "pharmacy",
    tab: "Pharmacy",
    eyebrow: "PHARMACY MANAGEMENT SYSTEM",
    title: "Stock in. Rx out. Counted right.",
    subtitle: "Tight inventory control with batch + expiry tracking, e-prescription dispensing, and a clean controlled-substance trail.",
    accent: "var(--tb-green-dark)",
  },
  {
    slug: "feedback",
    tab: "Patient Feedback",
    eyebrow: "PATIENT FEEDBACK SURVEY",
    title: "Hear every patient. Close every loop.",
    subtitle: "Capture satisfaction in person, by SMS, WhatsApp, or kiosk. Negative feedback auto-flags for follow-up.",
    accent: "var(--tb-gold-dark)",
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
              <div className="mk-platform-explorer-shot">
                <Image
                  src="/assets/Dashboard.png"
                  alt="TamamHealth system dashboard"
                  width={1280}
                  height={740}
                />
              </div>
            </div>

            <div className="mk-platform-explorer-content">
              {/* Clickable walkthrough of this product's workflow — the
                  panel's main content, right beside the intro copy. */}
              <PlatformWorkflowPlayer slug={active.slug} accent={active.accent} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
