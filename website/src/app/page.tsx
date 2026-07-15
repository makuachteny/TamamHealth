"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — One-Page Website
   Ported 1:1 from the Claude Design project "Website outline improvement",
   file "One-Page Website v3.dc.html" (2026-07-07 revision).
   Deviation from the design source: the contact form submits via Web3Forms
   instead of a mailto: link (the design's mailto approach doesn't work for
   visitors without a configured mail client).
   ═══════════════════════════════════════════════════════════════════ */

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
    image: "/assets/images/reviewing-health-records.jpeg",
    alt: "A family reviewing paper health records",
    title: "Paper-based record system",
    body: "Every visit starts from scratch — histories live in ledgers, slips, and memory.",
  },
  {
    image: "/assets/images/pediatric-ward-interior.jpeg",
    alt: "A crowded pediatric ward",
    title: "Slow diagnosis process",
    body: "Clinicians rebuild each patient's story by hand while wards fill past capacity.",
  },
  {
    image: "/assets/images/community-medication-distribution.jpeg",
    alt: "A health worker recording medication in a paper register",
    title: "Misdiagnosis",
    body: "Missing history means duplicate treatment, wrong calls, and lost follow-up.",
  },
];

const INSIGHTS = [
  {
    number: "01",
    kicker: "From the wards",
    title: "Medical experts",
    bg: "#0F4C81",
    fg: "#FFFFFF",
    shadow: "#E8863A",
    borderColor: "rgba(232,134,58,0.6)",
    kickerColor: "#F8B27E",
    numColor: "#E8863A",
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
    bg: "#E2EDF7",
    fg: "#0F4C81",
    shadow: "rgba(232,134,58,0.45)",
    borderColor: "#EFF8FD",
    kickerColor: "#A84A15",
    numColor: "#C56A20",
    rule: "#E2E8F0",
    points: [
      "Manual transfers between facilities are ineffective",
      "Misdiagnosis from incomplete records",
      "Very slow clinical flow, long waits",
    ],
  },
];

const PAPER_CHIPS = [
  { label: "Paper ledgers", rotate: -3 },
  { label: "Lab slips", rotate: 2 },
  { label: "Referral notes", rotate: -2 },
  { label: "Pharmacy logs", rotate: 3 },
  { label: "Vaccination cards", rotate: -1 },
];

const TAMAM_CHECKS = ["One patient record", "Facility dashboard", "DHIS2-ready national reports"];

const FEATURES: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: "Offline first",
    body: "Clinics keep working through power cuts and network gaps, then sync safely when connection returns.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m2 2 20 20" />
        <path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
        <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
      </svg>
    ),
  },
  {
    title: "Fingerprint registration",
    body: "Patients without papers register once — fingerprint and photo give undocumented patients an identity that can't be lost.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
        <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
        <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
        <path d="M2 12a10 10 0 0 1 18-6" />
        <path d="M2 16h.01" />
        <path d="M21.8 16c.2-2 .131-5.354 0-6" />
        <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
        <path d="M8.65 22c.21-.66.45-1.32.57-2" />
        <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
      </svg>
    ),
  },
  {
    title: "GeocodeIDs",
    body: "Geocoded patient IDs make every record findable across facilities — referrals and transfers follow the patient.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21s-6.5-5.5-6.5-10a6.5 6.5 0 0 1 13 0c0 4.5-6.5 10-6.5 10Z" />
        <circle cx="12" cy="10.5" r="2.5" />
      </svg>
    ),
  },
  {
    title: "One patient record",
    body: "Every visit adds to the same story — no duplicate files, no histories rebuilt from memory at the front desk.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <circle cx="9" cy="11" r="2" />
        <path d="M6.17 15a3 3 0 0 1 5.66 0" />
        <path d="M16 10h2" />
        <path d="M16 14h2" />
      </svg>
    ),
  },
  {
    title: "Full clinical workflow",
    body: "Registration, triage, consultation, lab, pharmacy, and billing — every step tied to the same visit.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4" />
        <path d="M12 16h4" />
        <path d="M8 11h.01" />
        <path d="M8 16h.01" />
      </svg>
    ),
  },
  {
    title: "Dashboards & reporting",
    body: "Clean records roll up into facility dashboards and DHIS2-ready national reports — no month-end tally sheets.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="12" width="4" height="8" rx="0.5" />
        <rect x="10" y="8" width="4" height="12" rx="0.5" />
        <rect x="17" y="4" width="4" height="16" rx="0.5" />
      </svg>
    ),
  },
  {
    title: "Secure by design",
    body: "Sensitive health data is encrypted and access-controlled at every layer, from the clinic device to the national server.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15" r="1.6" />
      </svg>
    ),
  },
  {
    title: "Runs on simple devices",
    body: "Works on affordable tablets and phones with solar power — no server room, no IT department required.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#015697" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
        <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" />
        <path d="M10 7.5h4" />
      </svg>
    ),
  },
];

