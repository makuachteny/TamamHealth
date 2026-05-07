"use client";

import Image from "next/image";
import {
  Reveal,
  FAQItem,
  DemoForm,
  TestimonialSwoosh,
  PricingBannerIcon,
} from "@/components/marketing/MarketingShared";
import { DuoIcon } from "@/components/marketing/DuoIcon";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Pricing / Get Pricing Page
   Pricing page with SVG icons and CSS variables
   ═══════════════════════════════════════════════════════════════════ */

export default function PricingPage() {
  return (
    <>
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="mk-hero">
        <div className="mk-container">
          <div className="mk-hero-flex">
            {/* Left: headline + subtext */}
            <div className="mk-hero-content">
              <Reveal>
                <h1 className="mk-h1">
                  Transparent pricing that grows with your practice
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mk-body-lg">
                  Every practice is different. That&apos;s why we customize your plan based on your size, specialty, and the modules you need. No hidden fees, no long-term lock-in — just pricing that makes sense.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="mk-body" style={{ color: "var(--tb-text-sec)", marginTop: 32 }}>
                  Fill out the form to get a personalized quote and schedule a free walkthrough of TamamHealth.
                </p>
              </Reveal>
            </div>

            {/* Center: Hero Photo */}
            <div className="mk-hero-photo">
              <Reveal delay={0.15}>
                <Image
                  src="/assets/doctor-tablet-smiling.jpg"
                  alt="Doctor smiling while reviewing pricing options"
                  width={220}
                  height={360}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                  priority
                />
              </Reveal>
            </div>

            {/* Right: DemoForm */}
            <div className="mk-hero-form">
              <Reveal delay={0.2}>
                <DemoForm />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY PRACTICES CHOOSE TamamHealth ──────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <h2 className="mk-h2">Why practices choose TamamHealth</h2>
              <p className="mk-body-lg" style={{ maxWidth: 600, margin: "24px auto 0", color: "var(--tb-text-sec)" }}>
                Healthcare providers trust TamamHealth to streamline operations and improve patient care while keeping costs manageable.
              </p>
            </div>
          </Reveal>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 32,
          }}>
            {[
              {
                icon: <DuoIcon name="target" size={64} />,
                title: "Transparent Pricing",
                description: "Every cost is clear from day one. Your plan scales predictably as your practice grows — no surprise invoices, no hidden add-ons.",
              },
              {
                icon: <DuoIcon name="rocket" size={64} />,
                title: "Fast Implementation",
                description: "Most practices are fully operational within two weeks. Our onboarding team handles data migration, staff training, and workflow setup.",
              },
              {
                icon: <DuoIcon name="users" size={64} />,
                title: "Dedicated Support",
                description: "A named support team that knows your practice by name. Available around the clock via phone, chat, and email.",
              },
              {
                icon: <DuoIcon name="shield-check" size={64} />,
                title: "Security & Compliance",
                description: "HIPAA-compliant infrastructure with ISO 27001 certification and native DHIS2 integration. Your patient data is protected at every layer.",
              },
            ].map((item, i) => {
              const iconStyles = [
                { background: "var(--tb-tint-blue)", color: "var(--tb-blue-700)" },
                { background: "var(--tb-tint-gold)", color: "var(--tb-gold-dark)" },
                { background: "var(--tb-tint-green)", color: "var(--tb-green-dark)" },
                { background: "var(--tb-blue-100)", color: "var(--tb-blue-900)" },
              ];
              return (
              <Reveal key={i} delay={0.05 * i}>
                <div style={{
                  background: "var(--tb-cream-50)",
                  border: "1px solid var(--tb-cream-300)",
                  borderRadius: 16,
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...iconStyles[i],
                  }}>
                    {item.icon}
                  </div>
                  <h3 className="mk-h3" style={{ fontSize: "1.25rem", margin: 0 }}>
                    {item.title}
                  </h3>
                  <p className="mk-body" style={{ color: "var(--tb-text-sec)", margin: 0 }}>
                    {item.description}
                  </p>
                </div>
              </Reveal>
            );
            })}
          </div>
        </div>
      </section>

      {/* ── WHAT'S INCLUDED ──────────────────────────────────────────– */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <h2 className="mk-h2">What&apos;s included in TamamHealth</h2>
              <p className="mk-body-lg" style={{ maxWidth: 600, margin: "24px auto 0", color: "var(--tb-text-sec)" }}>
                A complete healthcare management platform built to handle everything your practice needs.
              </p>
            </div>
          </Reveal>

          <div className="mk-module-grid">
            {[
              {
                icon: <DuoIcon name="ehr" size={44} />,
                title: "Clinical EHR",
                items: ["Customizable SOAP templates", "Clinical decision support", "Patient demographics & history", "Scheduling & calendar"],
              },
              {
                icon: <DuoIcon name="billing" size={44} />,
                title: "Billing & Payments",
                items: ["Automated claims submission", "Real-time eligibility checks", "Superbill generation", "Revenue cycle dashboard"],
              },
              {
                icon: <DuoIcon name="lab" size={44} />,
                title: "Lab & Imaging",
                items: ["Direct lab ordering", "Real-time results", "Imaging integration", "Trend analysis"],
              },
              {
                icon: <DuoIcon name="pharmacy" size={44} />,
                title: "Pharmacy",
                items: ["Electronic prescribing", "Drug interaction alerts", "Formulary management", "Refill tracking"],
              },
              {
                icon: <DuoIcon name="video" size={44} />,
                title: "Telehealth",
                items: ["HD video visits", "Virtual waiting rooms", "Secure messaging", "Session recordings"],
              },
              {
                icon: <DuoIcon name="analytics" size={44} />,
                title: "Analytics",
                items: ["DHIS2 reporting", "Custom dashboards", "Population health", "Financial analytics"],
              },
            ].map((module, i) => {
              const modIconStyles = [
                { background: "var(--tb-tint-blue)", color: "var(--tb-blue-700)" },
                { background: "var(--tb-tint-gold)", color: "var(--tb-gold-dark)" },
                { background: "var(--tb-tint-green)", color: "var(--tb-green-dark)" },
                { background: "var(--tb-blue-100)", color: "var(--tb-blue-900)" },
                { background: "var(--tb-tint-gold)", color: "var(--tb-gold-dark)" },
                { background: "var(--tb-tint-green)", color: "var(--tb-green-dark)" },
              ];
              return (
              <Reveal key={i} delay={0.05 * i}>
                <div className="mk-module-card">
                  <div className="mk-module-card-icon" style={modIconStyles[i]}>
                    {module.icon}
                  </div>
                  <h3 className="mk-h3" style={{ fontSize: "1.25rem", margin: 0 }}>
                    {module.title}
                  </h3>
                  <ul className="mk-check-list">
                    {module.items.map((item, j) => (
                      <li key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9375rem", color: "var(--tb-text-sec)" }}>
                        <DuoIcon name="check" size={16} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING TIERS ───────────────────────────────────────────– */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <h2 className="mk-h2">Flexible pricing for practices of any size</h2>
              <p className="mk-body-lg" style={{ maxWidth: 600, margin: "24px auto 0", color: "var(--tb-text-sec)" }}>
                Start free, scale affordably. All plans include offline functionality, unlimited patient records, and core EHR features.
              </p>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, maxWidth: 1200, margin: "0 auto" }}>
            <PricingCard
              name="Community"
              price="Free"
              period="forever"
              description="For small clinics and health posts getting started"
              features={[
                "Up to 3 users",
                "Up to 500 patient records",
                "Core clinical EHR",
                "Basic reporting",
                "Email support",
                "Offline-first functionality"
              ]}
              cta="Start free"
              highlight={false}
            />
            <PricingCard
              name="Professional"
              price="$299"
              period="/month"
              description="For established clinics scaling their operations"
              features={[
                "Up to 20 users",
                "Unlimited patient records",
                "Full clinical EHR + billing",
                "Lab & pharmacy integration",
                "Advanced reporting & analytics",
                "DHIS2 integration",
                "Priority email support",
                "Custom SOAP templates"
              ]}
              cta="Get started"
              highlight={true}
              badge="Most popular"
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              period="pricing"
              description="For health systems and large networks"
              features={[
                "Unlimited users & locations",
                "Unlimited patient records",
                "All features included",
                "Telehealth & advanced modules",
                "White-label options",
                "24/7 phone support",
                "Dedicated account manager",
                "Custom integrations"
              ]}
              cta="Contact sales"
              highlight={false}
            />
          </div>

          <Reveal delay={0.3}>
            <div style={{ textAlign: "center", marginTop: 56, padding: "32px 40px", background: "var(--tb-tint-green)", borderRadius: 16, maxWidth: 700, margin: "56px auto 0" }}>
              <p style={{ fontSize: 16, color: "var(--tb-green)", fontWeight: 600, margin: "0 0 8px" }}>Money-back guarantee</p>
              <p style={{ margin: 0, color: "var(--tb-text)", lineHeight: 1.6 }}>
                Not satisfied in your first 90 days? We&apos;ll refund your setup costs and help you migrate your data. We&apos;re confident you&apos;ll love TamamHealth.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE COMPARISON ──────────────────────────────────────– */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 56 }}>Feature comparison</h2>
          </Reveal>
          <Reveal>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--tb-border)" }}>
                    <th style={{ textAlign: "left", padding: "16px", fontWeight: 600, color: "var(--tb-text)" }}>Feature</th>
                    <th style={{ textAlign: "center", padding: "16px", fontWeight: 600, color: "var(--tb-text)" }}>Community</th>
                    <th style={{ textAlign: "center", padding: "16px", fontWeight: 600, color: "var(--tb-green)", background: "var(--tb-tint-green)", borderRadius: "8px 0 0 0" }}>Professional</th>
                    <th style={{ textAlign: "center", padding: "16px", fontWeight: 600, color: "var(--tb-text)" }}>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Patient records", "Up to 500", "Unlimited", "Unlimited"],
                    ["Users", "Up to 3", "Up to 20", "Unlimited"],
                    ["Clinical EHR", "Yes", "Yes", "Yes"],
                    ["Offline functionality", "Yes", "Yes", "Yes"],
                    ["Billing & claims", "No", "Yes", "Yes"],
                    ["Lab integration", "No", "Yes", "Yes"],
                    ["Pharmacy module", "No", "Yes", "Yes"],
                    ["Telehealth", "No", "Add-on", "Yes"],
                    ["DHIS2 reporting", "Basic", "Advanced", "Custom"],
                    ["Email support", "Yes", "Yes", "Yes"],
                    ["Priority support", "No", "Yes", "Yes"],
                    ["Phone support 24/7", "No", "No", "Yes"],
                    ["Dedicated account manager", "No", "No", "Yes"],
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--tb-border)" }}>
                      <td style={{ padding: "16px", color: "var(--tb-text-sec)", fontWeight: 500 }}>{row[0]}</td>
                      <td style={{ padding: "16px", textAlign: "center", color: row[1] === "No" ? "var(--tb-text-muted)" : "var(--tb-text)" }}>
                        {row[1] === "Yes" ? "✓" : row[1] === "No" ? "—" : row[1]}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center", color: row[2] === "No" ? "var(--tb-text-muted)" : "var(--tb-green)", background: "var(--tb-cream-50)", fontWeight: row[2] === "Yes" ? 600 : 400 }}>
                        {row[2] === "Yes" ? "✓" : row[2] === "No" ? "—" : row[2]}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center", color: row[3] === "No" ? "var(--tb-text-muted)" : "var(--tb-text)" }}>
                        {row[3] === "Yes" ? "✓" : row[3] === "No" ? "—" : row[3]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TESTIMONIAL SECTION ──────────────────────────────────────– */}
      <section className="mk-section mk-section-teal mk-testimonial">
        <div className="mk-container">
          <Reveal>
            <div className="mk-testimonial-inner">
              <div className="mk-testimonial-swoosh">
                <TestimonialSwoosh />
              </div>
              <div className="mk-testimonial-quote">
                <span className="mk-quote-mark">&ldquo;</span>
                <blockquote>
                  TamamHealth transformed how we manage patient care. Administrative time is down 40%, claim denials have dropped significantly, and our team can finally focus on what matters most — our patients.
                </blockquote>
                <cite>
                  <strong>Dr. Amina Hassan</strong>
                  <span>Primary Care Physician, Khartoum Medical Center</span>
                </cite>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PRICING FAQ ──────────────────────────────────────────────– */}
      <section className="mk-faq-section">
        <div className="mk-container">
          <Reveal>
            <div style={{ marginBottom: 48 }}>
              <Image
                src="/assets/dashboard-screenshot.png"
                alt="Data analytics dashboard showing healthcare metrics"
                width={800}
                height={400}
                style={{ width: "100%", height: "auto", borderRadius: 12 }}
              />
            </div>
          </Reveal>
          <Reveal>
            <h2 className="mk-h2 mk-faq-title">Frequently asked questions about pricing</h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mk-faq-list">
              <FAQItem
                question="Is there a free trial?"
                answer="Yes! The Community tier is free forever for small clinics. It includes offline EHR, basic reporting, and email support. Upgrade to Professional anytime to unlock billing, lab integration, and advanced features."
              />
              <FAQItem
                question="Can I switch plans or add more users later?"
                answer="Absolutely. Your plan scales with your practice. Add users, upgrade to Professional, or expand module coverage at any time. Changes take effect immediately, and we'll prorate any adjustments."
              />
              <FAQItem
                question="What's included in implementation?"
                answer="Implementation includes: system setup customized to your workflows, data migration from existing systems, staff training sessions, and 30 days of onboarding support. Most practices are fully operational within 2 weeks."
              />
              <FAQItem
                question="Do you offer discounts for nonprofits or government facilities?"
                answer="Yes. We offer special pricing for government health centers, NGOs, and research institutions committed to improving healthcare in South Sudan. Contact our sales team to discuss your organization."
              />
              <FAQItem
                question="What payment terms do you offer?"
                answer="We offer monthly, quarterly, or annual billing. Annual prepayment gets a 10% discount. For government and nonprofit customers, we can arrange payment terms that work with your budget cycles."
              />
              <FAQItem
                question="What's included in support?"
                answer="Community: email support, 24-48 hour response. Professional: priority email support, 4-12 hour response. Enterprise: 24/7 phone support, dedicated account manager, and custom training."
              />
              <FAQItem
                question="Is there a minimum contract length?"
                answer="Community is month-to-month, no commitment. Professional and Enterprise plans include a 12-month initial commitment with flexible renewal options. We can discuss shorter terms for specific circumstances."
              />
              <FAQItem
                question="What if I'm not happy with TamamHealth?"
                answer="We offer a 90-day money-back guarantee on setup and implementation costs. We're confident in our product, but if it's not right for you, we'll refund your investment and help migrate your data."
              />
              <FAQItem
                question="Can I integrate TamamHealth with my existing systems?"
                answer="Yes. TamamHealth supports DHIS2, HL7/FHIR, and can integrate with lab networks, pharmacies, and imaging systems. Custom integrations are available for Enterprise customers."
              />
              <FAQItem
                question="How do you handle offline functionality pricing?"
                answer="Offline-first technology is included in all plans — no add-on fees. Every TamamHealth installation works fully offline and automatically syncs when connectivity returns."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA SECTION ──────────────────────────────────────────────– */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-pricing-banner">
              <div>
                <PricingBannerIcon />
              </div>
              <div>
                <h3 className="mk-h3" style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>
                  See TamamHealth in action
                </h3>
                <p className="mk-body" style={{ margin: 0, color: "var(--tb-text-sec)" }}>
                  Schedule a personalized demo and get a custom quote for your practice.
                </p>
              </div>
              <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-lg">
                Get Your Quote
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </>
  );
}

