"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DuoIcon } from "./DuoIcon";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Navbar (Simplified)
   Logo left, nav links center, CTA button right
   No dropdowns — flat structure
   Smooth scroll, shadow on scroll
   ═══════════════════════════════════════════════════════════════════ */

// Fundraising entry points are locked off for now. Flip to true to re-enable.
const SHOW_FUNDRAISING = false;

export default function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Main navbar */}
      <nav className="mk-navbar" style={{
        boxShadow: scrolled ? "0 4px 12px rgba(26,58,58,0.06)" : "none",
        transition: "box-shadow 0.3s ease",
      }}>
        <div className="mk-container mk-navbar-inner">
          {/* Logo */}
          <Link href="/" className="mk-nav-logo" aria-label="Tamam Healthcare System — home" style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/tamamhealth-logo-name.svg"
              alt="Tamam Healthcare System"
              height={40}
              style={{ height: 40, width: "auto", display: "block" }}
            />
          </Link>

          {/* Desktop center nav links */}
          <div className="mk-nav-center desktop-only">
            <Link href="/products" className="mk-nav-item">Product</Link>
            <Link href="/pricing" className="mk-nav-item">Pricing</Link>
            <Link href="/about" className="mk-nav-item">About</Link>
            <Link href="/about/contact" className="mk-nav-item">Contact</Link>
          </div>

          {/* Desktop right CTA actions */}
          <div className="mk-nav-actions desktop-only" style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  <DuoIcon name="heart" size={14} /> Fund Our Pilot
                </Link>
              </>
            )}
            <Link href="/download" className="mk-btn mk-btn-green mk-btn-sm">
              Open app
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="mk-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <DuoIcon name="x" size={24} /> : <DuoIcon name="menu" size={24} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div style={{
            background: "#fff",
            borderTop: "1px solid var(--tb-cream-300)",
            padding: "16px var(--tb-pad)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: "70vh",
            overflowY: "auto",
          }}>
            <Link href="/products" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
              Product
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

            <div style={{ height: 1, background: "var(--tb-cream-300)", margin: "8px 0" }} />

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

            <Link href="/download" className="mk-btn mk-btn-green" onClick={() => setMobileOpen(false)}>
              Open app
            </Link>
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
          transition: color 0.2s ease;
        }

        .mk-nav-item:hover {
          color: var(--tb-blue-700);
        }

        .mk-mobile-toggle {
          display: none;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          color: var(--tb-text);
        }

        .mk-mobile-link {
          font-size: 15px;
          font-weight: 500;
          color: var(--tb-text);
          text-decoration: none;
          padding: 10px 0;
          display: block;
          transition: color 0.2s ease;
        }

        .mk-mobile-link:hover {
          color: var(--tb-blue-700);
        }

        .mk-nav-donate-link:hover {
          background: var(--tb-gold) !important;
          color: #fff !important;
        }

        @media (max-width: 959.98px) {
          .desktop-only { display: none !important; }
          .mk-mobile-toggle { display: block !important; }
        }
      `}</style>
    </>
  );
}