const PRODUCTS = [
  {
    acronym: "HMIS",
    accent: "#176B95",
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
    acronym: "CMS",
    accent: "#0B6E5C",
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
    acronym: "LIS",
    accent: "#7847EB",
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
    acronym: "RIS",
    accent: "#875607",
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
    acronym: "PMS",
    accent: "#C23B6B",
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
    acronym: "PPS",
    accent: "#1E6E3F",
    title: "Patient Portal",
    tagline: "Patients' window into their own care",
    description:
      "Patients see their own records, prescriptions, lab results, and visit history — on a phone, by SMS, or at a kiosk — and share feedback that flows back to the facility.",
    modules: [
      "My Records",
      "Prescriptions & Results",
      "Visit History",
      "Appointment Reminders",
      "Feedback & Follow-up",
    ],
    image: "/assets/african-nurse.jpg",
    imageAlt: "Health worker helping a patient access their records on a phone",
  },
];

const GOAL_STATS = [
  { value: "$100K", label: "pilot goal to launch across 10 clinics" },
  { value: "10", label: "clinics in Juba and greater South Sudan" },
  { value: "12mo", label: "from equipment to measurement and scale" },
];

// The Ministry of Health's 2025 Essential Health Services Package (EHSP) defines
// six levels of care; Tamam's products are shaped to serve each one, all writing
// to the same patient record. Product mapping mirrors the PRODUCTS array above.
const CARE_LEVELS = [
  { level: "Community — Boma Health Initiative", role: "Promotion, screening & referral", product: "Registry & referral", tone: "#2C7DA0" },
  { level: "Primary Health Care Unit (PHCU)", role: "First formal point of care", product: "CMS", tone: "#0B6E5C" },
  { level: "Primary Health Care Centre (PHCC)", role: "Expanded primary & maternity care", product: "CMS", tone: "#0B6E5C" },
  { level: "County Hospital", role: "First referral & inpatient care", product: "HMIS", tone: "#176B95" },
  { level: "State Hospital", role: "Secondary & specialised care", product: "HMIS", tone: "#146A9E" },
  { level: "Referral / Tertiary Hospital", role: "Tertiary & teaching care", product: "HMIS", tone: "#015697" },
];

// Health-system reality from the EHSP 2025 situation analysis (SARA 2018 survey,
// WHO/MoH data). These are why an offline-first, low-power design is not optional.
const SYSTEM_STATS = [
  { value: "4%", label: "of facilities have a computer with internet", source: "SARA / EHSP 2025" },
  { value: "13%", label: "have any on-site power source", source: "SARA / EHSP 2025" },
  { value: "1.42", label: "health facilities per 10,000 people — against a national target of 2", source: "EHSP 2025" },
  { value: "7.6", label: "health workers per 10,000 people — the WHO norm is 44.5", source: "EHSP 2025" },
  { value: "38.7", label: "UHC service-coverage index, out of 100", source: "EHSP 2025" },
];

const TEAM = [
  { name: "Teny Makuach", role: "Founder & Developer", image: "/assets/founder-teny.jpg" },
  { name: "Ekow Williams", role: "Community & Partnerships", image: "/assets/founder-ekow.jpg" },
  { name: "Toye Adebayo", role: "Project Manager", image: "/assets/founder-toye.jpg" },
  { name: "Mark Dosu", role: "Software Developer", image: "/assets/Mark-Dosu.jpeg" },
  { name: "Chinonye Hycent", role: "Research Lead", image: "/assets/chinonye-hycent.jpg" },
  { name: "Isaac Kyalo", role: "Technical Lead", image: "/assets/isaac-kyalo.jpg" },
];

const KICKER: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 13,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  padding: "6px 14px",
};

