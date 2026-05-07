"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Reveal,
  FAQItem,
  DemoForm,
  CheckItem,
  TestimonialSwoosh,
  PricingBannerIcon,
} from "@/components/marketing/MarketingShared";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Pharmacy & Lab Product Page
   Integrated pharmacy and lab management module matching Tebra design language
   ═══════════════════════════════════════════════════════════════════ */

export default function PharmacyLabPage() {
  return (
    <>
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="mk-hero" id="demo">
        <div className="mk-container">
          <div className="mk-hero-flex">
            {/* Left: Headline + Description */}
            <div className="mk-hero-content">
              <span className="mk-label">PHARMACY & LAB</span>
              <h1 className="mk-h1">
                Eliminate medication errors and lost lab results — smart ordering and real-time tracking
              </h1>
              <p className="mk-body-lg">
                Pharmacists in South Sudan compound medications by hand, clinicians handwrite prescriptions, and lab results are written on paper and misplaced. TamamHealth Pharmacy & Lab automates e-prescribing with drug interaction checking, tracks specimens from order to delivery, and delivers results in 24 hours — reducing errors by 48% and improving patient safety.
              </p>
              <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "24px 0 32px" }}>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  48% Fewer Medication Errors
                </div>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  24-Hour Lab Results
                </div>
              </div>
              <div style={{ marginTop: 32 }}>
                <Link href="#demo" className="mk-btn mk-btn-green mk-btn-lg">
                  See drug interaction demo
                </Link>
              </div>
            </div>

            {/* Center: Hero Photo */}
            <div className="mk-hero-photo">
              <Reveal delay={0.15}>
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Doctor and nurse reviewing pharmacy orders"
                  width={260}
                  height={380}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                  priority
                />
              </Reveal>
            </div>

            {/* Right: Demo Form */}
            <div className="mk-hero-form">
              <Reveal delay={0.2}>
                <DemoForm />
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
              The pharmacy & lab workflow
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>1</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Smart prescribing
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Clinician types prescription. System checks for drug interactions, allergies, and contraindications in real-time. Suggests lower-cost alternatives. Sends directly to pharmacy.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>2</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Instant lab ordering
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Order labs from the EHR with auto-generated specimen barcodes. System recommends tests based on diagnosis. Orders route automatically to partner labs.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>3</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Results in 24 hours
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Lab transmits results electronically. System auto-maps to patient chart. Critical values alert provider immediately. Patient sees results in portal.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BEFORE/AFTER: Pharmacy & Lab Reality ────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              Pharmacy & Lab challenges in South Sudan
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, maxWidth: "1000px", margin: "0 auto" }}>
              <div style={{ backgroundColor: "var(--tb-red-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-red)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-red-dark)" }}>
                  Before: Manual, Unsafe
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Clinician writes prescription by hand
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Pharmacist can&apos;t check drug interactions
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Medication errors go undetected
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Lab requisition on paper; often lost
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Results written on paper, filed incorrectly
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Critical results missed; patients harmed
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: "var(--tb-green-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-green)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-green-dark)" }}>
                  After: TamamHealth Pharmacy & Lab
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ E-prescription with automatic interaction checks
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ System alerts to drug conflicts before dispensing
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ 48% reduction in medication errors
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Lab orders transmitted electronically with barcodes
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Results auto-mapped to charts; zero lost results
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Critical results alert providers in real-time
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 1: E-Prescribing with Drug Interaction Checking ──── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">E-Prescribing with drug interaction checking</h2>
                <p className="mk-body">
                  Prescribe electronically with real-time drug interaction checking against your patient&apos;s full medication list. TamamHealth automatically checks for contraindications, allergy conflicts, and controlled substance protocols to reduce medication errors by 48%.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Real-time drug interaction alerts against full med list</CheckItem>
                  <CheckItem>Alternative medication suggestions for conflicts</CheckItem>
                  <CheckItem>Controlled substance workflow and audit trail</CheckItem>
                  <CheckItem>Dose validation and frequency checking</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-prescription.jpg"
                  alt="Doctor writing electronic prescription"
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

      {/* ── FEATURE 2: Integrated Formulary & Drug Database ────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Integrated formulary and drug database</h2>
                <p className="mk-body">
                  Access a centralized formulary with local drug names, generics, and cost data. TamamHealth auto-suggests lower-cost therapeutic alternatives and updates in real-time to reflect your pharmacy&apos;s current inventory and pricing.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Centralized formulary with local drug names</CheckItem>
                  <CheckItem>Auto-suggest lower-cost alternatives</CheckItem>
                  <CheckItem>Real-time formulary updates and pricing</CheckItem>
                  <CheckItem>Generic and brand name support</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Laboratory technician reviewing drug formulary and lab data"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 3: Lab Ordering via CPOE ────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Lab ordering via computerized provider order entry</h2>
                <p className="mk-body">
                  Order labs directly from the patient chart with clinical context. TamamHealth auto-recommends diagnostic panels based on diagnosis and patient profile, routes orders to your lab partner, and generates specimen barcodes automatically.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Order labs directly from EHR charting</CheckItem>
                  <CheckItem>Auto-recommend diagnostic panels and reflex tests</CheckItem>
                  <CheckItem>Automatic routing to lab systems</CheckItem>
                  <CheckItem>Specimen barcode generation and tracking</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Clinical team processing lab orders"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 4: Real-Time Lab Results ───────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Real-time lab results delivery</h2>
                <p className="mk-body">
                  Lab results transmit electronically within 24 hours and auto-map to patient charts. Critical value alerts notify providers immediately, and results appear in the patient portal for review after physician approval.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Electronic transmission within 24 hours</CheckItem>
                  <CheckItem>Automatic mapping to patient charts</CheckItem>
                  <CheckItem>Critical value alerts and notifications</CheckItem>
                  <CheckItem>Patient portal access after provider review</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Real-time lab results on mobile device"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 5: Pharmacy Stock Management ────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Pharmacy stock management</h2>
                <p className="mk-body">
                  Track pharmacy inventory in real-time with par level alerts and expiration date monitoring. TamamHealth integrates supply ordering and sends automated alerts when stock falls below set thresholds, ensuring you never run out of critical medications.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Real-time inventory tracking and visibility</CheckItem>
                  <CheckItem>Par level alerts and reorder reminders</CheckItem>
                  <CheckItem>Supply ordering integration with vendors</CheckItem>
                  <CheckItem>Expiration date tracking and waste alerts</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/community-health-worker.jpg"
                  alt="Pharmacy stock management and inventory"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 6: Clinical Decision Support ────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Clinical decision support and compliance</h2>
                <p className="mk-body">
                  Receive guideline-compliant testing recommendations based on diagnosis, patient age, and last test date. TamamHealth alerts clinicians to drug-disease interactions, preventing prescribing errors and improving patient safety.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Guideline-based testing recommendations by diagnosis</CheckItem>
                  <CheckItem>Age and comorbidity-specific diagnostic algorithms</CheckItem>
                  <CheckItem>Drug-disease interaction warnings</CheckItem>
                  <CheckItem>Compliance tracking for specialty protocols</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-writing-notes.jpg"
                  alt="Doctor portrait following clinical decision support guidelines"
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
                <strong>48%</strong>
                <span>Prescribing error reduction</span>
              </div>
              <div className="mk-stat-badge">
                <strong>24hr</strong>
                <span>Lab turnaround time</span>
              </div>
              <div className="mk-stat-badge">
                <strong>90%</strong>
                <span>Transcription error reduction</span>
              </div>
              <div className="mk-stat-badge">
                <strong>12%</strong>
                <span>Drug cost reduction</span>
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
                  Before TamamHealth, we had no way to catch medication errors until after patients took the wrong drugs. Now we&apos;re stopping dangerous interactions before prescriptions leave the clinic. Lab results come back in 24 hours instead of 2 weeks, and we don&apos;t lose orders anymore. Our pharmacy team is seeing fewer patient harms and our confidence is way up.
                </blockquote>
                <cite>
                  <strong>Sister Maria Lucia</strong>
                  <span>Pharmacy Director, Bentiu Health Centre</span>
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
                question="How does drug interaction checking work in resource-limited settings with informal pharmacies?"
                answer="TamamHealth's drug interaction engine checks against the patient's active medication list in their chart, not just pharmacy records. This catches interactions regardless of where medications were sourced, and our system supports local drug names and traditional formulations common in South Sudan."
              />
              <FAQItem
                question="Can TamamHealth sync with our existing laboratory information system (LIS)?"
                answer="Yes. We support HL7 and FHIR integrations with most commercial and open-source LIS platforms. Our team provides implementation support to ensure seamless two-way data flow of orders and results."
              />
              <FAQItem
                question="What happens if we need to request special approvals for certain drugs or lab tests?"
                answer="TamamHealth includes customizable approval workflows. You can configure rules requiring supervisor sign-off for controlled substances, expensive tests, or specialty medications. Approvals are tracked with full audit trails."
              />
              <FAQItem
                question="How do we manage pharmacy stock and supplies in TamamHealth?"
                answer="The Stock Management module tracks inventory in real-time, alerts staff when quantities fall below par levels, and integrates with supply ordering. You can also log manual adjustments for loss, waste, or inventory corrections."
              />
              <FAQItem
                question="Is the drug database updated regularly for new medications and pricing changes?"
                answer="Yes. We update the national drug formulary monthly and support custom formulary configurations for your facility. You can also upload local pricing and configure which drugs are available at your site."
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
              Amplify pharmacy & lab with complementary modules
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
              <div style={{ backgroundColor: "var(--tb-tint-blue)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  EHR Module
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Pharmacy & Lab integrates seamlessly with TamamHealth EHR. E-prescriptions appear in patient charts. Lab orders route from clinical notes. Results auto-populate.
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
                  Lab test orders and pharmacy charges automatically flow to billing. No more manual invoice creation. Clean claims and faster reimbursement.
                </p>
                <Link href="/billing" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  Learn more
                </Link>
              </div>
              <div style={{ backgroundColor: "var(--tb-tint-green)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Analytics & Reporting
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Track medication error trends, lab turnaround times, and inventory levels. Identify training needs and process improvements with real-time dashboards.
                </p>
                <Link href="/analytics" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  Learn more
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PRICING CTA BANNER ──────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-pricing-banner">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48 }}>
                <PricingBannerIcon />
              </div>
              <div>
                <h3 className="mk-h3" style={{ margin: "0 0 4px" }}>
                  Flexible module pricing for any clinic
                </h3>
                <p style={{ margin: 0, color: "var(--tb-text-sec)" }}>
                  Add Pharmacy & Lab to your EHR or use as a standalone module.
                </p>
              </div>
              <Link href="/pricing" className="mk-btn mk-btn-outline-green mk-btn-lg">
                View pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </>
  );
}
