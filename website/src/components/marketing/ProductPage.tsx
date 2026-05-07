"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "./MarketingShared";
import { DuoIcon } from "./DuoIcon";

/* ═════════════════════════════════════════════════════════════════════
   Reusable scaffolding for the /products/* detail pages.
   Each product page composes <ProductHero>, <ProductModuleGrid>,
   <ProductBenefits>, and <ProductCTA> with its own copy.
   ═════════════════════════════════════════════════════════════════════ */

export function ProductHero({
  eyebrow, title, subtitle, accentColor = "var(--tb-blue-700)",
  primaryCta = { label: "Request a demo", href: "/about/contact" },
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
  return (
    <section className="mk-hero mk-product-hero">
      <div className="mk-container">
        <div className="mk-product-hero-grid">
          <Reveal>
            <div>
              <p className="mk-label" style={{ color: accentColor }}>{eyebrow}</p>
              <h1 className="mk-h1" style={{ marginBottom: 20 }}>{title}</h1>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--tb-text-sec)", marginBottom: 32 }}>{subtitle}</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={primaryCta.href} className="mk-btn mk-btn-green">{primaryCta.label}</Link>
                {secondaryCta && (
                  <Link href={secondaryCta.href} className="mk-btn mk-btn-outline">{secondaryCta.label}</Link>
                )}
              </div>
            </div>
          </Reveal>
          {illustration && (
            <Reveal delay={0.1}>
              <div>{illustration}</div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
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
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
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
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
                  <DuoIcon name="check" size={11} />
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
  primaryCta = { label: "Talk to our team", href: "/about/contact" },
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

export function ProductIllustration({
  accent = "var(--tb-blue-700)",
  variant = 'vitals',
}: {
  accent?: string;
  variant?: ProductMockVariant;
  /** Legacy prop — ignored. Use `variant` instead. */
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "4 / 3",
        background: "linear-gradient(135deg, #FAFAF8 0%, #F2F5F3 100%)",
        border: "1px solid var(--tb-cream-300)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 30px 80px -30px rgba(26, 58, 58, 0.25), 0 4px 12px -4px rgba(26, 58, 58, 0.10)",
        padding: 12,
      }}
    >
      {/* Decorative accent blobs */}
      <div aria-hidden style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: accent, opacity: 0.08, pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: -80, left: -40, width: 240, height: 240, borderRadius: "50%", background: accent, opacity: 0.05, pointerEvents: "none" }} />

      {/* "App window" frame */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: "#FFFFFF",
          borderRadius: 10,
          border: "1px solid #E8E6E2",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "60px 1fr",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          fontSize: 11,
          color: "#1A2C2A",
        }}
      >
        {/* Window-chrome stripe */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 18, background: "#F2F5F3", borderBottom: "1px solid #E8E6E2", display: "flex", alignItems: "center", paddingLeft: 8, gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF5F57" }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FEBC2E" }} />
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#28C840" }} />
        </div>

        {/* Sidebar */}
        <div style={{ paddingTop: 26, background: "#FAFAF8", borderRight: "1px solid #E8E6E2", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${accent} 0%, #1A3A3A 100%)` }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 26, height: 26, borderRadius: 6, background: i === 1 ? `${accent}20` : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: i === 1 ? accent : "#5A7370", opacity: i === 1 ? 1 : 0.5 }} />
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div style={{ paddingTop: 26, padding: "26px 12px 10px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
          {/* Topbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6, borderBottom: "1px solid #F2F5F3" }}>
            <div style={{ flex: 1, height: 16, borderRadius: 4, background: "#F2F5F3" }} />
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: accent }} />
          </div>

          {variant === 'vitals' && <MockVitals accent={accent} />}
          {variant === 'clinic' && <MockClinic accent={accent} />}
          {variant === 'lab' && <MockLab accent={accent} />}
          {variant === 'imaging' && <MockImaging accent={accent} />}
          {variant === 'pharmacy' && <MockPharmacy accent={accent} />}
          {variant === 'feedback' && <MockFeedback accent={accent} />}
        </div>
      </div>
    </div>
  );
}

// ── Per-product content treatments ────────────────────────────────────

function MockVitals({ accent }: { accent: string }) {
  return (
    <>
      {/* Patient card */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: "#FAFAF8", borderRadius: 8, border: "1px solid #E8E6E2" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #D96E59 0%, #C44536 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10 }}>AD</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1A2C2A" }}>Achol M. Deng</div>
          <div style={{ fontSize: 8.5, color: "#5A7370" }}>28 y · F · BOMA-KJ-HH1024</div>
        </div>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#C44536", background: "rgba(196,69,54,0.12)", padding: "2px 5px", borderRadius: 4 }}>Pregnant · 28 wk</div>
      </div>
      {/* Vital tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {[
          { label: "HR", value: "86", unit: "bpm", color: "#C44536", normal: true },
          { label: "BP", value: "128/84", unit: "mmHg", color: "#C44536", normal: false },
          { label: "Temp", value: "37.2", unit: "°C", color: "#E4A84B", normal: true },
        ].map((v) => (
          <div key={v.label} style={{
            padding: 6, borderRadius: 6,
            background: v.normal ? "#F2F5F3" : "rgba(196,69,54,0.08)",
            border: `1px solid ${v.normal ? "#E8E6E2" : "rgba(196,69,54,0.30)"}`,
          }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: v.normal ? "#5A7370" : v.color, letterSpacing: 0.4, textTransform: "uppercase" }}>{v.label}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1A2C2A", marginTop: 1 }}>{v.value}<span style={{ fontSize: 7, color: "#5A7370", marginLeft: 1 }}>{v.unit}</span></div>
            <div style={{ fontSize: 7, fontWeight: 600, color: v.normal ? "#15795C" : v.color, marginTop: 1 }}>{v.normal ? "Normal" : "Elevated"}</div>
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
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1A2C2A" }}>34</div>
          <div style={{ color: "#5A7370", fontSize: 7 }}>Patients</div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: "#F2F5F3", border: "1px solid #E8E6E2", borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: "#5A7370", fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Waiting</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1A2C2A" }}>5</div>
          <div style={{ color: "#5A7370", fontSize: 7 }}>~12 min</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { name: "Mary Akon", id: "JTH-0247", status: "In room 3", color: "#15795C" },
          { name: "James Lado", id: "JTH-0246", status: "Triage", color: "#E4A84B" },
          { name: "Stella Wani", id: "JTH-0245", status: "Pharmacy", color: accent },
        ].map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: 5, background: "#FAFAF8", borderRadius: 5, border: "1px solid #F2F5F3" }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: `linear-gradient(135deg, ${accent} 0%, #1A3A3A 100%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 7 }}>{p.name.split(" ").map(n => n[0]).join("")}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "#1A2C2A" }}>{p.name}</div>
              <div style={{ fontSize: 7, color: "#5A7370" }}>{p.id}</div>
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
          { l: "Pending", v: "12", c: "#B8741C" },
          { l: "In Bench", v: "8", c: accent },
          { l: "Released", v: "47", c: "#15795C" },
        ].map((s) => (
          <div key={s.l} style={{ flex: 1, padding: 5, background: `${s.c}12`, border: `1px solid ${s.c}30`, borderRadius: 5, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div style={{ fontSize: 7, color: "#5A7370", fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { test: "FBC", patient: "Achol M.", value: "Hb 9.8", flag: "L", color: "#C44536" },
          { test: "Malaria RDT", patient: "James L.", value: "Negative", flag: "N", color: "#15795C" },
          { test: "Glucose", patient: "Mary A.", value: "112 mg/dL", flag: "N", color: "#15795C" },
        ].map((r) => (
          <div key={r.test + r.patient} style={{ display: "flex", alignItems: "center", gap: 6, padding: 5, background: "#FAFAF8", borderRadius: 5, border: "1px solid #F2F5F3" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "#1A2C2A" }}>{r.test} <span style={{ color: "#5A7370", fontWeight: 500 }}>· {r.patient}</span></div>
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
          <div key={s.l} style={{ flex: 1, padding: 5, background: i === 0 ? `${accent}15` : "#F2F5F3", border: `1px solid ${i === 0 ? accent + '40' : '#E8E6E2'}`, borderRadius: 5, textAlign: "center" }}>
            <div style={{ fontSize: 7, color: "#5A7370", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{s.l}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? accent : "#1A2C2A" }}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* Faux scan thumbnails */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, flex: 1 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            background: "linear-gradient(135deg, #1A3A3A 0%, #0a1a1a 100%)",
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
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1A2C2A" }}>87</div>
          <div style={{ color: "#5A7370", fontSize: 7 }}>today</div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: "rgba(196,69,54,0.08)", border: "1px solid rgba(196,69,54,0.30)", borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: "#C44536", fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Low Stock</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#8B2E24" }}>4</div>
          <div style={{ color: "#5A7370", fontSize: 7 }}>reorder soon</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { name: "Amoxicillin 500mg", batch: "BN24091", qty: 240, color: "#15795C", state: "OK" },
          { name: "Coartem (AL)", batch: "BN24102", qty: 18, color: "#C44536", state: "LOW" },
          { name: "Ferrous sulfate", batch: "BN24087", qty: 96, color: "#15795C", state: "OK" },
        ].map((m) => (
          <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: 5, background: "#FAFAF8", borderRadius: 5, border: "1px solid #F2F5F3" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "#1A2C2A" }}>{m.name}</div>
              <div style={{ fontSize: 7, color: "#5A7370", fontFamily: "ui-monospace" }}>{m.batch}</div>
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#1A2C2A", fontVariantNumeric: "tabular-nums" }}>{m.qty}</div>
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
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1A2C2A", display: "flex", alignItems: "baseline", gap: 2 }}>4.2<span style={{ fontSize: 8, color: "#5A7370" }}>/5</span></div>
        </div>
        <div style={{ flex: 1, padding: "6px 8px", background: "rgba(196,69,54,0.10)", border: "1px solid rgba(196,69,54,0.28)", borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: "#C44536", fontSize: 7, letterSpacing: 0.4, textTransform: "uppercase" }}>Open Follow-ups</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#8B2E24" }}>3</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { rating: 2, text: "Wait was too long for results.", who: "Anonymous · Lab", color: "#C44536" },
          { rating: 5, text: "The pharmacist explained everything clearly.", who: "Mary K. · Pharmacy", color: "#15795C" },
          { rating: 4, text: "Quick and friendly staff.", who: "James W. · OPD", color: "#15795C" },
        ].map((f, i) => (
          <div key={i} style={{ padding: 5, background: f.rating <= 2 ? "rgba(196,69,54,0.06)" : "#FAFAF8", borderRadius: 5, border: `1px solid ${f.rating <= 2 ? "rgba(196,69,54,0.20)" : "#F2F5F3"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: f.color }}>{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
              <span style={{ fontSize: 7, color: "#5A7370", marginLeft: "auto" }}>{f.who}</span>
            </div>
            <div style={{ fontSize: 8, color: "#1A2C2A", marginTop: 2, fontStyle: "italic" }}>“{f.text}”</div>
          </div>
        ))}
      </div>
    </>
  );
}

// Tiny faux trend chart
function ChartLine({ accent }: { accent: string }) {
  return (
    <div style={{ flex: 1, position: "relative", padding: "4px 0", borderRadius: 6, background: "#FAFAF8", border: "1px solid #F2F5F3", marginTop: 2, minHeight: 40 }}>
      <svg viewBox="0 0 200 50" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <path d="M0,40 L20,38 L40,30 L60,32 L80,22 L100,25 L120,18 L140,15 L160,20 L180,12 L200,16" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M0,40 L20,38 L40,30 L60,32 L80,22 L100,25 L120,18 L140,15 L160,20 L180,12 L200,16 L200,50 L0,50 Z" fill={accent} fillOpacity="0.10" />
      </svg>
    </div>
  );
}
