"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Reveal,
  FAQItem,
} from "@/components/marketing/MarketingShared";
import { DuoIcon } from "@/components/marketing/DuoIcon";

type Intent =
  | ""
  | "demo"
  | "pilot"
  | "partnership"
  | "careers"
  | "media"
  | "other";

const INTENT_OPTIONS: { id: Intent; label: string }[] = [
  { id: "", label: "Select a reason…" },
  { id: "demo", label: "Book a demo" },
  { id: "pilot", label: "Pilot at my facility" },
  { id: "partnership", label: "Partnership or integration" },
  { id: "careers", label: "Join the team" },
  { id: "media", label: "Press or media" },
  { id: "other", label: "Something else" },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    facility: "",
    role: "",
    intent: "" as Intent,
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setSubmitted(true);
      setFormData({ name: "", email: "", facility: "", role: "", intent: "", subject: "", message: "" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="mk-hero-photo-bg">
        <Image
          src="/assets/community-health-worker.jpg"
          alt="Community health worker at an African clinic"
          fill
          className="mk-hero-bg-img"
          priority
        />
        <div className="mk-container" style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <Reveal>
            <span className="mk-label" style={{ color: "var(--tb-gold)" }}>GET IN TOUCH</span>
            <h1 className="mk-h1" style={{ color: "#fff", marginTop: 12 }}>
              Let&apos;s talk.
            </h1>
            <p className="mk-body-lg" style={{ color: "var(--tb-text-inv-m)", marginTop: 16, maxWidth: 560, margin: "16px auto 0" }}>
              Whether you run a clinic, lead a health system, or want to build with us — we read every message, and we&apos;ll write back within one business day.
            </p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, marginTop: 28 }}>
              <a href="#contact-form" className="mk-btn mk-btn-green mk-btn-lg">
                Send us a message
              </a>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(4px)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--tb-green)", boxShadow: "0 0 0 4px rgba(45,155,106,0.25)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: "0.02em" }}>
                  Typical response: under 4 business hours
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── REACH US DIRECTLY ─────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 56px" }}>
              <span className="mk-label" style={{ color: "var(--tb-blue-700)" }}>REACH US DIRECTLY</span>
              <h2 className="mk-h2" style={{ marginTop: 10 }}>Pick the channel that works for you</h2>
              <p className="mk-body" style={{ color: "var(--tb-text-sec)", marginTop: 14 }}>
                Email is fastest. For strategic conversations, talk to a founder.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
              maxWidth: 1100,
              margin: "0 auto",
            }}>
              <ChannelCard
                icon="email"
                tone="blue"
                label="Email"
                primary="hello@tamamhealth.org"
                secondary="Fastest way to reach the team"
                href="mailto:hello@tamamhealth.org"
              />
              <ChannelCard
                icon="phone"
                tone="green"
                label="Phone"
                primary="+1 (973) 566-4336"
                secondary="Mon–Fri, 8 AM – 6 PM EAT"
              />
              <ChannelCard
                icon="location"
                tone="gold"
                label="Offices"
                primary="Boston & Juba"
                secondary="Medford, MA · South Sudan"
              />
            </div>
          </Reveal>

          <Reveal>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
              maxWidth: 1100,
              margin: "32px auto 0",
            }}>
              {/* Founder callout */}
              <div style={{
                padding: "22px 24px",
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--tb-blue-900) 0%, var(--tb-blue-800) 100%)",
                color: "#fff",
                borderLeft: "4px solid var(--tb-gold)",
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}>
                <div style={{
                  flex: "0 0 56px", width: 56, height: 56,
                  borderRadius: "50%", overflow: "hidden",
                  border: "2px solid var(--tb-gold)", position: "relative",
                }}>
                  <Image
                    src="/assets/founder-teny.jpg"
                    alt="Teny Makuach, CEO of TamamHealth"
                    fill
                    sizes="56px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tb-gold)", margin: "0 0 4px" }}>
                    Talk to a founder
                  </p>
                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 6px", color: "rgba(255,255,255,0.9)" }}>
                    Strategic partnerships or funding — reach our CEO Teny Makuach directly.
                  </p>
                  <a href="mailto:teny@tamamhealth.org" style={{ fontSize: 13, fontWeight: 700, color: "var(--tb-gold)", textDecoration: "none", borderBottom: "1px dashed var(--tb-gold)" }}>
                    teny@tamamhealth.org →
                  </a>
                </div>
              </div>

              {/* Partnerships / Careers split */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SideEmail label="Partnerships" email="partnerships@tamamhealth.org" tone="blue" />
                <SideEmail label="Careers" email="careers@tamamhealth.org" tone="green" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SEND A MESSAGE ────────────────────────────────────────────── */}
      <section className="mk-section mk-section-white" id="contact-form">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px" }}>
              <span className="mk-label" style={{ color: "var(--tb-green)" }}>SEND A MESSAGE</span>
              <h2 className="mk-h2" style={{ marginTop: 10 }}>Tell us what you&apos;re building</h2>
              <p className="mk-body" style={{ color: "var(--tb-text-sec)", marginTop: 14 }}>
                A few sentences about your facility and what you&apos;re looking for is plenty — we&apos;ll take it from there.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="mk-demo-card" style={{
              maxWidth: 960,
              margin: "0 auto",
              padding: "40px 44px 36px",
            }}>
              {submitted ? (
                <div style={{
                  background: "var(--tb-tint-green)",
                  border: "2px solid var(--tb-green)",
                  borderRadius: 14,
                  padding: "48px 24px",
                  textAlign: "center",
                }}>
                  <div style={{ display: "inline-flex", width: 72, height: 72, borderRadius: "50%", background: "var(--tb-green)", color: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                    <DuoIcon name="check" size={36} />
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--tb-green-dark)", margin: "0 0 8px" }}>Message received.</h3>
                  <p style={{ fontSize: 15, color: "var(--tb-text-sec)", margin: 0, lineHeight: 1.6 }}>
                    We&apos;ll reply to your email within 4 business hours. Look for a confirmation in your inbox.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {serverError && (
                    <div style={{
                      background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
                      padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#DC2626",
                    }}>
                      {serverError}
                    </div>
                  )}

                  <div className="mk-form-row-3">
                    <FormField label="Full name" name="name" type="text" placeholder="Your name" value={formData.name} onChange={handleChange} required />
                    <FormField label="Email" name="email" type="email" placeholder="you@clinic.com" value={formData.email} onChange={handleChange} required />
                    <FormField label="Facility" name="facility" type="text" placeholder="Clinic or hospital" value={formData.facility} onChange={handleChange} />
                  </div>

                  <div className="mk-form-row-3" style={{ marginTop: 18 }}>
                    <div>
                      <label style={labelStyle}>Your role</label>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        style={{ ...inputStyle, color: formData.role ? "var(--tb-text)" : "var(--tb-text-muted)" }}
                      >
                        <option value="">Select role…</option>
                        <option value="physician">Physician / Doctor</option>
                        <option value="nurse">Nurse / Midwife</option>
                        <option value="admin">Clinic Administrator</option>
                        <option value="it">IT / Technical</option>
                        <option value="investor">Investor / Partner</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>What brings you here?</label>
                      <select
                        name="intent"
                        value={formData.intent}
                        onChange={handleChange}
                        required
                        style={{ ...inputStyle, color: formData.intent ? "var(--tb-text)" : "var(--tb-text-muted)" }}
                      >
                        {INTENT_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id} disabled={opt.id === ""}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <FormField label="Subject" name="subject" type="text" placeholder="Short headline" value={formData.subject} onChange={handleChange} required />
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <label style={labelStyle}>Message</label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      placeholder="A few sentences about your facility, what you're trying to solve, and your timeline."
                      rows={5}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--tb-sans)" }}
                    />
                  </div>

                  <div style={{
                    marginTop: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}>
                    <p style={{ fontSize: 13, color: "var(--tb-text-muted)", margin: 0, flex: "1 1 240px" }}>
                      By sending, you agree to our{" "}
                      <Link href="/privacy" style={{ color: "var(--tb-text-sec)", textDecoration: "underline" }}>Privacy Policy</Link>.
                    </p>
                    <button
                      type="submit"
                      className="mk-btn mk-btn-green mk-btn-lg"
                      disabled={submitting}
                      style={{ minWidth: 200, opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
                    >
                      {submitting ? "Sending…" : "Send message"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="mk-faq-section">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2 mk-faq-title">Before you write</h2>

            <div className="mk-faq-list">
              <FAQItem
                question="How quickly do you reply?"
                answer="Within 4 business hours, Monday through Friday. Demo requests and urgent pilot inquiries jump the queue."
              />
              <FAQItem
                question="Can I see TamamHealth in action first?"
                answer="Yes — pick &quot;Book a demo&quot; in the form and we&apos;ll tailor a walkthrough to your facility&apos;s size, specialty, and offline-first workflows."
              />
              <FAQItem
                question="Where is TamamHealth based?"
                answer="Founded at Tufts University in Medford, MA. Engineering is split between the US and Juba, South Sudan — so we&apos;re close to both the codebase and the clinicians we serve."
              />
              <FAQItem
                question="I represent a partner org or NGO — who do I reach?"
                answer="Email partnerships@tamamhealth.org with a short note on your organization and the health systems you serve. We&apos;ll route it to the right lead."
              />
            </div>
          </Reveal>
        </div>
      </section>

      <style jsx global>{`
        .mk-form-row-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px;
        }
        @media (max-width: 879.98px) {
          .mk-form-row-3 { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 539.98px) {
          .mk-form-row-3 { grid-template-columns: 1fr; }
        }
        .mk-channel-card:hover {
          border-color: var(--tb-green) !important;
          box-shadow: 0 12px 32px rgba(26,58,58,0.08) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </>
  );
}

/* ── Styles (shared inline) ───────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--tb-text)",
  marginBottom: 6,
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid var(--tb-cream-300)",
  fontSize: 15,
  fontFamily: "var(--tb-sans)",
  color: "var(--tb-text)",
  background: "#fff",
  outline: "none",
  transition: "border-color 0.15s",
};

/* ── Components ──────────────────────────────────────────────────── */

function FormField({ label, name, type, placeholder, value, onChange, required = false }: {
  label: string; name: string; type: string; placeholder: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

function ChannelCard({ icon, tone, label, primary, secondary, href }: {
  icon: "email" | "phone" | "location";
  tone: "blue" | "green" | "gold";
  label: string;
  primary: string;
  secondary: string;
  href?: string;
}) {
  const toneMap = {
    blue: { bg: "var(--tb-tint-blue)", fg: "var(--tb-blue-700)", primaryColor: "var(--tb-blue-900)" },
    green: { bg: "var(--tb-tint-green)", fg: "var(--tb-green)", primaryColor: "var(--tb-text-pri)" },
    gold: { bg: "var(--tb-tint-gold)", fg: "var(--tb-gold-dark)", primaryColor: "var(--tb-text-pri)" },
  }[tone];

  const inner = (
    <>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: toneMap.bg, color: toneMap.fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 18,
      }}>
        <DuoIcon name={icon} size={22} />
      </div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tb-text-muted)", margin: "0 0 6px" }}>
        {label}
      </p>
      <p style={{ fontSize: 17, fontWeight: 700, color: toneMap.primaryColor, margin: "0 0 6px", lineHeight: 1.3 }}>
        {primary}
      </p>
      <p style={{ fontSize: 13, color: "var(--tb-text-sec)", margin: 0, lineHeight: 1.5 }}>{secondary}</p>
    </>
  );

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    padding: "24px 26px",
    border: "1px solid var(--tb-cream-300)",
    boxShadow: "0 4px 16px rgba(26,58,58,0.04)",
    height: "100%",
    display: "block",
    textDecoration: "none",
    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
  };

  return href ? (
    <a href={href} style={cardStyle} className="mk-channel-card">{inner}</a>
  ) : (
    <div style={cardStyle}>{inner}</div>
  );
}

function SideEmail({ label, email, tone }: { label: string; email: string; tone: "blue" | "green" }) {
  const fg = tone === "blue" ? "var(--tb-blue-700)" : "var(--tb-green)";
  return (
    <a href={`mailto:${email}`} style={{
      display: "block",
      padding: "18px 20px",
      background: "#fff",
      borderRadius: 14,
      border: "1px solid var(--tb-cream-300)",
      textDecoration: "none",
      transition: "border-color 0.15s",
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tb-text-muted)", margin: "0 0 4px" }}>
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: fg, margin: 0, wordBreak: "break-all" }}>
        {email}
      </p>
    </a>
  );
}
