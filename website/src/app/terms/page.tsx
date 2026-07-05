"use client";

import Link from "next/link";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";
import { Users, ShieldCheck, Heart } from "@/components/marketing/icons";

const SECTIONS = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "description", title: "2. Description of Service" },
  { id: "user-accounts", title: "3. User Accounts" },
  { id: "data-privacy", title: "4. Data & Privacy" },
  { id: "acceptable-use", title: "5. Acceptable Use" },
  { id: "offline-functionality", title: "6. Offline Functionality" },
  { id: "payment-terms", title: "7. Payment Terms" },
  { id: "liability", title: "8. Limitation of Liability" },
  { id: "termination", title: "9. Termination" },
  { id: "changes-to-terms", title: "10. Changes to Terms" },
  { id: "contact", title: "11. Contact" },
];

export default function TermsPage() {
  return (
    <>
      <MarketingHero
        variant="legal"
        eyebrow="LEGAL"
        title="Terms & Conditions"
        subtitle="Last updated: April 15, 2026"
      />

      {/* KEY COMMITMENTS */}
      <section className="mk-section-tight mk-section-white" style={{ borderTop: "1px solid var(--tb-cream-300)", borderBottom: "1px solid var(--tb-cream-300)" }}>
        <div className="mk-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, maxWidth: 960, margin: "0 auto" }}>
            <CommitmentItem icon="users" title="Built for healthcare professionals" body="Clear, fair terms for clinics and healthcare systems — no hidden lock-in." />
            <CommitmentItem icon="shield-check" title="You retain your data" body="Your patient data stays yours. Export anytime via HL7 FHIR or CSV." />
            <CommitmentItem icon="heart" title="Transparent pricing" body="30 days' notice on any pricing change. No surprise charges." />
          </div>
        </div>
      </section>

      {/* CONTENT + TOC */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 64, maxWidth: 1100, margin: "0 auto" }} className="mk-legal-grid">
            <aside className="mk-legal-toc">
              <div style={{ position: "sticky", top: 96 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tb-text-sec)", margin: "0 0 12px" }}>On this page</p>
                <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SECTIONS.map((s) => (
                    <a key={s.id} href={`#${s.id}`} style={{ fontSize: 13, color: "var(--tb-text-sec)", textDecoration: "none", lineHeight: 1.5, padding: "2px 0" }}>
                      {s.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <article style={{ fontSize: 16, lineHeight: 1.8, color: "var(--tb-text-pri)", maxWidth: 720 }}>
              <Reveal>
                <Section id="acceptance" title="1. Acceptance of Terms">
                  <p>
                    By accessing or using TamamHealth Technologies&apos; platform (&quot;the Service&quot;), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Service.
                  </p>
                </Section>

                <Section id="description" title="2. Description of Service">
                  <p>
                    TamamHealth provides a digital health records platform designed for healthcare providers in Africa. The Service includes electronic health records (EHR), billing and payment tools, telehealth capabilities, analytics, pharmacy and lab management, and related features.
                  </p>
                </Section>

                <Section id="user-accounts" title="3. User Accounts">
                  <p>
                    You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. TamamHealth is not liable for losses arising from unauthorized access to your account.
                  </p>
                </Section>

                <Section id="data-privacy" title="4. Data & Privacy">
                  <p>
                    Patient health data processed through the Service is handled in accordance with our{" "}
                    <Link href="/privacy" style={{ color: "var(--tb-green)", fontWeight: 600 }}>Privacy Policy</Link>.
                    TamamHealth implements industry-standard security measures to protect health information. Users are responsible for ensuring their use of the Service complies with applicable local healthcare data regulations.
                  </p>
                </Section>

                <Section id="acceptable-use" title="5. Acceptable Use">
                  <p>
                    You agree to use the Service only for lawful purposes related to healthcare delivery. You may not use the Service to transmit harmful content, attempt to gain unauthorized access to systems, or engage in any activity that disrupts the Service.
                  </p>
                </Section>

                <Section id="offline-functionality" title="6. Offline Functionality">
                  <p>
                    The Service is designed to operate in low-connectivity environments. Data created offline is synchronized when connectivity is restored. TamamHealth is not responsible for data conflicts arising from extended offline usage across multiple devices.
                  </p>
                </Section>

                <Section id="payment-terms" title="7. Payment Terms">
                  <p>
                    Pricing and payment terms are established in your subscription agreement. All fees are non-refundable unless otherwise specified. TamamHealth reserves the right to modify pricing with 30 days&apos; notice.
                  </p>
                </Section>

                <Section id="liability" title="8. Limitation of Liability">
                  <p>
                    TamamHealth provides the Service &quot;as is&quot; and &quot;as available.&quot; We do not warrant that the Service will be uninterrupted or error-free. TamamHealth&apos;s liability is limited to the amount paid by you for the Service in the 12 months preceding the claim.
                  </p>
                </Section>

                <Section id="termination" title="9. Termination">
                  <p>
                    Either party may terminate the agreement with 30 days&apos; written notice. Upon termination, TamamHealth will provide a reasonable period for you to export your data. TamamHealth reserves the right to suspend or terminate accounts that violate these terms.
                  </p>
                </Section>

                <Section id="changes-to-terms" title="10. Changes to Terms">
                  <p>
                    We may update these terms from time to time. Material changes will be communicated via email or through the Service. Continued use after changes constitutes acceptance of the updated terms.
                  </p>
                </Section>

                <Section id="contact" title="11. Contact">
                  <p>
                    For questions about these terms, contact us at{" "}
                    <a href="mailto:support.tamam@gmail.com" style={{ color: "var(--tb-green)", fontWeight: 600 }}>support.tamam@gmail.com</a>.
                  </p>
                </Section>
              </Reveal>
            </article>
          </div>
        </div>
      </section>

      {/* RELATED */}
      <section className="mk-section-tight mk-section-cream" style={{ borderTop: "1px solid var(--tb-cream-300)" }}>
        <div className="mk-container" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "var(--tb-text-pri)" }}>Want to know how we handle your data?</h3>
          <p style={{ fontSize: 15, color: "var(--tb-text-sec)", margin: "0 0 24px" }}>
            Read our Privacy Policy or talk to the team.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/privacy" className="mk-btn mk-btn-outline-green">Privacy Policy</Link>
            <Link href="/#contact-form" className="mk-btn mk-btn-green">Contact us</Link>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .mk-legal-grid {
          grid-template-columns: 240px 1fr !important;
        }
        @media (max-width: 959.98px) {
          .mk-legal-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .mk-legal-toc { display: none; }
        }
      `}</style>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ scrollMarginTop: 96, marginBottom: 40 }}>
      <h2 id={id} style={{ fontFamily: "var(--tb-serif)", fontSize: 24, fontWeight: 700, margin: "0 0 16px", color: "var(--tb-text-pri)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

const COMMITMENT_ICON_MAP = {
  users: Users,
  "shield-check": ShieldCheck,
  heart: Heart,
} as const;

function CommitmentItem({ icon, title, body }: { icon: "users" | "shield-check" | "heart"; title: string; body: string }) {
  const IconComp = COMMITMENT_ICON_MAP[icon];
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 44px", width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IconComp size={22} strokeWidth={1.8} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--tb-text-pri)", margin: "0 0 4px" }}>{title}</p>
        <p style={{ fontSize: 14, color: "var(--tb-text-sec)", margin: 0, lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}
