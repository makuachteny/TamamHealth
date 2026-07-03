"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Reveal,
  FAQItem,
} from "@/components/marketing/MarketingShared";
import { Check, Mail, Smartphone, MapPin } from "@/components/marketing/icons";

type Intent =
  | ""
  | "demo"
  | "pricing"
  | "pilot"
  | "partnership"
  | "careers"
  | "media"
  | "other";

const INTENT_OPTIONS: { id: Intent; label: string }[] = [
  { id: "", label: "Select a reason…" },
  { id: "demo", label: "Book a demo" },
  { id: "pricing", label: "Request pricing" },
  { id: "pilot", label: "Pilot at my facility" },
  { id: "partnership", label: "Partnership or integration" },
  { id: "careers", label: "Join the team" },
  { id: "media", label: "Press or media" },
  { id: "other", label: "Something else" },
];

function parseIntent(value: string | null): Intent {
  return INTENT_OPTIONS.some((option) => option.id === value) ? (value as Intent) : "";
}

function defaultSubjectForIntent(intent: Intent) {
  switch (intent) {
    case "demo":
      return "Demo request";
    case "pricing":
      return "Pricing request";
    case "pilot":
      return "Pilot request";
    case "partnership":
      return "Partnership inquiry";
    case "careers":
      return "Careers inquiry";
    case "media":
      return "Media inquiry";
    default:
      return "";
  }
}

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "intent" && !prev.subject ? { subject: defaultSubjectForIntent(value as Intent) } : {}),
    }));
  };

  useEffect(() => {
    const requestedIntent = parseIntent(new URLSearchParams(window.location.search).get("intent"));
    if (!requestedIntent) return;
    setFormData((prev) => ({
      ...prev,
      intent: requestedIntent,
      subject: prev.subject || defaultSubjectForIntent(requestedIntent),
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSubmitting(true);
    try {
      const isAppointment = formData.intent === "demo";
      const res = await fetch(isAppointment ? "/api/appointments" : "/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isAppointment
            ? {
                name: formData.name,
                email: formData.email,
                facility: formData.facility,
                source: "contact-page-demo",
                message: formData.message || formData.subject || "Demo request from contact page.",
              }
            : formData,
        ),
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
      {/* ── REACH US DIRECTLY (hero) ─────────────────────────────────── */}
      <section className="mk-section mk-section-cream mk-hero-contact">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 56px" }}>
              <span className="mk-label" style={{ color: "var(--tb-blue-700)" }}>REACH US DIRECTLY</span>
              <h2 className="mk-h2" style={{ marginTop: 10 }}>Pick the channel that works for you</h2>
              <p className="mk-body" style={{ color: "var(--tb-text-sec)", marginTop: 14 }}>
                Share what you are building, what you are seeing, or how you want to help.
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
                primary="support.tamam@gmail.com"
                secondary="For pilot partners, advisors, and mission allies"
                href="mailto:support.tamam@gmail.com"
              />
              <ChannelCard
                icon="phone"
                tone="green"
                label="Mission"
                primary="Pilot partnerships"
                secondary="Facilities, NGOs, clinicians, and public-health leaders"
              />
              <ChannelCard
                icon="location"
                tone="gold"
                label="Community"
                primary="South Sudanese everywhere"
                secondary="Diaspora, builders, donors, and advocates"
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
                background: "var(--tb-blue-900)",
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
                    alt="Teny Makuach, founder of TamamHealth"
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
                    Pilot partnerships, product feedback, or mission support — write to the team directly.
                  </p>
                  <a href="mailto:support.tamam@gmail.com" style={{ fontSize: 13, fontWeight: 700, color: "var(--tb-gold)", textDecoration: "none", borderBottom: "1px dashed var(--tb-gold)" }}>
                    support.tamam@gmail.com →
                  </a>
                </div>
              </div>

              {/* Partnerships / Careers split */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SideEmail label="Partnerships" email="support.tamam@gmail.com" tone="blue" />
                <SideEmail label="Careers" email="support.tamam@gmail.com" tone="green" />
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
                    <Check size={36} strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--tb-green-dark)", margin: "0 0 8px" }}>Message received.</h3>
                  <p style={{ fontSize: 15, color: "var(--tb-text-sec)", margin: 0, lineHeight: 1.6 }}>
                    Thank you for reaching out. We&apos;ll review your message and follow up where there is a clear fit for the mission.
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
                    <FormField label="Email" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
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
                answer="We are a small team, so response times vary. Pilot partnerships, health-worker feedback, and mission-aligned introductions are the highest priority."
              />
              <FAQItem
                question="Can I see TamamHealth in action first?"
                answer="Yes — pick &quot;Book a demo&quot; in the form and we&apos;ll tailor a walkthrough to your facility&apos;s size, specialty, and offline-first workflows."
              />
              <FAQItem
                question="Where is TamamHealth based?"
                answer="TamamHealth was founded at Tufts University and is being built with South Sudan at the center of the mission."
              />
              <FAQItem
                question="I represent a partner org or NGO — who do I reach?"
                answer="Email support.tamam@gmail.com with a short note about your organization, the health system you serve, and where you think TamamHealth can help."
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
  background: "#FEFFF9",
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

const CHANNEL_ICON_MAP = {
  email: Mail,
  phone: Smartphone,
  location: MapPin,
} as const;

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

  const IconComp = CHANNEL_ICON_MAP[icon];
  const inner = (
    <>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 18,
      }}>
        <IconComp size={22} strokeWidth={1.8} />
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
    background: "#FEFFF9",
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
      background: "#FEFFF9",
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
