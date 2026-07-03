"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DuoIcon } from "./DuoIcon";
import { MarketingActionModalButton } from "./MarketingActionModal";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Navbar
   Flat top-level links only — Product, About Us — plus a "Get in touch"
   CTA that routes to /pricing (booking + pricing live together there;
   no popup). No dropdowns.
   ═══════════════════════════════════════════════════════════════════ */

// Fundraising entry points are locked off for now. Flip to true to re-enable.
const SHOW_FUNDRAISING = false;

const DISPLAY_PHONE = "(973) 566-4336";
const PHONE_TEL = "tel:+19735664336";
const CONTACT_FORM_HREF = "/about/contact";
type NavScrollState = "top" | "hero" | "past";
type NavTone = "home" | "platform" | "company" | "commerce" | "resource" | "clinical";

function getNavTone(pathname: string): NavTone {
  if (pathname === "/") return "home";
  if (pathname === "/billing" || pathname === "/pricing" || pathname === "/donate") return "commerce";
  if (pathname.startsWith("/about")) return "company";
  if (pathname === "/download" || pathname.startsWith("/resources") || pathname.startsWith("/case-studies")) return "resource";
  if (pathname.startsWith("/products") || pathname === "/ehr" || pathname === "/pharmacy-lab") return "clinical";
  return "platform";
}

export default function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollState, setScrollState] = useState<NavScrollState>("top");
  const [lightHero, setLightHero] = useState(false);
  const pathname = usePathname();
  const tone = getNavTone(pathname);
  // Homepage hero is the deep-blue theme, so its nav matches that solid
  // color while you're within the hero, then switches to the standard
  // light "scrolled" bar once you scroll past the hero into the rest of
  // the page. (The nav is position:sticky, not overlapping the hero, so a
  // "transparent at top" state would just show the plain white page behind
  // it rather than the hero — solid is the reliable choice here.)
  const navClass = tone === "home"
    ? (scrollState === "past" ? "mk-navbar--scrolled" : "mk-navbar--hero-solid")
    : scrollState === "past"
      ? "mk-navbar--scrolled"
      : lightHero
        ? "mk-navbar--light-hero"
        : "mk-navbar--hero-solid";

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      const hero = document.querySelector<HTMLElement>(
        [
          ".mk-home-hero",
          ".mk-home-photo-hero",
          ".mk-mod-hero",
          ".mk-product-hero",
          ".mk-products-hero",
          ".mk-subpage-hero",
          ".mk-case-hero",
          ".mk-hero-split",
          ".mk-hero-donate",
          ".mk-hero-team",
          ".mk-hero-billing",
          ".mk-hero-telehealth",
          ".mk-hero-download",
          ".mk-hero-careers",
          ".mk-hero-pricing",
          ".mk-hero-contact",
          ".mk-hero-case-index",
          ".mk-hero-patient-experience",
          ".mk-hero-api-docs",
        ].join(", ")
      );
      const nav = document.querySelector<HTMLElement>(".mk-navbar");
      const navHeight = nav?.getBoundingClientRect().height ?? 80;
      const heroBottom = hero ? hero.offsetTop + hero.offsetHeight - navHeight : 0;
      const nextLightHero = Boolean(
        hero?.matches([
          ".mk-home-hero",
          ".mk-mod-hero--showcase",
          ".mk-mod-hero--data",
          ".mk-mod-hero--legal",
          ".mk-hero-contact",
          ".mk-hero-pricing",
          ".mk-hero-case-index",
          ".mk-hero-patient-experience",
        ].join(", "))
      );

      setLightHero((current) => current === nextLightHero ? current : nextLightHero);

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
      <nav className={`mk-navbar ${navClass} mk-navbar--tone-${tone}`}>
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

          {/* Desktop right: nav links grouped with the CTA */}
          <div className="mk-nav-actions desktop-only">
            <Link href="/products" className="mk-nav-item mk-nav-item-link">Product</Link>
            <Link href="/about" className="mk-nav-item mk-nav-item-link">About Us</Link>
            {SHOW_FUNDRAISING && (
              <>
                <div style={{ width: 1, height: 20, background: "var(--tb-cream-300)" }} />
                <Link
                  href="/donate"
                  className="mk-nav-donate-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--tb-gold-dark)",
                    textDecoration: "none",
                    padding: "7px 14px",
                    borderRadius: 8,
                    background: "var(--tb-tint-gold)",
                    border: "1px solid var(--tb-gold)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <DuoIcon name="heart" size={14} /> Fund Our Pilot
                </Link>
              </>
            )}
            <MarketingActionModalButton
              intent="demo"
              className="mk-btn mk-btn-green mk-btn-sm mk-nav-demo"
              source="nav-book-demo"
            >
              Get in touch
            </MarketingActionModalButton>
          </div>

          {/* Mobile hamburger */}
          <div className="mk-mobile-top-actions" aria-label="Mobile quick actions">
            <MarketingActionModalButton
              intent="demo"
              className="mk-mobile-top-demo"
              source="nav-mobile-book-demo"
            >
              Get in touch
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
              <Link href="/products" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
                Product
              </Link>
              <Link href="/about" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
                About Us
              </Link>

              <div className="mk-mobile-menu-divider" />
              <a href={PHONE_TEL} className="mk-mobile-phone" onClick={() => setMobileOpen(false)}>
                <DuoIcon name="phone" size={17} strokeWidth={1.8} aria-hidden="true" />
                {DISPLAY_PHONE}
              </a>

              {SHOW_FUNDRAISING && (
                <Link
                  href="/donate"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontSize: 15, fontWeight: 700, color: "var(--tb-gold-dark)",
                    textDecoration: "none", padding: "12px 0",
                    background: "var(--tb-tint-gold)", borderRadius: 10,
                    border: "1px solid var(--tb-gold)", textAlign: "center",
                  }}
                >
                  <DuoIcon name="heart" size={16} /> Fund Our Pilot
                </Link>
              )}

              <MarketingActionModalButton
                intent="demo"
                className="mk-btn mk-btn-green mk-mobile-cta"
                source="nav-mobile-menu-book-demo"
                onOpen={() => setMobileOpen(false)}
              >
                Get in touch
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

        .mk-mobile-group-label {
          margin: 4px 0 0;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--tb-text-muted);
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

        .mk-nav-donate-link:hover {
          background: var(--tb-gold) !important;
          color: #fff !important;
        }

        @media (max-width: 1120px) {
          .desktop-only { display: none !important; }
          .mk-mobile-toggle { display: block !important; }
        }
      `}</style>
    </>
  );
}
