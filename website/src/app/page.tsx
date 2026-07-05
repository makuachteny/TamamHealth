"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — One-Page Website
   Ported 1:1 from the Claude Design project "Website outline improvement",
   file "One-Page Website v3.dc.html".
   ═══════════════════════════════════════════════════════════════════ */

const SLIDES = [
  {
    src: "/assets/landing-img.jpg",
    alt: "A team of South Sudanese midwives outside a maternity tent",
    caption: "Midwives outside a maternity tent — the front line of care",
  },
  {
    src: "/assets/images/reviewing-health-records.jpeg",
    alt: "A family reviewing paper health records",
    caption: "A family's health history, kept on paper",
  },
  {
    src: "/assets/images/doctor-clipboard-review.jpeg",
    alt: "A clinician reviewing a patient's paper chart on a clipboard",
    caption: "Clinicians rebuild each patient's story by hand",
  },
  {
    src: "/assets/images/community-medication-distribution.jpeg",
    alt: "A health worker distributing medication and recording it in a paper register",
    caption: "Medication logged line-by-line in paper registers",
  },
  {
    src: "/assets/images/pediatric-ward-interior.jpeg",
    alt: "A crowded pediatric ward with limited beds",
    caption: "Pediatric wards stretched past capacity",
  },
];

const CRISIS_STATS = [
  {
    value: "1,223",
    unit: "maternal deaths per 100,000 live births",
    context:
      "The highest maternal mortality rate in the world. In the US, the rate is under 20.",
    source: "WHO",
  },
  {
    value: "1:65,000",
    unit: "doctors to people",
    context:
      "One physician serves roughly 65,000 people — among the lowest ratios on Earth.",
    source: "WHO / UNFPA",
  },
  {
    value: "40%",
    unit: "of health facilities are functional",
    context: "Fewer than half of clinics and hospitals can actually deliver care.",
    source: "UNFPA",
  },
  {
    value: "10M+",
    unit: "people need humanitarian assistance",
    context: "Two-thirds of the entire population, projected for 2026.",
    source: "UN OCHA",
  },
];

const BREAKDOWN_STEPS = [
  {
    num: "1",
    image: "/assets/images/reviewing-health-records.jpeg",
    alt: "A family reviewing paper health records",
    title: "Paper-based record system",
    body: "Every visit starts from scratch — histories live in ledgers, slips, and memory.",
  },
  {
    num: "2",
    image: "/assets/images/pediatric-ward-interior.jpeg",
    alt: "A crowded pediatric ward",
    title: "Slow diagnosis process",
    body: "Clinicians rebuild each patient's story by hand while wards fill past capacity.",
  },
  {
    num: "3",
    image: "/assets/images/community-medication-distribution.jpeg",
    alt: "A health worker recording medication in a paper register",
    title: "Misdiagnosis",
    body: "Missing history means duplicate treatment, wrong calls, and lost follow-up.",
  },
];

const GROUND_STATS = [
  { value: "48%", label: "of health data is never reported" },
  { value: "80%", label: "of patients have no IDs" },
  { value: "85%", label: "of facilities have no internet" },
];

const INSIGHTS = [
  {
    number: "01",
    kicker: "From the wards",
    title: "Medical experts",
    bg: "#0B1145",
    fg: "#FFFFFF",
    shadow: "#2191D0",
    borderColor: "rgba(255,255,255,0.35)",
    kickerColor: "#7FC4EA",
    numColor: "rgba(255,255,255,0.18)",
    rule: "rgba(255,255,255,0.2)",
    points: [
      "High data loss between visits and departments",
      "Duplicate treatment from missing histories",
      "Poor insights for planning and reporting",
    ],
  },
  {
    number: "02",
    kicker: "From the waiting line",
    title: "Patients",
    bg: "#FFFFFF",
    fg: "#10195A",
    shadow: "rgba(221,242,251,0.35)",
    borderColor: "#FFFFFF",
    kickerColor: "#2191D0",
    numColor: "#EFF8FD",
    rule: "#E2E8F0",
    points: [
      "Manual transfers between facilities are ineffective",
      "Misdiagnosis from incomplete records",
      "Very slow clinical flow, long waits",
    ],
  },
];