const H2: React.CSSProperties = {
  fontFamily: "'Lora', Georgia, serif",
  fontSize: "clamp(30px, 3.8vw, 48px)",
  fontWeight: 600,
  margin: 0,
  lineHeight: 1.1,
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFacility, setFormFacility] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [formError, setFormError] = useState("");
  // Nav is transparent over the hero and fades in a solid background once the
  // user scrolls past the top, so the white logo/links stay readable over the
  // light content sections below.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sendMessage = async () => {
    if (!formMessage.trim()) {
      setFormStatus("error");
      setFormError("Please write a message first.");
      return;
    }
    setFormStatus("sending");
    setFormError("");
    try {
      // Web3Forms is designed for browser-side submission; the access key is
      // public by design (it can only be used to send mail TO our inbox).
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: "e45ff797-cfa3-459e-80db-cda054dd35ea",
          subject: `TamamHealth — Get involved${formFacility ? ` (${formFacility})` : ""}`,
          from_name: formName || "TamamHealth Website",
          name: formName || "Anonymous",
          email: formEmail || undefined,
          facility: formFacility || undefined,
          message: formMessage,
          botcheck: "",
        }),
      });
      const data = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !data.success) {
        setFormStatus("error");
        setFormError("Failed to send. Please email us directly.");
        return;
      }
      setFormStatus("sent");
      setFormMessage("");
    } catch {
      setFormStatus("error");
      setFormError("Network error. Please email us directly.");
    }
  };

  const crisisLead = CRISIS_STATS[0];
  const crisisRest = CRISIS_STATS.slice(1);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: "#015697", background: "#EFF8FD" }}>
      {/* ═══ Nav ═══ */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: scrolled ? "rgba(1,86,151,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
          color: "#FFFFFF",
          padding: scrolled ? "12px 32px" : "22px 32px 0",
          transition: "background 0.25s ease, padding 0.25s ease, border-color 0.25s ease",
        }}
      >
        <div style={{ maxWidth: 1320, margin: "0 auto", height: 56, display: "flex", alignItems: "center", gap: 28 }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#FFFFFF" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamam-logo-mark.svg" alt="" style={{ height: 22, width: "auto", filter: "brightness(0) invert(1)" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamam-logo-type.svg" alt="Tamam Healthcare System" style={{ height: 15, width: "auto", filter: "brightness(0) invert(1)" }} />
          </a>
          <div
            className="tm-nav-links"
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <a href="#solution" className="tm-nav-link" style={{ color: "rgba(255,255,255,0.92)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", padding: "9px 18px", borderRadius: 0 }}>
              Solution
            </a>
            <a href="#national" className="tm-nav-link" style={{ color: "rgba(255,255,255,0.92)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", padding: "9px 18px", borderRadius: 0 }}>
              Alignment
            </a>
            <a href="#team" className="tm-nav-link" style={{ color: "rgba(255,255,255,0.92)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", padding: "9px 18px", borderRadius: 0 }}>
              Team
            </a>
            <a href="#contact" className="tm-nav-link" style={{ color: "rgba(255,255,255,0.92)", textDecoration: "none", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", padding: "9px 18px", borderRadius: 0 }}>
              Contact
            </a>
            <a href="#contact" className="tm-nav-cta" style={{ background: "#1774A8", color: "#FFFFFF", fontSize: 13.5, fontWeight: 700, padding: "10px 22px", textDecoration: "none", letterSpacing: "0.02em", borderRadius: 0 }}>
              Book a Demo
            </a>
          </div>
          <button
            className="tm-nav-burger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            style={{
              display: "none",
              marginLeft: "auto",
              background: "none",
              border: "1px solid rgba(255,255,255,0.35)",
              color: "#FFFFFF",
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
        {menuOpen && (
          <div className="tm-nav-drawer" style={{ display: "flex", flexDirection: "column", background: "#015697", borderTop: "1px solid rgba(255,255,255,0.12)", padding: "8px 0 16px", margin: "0 -32px" }}>
            <a href="#solution" onClick={() => setMenuOpen(false)} style={{ color: "#FFFFFF", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              Solution
            </a>
            <a href="#national" onClick={() => setMenuOpen(false)} style={{ color: "#FFFFFF", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              Alignment
            </a>
            <a href="#team" onClick={() => setMenuOpen(false)} style={{ color: "#FFFFFF", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              Team
            </a>
            <a href="#contact" onClick={() => setMenuOpen(false)} style={{ color: "#FFFFFF", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "14px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              Contact
            </a>
            <a href="#contact" onClick={() => setMenuOpen(false)} style={{ background: "#1774A8", color: "#FFFFFF", fontSize: 15, fontWeight: 700, padding: "14px 32px", textDecoration: "none", margin: "12px 32px 0", textAlign: "center" }}>
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
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          color: "#FFFFFF",
          overflow: "hidden",
          background: "#0E2A4A",
          padding: "80px 32px 72px",
          boxSizing: "border-box",
        }}
      >
        <Image
          src="/assets/new-landing.png"
          alt="A South Sudanese midwife examining a child with a stethoscope at a rural clinic"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 35%" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(17, 48, 85, 0.6) 0%, rgba(25, 48, 71, 0.4) 14.46%, rgba(17, 48, 85, 0.2) 52.03%, rgba(14, 42, 74, 0.8) 87.29%, #0E2A4A 96.71%)",
          }}
        />

        {/* Left-aligned message content */}
        <div
          className="tm-hero-msg"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 36,
            textAlign: "left",
          }}
        >
          <h1
            className="tm-hero-h1"
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: "clamp(36px, 4.6vw, 68px)",
              fontWeight: 600,
              lineHeight: 1.06,
              margin: 0,
              letterSpacing: "-0.015em",
              textShadow: "0 2px 26px rgba(0,0,0,0.6)",
            }}
          >
            <span style={{ display: "block" }}>No power. No records.</span>
            <span style={{ display: "block" }}>
              <em style={{ fontStyle: "italic", color: "#7FC4EA" }}>No history.</em>
            </span>
          </h1>
          <div
            className="tm-hero-sub"
            style={{
              width: "min(620px, 100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 26,
            }}
          >
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "#F0F5FF", margin: 0, textShadow: "0 1px 14px rgba(0,0,0,0.65)" }}>
              Most of South Sudan&apos;s clinics run on paper-based records that get lost, damaged, or destroyed — and when the
              paper goes, the patient&apos;s story goes with it. Tamam brings digital records that work offline, so care never starts from zero —{" "}
              <strong style={{ color: "#FFFFFF" }}>one system built to hold every community&apos;s story, not just one clinic&apos;s.</strong>
            </p>
            <div className="tm-btn-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-start" }}>
              <a
                href="#problem"
                className="tm-hero-btn-primary"
                style={{ background: "#1774A8", color: "#FFFFFF", fontSize: 14, fontWeight: 700, padding: "13px 26px", textDecoration: "none", letterSpacing: "0.02em" }}
              >
                The Crisis
              </a>
              <a
                href="#solution"
                className="tm-hero-btn-secondary"
                style={{ background: "rgba(254,255,249,0.92)", color: "#015697", fontSize: 14, fontWeight: 700, padding: "13px 26px", textDecoration: "none", letterSpacing: "0.02em" }}
              >
                Our Solution
              </a>
            </div>
          </div>
        </div>

        <a
          href="#problem"
          aria-label="Scroll to the problem"
          style={{
            position: "absolute",
            bottom: 18,
            left: "max(32px, calc((100% - 1320px) / 2))",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "rgba(255,255,255,0.85)",
            textDecoration: "none",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Scroll{" "}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="4" x2="12" y2="19" />
            <polyline points="6 13 12 19 18 13" />
          </svg>
        </a>
      </section>

      {/* ═══ 01 The Problem ═══ */}
      <section id="problem" className="tm-section" style={{ position: "relative", background: "#0E2A4A", color: "#FFFFFF", padding: "100px 32px", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...KICKER, color: "#0E2A4A", background: "#E8863A" }}>The Problem</span>
            </div>
            <h2 style={H2}>A health system asked to do the impossible</h2>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "rgba(255,255,255,0.84)", margin: 0, maxWidth: 680 }}>
              Across South Sudan, clinics and hospitals deliver care through conflict, flooding, and displacement — on
              paper registers, without reliable power or connectivity.
            </p>
          </div>

          <div className="tm-grid-split" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 40, alignItems: "stretch" }}>
            <div
              style={{
                background: "#0B2440",
                padding: "44px 40px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(72px, 7vw, 110px)", fontWeight: 600, lineHeight: 0.95, color: "#F5A263", letterSpacing: "-0.02em" }}>
                {crisisLead.value}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{crisisLead.unit}</span>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,0.82)", maxWidth: 400 }}>{crisisLead.context}</p>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "rgba(255,255,255,0.62)" }}>— {crisisLead.source}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {crisisRest.map((s) => (
                <div key={s.value} style={{ display: "flex", alignItems: "center", gap: 26, padding: "26px 4px", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
                  <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 42, fontWeight: 600, lineHeight: 1, color: "#F5A263", letterSpacing: "-0.02em", minWidth: 172 }}>
                    {s.value}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.unit}</span>
                    <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(255,255,255,0.78)" }}>
                      {s.context}{" "}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.62)" }}>— {s.source}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(24px, 2.6vw, 32px)", fontWeight: 600, margin: 0 }}>
                How care breaks down, visit after visit
              </h3>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#F5A263" }}>
                Paper → Delay → Misdiagnosis
              </span>
            </div>
            <div className="tm-grid-breakdown" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              {BREAKDOWN_STEPS.map((b) => (
                <div key={b.title} className="tm-breakdown-card" style={{ position: "relative", overflow: "hidden", minHeight: 380, display: "flex", alignItems: "flex-end", background: "#0E2A4A" }}>
                  <Image src={b.image} alt={b.alt} fill sizes="(max-width: 1023px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(14,42,74,0.95) 0%, rgba(14,42,74,0.2) 55%, rgba(14,42,74,0) 100%)" }} />
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      margin: "0 20px 20px 20px",
                      background: "rgba(14,42,74,0.55)",
                      backdropFilter: "blur(4px)",
                      padding: "18px 20px",
                    }}
                  >
                    <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}>{b.title}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.85)" }}>{b.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 02 Research ═══ */}
      <section id="research" className="tm-section" style={{ position: "relative", padding: "0 32px 100px", background: "#0F4C81", color: "#FFFFFF", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 72 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...KICKER, color: "#0F4C81", background: "#E2EDF7" }}>Ground Truth</span>
            </div>
            <h2 style={H2}>The daily reality inside South Sudan&apos;s facilities</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,0.84)", maxWidth: 680 }}>
              Documented across South Sudanese facilities, from the wards to the waiting line — the same failures repeat
              on both sides of the consultation desk.
            </p>
          </div>

          <div className="tm-grid-insights" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
            {INSIGHTS.map((ins) => (
              <div
                key={ins.number}
                className="tm-insight-card"
                style={{
                  background: ins.bg,
                  color: ins.fg,
                  padding: "34px 34px 36px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 22,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: ins.kickerColor }}>
                      {ins.kicker}
                    </span>
                    <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 27, fontWeight: 600, margin: 0 }}>{ins.title}</h3>
                  </div>
                  {/* Decorative watermark numeral — intentionally faint, hidden from AT */}
                  <span aria-hidden="true" style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 60, fontWeight: 700, lineHeight: 1, color: ins.numColor }}>{ins.number}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
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
      <section id="solution" className="tm-section" style={{ position: "relative", padding: "100px 32px", background: "#EFF6FB", borderTop: "1.5px solid #015697", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...KICKER, color: "#FFFFFF", background: "#015697" }}>The Solution</span>
            </div>
            <h2 style={H2}>Simple enough for the front desk. Strong enough for the nation.</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#5B6B7E", maxWidth: 680 }}>
              Everything the paper system loses — history, time, trust — Tamam keeps. One offline-first record that
              follows the patient through every visit.
            </p>
          </div>

          <div className="tm-compare-strip" style={{ display: "flex", alignItems: "stretch", gap: 0, flexWrap: "wrap", border: "1.5px solid #015697" }}>
            <div className="tm-compare-col" style={{ flex: 1.1, minWidth: 250, display: "flex", flexDirection: "column", gap: 18, padding: "34px 30px", background: "#F8E3D2" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9A4A12" }}>
                Today — fragmented on paper
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                {PAPER_CHIPS.map((chip) => (
                  <span key={chip.label} style={{ display: "inline-block" }}>
                    <span
                      style={{
                        display: "inline-block",
                        background: "#EFF8FD",
                        border: "1px solid #C88A5A",
                        color: "#7A3D10",
                        fontSize: 13,
                        fontWeight: 600,
                        padding: "8px 14px",
                        transform: `rotate(${chip.rotate}deg)`,
                        boxShadow: "2px 2px 0 rgba(154,74,18,0.25)",
                      }}
                    >
                      {chip.label}
                    </span>
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "#9A4A12" }}>
                Scattered across desks, drawers, and memory — lost with every flood, fire, and transfer.
              </span>
            </div>
            <div
              className="tm-compare-col tm-compare-col-mid"
              style={{
                flex: 0.9,
                minWidth: 230,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 14,
                padding: "34px 26px",
                background: "#EFF8FD",
                borderLeft: "1.5px solid #015697",
                borderRight: "1.5px solid #015697",
              }}
            >
              <span className="tm-compare-arrow-full" style={{ fontSize: 22, color: "#5F7186" }}>→</span>
              <span className="tm-compare-arrow-short" style={{ fontSize: 22, color: "#5F7186" }}>↓</span>
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 96, height: 96 }}>
                <span style={{ position: "absolute", inset: 0, border: "2px solid #2191D0", borderRadius: 999 }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/tamam-logo-mark.svg" alt="" style={{ height: 54, width: "auto", position: "relative" }} />
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/tamam-logo-type.svg" alt="Tamam Healthcare System" style={{ height: 16, width: "auto" }} />
              <span className="tm-compare-arrow-full" style={{ fontSize: 22, color: "#5F7186" }}>→</span>
              <span className="tm-compare-arrow-short" style={{ fontSize: 22, color: "#5F7186" }}>↓</span>
            </div>
            <div className="tm-compare-col" style={{ flex: 1.1, minWidth: 250, display: "flex", flexDirection: "column", gap: 18, padding: "34px 30px", background: "#DDF2FB" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#015697" }}>
                With Tamam — one connected record
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {TAMAM_CHECKS.map((c) => (
                  <span key={c} style={{ background: "#EFF8FD", border: "1px solid #2191D0", color: "#015697", fontSize: 13, fontWeight: 600, padding: "9px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#2191D0" }}>✓</span> {c}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "#015697" }}>
                Offline-first, synced when connection returns — nothing lost, nothing rewritten.
              </span>
            </div>
          </div>

          <div className="tm-grid-features" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="tm-feature-card"
                style={{
                  background: "#FFFFFF",
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <span style={{ width: 54, height: 54, borderRadius: 999, background: "#EFF8FD", border: "1px solid #BCE4F6", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {f.icon}
                </span>
                <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 18, fontWeight: 600, margin: 0, color: "#015697", lineHeight: 1.25 }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#015697" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 05 Products ═══ */}
      <section id="products" className="tm-section" style={{ position: "relative", padding: "100px 32px", background: "#F5FAFD", borderTop: "1.5px solid #015697", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...KICKER, color: "#FFFFFF", background: "#015697" }}>The Products</span>
            </div>
            <h2 style={H2}>Six products, one connected encounter</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#5B6B7E", maxWidth: 680 }}>
              From referral hospitals to single-room clinics — every product ties back to the same record, built for
              intermittent connectivity.
            </p>
          </div>
          <div className="tm-grid-products" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
            {PRODUCTS.map((prod) => (
              <div key={prod.acronym} className="tm-product-card" style={{ background: "#FFFFFF", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", borderBottom: `1.5px solid ${prod.accent}` }}>
                  <div style={{ position: "relative", width: "100%", height: 200 }}>
                    <Image src={prod.image} alt={prod.imageAlt} fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" style={{ objectFit: "cover", objectPosition: "center 25%" }} />
                  </div>
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      background: prod.accent,
                      color: "#FFFFFF",
                      padding: "8px 16px",
                    }}
                  >
                    {prod.acronym}
                  </span>
                </div>
                <div style={{ padding: "24px 26px 28px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22, fontWeight: 600, margin: 0, lineHeight: 1.15, color: "#1A2233" }}>{prod.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: prod.accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>{prod.tagline}</p>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#475569" }}>{prod.description}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto", paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
                    {prod.modules.map((m) => (
                      <span key={m} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: prod.accent, background: "#F4F4F8", padding: "4px 10px" }}>
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

      {/* ═══ 05b National Alignment ═══ */}
      <section id="national" className="tm-section" style={{ position: "relative", padding: "100px 32px", background: "#EFF6FB", borderTop: "1.5px solid #015697", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...KICKER, color: "#FFFFFF", background: "#015697" }}>National Alignment</span>
            </div>
            <h2 style={H2}>Built around South Sudan&apos;s own health system</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#5B6B7E", maxWidth: 720 }}>
              The Ministry of Health&apos;s <strong style={{ color: "#015697" }}>2025 Essential Health Services Package</strong> organises
              the country&apos;s care into six levels — and names fragmented, paper-bound data as one of its biggest gaps. Tamam is shaped to
              fit that system, not replace it.
            </p>
          </div>

          <div className="tm-grid-national" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24, alignItems: "stretch" }}>
            {/* Left — six levels of care mapped to products */}
            <div className="tm-national-card" style={{ background: "#FFFFFF", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "22px 26px", borderBottom: "1.5px solid #015697", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 21, fontWeight: 600, margin: 0, color: "#015697" }}>The six levels of care</h3>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5F7186" }}>Served by Tamam</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                {CARE_LEVELS.map((c, i) => (
                  <div key={c.level} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 26px", borderTop: i === 0 ? "none" : "1px solid #E2E8F0", flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1A2233", lineHeight: 1.3 }}>{c.level}</span>
                      <span style={{ fontSize: 13, color: "#5B6B7E", lineHeight: 1.4 }}>{c.role}</span>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500, color: "#FFFFFF", background: c.tone, padding: "5px 11px", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {c.product}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, padding: "18px 26px", borderTop: "1.5px solid #015697", fontSize: 13.5, lineHeight: 1.6, color: "#015697", background: "#F5FAFD" }}>
                Every level writes to the <strong>same patient record</strong> and rolls up into DHIS2-ready national reports — with laboratory,
                imaging, pharmacy, and the patient portal plugging in across the hospital and diagnostic tiers.
              </p>
            </div>

            {/* Right — system reality + the Ministry's own named gap */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="tm-national-card" style={{ background: "#FFFFFF", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#5F7186", marginBottom: 8 }}>
                  The reality Tamam is built for
                </span>
                {SYSTEM_STATS.map((s, i) => (
                  <div key={s.value} style={{ display: "flex", alignItems: "baseline", gap: 18, padding: "15px 0", borderTop: i === 0 ? "none" : "1px solid #E2E8F0" }}>
                    <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 34, fontWeight: 600, lineHeight: 1, color: "#A84A15", letterSpacing: "-0.02em", minWidth: 78 }}>
                      {s.value}
                    </span>
                    <span style={{ fontSize: 14, lineHeight: 1.5, color: "#334155", fontWeight: 500 }}>
                      {s.label}{" "}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#5F7186", whiteSpace: "nowrap" }}>— {s.source}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="tm-national-card" style={{ background: "#FFFFFF", borderLeft: "4px solid #E8863A", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A84A15" }}>
                  The Ministry&apos;s own diagnosis
                </span>
                <p style={{ margin: 0, fontFamily: "'Lora', Georgia, serif", fontSize: 19, lineHeight: 1.5, color: "#0E2A4A", fontWeight: 500 }}>
                  The sector still runs on parallel, disconnected systems — and the lack of accurate, timely data means care and planning
                  can&apos;t rely on what&apos;s recorded.
                </p>
                <span style={{ fontSize: 13, color: "#5B6B7E" }}>
                  Paraphrased from the South Sudan Essential Health Services Package, 2025 — the exact gap a single offline-first record closes.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 06 The Goal ═══ */}
      <section id="goal" className="tm-section" style={{ position: "relative", padding: "100px 32px", background: "#013D6B", color: "#FFFFFF", overflow: "hidden" }}>
        <div className="tm-grid-split" style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 56, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...KICKER, color: "#0C5C78", background: "#DCEEF3" }}>The Goal</span>
            </div>
            <h2 style={H2}>Prove it works, then bring it to every clinic that needs it</h2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: "rgba(255,255,255,0.84)" }}>
              We&apos;re raising <strong style={{ color: "#8FD9EC" }}>$100,000</strong> to launch TamamHealth in 10
              clinics across Juba and greater South Sudan — proof that offline-first digital records can work in the
              hardest conditions on Earth.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.25)", overflow: "hidden" }}>
            {GOAL_STATS.map((g) => (
              <div key={g.value} style={{ display: "flex", alignItems: "baseline", gap: 20, background: "#0C5C78", padding: "24px 28px" }}>
                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 54, fontWeight: 600, color: "#8FD9EC", lineHeight: 1, minWidth: 150, letterSpacing: "-0.02em" }}>
                  {g.value}
                </span>
                <span style={{ fontSize: 14.5, lineHeight: 1.45, color: "#DCEEF3", fontWeight: 500 }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 07 Team ═══ */}
      <section id="team" className="tm-section" style={{ position: "relative", padding: "100px 32px", background: "#EAF2F7", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...KICKER, color: "#FFFFFF", background: "#1A2233" }}>The Team</span>
            </div>
            <h2 style={H2}>Built by people who&apos;ve lived this</h2>
          </div>
          <div className="tm-grid-team" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: "#E2E8F0", border: "1.5px solid #E2E8F0" }}>
            {TEAM.map((t) => (
              <div key={t.name} className="tm-team-card" style={{ background: "#FFFFFF", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: "1", borderBottom: "1.5px solid #E2E8F0" }}>
                  <Image src={t.image} alt={t.name} fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 220px" style={{ objectFit: "cover" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "16px 18px 18px" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#5B6B7E" }}>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Contact / Get involved ═══ */}
      <section id="contact" className="tm-section" style={{ position: "relative", background: "#015697", color: "#FFFFFF", padding: "110px 32px 90px", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto" }}>
        <div className="tm-grid-split" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 56, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "#A6D7F1" }}>
              Get involved
            </span>
            <h2 className="tm-contact-h" style={{ fontFamily: "'Lora', Georgia, serif", fontSize: "clamp(32px, 4.2vw, 54px)", fontWeight: 600, margin: 0, lineHeight: 1.12 }}>
              The problem is enormous. The fix is buildable.
            </h2>
            <span style={{ width: 100, height: 3, background: "#2191D0" }} />
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: "#C7D8F5", maxWidth: 480 }}>
              Facility, NGO, funder, or just curious — tell us what you&apos;re building or how you want to help.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "#C7D8F5", marginTop: 20 }}>
              <a href="mailto:support.tamam@gmail.com" style={{ color: "#FFFFFF", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "3px" }}>
                support.tamam@gmail.com
              </a>
              <span>Founded at Tufts University · starting in South Sudan, built to scale</span>
            </div>
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
                    setFormStatus("idle");
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
                    setFormStatus("idle");
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
                    setFormStatus("idle");
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
                  setFormStatus("idle");
                }}
                className="tm-form-input"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", fontFamily: "'DM Sans', sans-serif", fontSize: 15, padding: "13px 14px", outline: "none", resize: "vertical" }}
              />
            </label>
            <button
              onClick={sendMessage}
              disabled={formStatus === "sending"}
              className="tm-submit-btn"
              style={{
                alignSelf: "flex-start",
                background: formStatus === "sent" ? "#1E7A44" : "#1774A8",
                color: "#FFFFFF",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15.5,
                fontWeight: 700,
                padding: "15px 34px",
                border: "none",
                cursor: formStatus === "sending" ? "wait" : "pointer",
                letterSpacing: "0.02em",
                opacity: formStatus === "sending" ? 0.7 : 1,
              }}
            >
              {formStatus === "sending" ? "Sending…" : formStatus === "sent" ? "Message sent ✓" : "Send message"}
            </button>
            {formStatus === "error" && <p style={{ margin: 0, fontSize: 14, color: "#FFB4B4" }}>{formError}</p>}
          </div>
        </div>
        </div>
      </section>
      </main>

      {/* ═══ Footer ═══ */}
      <footer style={{ background: "#01466F", color: "#C7D8F5", borderTop: "1px solid rgba(255,255,255,0.15)", padding: "28px 32px" }}>
        <div className="tm-footer-row" style={{ maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", fontSize: 13, alignItems: "center" }}>
          <div className="tm-footer-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamam-logo-mark.svg" alt="" style={{ height: 24, width: "auto", flexShrink: 0 }} />
            <span>© 2026 TamamHealth — offline-first digital health infrastructure, starting in South Sudan</span>
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
