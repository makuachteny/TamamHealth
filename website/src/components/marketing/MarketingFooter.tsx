"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Footer (Simplified 3-column layout)
   Brand column + 3 link columns + newsletter + bottom bar
   ═══════════════════════════════════════════════════════════════════ */

// Fundraising entry points are locked off for now. Flip to true to re-enable.
const SHOW_FUNDRAISING = false;

export default function MarketingFooter() {
  const [nlEmail, setNlEmail] = useState("");
  const [nlStatus, setNlStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [nlError, setNlError] = useState("");

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlEmail.trim() || !/\S+@\S+\.\S+/.test(nlEmail)) {
      setNlError("Please enter a valid email");
      setNlStatus("error");
      return;
    }
    setNlStatus("submitting");
    setNlError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nlEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(data.error || "Failed to subscribe");
      }
      setNlStatus("success");
      setNlEmail("");
    } catch (err: unknown) {
      setNlError(err instanceof Error ? err.message : "Something went wrong");
      setNlStatus("error");
    }
  };

  return (
    <footer className="mk-footer">
      <div className="mk-container">
        {/* Main footer content */}
        <div className="mk-footer-inner">
          {/* Brand column */}
          <div className="mk-footer-brand">
            <Link href="/" className="mk-nav-logo" style={{ textDecoration: "none" }}>
              <span className="mk-nav-logo-text">
                Tamam<span style={{ color: "#0d8844" }}>Health</span>
              </span>
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
              <Link href="/about/careers">Careers</Link>
              <Link href="/about/contact">Contact</Link>
              {SHOW_FUNDRAISING && (
                <Link href="/donate" style={{ color: "var(--tb-gold)", fontWeight: 600 }}>Fund Our Pilot</Link>
              )}
              <Link href="/resources/blog">Blog</Link>
              <Link href="/resources/case-studies">Case Studies</Link>
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

        {/* Newsletter signup section */}
        <div style={{
          background: "linear-gradient(135deg, var(--tb-blue-50) 0%, var(--tb-cream-50) 100%)",
          borderRadius: 12,
          padding: "40px",
          marginBottom: 40,
          border: "1px solid var(--tb-cream-300)",
        }}>
          <div style={{
            maxWidth: 500,
            margin: "0 auto",
            textAlign: "center",
          }}>
            <h3 style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--tb-text-pri)",
              marginBottom: 12,
            }}>
              Stay updated
            </h3>
            <p style={{
              fontSize: 14,
              color: "var(--tb-text-sec)",
              marginBottom: 20,
              lineHeight: 1.6,
            }}>
              Get the latest updates, insights, and product news delivered to your inbox.
            </p>
            {nlStatus === "success" ? (
              <div style={{
                background: "var(--tb-tint-green, #E8F5E9)",
                border: "1px solid var(--tb-green, #3B82F6)",
                borderRadius: 8,
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--tb-green, #3B82F6)",
                textAlign: "center",
              }}>
                You&apos;re subscribed! Check your inbox for a welcome email.
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={nlEmail}
                    onChange={(e) => { setNlEmail(e.target.value); if (nlStatus === "error") setNlStatus("idle"); }}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      border: `1px solid ${nlStatus === "error" ? "#DC2626" : "var(--tb-cream-300)"}`,
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: "inherit",
                      background: "var(--tb-white)",
                    }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={nlStatus === "submitting"}
                    style={{
                      padding: "12px 24px",
                      background: "var(--tb-green)",
                      color: "var(--tb-white)",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: nlStatus === "submitting" ? "not-allowed" : "pointer",
                      opacity: nlStatus === "submitting" ? 0.7 : 1,
                      transition: "background 0.2s ease",
                    }}>
                    {nlStatus === "submitting" ? "..." : "Subscribe"}
                  </button>
                </div>
                {nlError && (
                  <span style={{ fontSize: 12, color: "#DC2626" }}>{nlError}</span>
                )}
              </form>
            )}
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

