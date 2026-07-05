"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DuoIcon } from "./DuoIcon";
import { MarketingActionModalButton } from "./MarketingActionModal";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Navbar
   Single-page site: anchor links into the homepage's sections, plus
   Staff Sign In and a Partner With Us CTA.
   ═══════════════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: "The Problem", href: "/#problem" },
  { label: "Our Solution", href: "/#solution" },
  { label: "The Team", href: "/#team" },
  { label: "Get Involved", href: "/#get-involved" },
];

const DISPLAY_PHONE = "(973) 566-4336";
const PHONE_TEL = "tel:+19735664336";
const STAFF_APP_URL = "https://app.tamamhealth.org";

type NavScrollState = "top" | "hero" | "past";

export default function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollState, setScrollState] = useState<NavScrollState>("top");
  const pathname = usePathname();
  const isHome = pathname === "/";
  // Homepage hero is the dark-blue theme, so its nav just toggles between
  // fully transparent (floating over the hero at the very top) and the
  // matching solid dark-blue bar (as soon as you scroll at all, including
  // past the hero) — legal pages (privacy/terms) use the generic light bar.
  const navClass = isHome
    ? (scrollState === "top" ? "mk-navbar--hero" : "mk-navbar--hero-solid")
    : scrollState === "past"
      ? "mk-navbar--scrolled"
      : "mk-navbar--light-hero";

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const hero = document.querySelector<HTMLElement>(".mk-home-split-hero, .mk-mod-hero");
      const nav = document.querySelector<HTMLElement>(".mk-navbar");
      const navHeight = nav?.getBoundingClientRect().height ?? 80;
      const heroBottom = hero ? hero.offsetTop + hero.offsetHeight - navHeight : 0;

      if (scrollY <= 10) {
        setScrollState("top");
      } else if (hero && scrollY < heroBottom) {
        setScrollState("hero");
      } else {
        setScrollState("past");
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [pathname]);

  return (
    <>
      {/* Main navbar */}
      <nav className={`mk-navbar ${navClass}${isHome ? " mk-navbar--tone-home" : ""}`}>
        <div className="mk-container mk-navbar-inner">
          <Link href="/" className="mk-nav-logo" aria-label="Tamam Healthcare System — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logos/SVG/Tamam_Style_Guide-33.svg"
              alt=""
              className="mk-nav-logo-mark"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logos/SVG/Tamam_Style_Guide-31.svg"
              alt="Tamam Healthcare System"
              className="mk-nav-logo-type"
            />
          </Link>

          {/* Desktop center nav links */}
          <div className="mk-nav-center desktop-only">
            {NAV_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="mk-nav-item mk-nav-item-link">
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop right CTA actions */}
          <div className="mk-nav-actions desktop-only">
            <a href={STAFF_APP_URL} className="mk-nav-item mk-nav-staff-link">
              Staff Sign In
            </a>
            <MarketingActionModalButton
              intent="demo"
              className="mk-btn mk-btn-green mk-btn-sm mk-nav-demo"
              source="nav-book-demo"
            >
              Partner With Us
            </MarketingActionModalButton>
          </div>

          {/* Mobile hamburger */}
          <div className="mk-mobile-top-actions" aria-label="Mobile quick actions">
            <MarketingActionModalButton
              intent="demo"
              className="mk-mobile-top-demo"
              source="nav-mobile-book-demo"
            >
              Partner With Us
            </MarketingActionModalButton>
          </div>
          <button
            type="button"
            className="mk-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <DuoIcon name="x" size={24} /> : <DuoIcon name="menu" size={24} />}
          </button>
        </div>

        <a href={PHONE_TEL} className="mk-mobile-sales-row">
          <span>Call sales</span>
          <DuoIcon name="phone" size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{DISPLAY_PHONE}</span>
        </a>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="mk-mobile-menu">
            <div className="mk-mobile-menu-inner">
              {NAV_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </Link>
              ))}

              <div className="mk-mobile-menu-divider" />
              <a href={PHONE_TEL} className="mk-mobile-phone" onClick={() => setMobileOpen(false)}>
                <DuoIcon name="phone" size={17} strokeWidth={1.8} aria-hidden="true" />
                {DISPLAY_PHONE}
              </a>

              <a
                href={STAFF_APP_URL}
                className="mk-mobile-link"
                onClick={() => setMobileOpen(false)}
              >
                Staff Sign In
              </a>

              <MarketingActionModalButton
                intent="demo"
                className="mk-btn mk-btn-green mk-mobile-cta"
                source="nav-mobile-menu-book-demo"
                onOpen={() => setMobileOpen(false)}
              >
                Partner With Us
              </MarketingActionModalButton>
            </div>
          </div>
        )}
      </nav>

      <style jsx global>{`
        .desktop-only {
          display: flex;
        }

        .mk-nav-item {
          position: relative;
          color: var(--tb-text);
          text-decoration: none;
        }

        .mk-nav-item:hover {
          color: var(--tb-blue-700);
        }

        .mk-nav-staff-link {
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
        }

        .mk-mobile-toggle {
          display: none;
          background: transparent;
          border: none;
          cursor: pointer;
          margin-left: auto;
          padding: 8px;
          color: var(--tb-text);
          line-height: 0;
        }

        .mk-mobile-toggle:focus:not(:focus-visible) {
          outline: none;
        }

        .mk-mobile-toggle:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 5px;
          border-radius: 8px;
        }

        .mk-mobile-link {
          font-size: 18px;
          font-weight: 500;
          color: var(--tb-text);
          text-decoration: none;
          min-height: 48px;
          display: flex;
          align-items: center;
        }

        .mk-mobile-link:hover {
          color: var(--tb-blue-700);
        }

        @media (max-width: 1120px) {
          .desktop-only { display: none !important; }
          .mk-mobile-toggle { display: block !important; }
        }
      `}</style>
    </>
  );
}
