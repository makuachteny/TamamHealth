import Image from "next/image";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import {
  Reveal,
  CheckItem,
} from "@/components/marketing/MarketingShared";
import {
  FeatureFAQSection,
  FeatureRelatedProductsSection,
  FeatureStatsBand,
  FeatureTestimonialSection,
} from "@/components/marketing/FeatureSections";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Billing & Payments Product Page
   Revenue cycle management for healthcare in Africa
   ═══════════════════════════════════════════════════════════════════ */

export default function BillingPage() {
  return (
    <>
      <MarketingHero
        variant="impact"
        eyebrow="BILLING & PAYMENTS"
        title="Get paid in days, not months."
        subtitle="Smart claims and mobile money collection reduce denials, automate reconciliation, and give finance teams a clear view of every payment."
        primaryCta={{ label: "Calculate your savings", href: "/about/contact?intent=pricing#contact-form" }}
        stats={[
          { value: "65%", label: "fewer billing errors" },
          { value: "37%", label: "higher collections" },
          { value: "<5%", label: "claim denial target" },
        ]}
        image="/assets/doctor-prescription.jpg"
        imageAlt="Healthcare professional managing billing documentation"
        imagePriority
        className="mk-hero-billing"
      />

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="mk-section mk-section-white" style={{ backgroundColor: "var(--tb-cream-100)" }}>
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              How TamamHealth Billing transforms your revenue cycle
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#FEFFF9", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>1</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Smart claims, zero errors
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  AI catches billing errors before submission. Diagnosis-code mismatches, missing modifiers, and invalid combinations are fixed automatically — reducing denials from 12% to under 5%.
                </p>
              </div>
              <div style={{ background: "#FEFFF9", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>2</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Payments instantly matched
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  M-Pesa, MTN, and Airtel payments auto-reconcile to patient accounts. No more manual spreadsheet matching — payments are matched in real-time with full audit trails.
                </p>
              </div>
              <div style={{ background: "#FEFFF9", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>3</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Denials become revenue
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  AI categorizes denials and recommends appeal strategies. Track recovery by denial type. Typical ROI: $2-5 recovered for every $1 invested in appeals.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── BEFORE/AFTER: The Billing Reality ────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              The billing crisis: What we see in South Sudan
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, maxWidth: "1000px", margin: "0 auto" }}>
              <div style={{ backgroundColor: "var(--tb-red-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-red)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-red-dark)" }}>
                  Before: Revenue Hemorrhage
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ 12-18% of claims rejected for billing errors
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ M-Pesa payments manually matched to Excel spreadsheets
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Weeks to figure out what payment goes with which bill
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Denied claims abandoned — no time to appeal
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Cash flow unpredictable; staff salaries delayed
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Finance staff spend 80% of time on billing, 20% on strategy
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: "var(--tb-green-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-green)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-green-dark)" }}>
                  After: TamamHealth Billing
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Clean claim rate above 95%; denials below 5%
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ All mobile money payments auto-matched in seconds
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Real-time payment reconciliation dashboard
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ AI-recommended appeals recover $2-5 per $1 invested
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ 12-day average DSO; predictable monthly cash flow
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Finance team focuses on growth, not paperwork
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FEATURE 1: Claims Scrubbing & Automation ─────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Claims scrubbing & automation</h2>
                <p className="mk-body">
                  Pre-submission validation catches errors before they reach insurers. Our AI flags diagnosis-code mismatches, procedure-code conflicts, missing modifiers, and invalid combinations — reducing denials from 12% to under 5%.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>AI-powered diagnosis and procedure code validation</CheckItem>
                  <CheckItem>Automatic modifier suggestion and error flagging</CheckItem>
                  <CheckItem>Pre-submission compliance checking</CheckItem>
                  <CheckItem>Reduces claim denials from 12% to under 5%</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare team reviewing claims dashboard"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                  priority
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FEATURE 2: Real-Time Eligibility Verification ───────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Real-time eligibility verification</h2>
                <p className="mk-body">
                  Check insurance coverage, co-pays, deductibles, and benefits at patient registration — before treatment. For uninsured or under-insured patients, automatically trigger payment plan workflows to secure upfront commitment.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Instant insurance coverage verification at check-in</CheckItem>
                  <CheckItem>Co-pay, deductible, and benefits lookup</CheckItem>
                  <CheckItem>Automatic payment plan workflows for uninsured patients</CheckItem>
                  <CheckItem>Pre-authorization and referral checking</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/health-data.jpg"
                  alt="Real-time eligibility verification dashboard"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FEATURE 3: Mobile Money Integration ──────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Mobile money integration</h2>
                <p className="mk-body">
                  Accept M-Pesa, MTN Mobile Money, Airtel Money, and bank transfers directly from your billing system. Auto-reconciliation via encrypted APIs matches payments to claims in real-time, increasing collection rates by 37-45%.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>M-Pesa, MTN Mobile Money, Airtel Money, and bank transfer support</CheckItem>
                  <CheckItem>Automated payment reconciliation and settlement</CheckItem>
                  <CheckItem>Encrypted API connectivity to payment providers</CheckItem>
                  <CheckItem>Increases collection rates by 37-45%</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/community-health-worker.jpg"
                  alt="Community health worker processing mobile payment"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FEATURE 4: Intelligent Denial Management ────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Intelligent denial management</h2>
                <p className="mk-body">
                  Our AI categorizes denials by reason code and recommends the right appeal strategy. Track recovery rates by denial type and provider, turning denials into resubmissions. Typical ROI: $2-5 recovered for every $1 invested in appeals.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>AI-assisted denial categorization by reason code</CheckItem>
                  <CheckItem>Intelligent appeal routing and strategy recommendations</CheckItem>
                  <CheckItem>Recovery tracking and analytics by denial type</CheckItem>
                  <CheckItem>Recovers $2-5 per $1 invested in appeals</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Provider reviewing denial analytics on tablet"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FEATURE 5: Patient Payment Portal ───────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Patient payment portal</h2>
                <p className="mk-body">
                  Give patients self-service access to bills, payment options, and payment plans. Multi-language invoices, automated reminders, and one-click mobile money payments reduce follow-up burden and accelerate collections.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Self-service bill viewing and download</CheckItem>
                  <CheckItem>Multi-method payment acceptance (cards, mobile money, bank transfer)</CheckItem>
                  <CheckItem>Flexible payment plan setup and management</CheckItem>
                  <CheckItem>Automated reminders and multi-language invoices</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-smiling.jpg"
                  alt="Doctor reviewing patient payment portal"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mk-divider"></div>

      {/* ── FEATURE 6: Financial Reporting ──────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Financial reporting & insights</h2>
                <p className="mk-body">
                  Real-time dashboards show claim volume, clean claim rates, denial percentages, Days Sales Outstanding (DSO), collection rates, and revenue by provider. Predictive cash flow forecasting helps you plan ahead.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Real-time claim volume and clean claim rate dashboards</CheckItem>
                  <CheckItem>Days Sales Outstanding (DSO) and collection rate analytics</CheckItem>
                  <CheckItem>Revenue by provider, payer, and procedure type</CheckItem>
                  <CheckItem>Predictive cash flow forecasting and trend analysis</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-writing-notes.jpg"
                  alt="Medical records and filing system showing paperwork efficiency"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <FeatureStatsBand
        stats={[
          { value: "45%", label: "Insurance payment increase" },
          { value: "<5%", label: "Clean claim denial rate" },
          { value: "12 days", label: "Average Days Sales Outstanding" },
          { value: "37%", label: "Unpaid bill reduction" },
        ]}
      />

      <FeatureTestimonialSection
        testimonial={{
          quote: "Before TamamHealth, we spent 3 days a month manually reconciling M-Pesa payments against patient bills. Now it's automatic. We've cut claim denials from 14% to 3%, collections went up 38%, and our Days Sales Outstanding dropped from 35 days to 12 days. The system basically paid for itself in the first month.",
          name: "Sarah Malik",
          role: "Finance Director, Kampala Medical Clinic",
        }}
      />

      <FeatureFAQSection
        faqs={[
          {
            question: "Which mobile money providers do you support?",
            answer: "We integrate with M-Pesa, MTN Mobile Money, Airtel Money, and direct bank transfers. Our API integrations support both East Africa and West Africa payment corridors, with plans to add additional providers based on market demand.",
          },
          {
            question: "How does payment reconciliation work?",
            answer: "Payments are automatically matched to claims and patient accounts via our encrypted API connections to payment providers. You get a unified dashboard showing what came in, which bills were paid, and any discrepancies requiring follow-up.",
          },
          {
            question: "What are your mobile money fees?",
            answer: "Fees vary by provider and transaction type. We negotiate wholesale rates directly with M-Pesa, MTN, and Airtel to pass on the best margins to you. Schedule a demo for a detailed fee schedule customized to your volume.",
          },
          {
            question: "Can patients set up recurring payments?",
            answer: "Yes. Our patient portal supports one-time and recurring payment plans with flexible scheduling. Patients can authorize recurring mobile money deductions for installment plans, and our system automates reminders and reconciliation.",
          },
          {
            question: "How long does integration take?",
            answer: "Our standard integration takes 2-4 weeks depending on your current billing infrastructure. We provide API documentation, sandbox testing, and a dedicated integration specialist to ensure a smooth launch.",
          },
        ]}
      />

      <FeatureRelatedProductsSection
        heading="Maximize revenue with integrated solutions"
        products={[
          {
            title: "EHR Module",
            body: "Accurate clinical coding starts with complete documentation. TamamHealth EHR feeds clean data to billing and reduces denials.",
            href: "/ehr",
            tone: "blue",
          },
          {
            title: "Patient Experience",
            body: "Patient portal and automated billing reminders increase collection rates. Patients pay faster when given easy options.",
            href: "/patient-experience",
            tone: "gold",
          },
          {
            title: "Analytics & Reporting",
            body: "Real-time financial dashboards, denial trend analysis, and cash flow forecasting. See exactly where money is and why.",
            href: "/analytics",
            tone: "green",
          },
        ]}
      />

    </>
  );
}
