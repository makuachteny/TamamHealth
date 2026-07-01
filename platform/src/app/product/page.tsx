"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  Users, Brain, Activity, Baby, ArrowRight,
  Check, ChevronDown, Mail, MapPin, Globe, Lock, Database,
  Video, Calendar, BarChart3, Menu, X, Shield, Stethoscope,
  Pill, FlaskConical, FileText, Network, Layers, Code2,
  Server, Cpu, MonitorSmartphone, Languages,
  GitBranch,
} from "@/components/icons/lucide";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Main Landing Page
   Aesthetic: clean clinical editorial, deep blue accents,
   IBM Plex Sans, generous whitespace, section cards with real imagery
   ═══════════════════════════════════════════════════════════════════ */

function Reveal({ children }: { children: ReactNode; delay?: number }) {
  return <div>{children}</div>;
}

function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  return <span>{prefix}{end.toLocaleString()}{suffix}</span>;
}

// ─── DATA ───────────────────────────────────────────────────────

const HERO_STATS = [
  { value: 90, suffix: "+", label: "product.stat.featuresLabel", sub: "product.stat.featuresSub" },
  { value: 11, suffix: ".4M", label: "product.stat.peopleLabel", sub: "product.stat.peopleSub" },
  { value: 8, suffix: "+", label: "product.stat.modulesLabel", sub: "product.stat.modulesSub" },
  { value: 4, suffix: "+", label: "product.stat.releasesLabel", sub: "product.stat.releasesSub" },
];

const FEATURE_CATEGORIES = [
  {
    title: "product.feature.configurableTitle",
    icon: Stethoscope,
    color: "#2191D0",
    desc: "product.feature.configurableDesc",
    highlights: ["product.feature.configurableH1", "product.feature.configurableH2", "product.feature.configurableH3", "product.feature.configurableH4"],
  },
  {
    title: "product.feature.documentationTitle",
    icon: FileText,
    color: "#1d4ed8",
    desc: "product.feature.documentationDesc",
    highlights: ["product.feature.documentationH1", "product.feature.documentationH2", "product.feature.documentationH3", "product.feature.documentationH4"],
  },
  {
    title: "product.feature.registrationTitle",
    icon: Calendar,
    color: "#1E3A8A",
    desc: "product.feature.registrationDesc",
    highlights: ["product.feature.registrationH1", "product.feature.registrationH2", "product.feature.registrationH3", "product.feature.registrationH4"],
  },
  {
    title: "product.feature.interopTitle",
    icon: Network,
    color: "#2191D0",
    desc: "product.feature.interopDesc",
    highlights: ["product.feature.interopH1", "product.feature.interopH2", "product.feature.interopH3", "product.feature.interopH4"],
  },
  {
    title: "product.feature.privilegesTitle",
    icon: Lock,
    color: "#1d4ed8",
    desc: "product.feature.privilegesDesc",
    highlights: ["product.feature.privilegesH1", "product.feature.privilegesH2", "product.feature.privilegesH3", "product.feature.privilegesH4"],
  },
  {
    title: "product.feature.translationTitle",
    icon: Languages,
    color: "#1E3A8A",
    desc: "product.feature.translationDesc",
    highlights: ["product.feature.translationH1", "product.feature.translationH2", "product.feature.translationH3", "product.feature.translationH4"],
  },
  {
    title: "product.feature.reportingTitle",
    icon: BarChart3,
    color: "#2191D0",
    desc: "product.feature.reportingDesc",
    highlights: ["product.feature.reportingH1", "product.feature.reportingH2", "product.feature.reportingH3", "product.feature.reportingH4"],
  },
  {
    title: "product.feature.aiTitle",
    icon: Brain,
    color: "#1d4ed8",
    desc: "product.feature.aiDesc",
    highlights: ["product.feature.aiH1", "product.feature.aiH2", "product.feature.aiH3", "product.feature.aiH4"],
  },
];

const SHOWCASE_SECTIONS = [
  {
    eyebrow: "product.showcase.featuresEyebrow",
    title: "product.showcase.featuresTitle",
    desc: "product.showcase.featuresDesc",
    cta: "product.showcase.featuresCta",
    ctaId: "features",
    visual: "features",
    color: "#2191D0",
  },
  {
    eyebrow: "product.showcase.roadmapEyebrow",
    title: "product.showcase.roadmapTitle",
    desc: "product.showcase.roadmapDesc",
    cta: "product.showcase.roadmapCta",
    ctaId: "roadmap",
    visual: "roadmap",
    color: "#1d4ed8",
  },
  {
    eyebrow: "product.showcase.releasesEyebrow",
    title: "product.showcase.releasesTitle",
    desc: "product.showcase.releasesDesc",
    cta: "product.showcase.releasesCta",
    ctaId: "releases",
    visual: "releases",
    color: "#1E3A8A",
  },
  {
    eyebrow: "product.showcase.deployEyebrow",
    title: "product.showcase.deployTitle",
    desc: "product.showcase.deployDesc",
    cta: "product.showcase.deployCta",
    ctaHref: "/login",
    visual: "download",
    color: "#2191D0",
  },
];

