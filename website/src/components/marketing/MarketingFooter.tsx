"use client";

import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/contact";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Footer (Simplified 3-column layout)
   Brand column + 3 link columns + bottom bar
   ═══════════════════════════════════════════════════════════════════ */

// Fundraising entry points are locked off for now. Flip to true to re-enable.
const SHOW_FUNDRAISING = false;

const SOCIAL_LINKS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/tamamhealth",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.94 8.98H3.8V20h3.14V8.98ZM5.37 7.48c1 0 1.62-.66 1.62-1.49-.02-.85-.62-1.49-1.6-1.49s-1.62.64-1.62 1.49c0 .83.62 1.49 1.58 1.49h.02ZM9.1 20h3.14v-6.15c0-.33.02-.66.12-.9.25-.66.83-1.34 1.8-1.34 1.27 0 1.78 1.01 1.78 2.48V20h3.14v-6.28c0-3.36-1.73-4.93-4.04-4.93-1.9 0-2.72 1.08-3.18 1.82h.02V8.98H9.1c.04 1.03 0 11.02 0 11.02Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/tamamhealth",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.82 10.47 20.9 2h-1.68l-6.15 7.35L8.16 2H2.5l7.43 11.13L2.5 22h1.68l6.5-7.76L15.84 22h5.66l-7.68-11.53Zm-2.3 2.75-.75-1.1-5.99-8.82h2.58l4.83 7.11.75 1.1 6.29 9.26h-2.58l-5.13-7.55Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/tamamhealth",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm8.9 1.7a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 7.2A4.8 4.8 0 1 1 12 16.8 4.8 4.8 0 0 1 12 7.2Zm0 2A2.8 2.8 0 1 0 12 14.8 2.8 2.8 0 0 0 12 9.2Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/tamamhealth",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.2 8.1V6.55c0-.75.5-.93.85-.93h2.16V2.13L14.23 2.1c-3.31 0-4.06 2.48-4.06 4.07V8.1H7.5v3.6h2.67V22h4.03V11.7h3.05l.4-3.6H14.2Z" fill="currentColor" />
      </svg>
    ),
  },
];

const FOOTER_GROUPS = [
  {
    heading: "Platform",
    links: [
      { label: "EHR & Clinical", body: "Registration, triage, consultation, and the record that ties them together.", href: "/ehr" },
      { label: "Pharmacy & Lab", body: "Stock, dispensing, orders, and results without leaving the chart.", href: "/pharmacy-lab" },
      { label: "Billing & Payments", body: "Charge capture and mobile money, reconciled automatically.", href: "/billing" },
      { label: "Telehealth", body: "Bring specialist care to facilities that can't staff it locally.", href: "/telehealth" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Our Story", body: "Why we're building for South Sudan first.", href: "/about" },
      { label: "Installation", body: "How a facility goes from paper to TamamHealth.", href: "/installation" },
      { label: "Pricing", body: "Straightforward packages for facilities of every size.", href: "/pricing#packages" },
      { label: "Case Studies", body: "Scenarios showing what changes when a facility goes digital.", href: "/case-studies" },
    ],
  },
] as const;

export default function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer-cta">
          <div>
            <p>Ready to build connected care?</p>
            <h2>See how TamamHealth can support clinical care, facility operations, and national reporting from one connected platform.</h2>
          </div>
          <Link href="/about/contact?intent=demo#contact-form" className="mk-footer-cta-button">
            Book a demo
          </Link>
        </div>
      </div>

      {/* Social band */}
      <div className="mk-footer-social-band">
        <div className="mk-container mk-footer-social-band-inner">
          <span>Connect with us</span>
          <div className="mk-footer-socials">
            {SOCIAL_LINKS.map((social) => (
              <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" className="mk-footer-social-link" aria-label={social.label}>
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mk-container">
        {/* Main footer content */}
        <div className="mk-footer-inner">
          {/* Brand column */}
          <div className="mk-footer-brand">
            <Link href="/" className="mk-nav-logo" style={{ textDecoration: "none" }} aria-label="TamamHealth — home">
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

            <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, margin: 0, maxWidth: 260 }}>
              Digital health infrastructure for connected care. Offline-first, secure, and built for real facilities.
            </p>

            {SHOW_FUNDRAISING && (
              <Link href="/donate" style={{ color: "var(--tb-gold)", fontWeight: 600, fontSize: 14 }}>Fund Our Pilot</Link>
            )}
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div className="mk-footer-links-column" key={group.heading}>
              <h5 className="mk-footer-column-heading">{group.heading}</h5>
              <nav className="mk-footer-nav mk-footer-nav-rich">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="mk-footer-nav-rich-link">
                    <strong>{link.label}</strong>
                    <span>{link.body}</span>
                  </Link>
                ))}
              </nav>
            </div>
          ))}

          {/* Email column */}
          <div className="mk-footer-contact">
            <h5 className="mk-footer-column-heading">Get in Touch</h5>
            <a href={SUPPORT_MAILTO} style={{ fontSize: 14, color: "var(--tb-text-sec)", textDecoration: "none", display: "block" }}>
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mk-footer-bottom">
          <span>Copyright &copy; {new Date().getFullYear()} TamamHealth Technologies</span>
          <div className="mk-footer-links">
            <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms &amp; Conditions</Link>
            <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
