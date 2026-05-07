"use client";

import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/marketing/MarketingShared";
import { DuoIcon } from "@/components/marketing/DuoIcon";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth About — Our Story
   Founded by Tufts University students from lived experience
   ═══════════════════════════════════════════════════════════════════ */

export default function AboutPage() {
  return (
    <>
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="mk-hero-photo-bg mk-hero-photo-bg--tall">
        <Image
          src="/assets/team-derby-center.jpg"
          alt="TamamHealth team"
          fill
          className="mk-hero-bg-img"
          priority
        />
        <div className="mk-container" style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <Reveal>
            <span className="mk-label" style={{ color: "var(--tb-gold)" }}>OUR STORY</span>
            <h1 className="mk-h1" style={{ color: "#fff", marginTop: 10, fontWeight: 700 }}>
              Born from scraps of paper.<br />
              Built by people who lived it.<br />
              Made to save lives.
            </h1>
            <p className="mk-body-lg" style={{ color: "var(--tb-text-inv-m)", marginTop: 14 }}>
              TamamHealth began with one observation: across South Sudan, brilliant clinicians lose patients to broken paper systems — not to a lack of skill. We&apos;re here to change that.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── THE ORIGIN STORY ────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split" style={{ gap: 48, alignItems: "center" }}>
              <div className="mk-split-content" style={{ flex: "1 1 55%" }}>
                <h2 className="mk-h2">Where it all started</h2>
                <p className="mk-body" style={{ marginTop: 20, lineHeight: 1.7 }}>
                  In Kakuma Refugee Camp, Kenya, healthcare meant handwritten notes on scraps of paper, filing cabinets that couldn&apos;t survive the rainy season, and patients whose medical histories vanished between visits. Teny Makuach grew up watching this — and decided to fix it.
                </p>
                <p className="mk-body" style={{ marginTop: 16, lineHeight: 1.7 }}>
                  At Tufts University, he founded TamamHealth and designed the platform&apos;s core architecture: an offline-first engine built for the realities of African healthcare. He then connected with Toye Adebayo and Ekow Williams, and together they built the complete hospital information system that clinics across South Sudan now depend on.
                </p>
              </div>
              <div style={{ flex: "1 1 40%" }}>
                <div className="mk-split-image" style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "4 / 3", position: "relative" }}>
                  <Image
                    src="/assets/village-community.jpg"
                    alt="Village community in East Africa"
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TUFTS NEW VENTURES WIN ──────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split" style={{ gap: 48, alignItems: "center" }}>
              <div style={{ flex: "1 1 45%" }}>
                <div className="mk-split-image" style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "4 / 3", position: "relative" }}>
                  <Image
                    src="/assets/team-tufts-win.jpg"
                    alt="TamamHealth team winning $10,000 at Tufts New Ventures Competition 2026"
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
              </div>
              <div className="mk-split-content" style={{ flex: "1 1 50%" }}>
                <p className="mk-label" style={{ color: "var(--tb-gold-dark)" }}>APRIL 2026</p>
                <h2 className="mk-h2" style={{ marginTop: 8 }}>$10,000 Healthcare Track Winner</h2>
                <p className="mk-body" style={{ marginTop: 16, lineHeight: 1.7, color: "var(--tb-text-sec)" }}>
                  Selected from over 300 startups, TamamHealth won the Healthcare Track at the Tufts $100K New Ventures Competition — validation from one of the nation&apos;s most respected university venture programs.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── MEET THE FOUNDERS ───────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 72 }}>Meet the founders</h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32, maxWidth: 880, margin: "0 auto" }}>
            <Reveal delay={0}>
              <FounderCard name="Teny Makuach" role="Founder & CEO" school="Computer Science, Tufts University" image="/assets/founder-teny.jpg" />
            </Reveal>
            <Reveal delay={0.1}>
              <FounderCard name="Toye Adebayo" role="Co-founder & CTO" school="Computer Science, Tufts University" image="/assets/founder-toye.jpg" />
            </Reveal>
            <Reveal delay={0.2}>
              <FounderCard name="Ekow Williams" role="Co-founder & COO" school="Electrical Engineering, Tufts University" image="/assets/founder-ekow.jpg" />
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

      {/* ── VALUES SECTION ──────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 72 }}>What we believe</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32, maxWidth: 1100, margin: "0 auto" }}>
              <ValueCard
                title="Offline-first, always"
                description="Across much of Africa, internet isn't guaranteed — it's a luxury. TamamHealth works without connectivity and syncs seamlessly when networks return. Healthcare can't wait for a signal bar."
                icon={<DuoIcon name="offline" size={56} />}
              />
              <ValueCard
                title="Lived experience"
                description="We don't build for communities we've never been part of. Our CEO grew up in a refugee camp. We design from understanding — not assumption, not research papers."
                icon={<DuoIcon name="heart" size={56} />}
              />
              <ValueCard
                title="Radical simplicity"
                description="Healthcare workers across Africa are brilliant and overstretched. Every feature we ship must be learnable in minutes — not months. If it's confusing, we haven't finished designing it."
                icon={<DuoIcon name="lightbulb" size={56} />}
              />
              <ValueCard
                title="Open standards"
                description="TamamHealth integrates with DHIS2, supports HL7/FHIR, and works with national and regional health information systems across Africa. We don&apos;t build data silos — we break them."
                icon={<DuoIcon name="api" size={56} />}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── IMPACT STATS ────────────────────────────────────────────── */}
      <section className="mk-section mk-section-teal" style={{ borderTop: "4px solid var(--tb-gold)" }}>
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 80, color: "white" }}>Built for the real world</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 40, maxWidth: 1000, margin: "0 auto" }}>
              <ImpactCard number="Six" label="Integrated modules (EHR, billing, telehealth, pharmacy, lab, analytics)" highlight />
              <ImpactCard number="100%" label="Offline capability — Works without internet, syncs when connected" />
              <ImpactCard number="$10K" label="Competition winner — Tufts $100K New Ventures Healthcare Track" highlight />
              <ImpactCard number="3" label="Co-founders from Tufts University (Computer Science & Electrical Engineering)" />
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
                description="Teny begins designing the platform architecture — an offline-first engine built for the realities of African healthcare."
              />
              <TimelineItem
                year="2025"
                title="Team forms"
                description="Toye and Ekow join at Tufts, bringing distributed systems and electrical engineering expertise. Building begins."
              />
              <TimelineItem
                year="Apr 2026"
                title="Won $10K"
                description="Tufts New Ventures Healthcare Track winner — validation from one of the nation's top university venture competitions."
              />
              <TimelineItem
                year="Now"
                title="Serving Africa"
                description="Platform live in South Sudan clinics, transforming how healthcare workers document and deliver care."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA SECTION ─────────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-divider-gold" style={{ marginBottom: 40 }} />
          </Reveal>
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
              <h2 className="mk-h2">Join us</h2>
              <p className="mk-body-lg" style={{ marginTop: 14, marginBottom: 28, color: "var(--tb-text-sec)" }}>
                We&apos;re building the digital health platform for clinics across Africa. Whether
                you&apos;re a provider ready to go digital, a partner interested in collaboration,
                or someone who wants to build technology that saves lives — we&apos;d love to hear from you.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-lg">
                  Get in touch
                </Link>
                <Link href="/ehr" className="mk-btn mk-btn-outline-green mk-btn-lg">
                  Learn about our platform
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ── Components ──────────────────────────────────────────────────── */

