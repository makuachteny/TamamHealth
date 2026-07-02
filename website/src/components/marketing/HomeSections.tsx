"use client";

import Image from "next/image";
import Link from "next/link";
import { HOME_LEARN_MORE, HOME_PRINCIPLES } from "@/data/home";
import { ArrowRight, FileText, HeartPulse, Network, ShieldCheck } from "@/components/marketing/icons";
import { Reveal } from "@/components/marketing/MarketingShared";

const PRINCIPLE_ICONS = {
  record: <FileText size={48} strokeWidth={1.7} />,
  offline: <HeartPulse size={48} strokeWidth={1.7} />,
  shield: <ShieldCheck size={48} strokeWidth={1.7} />,
  network: <Network size={48} strokeWidth={1.7} />,
} as const;

const PLATFORM_WORKFLOW_STEPS = [
  "Register",
  "Triage",
  "Consult",
  "Order",
  "Dispense",
  "Bill",
  "Report",
] as const;

const PLATFORM_OUTCOMES = [
  {
    title: "No duplicate records",
    body: "Each visit adds to the same patient story, so teams stop rebuilding history from paper slips.",
  },
  {
    title: "One source for operations",
    body: "Clinical work, pharmacy activity, billing, and reporting all stay connected to the encounter.",
  },
  {
    title: "Built for low connectivity",
    body: "Facilities can keep working through network gaps and sync when the connection returns.",
  },
] as const;

export function HomePrinciplesSection() {
  return (
    <section className="mk-products-section">
      <div className="mk-container">
        <Reveal>
          <div className="mk-products-header">
            <p className="mk-label">what guides us</p>
            <h2 className="mk-h2">Simple enough for the front desk. Strong enough for the nation.</h2>
          </div>
        </Reveal>

        <div className="mk-products-grid mk-home-numbered-grid">
          {HOME_PRINCIPLES.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05}>
              <Link href={item.href} className="mk-home-card-link">
                <div className="mk-product-card mk-home-numbered-card">
                  <span>{item.number}</span>
                  <div className="mk-product-card-icon">
                    {PRINCIPLE_ICONS[item.icon]}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <span className="mk-product-card-link">
                    Learn more <ArrowRight size={14} strokeWidth={1.8} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomePlatformSection() {
  return (
    <section className="mk-section mk-section-white mk-home-platform-section">
      <div className="mk-container">
        <Reveal>
          <div className="mk-home-platform-flow">
            <p className="mk-label">The FLOW</p>
            <div className="mk-home-platform-flow-line" aria-label="TamamHealth workflow from registration to reporting">
              {PLATFORM_WORKFLOW_STEPS.map((step) => (
                <span key={step}>{step}</span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-split mk-home-platform-split">
            <div className="mk-split-image mk-dashboard-showcase">
              <Image
                src="/assets/Dashboard.png"
                alt="TamamHealth platform dashboard"
                width={1280}
                height={740}
                priority
              />
            </div>
            <div className="mk-split-content">
              <h2 className="mk-h2 mk-home-platform-heading">
                <span>Workflow</span>
              </h2>
              <p>
                From the front desk to the ward, every step in TamamHealth links back to the same patient encounter. Clinicians, facility teams, and health leaders can work from cleaner records without duplicating data.
              </p>
              <div className="mk-home-platform-checks">
                <span>Patient history</span>
                <span>Facility operations</span>
                <span>National reporting</span>
              </div>
              <Link href="/products#products-grid" className="mk-btn mk-btn-outline-green mk-home-platform-cta">
                Explore the platform
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-home-platform-outcomes">
            {PLATFORM_OUTCOMES.map((item) => (
              <div className="mk-home-platform-outcome" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function HomeLearnSection() {
  return (
    <section className="mk-section mk-section-cream" id="learn">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-heading">
            <p className="mk-label">learn more</p>
            <h2 className="mk-h2">Find your place in the mission.</h2>
          </div>
        </Reveal>

        <div className="mk-home-learn-grid">
          {HOME_LEARN_MORE.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05}>
              <Link href={item.href} className="mk-home-card-link">
                <div className="mk-value-card mk-home-learn-card">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <span className="mk-product-card-link">
                    Learn more <ArrowRight size={14} strokeWidth={1.8} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