const PRINCIPLES = [
  {
    number: "01",
    title: "One record across every visit",
    body: "Registration, triage, consultation, lab, pharmacy, referral, billing, and reporting stay connected to the same patient story.",
  },
  {
    number: "02",
    title: "Care that keeps working offline",
    body: "Clinics keep working through unreliable internet, power interruptions, and paper-heavy workflows, then sync safely when connection returns.",
  },
  {
    number: "03",
    title: "Accountable Data",
    body: "Facility and country layers protect sensitive health records while making encounter-level reporting easier to trust.",
  },
  {
    number: "04",
    title: "Facility data to national insight",
    body: "Clean clinical records become facility dashboards, surveillance signals, DHIS2-ready reports, and better national health planning.",
  },
];

const WORKFLOW_STEPS = [
  "Register",
  "Triage",
  "Consult",
  "Order",
  "Dispense",
  "Bill",
  "Report",
].map((label, i) => ({ label, bg: i % 2 === 0 ? "#FFFFFF" : "#EFF8FD" }));

const OUTCOMES = [
  {
    title: "No duplicate records",
    body: "Each visit adds to the same patient story, so teams stop rebuilding history from paper slips.",
    border: "1px solid #E2E8F0",
  },
  {
    title: "One source for operations",
    body: "Clinical work, pharmacy activity, billing, and reporting all stay connected to the encounter.",
    border: "1px solid #E2E8F0",
  },
  {
    title: "Built for low connectivity",
    body: "Facilities can keep working through network gaps and sync when the connection returns.",
    border: "none",
  },
];

const PRODUCTS = [
  {
    index: "01",
    acronym: "HMIS",
    title: "Hospital Management System",
    tagline: "For State, County & Referral hospitals",
    description:
      "A connected facility platform for OPD, IPD, ward management, laboratory, imaging, pharmacy, billing, HR, and reporting, all tied to the same patient record.",
    modules: [
      "Patient Registry",
      "Outpatient & Inpatient",
      "Ward & Bed Management",
      "Laboratory",
      "Imaging",
      "Pharmacy",
      "Billing & Payments",
      "Reporting & BI",
      "DHIS2 Sync",
    ],
    image: "/assets/doctor-nurse-consultation.jpg",
    imageAlt: "Hospital clinicians coordinating patient care",
  },
  {
    index: "02",
    acronym: "CMS",
    title: "Clinic Management System",
    tagline: "For PHCUs, private practices & faith-based clinics",
    description:
      "Everything a single-site clinic needs to run a full patient day: registration, consultation, prescriptions, basic lab, dispensing, billing — offline-first.",
    modules: [
      "Patient Registry",
      "Outpatient Consultation",
      "Lab Orders",
      "Pharmacy Dispensing",
      "Billing",
      "DHIS2 Sync",
    ],
    image: "/assets/community-health-worker.jpg",
    imageAlt: "Community health worker at a primary care clinic",
  },
  {
    index: "03",
    acronym: "LIS",
    title: "Laboratory Information System",
    tagline: "For diagnostic centres & hospital labs",
    description:
      "Receive orders from any clinician, run bench workflows, capture results, validate, and release them back into the encounter.",
    modules: [
      "Order Intake",
      "Specimen Tracking",
      "Result Capture",
      "Quality Control",
      "TAT Dashboards",
      "Critical Result Alerts",
    ],
    image: "/assets/doctor-writing-notes.jpg",
    imageAlt: "Lab staff recording results",
  },
  {
    index: "04",
    acronym: "RIS",
    title: "Radiology Information System",
    tagline: "For radiology centres & imaging departments",
    description:
      "Schedule modalities, accession studies, capture findings, and deliver reports back to the ordering clinician — connected to the same record.",
    modules: [
      "Modality Scheduling",
      "Study Worklist",
      "Structured Reporting",
      "PACS Integration",
      "DICOM Export",
    ],
    image: "/assets/doctor-tablet-review.jpg",
    imageAlt: "Radiologist reviewing imaging on a workstation",
  },
  {
    index: "05",
    acronym: "PMS",
    title: "Pharmacy Management System",
    tagline: "For retail & hospital pharmacies",
    description:
      "Track medicines from stock to dispense, manage batches and expiry, fill electronic prescriptions, and keep pharmacy activity visible.",
    modules: [
      "Inventory & Batches",
      "Expiry Tracking",
      "Reorder Alerts",
      "Electronic Rx Dispensing",
      "POS for OTC",
      "Supplier Orders",
    ],
    image: "/assets/doctor-prescription.jpg",
    imageAlt: "Pharmacist preparing a prescription",
  },
  {
    index: "06",
    acronym: "PP",
    title: "Patient Portal",
    tagline: "Self-service access for patients & caregivers",
    description:
      "Patients and caregivers view visit summaries, lab results, and upcoming appointments online or via SMS — staying connected to their own care story between visits.",
    modules: [
      "Visit Summaries",
      "Lab Results Access",
      "Appointment Reminders",
      "SMS/WhatsApp Notifications",
      "Multi-language Support",
    ],
    image: "/assets/doctor-tablet-smiling.jpg",
    imageAlt: "A patient reviewing their health records on a tablet",
  },
];

