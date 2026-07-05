"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronDown, Check, X, Mail, MapPin, Globe, Lock,
  Menu, Shield, WifiOff, Languages, QrCode, Brain,
  Heart, Building2, Stethoscope,
} from "@/components/icons/lucide";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Story-First Landing Page
   Narrative arc: The Crisis → Daily Reality → A Patient's Journey →
   The Solution → Before/After → Impact → Who We Are → Get Involved
   Audience: US donors, grant funders, NGO/health partners, general public
   ═══════════════════════════════════════════════════════════════════ */

/* Scroll-triggered slide-in. Sections slide up (or in from the sides)
   as they enter the viewport; respects prefers-reduced-motion. */
function Reveal({
  children,
  delay = 0,
  direction = "up",
}: {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -48px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`rv rv--${direction} ${visible ? "rv--in" : ""}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

// ─── DATA ───────────────────────────────────────────────────────

/* The Crisis — every figure is cited in the sources strip below the section.
   Sources: WHO, UNFPA South Sudan, UN OCHA HNRP 2026, World Bank. */
const CRISIS_STATS = [
  {
    value: "1,223",
    unit: "maternal deaths per 100,000 live births",
    context: "The highest maternal mortality rate in the world. In the US, the rate is under 20.",
    source: "WHO",
  },
  {
    value: "1 : 65,000",
    unit: "doctors to people",
    context: "One physician serves roughly 65,000 people — among the lowest ratios on Earth.",
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

const CRISIS_SECONDARY = [
  { value: "19%", label: "of births are attended by a trained health worker" },
  { value: "96,000+", label: "cholera cases in the country's largest outbreak on record" },
  { value: "3.2M", label: "suspected malaria cases recorded in just ten months" },
];

const CAPABILITIES = [
  {
    icon: WifiOff,
    title: "Works without internet",
    desc: "Most clinics have no reliable power or connectivity. TamamHealth runs fully offline on a laptop or tablet, then syncs automatically the moment a connection appears.",
  },
  {
    icon: Languages,
    title: "Speaks the languages of care",
    desc: "English, Arabic, Dinka, Nuer and 15+ languages — so a nurse can chart in the language she thinks in, and a patient can be understood.",
  },
  {
    icon: QrCode,
    title: "One patient, one record",
    desc: "Fingerprint and QR identity means a mother's history follows her — from a tent clinic in Akobo to a hospital in Juba — even if she carries no papers.",
  },
  {
    icon: Brain,
    title: "Helps stretched staff do more",
    desc: "An AI clinical scribe drafts notes and summaries, so one clinician serving thousands spends minutes on paperwork instead of hours.",
  },
];

const BEFORE_AFTER = [
  { before: "Records kept in paper exercise books — lost, damaged, or left behind", after: "Every visit saved digitally and backed up, even offline" },
  { before: "A patient's history vanishes when she moves between clinics", after: "Identity via fingerprint or QR — her record travels with her" },
  { before: "Outbreaks spotted weeks late, from paper tallies", after: "Live surveillance data flows to health officials as care happens" },
  { before: "One clinician, thousands of patients, hours of handwriting", after: "AI-drafted notes give time back to actual care" },
];

const IMPACT_STATS = [
  { value: "90+", label: "clinical features built and shipped" },
  { value: "11.4M", label: "people across our service regions" },
  { value: "8", label: "integrated modules, reception to pharmacy" },
  { value: "15+", label: "languages supported at the point of care" },
];

const FOUNDERS = [
  // TODO: confirm names, roles, and one-line bios for each founder
  { img: "/assets/patients/founder-teny.jpg", name: "Teny", role: "Co-Founder" },
  { img: "/assets/patients/founder-ekow.jpg", name: "Ekow", role: "Co-Founder" },
  { img: "/assets/patients/founder-toye.jpg", name: "Toye", role: "Co-Founder" },
];

const GET_INVOLVED = [
  {
    icon: Heart,
    title: "Donors & Funders",
    desc: "Your support puts working health infrastructure into clinics that have never had it. We can share our impact model, budget, and roadmap.",
    cta: "Start a conversation",
    href: "mailto:support.tamam@gmail.com?subject=Funding%20TamamHealth",
  },
  {
    icon: Globe,
    title: "NGO & Health Partners",
    desc: "Deploying in South Sudan? TamamHealth is offline-first, DHIS2-compatible, and built for the field conditions your teams already know.",
    cta: "Explore a partnership",
    href: "mailto:support.tamam@gmail.com?subject=Partnering%20with%20TamamHealth",
  },
  {
    icon: Building2,
    title: "Clinics & Ministries",
    desc: "See the platform with your own workflows — reception, triage, consultation, lab, pharmacy — in a live guided demo.",
    cta: "Request a demo",
    href: "mailto:support.tamam@gmail.com?subject=TamamHealth%20Demo%20Request",
  },
];

const NAV_ITEMS = [
  { label: "The Crisis", id: "crisis" },
  { label: "Our Solution", id: "solution" },
  { label: "Impact", id: "impact" },
  { label: "About", id: "about" },
  { label: "Get Involved", id: "get-involved" },
];

// ─── MAIN PAGE COMPONENT ────────────────────────────────────────

export default function ProductPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [progress, setProgress] = useState(0);

  // The landing page must always be freely scrollable. App modals lock body
  // scroll (overflow: hidden) and a lock can survive client-side navigation —
  // clear any leftover lock on mount.
  useEffect(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(window.scrollY / total, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track which section is in view so the nav highlights as you scroll
  useEffect(() => {
    const ids = ["home", "crisis", "reality", "journey", "solution", "impact", "about", "get-involved"];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNav(false);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  // Sections that highlight their nav item (reality/journey roll up under "crisis")
  const navActiveId =
    activeSection === "reality" || activeSection === "journey" ? "crisis" : activeSection;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: productCSS }} />

      {/* ════════ HEADER ════════ */}
      <header className={`s-header ${scrolled ? "s-header--scrolled" : ""}`}>
        <div className="s-container s-header__inner">
          <Link href="/product" className="s-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logos/SVG/Tamam_Style_Guide-21.svg" alt="TamamHealth" style={{ height: 28, width: "auto" }} />
          </Link>

          <nav className="s-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`s-nav__link ${navActiveId === item.id ? "s-nav__link--active" : ""}`}
                onClick={() => scrollTo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="s-header__actions">
            <Link href="/login" className="s-btn s-btn--ghost">Staff Sign In</Link>
            <button className="s-btn s-btn--primary" onClick={() => scrollTo("get-involved")}>
              Partner With Us
            </button>
          </div>

          <button className="s-mobile-toggle" onClick={() => setMobileNav(!mobileNav)} aria-label="Menu">
            {mobileNav ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Scroll progress bar — one-page reading indicator */}
        <div className="s-progress" style={{ transform: `scaleX(${progress})` }} />

        {mobileNav && (
          <div className="s-mobile-nav">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} className="s-mobile-nav__link" onClick={() => scrollTo(item.id)}>
                {item.label}
              </button>
            ))}
            <div className="s-mobile-nav__actions">
              <Link href="/login" className="s-btn s-btn--outline" style={{ width: "100%", textAlign: "center" }}>Staff Sign In</Link>
              <button className="s-btn s-btn--primary" style={{ width: "100%" }} onClick={() => scrollTo("get-involved")}>
                Partner With Us
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="s-main">

        {/* ════════ 1 · HERO — the problem, human first ════════ */}
        <section className="s-hero" id="home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/landing-img.jpg" alt="Midwives standing outside a tent clinic in South Sudan" className="s-hero__bg" />
          <div className="s-hero__overlay" />
          <div className="s-container s-hero__content">
            <span className="s-hero__eyebrow"><MapPin size={13} /> South Sudan · The world&apos;s youngest country</span>
            <h1 className="s-hero__title">
              Here, a mother is more likely to die giving birth than almost anywhere on Earth.
            </h1>
            <p className="s-hero__sub">
              Not because no one cares — but because the clinics that serve her run on paper,
              without power, without records, without a way to know her story.
              TamamHealth is changing that.
            </p>
            <div className="s-hero__ctas">
              <button className="s-btn s-btn--light s-btn--lg" onClick={() => scrollTo("crisis")}>
                Understand the crisis <ChevronDown size={16} />
              </button>
              <button className="s-btn s-btn--outline-light s-btn--lg" onClick={() => scrollTo("solution")}>
                See our solution <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="s-hero__caption">Midwives outside their clinic — the frontline of care in South Sudan.</div>
        </section>

        {/* ════════ 2 · THE STATE OF SOUTH SUDAN ════════ */}
        <section className="s-crisis" id="crisis">
          <div className="s-container">
            <Reveal>
              <div className="s-section-header s-section-header--left">
                <span className="s-eyebrow s-eyebrow--light">The State of South Sudan</span>
                <h2 className="s-section-title s-section-title--light">A health system asked to do the impossible</h2>
                <p className="s-section-lede s-section-lede--light">
                  South Sudan became independent in 2011 and has weathered civil war, flooding,
                  and displacement ever since. Its people are served by one of the most
                  fragile health systems in the world. These aren&apos;t abstractions — they are
                  the odds facing every family, every day.
                </p>
              </div>
            </Reveal>

            <div className="s-crisis__grid">
              {CRISIS_STATS.map((s, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="s-crisis__card">
                    <div className="s-crisis__value">{s.value}</div>
                    <div className="s-crisis__unit">{s.unit}</div>
                    <p className="s-crisis__context">{s.context}</p>
                    <span className="s-crisis__source">{s.source}</span>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="s-crisis__secondary">
              {CRISIS_SECONDARY.map((s, i) => (
                <div key={i} className="s-crisis__secondary-item">
                  <strong>{s.value}</strong> {s.label}
                </div>
              ))}
            </div>

            <p className="s-crisis__sources">
              Sources:{" "}
              <a href="https://data.who.int/countries/728" target="_blank" rel="noopener noreferrer">WHO</a> ·{" "}
              <a href="https://southsudan.unfpa.org/en/topics/maternal-health" target="_blank" rel="noopener noreferrer">UNFPA South Sudan</a> ·{" "}
              <a href="https://www.unocha.org/south-sudan" target="_blank" rel="noopener noreferrer">UN OCHA</a> ·{" "}
              <a href="https://data.worldbank.org/indicator/SH.STA.MMRT?locations=SS" target="_blank" rel="noopener noreferrer">World Bank</a>
            </p>
          </div>
        </section>

        {/* ════════ 3 · THE DAILY REALITY ════════ */}
        <section className="s-reality" id="reality">
          <div className="s-container">
            <Reveal>
              <div className="s-section-header">
                <span className="s-eyebrow">The Daily Reality</span>
                <h2 className="s-section-title">Why care breaks down</h2>
              </div>
            </Reveal>

            <Reveal direction="left">
            <div className="s-reality__block">
              <div className="s-reality__img-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/patients/doctor-writing-notes.jpg" alt="A clinician writing patient notes by hand in a paper notebook" className="s-reality__img" />
              </div>
              <div className="s-reality__text">
                <h3>Care runs on paper</h3>
                <p>
                  In most facilities, a patient&apos;s entire medical history lives in a paper
                  exercise book — if she remembered to bring it, if it survived the rainy season,
                  if it wasn&apos;t left behind when her family fled violence. When the book is
                  gone, her history is gone. Every visit starts from zero.
                </p>
                <p>
                  For a pregnant woman with complications, that missing page can be the difference
                  between a routine referral and a preventable death.
                </p>
              </div>
            </div>
            </Reveal>

            <Reveal direction="right">
            <div className="s-reality__block s-reality__block--reverse">
              <div className="s-reality__img-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/doctor-nurse-consultation.jpg" alt="A clinical team in consultation" className="s-reality__img" />
              </div>
              <div className="s-reality__text">
                <h3>Off the grid, off the map</h3>
                <p>
                  Electricity is intermittent. Internet is a luxury. Health software built for
                  connected hospitals in wealthy countries simply doesn&apos;t work here — so
                  clinics are left with nothing, and the data that could warn of a cholera
                  outbreak arrives weeks late, tallied by hand.
                </p>
                <p>
                  Only about 40% of facilities are functional at all. The ones that are open are
                  stretched far past capacity — one county hospital serves nearly five times the
                  population it was built for.
                </p>
              </div>
            </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ 4 · A PATIENT'S JOURNEY ════════ */}
        <section className="s-journey" id="journey">
          <div className="s-container">
            <Reveal>
            <div className="s-journey__card">
              <p className="s-journey__quote">
                A mother walks four hours to the nearest functional clinic, her sick child on her
                back. The clinic has never seen her before — no chart, no history, no record of
                the pregnancy complications she survived last year. The clinical officer, the only
                one on duty for a catchment of thousands, starts with a blank page. Again.
              </p>
              <p className="s-journey__attribution">
                A composite story — drawn from the realities that frontline health workers in
                South Sudan describe every day.
              </p>
            </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ 5 · THE SOLUTION ════════ */}
        <section className="s-solution" id="solution">
          <div className="s-container">
            <Reveal>
              <div className="s-section-header">
                <span className="s-eyebrow">Our Solution</span>
                <h2 className="s-section-title">TamamHealth: a health record system that works where nothing else does</h2>
                <p className="s-section-lede">
                  TamamHealth is an electronic health record platform purpose-built for South
                  Sudan&apos;s realities — not adapted from software designed for hospitals with
                  stable power, fast internet, and armies of administrators.
                </p>
              </div>
            </Reveal>

            <div className="s-solution__screenshot-wrap">
              <div className="s-solution__screenshot-frame">
                <div className="s-solution__screenshot-bar"><span /><span /><span /></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/Dashboard.png" alt="The TamamHealth clinical dashboard" className="s-solution__screenshot" />
              </div>
            </div>

            <div className="s-solution__grid">
              {CAPABILITIES.map((c, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className="s-solution__card">
                    <div className="s-solution__card-icon"><c.icon size={22} /></div>
                    <h3>{c.title}</h3>
                    <p>{c.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ 6 · BEFORE / AFTER ════════ */}
        <section className="s-compare">
          <div className="s-container">
            <Reveal>
              <div className="s-section-header">
                <span className="s-eyebrow">What Changes</span>
                <h2 className="s-section-title">From paper and luck — to a record that saves lives</h2>
              </div>
            </Reveal>
            <Reveal>
            <div className="s-compare__table">
              <div className="s-compare__head">
                <div className="s-compare__head-cell s-compare__head-cell--before">Today, on paper</div>
                <div className="s-compare__head-cell s-compare__head-cell--after">With TamamHealth</div>
              </div>
              {BEFORE_AFTER.map((row, i) => (
                <div key={i} className="s-compare__row">
                  <div className="s-compare__cell s-compare__cell--before">
                    <X size={15} /> <span>{row.before}</span>
                  </div>
                  <div className="s-compare__cell s-compare__cell--after">
                    <Check size={15} /> <span>{row.after}</span>
                  </div>
                </div>
              ))}
            </div>
            </Reveal>
          </div>
        </section>

        {/* ════════ 7 · IMPACT & MOMENTUM ════════ */}
        <section className="s-impact" id="impact">
          <div className="s-container">
            <Reveal>
              <div className="s-section-header">
                <span className="s-eyebrow">Impact &amp; Momentum</span>
                <h2 className="s-section-title">Built, shipped, and growing</h2>
                <p className="s-section-lede">
                  This isn&apos;t a concept deck. TamamHealth is a working platform — an integrated
                  system covering reception, triage, consultation, lab, pharmacy, and public
                  health reporting, in active development since 2025.
                </p>
              </div>
            </Reveal>
            <div className="s-impact__grid">
              {IMPACT_STATS.map((s, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className="s-impact__stat">
                    <span className="s-impact__value">{s.value}</span>
                    <span className="s-impact__label">{s.label}</span>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="s-impact__standards">
              <span className="s-impact__standards-label">Aligned with the systems health officials already use:</span>
              <div className="s-impact__standards-items">
                <span><Globe size={14} /> DHIS2 compatible</span>
                <span><Shield size={14} /> WHO standards</span>
                <span><Lock size={14} /> FHIR-ready</span>
                <span><Stethoscope size={14} /> ISO 13606 / 13131</span>
              </div>
            </div>
          </div>
        </section>

        {/* ════════ 8 · WHO WE ARE ════════ */}
        <section className="s-about" id="about">
          <div className="s-container">
            <Reveal>
              <div className="s-section-header">
                <span className="s-eyebrow">Who We Are</span>
                <h2 className="s-section-title">Built by people who know these clinics</h2>
                <p className="s-section-lede">
                  TamamHealth was founded with roots in Juba and a simple conviction: the people
                  of South Sudan deserve health infrastructure as good as anywhere in the world —
                  designed for their reality, not someone else&apos;s.
                </p>
              </div>
            </Reveal>
            <div className="s-about__grid">
              {FOUNDERS.map((f, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="s-about__card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.img} alt={`${f.name}, ${f.role} of TamamHealth`} className="s-about__photo" />
                    <div className="s-about__meta">
                      <span className="s-about__name">{f.name}</span>
                      <span className="s-about__role">{f.role}</span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════ 9 · GET INVOLVED ════════ */}
        <section className="s-involve" id="get-involved">
          <div className="s-container">
            <Reveal>
              <div className="s-section-header">
                <span className="s-eyebrow s-eyebrow--light">Get Involved</span>
                <h2 className="s-section-title s-section-title--light">The problem is enormous. The fix is buildable.</h2>
                <p className="s-section-lede s-section-lede--light">
                  A mother&apos;s survival shouldn&apos;t depend on whether her paper chart
                  survived the rainy season. Here&apos;s how you can help change the odds.
                </p>
              </div>
            </Reveal>
            <div className="s-involve__grid">
              {GET_INVOLVED.map((g, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="s-involve__card">
                    <div className="s-involve__icon"><g.icon size={24} /></div>
                    <h3>{g.title}</h3>
                    <p>{g.desc}</p>
                    <a href={g.href} className="s-btn s-btn--light" style={{ marginTop: "auto" }}>
                      {g.cta} <ArrowRight size={15} />
                    </a>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Floating back-to-top */}
      <button
        className={`s-top-btn ${scrolled ? "s-top-btn--visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Back to top"
      >
        <ChevronDown size={18} style={{ transform: "rotate(180deg)" }} />
      </button>

      {/* ════════ FOOTER ════════ */}
      <footer className="s-footer">
        <div className="s-container">
          <div className="s-footer__grid">
            <div className="s-footer__brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logos/SVG/Tamam_Style_Guide-21.svg" alt="TamamHealth" style={{ height: 24, width: "auto", filter: "brightness(0) invert(1)", marginBottom: 16 }} />
              <p className="s-footer__tagline">
                Digital health infrastructure for South Sudan&apos;s frontline clinics —
                offline-first, multilingual, built where it&apos;s needed.
              </p>
            </div>
            <div className="s-footer__col">
              <h4>The Story</h4>
              <button onClick={() => scrollTo("crisis")}>The Crisis</button>
              <button onClick={() => scrollTo("reality")}>The Daily Reality</button>
              <button onClick={() => scrollTo("solution")}>Our Solution</button>
              <button onClick={() => scrollTo("impact")}>Impact</button>
            </div>
            <div className="s-footer__col">
              <h4>Connect</h4>
              <button onClick={() => scrollTo("get-involved")}>Get Involved</button>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Use</Link>
              <Link href="/login">Staff Sign In</Link>
            </div>
            <div className="s-footer__col">
              <h4>Contact</h4>
              <a href="mailto:support.tamam@gmail.com" className="s-footer__contact"><Mail size={14} /> support.tamam@gmail.com</a>
              <div className="s-footer__contact"><MapPin size={14} /> Juba, South Sudan</div>
            </div>
          </div>
          <div className="s-footer__bottom">
            <p>© {new Date().getFullYear()} TamamHealth. All rights reserved.</p>
            <div className="s-footer__badges">
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

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const productCSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=IBM+Plex+Serif:ital,wght@0,400;0,600;1,400&display=swap');

:root {
  /* Brand tokens — mirrored from the platform design system (globals.css) */
  --s-blue: #2191D0;        /* tb-blue-700 · primary accent */
  --s-blue-dark: #015697;   /* tb-blue-800 · deep accent, hovers, links */
  --s-blue-mid: #369FDA;    /* tb-blue-600 · lighter accent, borders */
  --s-blue-light: #DDF2FB;  /* tb-blue-100 · pale tint */
  --s-blue-pale: #F5FAFF;
  --s-green: #1B9E77;       /* success-500 */
  --s-red: #C44536;         /* danger-500 */
  --s-red-pale: #FEF2F2;
  --s-green-pale: #F0FDF4;

  --s-ink: #0F172A;             /* slate-900 */
  --s-text: #334155;            /* slate-700 */
  --s-text-secondary: #475569;  /* slate-600 */
  --s-text-muted: #64748B;      /* slate-500 */

  --s-bg: #FFFFFF;
  --s-bg-warm: #FCFDFE;     /* slate-50 · matches app surfaces */
  --s-bg-dark: #0A1A33;     /* slate-950 · matches app dark surfaces */

  --s-border: #E4EBF1;      /* slate-100 · app card border */

  --s-radius: 10px;         /* btn-radius */
  --s-radius-lg: 14px;      /* card-radius */

  --s-card-shadow: 0 1px 2px rgba(16, 42, 67, 0.05);
  --s-card-shadow-lg: 0 10px 24px -16px rgba(16, 42, 67, 0.22);
  --s-card-hover-border: #369FDA;
  --s-card-transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;

  --s-font: var(--font-platform, var(--font-dm-sans)), 'DM Sans', system-ui, sans-serif;
  --s-serif: 'IBM Plex Serif', Georgia, serif;

  --s-pad: clamp(64px, 9vh, 110px);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
/* One-page site: the document itself must always scroll. !important beats any
   leftover inline overflow:hidden lock set by app modals on body. */
html, body {
  overflow-y: auto !important;
  height: auto !important;
  overscroll-behavior-y: auto;
}
/* Anchored sections stop below the fixed header instead of sliding under it */
section[id] { scroll-margin-top: 72px; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body {
  font-family: var(--s-font);
  color: var(--s-text);
  background: var(--s-bg);
  -webkit-font-smoothing: antialiased;
  font-size: 1.0625rem;
  line-height: 1.6;
}
a { color: inherit; text-decoration: none; }

.s-container { max-width: 1200px; margin: 0 auto; padding: 0 40px; }
@media (max-width: 640px) { .s-container { padding: 0 20px; } }

/* ── Scroll reveal (slide-in) ── */
.rv {
  opacity: 0;
  transition: opacity 0.75s ease, transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}
.rv--up { transform: translateY(34px); }
.rv--left { transform: translateX(-48px); }
.rv--right { transform: translateX(48px); }
.rv--in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .rv { opacity: 1; transform: none; transition: none; }
}

/* ── Section headers ── */
.s-section-header { text-align: center; max-width: 760px; margin: 0 auto 56px; }
.s-section-header--left { text-align: left; margin: 0 0 48px; }
.s-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--s-blue-dark); background: var(--s-blue-light);
  padding: 6px 14px; border-radius: 100px; margin-bottom: 18px;
}
.s-eyebrow--light { color: #fff; background: rgba(255,255,255,0.14); }
.s-section-title {
  font-size: clamp(1.75rem, 3.6vw, 2.5rem); font-weight: 700; line-height: 1.15;
  color: var(--s-ink); letter-spacing: -0.02em; margin-bottom: 18px;
}
.s-section-title--light { color: #fff; }
.s-section-lede {
  font-size: clamp(1rem, 1.3vw, 1.125rem); line-height: 1.7; color: var(--s-text-secondary);
}
.s-section-lede--light { color: rgba(255,255,255,0.85); }

/* ── Buttons ── */
.s-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 22px; font-family: var(--s-font); font-size: 14px; font-weight: 600;
  border-radius: var(--s-radius); border: 1.5px solid transparent; cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  line-height: 1.2; white-space: nowrap;
}
.s-btn--primary { background: var(--s-blue); color: #fff; }
.s-btn--primary:hover { background: var(--s-blue-dark); }
.s-btn--ghost { background: transparent; color: var(--s-text); }
.s-btn--ghost:hover { color: var(--s-blue-dark); background: var(--s-blue-pale); }
.s-btn--outline { background: transparent; color: var(--s-text); border-color: var(--s-border); }
.s-btn--outline:hover { border-color: var(--s-blue); color: var(--s-blue-dark); }
.s-btn--light { background: #fff; color: var(--s-blue-dark); }
.s-btn--light:hover { background: var(--s-blue-light); }
.s-btn--outline-light { background: transparent; color: #fff; border-color: rgba(255,255,255,0.5); }
.s-btn--outline-light:hover { border-color: #fff; background: rgba(255,255,255,0.1); }
.s-btn--lg { padding: 15px 28px; font-size: 15px; }

/* ── Header ── */
.s-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: 16px 0; background: rgba(255,255,255,0.96);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid transparent;
  transition: padding 0.2s, border-color 0.2s;
}
.s-header--scrolled { padding: 10px 0; border-bottom-color: var(--s-border); }
.s-progress {
  position: absolute; left: 0; right: 0; bottom: -1px; height: 3px;
  background: linear-gradient(90deg, var(--s-blue-dark), var(--s-blue));
  transform-origin: left; transform: scaleX(0);
}
.s-header__inner { display: flex; align-items: center; gap: 24px; }
.s-logo { display: flex; align-items: center; flex-shrink: 0; }
.s-nav { display: flex; gap: 4px; margin: 0 auto; }
.s-nav__link {
  background: none; border: none; font-family: var(--s-font); font-size: 14px;
  font-weight: 500; color: var(--s-text); padding: 8px 13px; cursor: pointer;
  border-radius: 8px; white-space: nowrap;
}
.s-nav__link:hover { color: var(--s-blue-dark); background: var(--s-blue-pale); }
.s-nav__link--active {
  color: var(--s-blue-dark); background: var(--s-blue-light); font-weight: 600;
}
.s-header__actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.s-mobile-toggle { display: none; background: none; border: none; cursor: pointer; padding: 8px; color: var(--s-text); margin-left: auto; }
.s-mobile-nav { display: flex; flex-direction: column; padding: 16px 24px 24px; background: #fff; border-top: 1px solid var(--s-border); }
.s-mobile-nav__link {
  background: none; border: none; font-family: var(--s-font); font-size: 15px; font-weight: 600;
  color: var(--s-text); padding: 14px 0; cursor: pointer; text-align: left;
  border-bottom: 1px solid var(--s-border);
}
.s-mobile-nav__actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
@media (max-width: 960px) {
  .s-nav, .s-header__actions { display: none; }
  .s-mobile-toggle { display: block; }
}

/* ── 1 · Hero ── */
.s-hero {
  position: relative; min-height: 92vh; display: flex; align-items: center;
  overflow: hidden;
}
.s-hero__bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: center 30%;
}
.s-hero__overlay {
  position: absolute; inset: 0;
  background: linear-gradient(75deg, rgba(4,24,40,0.88) 0%, rgba(4,24,40,0.62) 48%, rgba(4,24,40,0.30) 100%);
}
.s-hero__content {
  position: relative; z-index: 2; padding-top: 90px; padding-bottom: 60px;
  animation: heroRise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes heroRise {
  from { opacity: 0; transform: translateY(36px); }
  to { opacity: 1; transform: none; }
}
.s-hero__bg { animation: heroZoom 8s ease-out both; }
@keyframes heroZoom {
  from { transform: scale(1.06); }
  to { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .s-hero__content, .s-hero__bg { animation: none; }
}
.s-hero__eyebrow {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.22);
  padding: 7px 15px; border-radius: 100px; margin-bottom: 26px;
}
.s-hero__title {
  font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 700; line-height: 1.12;
  color: #fff; letter-spacing: -0.025em; max-width: 800px; margin-bottom: 24px;
}
.s-hero__sub {
  font-size: clamp(1.0625rem, 1.5vw, 1.25rem); line-height: 1.65;
  color: rgba(255,255,255,0.88); max-width: 620px; margin-bottom: 38px;
}
.s-hero__ctas { display: flex; gap: 14px; flex-wrap: wrap; }
.s-hero__caption {
  position: absolute; bottom: 18px; right: 24px; z-index: 2;
  font-size: 12px; color: rgba(255,255,255,0.75);
}
@media (max-width: 640px) {
  .s-hero { min-height: 100vh; }
  .s-hero__caption { left: 20px; right: 20px; text-align: left; }
}

/* ── 2 · Crisis — somber navy, white stat cards punch through ── */
.s-crisis {
  padding: var(--s-pad) 0;
  background: linear-gradient(180deg, #071e30 0%, var(--s-bg-dark) 100%);
}
.s-crisis__grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 36px;
}
.s-crisis__card {
  background: #fff; border-radius: var(--s-radius-lg); padding: 30px 26px;
  border: 1px solid var(--s-border); display: flex; flex-direction: column;
  border-top: 3px solid var(--s-red);
  height: 100%;
  box-shadow: var(--s-card-shadow);
  transition: var(--s-card-transition);
}
.s-crisis__card:hover {
  box-shadow: var(--s-card-shadow-lg);
  transform: translateY(-2px);
}
.s-crisis__value {
  font-size: clamp(2rem, 3vw, 2.6rem); font-weight: 700; color: var(--s-ink);
  line-height: 1; letter-spacing: -0.02em; margin-bottom: 10px; font-variant-numeric: tabular-nums;
}
.s-crisis__unit { font-size: 14px; font-weight: 600; color: var(--s-red); margin-bottom: 14px; line-height: 1.4; }
.s-crisis__context { font-size: 14px; line-height: 1.6; color: var(--s-text-secondary); flex: 1; }
.s-crisis__source {
  margin-top: 16px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--s-text-muted);
}
.s-crisis__secondary {
  display: flex; gap: 28px; flex-wrap: wrap;
  padding: 22px 28px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: var(--s-radius-lg); margin-bottom: 20px;
}
.s-crisis__secondary-item { font-size: 14.5px; color: rgba(255,255,255,0.75); }
.s-crisis__secondary-item strong { color: #fff; font-weight: 700; margin-right: 4px; }
.s-crisis__sources { font-size: 12.5px; color: rgba(255,255,255,0.5); }
.s-crisis__sources a { text-decoration: underline; text-underline-offset: 2px; }
.s-crisis__sources a:hover { color: #fff; }
@media (max-width: 960px) { .s-crisis__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .s-crisis__grid { grid-template-columns: 1fr; } }

/* ── 3 · Reality — warm paper cream, echoing the paper-records story ── */
.s-reality { padding: var(--s-pad) 0; background: linear-gradient(180deg, #FEFFF9 0%, #F7FFF0 100%); }
.s-reality__block {
  display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
  padding: 40px 0;
}
.s-reality__block--reverse .s-reality__img-wrap { order: 2; }
.s-reality__block--reverse .s-reality__text { order: 1; }
.s-reality__img-wrap {
  border-radius: var(--s-radius-lg); overflow: hidden;
  border: 1px solid var(--s-border);
  box-shadow: var(--s-card-shadow-lg);
}
.s-reality__img { width: 100%; height: 400px; object-fit: cover; display: block; }
.s-reality__text h3 {
  font-size: clamp(1.375rem, 2.2vw, 1.75rem); font-weight: 700; color: var(--s-ink);
  letter-spacing: -0.015em; margin-bottom: 16px;
}
.s-reality__text p { font-size: 16px; line-height: 1.75; color: var(--s-text-secondary); margin-bottom: 14px; }
@media (max-width: 860px) {
  .s-reality__block { grid-template-columns: 1fr; gap: 28px; padding: 28px 0; }
  .s-reality__block--reverse .s-reality__img-wrap { order: 1; }
  .s-reality__block--reverse .s-reality__text { order: 2; }
  .s-reality__img { height: 260px; }
}

/* ── 4 · Journey — deep brand-blue gradient, the emotional center ── */
.s-journey {
  padding: var(--s-pad) 0;
  background: linear-gradient(135deg, #01426F 0%, var(--s-blue-dark) 55%, var(--s-blue) 130%);
}
.s-journey__card {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.18);
  border-radius: var(--s-radius-lg);
  padding: clamp(40px, 6vw, 72px); text-align: center;
}
.s-journey__quote {
  font-family: var(--s-serif); font-size: clamp(1.25rem, 2.4vw, 1.625rem);
  line-height: 1.6; color: #fff; max-width: 860px; margin: 0 auto 26px;
  font-style: italic;
}
.s-journey__attribution { font-size: 13px; color: rgba(255,255,255,0.6); }

/* ── 5 · Solution — pale brand blue, hope arrives ── */
.s-solution { padding: var(--s-pad) 0; background: linear-gradient(180deg, var(--s-blue-pale) 0%, var(--s-blue-light) 100%); }
.s-solution__screenshot-wrap { max-width: 980px; margin: 0 auto 56px; }
.s-solution__screenshot-frame {
  border-radius: var(--s-radius-lg); overflow: hidden;
  border: 1px solid var(--s-border); background: #fff;
  box-shadow: 0 24px 60px -24px rgba(1,86,151,0.25);
}
.s-solution__screenshot-bar {
  display: flex; gap: 6px; padding: 12px 16px; background: #f3f4f6;
  border-bottom: 1px solid var(--s-border);
}
.s-solution__screenshot-bar span { width: 10px; height: 10px; border-radius: 50%; background: #d1d5db; }
.s-solution__screenshot { width: 100%; display: block; }
.s-solution__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; }
.s-solution__card {
  background: #fff; border: 1px solid var(--s-border); border-radius: var(--s-radius-lg);
  padding: 32px;
  box-shadow: var(--s-card-shadow);
  transition: var(--s-card-transition);
}
.s-solution__card:hover {
  border-color: var(--s-card-hover-border);
  box-shadow: var(--s-card-shadow-lg);
  transform: translateY(-2px);
}
.s-solution__card-icon {
  width: 46px; height: 46px; border-radius: 12px;
  background: var(--s-blue-light); color: var(--s-blue-dark);
  display: flex; align-items: center; justify-content: center; margin-bottom: 18px;
}
.s-solution__card h3 { font-size: 1.125rem; font-weight: 700; color: var(--s-ink); margin-bottom: 10px; }
.s-solution__card p { font-size: 15px; line-height: 1.7; color: var(--s-text-secondary); }
@media (max-width: 720px) { .s-solution__grid { grid-template-columns: 1fr; } }

/* ── 6 · Compare ── */
.s-compare { padding: var(--s-pad) 0; background: #fff; }
.s-compare__table {
  max-width: 960px; margin: 0 auto; border: 1px solid var(--s-border);
  border-radius: var(--s-radius-lg); overflow: hidden;
}
.s-compare__head { display: grid; grid-template-columns: 1fr 1fr; }
.s-compare__head-cell {
  padding: 16px 24px; font-size: 13px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
}
.s-compare__head-cell--before { background: var(--s-red-pale); color: var(--s-red); }
.s-compare__head-cell--after { background: var(--s-green-pale); color: var(--s-green); }
.s-compare__row { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--s-border); }
.s-compare__cell {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 18px 24px; font-size: 14.5px; line-height: 1.55;
}
.s-compare__cell svg { flex-shrink: 0; margin-top: 3px; }
.s-compare__cell--before { color: var(--s-text-secondary); }
.s-compare__cell--before svg { color: var(--s-red); }
.s-compare__cell--after { color: var(--s-text); border-left: 1px solid var(--s-border); background: #fcfefc; }
.s-compare__cell--after svg { color: var(--s-green); }
@media (max-width: 640px) {
  .s-compare__cell { padding: 14px 16px; font-size: 13.5px; }
}

/* ── 7 · Impact — hopeful green, growth and momentum ── */
.s-impact { padding: var(--s-pad) 0; background: linear-gradient(180deg, #F0FDF4 0%, #E4F7ED 100%); }
.s-impact .s-eyebrow { color: #15795C; background: #D9F3E6; }
.s-impact__grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px;
}
.s-impact__stat {
  background: #fff; border: 1px solid var(--s-border); border-radius: var(--s-radius-lg);
  padding: 30px 24px; text-align: center;
  box-shadow: var(--s-card-shadow);
  transition: var(--s-card-transition);
}
.s-impact__stat:hover {
  border-color: var(--s-card-hover-border);
  box-shadow: var(--s-card-shadow-lg);
}
.s-impact__value {
  display: block; font-size: clamp(1.9rem, 3vw, 2.5rem); font-weight: 700;
  color: var(--s-green); letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 8px;
}
.s-impact__stat:hover { border-color: var(--s-green); }
.s-impact__label { font-size: 13.5px; color: var(--s-text-secondary); line-height: 1.45; }
.s-impact__standards {
  display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center;
}
.s-impact__standards-label { font-size: 14px; color: var(--s-text-muted); }
.s-impact__standards-items { display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; }
.s-impact__standards-items span {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 13.5px; font-weight: 600; color: var(--s-text-secondary);
}
@media (max-width: 860px) { .s-impact__grid { grid-template-columns: repeat(2, 1fr); } }

/* ── 8 · About — warm cream, the human close ── */
.s-about { padding: var(--s-pad) 0; background: #FEFFF9; }
.s-about__grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
  max-width: 900px; margin: 0 auto;
}
.s-about__card {
  border-radius: var(--s-radius-lg); overflow: hidden;
  border: 1px solid var(--s-border); background: #fff;
  box-shadow: var(--s-card-shadow);
  transition: var(--s-card-transition);
}
.s-about__card:hover {
  border-color: var(--s-card-hover-border);
  box-shadow: var(--s-card-shadow-lg);
  transform: translateY(-2px);
}
.s-about__photo { width: 100%; height: 300px; object-fit: cover; object-position: center top; display: block; }
.s-about__meta { padding: 16px 18px; }
.s-about__name { display: block; font-size: 15.5px; font-weight: 700; color: var(--s-ink); }
.s-about__role { font-size: 13px; color: var(--s-text-muted); }
@media (max-width: 720px) {
  .s-about__grid { grid-template-columns: 1fr; max-width: 380px; }
}

/* ── 9 · Get Involved ── */
.s-involve { padding: var(--s-pad) 0; background: var(--s-bg-dark); }
.s-involve__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.s-involve__card {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
  border-radius: var(--s-radius-lg); padding: 34px 28px;
  display: flex; flex-direction: column; gap: 14px;
  transition: var(--s-card-transition);
}
.s-involve__card:hover {
  border-color: rgba(255,255,255,0.35);
  transform: translateY(-2px);
}
.s-involve__icon {
  width: 50px; height: 50px; border-radius: 14px;
  background: rgba(255,255,255,0.12); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.s-involve__card h3 { font-size: 1.125rem; font-weight: 700; color: #fff; }
.s-involve__card p { font-size: 14.5px; line-height: 1.65; color: rgba(255,255,255,0.8); flex: 1; }
@media (max-width: 860px) { .s-involve__grid { grid-template-columns: 1fr; } }

/* ── Back to top ── */
.s-top-btn {
  position: fixed; bottom: 26px; right: 26px; z-index: 90;
  width: 46px; height: 46px; border-radius: 50%;
  background: var(--s-blue-dark); color: #fff; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--s-card-shadow-lg);
  opacity: 0; pointer-events: none; transform: translateY(12px);
  transition: opacity 0.25s ease, transform 0.25s ease, background 0.2s;
}
.s-top-btn--visible { opacity: 1; pointer-events: auto; transform: none; }
.s-top-btn:hover { background: var(--s-blue); }

/* ── Footer ── */
.s-footer { background: #071e30; color: #fff; padding: 56px 0 28px; }
.s-footer__grid {
  display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 40px; margin-bottom: 40px;
}
.s-footer__tagline { font-size: 14px; line-height: 1.65; color: rgba(255,255,255,0.65); max-width: 300px; }
.s-footer__col { display: flex; flex-direction: column; gap: 10px; }
.s-footer__col h4 {
  font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: rgba(255,255,255,0.5); margin-bottom: 6px;
}
.s-footer__col a, .s-footer__col button {
  background: none; border: none; font-family: var(--s-font); font-size: 14px;
  color: rgba(255,255,255,0.8); cursor: pointer; text-align: left; padding: 0;
}
.s-footer__col a:hover, .s-footer__col button:hover { color: #fff; }
.s-footer__contact { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: rgba(255,255,255,0.8); }
.s-footer__bottom {
  display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,0.12); padding-top: 24px;
  font-size: 13px; color: rgba(255,255,255,0.55);
}
.s-footer__badges { display: flex; gap: 18px; flex-wrap: wrap; }
.s-footer__badges span { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
@media (max-width: 860px) { .s-footer__grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .s-footer__grid { grid-template-columns: 1fr; } }
`;
