"use client";

import Image from "next/image";
import Link from "next/link";
import { HOME_AUDIENCES, HOME_LEARN_MORE, HOME_PRINCIPLES, HOME_PROBLEM_STATS } from "@/data/home";
import { ArrowRight, FileText, HeartPulse, Network, ShieldCheck } from "@/components/marketing/icons";
import { Reveal, RelatedLinksGrid, SplitFeatureBlock } from "@/components/marketing/MarketingShared";
import { MarketingActionModalButton } from "@/components/marketing/MarketingActionModal";

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

export function HomeProblemSection() {
  return (
    <section className="mk-section mk-section-white mk-home-problem">
      <div className="mk-container">
        <Reveal>
          <div className="mk-home-problem-intro">
            <p className="mk-label">The problem</p>
            <h2 className="mk-h2">Care decisions are being made with data that doesn&apos;t exist yet.</h2>
            <p className="mk-body-lg">
              Paper registers don&apos;t travel between departments, let alone facilities. By the time a chart, a
              stock count, or a case count reaches anyone who can act on it, the moment to act on it has often
              passed.
            </p>
          </div>
        </Reveal>

        <div className="mk-home-problem-stats">
          {HOME_PROBLEM_STATS.map((stat, index) => (
            <Reveal key={stat.value} delay={index * 0.06}>
              <div className="mk-home-problem-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeMissionBand() {
  return (
    <SplitFeatureBlock
      eyebrow="Our mission"
      title="Every patient's story should follow them — from a village health post to the Ministry of Health."
      body="No matter what the network is doing, the record a health worker starts should still be the record a facility leader sees, and the record a Ministry analyst reports on — the same story, not three different ones."
      href="/products#products-grid"
      linkLabel="See how the platform delivers on it"
      image="/assets/village-community.jpg"
      imageAlt="A village community gathered near a health post in South Sudan"
      tone="navy"
    />
  );
}

export function HomeAudienceSection() {
  return (
    <RelatedLinksGrid
      heading="Built around the people who keep a facility running"
      items={HOME_AUDIENCES.map((item) => ({
        label: "Who it's for",
        title: item.title,
        body: item.body,
        href: item.href,
        image: item.image,
      }))}
    />
  );
}

export function HomeFinalCta() {
  return (
    <section className="mk-home-final-cta">
      <div className="mk-container mk-home-final-cta-inner">
        <Reveal>
          <h2 className="mk-h2">Ready to bring one record to your facility?</h2>
        </Reveal>
        <Reveal>
          <p className="mk-body-lg">
            We&apos;re taking on pilot partners across South Sudan. Let&apos;s talk about what your facility needs.
          </p>
        </Reveal>
        <Reveal>
          <div className="mk-home-final-cta-actions">
            <MarketingActionModalButton
              intent="demo"
              className="mk-btn mk-btn-green"
              source="home-final-cta"
            >
              Book a Demo
            </MarketingActionModalButton>
            <Link href="/about/contact" className="mk-btn mk-btn-outline">
              Talk to our team
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function HomePrinciplesSection() {
  return (
    <section className="mk-products-section">
      <div className="mk-container">
        <Reveal>
          <div className="mk-products-header">
            <p className="mk-label">why it matters</p>
            <h2 className="mk-h2">The value shows up on day one, not after a rollout.</h2>
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
            <p className="mk-label">The solution</p>
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
                <span>One workflow, start to finish</span>
              </h2>
              <p>
                TamamHealth links every step — registration through reporting — back to the same patient encounter, so the record a nurse starts is the same one a Ministry analyst sees later. No re-entry, no separate systems to reconcile.
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