const GOAL_STATS = [
  { value: "$100K", label: "pilot goal to launch across 10 clinics" },
  { value: "10", label: "clinics in Juba and greater South Sudan" },
  { value: "12mo", label: "from equipment to measurement and scale" },
];

const TEAM = [
  { name: "Teny Makuach", role: "Founder and Developer", image: "/assets/founder-teny.jpg" },
  { name: "Ekow Williams", role: "Community & Partnerships", image: "/assets/founder-ekow.jpg" },
  { name: "Toye Adebayo", role: "Project Manager", image: "/assets/founder-toye.jpg" },
  { name: "Mark Dosu", role: "Developer", image: "/assets/Mark-Dosu.jpeg" },
  { name: "Chinonye Hycent", role: "Research Lead", image: "/assets/chinonye-hycent.jpg" },
  { name: "Isaac Kyalo", role: "Technical Lead", image: "/assets/isaac-kyalo.jpg" },
];

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFacility, setFormFacility] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [sent, setSent] = useState(false);
  const dragStartX = useRef<number | null>(null);

  // Hero defaults to the midwives photo (SLIDES[0]) and stays put — no
  // auto-advance. Visitors switch photos via the dots or by swiping/
  // dragging the image; leaving the hero resets it back to the default.
  const SWIPE_THRESHOLD = 50;

  const handleHeroPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
  };

  const handleHeroPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (delta > SWIPE_THRESHOLD) {
      setActiveSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);
    } else if (delta < -SWIPE_THRESHOLD) {
      setActiveSlide((s) => (s + 1) % SLIDES.length);
    }
  };

  const handleHeroPointerLeave = () => {
    dragStartX.current = null;
    setActiveSlide(0);
  };

  const sendMessage = () => {
    const subject = encodeURIComponent(
      "TamamHealth — Get involved" + (formFacility ? ` (${formFacility})` : "")
    );
    const body = encodeURIComponent(
      `${formMessage || ""}\n\n— ${formName || ""}${formEmail ? " · " + formEmail : ""}`
    );
    window.location.href = `mailto:support.tamam@gmail.com?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: "#10195A",
        background: "#FEFFF9",
      }}
    >
      {/* ═══ Nav ═══ */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(11,17,69,0.9)",
          backdropFilter: "blur(12px)",
          color: "#FFFFFF",
          padding: "0 32px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            height: 66,
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <a
            href="#top"
            style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#FFFFFF" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/tamam-logo-mark.svg"
              alt=""
              style={{ height: 22, width: "auto", filter: "brightness(0) invert(1)" }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/tamam-logo-type.svg"
              alt="Tamam Healthcare System"
              style={{ height: 15, width: "auto", filter: "brightness(0) invert(1)" }}
            />
          </a>
          <div
            className="tm-nav-links"
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}
          >
            <a href="#problem" className="tm-nav-link" style={{ color: "#C7D8F5", textDecoration: "none", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em" }}>
              Problem
            </a>
            <a href="#solution" className="tm-nav-link" style={{ color: "#C7D8F5", textDecoration: "none", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em" }}>
              Solution
            </a>
            <a href="#team" className="tm-nav-link" style={{ color: "#C7D8F5", textDecoration: "none", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em" }}>
              Team
            </a>
            <a
              href="#contact"
              className="tm-nav-cta"
              style={{ background: "#2191D0", color: "#FFFFFF", fontSize: 13.5, fontWeight: 700, padding: "11px 22px", textDecoration: "none", letterSpacing: "0.02em" }}
            >
              Book a Demo →
            </a>
          </div>
          <button
            className="tm-nav-burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
            style={{
              display: "none",
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "#FFFFFF",
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
        {menuOpen && (
          <div
            className="tm-nav-drawer"
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#0B1145",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              padding: "8px 0 16px",
              margin: "0 -32px",
            }}
          >
            <a href="#problem" onClick={() => setMenuOpen(false)} style={{ color: "#FFFFFF", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              Problem
            </a>
            <a href="#solution" onClick={() => setMenuOpen(false)} style={{ color: "#FFFFFF", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              Solution
            </a>
            <a href="#team" onClick={() => setMenuOpen(false)} style={{ color: "#FFFFFF", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              Team
            </a>
            <a
              href="#contact"
              onClick={() => setMenuOpen(false)}
              style={{ background: "#2191D0", color: "#FFFFFF", fontSize: 15, fontWeight: 700, padding: "14px 32px", textDecoration: "none", margin: "12px 32px 0", textAlign: "center" }}
            >
              Book a Demo →
            </a>
          </div>
        )}
      </nav>

      <main>
      {/* ═══ Hero — full-bleed image ═══ */}
      <section
        id="top"
        className="tm-hero"
        onPointerDown={handleHeroPointerDown}
        onPointerUp={handleHeroPointerUp}
        onPointerLeave={handleHeroPointerLeave}
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-end",
          color: "#FFFFFF",
          overflow: "hidden",
          background: "#0B1145",
          touchAction: "pan-y",
          cursor: "grab",
        }}
      >
        {SLIDES.map((slide, i) => (
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            className={i > 0 ? "tm-hero-slide-extra" : undefined}
            style={{
              objectFit: "cover",
              objectPosition: "center 30%",
              opacity: i === activeSlide ? 1 : 0,
              transition: "opacity 1.2s ease",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(11,17,69,0.55) 0%, rgba(11,17,69,0.22) 48%, rgba(11,17,69,0.02) 100%)",
          }}
        />
        <div
          className="tm-hero-pad"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 1320,
            margin: "0 auto",
            padding: "160px 32px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <h1
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: "clamp(34px, 4.6vw, 58px)",
              fontWeight: 600,
              lineHeight: 1.12,
              margin: 0,
              maxWidth: 940,
              letterSpacing: "-0.015em",
              textShadow: "0 2px 6px rgba(0,0,0,0.65), 0 4px 28px rgba(0,0,0,0.5)",
            }}
          >
            No internet. No records.
            <br />
            No history.
          </h1>
          <div className="tm-hero-sub" style={{ position: "relative", maxWidth: 560, paddingLeft: 18, fontSize: 18 }}>
            <div
              className="tm-hero-line"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background:
                  "linear-gradient(to bottom, rgba(33,145,208,0) 0%, rgba(127,196,234,0.95) 22%, rgba(33,145,208,0.95) 55%, rgba(33,145,208,0) 100%)",
              }}
            />
            <p
              style={{
                fontSize: "inherit",
                lineHeight: 1.6,
                color: "#E4EEFB",
                margin: 0,
                textShadow: "0 1px 4px rgba(0,0,0,0.7), 0 2px 16px rgba(0,0,0,0.5)",
              }}
            >
              South Sudan&apos;s clinics run on paper-based records that get lost, damaged, or destroyed — and when
              the paper goes, the patient&apos;s story goes with it.{" "}
              <strong style={{ color: "#FFFFFF" }}>
                Tamam brings digital records that work offline, so care never starts from zero.
              </strong>
            </p>
          </div>
          <div className="tm-btn-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="#problem"
              className="tm-hero-btn-primary"
              style={{ background: "#2191D0", color: "#FFFFFF", fontSize: 15, fontWeight: 700, padding: "15px 30px", textDecoration: "none", letterSpacing: "0.02em" }}
            >
              <span className="tm-btn-label-full">Understand the crisis</span>
              <span className="tm-btn-label-short">Crisis</span> ↓
            </a>
            <a
              href="#solution"
              className="tm-hero-btn-secondary"
              style={{ background: "#FEFFF9", color: "#10195A", fontSize: 15, fontWeight: 700, padding: "15px 30px", textDecoration: "none", letterSpacing: "0.02em" }}
            >
              <span className="tm-btn-label-full">See our solution</span>
              <span className="tm-btn-label-short">Solution</span> →
            </a>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              borderTop: "1px solid rgba(255,255,255,0.3)",
              paddingTop: 16,
            }}
          >
            <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: 12.5, color: "#C7D8F5" }}>
              {SLIDES[activeSlide].caption}
            </p>
            <div className="tm-hero-dots" style={{ display: "flex", gap: 8 }}>
              {SLIDES.map((slide, i) => (
                <button
                  key={slide.src}
                  onClick={() => setActiveSlide(i)}
                  aria-label={`Show photo ${i + 1}`}
                  style={{
                    width: i === activeSlide ? 36 : 16,
                    height: 4,
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    background: i === activeSlide ? "#7FC4EA" : "rgba(255,255,255,0.4)",
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 01 The Problem ═══ */}
      <section id="problem" className="tm-section" style={{ background: "#10195A", color: "#FFFFFF", padding: "100px 32px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#10195A", background: "#FEFFF9", padding: "6px 14px" }}>
                The Problem
              </span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 3.8vw, 48px)", fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
              A health system asked to do the impossible
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,0.72)", margin: 0, maxWidth: 680 }}>
              Across South Sudan, clinics and hospitals deliver care through conflict, flooding, and displacement — on
              paper registers, without reliable power or connectivity.
            </p>
          </div>

          <div className="tm-grid-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: "rgba(255,255,255,0.2)" }}>
            {CRISIS_STATS.map((s) => (
              <div key={s.unit} style={{ background: "#10195A", padding: "32px 28px 28px", display: "flex", flexDirection: "column", gap: 12, borderTop: "4px solid #2191D0" }}>
                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 56, fontWeight: 600, lineHeight: 0.95, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                  {s.value}
                </span>
                <span style={{ fontWeight: 700, color: "#7FC4EA", textTransform: "uppercase", letterSpacing: "0.03em", fontSize: 13 }}>{s.unit}</span>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.65)" }}>{s.context}</p>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: "auto" }}>
                  — {s.source}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 26, fontWeight: 600, margin: 0 }}>
              How care breaks down, visit after visit
            </h3>
            <div className="tm-grid-breakdown" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              {BREAKDOWN_STEPS.map((b) => (
                <div key={b.num} className="tm-breakdown-card" style={{ position: "relative", overflow: "hidden", minHeight: 380, display: "flex", alignItems: "flex-end", background: "#0B1145" }}>
                  <Image src={b.image} alt={b.alt} fill sizes="(max-width: 1023px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,17,69,0.95) 0%, rgba(11,17,69,0.2) 55%, rgba(11,17,69,0) 100%)" }} />
                  <div style={{ position: "relative", padding: 24, display: "flex", flexDirection: "column", gap: 8, margin: "0 0 20px 20px", background: "rgba(11,17,69,0.55)", backdropFilter: "blur(4px)", marginRight: 20, paddingTop: 18, paddingBottom: 18, paddingLeft: 20, paddingRight: 20 }}>
                    <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}>{b.title}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.85)" }}>{b.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tm-grid-ground" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.2)" }}>
            {GROUND_STATS.map((g) => (
              <div key={g.label} style={{ display: "flex", alignItems: "baseline", gap: 16, background: "#0B1145", padding: "26px 28px" }}>
                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 52, fontWeight: 600, color: "#7FC4EA", lineHeight: 1, letterSpacing: "-0.02em" }}>{g.value}</span>
                <span style={{ fontWeight: 600, color: "#E4EEFB", textTransform: "uppercase", fontSize: 12.5, letterSpacing: "0.04em" }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 02 Research ═══ */}
      <section id="research" className="tm-section" style={{ padding: "0 32px 100px", background: "#10195A", color: "#FFFFFF" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 72 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#10195A", background: "#FEFFF9", padding: "6px 14px" }}>
                Ground Truth
              </span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 3.8vw, 48px)", fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
              The daily reality inside South Sudan&apos;s facilities
            </h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,0.72)", maxWidth: 680 }}>
              Documented across South Sudanese facilities, from the wards to the waiting line — the same failures
              repeat on both sides of the consultation desk.
            </p>
          </div>
          <div className="tm-grid-insights" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
            {INSIGHTS.map((ins) => (
              <div key={ins.number} style={{ background: ins.bg, color: ins.fg, border: `1.5px solid ${ins.borderColor}`, padding: "34px 34px 36px", display: "flex", flexDirection: "column", gap: 22, boxShadow: `8px 8px 0 ${ins.shadow}` }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: ins.kickerColor }}>
                      {ins.kicker}
                    </span>
                    <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 27, fontWeight: 600, margin: 0 }}>{ins.title}</h3>
                  </div>
                  <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 60, fontWeight: 700, lineHeight: 1, color: ins.numColor }}>{ins.number}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {ins.points.map((pt) => (
                    <div key={pt} style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "13px 0", borderTop: `1px solid ${ins.rule}` }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: ins.kickerColor }}>→</span>
                      <span style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 500 }}>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 03 The Solution ═══ */}
      <section id="solution" className="tm-section" style={{ padding: "100px 32px", background: "#FFFFFF", borderTop: "1.5px solid #10195A" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FFFFFF", background: "#10195A", padding: "6px 14px" }}>
                The Solution
              </span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 3.8vw, 48px)", fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
              Simple enough for the front desk. Strong enough for the nation.
            </h2>
          </div>

          <div className="tm-compare-strip" style={{ display: "flex", alignItems: "stretch", gap: 0, flexWrap: "wrap", border: "1.5px solid #10195A" }}>
            <div className="tm-compare-col" style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8, textAlign: "center", padding: "36px 28px", background: "#FADCDC" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7A2020" }}>
                The current system
              </span>
              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#7A2020", lineHeight: 1.2 }}>
                Decentralized, fragmented data
              </span>
            </div>
            <div className="tm-compare-col" style={{ flex: 1.2, minWidth: 260, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 12, padding: "36px 28px", background: "#FEFFF9", borderLeft: "1.5px solid #10195A", borderRight: "1.5px solid #10195A" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/tamam-logo-mark.svg" alt="" style={{ height: 58, width: "auto" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/tamam-logo-type.svg" alt="Tamam Healthcare System" style={{ height: 17, width: "auto" }} />
            </div>
            <div className="tm-compare-col" style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8, textAlign: "center", padding: "36px 28px", background: "#DDF2FB" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#015697" }}>
                What Tamam offers
              </span>
              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#015697", lineHeight: 1.2 }}>
                Digitized healthcare
              </span>
            </div>
          </div>

          <div className="tm-grid-principles" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 1, background: "#10195A", border: "1.5px solid #10195A" }}>
            {PRINCIPLES.map((p) => (
              <div key={p.number} className="tm-principle-card" style={{ background: "#FEFFF9", padding: "30px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 48, fontWeight: 700, color: "#DDF2FB", lineHeight: 1, WebkitTextStroke: "1.5px #2191D0" }}>
                  {p.number}
                </span>
                <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 21, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{p.title}</h3>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#26336F" }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 04 The Platform ═══ */}
      <section id="platform" className="tm-section" style={{ padding: "100px 32px", background: "#FEFFF9" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FFFFFF", background: "#10195A", padding: "6px 14px" }}>
                The Platform
              </span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 3.8vw, 48px)", fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
              One patient record, from front desk to national report
            </h2>
          </div>

          <div className="tm-workflow" style={{ display: "flex", gap: 0, flexWrap: "wrap", border: "1.5px solid #10195A", alignSelf: "flex-start" }}>
            {WORKFLOW_STEPS.map((step) => (
              <span key={step.label} style={{ display: "inline-flex", alignItems: "center", fontFamily: "'DM Mono', monospace", fontSize: 13.5, fontWeight: 500, color: "#10195A", padding: "12px 20px", borderRight: "1px solid #10195A", background: step.bg }}>
                {step.label}
              </span>
            ))}
          </div>

          <div className="tm-grid-split" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 48, alignItems: "center" }}>
            <div className="tm-shadow-plate" style={{ border: "1.5px solid #10195A", boxShadow: "12px 12px 0 #DDF2FB", position: "relative", aspectRatio: "3416 / 1974" }}>
              <Image
                src="/assets/Dashboard.png"
                alt="TamamHealth platform dashboard"
                fill
                sizes="(max-width: 1023px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: "#26336F" }}>
                From the front desk to the ward, every step in TamamHealth links back to the same patient encounter.
                Clinicians, facility teams, and health leaders work from cleaner records without duplicating data.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1.5px solid #10195A" }}>
                {OUTCOMES.map((o) => (
                  <div key={o.title} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "18px 20px", borderBottom: o.border, background: "#FFFFFF" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: "#2191D0", fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>✓</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{o.title}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.55, color: "#26336F" }}>{o.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 05 Products ═══ */}
      <section id="products" className="tm-section" style={{ padding: "100px 32px", background: "#FFFFFF", borderTop: "1.5px solid #10195A" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FFFFFF", background: "#10195A", padding: "6px 14px" }}>
                The Products
              </span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 3.8vw, 48px)", fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
              Six products, one connected encounter
            </h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#64748B", maxWidth: 680 }}>
              From referral hospitals to single-room clinics — every product ties back to the same record, built for
              intermittent connectivity.
            </p>
          </div>
          <div className="tm-grid-products" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
            {PRODUCTS.map((prod) => (
              <div key={prod.acronym} className="tm-product-card" style={{ background: "#FEFFF9", border: "1.5px solid #10195A", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", borderBottom: "1.5px solid #10195A", height: 200 }}>
                  <Image
                    src={prod.image}
                    alt={prod.imageAlt}
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,17,69,0.45) 0%, rgba(11,17,69,0) 45%)" }} />
                  <span style={{ position: "absolute", top: 0, right: 0, fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, letterSpacing: "0.08em", background: "#10195A", color: "#FFFFFF", padding: "8px 16px" }}>
                    {prod.acronym}
                  </span>
                </div>
                <div style={{ padding: "24px 26px 28px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 600, margin: 0, lineHeight: 1.15 }}>{prod.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2191D0", textTransform: "uppercase", letterSpacing: "0.04em" }}>{prod.tagline}</p>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#26336F" }}>{prod.description}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto", paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
                    {prod.modules.map((m) => (
                      <span key={m} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "#26336F", background: "#EFF8FD", padding: "4px 10px" }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 06 The Goal ═══ */}
      <section id="goal" className="tm-section" style={{ padding: "100px 32px", background: "#10195A", color: "#FFFFFF" }}>
        <div className="tm-grid-split" style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 56, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#10195A", background: "#FEFFF9", padding: "6px 14px" }}>
                The Goal
              </span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 3.8vw, 48px)", fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
              Prove it works, then bring it to every clinic that needs it
            </h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: "rgba(255,255,255,0.75)" }}>
              We&apos;re raising <strong style={{ color: "#7FC4EA" }}>$100,000</strong> to launch TamamHealth in 10
              clinics across Juba and greater South Sudan — proof that offline-first digital records can work in the
              hardest conditions on Earth.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.25)" }}>
            {GOAL_STATS.map((g) => (
              <div key={g.label} style={{ display: "flex", alignItems: "baseline", gap: 20, background: "#10195A", padding: "24px 28px" }}>
                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 46, fontWeight: 600, color: "#7FC4EA", lineHeight: 1, minWidth: 130, letterSpacing: "-0.02em" }}>
                  {g.value}
                </span>
                <span style={{ fontSize: 14.5, lineHeight: 1.45, color: "#E4EEFB", fontWeight: 500 }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 07 Team ═══ */}
      <section id="team" className="tm-section" style={{ padding: "100px 32px", background: "#FEFFF9" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FFFFFF", background: "#10195A", padding: "6px 14px" }}>
                The Team
              </span>
            </div>
            <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(30px, 3.8vw, 48px)", fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
              Built by people who know the problem
            </h2>
          </div>
          <div className="tm-grid-team" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: "#10195A", border: "1.5px solid #10195A" }}>
            {TEAM.map((t) => (
              <div key={t.name} className="tm-team-card" style={{ background: "#FEFFF9", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", aspectRatio: "1", borderBottom: "1.5px solid #10195A" }}>
                  <Image
                    src={t.image}
                    alt={t.name}
                    fill
                    sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 16vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,17,69,0.32) 0%, rgba(11,17,69,0) 40%)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "16px 18px 18px" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#64748B" }}>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Contact / Get involved ═══ */}
      <section id="contact" className="tm-section" style={{ background: "#10195A", color: "#FFFFFF", padding: "110px 32px 90px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "#7FC4EA" }}>
              Get involved
            </span>
            <h2 className="tm-contact-h" style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(32px, 4.2vw, 54px)", fontWeight: 600, margin: 0, lineHeight: 1.12, maxWidth: 760 }}>
              The problem is enormous. The fix is buildable.
            </h2>
            <span style={{ width: 100, height: 3, background: "#2191D0" }} />
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: "#C7D8F5", maxWidth: 560 }}>
              Facility, NGO, funder, or just curious — tell us what you&apos;re building or how you want to help.
            </p>
          </div>

          <div className="tm-form-pad" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", padding: 40, display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>Full name</span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    setSent(false);
                  }}
                  className="tm-form-input"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif", fontSize: 15, padding: "13px 14px", outline: "none" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>Email</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={formEmail}
                  onChange={(e) => {
                    setFormEmail(e.target.value);
                    setSent(false);
                  }}
                  className="tm-form-input"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif", fontSize: 15, padding: "13px 14px", outline: "none" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>Facility (optional)</span>
                <input
                  type="text"
                  placeholder="Clinic or hospital"
                  value={formFacility}
                  onChange={(e) => {
                    setFormFacility(e.target.value);
                    setSent(false);
                  }}
                  className="tm-form-input"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif", fontSize: 15, padding: "13px 14px", outline: "none" }}
                />
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>Message</span>
              <textarea
                placeholder="What you're building, or how you'd like to help."
                rows={4}
                value={formMessage}
                onChange={(e) => {
                  setFormMessage(e.target.value);
                  setSent(false);
                }}
                className="tm-form-input"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif", fontSize: 15, padding: "13px 14px", outline: "none", resize: "vertical" }}
              />
            </label>
            <button
              onClick={sendMessage}
              className="tm-submit-btn"
              style={{ alignSelf: "flex-start", background: "#2191D0", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif", fontSize: 15.5, fontWeight: 700, padding: "15px 34px", border: "none", cursor: "pointer", letterSpacing: "0.02em" }}
            >
              {sent ? "Opening your email app…" : "Send message"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap", fontSize: 14, color: "#C7D8F5" }}>
            <a href="mailto:support.tamam@gmail.com" style={{ color: "#FFFFFF", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              support.tamam@gmail.com
            </a>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
            <span>Founded at Tufts University · building for South Sudan</span>
          </div>
        </div>
      </section>
      </main>

      {/* ═══ Footer ═══ */}
      <footer style={{ background: "#0B1145", color: "#C7D8F5", borderTop: "1px solid rgba(255,255,255,0.15)", padding: "28px 32px" }}>
        <div className="tm-footer-row" style={{ maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", fontSize: 13, alignItems: "center" }}>
          <div className="tm-footer-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamam-logo-mark.svg" alt="" style={{ height: 24, width: 24, flexShrink: 0 }} />
            <span>© 2026 TamamHealth — digital health platform for South Sudan</span>
          </div>
          <div className="tm-footer-links" style={{ display: "flex", gap: 20, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
            <span>Terms &amp; Conditions</span>
            <span>Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