const TECH_STACK = [
  { name: "React / Next.js", desc: "product.tech.reactDesc", icon: Code2 },
  { name: "TypeScript", desc: "product.tech.typescriptDesc", icon: Layers },
  { name: "PouchDB / CouchDB", desc: "product.tech.pouchdbDesc", icon: Database },
  { name: "PostgreSQL", desc: "product.tech.postgresDesc", icon: Server },
  { name: "Tailwind CSS", desc: "product.tech.tailwindDesc", icon: MonitorSmartphone },
  { name: "Claude AI", desc: "product.tech.claudeDesc", icon: Cpu },
];

const INTEROP_ITEMS = [
  { name: "DHIS2", desc: "product.interop.dhis2Desc", icon: Globe },
  { name: "FHIR-Ready", desc: "product.interop.fhirDesc", icon: GitBranch },
  { name: "WHO Standards", desc: "product.interop.whoDesc", icon: Shield },
  { name: "Lab Systems", desc: "product.interop.labDesc", icon: FlaskConical },
  { name: "National ID", desc: "product.interop.nationalIdDesc", icon: Users },
  { name: "REST API", desc: "product.interop.restApiDesc", icon: Server },
];

const RELEASES = [
  { version: "v2.4", date: "March 2026", title: "product.release.v24Title", highlights: ["product.release.v24H1", "product.release.v24H2", "product.release.v24H3"] },
  { version: "v2.3", date: "January 2026", title: "product.release.v23Title", highlights: ["product.release.v23H1", "product.release.v23H2", "product.release.v23H3"] },
  { version: "v2.2", date: "November 2025", title: "product.release.v22Title", highlights: ["product.release.v22H1", "product.release.v22H2", "product.release.v22H3"] },
  { version: "v2.1", date: "September 2025", title: "product.release.v21Title", highlights: ["product.release.v21H1", "product.release.v21H2", "product.release.v21H3"] },
];

const ROADMAP_ITEMS = [
  { status: "done", label: "product.roadmap.doneLabel", items: ["product.roadmap.done1", "product.roadmap.done2", "product.roadmap.done3", "product.roadmap.done4", "product.roadmap.done5", "product.roadmap.done6"] },
  { status: "now", label: "product.roadmap.nowLabel", items: ["product.roadmap.now1", "product.roadmap.now2", "product.roadmap.now3", "product.roadmap.now4", "product.roadmap.now5"] },
  { status: "next", label: "product.roadmap.nextLabel", items: ["product.roadmap.next1", "product.roadmap.next2", "product.roadmap.next3", "product.roadmap.next4", "product.roadmap.next5", "product.roadmap.next6"] },
];

const TOUR_FEATURES = [
  { icon: Users, label: "product.tour.registryLabel", desc: "product.tour.registryDesc" },
  { icon: Stethoscope, label: "product.tour.notesLabel", desc: "product.tour.notesDesc" },
  { icon: FlaskConical, label: "product.tour.labLabel", desc: "product.tour.labDesc" },
  { icon: Pill, label: "product.tour.pharmacyLabel", desc: "product.tour.pharmacyDesc" },
  { icon: Calendar, label: "product.tour.appointmentsLabel", desc: "product.tour.appointmentsDesc" },
  { icon: Activity, label: "product.tour.surveillanceLabel", desc: "product.tour.surveillanceDesc" },
  { icon: Baby, label: "product.tour.crvsLabel", desc: "product.tour.crvsDesc" },
  { icon: Video, label: "product.tour.telehealthLabel", desc: "product.tour.telehealthDesc" },
];

// ─── MAIN PAGE COMPONENT ────────────────────────────────────────

