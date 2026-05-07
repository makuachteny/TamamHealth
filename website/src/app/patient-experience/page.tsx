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
   TamamHealth Patient Experience Product Page
   Patient engagement module showcase matching Tebra design language
   ═══════════════════════════════════════════════════════════════════ */

export default function PatientExperiencePage() {
  return (
    <>
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="mk-hero" id="demo">
        <div className="mk-container">
          <div className="mk-hero-flex">
            {/* Left: Headline + Description */}
            <div className="mk-hero-content">
              <span className="mk-label">PATIENT ENGAGEMENT</span>
              <h1 className="mk-h1">
                Stop losing patients at the front desk — digital scheduling, fast check-in, and SMS reminders that work offline
              </h1>
              <p className="mk-body-lg">
                South Sudan&apos;s clinics lose patients because booking requires a phone call, check-in takes 30 minutes of paperwork, and 40% of patients don&apos;t show up. TamamHealth Patient Experience enables SMS booking, cuts registration to under 5 minutes, and reduces no-shows with automated reminders — all in 4 local languages.
              </p>
              <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "24px 0 32px" }}>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  80% Faster Check-in
                </div>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  38% Fewer No-Shows
                </div>
              </div>
              <div style={{ marginTop: 32 }}>
                <Link href="#demo" className="mk-btn mk-btn-green mk-btn-lg">
                  Try the patient portal
                </Link>
              </div>
            </div>

            {/* Center: Hero Photo */}
            <div className="mk-hero-photo">
              <Reveal delay={0.15}>
                <Image
                  src="/assets/community-health-worker.jpg"
                  alt="Healthcare worker engaging with patients"
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
              Seamless patient journey from booking to care
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>1</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Patient books anytime, anywhere
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Via SMS, web, or phone. Available 24/7. Calendar syncs in real-time with provider schedules. Confirmation and reminder SMS.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>2</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Fast check-in on arrival
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Digital intake on tablet or kiosk. Adaptive forms ask only relevant questions. Auto-populate to EHR. Registration: 5 minutes instead of 30.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>3</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Care team focused on patients
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Less time on paperwork, more time on care. Secure messaging for follow-up. Portal access to results and health records.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BEFORE/AFTER: Patient Experience Reality ───────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              The patient experience problem
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, maxWidth: "1000px", margin: "0 auto" }}>
              <div style={{ backgroundColor: "var(--tb-red-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-red)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-red-dark)" }}>
                  Before: Friction at Every Step
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Patient must call to book (often no answer)
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Check-in requires 30+ minutes of paperwork
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Clinic staff transcribes forms into EHR manually
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ 40% of patients don&apos;t show up to appointments
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Patient has no access to results or medical history
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Billing confusion; patient questions pile up
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: "var(--tb-green-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-green)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-green-dark)" }}>
                  After: TamamHealth Patient Experience
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Patients book on SMS, web, or phone 24/7
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Check-in on tablet: 5 minutes, zero paperwork
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Form data auto-populates to EHR instantly
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ SMS reminders reduce no-shows by 38%
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Patients access portal; see results and records anytime
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Secure messaging answers questions fast
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 1: 24/7 Online Scheduling ────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">24/7 online scheduling</h2>
                <p className="mk-body">
                  Let patients book appointments anytime via web, mobile app, or SMS. Your calendar syncs in real-time with provider schedules, while configurable reminder rules reduce no-shows and keep your day running smoothly.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Web, mobile, and SMS booking options</CheckItem>
                  <CheckItem>Real-time calendar synchronization</CheckItem>
                  <CheckItem>Configurable reminder rules</CheckItem>
                  <CheckItem>No-show reduction and rescheduling</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-smiling.jpg"
                  alt="Doctor using patient scheduling on tablet"
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

      {/* ── FEATURE 2: Digital Intake & E-Signatures ────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Digital intake & e-signatures</h2>
                <p className="mk-body">
                  Adaptive intake forms respond to patient answers in real-time, reducing time from 20+ minutes to under 5. HIPAA-compliant e-signatures and auto-populated data flow directly into your EHR with zero manual entry.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Conditional logic intake forms</CheckItem>
                  <CheckItem>HIPAA-compliant e-signatures</CheckItem>
                  <CheckItem>Auto-population to EHR</CheckItem>
                  <CheckItem>Reduce registration time by 80%</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-writing-notes.jpg"
                  alt="Patient registration and digital intake at reception desk"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 3: Two-Way Patient Communication ──────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Two-way patient communication</h2>
                <p className="mk-body">
                  Enable secure messaging between patients and providers for routine questions, appointment follow-ups, and care coordination. Reduce phone volume by 30-40% while strengthening provider-patient relationships.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>HIPAA-compliant secure messaging</CheckItem>
                  <CheckItem>Integrated appointment follow-ups</CheckItem>
                  <CheckItem>Reduce phone volume 30-40%</CheckItem>
                  <CheckItem>Care team collaboration tools</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/community-health-worker.jpg"
                  alt="Community health worker communicating with patients"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 4: Patient Portal ───────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Patient portal</h2>
                <p className="mk-body">
                  Give patients secure, 24/7 access to their medical history, lab results, medications, and appointments. View visit summaries, manage health records, and communicate with care teams — all from one intuitive portal.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Secure health records access</CheckItem>
                  <CheckItem>Lab results and imaging viewing</CheckItem>
                  <CheckItem>Medication and appointment management</CheckItem>
                  <CheckItem>Visit summaries and care plans</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Mobile health app interface for patient portal access"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 5: Automated Reminders & Reviews ──────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Automated reminders & reviews</h2>
                <p className="mk-body">
                  Send multi-channel reminders via SMS, email, and voice to keep patients engaged. AI-powered review requests build trust, gather feedback, and attract new patients through authentic testimonials and recommendations.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Multi-channel reminder automation</CheckItem>
                  <CheckItem>AI-powered review requests</CheckItem>
                  <CheckItem>Automated follow-up monitoring</CheckItem>
                  <CheckItem>Patient feedback and testimonials</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare team reviewing patient engagement metrics"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 6: Multi-Language & Mobile-First ──────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Multi-language & mobile-first</h2>
                <p className="mk-body">
                  Serve diverse communities across South Sudan with support for English, Arabic, Nuer, and Dinka. Native iOS and Android apps with offline access and low-bandwidth optimization ensure every patient can engage, wherever they are.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Support for 4 languages</CheckItem>
                  <CheckItem>Native iOS and Android apps</CheckItem>
                  <CheckItem>Offline access and functionality</CheckItem>
                  <CheckItem>Low-bandwidth optimization</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Modern clinic waiting room showing patient experience"
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
                <strong>38%</strong>
                <span>No-show reduction</span>
              </div>
              <div className="mk-stat-badge">
                <strong>&lt;5 min</strong>
                <span>Registration time</span>
              </div>
              <div className="mk-stat-badge">
                <strong>65%</strong>
                <span>Portal adoption</span>
              </div>
              <div className="mk-stat-badge">
                <strong>4</strong>
                <span>Languages supported</span>
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
                  TamamHealth changed our clinic from chaotic to smooth. Patients book via SMS without calling. Our receptionist used to spend 6 hours a day entering forms; now it takes 30 minutes. No-shows dropped 38%. Patients love checking their results on the portal instead of calling us. Our team is happier because they&apos;re doing healthcare work, not paperwork. It&apos;s the best investment we made.
                </blockquote>
                <cite>
                  <strong>Dr. Amira Hassan</strong>
                  <span>Chief of Patient Services, Kosti Health Clinic</span>
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
                question="How do adaptive intake forms work?"
                answer="Our intake system uses conditional logic to show or hide questions based on patient responses. This dramatically reduces form length and completion time. Answers are automatically validated and populated into the EHR, eliminating manual data entry and errors."
              />
              <FAQItem
                question="What languages are supported?"
                answer="TamamHealth Patient Experience currently supports English, Arabic, Nuer, and Dinka. We're actively expanding language support based on community feedback. All interfaces, SMS reminders, and patient materials are fully localized."
              />
              <FAQItem
                question="How reliable is SMS reminder delivery?"
                answer="We partner with leading telecommunications providers in South Sudan to ensure 99% SMS delivery reliability. Failed messages automatically escalate to email or voice reminders. You can track delivery status for each patient in your dashboard."
              />
              <FAQItem
                question="Is the patient portal HIPAA compliant and secure?"
                answer="Yes. Our patient portal uses 256-bit encryption, two-factor authentication options, role-based access controls, and comprehensive audit logging. All data is encrypted in transit and at rest. We're fully HIPAA compliant with regular security audits."
              />
              <FAQItem
                question="How does the Patient Experience module integrate with TamamHealth EHR?"
                answer="Integration is seamless. Digital intake data flows directly into the EHR, appointment bookings sync with provider calendars, portal messages appear in patient charts, and lab results automatically populate the portal. One unified system, zero manual data entry."
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
              Complete patient experience with TamamHealth modules
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
              <div style={{ backgroundColor: "var(--tb-tint-blue)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  EHR Module
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Patient portal integrates with EHR. Patients see visit notes, medications, and test results. Providers document faster without paper.
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
                  Patient portal shows bills and payment history. Automated reminders reduce collection follow-up. Patients pay via M-Pesa.
                </p>
                <Link href="/billing" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  Learn more
                </Link>
              </div>
              <div style={{ backgroundColor: "var(--tb-tint-green)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Telehealth Module
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Patients book telehealth appointments from patient portal. Reminders sent via SMS. Consultation notes appear in portal after visit.
                </p>
                <Link href="/telehealth" className="mk-btn mk-btn-outline-green mk-btn-sm">
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
                  Transparent pricing for patient engagement
                </h3>
                <p style={{ margin: 0, color: "var(--tb-text-sec)" }}>
                  Choose a model that fits your practice size and patient volume.
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
