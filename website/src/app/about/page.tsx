"use client";

import Image from "next/image";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal, RelatedLinksGrid, SplitFeatureBlock } from "@/components/marketing/MarketingShared";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth About — Our Story
   Founded by Tufts University students from lived experience
   ═══════════════════════════════════════════════════════════════════ */

export default function AboutPage() {
  return (
    <>
      <MarketingHero
        variant="photo"
        eyebrow="OUR STORY"
        title={<>Born from scraps of paper.<br />Built by people who lived it.<br />Made to save lives.</>}
        subtitle="TamamHealth began with one observation: across South Sudan, brilliant clinicians lose patients to broken paper systems, not to a lack of skill. We're here to change that."
        primaryCta={{ label: "Get in touch", href: "/about/contact#contact-form" }}
        image="/assets/team-derby-center.jpg"
        imageAlt="TamamHealth team"
        imagePriority
      />

      {/* ── THE ORIGIN STORY ────────────────────────────────────────── */}
      <SplitFeatureBlock
        eyebrow="Where it all started"
        title="Built from scraps of paper in Kakuma Refugee Camp"
        body="In Kakuma Refugee Camp, Kenya, healthcare meant handwritten notes on scraps of paper, filing cabinets that couldn't survive the rainy season, and patients whose medical histories vanished between visits. Teny Makuach grew up watching this and started TamamHealth so health workers would not have to rely on systems that forget patients. At Tufts University, that beginning became a shared team mission across product, engineering, research, partnerships, and implementation."
        image="/assets/village-community.jpg"
        imageAlt="Village community in East Africa"
        tone="navy"
        imageSide="right"
      />

      {/* ── TUFTS NEW VENTURES WIN ──────────────────────────────────── */}
      <SplitFeatureBlock
        eyebrow="April 2026"
        title="$10,000 Healthcare Track winner"
        body="Selected from over 300 startups, TamamHealth won the Healthcare Track at the Tufts $100K New Ventures Competition — validation from one of the nation's most respected university venture programs."
        image="/assets/team-tufts-win.jpg"
        imageAlt="TamamHealth team winning $10,000 at Tufts New Ventures Competition 2026"
        tone="cream"
        imageSide="left"
      />

      {/* ── MEET THE TEAM ───────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 72 }}>Meet the team</h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 32, maxWidth: 1050, margin: "0 auto" }}>
            <Reveal delay={0}>
              <FounderCard name="Teny Makuach" role="Founder" image="/assets/founder-teny.jpg" initials="TM" />
            </Reveal>
            <Reveal delay={0.1}>
              <FounderCard name="Ekow Williams" role="Community & Partnerships" image="/assets/founder-ekow.jpg" initials="EW" />
            </Reveal>
            <Reveal delay={0.2}>
              <FounderCard name="Toye Adebayo" role="Project Manager" image="/assets/founder-toye.jpg" initials="TA" />
            </Reveal>
            <Reveal delay={0.3}>
              <FounderCard name="Mark Dosu" role="Software Developer" image="/assets/Mark-Dosu.jpeg" initials="MD" />
            </Reveal>
            <Reveal delay={0.4}>
              <FounderCard name="Chinonye Hycent" role="Research Lead" image="/assets/chinonye-hycent.jpg" initials="CH" />
            </Reveal>
            <Reveal delay={0.5}>
              <FounderCard name="Isaac Kyalo" role="Technical Lead" image="/assets/isaac-kyalo.jpg" initials="IK" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── MISSION CALLOUT ─────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-callout mk-callout--gradient" style={{
              borderRadius: 20,
              padding: "44px 40px",
              textAlign: "center",
              maxWidth: 760,
              margin: "0 auto",
              color: "white",
            }}>
              <p style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.05em", margin: "0 0 12px" }}>OUR MISSION</p>
              <h2 style={{ fontSize: "2.15rem", fontFamily: "var(--tb-serif)", margin: "0 0 16px", lineHeight: 1.3, fontWeight: 700 }}>
                <strong>Every healthcare worker deserves tools that work when lives are on the line.</strong>
              </h2>
              <p style={{ fontSize: 17, margin: 0, lineHeight: 1.6 }}>
                We&apos;re building the digital health platform that <strong>doesn&apos;t fail in low-bandwidth environments,
                doesn&apos;t require expensive infrastructure</strong>, and was born from firsthand experience with the cost
                of broken healthcare systems.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TIMELINE ────────────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 72 }}>Our journey</h2>
            <div className="mk-timeline">
              <TimelineItem
                year="2024"
                title="Idea born"
                description="Teny starts TamamHealth after seeing how fragile paper records fail patients and health workers."
              />
              <TimelineItem
                year="2025"
                title="Team forms"
                description="The team begins turning the idea into a shared product mission across engineering, research, partnerships, and implementation."
              />
              <TimelineItem
                year="Apr 2026"
                title="Won $10K"
                description="Tufts New Ventures Healthcare Track winner — validation from one of the nation's top university venture competitions."
              />
              <TimelineItem
                year="Now"
                title="Serving Africa"
                description="Preparing pilots with health workers, facilities, and partners who want South Sudanese healthcare to have a stronger memory."
              />
            </div>
          </Reveal>
        </div>
      </section>

      <RelatedLinksGrid
        heading="Where to go next"
        items={[
          {
            label: "Platform",
            title: "Explore the products",
            body: "See how registration, triage, pharmacy, lab, billing, and telehealth connect into one record.",
            href: "/products",
            image: "/assets/doctor-tablet-review.jpg",
          },
          {
            label: "Pricing",
            title: "Pricing shaped around your facility",
            body: "Book a walkthrough and we'll scope the right modules, rollout path, and commercial terms.",
            href: "/pricing",
            image: "/assets/doctor-nurse-consultation.jpg",
          },
          {
            label: "Get involved",
            title: "Talk to our team",
            body: "Become a pilot partner or ask us anything about bringing TamamHealth to your facility.",
            href: "/about/contact",
            image: "/assets/team-derby-center.jpg",
          },
        ]}
      />

    </>
  );
}

/* ── Components ──────────────────────────────────────────────────── */

function FounderCard({ name, role, image, initials }: { name: string; role: string; image?: string; initials: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 180, height: 180, borderRadius: "50%", overflow: "hidden", margin: "0 auto 18px", boxShadow: "0 8px 24px rgba(26,58,58,0.08)", border: "3px solid var(--tb-gold)" }}>
        {image ? (
          <Image
            src={image}
            alt={`${name}, ${role} at TamamHealth`}
            width={180}
            height={180}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "var(--tb-blue-50)", color: "var(--tb-blue-700)", fontSize: 42, fontWeight: 700 }}>
            {initials}
          </div>
        )}
      </div>
      <h3 className="mk-h3" style={{ fontSize: "1.15rem", margin: "0 0 4px", fontWeight: 700 }}><strong>{name}</strong></h3>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--tb-green)", margin: "0 0 6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{role}</p>
    </div>
  );
}

function TimelineItem({ year, title, description }: { year: string; title: string; description: string }) {
  return (
    <div className="mk-timeline-item">
      <div className="mk-timeline-dot" />
      <span className="mk-timeline-year">{year}</span>
      <h4 className="mk-h4" style={{ fontSize: "1.15rem" }}>{title}</h4>
      <p className="mk-body" style={{ color: "var(--tb-text-sec)", marginTop: 8 }}>{description}</p>
    </div>
  );
}