function FounderCard({ name, role, school, image }: { name: string; role: string; school: string; image: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 180, height: 180, borderRadius: "50%", overflow: "hidden", margin: "0 auto 18px", boxShadow: "0 8px 24px rgba(26,58,58,0.08)", border: "3px solid var(--tb-gold)" }}>
        <Image
          src={image}
          alt={`${name}, ${role} of TamamHealth`}
          width={180}
          height={180}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <h3 className="mk-h3" style={{ fontSize: "1.15rem", margin: "0 0 4px", fontWeight: 700 }}><strong>{name}</strong></h3>
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--tb-green)", margin: "0 0 6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{role}</p>
      <p className="mk-body" style={{ color: "var(--tb-text-sec)", fontSize: 14, margin: 0 }}>{school}</p>
    </div>
  );
}

function ValueCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="mk-value-card">
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--tb-tint-blue)", color: "var(--tb-blue-700)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28 }}>{icon}</div>
      </div>
      <h3 className="mk-h3" style={{ fontSize: "1.15rem", marginTop: 20, marginBottom: 8, fontWeight: 700 }}><strong>{title}</strong></h3>
      <p className="mk-body" style={{ color: "var(--tb-text-sec)", margin: 0, fontSize: 15 }}>{description}</p>
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

function ImpactCard({ number, label, highlight = false }: { number: string; label: string; highlight?: boolean }) {
  const className = highlight ? "mk-stat-card mk-stat-card--highlight" : "mk-stat-card";
  return (
    <div className={className}>
      <div style={{ fontSize: "2.5rem", fontFamily: "var(--tb-serif)", fontWeight: 700, marginBottom: 12 }}>
        <strong>{number}</strong>
      </div>
      <p style={{ fontSize: 15, margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
        {label}
      </p>
    </div>
  );
}
