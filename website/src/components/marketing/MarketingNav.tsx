"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DuoIcon } from "./DuoIcon";

/* ═══════════════════════════════════════════════════════════════════
   Tamam Marketing — Navbar (Simplified)
   Logo left, nav links center, CTA button right
   No dropdowns — flat structure
   ═══════════════════════════════════════════════════════════════════ */

const PRODUCTS_LINKS = [
  { label: "Hospital Management System", href: "/products/hospital" },
  { label: "Clinic Management System", href: "/products/clinic" },
  { label: "Laboratory Information System", href: "/products/lab" },
  { label: "Pharmacy Management System", href: "/products/pharmacy" },
];

const COMPANY_LINKS = [
  { label: "Our Story", href: "/about" },
  { label: "Our Team", href: "/about/team" },
  { label: "Contact", href: "/about/contact" },
];

const DISPLAY_PHONE = "(973) 566-4336";
const PHONE_TEL = "tel:+19735664336";
const CONTACT_FORM_HREF = "/about/contact";
const PRICING_HREF = "/pricing";
type NavScrollState = "top" | "hero" | "past";
type NavTone = "home" | "platform" | "company" | "commerce" | "resource" | "clinical";

function getNavTone(pathname: string): NavTone {
  if (pathname === "/") return "home";
  if (pathname === "/pricing") return "commerce";
  if (pathname.startsWith("/about")) return "company";
  if (pathname.startsWith("/products")) return "clinical";
  return "platform";
}

export default function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollState, setScrollState] = useState<NavScrollState>("top");
  const [lightHero, setLightHero] = useState(false);
  const pathname = usePathname();
  const tone = getNavTone(pathname);
  const navClass = scrollState === "past"
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
          ".mk-mod-hero",
          ".mk-product-hero",
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
          {/* Logo */}
          <Link href="/" className="mk-nav-logo" aria-label="Tamam — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logos/SVG/Tamam_Style_Guide-33.svg"
              alt=""
              className="mk-nav-logo-mark"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logos/SVG/Tamam_Style_Guide-31.svg"
              alt="Tamam"
              className="mk-nav-logo-type"
            />
          </Link>

          {/* Desktop center nav links */}
          <div className="mk-nav-center desktop-only">
            <div className="mk-nav-item">
              <Link href="/products" className="mk-nav-item-link">Products</Link>
              <DuoIcon name="chevron-down" size={14} />
              <div className="mk-nav-dropdown">
                {PRODUCTS_LINKS.map((item) => (
                  <Link key={item.href} href={item.href}>{item.label}</Link>
                ))}
              </div>
            </div>
            <Link href="/pricing" className="mk-nav-item">Pricing</Link>
            <div className="mk-nav-item">
              <Link href="/about" className="mk-nav-item-link">Company</Link>
              <DuoIcon name="chevron-down" size={14} />
              <div className="mk-nav-dropdown">
                {COMPANY_LINKS.map((item) => (
                  <Link key={item.href} href={item.href}>{item.label}</Link>
                ))}
              </div>
            </div>
            <Link href="/about/contact" className="mk-nav-item">Contact</Link>
          </div>

          {/* Desktop right CTA actions */}
          <div className="mk-nav-actions desktop-only">
            <a href={PHONE_TEL} className="mk-nav-phone">
              <DuoIcon name="phone" size={17} strokeWidth={1.8} aria-hidden="true" />
              {DISPLAY_PHONE}
            </a>
            <Link href={PRICING_HREF} className="mk-btn mk-btn-sm mk-nav-pricing">
              Get pricing
            </Link>
            <Link href={CONTACT_FORM_HREF} className="mk-btn mk-btn-green mk-btn-sm mk-nav-demo">
              Get in touch
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="mk-mobile-top-actions" aria-label="Mobile quick actions">
            <Link href={PRICING_HREF} className="mk-mobile-top-pricing">
              Get pricing
            </Link>
            <Link href={CONTACT_FORM_HREF} className="mk-mobile-top-demo">
              Get in touch
            </Link>
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
                Products
              </Link>
              <Link href="/pricing" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
                Pricing
              </Link>
              <Link href="/about" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
                About
              </Link>
              <Link href="/about/contact" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
                Contact
              </Link>

              <div className="mk-mobile-menu-divider" />
              <a href={PHONE_TEL} className="mk-mobile-phone" onClick={() => setMobileOpen(false)}>
                <DuoIcon name="phone" size={17} strokeWidth={1.8} aria-hidden="true" />
                {DISPLAY_PHONE}
              </a>

              <Link
                href={PRICING_HREF}
                className="mk-btn mk-mobile-cta mk-mobile-pricing"
                onClick={() => setMobileOpen(false)}
              >
                Get pricing
              </Link>
              <Link
                href={CONTACT_FORM_HREF}
                className="mk-btn mk-btn-green mk-mobile-cta"
                onClick={() => setMobileOpen(false)}
              >
                Get in touch
              </Link>
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
