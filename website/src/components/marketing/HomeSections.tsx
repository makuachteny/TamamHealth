"use client";

import Image from "next/image";
import Link from "next/link";
import { HOME_AUDIENCES, HOME_PROBLEM_STATS } from "@/data/home";
import { Reveal, RelatedLinksGrid } from "@/components/marketing/MarketingShared";

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

export function HomeAudienceSection() {
  return (
    <RelatedLinksGrid
      className="mk-home-audiences"
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

export function HomePlatformSection() {
  return (
    <section className="mk-section mk-section-white mk-home-platform-section">
      <div className="mk-container">
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
              <p className="mk-label">The solution</p>
              <h2 className="mk-h2 mk-home-platform-heading">
                <span>One workflow</span>
              </h2>
              <p>
                TamamHealth links every step — registration through reporting — back to the same patient encounter, so the record a nurse starts is the same one a Ministry analyst sees later. No re-entry, no separate systems to reconcile.
              </p>
              <div className="mk-home-platform-checks">
                <span>Patient history</span>
                <span>Facility operations</span>
                <span>National reporting</span>
              </div>
              <Link href="/#products" className="mk-btn mk-btn-outline-green mk-home-platform-cta">
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
