"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DuoIcon } from "./DuoIcon";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Navbar
   Two floating pills: a brand pill (round burger button + blue tamam
   wordmark) on the left, and a "Book a Demo" capsule on the right.
   The burger opens a dropdown with the site links — same pattern on
   every viewport size.
   ═══════════════════════════════════════════════════════════════════ */

// Fundraising entry points are locked off for now. Flip to true to re-enable.

const DISPLAY_PHONE = "(973) 566-4336";
const PHONE_TEL = "tel:+19735664336";
const DEMO_HREF = "/?intent=demo#contact-form";
type NavScrollState = "top" | "hero" | "past";
type NavTone = "home" | "platform" | "company" | "commerce" | "resource" | "clinical";

function getNavTone(pathname: string): NavTone {
  if (pathname === "/") return "home";
  if (pathname === "/donate") return "commerce";
  if (pathname.startsWith("/about")) return "company";
  if (pathname === "/download" || pathname.startsWith("/resources") || pathname.startsWith("/case-studies")) return "resource";
  if (pathname.startsWith("/products")) return "clinical";
  return "platform";
}

export default function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollState, setScrollState] = useState<NavScrollState>("top");
  const pathname = usePathname();
  const tone = getNavTone(pathname);
  const navRef = useRef<HTMLElement>(null);

  // Homepage: the landing photo runs behind the nav (the hero pulls itself
  // up under the sticky bar with a negative top margin), so the nav floats
  // transparent over the photo while you're within the hero, then switches
  // to the standard light "scrolled" bar once you scroll past it. The
  // pills carry their own white background, so they read on any surface.
  const navClass = tone === "home"
    ? (scrollState === "past" ? "mk-navbar--scrolled" : "mk-navbar--overlay")
    : scrollState === "past"
      ? "mk-navbar--scrolled"
      : "mk-navbar--light-hero";

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
          ".mk-platform-explorer",
          ".mk-subpage-hero",
          ".mk-case-hero",
          ".mk-hero-split",
          ".mk-hero-donate",
          ".mk-hero-team",
          ".mk-hero-download",
          ".mk-hero-careers",
          ".mk-hero-contact",
          ".mk-hero-case-index",
          ".mk-hero-patient-experience",
          ".mk-hero-api-docs",
        ].join(", ")
      );
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

  // Close the dropdown on navigation, outside click, or Escape.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <nav ref={navRef} className={`mk-navbar mk-navbar--pills ${navClass} mk-navbar--tone-${tone}`}>
      <div className="mk-container mk-navbar-inner">
        {/* Standalone white logo icon, inset to the hero container's left
            edge so it sits on the same line as the "Many communities…"
            heading (the navbar itself is full-bleed, the hero is capped). */}
        <Link
          href="/"
          className="mk-nav-home-icon"
          aria-label="Tamam Healthcare System — home"
        >
          {/* White over the blue hero; the blue mark takes over once the nav
              sits on a light background (scrolled / light-hero pages). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mk-nav-home-icon--white" src="/assets/tamamhealth-logo-icon-white.svg" alt="" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mk-nav-home-icon--blue" src="/assets/logos/SVG/Tamam_Style_Guide-33.svg" alt="" aria-hidden="true" />
        </Link>

        {/* Brand pill: burger opens the menu; the wordmark goes home. */}
        <div className="mk-pill-brand">
          <button
            type="button"
            className="mk-nav-burger"
            onClick={() => setMenuOpen(open => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            <DuoIcon name={menuOpen ? "x" : "menu"} size={20} strokeWidth={2.4} color="#fff" />
          </button>
          <Link href="/" className="mk-pill-brand-logo" aria-label="Tamam Healthcare System — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logos/SVG/Tamam_Style_Guide-31-blue.svg" alt="tamam" />
          </Link>

          {menuOpen && (
            <div className="mk-nav-menu-pop" role="menu">
              {/* One-page site: the menu scrolls to sections instead of routing. */}
              <Link href="/#products" role="menuitem" onClick={() => setMenuOpen(false)}>
                Product
              </Link>
              <Link href="/#about" role="menuitem" onClick={() => setMenuOpen(false)}>
                About Us
              </Link>
              <Link href="/#download" role="menuitem" onClick={() => setMenuOpen(false)}>
                Download
              </Link>
              <Link href="/#contact" role="menuitem" onClick={() => setMenuOpen(false)}>
                Get in touch
              </Link>
              <div className="mk-nav-menu-pop-divider" aria-hidden="true" />
              <a href={PHONE_TEL} className="mk-nav-menu-pop-phone" role="menuitem" onClick={() => setMenuOpen(false)}>
                <DuoIcon name="phone" size={15} strokeWidth={1.8} aria-hidden="true" />
                {DISPLAY_PHONE}
              </a>
            </div>
          )}
        </div>

        <Link href={DEMO_HREF} className="mk-pill-cta">
          <span>Book a Demo</span>
        </Link>

      </div>
    </nav>
  );
}
