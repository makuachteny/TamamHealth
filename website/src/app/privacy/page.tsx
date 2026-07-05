"use client";

import Link from "next/link";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";
import { Shield, CloudOff, Code2 } from "@/components/marketing/icons";

const SECTIONS = [
  { id: "introduction", title: "Introduction" },
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "how-we-use", title: "How We Use Your Information" },
  { id: "health-data", title: "Health Data Protection" },
  { id: "storage-offline", title: "Data Storage & Offline Use" },
  { id: "data-sharing", title: "Data Sharing" },
  { id: "your-rights", title: "Your Rights" },
  { id: "data-retention", title: "Data Retention" },
  { id: "security-measures", title: "Security Measures" },
  { id: "childrens-privacy", title: "Children's Privacy" },
  { id: "changes", title: "Changes to This Policy" },
  { id: "contact", title: "Contact Us" },
];

export default function PrivacyPage() {
  return (
    <>
      <MarketingHero
        variant="legal"
        eyebrow="LEGAL"
        title="Privacy Policy"
        subtitle="Last updated: April 15, 2026"
      />

      {/* TRUST COMMITMENTS */}
      <section className="mk-section-tight mk-section-white" style={{ borderTop: "1px solid var(--tb-cream-300)", borderBottom: "1px solid var(--tb-cream-300)" }}>
        <div className="mk-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, maxWidth: 960, margin: "0 auto" }}>
            <TrustItem icon="shield" title="Encrypted in transit & at rest" body="TLS 1.3 for transport, AES-256 for storage. Audit logs on every record." />
            <TrustItem icon="offline" title="Offline-first by design" body="Patient data stays on-device until you sync, over authenticated channels only." />
            <TrustItem icon="api" title="Open, portable standards" body="HL7 FHIR and CSV exports. Your data is yours — we never lock you in." />
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
                <Section id="introduction" title="Introduction">
                  <p>
                    TamamHealth Technologies (&quot;TamamHealth,&quot; &quot;we,&quot; &quot;our&quot;) is committed to protecting the privacy and security of your personal and health information. This Privacy Policy describes how we collect, use, store, and share data when you use our digital health platform.
                  </p>
                </Section>

                <Section id="information-we-collect" title="Information We Collect">
                  <p>
                    We collect information that you provide directly, including account registration details (name, email, facility name, role), patient health records entered by authorized healthcare providers, billing and payment information, and communications you send to us through forms or email.
                  </p>
                  <p>
                    We also automatically collect usage data such as device information, access times, pages viewed, and features used within the platform. This data helps us improve the Service and troubleshoot issues.
                  </p>
                </Section>

                <Section id="how-we-use" title="How We Use Your Information">
                  <p>
                    We use collected information to provide and maintain the platform, process billing and payments, send important service updates, respond to support requests, improve our products, and comply with legal obligations. We do not sell personal or health information to third parties.
                  </p>
                </Section>

                <Section id="health-data" title="Health Data Protection">
                  <p>
                    Patient health records are treated with the highest level of security. All health data is encrypted in transit and at rest. Access to patient records is restricted to authorized healthcare providers. The offline-first architecture ensures data remains on-device until synchronized over secure connections. We maintain audit logs of all access to patient records.
                  </p>
                </Section>

                <Section id="storage-offline" title="Data Storage & Offline Use">
                  <p>
                    TamamHealth is designed for low-connectivity environments. Data created while offline is stored locally on your device and synchronized when internet connectivity is restored. We use industry-standard encryption for both local storage and cloud synchronization.
                  </p>
                </Section>

                <Section id="data-sharing" title="Data Sharing">
                  <p>
                    We may share data with service providers who help us operate the platform (hosting, email delivery), when required by law or legal process, with your explicit consent, and in anonymized or aggregated form for research purposes. We never share identifiable patient health data without proper authorization.
                  </p>
                </Section>

                <Section id="your-rights" title="Your Rights">
                  <p>
                    You have the right to access, correct, or delete your personal information. Healthcare providers can export patient data in standard formats (HL7 FHIR, CSV). To exercise these rights, contact us at{" "}
                    <a href="mailto:support.tamam@gmail.com" style={{ color: "var(--tb-green)", fontWeight: 600 }}>support.tamam@gmail.com</a>.
                  </p>
                </Section>

                <Section id="data-retention" title="Data Retention">
                  <p>
                    We retain account data for the duration of your subscription plus 90 days. Patient health records are retained in accordance with applicable healthcare regulations. Upon account termination, we provide a data export period before permanent deletion.
                  </p>
                </Section>

                <Section id="security-measures" title="Security Measures">
                  <p>
                    We implement encryption (TLS 1.3 in transit, AES-256 at rest), role-based access controls, regular security audits, secure development practices, and incident response procedures. While no system is completely secure, we take reasonable measures to protect your data.
                  </p>
                </Section>

                <Section id="childrens-privacy" title="Children's Privacy">
                  <p>
                    The Service is designed for healthcare professionals, not for use by individuals under 18. We do not knowingly collect personal information from children outside of clinical care contexts.
                  </p>
                </Section>

                <Section id="changes" title="Changes to This Policy">
                  <p>
                    We may update this Privacy Policy periodically. We will notify you of significant changes via email or through the platform. The &quot;Last updated&quot; date at the top indicates when the policy was most recently revised.
                  </p>
                </Section>

                <Section id="contact" title="Contact Us">
                  <p>
                    For privacy-related questions or concerns, contact us at{" "}
                    <a href="mailto:support.tamam@gmail.com" style={{ color: "var(--tb-green)", fontWeight: 600 }}>support.tamam@gmail.com</a>
                    {" "}or visit our{" "}
                    <Link href="/#contact-form" style={{ color: "var(--tb-green)", fontWeight: 600 }}>contact page</Link>.
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
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "var(--tb-text-pri)" }}>Questions about how we use your data?</h3>
          <p style={{ fontSize: 15, color: "var(--tb-text-sec)", margin: "0 0 24px" }}>
            Review our Terms or reach out to the team directly.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/terms" className="mk-btn mk-btn-outline-green">Terms &amp; Conditions</Link>
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

const TRUST_ICON_MAP = {
  shield: Shield,
  offline: CloudOff,
  api: Code2,
} as const;

function TrustItem({ icon, title, body }: { icon: "shield" | "offline" | "api"; title: string; body: string }) {
  const IconComp = TRUST_ICON_MAP[icon];
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
