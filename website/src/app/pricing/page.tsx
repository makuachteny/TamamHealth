"use client";

import { MarketingHero } from "@/components/marketing/MarketingHero";
import {
  Reveal,
  FAQItem,
  TestimonialSwoosh,
} from "@/components/marketing/MarketingShared";
import { Target, Rocket, Users, ShieldCheck, FileText, CreditCard, FlaskConical, Pill, Video, BarChart3, Check } from "@/components/marketing/icons";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Pricing / Get Pricing Page
   Pricing page with SVG icons and CSS variables
   ═══════════════════════════════════════════════════════════════════ */

export default function PricingPage() {
  return (
    <>
      <MarketingHero
        variant="showcase"
        eyebrow="PRICING"
        title="Pricing shaped around your facility"
        subtitle="Every facility is different. Book a walkthrough and we will scope the right modules, rollout path, support model, and commercial terms with your team."
        primaryCta={{ label: "Request a quote", href: "/about/contact?intent=pricing#contact-form" }}
        secondaryCta={{ label: "See what's included", href: "#included" }}
        stats={[
          { value: "Scoped", label: "after walkthrough" },
          { value: "Modular", label: "by service need" },
          { value: "2 weeks", label: "typical onboarding" },
        ]}
        className="mk-hero-pricing"
      />

      {/* ── WHY PRACTICES CHOOSE TamamHealth ──────────────────────────────── */}
      <section className="mk-section mk-section-white" id="packages">
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
                icon: <Target size={64} strokeWidth={1.8} />,
                title: "Scoped pricing",
                description: "We quote after understanding your facility size, modules, users, and rollout needs, so the proposal matches the work instead of a generic package.",
              },
              {
                icon: <Rocket size={64} strokeWidth={1.8} />,
                title: "Fast Implementation",
                description: "Most practices are fully operational within two weeks. Our onboarding team handles data migration, staff training, and workflow setup.",
              },
              {
                icon: <Users size={64} strokeWidth={1.8} />,
                title: "Dedicated Support",
                description: "A named support team that knows your practice by name. Available around the clock via phone, chat, and email.",
              },
              {
                icon: <ShieldCheck size={64} strokeWidth={1.8} />,
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
      <section className="mk-section mk-pricing-included-section" id="included">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <h2 className="mk-h2">What&apos;s included in TamamHealth</h2>
              <p className="mk-body-lg" style={{ maxWidth: 600, margin: "24px auto 0" }}>
                A complete healthcare management platform built to handle everything your practice needs.
              </p>
            </div>
          </Reveal>

          <div className="mk-module-grid">
            {[
              {
                icon: <FileText size={44} strokeWidth={1.8} />,
                title: "Clinical EHR",
                items: ["Customizable SOAP templates", "Clinical decision support", "Patient demographics & history", "Scheduling & calendar"],
              },
              {
                icon: <CreditCard size={44} strokeWidth={1.8} />,
                title: "Billing & Payments",
                items: ["Automated claims submission", "Real-time eligibility checks", "Superbill generation", "Revenue cycle dashboard"],
              },
              {
                icon: <FlaskConical size={44} strokeWidth={1.8} />,
                title: "Lab & Imaging",
                items: ["Direct lab ordering", "Real-time results", "Imaging integration", "Trend analysis"],
              },
              {
                icon: <Pill size={44} strokeWidth={1.8} />,
                title: "Pharmacy",
                items: ["Electronic prescribing", "Drug interaction alerts", "Formulary management", "Refill tracking"],
              },
              {
                icon: <Video size={44} strokeWidth={1.8} />,
                title: "Telehealth",
                items: ["HD video visits", "Virtual waiting rooms", "Secure messaging", "Session recordings"],
              },
              {
                icon: <BarChart3 size={44} strokeWidth={1.8} />,
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
                  <ul className="mk-module-list">
                    {module.items.map((item, j) => (
                      <li key={j}>{item}</li>
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
              <h2 className="mk-h2">Packages designed around your rollout</h2>
              <p className="mk-body-lg" style={{ maxWidth: 600, margin: "24px auto 0", color: "var(--tb-text-sec)" }}>
                Compare the common starting points, then request pricing so we can confirm the right package after your walkthrough.
              </p>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, maxWidth: 1200, margin: "0 auto" }}>
            <PricingCard
              name="Community"
              packageLabel="Entry rollout"
              description="For small clinics and health posts getting started"
              features={[
                "Up to 3 users",
                "Starter patient record setup",
                "Core clinical EHR",
                "Basic reporting",
                "Email support",
                "Offline-first functionality"
              ]}
              highlight={false}
            />
            <PricingCard
              name="Professional"
              packageLabel="Most requested"
              description="For established clinics scaling their operations"
              features={[
                "Multi-team user setup",
                "Expanded patient record workflows",
                "Full clinical EHR + billing",
                "Lab & pharmacy integration",
                "Advanced reporting & analytics",
                "DHIS2 integration",
                "Priority email support",
                "Custom SOAP templates"
              ]}
              highlight={true}
              badge="Most popular"
            />
            <PricingCard
              name="Enterprise"
              packageLabel="Custom scope"
              description="For health systems and large networks"
              features={[
                "Unlimited users & locations",
                "Network-wide patient record workflows",
                "All features included",
                "Telehealth & advanced modules",
                "White-label options",
                "24/7 phone support",
                "Dedicated account manager",
                "Custom integrations"
              ]}
              highlight={false}
            />
          </div>

          <Reveal delay={0.3}>
            <div style={{ textAlign: "center", marginTop: 56, padding: "32px 40px", background: "var(--tb-tint-green)", borderRadius: 16, maxWidth: 700, margin: "56px auto 0" }}>
              <p style={{ fontSize: 16, color: "var(--tb-green)", fontWeight: 600, margin: "0 0 8px" }}>Pricing after walkthrough</p>
              <p style={{ margin: 0, color: "var(--tb-text)", lineHeight: 1.6 }}>
                Book a walkthrough first. We&apos;ll confirm your modules, users, sites, onboarding needs, and support model before sharing a practical quote.
              </p>
              <a href="/about/contact?intent=pricing#contact-form" className="mk-btn mk-btn-green" style={{ marginTop: 20, display: "inline-flex" }}>
                Request pricing
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE COMPARISON ──────────────────────────────────────– */}
      <section className="mk-section mk-section-cream" id="compare">
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
            <h2 className="mk-h2 mk-faq-title">Frequently asked questions about pricing</h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mk-faq-list">
              <FAQItem
                question="Is there a free trial?"
                answer="We usually start with a walkthrough and scoped pilot conversation. After we understand your facility, we can recommend the right package and commercial path."
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
                question="Do you support nonprofits or government facilities?"
                answer="Yes. We support government health centers, NGOs, and research institutions committed to improving healthcare in South Sudan. Contact our sales team to discuss the right structure for your organization."
              />
              <FAQItem
                question="What payment terms do you offer?"
                answer="Payment terms are discussed after the walkthrough. For government and nonprofit customers, we can arrange terms that work with your budget cycles."
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

    </>
  );
}

/* ── Components ──────────────────────────────────────────────────── */

function PricingCard({ name, packageLabel, description, features, highlight, badge }: {
  name: string;
  packageLabel: string;
  description: string;
  features: string[];
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
        <div style={{ marginBottom: 32, padding: "14px 16px", borderRadius: 12, background: highlight ? "var(--tb-tint-blue)" : "rgba(1,86,151,0.08)", border: "1px solid var(--tb-blue-100)" }}>
          <span style={{ fontSize: 13, color: "var(--tb-blue-800)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{packageLabel}</span>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--tb-text-sec)" }}>Pricing discussed after booking</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map((feature, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Check size={18} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.4 }}>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
