import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/marketing/MarketingShared";
import { DuoIcon } from "@/components/marketing/DuoIcon";
import { CASE_STUDIES, getCaseStudy } from "@/data/case-studies";

interface Params { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return CASE_STUDIES.map(c => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return { title: "Case Study · TamamHealth" };
  return {
    title: `${study.client} · TamamHealth Case Study`,
    description: study.summary,
  };
}

export default async function CaseStudyDetail({ params }: Params) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return notFound();

  const others = CASE_STUDIES.filter(c => c.slug !== slug).slice(0, 3);

  return (
    <>
      
      <main className="mk-main">
        {/* Image banner */}
        <section
          style={{
            position: "relative",
            height: "min(380px, 40vh)",
            marginTop: -1,
            overflow: "hidden",
            background: study.bg,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={study.image}
            alt={study.imageAlt}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 100%)`,
          }} />
        </section>

        {/* Hero */}
        <section
          className="mk-case-hero"
          style={{
            background: study.bg,
            borderBottom: `2px solid ${study.accent}`,
          }}
        >
          <div className="mk-container">
            <Reveal>
              <Link
                href="/case-studies"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, color: study.accent, textDecoration: "none",
                  marginBottom: 18,
                }}
              >
                <DuoIcon name="arrow-right" size={14} style={{ transform: "rotate(180deg)" }} />
                All case studies
              </Link>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase",
                  color: "var(--tb-gold-dark)", background: "var(--tb-tint-gold)",
                  border: "1px solid var(--tb-gold)",
                  padding: "3px 10px", borderRadius: 999,
                }}>
                  Projected scenario
                </span>
              </div>
              <h1 className="mk-h1" style={{ marginBottom: 18, maxWidth: 880 }}>{study.title}</h1>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 14, color: "var(--tb-text-sec)" }}>
                <span><strong style={{ color: "var(--tb-text-pri)" }}>{study.client}</strong></span>
                <span>·</span>
                <span>{study.facilityType}</span>
                <span>·</span>
                <span>{study.location}, {study.state}</span>
                <span>·</span>
                <span>Live since {study.goLiveDate}</span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Metrics strip */}
        <section style={{ paddingTop: 32, paddingBottom: 0 }}>
          <div className="mk-container">
            <div
              className="mk-case-metrics"
              style={{ gridTemplateColumns: `repeat(${study.metrics.length}, minmax(0, 1fr))` }}
            >
              {study.metrics.map((m, i) => (
                <Reveal key={m.label} delay={i * 0.04}>
                  <div
                    style={{
                      background: "var(--tb-cream-50)",
                      border: "1px solid var(--tb-cream-300)",
                      borderRadius: 14,
                      padding: "20px 22px",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--tb-text-muted)", marginBottom: 6 }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "var(--tb-text-pri)", letterSpacing: -0.5, fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>
                      {m.value}
                    </div>
                    {m.delta && (
                      <div style={{
                        fontSize: 12, fontWeight: 700, marginTop: 4,
                        color: m.positive ? "var(--tb-green-dark)" : "var(--tb-red-dark)",
                      }}>
                        {m.delta}
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Body sections */}
        <section className="mk-section mk-section-after-hero mk-section-white">
          <div className="mk-container mk-narrow">
            <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--tb-text-pri)", marginBottom: 48, fontWeight: 500 }}>
              {study.summary}
            </p>

            {[study.challenge, study.solution, study.outcomes].map((sec, idx) => (
              <Reveal key={sec.heading} delay={idx * 0.05}>
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--tb-text-pri)", letterSpacing: -0.3, marginBottom: 16 }}>
                    {sec.heading}
                  </h2>
                  {sec.body.map((para, j) => (
                    <p key={j} style={{ fontSize: 16, lineHeight: 1.7, color: "var(--tb-text-sec)", marginBottom: 16 }}>
                      {para}
                    </p>
                  ))}
                </div>
              </Reveal>
            ))}

            {study.pullQuote && (
              <Reveal>
                <blockquote
                  style={{
                    background: study.bg,
                    borderLeft: `4px solid ${study.accent}`,
                    borderRadius: 12,
                    padding: "28px 32px",
                    margin: "32px 0",
                  }}
                >
                  <p style={{ fontSize: 19, lineHeight: 1.55, fontStyle: "italic", color: "var(--tb-text-pri)", marginBottom: 16 }}>
                    &ldquo;{study.pullQuote.quote}&rdquo;
                  </p>
                  <footer>
                    <strong style={{ fontSize: 14, color: "var(--tb-text-pri)", display: "block" }}>{study.pullQuote.author}</strong>
                    <span style={{ fontSize: 13, color: "var(--tb-text-sec)" }}>{study.pullQuote.role}</span>
                  </footer>
                </blockquote>
              </Reveal>
            )}
          </div>
        </section>

        {/* Related */}
        {others.length > 0 && (
          <section className="mk-section mk-section-cream">
            <div className="mk-container">
              <Reveal>
                <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 40 }}>More case studies</h2>
              </Reveal>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(3, others.length)}, minmax(0, 1fr))`,
                  gap: 20,
                }}
                className="mk-related-grid"
              >
                {others.map((c, i) => (
                  <Reveal key={c.slug} delay={i * 0.04}>
                    <Link
                      href={`/case-studies/${c.slug}`}
                      style={{ textDecoration: "none", display: "block", height: "100%" }}
                    >
                      <div
                        style={{
                          background: "var(--tb-cream-50)",
                          border: "1px solid var(--tb-cream-300)",
                          borderRadius: 12,
                          padding: 22,
                          height: "100%",
                          transition: "transform .15s ease, box-shadow .15s ease",
                        }}
                        className="mk-product-list-card"
                      >
                        <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, color: "var(--tb-text-pri)", marginBottom: 8 }}>
                          {c.client}
                        </h3>
                        <p style={{ fontSize: 13, color: "var(--tb-text-sec)", lineHeight: 1.55, margin: 0 }}>
                          {c.summary.length > 120 ? `${c.summary.slice(0, 120)}…` : c.summary}
                        </p>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>
      
    </>
  );
}
