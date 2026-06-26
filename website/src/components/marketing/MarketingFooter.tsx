"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Footer (Simplified 3-column layout)
   Brand column + 3 link columns + bottom bar
   ═══════════════════════════════════════════════════════════════════ */

// Fundraising entry points are locked off for now. Flip to true to re-enable.
const SHOW_FUNDRAISING = false;

export default function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        {/* Main footer content */}
        <div className="mk-footer-inner">
          {/* Brand column */}
          <div className="mk-footer-brand">
            <Link href="/" className="mk-nav-logo" style={{ textDecoration: "none" }} aria-label="TamamHealth — home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/tamamhealth-logo-name.svg"
                alt="Tamam Healthcare System"
                height={40}
                style={{ height: 40, width: "auto", display: "block" }}
              />
            </Link>

            <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, margin: 0, maxWidth: 260 }}>
              The digital health platform built for Africa. Offline-first. Clinician-designed.
            </p>

            {/* Social links */}
            <div className="mk-footer-socials">
              <a href="https://www.linkedin.com/company/tamamhealth" target="_blank" rel="noopener noreferrer" className="mk-footer-social-link" aria-label="LinkedIn">
                <Icon icon="logos:linkedin-icon" width={16} height={16} />
              </a>
              <a href="https://x.com/tamamhealth" target="_blank" rel="noopener noreferrer" className="mk-footer-social-link" aria-label="X / Twitter">
                <Icon icon="ri:twitter-x-fill" width={16} height={16} />
              </a>
              <a href="https://www.instagram.com/tamamhealth" target="_blank" rel="noopener noreferrer" className="mk-footer-social-link" aria-label="Instagram">
                <Icon icon="skill-icons:instagram" width={16} height={16} />
              </a>
              <a href="https://www.facebook.com/tamamhealth" target="_blank" rel="noopener noreferrer" className="mk-footer-social-link" aria-label="Facebook">
                <Icon icon="logos:facebook" width={16} height={16} />
              </a>
            </div>
          </div>

          {/* Platform column */}
          <div className="mk-footer-links-column">
            <h5 className="mk-footer-column-heading">Platform</h5>
            <nav className="mk-footer-nav">
              <Link href="/ehr">EHR &amp; Clinical</Link>
              <Link href="/billing">Billing &amp; Payments</Link>
              <Link href="/telehealth">Telehealth</Link>
              <Link href="/analytics">Analytics</Link>
              <Link href="/pharmacy-lab">Pharmacy &amp; Lab</Link>
              <Link href="/pricing">Pricing</Link>
            </nav>
          </div>

          {/* Company column */}
          <div className="mk-footer-links-column">
            <h5 className="mk-footer-column-heading">Company</h5>
            <nav className="mk-footer-nav">
              <Link href="/about">Our Story</Link>
              <Link href="/about/team">Team</Link>
              <Link href="/about/contact">Contact</Link>
              {SHOW_FUNDRAISING && (
                <Link href="/donate" style={{ color: "var(--tb-gold)", fontWeight: 600 }}>Fund Our Pilot</Link>
              )}
              <Link href="/case-studies">Case Studies</Link>
            </nav>
          </div>

          {/* Email column */}
          <div className="mk-footer-contact">
            <h5 className="mk-footer-column-heading">Get in Touch</h5>
            <a href="mailto:hello@tamamhealth.org" style={{ fontSize: 14, color: "var(--tb-text-sec)", textDecoration: "none", display: "block" }}>
              hello@tamamhealth.org
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mk-footer-bottom">
          <span>Copyright &copy; {new Date().getFullYear()} TamamHealth Health Technologies</span>
          <div className="mk-footer-links">
            <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms &amp; Conditions</Link>
            <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

