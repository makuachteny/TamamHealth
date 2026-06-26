"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Reveal,
  FAQItem,
  CheckItem,
  TestimonialSwoosh,
} from "@/components/marketing/MarketingShared";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Analytics & Reporting Product Page
   Healthcare analytics and reporting module showcase
   ═══════════════════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  return (
    <>
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="mk-hero" id="demo">
        <div className="mk-container">
          <div className="mk-hero-flex">
            {/* Left: Headline + Description */}
            <div className="mk-hero-content">
              <span className="mk-label">ANALYTICS & REPORTING</span>
              <h1 className="mk-h1">
                Transform data into action — MOH reporting, clinical insights, and real-time dashboards
              </h1>
              <p className="mk-body-lg">
                Health systems in South Sudan spend days manually compiling DHIS2 reports, have no visibility into quality metrics, and can&apos;t track financial performance. TamamHealth Analytics automatically exports to DHIS2, delivers real-time clinical dashboards, and identifies patterns that improve patient outcomes — all with zero manual data work.
              </p>
              <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "24px 0 32px" }}>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  90% Faster MOH Reporting
                </div>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  DHIS2 Compliant
                </div>
              </div>
              <div style={{ marginTop: 32 }}>
                <Link href="/about/contact" className="mk-btn mk-btn-green mk-btn-lg">
                  See DHIS2 dashboard demo
                </Link>
              </div>
            </div>

            {/* Center: Hero Photo */}
            <div className="mk-hero-photo">
              <Reveal delay={0.15}>
                <Image
                  src="/assets/african-nurse.jpg"
                  alt="Healthcare professional reviewing analytics data"
                  width={260}
                  height={380}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                  priority
                />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="mk-section mk-section-white" style={{ backgroundColor: "var(--tb-cream-100)" }}>
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              Analytics that empowers better health decisions
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>1</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Data flows automatically
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Patient data from EHR, billing, pharmacy, and labs automatically feeds analytics engine. No manual data entry. Updated daily.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>2</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  MOH gets reports automatically
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  TamamHealth automatically exports aggregate data to DHIS2 daily. MOH gets compliance reports without your team lifting a finger.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>3</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  You see actionable insights
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Real-time dashboards show quality metrics, financial performance, population health, and where to improve. Make decisions on data, not guesses.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BEFORE/AFTER: Reporting Reality ────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              The analytics and reporting crisis in health systems
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, maxWidth: "1000px", margin: "0 auto" }}>
              <div style={{ backgroundColor: "var(--tb-red-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-red)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-red-dark)" }}>
                  Before: Manual Reporting Hell
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Staff manually extract data from Excel
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Takes 3 days to compile DHIS2 report
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Data in report doesn&apos;t match actual facility data
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ No visibility into quality metrics
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Can&apos;t identify problem areas
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Decisions made without data
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: "var(--tb-green-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-green)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-green-dark)" }}>
                  After: TamamHealth Analytics
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ DHIS2 exports automatically daily
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ MOH reporting time: zero manual work
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Data always accurate and current
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Real-time quality dashboards show readmission rates, mortality
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Spot trends immediately; intervene fast
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ All decisions backed by live data
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 1: DHIS2 Integration ──────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">DHIS2 Integration for Ministry of Health reporting</h2>
                <p className="mk-body">
                  Automatically export aggregate patient data to your national DHIS2 instance. Comply with Ministry of Health standards while eliminating manual data entry. Reduce reporting time by 90% and ensure data consistency across all health facilities.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Automated daily aggregate data exports to DHIS2</CheckItem>
                  <CheckItem>Compliance with MOH data standards and indicators</CheckItem>
                  <CheckItem>90% reduction in manual reporting time</CheckItem>
                  <CheckItem>Comprehensive audit trail for regulatory requirements</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/dashboard-screenshot.png"
                  alt="DHIS2 integration dashboard showing automated data exports"
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

      {/* ── FEATURE 2: Clinical Quality Dashboards ───────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Clinical quality dashboards with real-time metrics</h2>
                <p className="mk-body">
                  Monitor clinical performance across your entire system. Track readmission rates, medication errors, infection rates, and patient satisfaction — broken down by provider, unit, and time period. Automated alerts notify you when metrics fall below target thresholds.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Real-time readmission rate tracking and analysis</CheckItem>
                  <CheckItem>Medication error monitoring and prevention alerts</CheckItem>
                  <CheckItem>Healthcare-associated infection rate dashboards</CheckItem>
                  <CheckItem>Patient satisfaction metrics with actionable insights</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Provider reviewing clinical quality metrics on tablet"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 3: Population Health Analytics ────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Population health analytics for targeted interventions</h2>
                <p className="mk-body">
                  Segment your patient population by disease, age, geography, and risk score. Identify high-risk cohorts for targeted interventions. Predictive risk scoring flags high-risk patients before they develop complications, enabling proactive care management.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Advanced patient segmentation by multiple dimensions</CheckItem>
                  <CheckItem>Disease-specific cohort identification and tracking</CheckItem>
                  <CheckItem>Predictive risk scores for early intervention</CheckItem>
                  <CheckItem>Geographic and demographic analysis capabilities</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/village-community.jpg"
                  alt="Community health outreach program showing population health analytics"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 4: Financial Dashboards ────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Financial dashboards for revenue optimization</h2>
                <p className="mk-body">
                  Monitor critical revenue cycle metrics: days sales outstanding (DSO), denial rates, collection rates, and revenue by payor. Compare budget vs actuals and forecast cash flow with predictive models. Optimize your financial performance in real-time.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Days sales outstanding (DSO) tracking and forecasting</CheckItem>
                  <CheckItem>Denial rate analysis with root cause identification</CheckItem>
                  <CheckItem>Collection rate optimization by payor and provider</CheckItem>
                  <CheckItem>Budget vs actuals comparison and cash flow forecasting</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare team reviewing financial analytics"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 5: Custom Reports & KPIs ───────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Custom reports and KPIs without the complexity</h2>
                <p className="mk-body">
                  Build powerful reports with our drag-and-drop report builder. Combine data from multiple sources, set up custom KPIs specific to your organization, and schedule automated delivery via email or SMS. Export to Excel, PDF, or PowerPoint.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Drag-and-drop report builder for any metric or KPI</CheckItem>
                  <CheckItem>Integration with multiple data sources and systems</CheckItem>
                  <CheckItem>Scheduled automated delivery via email and SMS</CheckItem>
                  <CheckItem>Export to Excel, PDF, PowerPoint, and other formats</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-writing-notes.jpg"
                  alt="Healthcare provider generating custom clinical reports"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 6: Data Quality Monitoring ──────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Data quality monitoring and improvement</h2>
                <p className="mk-body">
                  Automated validation rules continuously monitor data quality and completeness across your system. Identify training gaps and data entry issues automatically. Ensure reliable reporting and regulatory compliance with comprehensive data quality dashboards.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Automated validation rules for data integrity</CheckItem>
                  <CheckItem>Completeness rate tracking by field and facility</CheckItem>
                  <CheckItem>Automated training need identification</CheckItem>
                  <CheckItem>Data quality trend analysis and improvement tracking</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-smiling.jpg"
                  alt="Provider monitoring data quality metrics"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── STATS SECTION ────────────────────────────────────────────── */}
      <section className="mk-stat-band">
        <div className="mk-container">
          <Reveal>
            <div className="mk-stat-row">
              <div className="mk-stat-badge">
                <strong>90%</strong>
                <span>Reporting time reduction</span>
              </div>
              <div className="mk-stat-badge">
                <strong>80+</strong>
                <span>Countries using DHIS2</span>
              </div>
              <div className="mk-stat-badge">
                <strong>45%</strong>
                <span>Data quality improvement</span>
              </div>
              <div className="mk-stat-badge">
                <strong>15 days</strong>
                <span>DSO improvement</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TESTIMONIAL SECTION ─────────────────────────────────────── */}
      <section className="mk-section mk-section-teal">
        <div className="mk-container">
          <Reveal>
            <div className="mk-testimonial-inner">
              <div className="mk-testimonial-swoosh">
                <TestimonialSwoosh />
              </div>

              <div className="mk-testimonial-quote">
                <div className="mk-quote-mark">&ldquo;</div>
                <blockquote>
                  Three months ago, my team spent 3 days every month compiling DHIS2 data and Excel spreadsheets, and we still got errors. Now TamamHealth exports automatically each day. We&apos;ve freed up 120 staff hours per year. More importantly, we now see real-time dashboards showing readmission rates, medication errors, and quality issues. We&apos;re making better decisions, catching problems faster, and reporting accurate data to the Ministry for the first time.
                </blockquote>
                <cite>
                  <strong>Dr. Amara Okonkwo</strong>
                  <span>Director of Health Information Systems, Central Region Health Authority</span>
                </cite>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ SECTION ─────────────────────────────────────────────── */}
      <section className="mk-faq-section">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2 mk-faq-title">Frequently asked questions</h2>

            <div className="mk-faq-list">
              <FAQItem
                question="How does the DHIS2 integration work?"
                answer="TamamHealth automatically extracts aggregate data from patient records and exports it daily to your national DHIS2 instance. The integration follows MOH standards and indicators, ensuring compliance with all reporting requirements. No manual data entry needed."
              />
              <FAQItem
                question="Can I create custom metrics and KPIs specific to my organization?"
                answer="Yes. Our drag-and-drop report builder allows you to create unlimited custom metrics and KPIs. You can combine data from multiple sources, set up scheduled delivery via email or SMS, and export to Excel, PDF, PowerPoint, or other formats."
              />
              <FAQItem
                question="How accurate are the predictive risk scores?"
                answer="Our predictive models are trained on clinical data and validated against real-world outcomes. Accuracy typically ranges from 78-85% depending on data quality and the specific prediction. We continuously refine the models as you input more data."
              />
              <FAQItem
                question="What happens if there are data quality issues?"
                answer="Our automated validation rules continuously monitor data completeness and quality. The system identifies issues at the source, flags them for correction, and provides training recommendations to staff. You get a comprehensive data quality dashboard showing completeness rates by field and facility."
              />
              <FAQItem
                question="Can I export reports in different formats?"
                answer="Yes. All reports can be exported to Excel, PDF, PowerPoint, and other common formats. You can schedule automated exports and delivery via email or SMS to stakeholders. This makes it easy to integrate with your existing workflows."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── RELATED PRODUCTS ────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              Analytics works best with clean data sources
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
              <div style={{ backgroundColor: "var(--tb-tint-blue)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  EHR Module
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Complete patient data in EHR feeds analytics. Quality metrics, readmission rates, and mortality tracking all depend on accurate clinical documentation.
                </p>
                <Link href="/ehr" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  Learn more
                </Link>
              </div>
              <div style={{ backgroundColor: "var(--tb-tint-gold)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Billing & Payments
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Financial metrics, denial rates, and revenue analysis depend on complete billing data. See your cash flow and payer performance in real-time.
                </p>
                <Link href="/billing" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  Learn more
                </Link>
              </div>
              <div style={{ backgroundColor: "var(--tb-tint-green)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  All TamamHealth Modules
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Every TamamHealth module — EHR, Pharmacy, Telehealth, Patient Experience — feeds clean data to Analytics. The more modules you use, the better your insights.
                </p>
                <Link href="/ehr" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  View all modules
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

    </>
  );
}
