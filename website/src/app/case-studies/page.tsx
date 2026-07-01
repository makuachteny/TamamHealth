import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";
import { ArrowRight } from "@/components/marketing/icons";
import { CASE_STUDIES } from "@/data/case-studies";

export const metadata: Metadata = {
  title: "Case Studies · TamamHealth Digital Health",
  description: "Real deployments of TamamHealth across South Sudan — hospitals, PHCUs, diagnostic centres, and pharmacy networks.",
};

export default function CaseStudiesIndex() {
  return (
    <>
      
      <main className="mk-main">
        <MarketingHero
          variant="showcase"
          eyebrow="SCENARIOS · WHAT TAMAMHEALTH COULD DO FOR YOU"
          title="What changes when a South Sudan facility goes digital"
          subtitle="TamamHealth is pre-launch. These stories are forward-looking scenarios, not deployment claims, showing the problems we built the platform to solve."
          primaryCta={{ label: "Talk to our team", href: "/about/contact#contact-form" }}
          secondaryCta={{ label: "See scenarios", href: "#case-studies-grid" }}
          stats={[
            { value: "Projected", label: "facility outcomes" },
            { value: "Pilot", label: "partners welcome" },
            { value: "South Sudan", label: "built for local care" },
          ]}
          className="mk-hero-case-index"
        />

        {/* Case study grid */}
        <section id="case-studies-grid" className="mk-section mk-section-after-hero mk-section-white">
          <div className="mk-container">
            <Reveal>
              <div className="mk-section-heading">
                <h2 className="mk-h2">Cases</h2>
              </div>
            </Reveal>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
                gap: 28,
              }}
            >
              {CASE_STUDIES.map((c, i) => (
                <Reveal key={c.slug} delay={i * 0.05}>
                  <Link
                    href={`/case-studies/${c.slug}`}
                    style={{ textDecoration: "none", display: "block", height: "100%" }}
                  >
                    <article
                      style={{
                        background: "var(--tb-cream-50)",
                        border: "1px solid var(--tb-cream-300)",
                        borderRadius: 16,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
                      }}
                      className="mk-product-list-card"
                    >
                      {/* Image hero */}
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          aspectRatio: "16 / 9",
                          background: c.bg,
                          overflow: "hidden",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.image}
                          alt={c.imageAlt}
                          loading="lazy"
                          style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            objectPosition: "center 30%",
                          }}
                        />
                        <div style={{
                          position: "absolute", inset: 0,
                          background: `linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.5) 100%)`,
                        }} />
                      </div>

                      {/* Title strip */}
                      <div
                        style={{
                          background: c.bg,
                          padding: "20px 24px 18px",
                          borderBottom: `2px solid ${c.accent}`,
                        }}
                      >
                        <h2 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3, color: "var(--tb-text-pri)", margin: 0 }}>
                          {c.title}
                        </h2>
                      </div>

                      {/* Body */}
                      <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--tb-text-muted)", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontWeight: 600, color: "var(--tb-text-sec)" }}>{c.client}</span>
                          <span>·</span>
                          <span>{c.location}, {c.state}</span>
                        </div>
                        <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.55, marginBottom: 18, flex: 1 }}>
                          {c.summary}
                        </p>
                        {/* Headline metrics */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
                          {c.metrics.slice(0, 2).map(m => (
                            <div key={m.label} style={{ background: "var(--tb-cream-100)", border: "1px solid var(--tb-cream-300)", borderRadius: 8, padding: "8px 10px" }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--tb-text-muted)" }}>{m.label}</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--tb-text-pri)", letterSpacing: -0.2, fontVariantNumeric: "tabular-nums" }}>{m.value}</div>
                              {m.delta && (
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: m.positive ? "var(--tb-green-dark)" : "var(--tb-red-dark)" }}>{m.delta}</div>
                              )}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: c.accent, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          Read the story
                          <ArrowRight size={14} strokeWidth={1.8} />
                        </span>
                      </div>
                    </article>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

      </main>
      
    </>
  );
}
