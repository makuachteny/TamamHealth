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
   TamamHealth Telehealth Product Page
   Healthcare Telehealth solution matching Tebra design language
   ═══════════════════════════════════════════════════════════════════ */

export default function TelehealthPage() {
  return (
    <>
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="mk-hero" id="demo">
        <div className="mk-container">
          <div className="mk-hero-flex">
            {/* Left: Headline + Description */}
            <div className="mk-hero-content">
              <span className="mk-label">TELEHEALTH</span>
              <h1 className="mk-h1">
                Get expert care in 30 minutes, not 8 hours of travel — video that works on any network
              </h1>
              <p className="mk-body-lg">
                Rural clinics lose 70% of patients who can&apos;t afford the journey to a specialist. TamamHealth Telehealth connects them in 30 minutes — with video that works on 2G networks and costs a fraction of the travel. Specialists diagnose and treat from anywhere. Power outages and poor connectivity are no barrier to care.
              </p>
              <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "24px 0 32px" }}>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  Works on 2G/3G Networks
                </div>
                <div style={{ backgroundColor: "var(--tb-gold-light)", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "var(--tb-text)" }}>
                  4x More Specialist Access
                </div>
              </div>
              <div style={{ marginTop: 32 }}>
                <Link href="#demo" className="mk-btn mk-btn-green mk-btn-lg">
                  See offline capability demo
                </Link>
              </div>
            </div>

            {/* Center: Hero Photo */}
            <div className="mk-hero-photo">
              <Reveal delay={0.15}>
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Doctor reviewing patient data on tablet"
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
              Telehealth in 3 steps
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>1</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Patient books appointment
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Via SMS, web portal, or clinic staff. Appointment syncs to specialist&apos;s calendar in Juba. Patient receives reminder SMS.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>2</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Secure HD video consult
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Works on 2G/3G; adjusts quality automatically. Share lab images, X-rays, ECGs in real-time. Record for follow-up.
                </p>
              </div>
              <div style={{ background: "#fff", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>3</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Visit notes auto-sync to EHR
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Specialist documents diagnosis and plan. Local clinician sees recommendations immediately. Patient can access via portal.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BEFORE/AFTER: The Access Gap ────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              The specialist access crisis
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, maxWidth: "1000px", margin: "0 auto" }}>
              <div style={{ backgroundColor: "var(--tb-red-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-red)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-red-dark)" }}>
                  Before: Remote Clinic Despair
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Patient needs cardiologist consultation
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Only specialist is 200 km away in Juba
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ 2-day bus journey costs $50 (month&apos;s income for most)
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ 70% of patients don&apos;t go; condition worsens
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Local clinician has no one to consult
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Patient dies from preventable complication
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: "var(--tb-green-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-green)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: "var(--tb-green-dark)" }}>
                  After: TamamHealth Telehealth
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Patient books video appointment from clinic
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Specialist in Juba joins call in 30 minutes
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Cost: $5-10; works even on basic 3G
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ 95% of patients get expert consultation
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Local clinician learns while watching
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Patient gets diagnosis, plan, and prescription same day
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 1: HD Video Consultations ────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">HD video consultations for every bandwidth</h2>
                <p className="mk-body">
                  Crystal-clear 1080p video on good connections, graceful degradation to 240p on 2G/3G networks. Built-in noise cancellation, real-time bitrate optimization, and support for both 1:1 consultations and multi-party group visits.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Auto noise cancellation and echo reduction</CheckItem>
                  <CheckItem>Real-time quality optimization on any connection</CheckItem>
                  <CheckItem>Works reliably on 2G/3G starting at 240p</CheckItem>
                  <CheckItem>1:1 consultations and multi-party video support</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-smiling.jpg"
                  alt="Healthcare provider conducting video consultation with patient"
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

      {/* ── FEATURE 2: Virtual Waiting Rooms ─────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Virtual waiting rooms and patient intake</h2>
                <p className="mk-body">
                  Patients join at their scheduled appointment time. Providers receive arrival notifications, estimated wait times auto-adjust, and asynchronous intake forms eliminate the need for early check-ins over unreliable networks.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Appointment-time joining prevents early arrivals</CheckItem>
                  <CheckItem>Provider arrival notifications and status updates</CheckItem>
                  <CheckItem>Estimated wait time with real-time adjustments</CheckItem>
                  <CheckItem>Asynchronous intake forms and history collection</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-smiling.jpg"
                  alt="Doctor managing virtual waiting room"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 3: Bandwidth Optimization ────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Bandwidth optimization for low-connectivity areas</h2>
                <p className="mk-body">
                  Adaptive bitrate streaming automatically adjusts quality based on available bandwidth. A typical 60-minute call uses only 500MB on 3G networks. Voice-only fallback ensures continuity even during connectivity drops.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Adaptive bitrate streaming with auto quality adjustment</CheckItem>
                  <CheckItem>Only 500MB data for 60-minute call on 3G networks</CheckItem>
                  <CheckItem>Intelligent frame rate and resolution scaling</CheckItem>
                  <CheckItem>Voice-only fallback mode for critical connectivity issues</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/community-health-worker.jpg"
                  alt="Healthcare worker accessing telehealth in field"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 4: Screen Sharing & Image Review ───────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Screen sharing and diagnostic image review</h2>
                <p className="mk-body">
                  Share lab images, X-rays, and ECGs directly during calls with real-time annotation tools. Providers can mark up images, highlight findings, and educate patients. Optional educational recording for training and quality review.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Screen sharing and lab image streaming during calls</CheckItem>
                  <CheckItem>Real-time annotation tools for diagnostic marking</CheckItem>
                  <CheckItem>X-ray, ECG, and imaging viewer integration</CheckItem>
                  <CheckItem>Optional encrypted recording for quality assurance</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Clinical team reviewing shared medical images"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 5: Consent & Session Recording ──────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">Consent management and secure recording</h2>
                <p className="mk-body">
                  One-click digital consent with patient signature and timestamp. Optional encrypted session recording requires patient permission and complies with HIPAA and local South Sudan healthcare regulations for quality assurance.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>One-click digital consent with e-signature</CheckItem>
                  <CheckItem>Patient permission required for any recording</CheckItem>
                  <CheckItem>Encrypted recording storage with automatic purging</CheckItem>
                  <CheckItem>Quality assurance and compliance audit trails</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-writing-notes.jpg"
                  alt="Doctor documenting patient consent"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURE 6: Mobile-Optimized Apps ────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2">Mobile-optimized apps for providers and patients</h2>
                <p className="mk-body">
                  Native iOS and Android apps with offline video recording capability. When connection returns, recordings automatically sync to the platform. Tablet-friendly interfaces support healthcare workers on the move.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Native iOS and Android apps with full functionality</CheckItem>
                  <CheckItem>Offline video recording with automatic sync on reconnect</CheckItem>
                  <CheckItem>Tablet-friendly responsive design for clinical teams</CheckItem>
                  <CheckItem>Push notifications and call alerts even offline</CheckItem>
                </ul>
                <Link href="#demo" className="mk-btn mk-btn-outline-green">
                  Learn more
                </Link>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/african-nurse.jpg"
                  alt="Mobile telehealth app interface on smartphone device"
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
                <strong>95%</strong>
                <span>Connection success rate</span>
              </div>
              <div className="mk-stat-badge">
                <strong>92%</strong>
                <span>Patient satisfaction</span>
              </div>
              <div className="mk-stat-badge">
                <strong>4x</strong>
                <span>Specialist access increase</span>
              </div>
              <div className="mk-stat-badge">
                <strong>500MB</strong>
                <span>Per 60-min call on 3G</span>
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
                  Before TamamHealth Telehealth, patients either didn&apos;t see specialists or spent weeks traveling and a month&apos;s wages getting to Juba. Now we do 30-40 consultations per week across our health posts. The video quality on 3G is excellent, and specialists can review patient images in real-time. We&apos;ve increased specialist access 4x, and patient outcomes have improved dramatically.
                </blockquote>
                <cite>
                  <strong>Dr. Amir Hassan</strong>
                  <span>Regional Health Director, Eastern Equatoria State</span>
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
                question="How does the video quality work on poor network connections?"
                answer="Our adaptive bitrate system starts at 1080p on fast connections and automatically scales down to 240p on 2G/3G networks. The video remains smooth and usable at all quality levels. We optimize frame rate and resolution in real-time based on available bandwidth."
              />
              <FAQItem
                question="Can video sessions be recorded for training?"
                answer="Yes. Recordings are optional and require explicit patient consent before any call begins. Recordings are encrypted and stored securely with automatic compliance audit trails. Providers can use recordings for quality assurance and staff training with proper authorization."
              />
              <FAQItem
                question="What happens if a patient doesn't show up to their appointment?"
                answer="No-show management is built in. Providers receive notifications when patients don't join at their appointment time. The system tracks no-show patterns and can send automated reminders via SMS or push notification to reduce missed appointments."
              />
              <FAQItem
                question="What if the internet drops during a call?"
                answer="The system gracefully handles disconnections. If a network drop occurs, the call is temporarily suspended and the connection is automatically re-established if the patient reconnects within 5 minutes. Voice-only fallback mode can continue the consultation without video."
              />
              <FAQItem
                question="Do mobile apps work offline?"
                answer="Our native iOS and Android apps support offline video recording. Providers can record video locally and it will automatically sync to the platform when connection returns. The app also caches patient information and appointment schedules for offline access."
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
              Empower telehealth with integrated care
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
              <div style={{ backgroundColor: "var(--tb-tint-blue)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  EHR Module
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Telehealth consultations auto-document to patient EHR. Complete specialist recommendations available to local clinician immediately.
                </p>
                <Link href="/ehr" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  Learn more
                </Link>
              </div>
              <div style={{ backgroundColor: "var(--tb-tint-gold)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Pharmacy & Lab Module
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Share lab results and imaging with specialists during video calls. Order prescriptions from consultation recommendations instantly.
                </p>
                <Link href="/pharmacy-lab" className="mk-btn mk-btn-outline-green mk-btn-sm">
                  Learn more
                </Link>
              </div>
              <div style={{ backgroundColor: "var(--tb-tint-green)", padding: 32, borderRadius: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Patient Experience
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  Patients book appointments, receive reminders, and access consultation notes via secure portal. Multi-language support included.
                </p>
                <Link href="/patient-experience" className="mk-btn mk-btn-outline-green mk-btn-sm">
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
                  Flexible telehealth pricing for practices of any size
                </h3>
                <p style={{ margin: 0, color: "var(--tb-text-sec)" }}>
                  From solo practitioners to health systems, we scale with your needs.
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
