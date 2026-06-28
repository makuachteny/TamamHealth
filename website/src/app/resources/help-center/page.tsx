"use client";

import Link from "next/link";
import Image from "next/image";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import {
  Reveal,
  FAQItem,
} from "@/components/marketing/MarketingShared";
import { Rocket, FileText, CreditCard, Video, Settings, BarChart3, Search } from "@/components/marketing/icons";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Help Center Page
   Self-service support with knowledge base categories and articles
   ═══════════════════════════════════════════════════════════════════ */

export default function HelpCenterPage() {
  const categories = [
    {
      id: 1,
      title: "Getting Started",
      description: "Setup, initial configuration, first steps with TamamHealth",
      articleCount: 8,
      icon: <Rocket size={56} strokeWidth={1.8} />,
    },
    {
      id: 2,
      title: "EHR & Charting",
      description: "Patient charts, note templates, clinical workflows",
      articleCount: 12,
      icon: <FileText size={56} strokeWidth={1.8} />,
    },
    {
      id: 3,
      title: "Billing & Claims",
      description: "Claims submission, denials, payment processing",
      articleCount: 10,
      icon: <CreditCard size={56} strokeWidth={1.8} />,
    },
    {
      id: 4,
      title: "Telehealth",
      description: "Video visits, virtual waiting rooms, troubleshooting",
      articleCount: 7,
      icon: <Video size={56} strokeWidth={1.8} />,
    },
    {
      id: 5,
      title: "Admin & Settings",
      description: "Users, permissions, system configuration",
      articleCount: 9,
      icon: <Settings size={56} strokeWidth={1.8} />,
    },
    {
      id: 6,
      title: "Data & Reporting",
      description: "DHIS2 exports, analytics, dashboards",
      articleCount: 8,
      icon: <BarChart3 size={56} strokeWidth={1.8} />,
    },
  ];

  const popularArticles = [
    "Create your first patient record in under 2 minutes",
    "Set up staff roles so clinicians see only what they need",
    "Submit your first insurance claim and track payment",
    "Run your first video consultation on a 3G connection",
    "Migrate 10,000+ records from paper or another EHR",
    "How offline sync works: what happens when your internet drops",
    "Generate your monthly DHIS2 report in one click",
    "Set up the mobile app on any Android or iOS device",
  ];

  return (
    <>
      <MarketingHero
        variant="portal"
        eyebrow="HELP CENTER"
        title="How can we help?"
        subtitle="Search the knowledge base, browse troubleshooting articles, or reach out directly. Our support team responds within 4 business hours."
        primaryCta={{ label: "Browse topics", href: "#browse-topics" }}
        image="/assets/doctor-tablet-smiling.jpg"
        imageAlt="Support team helping a clinician"
        imagePriority
      >
        <div className="mk-help-search">
          <Search size={18} strokeWidth={1.8} />
          <input
            type="text"
            placeholder="Search articles, topics, troubleshooting..."
            aria-label="Search help articles"
          />
        </div>
      </MarketingHero>

      {/* ── SUPPORT CHANNELS BANNER ───────────────────────────────────── */}
      <section className="mk-stat-band">
        <div className="mk-container">
          <Reveal>
            <div className="mk-stat-row">
              <div className="mk-stat-badge">
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tb-text-pri)", marginBottom: 4 }}>Phone</div>
                <strong style={{ color: "var(--tb-blue-700)", fontSize: 18 }}>+1 (973) 566-4336</strong>
                <span style={{ fontSize: 12, color: "var(--tb-text-sec)", marginTop: 4, display: "block" }}>Mon-Fri, 9am-6pm</span>
              </div>
              <div className="mk-stat-badge">
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tb-text-pri)", marginBottom: 4 }}>Email</div>
                <strong style={{ color: "var(--tb-blue-700)", fontSize: 16 }}>support.tamam@gmail.com</strong>
                <span style={{ fontSize: 12, color: "var(--tb-text-sec)", marginTop: 4, display: "block" }}>2-hour response</span>
              </div>
              <div className="mk-stat-badge">
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tb-text-pri)", marginBottom: 4 }}>In-App Chat</div>
                <strong style={{ color: "var(--tb-green)", fontSize: 16 }}>24/7 Support</strong>
                <span style={{ fontSize: 12, color: "var(--tb-text-sec)", marginTop: 4, display: "block" }}>Instant help</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CATEGORIES SECTION ────────────────────────────────────────── */}
      <section className="mk-section mk-section-white" id="browse-topics">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ marginBottom: 40, textAlign: "center" }}>Browse by topic</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}>
              {categories.map((category, index) => (
                <Reveal key={category.id} delay={index * 0.05}>
                  <Link href="/about/contact#contact-form" style={{ textDecoration: "none" }}>
                    <div className="mk-product-card" style={{
                      background: "var(--tb-white)",
                      border: "1px solid var(--tb-cream-300)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}>
                      <div style={{
                        width: 56,
                        height: 56,
                        background: "var(--tb-blue-50)",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 16,
                      }}>
                        {category.icon}
                      </div>
                      <h3 className="mk-h3" style={{ marginBottom: 8 }}>
                        {category.title}
                      </h3>
                      <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 16, lineHeight: 1.6 }}>
                        {category.description}
                      </p>
                      <div style={{
                        fontSize: 12,
                        color: "var(--tb-blue-700)",
                        fontWeight: 600,
                      }}>
                        {category.articleCount} articles →
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── POPULAR ARTICLES SECTION ──────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2" style={{ marginBottom: 24 }}>Popular articles</h2>
                <div style={{ maxWidth: 600 }}>
                  {popularArticles.map((article, index) => (
                    <Reveal key={index} delay={index * 0.03}>
                      <Link
                        href="/resources/help-center"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 0",
                          borderBottom: "1px solid var(--tb-cream-300)",
                          textDecoration: "none",
                          transition: "color 0.2s ease",
                        }}
                      >
                        <span style={{ fontSize: 14, color: "var(--tb-text-pri)" }}>
                          {article}
                        </span>
                        <span style={{ fontSize: 16, color: "var(--tb-cream-400)", flexShrink: 0 }}>→</span>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-smiling.jpg"
                  alt="Healthcare support resources"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ SECTION ──────────────────────────────────────────────── */}
      <section className="mk-faq-section">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2 mk-faq-title">Frequently asked questions</h2>

            <div className="mk-faq-list">
              <FAQItem
                question="How do I reset my password?"
                answer="Click 'Forgot Password' on the login page and enter your email. You'll receive a password reset link within 2 minutes. Follow the link to create a new password. If you don't receive the email, check your spam folder or contact support."
              />
              <FAQItem
                question="Can I use TamamHealth offline?"
                answer="Yes. Our mobile apps (iOS and Android) support offline mode. Patient records, EHR templates, and charting features work without internet. Changes sync automatically when connectivity is restored."
              />
              <FAQItem
                question="How do I export data to DHIS2?"
                answer="Navigate to Data & Reporting, select DHIS2 Export, choose your date range and facilities, and click Export. Data exports as standardized DHIS2-compatible files. Contact support for custom mapping configurations."
              />
              <FAQItem
                question="What browsers does TamamHealth support?"
                answer="We support Chrome (v95+), Firefox (v91+), Safari (v14+), and Edge (v95+) on desktop. Mobile apps are available for iOS (14+) and Android (9+). For best performance, keep your browser and OS updated."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BOTTOM CTA SECTION ────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{
              maxWidth: 700,
              margin: "0 auto",
              textAlign: "center",
              padding: "48px 32px",
              background: "linear-gradient(135deg, var(--tb-blue-50) 0%, var(--tb-cream-50) 100%)",
              borderRadius: 12,
              border: "1px solid var(--tb-cream-300)",
            }}>
              <h2 className="mk-h2" style={{ marginBottom: 16 }}>Can&apos;t find what you need?</h2>
              <p style={{ marginBottom: 32, color: "var(--tb-text-sec)", fontSize: 15, lineHeight: 1.7 }}>
                Our dedicated support team is ready to assist you with any questions or issues. We&apos;re here to help you get the most out of TamamHealth.
              </p>
              <div style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
              }}>
                <span className="mk-btn mk-btn-green" style={{ cursor: "default" }}>
                  +1 (973) 566-4336
                </span>
                <a href="mailto:support.tamam@gmail.com" className="mk-btn mk-btn-outline">
                  Email Us
                </a>
                <a href="mailto:support.tamam@gmail.com" className="mk-btn mk-btn-outline">
                  Live Chat
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