/* ── Components ──────────────────────────────────────────────────── */

function PricingCard({ name, price, period, description, features, cta, highlight, badge }: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlight: boolean;
  badge?: string;
}) {
  return (
    <Reveal>
      <div style={{
        background: highlight ? "white" : "var(--tb-cream-50)",
        border: highlight ? "2px solid var(--tb-green)" : "1px solid var(--tb-cream-300)",
        borderRadius: 16,
        padding: 40,
        position: "relative",
        transform: highlight ? "scale(1.02)" : "scale(1)",
        boxShadow: highlight ? "0 20px 60px rgba(10,61,107,0.15)" : "none",
      }}>
        {badge && (
          <div style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--tb-gold)",
            color: "white",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em"
          }}>
            {badge}
          </div>
        )}
        <h3 className="mk-h3" style={{ fontSize: "1.5rem", marginBottom: 8 }}>{name}</h3>
        <p style={{ color: "var(--tb-text-sec)", fontSize: 15, margin: "0 0 24px" }}>{description}</p>
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: "2.5rem", fontFamily: "var(--tb-serif)", fontWeight: 700 }}>{price}</span>
          <span style={{ fontSize: 14, color: "var(--tb-text-sec)", marginLeft: 8 }}>{period}</span>
        </div>
        <button className="mk-btn mk-btn-green mk-btn-lg" style={{ width: "100%", marginBottom: 32 }}>
          {cta}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map((feature, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <DuoIcon name="check" size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.4 }}>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
