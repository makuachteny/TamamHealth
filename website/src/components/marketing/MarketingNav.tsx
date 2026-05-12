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
          <Link href="/" className="mk-nav-logo">
            <TamamHealthLogoNav />
            <span className="mk-nav-logo-wordmark">
              <span className="mk-nav-logo-text">
                Tamam<span style={{ color: "#5EC38A" }}>Health</span>
              </span>
              <span className="mk-nav-logo-tagline">Digital Records System</span>
            </span>
          </Link>

          {/* Desktop center nav links */}
          <div className="mk-nav-center desktop-only">
            <Link href="/products" className="mk-nav-item">Services</Link>
            <Link href="/ehr" className="mk-nav-item">Platform</Link>
            <Link href="/case-studies" className="mk-nav-item">Case Studies</Link>
            <Link href="/about" className="mk-nav-item">About</Link>
            <Link href="/about/contact" className="mk-nav-item">Contact</Link>
          </div>

          {/* Desktop right CTA actions */}
          <div className="mk-nav-actions desktop-only" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, color: "var(--tb-text-sec)",
                whiteSpace: "nowrap",
              }}
            >
              <DuoIcon name="phone" size={14} />
              +1 (973) 566-4336
            </span>
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
            <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-sm">
              Request a Demo
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
              Products
            </Link>
            <Link href="/ehr" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
              Platform
            </Link>
            <Link href="/case-studies" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
              Case Studies
            </Link>
            <Link href="/about" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
              About
            </Link>
            <Link href="/about/team" className="mk-mobile-link" onClick={() => setMobileOpen(false)}>
              Team
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

            <Link href="/about/contact" className="mk-btn mk-btn-green" onClick={() => setMobileOpen(false)}>
              Request a Demo
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

/* ── Inline SVG Icons ──────────────────────────────────────────── */
function TamamHealthLogoNav() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" width="36" height="36">
      <circle cx="60" cy="60" r="58" fill="#1E4D4A"/>
      <circle cx="60" cy="60" r="54" fill="#1A3A3A"/>
      <circle cx="60" cy="60" r="50" fill="none" stroke="url(#navLogoRingGrad)" strokeWidth="3"/>
      <polygon points="60,18 65,38 86,38 69,49 75,68 60,56 45,68 51,49 34,38 55,38" fill="#E4A84B" opacity="0.15"/>
      <rect x="48" y="30" width="24" height="60" rx="4" fill="white"/>
      <rect x="30" y="48" width="60" height="24" rx="4" fill="white"/>
      <rect x="52" y="34" width="16" height="52" rx="2" fill="#2D9B6A"/>
      <rect x="34" y="52" width="52" height="16" rx="2" fill="#2D9B6A"/>
      <circle cx="60" cy="60" r="10" fill="#E4A84B"/>
      <polygon points="60,52 62.2,57.6 68,57.6 63.4,61.2 65.2,67 60,63.6 54.8,67 56.6,61.2 52,57.6 57.8,57.6" fill="#1A3A3A"/>
      <path d="M30,88 Q60,96 90,88" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M32,92 Q60,100 88,92" stroke="#E52E42" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M35,96 Q60,103 85,96" stroke="#2D9B6A" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <defs>
        <linearGradient id="navLogoRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E4A84B"/>
          <stop offset="50%" stopColor="#2D9B6A"/>
          <stop offset="100%" stopColor="#2E9E7E"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
