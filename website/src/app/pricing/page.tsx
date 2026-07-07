"use client";

import Link from "next/link";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";
import { Check } from "@/components/marketing/icons";

const PACKAGES = [
  {
    name: "Clinic start",
    description: "For a single clinic starting with patient records and daily operations.",
    items: ["Patient registry", "Consultation notes", "Basic pharmacy workflow", "Billing record", "Setup support"],
  },
  {
    name: "Hospital workflow",
    description: "For facilities connecting front desk, clinical care, lab, pharmacy, billing, and reporting.",
    items: ["Shared patient record", "Triage and consultation", "Lab and pharmacy workflows", "Facility dashboard", "Training plan"],
  },
  {
    name: "Pilot partnership",
    description: "For partners planning a controlled first deployment with implementation support.",
    items: ["Workflow scoping", "Deployment plan", "Staff onboarding", "Feedback cycle", "Pilot success review"],
  },
] as const;

export default function PricingPage() {
  return (
    <main className="mk-main">
      <MarketingHero
        variant="showcase"
        eyebrow="PRICING"
        title="Pricing after a short walkthrough."
        subtitle="Tamam is priced by facility type, workflows, users, hosting needs, and rollout support. We keep the quote scoped to what you actually plan to use."
        primaryCta={{ label: "Request pricing", href: "/about/contact?intent=pricing#contact-form" }}
        secondaryCta={{ label: "See starting points", href: "#packages" }}
        stats={[
          { value: "Scoped", label: "to your facility" },
          { value: "Modular", label: "by workflow" },
          { value: "Pilot", label: "friendly" },
        ]}
        className="mk-hero-pricing"
      />

      <section className="mk-section mk-section-white" id="packages">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading" style={{ maxWidth: 700 }}>
              <p className="mk-label">STARTING POINTS</p>
              <h2 className="mk-h2">Choose the first workflow, then grow from there.</h2>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 18 }}>
            {PACKAGES.map((pkg) => (
              <Reveal key={pkg.name}>
                <article style={{
                  background: "var(--tb-cream-50)",
                  border: "1px solid var(--tb-cream-300)",
                  borderRadius: 8,
                  padding: 24,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 22, color: "var(--tb-text-pri)" }}>{pkg.name}</h3>
                  <p style={{ margin: "0 0 18px", color: "var(--tb-text-sec)", lineHeight: 1.55 }}>{pkg.description}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "grid", gap: 10 }}>
                    {pkg.items.map((item) => (
                      <li key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--tb-text-sec)", fontSize: 14 }}>
                        <Check size={16} strokeWidth={1.9} style={{ color: "var(--tb-green-dark)", flex: "0 0 auto", marginTop: 2 }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/about/contact?intent=pricing#contact-form" className="mk-btn mk-btn-outline-green" style={{ marginTop: "auto", justifyContent: "center" }}>
                    Request quote
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split" style={{ alignItems: "center" }}>
              <div className="mk-split-content">
                <p className="mk-label">WHAT WE NEED TO QUOTE</p>
                <h2 className="mk-h2">A better quote starts with a real conversation.</h2>
                <p className="mk-body" style={{ lineHeight: 1.65 }}>
                  Tell us your facility type, number of users, priority workflows, hosting preference, training needs, and target launch timing. We will respond with a practical proposal instead of a generic price table.
                </p>
              </div>
              <div style={{
                background: "var(--tb-cream-50)",
                border: "1px solid var(--tb-cream-300)",
                borderRadius: 8,
                padding: 24,
              }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 18 }}>Typical scoping questions</h3>
                <ul style={{ margin: 0, paddingLeft: 20, color: "var(--tb-text-sec)", lineHeight: 1.8 }}>
                  <li>Is this a clinic, hospital, lab, or pharmacy?</li>
                  <li>Which workflow should launch first?</li>
                  <li>How many staff will use the system?</li>
                  <li>Will the facility need offline sync or local hosting?</li>
                  <li>Who will own training and rollout support?</li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
