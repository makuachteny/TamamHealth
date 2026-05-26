"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import Link from "next/link";
import {
  Users, Brain, Activity, Baby, ArrowRight,
  Check, ChevronDown, Mail, MapPin, Globe, Lock, Database,
  Video, Calendar, BarChart3, Menu, X, Shield, Stethoscope,
  Pill, FlaskConical, FileText, Network, Layers, Code2,
  Server, Cpu, MonitorSmartphone, Languages,
  GitBranch,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Main Landing Page
   Aesthetic: clean clinical editorial, deep blue accents,
   IBM Plex Sans, generous whitespace, section cards with real imagery
   ═══════════════════════════════════════════════════════════════════ */

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const { ref, inView } = useInView(0.08);
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function Counter({ end, suffix = "", prefix = "", duration = 2200 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const { ref, inView } = useInView(0.3);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ─── DATA ───────────────────────────────────────────────────────

const HERO_STATS = [
  { value: 90, suffix: "+", label: "Features", sub: "to support any specialty" },
  { value: 11, suffix: ".4M", label: "People to Serve", sub: "across South Sudan" },
  { value: 8, suffix: "+", label: "Core Modules", sub: "clinical & administrative" },
  { value: 4, suffix: "+", label: "Yearly Releases", sub: "continuous improvement" },
];

const FEATURE_CATEGORIES = [
  {
    title: "Configurable for Any Clinical Program",
    icon: Stethoscope,
    color: "#1B9AAA",
    desc: "Flexible and configurable for any clinical area. Today TamamHealth is used in a wide variety of areas: from Primary Care for Outpatients; to Specialty Centers for NCD, MCH/ANC, HIV, TB, Malaria, and more; to large Hospital-based Inpatient care.",
    highlights: ["Primary Care & Outpatient", "MCH / ANC / Immunization", "NCD, HIV, TB, Malaria", "Inpatient & Surgery"],
  },
  {
    title: "Clinical Documentation & Flexible Forms",
    icon: FileText,
    color: "#246860",
    desc: "Triage and track your patients' history. Write orders electronically. Create and customize all the forms your providers might need, for any clinical area. Non-developers can build new forms easily with the user-friendly Form Builder.",
    highlights: ["Electronic clinical notes", "Customizable form builder", "ICD-10/ICD-11 coding", "Diagnosis & treatment tracking"],
  },
  {
    title: "Registration, Appointments, Queues & Billing",
    icon: Calendar,
    color: "#1A3A3A",
    desc: "Manage your patient lists and bookings in one location or across multiple sites. Connect your registration to national patient databases. Handle bills, inventory, labs, and dispensing directly or through integration.",
    highlights: ["Patient registration & search", "Appointment scheduling", "Queue management", "Billing & stock management"],
  },
  {
    title: "Interoperable Locally and Nationally",
    icon: Network,
    color: "#1B9AAA",
    desc: "The TamamHealth REST and FHIR-ready APIs enable integration with other end-user tools, such as ERP Systems, Lab Systems, DHIS2, and more; or, with National Health Exchanges.",
    highlights: ["DHIS2 automated export", "REST API", "FHIR-ready architecture", "National system integration"],
  },
  {
    title: "Privileges & User Management",
    icon: Lock,
    color: "#246860",
    desc: "Role-based access and deeper permissions granularity, such as by location or data types. Audit logging enables follow up on actions taken. 11+ distinct user roles from CHW to Ministry admin.",
    highlights: ["11+ user roles (RBAC)", "Location-based access", "Audit logging", "Session management"],
  },
  {
    title: "Language Translation",
    icon: Languages,
    color: "#1A3A3A",
    desc: "TamamHealth has configurable translation tools so your team can set up the languages your users need — including supporting multiple different languages at once, and Right-to-Left language support.",
    highlights: ["Multi-language interface", "60+ South Sudan languages", "RTL support", "Icon-driven for low-literacy"],
  },
  {
    title: "Clinical Data Reporting & Exports",
    icon: BarChart3,
    color: "#1B9AAA",
    desc: "Track and analyze clinical data: See your impact, report to stakeholders, and monitor key metrics. Generate IDSR reports, MCH analytics, and donor-ready outputs.",
    highlights: ["IDSR weekly reports", "MCH analytics dashboard", "Custom report builder", "Donor-ready exports"],
  },
  {
    title: "AI-Powered Clinical Decision Support",
    icon: Brain,
    color: "#246860",
    desc: "Rule-based clinical decision support running entirely in the browser. WHO/IMCI guideline-aligned. Suggests diagnoses, treatments, and lab orders — no internet required.",
    highlights: ["WHO/IMCI guidelines", "15+ priority diseases", "Offline AI inference", "Severity triage"],
  },
];

const SHOWCASE_SECTIONS = [
  {
    eyebrow: "Features",
    title: "A rich feature set to meet all your facility use cases",
    desc: "TamamHealth is designed to be extremely flexible and configurable for any use case — from the smallest rural PHCU to the largest teaching hospital.",
    cta: "See key features below",
    ctaId: "features",
    visual: "features",
    color: "#1B9AAA",
  },
  {
    eyebrow: "Roadmap",
    title: "Collaborating on shared needs",
    desc: "We build together with the clinical teams who use TamamHealth every day. See what's happening now, what's next, and share new ideas to shape the platform's direction.",
    cta: "Go to our roadmap",
    ctaId: "roadmap",
    visual: "roadmap",
    color: "#246860",
  },
  {
    eyebrow: "Releases",
    title: "What's in the latest release?",
    desc: "We regularly release new features, updates and security patches. You can learn more about all the changes in our release notes.",
    cta: "View release notes",
    ctaId: "releases",
    visual: "releases",
    color: "#1A3A3A",
  },
  {
    eyebrow: "Deploy",
    title: "The purpose-built EMR for South Sudan.",
    desc: "From the smallest clinic to the largest healthcare network, TamamHealth is for you. Deploy offline-first with zero infrastructure dependency and rapid onboarding for any clinical team.",
    cta: "Try the Demo",
    ctaHref: "/login",
    visual: "download",
    color: "#1B9AAA",
  },
];

const TECH_STACK = [
  { name: "React / Next.js", desc: "Modern component architecture", icon: Code2 },
  { name: "TypeScript", desc: "Type-safe clinical data", icon: Layers },
  { name: "PouchDB / CouchDB", desc: "Offline-first sync", icon: Database },
  { name: "PostgreSQL", desc: "Server-side analytics", icon: Server },
  { name: "Tailwind CSS", desc: "Responsive design system", icon: MonitorSmartphone },
  { name: "Claude AI", desc: "Clinical decision support", icon: Cpu },
];

const INTEROP_ITEMS = [
  { name: "DHIS2", desc: "Automated monthly data export to the national health information system. 142+ data elements mapped.", icon: Globe },
  { name: "FHIR-Ready", desc: "Architecture designed for HL7 FHIR compliance. Patient, Observation, and Encounter resources.", icon: GitBranch },
  { name: "WHO Standards", desc: "ICD-10/ICD-11 coding, IMCI guidelines, IDSR reporting, and ISO 13606 health record communication.", icon: Shield },
  { name: "Lab Systems", desc: "Order management and result integration. Supports referral lab workflows across facilities.", icon: FlaskConical },
  { name: "National ID", desc: "Geocode-based patient identification (BOMA-{code}-HH{number}) for populations without national IDs.", icon: Users },
  { name: "REST API", desc: "Full REST API for third-party integration. Authentication, patient data, and reporting endpoints.", icon: Server },
];

const RELEASES = [
  { version: "v2.4", date: "March 2026", title: "MCH Analytics & Surveillance", highlights: ["Maternal health dashboards", "IDSR outbreak detection", "Enhanced offline sync"] },
  { version: "v2.3", date: "January 2026", title: "AI Clinical Decision Support", highlights: ["WHO/IMCI diagnosis engine", "15+ disease protocols", "Browser-based inference"] },
  { version: "v2.2", date: "November 2025", title: "Telehealth & Billing", highlights: ["Video consultations", "ISO 13131 compliance", "Patient billing module"] },
  { version: "v2.1", date: "September 2025", title: "Multi-Facility Administration", highlights: ["Org-level admin panel", "Cross-facility referrals", "Role-based branding"] },
];

const ROADMAP_ITEMS = [
  { status: "done", label: "Done", items: ["Patient registration & records", "Offline-first sync engine", "AI diagnosis support", "DHIS2 export", "Telehealth module", "Birth & death registration"] },
  { status: "now", label: "Now", items: ["FHIR R4 compliance", "End-to-end encryption", "Community health worker app", "Enhanced MCH analytics", "Stock management v2"] },
  { status: "next", label: "Next", items: ["OMOP CDM mapping", "National health exchange", "Biometric patient ID", "Multi-tenant SaaS", "Research data exports", "Mobile-native app"] },
];

const TOUR_FEATURES = [
  { icon: Users, label: "Patient Registry", desc: "Photo-based ID, geocode tracking" },
  { icon: Stethoscope, label: "Clinical Notes", desc: "Structured documentation & forms" },
  { icon: FlaskConical, label: "Lab Management", desc: "Order, track, and result" },
  { icon: Pill, label: "Pharmacy", desc: "Dispensing & stock control" },
  { icon: Calendar, label: "Appointments", desc: "Schedule & queue management" },
  { icon: Activity, label: "Surveillance", desc: "Real-time disease monitoring" },
  { icon: Baby, label: "CRVS", desc: "Birth & death registration" },
  { icon: Video, label: "Telehealth", desc: "Video & audio consultations" },
];

// ─── MAIN PAGE COMPONENT ────────────────────────────────────────

export default function ProductPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [activeTour, setActiveTour] = useState(0);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNav(false);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: productCSS }} />

      {/* ════════ HEADER ════════ */}
      <header className={`p-header ${scrolled ? "p-header--scrolled" : ""}`}>
        <div className="p-container p-header__inner">
          <Link href="/" className="p-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamamhealth-icon.svg" alt="TamamHealth" className="p-logo__icon" />
            <span className="p-logo__text">TamamHealth</span>
          </Link>

          <nav className="p-nav">
            {[
              { label: "Product", href: "/product" },
              { label: "Features", action: () => scrollTo("features") },
              { label: "Technology", action: () => scrollTo("technology") },
              { label: "Roadmap", action: () => scrollTo("roadmap") },
            ].map((item) => (
              item.href ? (
                <Link key={item.label} href={item.href} className={`p-nav__link ${item.label === "Product" ? "p-nav__link--active" : ""}`}>{item.label}</Link>
              ) : (
                <button key={item.label} className="p-nav__link" onClick={item.action}>{item.label}</button>
              )
            ))}
          </nav>

          <div className="p-header__actions">
            <Link href="/patient-portal" className="p-btn p-btn--ghost">Patient Sign In</Link>
            <Link href="/login" className="p-btn p-btn--ghost">Staff Sign In</Link>
            <Link href="/login" className="p-btn p-btn--primary">
              Try Demo <ArrowRight size={14} />
            </Link>
          </div>

          <button className="p-mobile-toggle" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X size={56} /> : <Menu size={56} />}
          </button>
        </div>

        {mobileNav && (
          <div className="p-mobile-nav">
            <button className="p-mobile-nav__link" onClick={() => scrollTo("features")}>Features</button>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("technology")}>Technology</button>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("interoperability")}>Interoperability</button>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("roadmap")}>Roadmap</button>
            <div className="p-mobile-nav__actions">
              <Link href="/patient-portal" className="p-btn p-btn--outline" style={{ width: "100%" }}>Patient Sign In</Link>
              <Link href="/login" className="p-btn p-btn--outline" style={{ width: "100%" }}>Staff Sign In</Link>
              <Link href="/login" className="p-btn p-btn--primary" style={{ width: "100%" }}>
                Try Demo <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="p-main">

        {/* ════════ HERO ════════ */}
        <section className="p-hero">
          <div className="p-hero__bg" />
          <div className="p-container">
            <Reveal delay={0.05}>
              <h1 className="p-hero__title">
                The digital health record<br />
                <span className="p-hero__title--accent">built for South Sudan</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="p-hero__subtitle">
                Quality clinical information for every patient, provider and funder.
                Offline-first, WHO/IMCI-aligned, and designed for the places where
                connectivity isn&apos;t guaranteed.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="p-hero__ctas">
                <Link href="/login" className="p-btn p-btn--primary p-btn--lg">
                  Try the Demo <ArrowRight size={16} />
                </Link>
                <button className="p-btn p-btn--outline p-btn--lg" onClick={() => scrollTo("features")}>
                  Explore Features
                </button>
              </div>
            </Reveal>
            <Reveal delay={0.22}>
              <div className="p-hero__stats">
                {HERO_STATS.map((s, i) => (
                  <div key={i} className="p-hero__stat">
                    <div className="p-hero__stat-value">
                      <Counter end={s.value} suffix={s.suffix} />
                    </div>
                    <div className="p-hero__stat-label">{s.label}</div>
                    {s.sub && <div className="p-hero__stat-sub">{s.sub}</div>}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ SHOWCASE CARDS (Features/Roadmap/Releases/Download) ════════ */}
        <section className="p-showcase">
          <div className="p-container">
            {SHOWCASE_SECTIONS.map((s, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className={`p-showcase__card ${i % 2 !== 0 ? "p-showcase__card--reverse" : ""}`}>
                  <div className="p-showcase__content">
                    <span className="p-showcase__eyebrow" style={{ color: s.color }}>{s.eyebrow}</span>
                    <h2 className="p-showcase__title">{s.title}</h2>
                    <p className="p-showcase__desc">{s.desc}</p>
                    <button
                      className="p-showcase__cta"
                      style={{ color: s.color }}
                      onClick={() => s.ctaId ? scrollTo(s.ctaId) : (s.ctaHref && (window.location.href = s.ctaHref))}
                    >
                      {s.cta} <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="p-showcase__visual">
                    <ShowcaseVisual type={s.visual} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ════════ TECHNOLOGY ════════ */}
        <section className="p-tech" id="technology">
          <div className="p-container">
            <Reveal>
              <div className="p-section-header">
                <span className="p-eyebrow">Technology</span>
                <h2 className="p-section-title">A modern, standards-based health stack</h2>
                <p className="p-section-desc">
                  TamamHealth is built on proven web technologies and open clinical standards so your
                  teams and integration partners work with familiar, well-documented tools.
                </p>
              </div>
            </Reveal>
            <div className="p-tech__grid">
              {TECH_STACK.map((t, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="p-tech__card">
                    <div className="p-tech__card-icon"><t.icon size={34} /></div>
                    <h3 className="p-tech__card-name">{t.name}</h3>
                    <p className="p-tech__card-desc">{t.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <div className="p-tech__arch">
                <div className="p-tech__arch-header">
                  <div className="p-tech__arch-dots"><span /><span /><span /></div>
                  <span>TamamHealth EMR Architecture</span>
                </div>
                <div className="p-tech__arch-body">
                  <div className="p-tech__arch-layer">
                    <div className="p-tech__arch-label">Frontend</div>
                    <div className="p-tech__arch-items">
                      <span>React / Next.js</span><span>TypeScript</span><span>Tailwind CSS</span><span>PouchDB</span>
                    </div>
                  </div>
                  <div className="p-tech__arch-connector">
                    <div className="p-tech__arch-line" />
                    <span>REST API + Sync Protocol</span>
                    <div className="p-tech__arch-line" />
                  </div>
                  <div className="p-tech__arch-layer">
                    <div className="p-tech__arch-label">Backend</div>
                    <div className="p-tech__arch-items">
                      <span>Node.js / Next.js API</span><span>JWT Auth</span><span>CouchDB Sync</span><span>Claude AI</span>
                    </div>
                  </div>
                  <div className="p-tech__arch-connector">
                    <div className="p-tech__arch-line" />
                    <span>Data Layer</span>
                    <div className="p-tech__arch-line" />
                  </div>
                  <div className="p-tech__arch-layer">
                    <div className="p-tech__arch-label">Database</div>
                    <div className="p-tech__arch-items">
                      <span>PostgreSQL</span><span>CouchDB</span><span>PouchDB (local)</span><span>DHIS2 Export</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ INTEROPERABILITY ════════ */}
        <section className="p-interop" id="interoperability">
          <div className="p-container">
            <Reveal>
              <div className="p-section-header">
                <span className="p-eyebrow">Interoperability</span>
                <h2 className="p-section-title">Interoperability at the core</h2>
                <p className="p-section-desc">
                  Yes, TamamHealth can talk with other systems! Most teams need their EMR to connect with other
                  software: from within a facility, up to national-level systems.
                </p>
              </div>
            </Reveal>
            <div className="p-interop__grid">
              {INTEROP_ITEMS.map((item, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="p-interop__card">
                    <div className="p-interop__card-icon-wrap">
                      <item.icon size={44} />
                    </div>
                    <div>
                      <div className="p-interop__card-badge">{item.name}</div>
                      <p className="p-interop__card-desc">{item.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <div className="p-interop__cta-row">
                <div className="p-interop__cta-card">
                  <Globe size={34} />
                  <div>
                    <h4>DHIS2 Compatible</h4>
                    <p>Automated monthly data export feeds the national health information system directly.</p>
                  </div>
                </div>
                <div className="p-interop__cta-card">
                  <Shield size={34} />
                  <div>
                    <h4>FHIR-Ready &amp; WHO-Aligned</h4>
                    <p>Architecture designed for HL7 FHIR, ICD-10/ICD-11, and IMCI guideline compliance.</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ FEATURES DEEP DIVE ════════ */}
        <section className="p-features" id="features">
          <div className="p-container">
            <Reveal>
              <div className="p-section-header">
                <span className="p-eyebrow">Features</span>
                <h2 className="p-section-title">TamamHealth EMR Features</h2>
                <p className="p-section-desc">Some of the key features of TamamHealth include:</p>
              </div>
            </Reveal>
            <div className="p-features__grid">
              {FEATURE_CATEGORIES.map((f, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div
                    className={`p-features__card ${expandedFeature === i ? "p-features__card--expanded" : ""}`}
                    onClick={() => setExpandedFeature(expandedFeature === i ? null : i)}
                  >
                    <div className="p-features__card-header">
                      <div className="p-features__card-icon" style={{ background: f.color + "0D", color: f.color }}>
                        <f.icon size={56} />
                      </div>
                      <h3 className="p-features__card-title">{f.title}</h3>
                      <ChevronDown
                        size={44}
                        className="p-features__card-chevron"
                        style={{ transform: expandedFeature === i ? "rotate(180deg)" : "rotate(0)" }}
                      />
                    </div>
                    <p className="p-features__card-desc">{f.desc}</p>
                    {expandedFeature === i && (
                      <ul className="p-features__card-list">
                        {f.highlights.map((h, j) => (
                          <li key={j}><Check size={14} style={{ color: f.color }} /> {h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <div className="p-features__more">
                <p>There are more than <strong>90 major features</strong> in the starter TamamHealth EMR, and many more that can be optionally added on — or, you can add your own features!</p>
                <button className="p-btn p-btn--outline" onClick={() => scrollTo("tour")}>
                  Take a Quick Tour <ArrowRight size={14} />
                </button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ RELEASES ════════ */}
        <section className="p-releases" id="releases">
          <div className="p-container">
            <Reveal>
              <div className="p-section-header">
                <span className="p-eyebrow">Releases</span>
                <h2 className="p-section-title">Release History</h2>
                <p className="p-section-desc">We regularly release new features, updates and security patches.</p>
              </div>
            </Reveal>
            <div className="p-releases__timeline">
              {RELEASES.map((r, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div className="p-releases__item">
                    <div className="p-releases__item-marker">
                      <div className="p-releases__item-dot" />
                      {i < RELEASES.length - 1 && <div className="p-releases__item-line" />}
                    </div>
                    <div className="p-releases__item-content">
                      <div className="p-releases__item-meta">
                        <span className="p-releases__item-version">{r.version}</span>
                        <span className="p-releases__item-date">{r.date}</span>
                      </div>
                      <h3 className="p-releases__item-title">{r.title}</h3>
                      <ul className="p-releases__item-highlights">
                        {r.highlights.map((h, j) => (
                          <li key={j}><Check size={12} /> {h}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ ROADMAP ════════ */}
        <section className="p-roadmap" id="roadmap">
          <div className="p-container">
            <Reveal>
              <div className="p-section-header">
                <span className="p-eyebrow">Roadmap</span>
                <h2 className="p-section-title">What we&apos;re building</h2>
                <p className="p-section-desc">A transparent view into our development priorities and direction.</p>
              </div>
            </Reveal>
            <div className="p-roadmap__columns">
              {ROADMAP_ITEMS.map((col, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <div className="p-roadmap__column">
                    <div className={`p-roadmap__column-header p-roadmap__column-header--${col.status}`}>
                      {col.label}
                    </div>
                    <div className="p-roadmap__column-body">
                      {col.items.map((item, j) => (
                        <div key={j} className="p-roadmap__item">
                          <div className={`p-roadmap__item-dot p-roadmap__item-dot--${col.status}`} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ TOUR ════════ */}
        <section className="p-tour" id="tour">
          <div className="p-container">
            <Reveal>
              <div className="p-section-header">
                <span className="p-eyebrow">Tour</span>
                <h2 className="p-section-title">Quick Tour of the TamamHealth EMR</h2>
              </div>
            </Reveal>
            <div className="p-tour__grid">
              {TOUR_FEATURES.map((f, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className="p-tour__card" onMouseEnter={() => setActiveTour(i)}>
                    <div className={`p-tour__card-icon ${activeTour === i ? "p-tour__card-icon--active" : ""}`}>
                      <f.icon size={44} />
                    </div>
                    <h4 className="p-tour__card-label">{f.label}</h4>
                    <p className="p-tour__card-desc">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <div className="p-tour__cta">
                <h3>Ready to dive in?</h3>
                <p>Try out the latest version of TamamHealth with sample data in our demo environment.</p>
                <Link href="/login" className="p-btn p-btn--primary p-btn--lg">
                  Explore the Demo <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ CTA ════════ */}
        <section className="p-final-cta">
          <div className="p-container">
            <Reveal>
              <div className="p-final-cta__inner">
                <h2>Built by South Sudanese,<br />for South Sudan.</h2>
                <p>&ldquo;TamamHealth&rdquo; means &ldquo;Hope&rdquo; in Dinka. Purpose-built digital health records for the world&apos;s hardest health environments.</p>
                <div className="p-final-cta__buttons">
                  <Link href="/login" className="p-btn p-btn--cta">
                    Try the Demo <ArrowRight size={16} />
                  </Link>
                  <Link href="/" className="p-btn p-btn--cta-outline">
                    Back to Home
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ════════ FOOTER ════════ */}
      <footer className="p-footer">
        <div className="p-container">
          <div className="p-footer__grid">
            <div className="p-footer__brand">
              <div className="p-logo" style={{ marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/tamamhealth-icon.svg" alt="TamamHealth" className="p-logo__icon" />
                <span className="p-logo__text" style={{ color: "#fff" }}>TamamHealth</span>
              </div>
              <p className="p-footer__tagline">&ldquo;Hope&rdquo; in Dinka. Purpose-built digital health records for the world&apos;s hardest health environments.</p>
            </div>
            <div className="p-footer__col">
              <h4>Product</h4>
              <Link href="/product">EMR Features</Link>
              <button onClick={() => scrollTo("technology")}>Technology</button>
              <button onClick={() => scrollTo("roadmap")}>Roadmap</button>
              <button onClick={() => scrollTo("releases")}>Releases</button>
            </div>
            <div className="p-footer__col">
              <h4>Community</h4>
              <button onClick={() => scrollTo("interoperability")}>Integrations</button>
              <Link href="/">Get Involved</Link>
              <Link href="/public-stats">Public Statistics</Link>
            </div>
            <div className="p-footer__col">
              <h4>About Us</h4>
              <Link href="/">Our Story</Link>
              <Link href="/login">Staff Sign In</Link>
              <div className="p-footer__contact"><Mail size={14} /> info@tamamhealth.org</div>
              <div className="p-footer__contact"><MapPin size={14} /> Juba, South Sudan</div>
            </div>
          </div>
          <div className="p-footer__bottom">
            <p>&copy; {new Date().getFullYear()} TamamHealth Health Technologies. All rights reserved.</p>
            <div className="p-footer__badges">
              <span><Shield size={12} /> ISO 13606</span>
              <span><Lock size={12} /> ISO 13131</span>
              <span><Globe size={12} /> DHIS2 Compatible</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── SHOWCASE VISUAL COMPONENT ──────────────────────────────────

function ShowcaseVisual({ type }: { type: string }) {
  if (type === "features") {
    return (
      <div className="p-showcase__visual-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/dashboard-screenshot.png" alt="TamamHealth EMR patient summary dashboard showing vitals, patient list, and clinical data" className="p-showcase__photo" />
        <div className="p-showcase__photo-caption">
          <span>Live Dashboard</span> — Patient summary, vitals, diagnosis tracking
        </div>
      </div>
    );
  }

  if (type === "roadmap") {
    return (
      <div className="p-showcase__visual-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/landing-img.jpg" alt="South Sudanese healthcare workers building the future of digital health" className="p-showcase__photo" />
        <div className="p-showcase__photo-caption">
          <span>Our Team</span> — South Sudanese healthcare workers shaping the roadmap
        </div>
      </div>
    );
  }

  if (type === "releases") {
    return (
      <div className="p-showcase__visual-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/health-data.jpg" alt="Health analytics dashboard showing clinical data reporting" className="p-showcase__photo" />
        <div className="p-showcase__photo-caption">
          <span>Data-Driven</span> — Clinical analytics and reporting in every release
        </div>
      </div>
    );
  }

  // download
  return (
    <div className="p-showcase__visual-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/african-nurse.jpg" alt="African healthcare worker using digital health records on mobile" className="p-showcase__photo" />
      <div className="p-showcase__photo-caption">
        <span>Digital-First</span> — Works on any device, even without internet
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const productCSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&family=IBM+Plex+Serif:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --p-blue: #1B9AAA;
  --p-blue-hover: #1E4D4A;
  --p-blue-dark: #1A3A3A;
  --p-blue-mid: #246860;
  --p-blue-light: #E8F3FD;
  --p-blue-pale: #F5FAFF;

  --p-text: #1A3A3A;
  --p-text-secondary: #3D5854;
  --p-text-muted: #5A7370;

  --p-bg: #FFFFFF;
  --p-bg-warm: #F2F0EB;
  --p-bg-cool: #F1F5F9;
  --p-bg-section: #F2F0EB;

  --p-border: #D4CFC5;
  --p-border-light: #F1F5F9;

  --p-radius: 8px;
  --p-radius-lg: 14px;
  --p-radius-xl: 20px;

  --p-shadow-xs: 0 1px 2px rgba(15,23,42,0.04);
  --p-shadow-sm: 0 2px 8px -2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04);
  --p-shadow-md: 0 8px 24px -8px rgba(15,23,42,0.1), 0 2px 6px rgba(15,23,42,0.04);
  --p-shadow-lg: 0 20px 48px -16px rgba(15,23,42,0.14), 0 4px 12px rgba(15,23,42,0.05);
  --p-shadow-xl: 0 32px 72px -24px rgba(15,23,42,0.18), 0 8px 20px rgba(15,23,42,0.06);

  --p-font-display: 'IBM Plex Sans', sans-serif;
  --p-font-body: 'IBM Plex Sans', sans-serif;
  --p-font-accent: 'IBM Plex Sans', sans-serif;
  --p-font-mono: 'IBM Plex Mono', monospace;

  --p-section-pad: clamp(80px, 10vh, 120px);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body {
  font-family: var(--p-font-body);
  color: var(--p-text);
  background: var(--p-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 1.125rem;
  line-height: 1.5;
}
a { color: inherit; text-decoration: none; }

/* ── Container ── */
.p-container { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
@media (max-width: 640px) { .p-container { padding: 0 20px; } }

/* ── Section Headers ── */
.p-section-header { text-align: center; max-width: 720px; margin: 0 auto 64px; }
.p-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--p-font-accent); font-size: 12px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--p-blue);
  margin-bottom: 18px;
  padding: 6px 14px; border-radius: 100px;
  background: var(--p-blue-light);
}
.p-section-title {
  font-family: var(--p-font-display); font-size: clamp(1.875rem, 4vw, 2.75rem);
  font-weight: 700; line-height: 1.15; color: var(--p-text);
  letter-spacing: -0.02em; margin-bottom: 20px;
}
.p-section-desc {
  font-size: clamp(1rem, 1.3vw, 1.125rem); line-height: 1.65;
  color: var(--p-text-secondary); max-width: 640px; margin: 0 auto; font-weight: 400;
}

/* ── Buttons ── */
.p-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 22px;
  font-family: var(--p-font-body); font-size: 14px; font-weight: 600;
  border-radius: 10px;
  border: 1.5px solid transparent;
  cursor: pointer; text-decoration: none;
  transition: transform 0.2s cubic-bezier(0.16,1,0.3,1),
              box-shadow 0.2s cubic-bezier(0.16,1,0.3,1),
              background 0.2s ease,
              border-color 0.2s ease,
              color 0.2s ease;
  line-height: 1.2; white-space: nowrap;
}
.p-btn--primary {
  background: var(--p-blue); color: #fff; border-color: var(--p-blue);
  box-shadow: 0 4px 12px -4px rgba(0,119,215,0.45);
}
.p-btn--primary:hover {
  background: var(--p-blue-hover); border-color: var(--p-blue-hover);
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -6px rgba(0,119,215,0.55);
}
.p-btn--outline {
  background: transparent; color: var(--p-text);
  border-color: var(--p-border);
}
.p-btn--outline:hover { border-color: var(--p-blue); color: var(--p-blue); background: var(--p-blue-pale); }
.p-btn--ghost {
  background: transparent; color: var(--p-text-secondary);
  border-color: transparent; padding: 10px 16px;
}
.p-btn--ghost:hover { color: var(--p-blue); background: var(--p-blue-pale); }
.p-btn--lg { padding: 16px 30px; font-size: 15px; border-radius: 12px; }
.p-btn--cta {
  background: #fff; color: var(--p-blue); padding: 16px 30px; font-size: 15px;
  border-color: #fff; border-radius: 12px;
}
.p-btn--cta:hover { background: var(--p-blue-pale); transform: translateY(-1px); }
.p-btn--cta-outline {
  background: transparent; color: #fff; padding: 16px 30px; font-size: 15px;
  border: 1.5px solid rgba(255,255,255,0.45); border-radius: 12px;
}
.p-btn--cta-outline:hover { border-color: #fff; background: rgba(255,255,255,0.08); }

/* ── Header — solid, no glassmorphism ── */
.p-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: 18px 0;
  background: #ffffff;
  border-bottom: 1px solid var(--p-border-light);
  transition: padding 0.25s ease, box-shadow 0.25s ease;
}
.p-header--scrolled {
  padding: 12px 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.02);
}
.p-header__inner { display: flex; align-items: center; gap: 20px; }
.p-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.p-logo__icon { width: 32px; height: 32px; border-radius: 8px; }
.p-logo__text {
  font-family: var(--p-font-display); font-size: 1.2rem; font-weight: 700;
  letter-spacing: 0.06em; color: var(--p-text);
}
.p-nav { display: flex; gap: 2px; margin-left: 24px; }
.p-nav__link {
  background: none; border: none; font-family: var(--p-font-accent); font-size: 14px;
  font-weight: 500; color: var(--p-text-secondary); padding: 10px 16px;
  cursor: pointer; transition: color 0.2s ease, background 0.2s ease;
  text-decoration: none; border-radius: 8px;
}
.p-nav__link:hover { color: var(--p-text); background: var(--p-bg-cool); }
.p-nav__link--active { color: var(--p-blue); font-weight: 600; }
.p-header__actions {
  display: flex; gap: 8px; margin-left: auto; align-items: center;
}
.p-mobile-toggle {
  display: none; background: none; border: none; cursor: pointer;
  padding: 8px; color: var(--p-text); margin-left: auto; border-radius: 8px;
}
.p-mobile-toggle:hover { background: var(--p-bg-cool); }
.p-mobile-nav {
  display: flex; flex-direction: column; gap: 2px; padding: 20px 24px 24px;
  background: #fff; border-top: 1px solid var(--p-border-light);
}
.p-mobile-nav__link {
  background: none; border: none; font-family: var(--p-font-body); font-size: 15px;
  font-weight: 600; color: var(--p-text); padding: 14px 0; cursor: pointer;
  text-align: left; border-bottom: 1px solid var(--p-border-light); text-decoration: none; display: block;
}
.p-mobile-nav__link:hover { color: var(--p-blue); }
.p-mobile-nav__link--active { color: var(--p-blue); }
.p-mobile-nav__actions {
  display: flex; flex-direction: column; gap: 8px; margin-top: 16px;
}
@media (max-width: 768px) {
  .p-nav, .p-header__actions { display: none; }
  .p-mobile-toggle { display: block; }
}

/* ── Hero ── */
.p-hero {
  position: relative; padding: 140px 0 96px; text-align: center;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, var(--p-blue-pale) 100%);
}
.p-hero__bg {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(ellipse 60% 40% at 20% 10%, rgba(0,119,215,0.08) 0%, transparent 70%),
    radial-gradient(ellipse 50% 35% at 85% 20%, rgba(10,95,194,0.06) 0%, transparent 70%),
    radial-gradient(ellipse 80% 50% at 50% 100%, rgba(0,119,215,0.05) 0%, transparent 70%);
  pointer-events: none;
}
.p-hero .p-container { position: relative; z-index: 1; }
.p-hero__tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700;
  padding: 7px 14px; border-radius: 100px;
  background: #fff; color: var(--p-blue);
  border: 1px solid var(--p-blue-light);
  box-shadow: 0 1px 3px rgba(0,119,215,0.08);
  margin-bottom: 24px;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.p-hero__title {
  font-family: var(--p-font-display); font-size: clamp(36px, 5.5vw, 64px);
  font-weight: 700; line-height: 1.08; color: var(--p-text);
  letter-spacing: -0.025em; margin-bottom: 22px;
}
.p-hero__title--accent {
  background: linear-gradient(135deg, var(--p-blue) 0%, var(--p-blue-mid) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text; color: transparent;
}
.p-hero__subtitle {
  font-size: clamp(16px, 1.4vw, 19px); line-height: 1.65;
  color: var(--p-text-secondary);
  max-width: 620px; margin: 0 auto 36px;
}
.p-hero__ctas {
  display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
  margin-bottom: 64px;
}
.p-hero__stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
  max-width: 920px; margin: 0 auto;
  background: #ffffff;
  border-radius: var(--p-radius-lg);
  border: 1px solid var(--p-border-light);
  box-shadow: var(--p-shadow-md);
  overflow: hidden;
}
.p-hero__stat {
  padding: 32px 20px; text-align: center;
  border-right: 1px solid var(--p-border-light);
  transition: background 0.2s ease;
}
.p-hero__stat:last-child { border-right: none; }
.p-hero__stat:hover { background: var(--p-blue-pale); }
.p-hero__stat-value {
  font-family: var(--p-font-display); font-size: clamp(1.875rem, 3vw, 2.5rem);
  font-weight: 700; color: var(--p-blue); line-height: 1; margin-bottom: 8px;
  letter-spacing: -0.02em;
}
.p-hero__stat-label {
  font-size: 11px; font-weight: 700; color: var(--p-text);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.p-hero__stat-sub {
  font-size: 11px; color: var(--p-text-muted);
  margin-top: 4px; line-height: 1.4;
}
@media (max-width: 720px) {
  .p-hero { padding: 120px 0 64px; }
  .p-hero__stats { grid-template-columns: repeat(2, 1fr); }
  .p-hero__stat:nth-child(2) { border-right: none; }
  .p-hero__stat:nth-child(1), .p-hero__stat:nth-child(2) { border-bottom: 1px solid var(--p-border-light); }
}
@media (max-width: 480px) {
  .p-hero__ctas { flex-direction: column; align-items: stretch; max-width: 320px; margin-left: auto; margin-right: auto; margin-bottom: 48px; }
  .p-hero__ctas .p-btn { width: 100%; }
}

/* ── Showcase Cards ── */
.p-showcase { padding: var(--p-section-pad) 0; }
.p-showcase__card {
  display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center;
  padding: 48px 0;
}
.p-showcase__card + .p-showcase__card { border-top: 1px solid var(--p-border-light); }
.p-showcase__card--reverse .p-showcase__content { order: 2; }
.p-showcase__card--reverse .p-showcase__visual { order: 1; }
.p-showcase__content { display: flex; flex-direction: column; align-items: flex-start; }
.p-showcase__eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  padding: 6px 14px; border-radius: 100px;
  background: var(--p-blue-light);
  margin-bottom: 16px;
}
.p-showcase__title {
  font-family: var(--p-font-display); font-size: clamp(24px, 2.6vw, 34px);
  font-weight: 700; line-height: 1.15; color: var(--p-text);
  letter-spacing: -0.015em;
  margin-bottom: 18px;
}
.p-showcase__desc {
  font-size: 15px; line-height: 1.7; color: var(--p-text-secondary); margin-bottom: 28px;
  max-width: 520px;
}
.p-showcase__cta {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--p-font-body); font-size: 14px; font-weight: 700;
  background: var(--p-blue-pale); border: 1.5px solid var(--p-blue-light);
  padding: 11px 20px; border-radius: 10px;
  cursor: pointer; transition: all 0.2s ease;
}
.p-showcase__cta:hover {
  gap: 12px; border-color: var(--p-blue);
  background: #fff;
  box-shadow: 0 4px 12px -4px rgba(0,119,215,0.2);
}

/* Showcase Mock UI */
.p-showcase__mock {
  border-radius: var(--p-radius-lg); overflow: hidden;
  border: 1px solid var(--p-border);
  box-shadow: var(--p-shadow-md);
  background: var(--p-bg);
  transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s;
}
.p-showcase__card:hover .p-showcase__mock {
  transform: translateY(-4px);
  box-shadow: var(--p-shadow-lg);
}
.p-showcase__mock-header {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: var(--p-bg-cool);
  border-bottom: 1px solid var(--p-border-light);
  font-size: 12px; color: var(--p-text-muted); font-weight: 500;
}
.p-showcase__mock-dots { display: flex; gap: 5px; }
.p-showcase__mock-dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--p-border); }
.p-showcase__mock-body { display: flex; min-height: 180px; }
.p-showcase__mock-sidebar {
  width: 120px; border-right: 1px solid var(--p-border-light);
  padding: 8px; flex-shrink: 0;
}
.p-showcase__mock-nav-item {
  font-size: 11px; padding: 6px 8px; border-radius: 4px; color: var(--p-text-muted);
  margin-bottom: 2px; font-weight: 500; cursor: default;
}
.p-showcase__mock-nav-item--active {
  background: var(--p-blue-light); color: var(--p-blue); font-weight: 600;
}
.p-showcase__mock-main { flex: 1; padding: 12px 16px; }
.p-showcase__mock-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--p-border-light);
}
.p-showcase__mock-row:last-child { border-bottom: none; }
.p-showcase__mock-label { font-size: 12px; color: var(--p-text-muted); font-weight: 500; }
.p-showcase__mock-value { font-size: 12px; color: var(--p-text); font-weight: 600; font-family: var(--p-font-mono); }

/* Showcase Photo Visuals */
.p-showcase__visual-wrap {
  border-radius: var(--p-radius-lg); overflow: hidden;
  box-shadow: var(--p-shadow-md); position: relative;
  transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s;
}
.p-showcase__card:hover .p-showcase__visual-wrap {
  transform: translateY(-4px); box-shadow: var(--p-shadow-lg);
}
.p-showcase__photo {
  width: 100%; height: 300px; object-fit: cover; display: block;
  transition: transform 0.6s cubic-bezier(0.16,1,0.3,1);
}
.p-showcase__visual-wrap:hover .p-showcase__photo { transform: scale(1.03); }
.p-showcase__photo-caption {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px; color: #fff;
  background: linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%);
  font-size: 13px; line-height: 1.5;
}
.p-showcase__photo-caption span {
  font-weight: 700; font-size: 14px;
}

@media (max-width: 860px) {
  .p-showcase__card { grid-template-columns: 1fr; gap: 36px; padding: 40px 0; }
  .p-showcase__card--reverse .p-showcase__content { order: 1; }
  .p-showcase__card--reverse .p-showcase__visual { order: 2; }
  .p-showcase__photo { height: 260px; }
}

/* ── Technology ── */
.p-tech { padding: var(--p-section-pad) 0; background: var(--p-bg-warm); }
.p-tech__grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  margin-bottom: 56px;
}
.p-tech__card {
  background: #fff; border-radius: var(--p-radius-lg); padding: 28px;
  border: 1px solid var(--p-border-light);
  box-shadow: var(--p-shadow-xs);
  transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease;
}
.p-tech__card:hover { border-color: rgba(0,119,215,0.3); box-shadow: var(--p-shadow-md); transform: translateY(-3px); }
.p-tech__card-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--p-blue-light); color: var(--p-blue);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
}
.p-tech__card-name { font-family: var(--p-font-body); font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--p-text); }
.p-tech__card-desc { font-size: 13px; color: var(--p-text-muted); line-height: 1.55; }
@media (max-width: 820px) { .p-tech__grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 520px) { .p-tech__grid { grid-template-columns: 1fr; } }

/* Architecture Diagram */
.p-tech__arch {
  border-radius: var(--p-radius-lg); overflow: hidden;
  border: 1px solid var(--p-border); background: var(--p-bg);
  box-shadow: var(--p-shadow-sm);
}
.p-tech__arch-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px; background: var(--p-bg-cool);
  border-bottom: 1px solid var(--p-border-light);
  font-size: 13px; font-weight: 600; color: var(--p-text-secondary);
}
.p-tech__arch-dots { display: flex; gap: 5px; }
.p-tech__arch-dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--p-border); }
.p-tech__arch-body { padding: 32px; }
.p-tech__arch-layer {
  background: var(--p-bg-cool); border-radius: var(--p-radius); padding: 20px 24px;
  border: 1px solid var(--p-border-light);
}
.p-tech__arch-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--p-blue); margin-bottom: 12px;
}
.p-tech__arch-items { display: flex; flex-wrap: wrap; gap: 8px; }
.p-tech__arch-items span {
  font-size: 13px; font-weight: 500; color: var(--p-text);
  padding: 6px 14px; background: var(--p-bg); border-radius: 100px;
  border: 1px solid var(--p-border-light);
}
.p-tech__arch-connector {
  display: flex; align-items: center; gap: 12px; padding: 16px 0;
}
.p-tech__arch-connector span {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--p-text-muted); white-space: nowrap;
}
.p-tech__arch-line { flex: 1; height: 1px; background: var(--p-border); }

/* ── Interoperability ── */
.p-interop { padding: var(--p-section-pad) 0; background: var(--p-bg); }
.p-interop__grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  margin-bottom: 48px;
}
.p-interop__card {
  display: flex; gap: 18px; align-items: flex-start;
  background: var(--p-bg-warm); border-radius: var(--p-radius-lg); padding: 26px;
  border: 1px solid var(--p-border-light);
  transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease;
}
.p-interop__card:hover { border-color: rgba(0,119,215,0.3); box-shadow: var(--p-shadow-md); transform: translateY(-3px); background: #fff; }
.p-interop__card-icon-wrap {
  width: 40px; height: 40px; border-radius: 10px;
  background: var(--p-blue-light); color: var(--p-blue);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.p-interop__card-badge {
  display: inline-block; font-size: 13px; font-weight: 700;
  color: var(--p-blue); margin-bottom: 6px;
}
.p-interop__card-desc { font-size: 14px; line-height: 1.7; color: var(--p-text-secondary); }

.p-interop__cta-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
}
.p-interop__cta-card {
  display: flex; gap: 16px; padding: 24px;
  background: var(--p-blue-pale); border-radius: var(--p-radius-lg);
  border: 1px solid rgba(0,119,215,0.12);
  color: var(--p-blue);
}
.p-interop__cta-card h4 { font-size: 15px; font-weight: 700; color: var(--p-text); margin-bottom: 4px; }
.p-interop__cta-card p { font-size: 13px; color: var(--p-text-secondary); line-height: 1.6; }
@media (max-width: 960px) {
  .p-interop__grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .p-interop__grid { grid-template-columns: 1fr; }
  .p-interop__cta-row { grid-template-columns: 1fr; }
}

/* ── Features Deep Dive ── */
.p-features { padding: var(--p-section-pad) 0; background: var(--p-bg-section); }
.p-features__grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;
  align-items: start;
}
.p-features__card {
  background: #fff; border-radius: var(--p-radius-lg); padding: 28px;
  border: 1px solid var(--p-border-light); cursor: pointer;
  box-shadow: var(--p-shadow-xs);
  transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease;
}
.p-features__card:hover { border-color: rgba(0,119,215,0.3); box-shadow: var(--p-shadow-md); transform: translateY(-3px); }
.p-features__card--expanded { border-color: var(--p-blue); box-shadow: var(--p-shadow-md); }
.p-features__card-header {
  display: flex; align-items: center; gap: 14px; margin-bottom: 12px;
}
.p-features__card-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.p-features__card-title {
  font-family: var(--p-font-body); font-size: 15px; font-weight: 700;
  color: var(--p-text); flex: 1;
}
.p-features__card-chevron {
  color: var(--p-text-muted); transition: transform 0.3s ease; flex-shrink: 0;
}
.p-features__card-desc {
  font-size: 14px; line-height: 1.7; color: var(--p-text-secondary);
}
.p-features__card-list {
  list-style: none; margin-top: 16px; padding-top: 16px;
  border-top: 1px solid var(--p-border-light);
  display: grid; gap: 8px;
  animation: pFadeIn 0.3s ease;
}
.p-features__card-list li {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: var(--p-text);
}
.p-features__more {
  text-align: center; margin-top: 48px; padding-top: 40px;
  border-top: 1px solid var(--p-border-light);
}
.p-features__more p { font-size: 15px; color: var(--p-text-secondary); margin-bottom: 20px; }
.p-features__more strong { color: var(--p-blue); }
@media (max-width: 700px) { .p-features__grid { grid-template-columns: 1fr; } }

/* ── Releases ── */
.p-releases { padding: var(--p-section-pad) 0; background: var(--p-bg); }
.p-releases__timeline { max-width: 640px; margin: 0 auto; }
.p-releases__item { display: flex; gap: 24px; }
.p-releases__item-marker {
  display: flex; flex-direction: column; align-items: center; flex-shrink: 0;
  padding-top: 6px;
}
.p-releases__item-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--p-blue); border: 3px solid var(--p-blue-light);
  flex-shrink: 0;
}
.p-releases__item-line {
  width: 2px; flex: 1; background: var(--p-border-light); margin: 8px 0;
}
.p-releases__item-content { padding-bottom: 40px; flex: 1; }
.p-releases__item-meta { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
.p-releases__item-version {
  font-family: var(--p-font-mono); font-size: 13px; font-weight: 600;
  color: var(--p-blue); background: var(--p-blue-light);
  padding: 3px 10px; border-radius: 100px;
}
.p-releases__item-date { font-size: 13px; color: var(--p-text-muted); }
.p-releases__item-title { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.p-releases__item-highlights {
  list-style: none; display: flex; flex-direction: column; gap: 4px;
}
.p-releases__item-highlights li {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--p-text-secondary);
}
.p-releases__item-highlights li svg { color: var(--p-blue); flex-shrink: 0; }

/* ── Roadmap ── */
.p-roadmap { padding: var(--p-section-pad) 0; background: var(--p-bg-warm); }
.p-roadmap__columns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.p-roadmap__column {
  border-radius: var(--p-radius-lg); overflow: hidden;
  border: 1px solid var(--p-border-light); background: var(--p-bg);
}
.p-roadmap__column-header {
  padding: 14px 20px; font-size: 13px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.p-roadmap__column-header--done { background: #E8F8EE; color: #10B944; }
.p-roadmap__column-header--now { background: var(--p-blue-light); color: var(--p-blue); }
.p-roadmap__column-header--next { background: #FFF8E6; color: #D4A843; }
.p-roadmap__column-body { padding: 16px; }
.p-roadmap__item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--p-radius);
  font-size: 14px; font-weight: 500; color: var(--p-text);
  border-bottom: 1px solid var(--p-border-light);
  transition: background 0.15s;
}
.p-roadmap__item:last-child { border-bottom: none; }
.p-roadmap__item:hover { background: var(--p-bg-cool); }
.p-roadmap__item-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.p-roadmap__item-dot--done { background: #10B944; }
.p-roadmap__item-dot--now { background: var(--p-blue); }
.p-roadmap__item-dot--next { background: #D4A843; }
@media (max-width: 700px) { .p-roadmap__columns { grid-template-columns: 1fr; } }

/* ── Tour ── */
.p-tour { padding: var(--p-section-pad) 0; background: var(--p-bg); }
.p-tour__grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
  margin-bottom: 56px;
}
.p-tour__card {
  text-align: center; padding: 32px 20px; border-radius: var(--p-radius-lg);
  border: 1px solid var(--p-border-light); background: var(--p-bg);
  transition: all 0.25s; cursor: pointer;
}
.p-tour__card:hover { border-color: var(--p-blue); box-shadow: var(--p-shadow-md); transform: translateY(-3px); }
.p-tour__card-icon {
  width: 52px; height: 52px; border-radius: 14px;
  background: var(--p-bg-cool); color: var(--p-text-muted);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px; transition: all 0.3s;
}
.p-tour__card-icon--active { background: var(--p-blue); color: #fff; }
.p-tour__card-label { font-size: 14px; font-weight: 700; margin-bottom: 4px; color: var(--p-text); }
.p-tour__card-desc { font-size: 12px; color: var(--p-text-muted); }
@media (max-width: 700px) { .p-tour__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .p-tour__grid { grid-template-columns: 1fr; } }

.p-tour__cta {
  text-align: center; padding: 56px 32px; border-radius: var(--p-radius-xl);
  background: linear-gradient(135deg, var(--p-blue-pale) 0%, var(--p-blue-light) 100%);
  border: 1px solid var(--p-blue-light);
  box-shadow: var(--p-shadow-sm);
}
.p-tour__cta h3 {
  font-family: var(--p-font-display); font-size: 26px; font-weight: 700;
  margin-bottom: 10px; color: var(--p-text); letter-spacing: -0.015em;
}
.p-tour__cta p { font-size: 15px; color: var(--p-text-secondary); margin-bottom: 28px; }

/* ── Final CTA ── */
.p-final-cta { padding: 0 0 96px; }
.p-final-cta__inner {
  text-align: center; padding: 88px 48px; border-radius: var(--p-radius-xl);
  background: linear-gradient(135deg, var(--p-blue) 0%, var(--p-blue-mid) 100%);
  position: relative; overflow: hidden;
  box-shadow: 0 30px 80px -30px rgba(0,119,215,0.45);
}
.p-final-cta__inner::before {
  content: ''; position: absolute; inset: 0;
  background:
    radial-gradient(circle 400px at 15% 20%, rgba(255,255,255,0.12) 0%, transparent 50%),
    radial-gradient(circle 500px at 85% 80%, rgba(255,255,255,0.08) 0%, transparent 50%);
  pointer-events: none;
}
.p-final-cta__inner > * { position: relative; z-index: 1; }
.p-final-cta__inner h2 {
  font-family: var(--p-font-display); font-size: clamp(28px, 4vw, 40px);
  font-weight: 700; line-height: 1.15; color: #fff; margin-bottom: 16px;
}
.p-final-cta__inner p {
  font-size: 16px; color: rgba(255,255,255,0.7); max-width: 480px;
  margin: 0 auto 32px; line-height: 1.7;
}
.p-final-cta__buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

/* ── Footer ── */
.p-footer {
  background: #211F1D; padding: 64px 0 32px; color: rgba(255,255,255,0.5);
}
.p-footer__grid {
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px;
  margin-bottom: 48px;
}
.p-footer__brand { max-width: 300px; }
.p-footer__tagline { font-size: 14px; line-height: 1.7; }
.p-footer__col h4 {
  font-family: var(--p-font-display); font-size: 13px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.8); margin-bottom: 16px;
}
.p-footer__col a, .p-footer__col button {
  display: block; font-size: 14px; color: rgba(255,255,255,0.4);
  padding: 4px 0; text-decoration: none; background: none; border: none;
  font-family: var(--p-font-body); cursor: pointer; text-align: left;
  transition: color 0.15s;
}
.p-footer__col a:hover, .p-footer__col button:hover { color: rgba(255,255,255,0.9); }
.p-footer__contact {
  display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0;
}
.p-footer__bottom {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px; font-size: 13px;
}
.p-footer__badges { display: flex; gap: 16px; }
.p-footer__badges span {
  display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500;
  color: rgba(255,255,255,0.3);
}
@media (max-width: 800px) {
  .p-footer__grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .p-footer__bottom { flex-direction: column; gap: 16px; text-align: center; }
}
@media (max-width: 500px) { .p-footer__grid { grid-template-columns: 1fr; } }

/* ── Animations ── */
@keyframes pFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
