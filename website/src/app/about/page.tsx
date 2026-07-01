"use client";

import Image from "next/image";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";
import { CloudOff, Heart, Lightbulb, Code2 } from "@/components/marketing/icons";

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
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split" style={{ gap: 48, alignItems: "center" }}>
              <div className="mk-split-content" style={{ flex: "1 1 55%" }}>
                <h2 className="mk-h2">Where it all started</h2>
                <p className="mk-body" style={{ marginTop: 20, lineHeight: 1.7 }}>
                  In Kakuma Refugee Camp, Kenya, healthcare meant handwritten notes on scraps of paper, filing cabinets that couldn&apos;t survive the rainy season, and patients whose medical histories vanished between visits. Teny Makuach grew up watching this and started TamamHealth so health workers would not have to rely on systems that forget patients.
                </p>
                <p className="mk-body" style={{ marginTop: 16, lineHeight: 1.7 }}>
                  At Tufts University, that beginning became a shared team mission. We are building TamamHealth together across product, engineering, research, partnerships, and implementation so clinics, hospitals, communities, and governments can keep every patient story connected.
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

      {/* ── VALUES SECTION ──────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 72 }}>What we believe</h2>
            <div className="mk-about-values-grid">
              <ValueCard
                title="Offline-first, always"
                description="Across much of Africa, internet isn't guaranteed — it's a luxury. TamamHealth works without connectivity and syncs seamlessly when networks return. Healthcare can't wait for a signal bar."
                icon={<CloudOff size={34} strokeWidth={1.65} />}
              />
              <ValueCard
                title="Shared mission"
                description="TamamHealth started from lived experience, and the work now belongs to a team committed to building with the people and health systems the platform is meant to serve."
                icon={<Heart size={34} strokeWidth={1.65} />}
              />
              <ValueCard
                title="Radical simplicity"
                description="Healthcare workers across Africa are brilliant and overstretched. Every feature we ship must be learnable in minutes — not months. If it's confusing, we haven't finished designing it."
                icon={<Lightbulb size={34} strokeWidth={1.65} />}
              />
              <ValueCard
                title="Open standards"
                description="TamamHealth integrates with DHIS2, supports HL7/FHIR, and works with national and regional health information systems across Africa. We don&apos;t build data silos — we break them."
                icon={<Code2 size={34} strokeWidth={1.65} />}
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
              <ImpactCard number="6" label="Team members across product, engineering, research, partnerships, and implementation" />
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

function ValueCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="mk-value-card">
      <div className="mk-value-card-icon">
        {icon}
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
