import Image from "next/image";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import {
  Reveal,
  CheckItem,
  SplitFeatureBlock,
} from "@/components/marketing/MarketingShared";
import {
  FeatureFAQSection,
  FeatureRelatedProductsSection,
  FeatureStatsBand,
  FeatureTestimonialSection,
} from "@/components/marketing/FeatureSections";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Telehealth Product Page
   Healthcare Telehealth solution matching Tebra design language
   ═══════════════════════════════════════════════════════════════════ */

export default function TelehealthPage() {
  return (
    <>
      <MarketingHero
        variant="mosaic"
        eyebrow="TELEHEALTH"
        title="Expert care in 30 minutes, not 8 hours of travel"
        subtitle="TamamHealth Telehealth connects rural clinics to specialists with video that works on constrained networks and costs a fraction of patient travel."
        primaryCta={{ label: "See offline capability demo", href: "/about/contact?intent=demo#contact-form" }}
        stats={[
          { value: "2G/3G", label: "network support" },
          { value: "4x", label: "more specialist access" },
        ]}
        image="/assets/doctor-tablet-review.jpg"
        imageAlt="Doctor reviewing patient data on tablet"
        imagePriority
        className="mk-hero-telehealth"
      />

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="mk-section mk-section-white" style={{ backgroundColor: "var(--tb-cream-100)" }}>
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
              Telehealth in 3 steps
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#FEFFF9", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>1</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Patient books appointment
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Via SMS, web portal, or clinic staff. Appointment syncs to specialist&apos;s calendar in Juba. Patient receives reminder SMS.
                </p>
              </div>
              <div style={{ background: "#FEFFF9", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 12 }}>2</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  Secure HD video consult
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6 }}>
                  Works on 2G/3G; adjusts quality automatically. Share lab images, X-rays, ECGs in real-time. Record for follow-up.
                </p>
              </div>
              <div style={{ background: "#FEFFF9", padding: 32, borderRadius: 12, border: "1px solid var(--tb-cream-300)" }}>
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
      <SplitFeatureBlock
        eyebrow="Video visits"
        title="HD video consultations for every bandwidth"
        body="Crystal-clear 1080p video on good connections, graceful degradation to 240p on 2G/3G networks. Built-in noise cancellation, real-time bitrate optimization, and support for both 1:1 consultations and multi-party group visits."
        checks={[
          "Auto noise cancellation and echo reduction",
          "Real-time quality optimization on any connection",
          "Works reliably on 2G/3G starting at 240p",
          "1:1 consultations and multi-party video support",
        ]}
        image="/assets/doctor-tablet-smiling.jpg"
        imageAlt="Healthcare provider conducting video consultation with patient"
        tone="navy"
      />

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
      <FeatureStatsBand
        stats={[
          { value: "95%", label: "Connection success rate" },
          { value: "92%", label: "Patient satisfaction" },
          { value: "4x", label: "Specialist access increase" },
          { value: "500MB", label: "Per 60-min call on 3G" },
        ]}
      />

      <FeatureTestimonialSection
        testimonial={{
          quote: "TamamHealth is pre-launch, and Telehealth exists because too many patients either never see a specialist or spend a month's wages and a week of travel to reach one in Juba. It's built to bring that consultation to the health post instead — video that holds up on 2G/3G, so distance stops being the reason care doesn't happen.",
          attribution: "Why we built Telehealth",
        }}
      />

      <FeatureFAQSection
        faqs={[
          {
            question: "How does the video quality work on poor network connections?",
            answer: "Our adaptive bitrate system starts at 1080p on fast connections and automatically scales down to 240p on 2G/3G networks. The video remains smooth and usable at all quality levels. We optimize frame rate and resolution in real-time based on available bandwidth.",
          },
          {
            question: "Can video sessions be recorded for training?",
            answer: "Yes. Recordings are optional and require explicit patient consent before any call begins. Recordings are encrypted and stored securely with automatic compliance audit trails. Providers can use recordings for quality assurance and staff training with proper authorization.",
          },
          {
            question: "What happens if a patient doesn't show up to their appointment?",
            answer: "No-show management is built in. Providers receive notifications when patients don't join at their appointment time. The system tracks no-show patterns and can send automated reminders via SMS or push notification to reduce missed appointments.",
          },
          {
            question: "What if the internet drops during a call?",
            answer: "The system gracefully handles disconnections. If a network drop occurs, the call is temporarily suspended and the connection is automatically re-established if the patient reconnects within 5 minutes. Voice-only fallback mode can continue the consultation without video.",
          },
          {
            question: "Do mobile apps work offline?",
            answer: "Our native iOS and Android apps support offline video recording. Providers can record video locally and it will automatically sync to the platform when connection returns. The app also caches patient information and appointment schedules for offline access.",
          },
        ]}
      />

      <FeatureRelatedProductsSection
        heading="Empower telehealth with integrated care"
        products={[
          {
            title: "EHR Module",
            body: "Telehealth consultations auto-document to patient EHR. Complete specialist recommendations available to local clinician immediately.",
            href: "/ehr",
            image: "/assets/doctor-tablet-review.jpg",
          },
          {
            title: "Pharmacy & Lab Module",
            body: "Share lab results and imaging with specialists during video calls. Order prescriptions from consultation recommendations instantly.",
            href: "/pharmacy-lab",
            image: "/assets/doctor-nurse-consultation.jpg",
          },
          {
            title: "Patient Experience",
            body: "Patients book appointments, receive reminders, and access consultation notes via secure portal. Multi-language support included.",
            href: "/patient-experience",
            image: "/assets/doctor-tablet-smiling.jpg",
          },
        ]}
      />

    </>
  );
}
