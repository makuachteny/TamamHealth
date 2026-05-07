"use client";

import {
  Reveal,
  FAQItem,
  DemoForm,
  CheckItem,
} from "@/components/marketing/MarketingShared";
import { DuoIcon } from "@/components/marketing/DuoIcon";
import Link from "next/link";
import Image from "next/image";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Main Marketing Landing Page (Tebra-style 2-column hero)
   Layout: 2-col hero, standards bar, connected section, product
   cards grid, 3-step process, CTA, FAQ, tools, insights
   ═══════════════════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════════════════
   Main Marketing Home Component
   ═══════════════════════════════════════════════════════════════════ */
export default function MarketingHome() {

  return (
    <>
      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section className="mk-hero">
        <div className="mk-container">
          <div className="mk-hero-flex">
            {/* Left: Headline + description + CTA buttons */}
            <div className="mk-hero-content">
              <Reveal>
                <p className="mk-label" style={{ color: "var(--tb-green)" }}>
                  MODERNIZING HEALTHCARE ACROSS AFRICA
                </p>
                <h1 className="mk-h1">
                  Digital health records<br />
                  <strong>designed for</strong><br />
                  <span
                    style={{
                      background: "linear-gradient(90deg, var(--tb-blue-700) 0%, var(--tb-green) 50%, var(--tb-blue-700) 100%)",
                      backgroundSize: "200% 100%",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      animation: "gradientShift 3s ease-in-out infinite",
                    }}
                  >
                    Africa
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mk-body-lg">
                  TamamHealth is building the digital health infrastructure Africa deserves — an offline-first hospital platform that connects EHR, billing, pharmacy, lab, telehealth, and analytics into one system that never goes down, even when the power does.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "24px 0 32px" }}>
                  <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "var(--tb-text)" }}>
                    Works 100% Offline
                  </div>
                  <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "var(--tb-text)" }}>
                    End-to-End Encrypted
                  </div>
                </div>
                <div className="mk-hero-buttons">
                  <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-lg">
                    Request a Demo
                  </Link>
                  <Link href="/ehr" className="mk-btn mk-btn-outline mk-btn-lg">
                    Learn More
                  </Link>
                </div>
              </Reveal>
            </div>

            {/* Center: Hero Photo */}
            <div className="mk-hide-tablet" style={{ flex: "0 0 240px", borderRadius: 16, overflow: "hidden" }}>
              <Reveal delay={0.2}>
                <div style={{ position: "relative", height: 450 }}>
                  <Image
                    src="/assets/doctor-tablet-smiling.jpg"
                    alt="Healthcare worker using TamamHealth digital health records on a tablet"
                    fill
                    style={{ objectFit: "cover", objectPosition: "top center" }}
                    priority
                  />
                </div>
              </Reveal>
            </div>

            {/* Right: Demo Form */}
            <div className="mk-hero-form">
              <Reveal delay={0.25}>
                <DemoForm />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── STANDARDS & INTEGRATION BANNER ───────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center" }}>
              <p className="mk-label">OPEN HEALTH STANDARDS</p>
              <p style={{ fontSize: 16, color: "var(--tb-text-sec)", maxWidth: 600, margin: "0 auto" }}>
                Built on open standards: <strong>DHIS2</strong> · <strong>HL7 FHIR</strong> · <strong>Offline-first architecture</strong>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── EVERYTHING CONNECTED ───────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <p className="mk-label">WHY TamamHealth</p>
                <h2 className="mk-h2">Everything you need, finally connected</h2>
                <p>
                  Most health systems patch together disconnected tools that
                  don&apos;t talk to each other. TamamHealth brings your entire
                  practice onto one platform — EHR, billing, patient
                  engagement, pharmacy, lab, and analytics — so data flows
                  seamlessly and your team can focus on care, not workarounds.
                </p>
                <Link href="/ehr" className="mk-btn mk-btn-green">
                  See how it works
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare team collaborating with TamamHealth platform"
                  width={580}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PRODUCT SOLUTION CARDS GRID ────────────────────────── */}
      <section className="mk-products-section">
        <div className="mk-container">
          <Reveal>
            <div className="mk-products-header">
              <p className="mk-label">OUR SERVICES</p>
              <h2 className="mk-h2">Services powering your practice</h2>
              <p>
                Purpose-built tools that work together to streamline every aspect
                of your healthcare operations.
              </p>
            </div>
          </Reveal>

          <div className="mk-products-grid">
            {[
              {
                icon: <EHRCardIcon />,
                iconBg: "var(--tb-blue-100)", iconColor: "var(--tb-blue-900)",
                title: "Clinical EHR",
                features: ["Customizable SOAP templates", "Clinical decision support", "Patient demographics & history", "Scheduling & calendar", "Offline-first documentation"],
                href: "/ehr", delay: 0,
              },
              {
                icon: <BillingCardIcon />,
                iconBg: "var(--tb-gold-light)", iconColor: "var(--tb-gold-dark)",
                title: "Billing & Payments",
                features: ["Automated claims submission", "Real-time eligibility checks", "Superbill generation", "Revenue cycle dashboard", "Mobile money integration"],
                href: "/billing", delay: 0.05,
              },
              {
                icon: <PharmLabCardIcon />,
                iconBg: "var(--tb-tint-green)", iconColor: "var(--tb-green-dark)",
                title: "Lab & Imaging",
                features: ["Direct lab ordering", "Real-time results", "Imaging integration", "Trend analysis", "Drug interaction checking"],
                href: "/pharmacy-lab", delay: 0.1,
              },
              {
                icon: <PatientExpCardIcon />,
                iconBg: "var(--tb-tint-gold)", iconColor: "var(--tb-gold-dark)",
                title: "Patient Experience",
                features: ["Online self-scheduling", "Automated reminders", "Digital intake forms", "Patient portal", "Multi-language support"],
                href: "/patient-experience", delay: 0.15,
              },
              {
                icon: <TelehealthCardIcon />,
                iconBg: "var(--tb-blue-50)", iconColor: "var(--tb-blue-700)",
                title: "Telehealth",
                features: ["HD video visits", "Virtual waiting rooms", "Secure messaging", "Session recordings", "Bandwidth-adaptive streaming"],
                href: "/telehealth", delay: 0.2,
              },
              {
                icon: <AnalyticsCardIcon />,
                iconBg: "var(--tb-tint-green)", iconColor: "var(--tb-green)",
                title: "Analytics",
                features: ["DHIS2 reporting", "Custom dashboards", "Population health", "Financial analytics", "Real-time insights"],
                href: "/analytics", delay: 0.25,
              },
            ].map((card) => (
              <Reveal key={card.title} delay={card.delay}>
                <Link href={card.href} style={{ textDecoration: "none", display: "block", height: "100%" }}>
                  <div className="mk-product-card" style={{ height: "100%", cursor: "pointer" }}>
                    <div className="mk-product-card-icon" style={{ background: card.iconBg, color: card.iconColor }}>
                      {card.icon}
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 700 }}>{card.title}</h3>
                    <ul style={{
                      listStyle: "none", margin: 0, padding: 0,
                      display: "flex", flexDirection: "column", gap: 10,
                      flex: 1,
                    }}>
                      {card.features.map((f) => (
                        <li key={f} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.4,
                        }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                            background: "var(--tb-tint-green)", color: "var(--tb-green)",
                          }}>
                            <DuoIcon name="check" size={12} />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <span className="mk-product-card-link" style={{ marginTop: 8 }}>
                      Learn more <ArrowRightIcon />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── CORE CAPABILITIES SECTION ───────────────────────────── */}
      <section className="mk-section mk-section-teal" style={{ borderTop: "4px solid var(--tb-gold)" }}>
        <div className="mk-container">
          <Reveal>
            <div className="mk-stat-row">
              <div className="mk-stat-badge">
                <span style={{ display: "block", fontWeight: 700, fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1 }}>Offline-first</span>
                <span>Works without internet</span>
              </div>
              <div className="mk-stat-badge">
                <span style={{ display: "block", fontWeight: 700, fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1 }}>Open standards</span>
                <span>DHIS2 &amp; FHIR compatible</span>
              </div>
              <div className="mk-stat-badge">
                <span style={{ display: "block", fontWeight: 700, fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1 }}>Multi-language</span>
                <span>Built for diverse regions</span>
              </div>
              <div className="mk-stat-badge">
                <span style={{ display: "block", fontWeight: 700, fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1 }}>Mobile-ready</span>
                <span>Runs on any device</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── AUDIENCE CARDS ─────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading">
              <p className="mk-label" style={{ marginBottom: 12 }}>WHO WE SERVE</p>
              <h2 className="mk-h2">Built for every kind of facility</h2>
              <p style={{ fontSize: 16, color: "var(--tb-text-sec)", marginTop: 12 }}>
                Whether you run a single Boma health post or a national referral hospital, TamamHealth scales with you.
              </p>
            </div>
          </Reveal>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {[
              {
                title: "Hospitals & Clinics",
                desc: "Run every department on one shared patient record — from triage to ward rounds, lab to pharmacy, billing to HR.",
                href: "/products/hospital",
                cta: "Explore HMIS",
                accent: "var(--tb-blue-700)",
                bg: "var(--tb-tint-blue)",
                icon: <DuoIcon name="hospital" size={52} />,
              },
              {
                title: "Diagnostic Centres",
                desc: "Order-to-result lab and imaging workflow with instrument integration, TAT tracking, and critical-result alerts.",
                href: "/products/lab",
                cta: "Explore LIS / RIS",
                accent: "var(--tb-gold-dark)",
                bg: "var(--tb-tint-gold)",
                icon: <DuoIcon name="lab" size={52} />,
              },
              {
                title: "Pharmacies",
                desc: "Stock-to-dispense control with batch tracking, expiry alerts, electronic Rx dispensing, POS, and controlled-substance audit.",
                href: "/products/pharmacy",
                cta: "Explore PMS",
                accent: "var(--tb-green-dark)",
                bg: "var(--tb-tint-green)",
                icon: <DuoIcon name="pharmacy" size={52} />,
              },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 0.05}>
                <Link href={card.href} style={{ textDecoration: "none", display: "block", height: "100%" }}>
                  <div
                    style={{
                      background: card.bg,
                      borderRadius: 16,
                      padding: 32,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      transition: "transform .15s ease, box-shadow .15s ease",
                    }}
                    className="mk-product-list-card"
                  >
                    <div style={{ color: card.accent }}>{card.icon}</div>
                    <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--tb-text-pri)", margin: 0 }}>{card.title}</h3>
                    <p style={{ fontSize: 14.5, color: "var(--tb-text-sec)", lineHeight: 1.55, margin: 0, flex: 1 }}>{card.desc}</p>
                    <span style={{ fontSize: 14, fontWeight: 700, color: card.accent, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      {card.cta}
                      <DuoIcon name="arrow-right" size={14} />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE TamamHealth ── 9-feature grid ─────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading">
              <p className="mk-label" style={{ marginBottom: 12 }}>WHY TamamHealth</p>
              <h2 className="mk-h2">A platform built for the realities of South Sudan</h2>
            </div>
          </Reveal>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {[
              { title: "Maximize your returns", body: "Reduce administrative cost per patient and recover revenue that paper systems leave on the table." },
              { title: "Low cost of ownership", body: "Built on open-source infrastructure. No license fees per seat. Runs on basic hardware." },
              { title: "Integration-ready", body: "Out-of-the-box connectors for M-Gurush, MTN MoMo, DHIS2, lab analyzers, and PACS." },
              { title: "Easy to learn", body: "Designed so a clinical officer who's never used a computer can be productive in under an hour." },
              { title: "Cloud or on-premise", body: "Web, desktop, mobile. Run on a $300 mini-PC at the facility, or on cloud — your call." },
              { title: "Multi-facility ready", body: "From a single PHCU to a 30-facility chain. Same product, same patient record, same login." },
              { title: "Comprehensive reports", body: "Built-in BI with the dashboards your medical superintendent and the Ministry both need." },
              { title: "Custom workflows", body: "Configure each module to match how your facility actually works — not the other way around." },
              { title: "Quick deployment", body: "Browser-based. Most clinics live in 2-4 weeks; hospitals in 6-10 weeks." },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.03}>
                <div
                  style={{
                    background: "var(--tb-cream-50)",
                    border: "1px solid var(--tb-cream-300)",
                    borderRadius: 12,
                    padding: 22,
                    height: "100%",
                  }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--tb-text-pri)", margin: "0 0 8px" }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.55, margin: 0 }}>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── BIG NUMBERS BAND ───────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, var(--tb-blue-900) 0%, var(--tb-blue-800) 50%, var(--tb-blue-700) 100%)",
          padding: "64px 0",
        }}
      >
        <div className="mk-container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 32,
              textAlign: "center",
              color: "#fff",
            }}
          >
            {[
              { value: "10", label: "South Sudan States Designed For" },
              { value: "5", label: "Facility Levels Supported" },
              { value: "17", label: "Clinical Roles Modelled" },
              { value: "11", label: "Languages Ready" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.05}>
                <div>
                  <div style={{ fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 800, letterSpacing: -1, fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 10 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.85 }}>
                    {s.label}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── GET STARTED IN 3 EASY STEPS ───────────────────────── */}
      <section className="mk-steps-section">
        <div className="mk-container">
          <Reveal>
            <div className="mk-steps-header">
              <p className="mk-label">HOW IT WORKS</p>
              <h2 className="mk-h2">Get started in 3 easy steps</h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mk-steps-grid">
              <div className="mk-step">
                <div className="mk-step-number">1</div>
                <h3>Tell us about your practice</h3>
                <p>
                  Share your facility size, specialties, and workflow needs so we can tailor a solution that fits. Whether you&apos;re a single-provider clinic or a multi-site hospital network, we&apos;ll design an implementation plan around your reality.
                </p>
              </div>
              <div className="mk-step">
                <div className="mk-step-number">2</div>
                <h3>See TamamHealth in action</h3>
                <p>
                  Get a personalized demo showing exactly how TamamHealth solves your specific challenges — from offline charting and lab ordering to billing and analytics. We use real-world scenarios from clinics like yours.
                </p>
              </div>
              <div className="mk-step">
                <div className="mk-step-number">3</div>
                <h3>Go live in weeks, not months</h3>
                <p>
                  Our dedicated onboarding team migrates your data, trains your staff, and supports you through go-live and beyond. Most clinics are fully operational within 2–4 weeks.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div style={{ textAlign: "center", marginTop: 48 }}>
              <Link href="/about/contact" className="mk-btn mk-btn-gold mk-btn-lg">
                Get started today
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FOUNDED FROM LIVED EXPERIENCE ─────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <p className="mk-label" style={{ color: "var(--tb-gold-dark)" }}>OUR STORY</p>
                <h2 className="mk-h2">Built from lived experience</h2>
                <p className="mk-body" style={{ lineHeight: 1.8 }}>
                  TamamHealth was born in Kakuma Refugee Camp, where our founder watched patients die not from lack of medicine — but lack of information. Today, three Tufts University co-founders are turning that lived experience into the digital health platform Africa deserves.
                </p>
                <p className="mk-body" style={{ marginTop: 16, lineHeight: 1.8 }}>
                  <strong>$10,000 Healthcare Track Winner</strong> — Tufts $100K New Ventures Competition, April 2026.
                </p>

                {/* Timeline Strip */}
                <div style={{ marginTop: 32, paddingTop: 32, borderTop: "1px solid var(--tb-cream-300)" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 16,
                      fontSize: 13,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, color: "var(--tb-gold-dark)", marginBottom: 4 }}>2024</div>
                      <div style={{ color: "var(--tb-text-sec)", fontSize: 12 }}>Idea born</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--tb-gold)" }} />
                      <div style={{ height: 2, background: "var(--tb-cream-300)", flex: 1 }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, color: "var(--tb-gold-dark)", marginBottom: 4 }}>2025</div>
                      <div style={{ color: "var(--tb-text-sec)", fontSize: 12 }}>Built at Tufts</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--tb-gold)" }} />
                      <div style={{ height: 2, background: "var(--tb-cream-300)", flex: 1 }} />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 16,
                      fontSize: 13,
                      marginTop: 12,
                      alignItems: "center",
                    }}
                  >
                    <div />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, color: "var(--tb-gold-dark)", marginBottom: 4 }}>Apr 2026</div>
                      <div style={{ color: "var(--tb-text-sec)", fontSize: 12 }}>Won $10K</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--tb-gold)" }} />
                      <div style={{ height: 2, background: "var(--tb-cream-300)", flex: 1 }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, color: "var(--tb-green-dark)", marginBottom: 4 }}>Now</div>
                      <div style={{ color: "var(--tb-text-sec)", fontSize: 12 }}>Serving Africa</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Link href="/about" className="mk-btn mk-btn-outline-green">
                    Read our full story
                  </Link>
                </div>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/team-derby-center.jpg"
                  alt="TamamHealth co-founders at the Derby Entrepreneurship Center, Tufts University"
                  width={600}
                  height={450}
                  style={{ width: "100%", height: "auto", borderRadius: 16 }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FUND OUR PILOT BANNER ───────────────────────────── */}
      <section style={{
        padding: "64px 0",
        background: "linear-gradient(135deg, #1A3A3A 0%, #1E4D4A 50%, #1A3A3A 100%)",
      }}>
        <div className="mk-container">
          <Reveal>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 48, alignItems: "center",
            }}>
              <div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(228,168,75,0.15)", border: "1px solid rgba(228,168,75,0.3)",
                  borderRadius: 20, padding: "5px 14px", marginBottom: 20,
                }}>
                  <DuoIcon name="heart" size={14} />
                  <span style={{ color: "#E4A84B", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>FUNDRAISING</span>
                </div>
                <h2 style={{
                  fontFamily: "var(--tb-serif)", fontSize: "clamp(28px, 3vw, 38px)",
                  fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 16,
                }}>
                  Help us pilot TamamHealth in 10 clinics across South Sudan
                </h2>
                <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: 28 }}>
                  We&apos;re raising $100,000 to bring offline-first digital health records to 10 clinics across South Sudan. Every dollar goes directly to equipment, training, and 12 months of support for healthcare workers.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link
                    href="/donate"
                    className="mk-btn mk-btn-gold mk-btn-lg"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    <DuoIcon name="heart" size={16} />
                    Fund Our Pilot
                  </Link>
                  <Link href="/about/contact" className="mk-btn mk-btn-outline-white mk-btn-lg">
                    Request a Demo
                  </Link>
                </div>
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
              }}>
                {[
                  { amount: "$50", label: "Digitize a clinic week" },
                  { amount: "$250", label: "Train a health worker" },
                  { amount: "$2,500", label: "Equip a full clinic" },
                  { amount: "$10,000", label: "Launch a pilot site" },
                ].map((tier) => (
                  <div key={tier.amount} style={{
                    background: "rgba(255,255,255,0.06)", borderRadius: 14,
                    padding: "20px 18px", border: "1px solid rgba(255,255,255,0.1)",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--tb-gold)", marginBottom: 4 }}>{tier.amount}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{tier.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <section className="mk-cta-banner">
        <div className="mk-container">
          <Reveal>
            <div className="mk-cta-banner-inner">
              <div className="mk-cta-banner-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare professionals collaborating with TamamHealth"
                  width={580}
                  height={420}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
              <div className="mk-cta-banner-content">
                <h2 className="mk-h2">
                  Modern EHR designed for Africa. Ready to transform
                  your clinic?
                </h2>
                <p>
                  TamamHealth brings offline-first technology, open standards support,
                  and world-class support to clinics across Africa. Schedule your
                  free personalized demo today.
                </p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-lg">
                    Request a demo
                  </Link>
                  <Link href="/ehr" className="mk-btn mk-btn-outline mk-btn-lg">
                    Learn more
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FAQ SECTION ─────────────────────────────────────────── */}
      <section className="mk-faq-section">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2 mk-faq-title">Frequently asked questions</h2>
          </Reveal>

          <div className="mk-faq-list">
            <FAQItem
              question="Why should I choose TamamHealth&apos;s EHR over another EHR?"
              answer="TamamHealth&apos;s EHR is built specifically for healthcare in low-resource settings and was designed based on lived experience in these contexts. It has the key features you need and is surprisingly easy to use. Write a note, prescribe a medication, view electronic medical records, and create a superbill in just minutes. Plus, we offer full customer service and training support free of charge."
            />
            <FAQItem
              question="How does the integration between Clinical and Billing work?"
              answer="TamamHealth seamlessly connects your clinical documentation with billing. When you complete a patient visit, diagnoses and procedures automatically flow into the billing module. This reduces manual entry and ensures accurate claims submission."
            />
            <FAQItem
              question="Does TamamHealth work offline?"
              answer="Yes. TamamHealth is built offline-first. You can document patient encounters, write prescriptions, and manage your schedule even without internet connectivity. Data syncs automatically when your connection is restored — no data is ever lost."
            />
            <FAQItem
              question="Will local pharmacies and labs be integrated?"
              answer="Yes. TamamHealth integrates with local pharmacy and lab networks across the regions we serve. You can send electronic prescriptions and orders directly to partner providers, improving medication adherence and service coordination."
            />
            <FAQItem
              question="What about data security and compliance?"
              answer="TamamHealth uses end-to-end encryption, role-based access controls, and is designed to meet international data protection standards. We maintain strict security practices and are compatible with national health system requirements."
            />
            <FAQItem
              question="How long does implementation take?"
              answer="Most practices are fully operational on TamamHealth within 2 weeks. Our dedicated onboarding team handles data migration, system configuration, and staff training. We stay with you until every team member is confident and productive."
            />
            <FAQItem
              question="Are there specific system requirements?"
              answer="TamamHealth works on any modern web browser — Chrome, Firefox, Safari, or Edge. No special hardware is required. It&apos;s optimized for low-bandwidth environments and includes a mobile app for smartphones and tablets."
            />
            <FAQItem
              question="Can TamamHealth integrate with DHIS2?"
              answer="Yes. TamamHealth has native DHIS2 integration that automates health facility reporting to national health information systems. Reports that used to take days to compile are generated with a single click."
            />
            <FAQItem
              question="What support do you offer?"
              answer="Every TamamHealth customer gets unlimited phone, email, and chat support at no extra cost. We also provide on-site training, video tutorials, and a comprehensive knowledge base."
            />
            <FAQItem
              question="How much does TamamHealth cost?"
              answer="TamamHealth offers flexible pricing based on your practice size and needs. We have plans for solo practitioners, small clinics, and large hospitals. Contact us for a personalized quote — there are no hidden fees or long-term contracts required."
            />
          </div>

          <div className="mk-show-more">
            <Link href="/ehr" className="mk-btn mk-btn-outline mk-btn-sm">
              View all FAQs
            </Link>
          </div>
        </div>
      </section>

      {/* ── PRACTICE TOOLS TILES ──────────────────────────────── */}
      <section className="mk-tools-section">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p className="mk-label">RESOURCES</p>
              <h2 className="mk-h2">Practice management tools</h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mk-tools-grid">
              <div className="mk-tool-card">
                <div className="mk-tool-card-icon" style={{ background: "var(--tb-blue-100)", color: "var(--tb-blue-700)" }}>
                  <DuoIcon name="analytics" size={56} />
                </div>
                <h3>EHR Comparison Tool</h3>
                <p>
                  Compare TamamHealth against other EHR systems across 50+ features.
                  See why providers choose us for Africa&apos;s healthcare needs.
                </p>
              </div>
              <div className="mk-tool-card">
                <div className="mk-tool-card-icon" style={{ background: "var(--tb-tint-green)", color: "var(--tb-green-dark)" }}>
                  <DuoIcon name="money" size={56} />
                </div>
                <h3>Revenue Calculator</h3>
                <p>
                  Estimate how much additional revenue you could collect
                  with automated billing and mobile money integration.
                </p>
              </div>
              <div className="mk-tool-card">
                <div className="mk-tool-card-icon" style={{ background: "var(--tb-tint-gold)", color: "var(--tb-gold-dark)" }}>
                  <DuoIcon name="shield-check" size={56} />
                </div>
                <h3>Readiness Assessment</h3>
                <p>
                  Take a 5-minute assessment to see how ready your facility
                  is for digital transformation and where to start.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── INSIGHTS / BLOG SECTION ───────────────────────────── */}
      <section className="mk-insights-section">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <p className="mk-label">INSIGHTS</p>
              <h2 className="mk-h2">Latest from the TamamHealth blog</h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mk-insights-grid">
              <div className="mk-insight-card">
                <div className="mk-insight-card-image" style={{ background: "var(--tb-blue-100)" }}>
                  <Image
                    src="/assets/doctor-tablet-review.jpg"
                    alt="Doctor reviewing digital health data on tablet"
                    width={400}
                    height={200}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
                  />
                </div>
                <div className="mk-insight-card-body">
                  <span className="mk-label">DIGITAL HEALTH</span>
                  <h3>Paper Kills: How Clinics in South Sudan Are Going Fully Digital</h3>
                  <p>
                    A rural clinic in Eastern Equatoria eliminated paper records in 14 days. Here&apos;s what they learned about going digital when connectivity is a luxury.
                  </p>
                </div>
              </div>
              <div className="mk-insight-card">
                <div className="mk-insight-card-image" style={{ background: "var(--tb-cream-200)" }}>
                  <Image
                    src="/assets/doctor-writing-notes.jpg"
                    alt="Doctor documenting clinical notes"
                    width={400}
                    height={200}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
                  />
                </div>
                <div className="mk-insight-card-body">
                  <span className="mk-label">IMPLEMENTATION</span>
                  <h3>From Filing Cabinets to Cloud: A Clinic&apos;s 2-Week EHR Migration Story</h3>
                  <p>
                    How Malakal Women&apos;s Health Center moved 12,000 patient records to TamamHealth in under two weeks — and cut admin time by 90%.
                  </p>
                </div>
              </div>
              <div className="mk-insight-card">
                <div className="mk-insight-card-image" style={{ background: "var(--tb-sage-100)" }}>
                  <Image
                    src="/assets/african-nurse.jpg"
                    alt="Offline-first healthcare"
                    width={400}
                    height={200}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
                  />
                </div>
                <div className="mk-insight-card-body">
                  <span className="mk-label">TECHNOLOGY</span>
                  <h3>No Internet? No Problem. The Engineering Behind Offline-First Healthcare</h3>
                  <p>
                    PouchDB, CouchDB, and the sync protocol that keeps clinical data safe when the power grid fails.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── BOTTOM CTA HERO ──────────────────────────────────── */}
      <section className="mk-hero">
        <div className="mk-container">
          <div className="mk-hero-flex">
            <div className="mk-hero-content">
              <Reveal>
                <h1 className="mk-h1" style={{ fontSize: "clamp(30px, 3.5vw, 48px)" }}>
                  Healthcare providers across Africa are transforming care with TamamHealth.
                  It&apos;s your turn.
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p style={{ marginBottom: 20 }}>
                  Schedule your customized demo and:
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Get a free data-driven practice assessment</CheckItem>
                  <CheckItem>See how TamamHealth fits your specific workflows</CheckItem>
                  <CheckItem>No strings attached — no commitment required</CheckItem>
                </ul>
                <div className="mk-hero-buttons" style={{ marginTop: 28 }}>
                  <Link
                    href="/about/contact"
                    className="mk-btn mk-btn-green mk-btn-lg"
                    style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
                  >
                    Schedule Demo
                  </Link>
                  <Link href="/ehr" className="mk-btn mk-btn-outline mk-btn-lg">
                    Learn more
                  </Link>
                </div>
              </Reveal>
            </div>

            {/* Right: Demo form */}
            <div>
              <Reveal delay={0.15}>
                <DemoForm />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── Global CSS Animations ──────────────────────────────────── */}
      <style>{`
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(26, 58, 58, 0.7);
          }
          50% {
            opacity: 0.95;
            box-shadow: 0 0 0 10px rgba(26, 58, 58, 0);
          }
        }

        @keyframes floatBadge {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

      `}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Product Card Icons — thin wrappers around DuoIcon
   ═══════════════════════════════════════════════════════════════════ */

function EHRCardIcon() { return <DuoIcon name="ehr" size={56} />; }
function PatientExpCardIcon() { return <DuoIcon name="users" size={56} />; }
function TelehealthCardIcon() { return <DuoIcon name="video" size={56} />; }
function BillingCardIcon() { return <DuoIcon name="billing" size={56} />; }
function AnalyticsCardIcon() { return <DuoIcon name="analytics" size={56} />; }
function PharmLabCardIcon() { return <DuoIcon name="pharmacy" size={56} />; }
function ArrowRightIcon() { return <DuoIcon name="arrow-right" size={14} />; }