export default function ProductPage() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
    setMobileNav(false);
    setOpenDropdown(null);
  };

  const PRODUCTS_ITEMS = [
    { label: "Features", action: () => scrollTo("features") },
    { label: "Technology", action: () => scrollTo("technology") },
    { label: "Interoperability", action: () => scrollTo("interoperability") },
    { label: "Roadmap", action: () => scrollTo("roadmap") },
  ];

  const COMPANY_ITEMS = [
    { label: "About Us", href: "/product" },
    { label: "Careers", href: "/product" },
    { label: "Contact", action: () => scrollTo("tour") },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: productCSS }} />

      {/* ════════ HEADER ════════ */}
      <header className={`p-header ${scrolled ? "p-header--scrolled" : ""}`} onClick={() => setOpenDropdown(null)}>
        <div className="p-container p-header__inner">
          <Link href="/" className="p-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logos/SVG/Tamam_Style_Guide-21.svg" alt="TamamHealth" style={{ height: 28, width: 'auto' }} />
          </Link>

          <nav className="p-nav" onClick={(e) => e.stopPropagation()}>
            {/* HOME */}
            <Link href="/product" className="p-nav__link p-nav__link--active">Home</Link>

            {/* PRODUCTS ▼ */}
            <div className="p-nav__dropdown-wrap" style={{ position: 'relative' }}>
              <button
                className="p-nav__link p-nav__link--has-arrow"
                onClick={() => setOpenDropdown(openDropdown === 'products' ? null : 'products')}
              >
                Products <ChevronDown size={13} style={{ marginLeft: 3, opacity: 0.7 }} />
              </button>
              {openDropdown === 'products' && (
                <div className="p-nav__dropdown">
                  {PRODUCTS_ITEMS.map(item => (
                    <button key={item.label} className="p-nav__dropdown-item" onClick={item.action}>{item.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* TESTIMONIALS */}
            <button className="p-nav__link" onClick={() => scrollTo("tour")}>Testimonials</button>

            {/* COMPANY ▼ */}
            <div className="p-nav__dropdown-wrap" style={{ position: 'relative' }}>
              <button
                className="p-nav__link p-nav__link--has-arrow"
                onClick={() => setOpenDropdown(openDropdown === 'company' ? null : 'company')}
              >
                Company <ChevronDown size={13} style={{ marginLeft: 3, opacity: 0.7 }} />
              </button>
              {openDropdown === 'company' && (
                <div className="p-nav__dropdown">
                  {COMPANY_ITEMS.map(item => (
                    item.href
                      ? <Link key={item.label} href={item.href} className="p-nav__dropdown-item" onClick={() => setOpenDropdown(null)}>{item.label}</Link>
                      : <button key={item.label} className="p-nav__dropdown-item" onClick={item.action}>{item.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* PRICING */}
            <button className="p-nav__link" onClick={() => scrollTo("releases")}>Pricing</button>

            {/* CAREERS */}
            <Link href="/product" className="p-nav__link">Careers</Link>

            {/* CONTACT */}
            <button className="p-nav__link" onClick={() => scrollTo("tour")}>Contact</button>
          </nav>

          <div className="p-header__actions">
            <a href="tel:+15550001234" className="p-nav__phone">
              +1 (555) 000-1234
            </a>
            <Link href="/login" className="p-btn p-btn--demo">
              Request Demo
            </Link>
          </div>

          <button className="p-mobile-toggle" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileNav && (
          <div className="p-mobile-nav">
            <Link href="/product" className="p-mobile-nav__link">Home</Link>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("features")}>Products</button>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("tour")}>Testimonials</button>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("technology")}>Company</button>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("releases")}>Pricing</button>
            <Link href="/product" className="p-mobile-nav__link">Careers</Link>
            <button className="p-mobile-nav__link" onClick={() => scrollTo("tour")}>Contact</button>
            <div className="p-mobile-nav__actions">
              <a href="tel:+15550001234" className="p-btn p-btn--outline" style={{ width: "100%", textAlign: 'center' }}>+1 (555) 000-1234</a>
              <Link href="/login" className="p-btn p-btn--demo" style={{ width: "100%", textAlign: 'center' }}>
                Request Demo
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="p-main">

        {/* ════════ HERO — split layout ════════ */}
        <section className="p-hero" id="home">
          <div className="p-container">
            <div className="p-hero__split">

              {/* Left: hero image */}
              <Reveal delay={0.05}>
                <div className="p-hero__img-col">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/patients/doctor-tablet-smiling.jpg"
                    alt="Doctor using TamamHealth on a tablet"
                    className="p-hero__photo"
                  />
                </div>
              </Reveal>

              {/* Right: content */}
              <div className="p-hero__content-col">
                <Reveal delay={0.08}>
                  <span className="p-eyebrow" style={{ marginBottom: 20 }}>
                    Electronic Health Records · Built for Africa
                  </span>
                  <h1 className="p-hero__title">
                    Digital health platform<br />
                    <span className="p-hero__title--accent">for Africa&apos;s frontline clinics</span>
                  </h1>
                </Reveal>

                <Reveal delay={0.13}>
                  <p className="p-hero__sub">
                    We empower hospitals and clinics to deliver better patient care — offline-first,
                    multilingual, and purpose-built for South Sudan&apos;s healthcare realities.
                  </p>
                </Reveal>

                {/* Stat row */}
                <Reveal delay={0.18}>
                  <div className="p-hero__stat-row">
                    <div className="p-hero__stat-item">
                      <span className="p-hero__stat-num"><Counter end={90} suffix="+" /></span>
                      <span className="p-hero__stat-label">Clinical features<br />built and shipped</span>
                    </div>
                    <div className="p-hero__stat-divider" />
                    <div className="p-hero__stat-item">
                      <span className="p-hero__stat-num"><Counter end={11} suffix=".4M+" /></span>
                      <span className="p-hero__stat-label">People in our<br />service regions</span>
                    </div>
                  </div>
                </Reveal>

                <Reveal delay={0.23}>
                  <Link href="/login" className="p-btn p-btn--demo p-btn--hero-cta">
                    Request Demo &raquo;
                  </Link>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ════════ RECOGNITION / IMPACT ════════ */}
        <section className="p-recognition" id="recognition">
          <div className="p-container">
            <Reveal>
              <h2 className="p-recognition__headline">
                TamamHealth: End-to-End Clinical Workflow<br />in One Integrated Platform
              </h2>
            </Reveal>
            <div className="p-recognition__split">
              <Reveal delay={0.05}>
                <div className="p-recognition__content">
                  <p>
                    TamamHealth is the first purpose-built EHR system designed for hospitals and
                    clinics operating in South Sudan&apos;s complex environment — supporting every
                    role from reception and triage to clinical consultation, pharmacy, lab, and billing.
                  </p>
                  <p style={{ marginTop: 16 }}>
                    Built offline-first with multilingual support across <strong>15+ languages</strong>,
                    the platform keeps care running even without internet — with automatic sync
                    when connectivity returns.
                  </p>
                  <Link href="/login" className="p-btn p-btn--demo" style={{ marginTop: 28 }}>
                    Read more &raquo;
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="p-recognition__image-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/patients/doctor-nurse-consultation.jpg" alt="Clinical team using TamamHealth" className="p-recognition__photo" />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ════════ SHOWCASE CARDS (Features/Roadmap/Releases/Download) ════════ */}
        <section className="p-showcase">
          <div className="p-container">
            {SHOWCASE_SECTIONS.map((s, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className={`p-showcase__card ${i % 2 !== 0 ? "p-showcase__card--reverse" : ""}`}>
                  <div className="p-showcase__content">
                    <span className="p-showcase__eyebrow" style={{ color: s.color }}>{t(s.eyebrow)}</span>
                    <h2 className="p-showcase__title">{t(s.title)}</h2>
                    <p className="p-showcase__desc">{t(s.desc)}</p>
                    <button
                      className="p-showcase__cta"
                      style={{ color: s.color }}
                      onClick={() => s.ctaId ? scrollTo(s.ctaId) : (s.ctaHref && (window.location.href = s.ctaHref))}
                    >
                      {t(s.cta)} <ArrowRight size={16} />
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
                <span className="p-eyebrow">{t("product.tech.eyebrow")}</span>
                <h2 className="p-section-title">{t("product.tech.title")}</h2>
                <p className="p-section-desc">
                  {t("product.tech.desc")}
                </p>
              </div>
            </Reveal>
            <div className="p-tech__grid">
              {TECH_STACK.map((techItem, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="p-tech__card">
                    <div className="p-tech__card-icon"><techItem.icon size={22} /></div>
                    <h3 className="p-tech__card-name">{techItem.name}</h3>
                    <p className="p-tech__card-desc">{t(techItem.desc)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <div className="p-tech__arch">
                <div className="p-tech__arch-header">
                  <div className="p-tech__arch-dots"><span /><span /><span /></div>
                  <span>{t("product.tech.archHeader")}</span>
                </div>
                <div className="p-tech__arch-body">
                  <div className="p-tech__arch-layer">
                    <div className="p-tech__arch-label">{t("product.tech.archFrontend")}</div>
                    <div className="p-tech__arch-items">
                      <span>React / Next.js</span><span>TypeScript</span><span>Tailwind CSS</span><span>PouchDB</span>
                    </div>
                  </div>
                  <div className="p-tech__arch-connector">
                    <div className="p-tech__arch-line" />
                    <span>{t("product.tech.archRestSync")}</span>
                    <div className="p-tech__arch-line" />
                  </div>
                  <div className="p-tech__arch-layer">
                    <div className="p-tech__arch-label">{t("product.tech.archBackend")}</div>
                    <div className="p-tech__arch-items">
                      <span>Node.js / Next.js API</span><span>JWT Auth</span><span>CouchDB Sync</span><span>Claude AI</span>
                    </div>
                  </div>
                  <div className="p-tech__arch-connector">
                    <div className="p-tech__arch-line" />
                    <span>{t("product.tech.archDataLayer")}</span>
                    <div className="p-tech__arch-line" />
                  </div>
                  <div className="p-tech__arch-layer">
                    <div className="p-tech__arch-label">{t("product.tech.archDatabase")}</div>
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
                <span className="p-eyebrow">{t("product.interop.eyebrow")}</span>
                <h2 className="p-section-title">{t("product.interop.title")}</h2>
                <p className="p-section-desc">
                  {t("product.interop.desc")}
                </p>
              </div>
            </Reveal>
            <div className="p-interop__grid">
              {INTEROP_ITEMS.map((item, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="p-interop__card">
                    <div className="p-interop__card-icon-wrap">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <div className="p-interop__card-badge">{item.name}</div>
                      <p className="p-interop__card-desc">{t(item.desc)}</p>
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
                    <h4>{t("product.interop.dhis2CompatibleTitle")}</h4>
                    <p>{t("product.interop.dhis2CompatibleDesc")}</p>
                  </div>
                </div>
                <div className="p-interop__cta-card">
                  <Shield size={34} />
                  <div>
                    <h4>{t("product.interop.fhirAlignedTitle")}</h4>
                    <p>{t("product.interop.fhirAlignedDesc")}</p>
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
                <span className="p-eyebrow">{t("product.features.eyebrow")}</span>
                <h2 className="p-section-title">{t("product.features.title")}</h2>
                <p className="p-section-desc">{t("product.features.desc")}</p>
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
                        <f.icon size={20} />
                      </div>
                      <h3 className="p-features__card-title">{t(f.title)}</h3>
                      <ChevronDown
                        size={16}
                        className="p-features__card-chevron"
                        style={{ transform: expandedFeature === i ? "rotate(180deg)" : "rotate(0)" }}
                      />
                    </div>
                    <p className="p-features__card-desc">{t(f.desc)}</p>
                    {expandedFeature === i && (
                      <ul className="p-features__card-list">
                        {f.highlights.map((h, j) => (
                          <li key={j}><Check size={14} style={{ color: f.color }} /> {t(h)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <div className="p-features__more">
                <p>{t("product.features.morePrefix")} <strong>{t("product.features.moreCount")}</strong> {t("product.features.moreSuffix")}</p>
                <button className="p-btn p-btn--outline" onClick={() => scrollTo("tour")}>
                  {t("product.features.takeTour")} <ArrowRight size={14} />
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
                <span className="p-eyebrow">{t("product.releases.eyebrow")}</span>
                <h2 className="p-section-title">{t("product.releases.title")}</h2>
                <p className="p-section-desc">{t("product.releases.desc")}</p>
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
                      <h3 className="p-releases__item-title">{t(r.title)}</h3>
                      <ul className="p-releases__item-highlights">
                        {r.highlights.map((h, j) => (
                          <li key={j}><Check size={12} /> {t(h)}</li>
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
                <span className="p-eyebrow">{t("product.roadmap.eyebrow")}</span>
                <h2 className="p-section-title">{t("product.roadmap.title")}</h2>
                <p className="p-section-desc">{t("product.roadmap.desc")}</p>
              </div>
            </Reveal>
            <div className="p-roadmap__columns">
              {ROADMAP_ITEMS.map((col, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <div className="p-roadmap__column">
                    <div className={`p-roadmap__column-header p-roadmap__column-header--${col.status}`}>
                      {t(col.label)}
                    </div>
                    <div className="p-roadmap__column-body">
                      {col.items.map((item, j) => (
                        <div key={j} className="p-roadmap__item">
                          <div className={`p-roadmap__item-dot p-roadmap__item-dot--${col.status}`} />
                          {t(item)}
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
                <span className="p-eyebrow">{t("product.tour.eyebrow")}</span>
                <h2 className="p-section-title">{t("product.tour.title")}</h2>
              </div>
            </Reveal>
            <div className="p-tour__grid">
              {TOUR_FEATURES.map((f, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className="p-tour__card">
                    <div className="p-tour__card-icon">
                      <f.icon size={22} />
                    </div>
                    <h4 className="p-tour__card-label">{t(f.label)}</h4>
                    <p className="p-tour__card-desc">{t(f.desc)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <div className="p-tour__cta">
                <h3>{t("product.tour.ctaTitle")}</h3>
                <p>{t("product.tour.ctaDesc")}</p>
                <Link href="/login" className="p-btn p-btn--primary p-btn--lg">
                  {t("product.tour.ctaButton")} <ArrowRight size={16} />
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
                <h2>{t("product.finalCta.titleLine1")}<br />{t("product.finalCta.titleLine2")}</h2>
                <p>{t("product.finalCta.desc")}</p>
                <div className="p-final-cta__buttons">
                  <Link href="/login" className="p-btn p-btn--cta">
                    {t("product.finalCta.tryDemo")} <ArrowRight size={16} />
                  </Link>
                  <Link href="/" className="p-btn p-btn--cta-outline">
                    {t("product.finalCta.backHome")}
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
                <img src="/assets/logos/SVG/Tamam_Style_Guide-21.svg" alt="TamamHealth" style={{ height: 24, width: 'auto', filter: 'brightness(0) invert(1)' }} />
              </div>
              <p className="p-footer__tagline">{t("product.footer.tagline")}</p>
            </div>
            <div className="p-footer__col">
              <h4>{t("product.footer.productHeading")}</h4>
              <Link href="/product">{t("product.footer.emrFeatures")}</Link>
              <button onClick={() => scrollTo("technology")}>{t("product.nav.technology")}</button>
              <button onClick={() => scrollTo("roadmap")}>{t("product.nav.roadmap")}</button>
              <button onClick={() => scrollTo("releases")}>{t("product.releases.eyebrow")}</button>
            </div>
            <div className="p-footer__col">
              <h4>{t("product.footer.communityHeading")}</h4>
              <button onClick={() => scrollTo("interoperability")}>{t("product.footer.integrations")}</button>
              <Link href="/">{t("product.footer.getInvolved")}</Link>
              <Link href="/public-stats">{t("landing.footer.publicStats")}</Link>
            </div>
            <div className="p-footer__col">
              <h4>{t("product.footer.aboutHeading")}</h4>
              <Link href="/">{t("product.footer.ourStory")}</Link>
              <Link href="/login">{t("landing.cta.staffSignIn")}</Link>
              <div className="p-footer__contact"><Mail size={14} /> support.tamam@gmail.com</div>
              <div className="p-footer__contact"><MapPin size={14} /> Juba, South Sudan</div>
            </div>
          </div>
          <div className="p-footer__bottom">
            <p>{t("product.footer.copyright", { year: new Date().getFullYear() })}</p>
            <div className="p-footer__badges">
              <span><Shield size={12} /> ISO 13606</span>
              <span><Lock size={12} /> ISO 13131</span>
              <span><Globe size={12} /> {t("product.footer.dhis2Compatible")}</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── SHOWCASE VISUAL COMPONENT ──────────────────────────────────

function ShowcaseVisual({ type }: { type: string }) {
  const { t } = useTranslation();
  if (type === "features") {
    return (
      <div className="p-showcase__visual-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/Dashboard.png" alt={t("product.visual.featuresAlt")} className="p-showcase__photo" />
        <div className="p-showcase__photo-caption">
          <span>{t("product.visual.featuresLabel")}</span> — {t("product.visual.featuresCaption")}
        </div>
      </div>
    );
  }

  if (type === "roadmap") {
    return (
      <div className="p-showcase__visual-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/landing-img.jpg" alt={t("product.visual.roadmapAlt")} className="p-showcase__photo" />
        <div className="p-showcase__photo-caption">
          <span>{t("product.visual.roadmapLabel")}</span> — {t("product.visual.roadmapCaption")}
        </div>
      </div>
    );
  }

  if (type === "releases") {
    return (
      <div className="p-showcase__visual-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/health-data.jpg" alt={t("product.visual.releasesAlt")} className="p-showcase__photo" />
        <div className="p-showcase__photo-caption">
          <span>{t("product.visual.releasesLabel")}</span> — {t("product.visual.releasesCaption")}
        </div>
      </div>
    );
  }

  // download
  return (
    <div className="p-showcase__visual-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/patients/african-nurse.jpg" alt={t("product.visual.downloadAlt")} className="p-showcase__photo" />
      <div className="p-showcase__photo-caption">
        <span>{t("product.visual.downloadLabel")}</span> — {t("product.visual.downloadCaption")}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const productCSS = `
:root {
  --p-blue: #3b82f6;
  --p-blue-hover: #1E40AF;
  --p-blue-dark: #1E3A8A;
  --p-blue-mid: #1d4ed8;
  --p-blue-light: #E8F3FD;
  --p-blue-pale: #F5FAFF;

  --p-text: #1E3A8A;
  --p-text-secondary: #334155;
  --p-text-muted: #64748b;

  --p-bg: #FFFFFF;
  --p-bg-warm: #F2F0EB;
  --p-bg-cool: #F1F5F9;
  --p-bg-section: #F2F0EB;

  --p-border: #D4CFC5;
  --p-border-light: #F1F5F9;

  --p-radius: 8px;
  --p-radius-lg: 14px;
  --p-radius-xl: 20px;

  --p-shadow-xs: none;
  --p-shadow-sm: none;
  --p-shadow-md: none;
  --p-shadow-lg: none;
  --p-shadow-xl: none;

  --p-font-display: var(--font-platform);
  --p-font-body: var(--font-platform);
  --p-font-accent: var(--font-platform);
  --p-font-mono: var(--font-platform-mono);

  --p-section-pad: clamp(56px, 7vh, 88px);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: auto; -webkit-text-size-adjust: 100%; }
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
.p-container { max-width: 1320px; margin: 0 auto; padding: 0 48px; }
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
  transition: background 0.2s ease,
              border-color 0.2s ease,
              color 0.2s ease;
  line-height: 1.2; white-space: nowrap;
}
.p-btn--primary {
  background: var(--p-blue); color: #fff; border-color: var(--p-blue);
}
.p-btn--primary:hover {
  background: var(--p-blue-hover); border-color: var(--p-blue-hover);
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
.p-btn--cta:hover { background: var(--p-blue-pale); }
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
}
.p-header--scrolled {
  padding: 12px 0;
}
.p-header__inner { display: flex; align-items: center; gap: 20px; }
.p-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.p-logo__icon { width: 32px; height: 32px; border-radius: 8px; }
.p-logo__text {
  font-family: var(--p-font-display); font-size: 1.2rem; font-weight: 700;
  letter-spacing: 0.06em; color: var(--p-text);
}
.p-nav { display: flex; gap: 0; margin-left: 16px; align-items: center; }
.p-nav__link {
  background: none; border: none; font-family: var(--p-font-accent); font-size: 13.5px;
  font-weight: 500; color: var(--p-text); padding: 8px 12px;
  cursor: pointer;
  text-decoration: none; border-radius: 8px; letter-spacing: 0;
  text-transform: none;
  display: inline-flex; align-items: center; white-space: nowrap;
}
.p-nav__link--active { color: var(--p-text); font-weight: 600; }
.p-nav__link--has-arrow { gap: 2px; }
.p-nav__dropdown-wrap { position: relative; }
.p-nav__dropdown {
  position: absolute; top: calc(100% + 6px); left: 0;
  background: #fff; border: 1px solid var(--p-border-light);
  border-radius: 12px;
  min-width: 180px; padding: 6px; z-index: 200;
}
.p-nav__dropdown-item {
  display: block; width: 100%; text-align: left; background: none; border: none;
  font-family: var(--p-font-body); font-size: 14px; font-weight: 500;
  color: var(--p-text); padding: 10px 14px; border-radius: 8px;
  cursor: pointer; text-decoration: none;
}
.p-nav__phone {
  font-family: var(--p-font-body); font-size: 13px; font-weight: 600;
  color: var(--p-text); text-decoration: none; padding: 0 8px;
  white-space: nowrap;
}
.p-btn--demo {
  background: var(--p-blue); color: #fff; border: none; border-radius: 999px;
  font-family: var(--p-font-accent); font-size: 13px; font-weight: 600;
  padding: 10px 22px; cursor: pointer; text-decoration: none;
  letter-spacing: 0; text-transform: none; transition: background 0.2s;
  white-space: nowrap;
}
.p-btn--demo:hover { background: #015697; }
.p-header__actions {
  display: flex; gap: 10px; margin-left: auto; align-items: center; flex-shrink: 0;
}
.p-mobile-toggle {
  display: none; background: none; border: none; cursor: pointer;
  padding: 8px; color: var(--p-text); margin-left: auto; border-radius: 8px;
}
.p-mobile-nav {
  display: flex; flex-direction: column; gap: 2px; padding: 20px 24px 24px;
  background: #fff; border-top: 1px solid var(--p-border-light);
}
.p-mobile-nav__link {
  background: none; border: none; font-family: var(--p-font-body); font-size: 15px;
  font-weight: 600; color: var(--p-text); padding: 14px 0; cursor: pointer;
  text-align: left; border-bottom: 1px solid var(--p-border-light); text-decoration: none; display: block;
}
.p-mobile-nav__link--active { color: var(--p-blue); }
.p-mobile-nav__actions {
  display: flex; flex-direction: column; gap: 8px; margin-top: 16px;
}
@media (max-width: 1024px) {
  .p-nav, .p-header__actions { display: none; }
  .p-mobile-toggle { display: block; }
}

/* ── Hero ── */
/* ── Hero — split layout ── */
.p-hero {
  padding: 100px 0 72px;
  background: #fff;
}
.p-hero__split {
  display: grid; grid-template-columns: 1fr 1.1fr; gap: 72px; align-items: center;
}
.p-hero__img-col { position: relative; }
.p-hero__photo {
  width: 100%; height: 560px; object-fit: cover; object-position: center top;
  border-radius: 10px;
}
.p-hero__content-col { display: flex; flex-direction: column; align-items: flex-start; }
.p-hero__title {
  font-family: var(--p-font-display); font-size: clamp(30px, 3.8vw, 52px);
  font-weight: 700; line-height: 1.1; color: #111827;
  letter-spacing: -0.025em; margin-bottom: 20px; margin-top: 12px;
}
.p-hero__title--accent { color: var(--p-blue); -webkit-text-fill-color: initial; background: none; }
.p-hero__sub {
  font-size: clamp(15px, 1.2vw, 17px); line-height: 1.7;
  color: #015697; font-weight: 500;
  margin-bottom: 32px; max-width: 480px;
}
.p-hero__stat-row {
  display: flex; align-items: center; gap: 0;
  margin-bottom: 36px;
  background: #fff; border: 1px solid #e5e7eb;
  border-radius: 14px; overflow: hidden;
}
.p-hero__stat-item {
  display: flex; align-items: center; gap: 12px;
  padding: 18px 24px;
}
.p-hero__stat-divider { width: 1px; height: 56px; background: #e5e7eb; flex-shrink: 0; }
.p-hero__stat-num {
  font-family: var(--p-font-display); font-size: clamp(28px, 2.5vw, 36px);
  font-weight: 700; color: #111827; line-height: 1; white-space: nowrap;
}
.p-hero__stat-label {
  font-size: 12px; font-weight: 500; color: #6b7280; line-height: 1.4;
}
.p-btn--hero-cta {
  font-size: 15px; padding: 14px 32px; border-radius: 999px;
}
@media (max-width: 900px) {
  .p-hero__split { grid-template-columns: 1fr; gap: 40px; }
  .p-hero__photo { height: 320px; object-position: center 20%; }
  .p-hero { padding: 100px 0 60px; }
}

/* ── Recognition / Impact ── */
.p-recognition {
  padding: 80px 0;
  background: #fff;
  border-top: 1px solid #e5e7eb;
}
.p-recognition__headline {
  font-family: var(--p-font-display); font-size: clamp(22px, 3vw, 36px);
  font-weight: 700; line-height: 1.2; color: #111827;
  text-align: center; margin-bottom: 56px;
}
.p-recognition__split {
  display: grid; grid-template-columns: 1fr 1.1fr; gap: 80px; align-items: center;
}
.p-recognition__content {
  font-size: 16px; line-height: 1.75; color: #374151;
}
.p-recognition__content strong { color: #111827; }
.p-recognition__image-wrap { position: relative; }
.p-recognition__photo {
  width: 100%; height: 420px; object-fit: cover; object-position: center;
  border-radius: 10px;
}
@media (max-width: 900px) {
  .p-recognition__split { grid-template-columns: 1fr; gap: 32px; }
  .p-recognition__photo { height: 260px; }
}

/* ── Showcase Cards ── */
.p-showcase { padding: var(--p-section-pad) 0; }
.p-showcase__card {
  display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
  padding: 56px 0;
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
  cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.p-showcase__cta:hover {
  border-color: var(--p-blue);
  background: #fff;
}

/* Showcase Mock UI */
.p-showcase__mock {
  border-radius: var(--p-radius-lg); overflow: hidden;
  border: 1px solid var(--p-border);
  background: var(--p-bg);
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
  position: relative;
}
.p-showcase__photo {
  width: 100%; height: 380px; object-fit: cover; display: block;
}
.p-showcase__photo-caption {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px; color: #fff;
  background: var(--bg-card-solid);
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
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
  margin-bottom: 56px;
}
.p-tech__card {
  background: #fff; border-radius: var(--p-radius-lg); padding: 32px;
  border: 1px solid var(--p-border-light);
}
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
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
  margin-bottom: 48px;
}
.p-interop__card {
  display: flex; gap: 18px; align-items: flex-start;
  background: var(--p-bg-warm); border-radius: var(--p-radius-lg); padding: 28px;
  border: 1px solid var(--p-border-light);
}
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
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;
  align-items: start;
}
.p-features__card {
  background: #fff; border-radius: var(--p-radius-lg); padding: 32px;
  border: 1px solid var(--p-border-light); cursor: pointer;
}
.p-features__card--expanded { border-color: var(--p-blue); }
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
.p-features__card-chevron { color: var(--p-text-muted); flex-shrink: 0; }
.p-features__card-desc {
  font-size: 14px; line-height: 1.7; color: var(--p-text-secondary);
}
.p-features__card-list {
  list-style: none; margin-top: 16px; padding-top: 16px;
  border-top: 1px solid var(--p-border-light);
  display: grid; gap: 8px;
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
}
.p-roadmap__item:last-child { border-bottom: none; }
.p-roadmap__item-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.p-roadmap__item-dot--done { background: #10B944; }
.p-roadmap__item-dot--now { background: var(--p-blue); }
.p-roadmap__item-dot--next { background: #D4A843; }
@media (max-width: 700px) { .p-roadmap__columns { grid-template-columns: 1fr; } }

/* ── Tour ── */
.p-tour { padding: var(--p-section-pad) 0; background: var(--p-bg); }
.p-tour__grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;
  margin-bottom: 56px;
}
.p-tour__card {
  text-align: center; padding: 36px 24px; border-radius: var(--p-radius-lg);
  border: 1px solid var(--p-border-light); background: var(--p-bg);
}
.p-tour__card-icon {
  width: 52px; height: 52px; border-radius: 14px;
  background: var(--p-bg-cool); color: var(--p-text-muted);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
}
.p-tour__card-label { font-size: 14px; font-weight: 700; margin-bottom: 4px; color: var(--p-text); }
.p-tour__card-desc { font-size: 12px; color: var(--p-text-muted); }
@media (max-width: 700px) { .p-tour__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .p-tour__grid { grid-template-columns: 1fr; } }

.p-tour__cta {
  text-align: center; padding: 56px 32px; border-radius: var(--p-radius-xl);
  background: var(--bg-card-solid);
  border: 1px solid var(--p-blue-light);
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
  background: var(--bg-card-solid);
  position: relative; overflow: hidden;
}
.p-final-cta__inner::before {
  content: ''; position: absolute; inset: 0;
  background: transparent;
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
  display: grid; grid-template-columns: 1.8fr 1fr 1fr 1fr; gap: 64px;
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
}
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

`;
