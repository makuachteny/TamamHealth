import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";

export const metadata: Metadata = {
  title: "Installation · TamamHealth Digital Health",
  description: "How TamamHealth is deployed for a South Sudan facility — offline-first architecture, in-country data residency, and the rollout process.",
};

const STAGES = [
  {
    step: "01",
    title: "Facility assessment",
    body: "We review your facility's connectivity, power reliability, device inventory, and current paper workflows to size the right deployment and plan staff training.",
  },
  {
    step: "02",
    title: "In-country server setup",
    body: "TamamHealth runs on a single server hosted in South Sudan — never on foreign cloud infrastructure. Every byte of patient data stays in-country, encrypted at rest and in transit.",
  },
  {
    step: "03",
    title: "Facility onboarding",
    body: "Devices are configured, staff accounts are created with role-based access, and the clinical team is trained on registration, triage, consultation, lab, pharmacy, and billing workflows.",
  },
  {
    step: "04",
    title: "Go-live with offline-first sync",
    body: "Clinicians work directly in the browser with a local, offline-capable copy of the record. When connectivity is available, changes sync automatically to the facility server — nothing is lost during outages.",
  },
  {
    step: "05",
    title: "Verification & handover",
    body: "We walk through a go-live checklist together — data isolation between facilities, backup and restore, and offline resilience — before handing over day-to-day operation.",
  },
];

const ARCHITECTURE = [
  {
    title: "Facility node — the browser",
    body: "The clinical app runs directly in the browser and keeps a local copy of the record. Registration, triage, consultation, lab, pharmacy, and billing all keep working with no network connection.",
  },
  {
    title: "Facility server — the sync hub",
    body: "A single in-country server holds the durable, encrypted patient record that every facility device replicates to and from. This is the only place patient data is stored outside a clinician's browser.",
  },
  {
    title: "National layer — reporting, not custody",
    body: "Aggregated, DHIS2-ready reporting flows upward for national health planning. Clinicians keep working even when this layer is unreachable — it never holds the source record.",
  },
];

const SAFEGUARDS = [
  "Encrypted at rest and in transit, on servers located in South Sudan",
  "Role-based access control, scoped per facility by default",
  "Every create, update, and delete is written to an append-only audit trail",
  "Automated, encrypted backups with regular restore testing",
  "Offline-first by design — clinical work never stops for a network or power outage",
];

export default function InstallationPage() {
  return (
    <>
      <main className="mk-main">
        <MarketingHero
          variant="split"
          eyebrow="INSTALLATION"
          title="How TamamHealth is deployed, facility by facility"
          subtitle="TamamHealth is pre-launch — this is the deployment approach we've designed and documented for our first pilot facilities, built around offline-first care and in-country data residency."
          primaryCta={{ label: "Talk to our team", href: "/about/contact?intent=demo#contact-form" }}
          secondaryCta={{ label: "See the architecture", href: "#architecture" }}
          className="mk-hero-installation"
        />

        <section className="mk-section mk-section-after-hero mk-section-white">
          <div className="mk-container">
            <Reveal>
              <div className="mk-section-heading">
                <p className="mk-label">Rollout process</p>
                <h2 className="mk-h2">From facility assessment to go-live</h2>
              </div>
            </Reveal>
            <div className="mk-install-stages">
              {STAGES.map((stage) => (
                <Reveal key={stage.step}>
                  <div className="mk-install-stage">
                    <span className="mk-install-stage-number">{stage.step}</span>
                    <h3>{stage.title}</h3>
                    <p>{stage.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="architecture" className="mk-section mk-section-cream">
          <div className="mk-container">
            <Reveal>
              <div className="mk-section-heading">
                <p className="mk-label">Architecture</p>
                <h2 className="mk-h2">Offline-first, three tiers, one patient record</h2>
              </div>
            </Reveal>
            <div className="mk-install-architecture">
              {ARCHITECTURE.map((tier) => (
                <Reveal key={tier.title}>
                  <div className="mk-install-tier">
                    <h3>{tier.title}</h3>
                    <p>{tier.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-section mk-section-white">
          <div className="mk-container">
            <Reveal>
              <div className="mk-section-heading">
                <p className="mk-label">Data residency &amp; safeguards</p>
                <h2 className="mk-h2">Built to protect patient data by default</h2>
              </div>
            </Reveal>
            <Reveal>
              <ul className="mk-install-safeguards">
                {SAFEGUARDS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal>
              <p className="mk-install-cta-text">
                Want the technical detail behind a specific step?{" "}
                <Link href="/about/contact?intent=demo#contact-form">Talk to our team</Link> — we walk every pilot
                partner through the deployment plan before anything goes live.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
