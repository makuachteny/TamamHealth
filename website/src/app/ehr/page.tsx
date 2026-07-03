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
import { FileText, HeartPulse, BarChart3 } from "@/components/marketing/icons";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth EHR Product Page
   Healthcare EHR product showcase matching Tebra design language
   ═══════════════════════════════════════════════════════════════════ */

export default function EHRPage() {
  return (
    <>
      <MarketingHero
        variant="product"
        eyebrow="EHR SOFTWARE"
        title="Digital patient records that work offline."
        subtitle="Clinicians across Africa face power outages, connectivity gaps, and paper records scattered across filing cabinets. TamamHealth solves this with offline charting, instant lab orders, electronic prescriptions, and built-in telehealth."
        primaryCta={{ label: "Request a demo", href: "/about/contact?intent=demo#contact-form" }}
        secondaryCta={{ label: "See how it works", href: "#how-it-works" }}
        stats={[
          { value: "75%", label: "faster documentation" },
          { value: "Offline", label: "records in all regions" },
        ]}
        image="/assets/doctor-tablet-review.jpg"
        imageAlt="Clinician reviewing patient records on a tablet"
        imagePriority
      />

      {/* ── HOW IT WORKS: 3-STEP WORKFLOW (directly under hero) ───── */}
      <section id="how-it-works" className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading">
              <h2 className="mk-h2">How TamamHealth EHR works</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <div style={{ background: "#FEFFF9", padding: 36, borderRadius: 16, border: "1px solid var(--tb-cream-300)", boxShadow: "0 4px 16px rgba(26,58,58,0.04)" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--tb-tint-blue)", color: "var(--tb-blue-700)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <FileText size={56} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 8, letterSpacing: "0.05em" }}>STEP 1</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "var(--tb-text)" }}>
                  <strong>Charting works everywhere</strong>
                </h3>
                <p style={{ fontSize: 15, color: "var(--tb-text-sec)", lineHeight: 1.7 }}>
                  Write patient notes, orders, and prescriptions on any device — even when connectivity drops. Your data stays safe locally and syncs automatically when networks return. No internet required.
                </p>
              </div>
              <div style={{ background: "#FEFFF9", padding: 36, borderRadius: 16, border: "1px solid var(--tb-cream-300)", boxShadow: "0 4px 16px rgba(26,58,58,0.04)" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--tb-tint-green)", color: "var(--tb-green)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <HeartPulse size={56} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tb-green-dark)", marginBottom: 8, letterSpacing: "0.05em" }}>STEP 2</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "var(--tb-text)" }}>
                  <strong>Orders and labs flow instantly</strong>
                </h3>
                <p style={{ fontSize: 15, color: "var(--tb-text-sec)", lineHeight: 1.7 }}>
                  Lab tests, imaging, and pharmacy orders transmit to partners via secure connections. Results come back in real-time with alerts for critical findings — no manual transcription needed.
                </p>
              </div>
              <div style={{ background: "#FEFFF9", padding: 36, borderRadius: 16, border: "1px solid var(--tb-cream-300)", boxShadow: "0 4px 16px rgba(26,58,58,0.04)" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--tb-tint-gold)", color: "var(--tb-gold-dark)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <BarChart3 size={56} strokeWidth={1.8} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tb-gold-dark)", marginBottom: 8, letterSpacing: "0.05em" }}>STEP 3</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "var(--tb-text)" }}>
                  <strong>Get the full clinical picture</strong>
                </h3>
                <p style={{ fontSize: 15, color: "var(--tb-text-sec)", lineHeight: 1.7 }}>
                  Consult specialists via video, track medications across visits, and access complete patient history — offline or online, from any screen. One unified view of every patient.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── BEFORE/AFTER: The Challenge ──────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 88 }}>
              Before vs. After: The reality for African clinics
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32, maxWidth: "1000px", margin: "0 auto" }}>
              <div style={{ backgroundColor: "var(--tb-red-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-red)" }}>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "var(--tb-text)" }}>
                  <strong>Before: Paper-Based Chaos</strong>
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Patient records scattered across files and cabinets
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Power outages mean no access to any patient data
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Lab results lost in transit or manually transcribed with errors
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Prescription handwriting causes medication errors
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Patients travel 8+ hours to see specialists in Juba
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ❌ Admin staff spend 4+ hours per day manually searching for records
                  </li>
                </ul>
              </div>
              <div style={{ backgroundColor: "var(--tb-green-light)", padding: 32, borderRadius: 12, border: "2px solid var(--tb-green)" }}>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "var(--tb-text)" }}>
                  <strong>After: TamamHealth EHR</strong>
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Complete patient history at fingertips, encrypted and secure
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Offline charting syncs automatically when connectivity returns
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Lab results transmitted electronically with zero manual entry
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ E-prescriptions with drug interaction checks prevent errors
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Telehealth brings specialists to remote clinics via video
                  </li>
                  <li style={{ marginBottom: 12, fontSize: 14, color: "var(--tb-text)" }}>
                    ✓ Clinicians document 75% faster, freeing time for patient care
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── FEATURE 1: Flexible Charting ────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2" style={{ fontWeight: 700 }}><strong>Flexible charting for every specialty</strong></h2>
                <p className="mk-body">
                  <strong>Build and customize clinical templates</strong> for every specialty. SOAP notes, progress notes, and procedure documentation — <strong>all configurable to your healthcare standards</strong> with intelligent autocomplete.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Customizable SOAP note templates</CheckItem>
                  <CheckItem>Clinical decision support alerts</CheckItem>
                  <CheckItem>Voice-to-text documentation</CheckItem>
                  <CheckItem>Smart autofill and shortcuts</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Doctor reviewing patient records on tablet with TamamHealth EHR"
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

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── FEATURE 2: Instant eLabs ─────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2" style={{ fontWeight: 700 }}><strong>Instant access to lab orders and results</strong></h2>
                <p className="mk-body">
                  Order lab tests and imaging directly from your notes. <strong>Results flow back in real-time</strong>, eliminating manual entry and <strong>keeping your patient&apos;s full diagnostic history at your fingertips</strong>.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Order labs directly from charts</CheckItem>
                  <CheckItem>Real-time result delivery</CheckItem>
                  <CheckItem>Historical result tracking</CheckItem>
                  <CheckItem>Integrated lab partners</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-writing-notes.jpg"
                  alt="Doctor documenting lab orders"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── FEATURE 3: Send eRx in Seconds ──────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2" style={{ fontWeight: 700 }}><strong>Send eRx in seconds</strong></h2>
                <p className="mk-body">
                  <strong>Prescribe electronically</strong> with <strong>built-in drug interaction checking, allergy alerts</strong>, and direct pharmacy connectivity. <strong>Reduce medication errors</strong> and save time on every prescription.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Electronic prescription transmission</CheckItem>
                  <CheckItem>Drug interaction checking</CheckItem>
                  <CheckItem>Allergy and contraindication alerts</CheckItem>
                  <CheckItem>Refill management and renewals</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-prescription.jpg"
                  alt="Doctor writing electronic prescription"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── FEATURE 4: Work from Anywhere ───────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2" style={{ fontWeight: 700 }}><strong>Work from anywhere, anytime</strong></h2>
                <p className="mk-body">
                  <strong>Access your full EHR from any device</strong> — desktop, tablet, or phone. <strong>Native iOS and Android apps with offline capability</strong> keep your team connected, even in areas with limited connectivity.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Mobile and tablet-optimized interface</CheckItem>
                  <CheckItem>Native iOS and Android apps</CheckItem>
                  <CheckItem>Offline access and sync capabilities</CheckItem>
                  <CheckItem>Secure data encryption in transit</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Doctor accessing EHR on tablet device"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── FEATURE 5: Easy, Efficient Virtual Care ──────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2" style={{ fontWeight: 700 }}><strong>Easy, efficient virtual care</strong></h2>
                <p className="mk-body">
                  Deliver care beyond clinic walls with <strong>integrated video visits, virtual waiting rooms, and secure messaging</strong>. <strong>Bring specialist expertise to remote communities</strong>.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Video conferencing optimized for low bandwidth</CheckItem>
                  <CheckItem>Integrated appointment scheduling</CheckItem>
                  <CheckItem>Screen sharing and digital forms</CheckItem>
                  <CheckItem>Visit recordings and transcripts</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/african-nurse.jpg"
                  alt="Telehealth video consultation on tablet"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── FEATURE 6: Streamlined Billing ──────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-content">
                <h2 className="mk-h2" style={{ fontWeight: 700 }}><strong>Streamlined billing</strong></h2>
                <p className="mk-body">
                  <strong>Automate claims generation</strong>, <strong>verify insurance eligibility in real-time</strong>, and track revenue performance. TamamHealth&apos;s billing engine <strong>reduces denials and accelerates your practice&apos;s cash flow</strong>.
                </p>
                <ul className="mk-check-list">
                  <CheckItem>Automated claim generation and submission</CheckItem>
                  <CheckItem>Real-time insurance eligibility checks</CheckItem>
                  <CheckItem>Denial management and appeals</CheckItem>
                  <CheckItem>Patient payment portal</CheckItem>
                </ul>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare team reviewing billing dashboard"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      <FeatureStatsBand
        stats={[
          { value: "100%", label: "Offline-capable" },
          { value: "Offline-first", label: "Built for unreliable power" },
          { value: "Fast", label: "Designed for speed" },
          { value: "Open", label: "DHIS2 & HL7 FHIR compatible" },
        ]}
      />

      {/* ── CAPABILITY CALLOUT ─────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container" style={{ textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
          <Reveal>
            <h2 className="mk-h2">Built for the realities of African healthcare</h2>
            <p className="mk-body-lg" style={{ color: "var(--tb-text-sec)", marginTop: 16 }}>
              TamamHealth was designed from day one for clinics that face power outages, limited connectivity, and resource constraints. Every feature works offline, syncs automatically when connected, and runs on affordable hardware.
            </p>
          </Reveal>
        </div>
      </section>

      <FeatureTestimonialSection
        testimonial={{
          quote: "We went from four filing cabinets of paper records to a fully digital clinic in 12 days. The offline capability was the deciding factor - our electricity cuts out three to four times a day, and TamamHealth never skips a beat. Our clinicians document faster, our lab results come back same-day, and we finally have data we can trust for DHIS2 reporting.",
          name: "Dr. Sarah Achol",
          role: "Medical Director, Juba Teaching Hospital",
          variant: "cream",
        }}
      />

      <FeatureFAQSection
        faqs={[
          {
            question: "How does TamamHealth handle data security?",
            answer: "TamamHealth is built with data security best practices — encryption at rest, role-based access control, and audit logging. All patient data is protected and compliance-ready for your region.",
          },
          {
            question: "Can I integrate with other healthcare systems?",
            answer: "Yes. We support HL7, FHIR, and direct protocol integrations with custom API connections to lab systems, pharmacies, and billing providers. Our team assists with implementation.",
          },
          {
            question: "What kind of training and support do you provide?",
            answer: "We provide comprehensive onboarding with staff training, workflow consultation, and data migration. You get a dedicated support team, extensive documentation, and regular webinar training throughout your subscription.",
          },
          {
            question: "How much does TamamHealth EHR cost?",
            answer: "Pricing depends on your practice size, specialty, and modules. We offer flexible per-provider, per-patient, or flat-rate models. Schedule a demo for a customized quote.",
          },
          {
            question: "Can I access patient records on mobile devices?",
            answer: "Yes. Our native iOS and Android apps include full charting, offline access, and push notifications with encrypted mobile communications.",
          },
        ]}
      />

      {/* ── DIVIDER ─────────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      <FeatureRelatedProductsSection
        heading="Unlock more power with TamamHealth's integrated suite"
        products={[
          {
            title: "Pharmacy & Lab Module",
            body: "Integrated e-prescribing, drug interaction checking, and lab ordering that connects directly to your clinical workflow. Manage inventory, track prescription fulfillment, and coordinate with partner pharmacies - all from one dashboard.",
            href: "/pharmacy-lab",
            tone: "gold",
          },
          {
            title: "Telehealth Module",
            body: "Bring specialist expertise to remote clinics with video optimized for low bandwidth connectivity.",
            href: "/telehealth",
            tone: "blue",
          },
        ]}
      />

    </>
  );
}
