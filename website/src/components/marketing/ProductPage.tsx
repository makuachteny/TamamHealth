"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Reveal } from "./MarketingShared";
import { MarketingHero } from "./MarketingHero";
import { Check } from "@/components/marketing/icons";

/* ═════════════════════════════════════════════════════════════════════
   Reusable scaffolding for the /products/* detail pages.
   Each product page composes <ProductHero>, <ProductModuleGrid>,
   <ProductBenefits>, and <ProductCTA> with its own copy.
   ═════════════════════════════════════════════════════════════════════ */

export function ProductHero({
  eyebrow, title, subtitle, accentColor = "var(--tb-blue-700)",
  primaryCta = { label: "Request a demo", href: "/about/contact?intent=demo#contact-form" },
  secondaryCta,
  illustration,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  accentColor?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  illustration?: ReactNode;
}) {
  void accentColor;

  return (
    <MarketingHero
      variant="product"
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      primaryCta={primaryCta}
      secondaryCta={secondaryCta}
      media={illustration}
      className="mk-product-hero"
    />
  );
}

export interface ProductModule {
  title: string;
  description: string;
  icon?: ReactNode;
}

export function ProductModuleGrid({ eyebrow, heading, modules, columns = 3 }: {
  eyebrow?: string;
  heading: string;
  modules: ProductModule[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <section className="mk-section mk-section-white">
      <div className="mk-container">
        <Reveal>
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 56px" }}>
            {eyebrow && <p className="mk-label" style={{ marginBottom: 12 }}>{eyebrow}</p>}
            <h2 className="mk-h2">{heading}</h2>
          </div>
        </Reveal>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${columns === 4 ? 220 : columns === 2 ? 320 : 260}px), 1fr))`,
            gap: 20,
          }}
          className="mk-module-grid"
        >
          {modules.map((m, i) => (
            <Reveal key={m.title} delay={i * 0.04}>
              <div
                style={{
                  background: "var(--tb-cream-50)",
                  border: "1px solid var(--tb-cream-300)",
                  borderRadius: 12,
                  padding: "22px 22px 24px",
                  height: "100%",
                }}
              >
                {m.icon && (
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: "var(--tb-tint-green)", color: "var(--tb-green-dark)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    {m.icon}
                  </div>
                )}
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "var(--tb-text-pri)" }}>{m.title}</h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.55, margin: 0 }}>{m.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface ProductBenefit {
  title: string;
  description: string;
}

export function ProductBenefits({ eyebrow, heading, benefits, accentColor = "var(--tb-green-dark)" }: {
  eyebrow?: string;
  heading: string;
  benefits: ProductBenefit[];
  accentColor?: string;
}) {
  return (
    <section className="mk-section mk-section-cream">
      <div className="mk-container">
        <Reveal>
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 56px" }}>
            {eyebrow && <p className="mk-label" style={{ color: accentColor, marginBottom: 12 }}>{eyebrow}</p>}
            <h2 className="mk-h2">{heading}</h2>
          </div>
        </Reveal>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 24,
          }}
        >
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.04}>
              <div style={{ position: "relative", paddingLeft: 28 }}>
                <span
                  aria-hidden
                  style={{
                    position: "absolute", left: 0, top: 4,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "var(--tb-tint-green)", color: "var(--tb-green-dark)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Check size={11} strokeWidth={1.8} />
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: "var(--tb-text-pri)" }}>{b.title}</h3>
                <p style={{ fontSize: 14.5, color: "var(--tb-text-sec)", lineHeight: 1.6, margin: 0 }}>{b.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductCTA({
  heading, subtitle,
  primaryCta = { label: "Talk to our team", href: "/about/contact#contact-form" },
}: {
  heading: string;
  subtitle: string;
  primaryCta?: { label: string; href: string };
}) {
  return (
    <section className="mk-cta-banner">
      <div className="mk-container">
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <h2 className="mk-h2" style={{ marginBottom: 16 }}>{heading}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--tb-text-sec)", marginBottom: 28 }}>{subtitle}</p>
          <Link href={primaryCta.href} className="mk-btn mk-btn-green mk-btn-lg">{primaryCta.label}</Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Faux platform UI mockup used in product hero sections. Renders a
 * miniature dashboard — sidebar + topbar + content tiles — themed to
 * each product's accent color so prospects see the actual platform feel
 * (not an abstract icon).
 *
 * `variant` picks the content treatment: `vitals` (HMIS — patient
 * card + vital tiles), `clinic` (CMS — patient list), `lab` (LIS —
 * results queue), `imaging` (RIS — modality worklist), `pharmacy`
 * (PMS — inventory + dispense), `feedback` (PFS — rating tiles).
 */
export type ProductMockVariant = 'vitals' | 'clinic' | 'lab' | 'imaging' | 'pharmacy' | 'feedback';

const MOCK_BLUE = "#2191D0";
const MOCK_BLUE_DARK = "#015697";
const MOCK_BLUE_MID = "#369FDA";

export function ProductIllustration({
  accent = MOCK_BLUE,
  variant = 'vitals',
}: {
  accent?: string;
  variant?: ProductMockVariant;
  /** Legacy prop — ignored. Use `variant` instead. */
  icon?: ReactNode;
}) {
  const visualByVariant: Record<ProductMockVariant, {
    primary: string;
    secondary: string;
    label: string;
    detail: string;
  }> = {
    vitals: {
      primary: "/assets/doctor-nurse-consultation.jpg",
      secondary: "/assets/Dashboard.png",
      label: "Hospital workflow",
      detail: "Clinical record and operations dashboard",
    },
    clinic: {
      primary: "/assets/doctor-tablet-smiling.jpg",
      secondary: "/assets/community-health-worker.jpg",
      label: "Clinic workflow",
      detail: "Registration, consultation, and follow-up",
    },
    lab: {
      primary: "/assets/doctor-tablet-review.jpg",
      secondary: "/assets/health-data.jpg",
      label: "Lab workflow",
      detail: "Orders, results, and turnaround tracking",
    },
    imaging: {
      primary: "/assets/doctor-tablet-review.jpg",
      secondary: "/assets/Dashboard.png",
      label: "Radiology workflow",
      detail: "Modality worklists and structured reports",
    },
    pharmacy: {
      primary: "/assets/doctor-prescription.jpg",
      secondary: "/assets/doctor-writing-notes.jpg",
      label: "Pharmacy workflow",
      detail: "Prescriptions, stock, and dispense controls",
    },
    feedback: {
      primary: "/assets/community-health-worker.jpg",
      secondary: "/assets/doctor-tablet-smiling.jpg",
      label: "Patient experience",
      detail: "Feedback and follow-up across every visit",
    },
  };

  const visual = visualByVariant[variant];

  return (
    <div className="mk-product-photo-visual" style={{ "--product-accent": accent } as CSSProperties}>
      <div className="mk-product-photo-main">
        <Image src={visual.primary} alt={visual.label} fill sizes="(max-width: 900px) 100vw, 48vw" />
      </div>
      <div className="mk-product-photo-caption">
        <span>{visual.label}</span>
        <strong>{visual.detail}</strong>
      </div>
    </div>
  );
}

// ── Per-product content treatments ────────────────────────────────────

function MockVitals({ accent }: { accent: string }) {
  return (
    <>
      {/* Patient card */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: "var(--tb-cream-50)", borderRadius: 8, border: "1px solid var(--tb-cream-300)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #D96E59 0%, #C44536 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>AD</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tb-blue-900)" }}>Achol M. Deng</div>
          <div style={{ fontSize: 8.5, color: "var(--tb-text-ter)" }}>28 y · F · BOMA-KJ-HH1024</div>
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#C44536", background: "rgba(196,69,54,0.12)", padding: "2px 5px", borderRadius: 4 }}>Pregnant · 28 wk</div>
      </div>
      {/* Vital tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {[
          { label: "HR", value: "86", unit: "bpm", color: "#C44536", normal: true },
          { label: "BP", value: "128/84", unit: "mmHg", color: "#C44536", normal: false },
          { label: "Temp", value: "37.2", unit: "°C", color: MOCK_BLUE_MID, normal: true },
        ].map((v) => (
          <div key={v.label} style={{
            padding: 6, borderRadius: 6,
            background: v.normal ? "var(--tb-cream-200)" : "rgba(196,69,54,0.08)",
            border: `1px solid ${v.normal ? "var(--tb-cream-300)" : "rgba(196,69,54,0.30)"}`,
          }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: v.normal ? "var(--tb-text-ter)" : v.color, letterSpacing: 0.4, textTransform: "uppercase" }}>{v.label}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--tb-blue-900)", marginTop: 1 }}>{v.value}<span style={{ fontSize: 7, color: "var(--tb-text-ter)", marginLeft: 1 }}>{v.unit}</span></div>
            <div style={{ fontSize: 7, fontWeight: 600, color: v.normal ? "var(--tb-blue-800)" : v.color, marginTop: 1 }}>{v.normal ? "Normal" : "Elevated"}</div>
          </div>
        ))}
      </div>
      <ChartLine accent={accent} />
    </>
  );
}

function MockClinic({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, padding: "6px 8px", background: `${accent}10`, border: `1px solid ${accent}40`, borderRadius: 6, fontSize: 8.5 }}>
          <div style={{ fontWeight: 700, color: accent, fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Today</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tb-blue-900)" }}>34</div>
          <div style={{ color: "var(--tb-text-ter)", fontSize: 7 }}>Patients</div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: "var(--tb-cream-200)", border: "1px solid var(--tb-cream-300)", borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: "var(--tb-text-ter)", fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Waiting</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tb-blue-900)" }}>5</div>
          <div style={{ color: "var(--tb-text-ter)", fontSize: 7 }}>~12 min</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { name: "Mary Akon", id: "JTH-0247", status: "In room 3", color: MOCK_BLUE_DARK },
          { name: "James Lado", id: "JTH-0246", status: "Triage", color: MOCK_BLUE_MID },
          { name: "Stella Wani", id: "JTH-0245", status: "Pharmacy", color: accent },
        ].map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: 5, background: "var(--tb-cream-50)", borderRadius: 5, border: "1px solid var(--tb-cream-200)" }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: `linear-gradient(135deg, ${accent} 0%, var(--tb-blue-800) 100%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 7 }}>{p.name.split(" ").map(n => n[0]).join("")}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "var(--tb-blue-900)" }}>{p.name}</div>
              <div style={{ fontSize: 7, color: "var(--tb-text-ter)" }}>{p.id}</div>
            </div>
            <div style={{ fontSize: 7, fontWeight: 700, color: p.color, background: `${p.color}15`, padding: "1px 4px", borderRadius: 3 }}>{p.status}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function MockLab({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        {[
          { l: "Pending", v: "12", c: MOCK_BLUE_DARK },
          { l: "In Bench", v: "8", c: accent },
          { l: "Released", v: "47", c: MOCK_BLUE },
        ].map((s) => (
          <div key={s.l} style={{ flex: 1, padding: 5, background: `${s.c}12`, border: `1px solid ${s.c}30`, borderRadius: 5, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div style={{ fontSize: 7, color: "var(--tb-text-ter)", fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { test: "FBC", patient: "Achol M.", value: "Hb 9.8", flag: "L", color: "#C44536" },
          { test: "Malaria RDT", patient: "James L.", value: "Negative", flag: "N", color: MOCK_BLUE },
          { test: "Glucose", patient: "Mary A.", value: "112 mg/dL", flag: "N", color: MOCK_BLUE },
        ].map((r) => (
          <div key={r.test + r.patient} style={{ display: "flex", alignItems: "center", gap: 6, padding: 5, background: "var(--tb-cream-50)", borderRadius: 5, border: "1px solid var(--tb-cream-200)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "var(--tb-blue-900)" }}>{r.test} <span style={{ color: "var(--tb-text-ter)", fontWeight: 500 }}>· {r.patient}</span></div>
              <div style={{ fontSize: 8, fontFamily: "ui-monospace, monospace", color: r.color }}>{r.value}</div>
            </div>
            <div style={{ fontSize: 7, fontWeight: 800, color: r.color, background: `${r.color}15`, padding: "1px 4px", borderRadius: 3 }}>{r.flag}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function MockImaging({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        {[
          { l: "X-Ray", v: "14" },
          { l: "Ultrasound", v: "9" },
          { l: "CT", v: "3" },
        ].map((s, i) => (
          <div key={s.l} style={{ flex: 1, padding: 5, background: i === 0 ? `${accent}15` : "var(--tb-cream-200)", border: `1px solid ${i === 0 ? accent + '40' : 'var(--tb-cream-300)'}`, borderRadius: 5, textAlign: "center" }}>
            <div style={{ fontSize: 7, color: "var(--tb-text-ter)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{s.l}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? accent : "var(--tb-blue-900)" }}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* Faux scan thumbnails */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, flex: 1 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            background: "linear-gradient(135deg, var(--tb-blue-800) 0%, var(--tb-blue-900) 100%)",
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 4, left: 4, fontSize: 6.5, color: "#fff", opacity: 0.7, fontFamily: "ui-monospace" }}>ACC-{1078 + i}</div>
            <div style={{ position: "absolute", inset: 8, border: `1px solid ${accent}80`, borderRadius: 50, opacity: 0.6 }} />
            <div style={{ position: "absolute", inset: 14, border: `1px solid ${accent}60`, borderRadius: 50, opacity: 0.4 }} />
          </div>
        ))}
      </div>
    </>
  );
}

function MockPharmacy({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, padding: "6px 8px", background: `${accent}10`, border: `1px solid ${accent}40`, borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: accent, fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Dispensed</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tb-blue-900)" }}>87</div>
          <div style={{ color: "var(--tb-text-ter)", fontSize: 7 }}>today</div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: "rgba(196,69,54,0.08)", border: "1px solid rgba(196,69,54,0.30)", borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: "#C44536", fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Low Stock</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#8B2E24" }}>4</div>
          <div style={{ color: "var(--tb-text-ter)", fontSize: 7 }}>reorder soon</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { name: "Amoxicillin 500mg", batch: "BN24091", qty: 240, color: MOCK_BLUE, state: "OK" },
          { name: "Coartem (AL)", batch: "BN24102", qty: 18, color: "#C44536", state: "LOW" },
          { name: "Ferrous sulfate", batch: "BN24087", qty: 96, color: MOCK_BLUE, state: "OK" },
        ].map((m) => (
          <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: 5, background: "var(--tb-cream-50)", borderRadius: 5, border: "1px solid var(--tb-cream-200)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "var(--tb-blue-900)" }}>{m.name}</div>
              <div style={{ fontSize: 7, color: "var(--tb-text-ter)", fontFamily: "ui-monospace" }}>{m.batch}</div>
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "var(--tb-blue-900)", fontVariantNumeric: "tabular-nums" }}>{m.qty}</div>
            <div style={{ fontSize: 6.5, fontWeight: 800, color: m.color, background: `${m.color}15`, padding: "1px 4px", borderRadius: 3 }}>{m.state}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function MockFeedback({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, padding: "6px 8px", background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: accent, fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Avg Rating</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tb-blue-900)", display: "flex", alignItems: "baseline", gap: 2 }}>4.2<span style={{ fontSize: 8, color: "var(--tb-text-ter)" }}>/5</span></div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: "rgba(196,69,54,0.10)", border: "1px solid rgba(196,69,54,0.28)", borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: "#C44536", fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Open Follow-ups</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#8B2E24" }}>3</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { rating: 2, text: "Wait was too long for results.", who: "Anonymous · Lab", color: "#C44536" },
          { rating: 5, text: "The pharmacist explained everything clearly.", who: "Mary K. · Pharmacy", color: MOCK_BLUE },
          { rating: 4, text: "Quick and friendly staff.", who: "James W. · OPD", color: MOCK_BLUE },
        ].map((f, i) => (
          <div key={i} style={{ padding: 5, background: f.rating <= 2 ? "rgba(196,69,54,0.06)" : "var(--tb-cream-50)", borderRadius: 5, border: `1px solid ${f.rating <= 2 ? "rgba(196,69,54,0.20)" : "var(--tb-cream-200)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: f.color }}>{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
              <span style={{ fontSize: 7, color: "var(--tb-text-ter)", marginLeft: "auto" }}>{f.who}</span>
            </div>
            <div style={{ fontSize: 8, color: "var(--tb-blue-900)", marginTop: 2, fontStyle: "italic" }}>“{f.text}”</div>
          </div>
        ))}
      </div>
    </>
  );
}

// Tiny faux trend chart
function ChartLine({ accent }: { accent: string }) {
  return (
    <div style={{ flex: 1, position: "relative", padding: "4px 0", borderRadius: 6, background: "var(--tb-cream-50)", border: "1px solid var(--tb-cream-200)", marginTop: 2, minHeight: 40 }}>
      <svg viewBox="0 0 200 50" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <path d="M0,40 L20,38 L40,30 L60,32 L80,22 L100,25 L120,18 L140,15 L160,20 L180,12 L200,16" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0,40 L20,38 L40,30 L60,32 L80,22 L100,25 L120,18 L140,15 L160,20 L180,12 L200,16 L200,50 L0,50 Z" fill={accent} fillOpacity="0.10" />
      </svg>
    </div>
  );
}
