"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { DuoIcon } from "./DuoIcon";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Shared Utility Components
   ═══════════════════════════════════════════════════════════════════ */

/* ── Reveal ─────────────────────────────────────────────────────
   No-op passthrough. Reveal animations were removed across the
   marketing site — content renders immediately, no fade-in, no
   scroll-triggered state. The wrapper div is preserved so existing
   grid/flex layouts that treat <Reveal> as a child item are
   unaffected. The `delay` prop is accepted for backwards compat
   but ignored.
*/
export function Reveal({ children }: { children: ReactNode; delay?: number }) {
  return <div>{children}</div>;
}

/* ── FAQ Accordion Item ────────────────────────────────────────── */
export function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mk-faq-item">
      <button
        className="mk-faq-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{question}</span>
        {open ? <DuoIcon name="minus" size={20} /> : <DuoIcon name="plus" size={20} />}
      </button>
      <div className={`mk-faq-answer ${open ? "open" : ""}`}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

/* ── Demo Request Form (Improved) ──────────────────────────────── */
export function DemoForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    zipCode: "",
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = "Valid email is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.zipCode.trim()) newErrors.zipCode = "Location is required";
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.fullName.trim(),
          email: formData.email.trim(),
          org: formData.companyName.trim(),
          role: "Prospective User",
          phone: formData.phone.trim(),
          message: `Location: ${formData.zipCode.trim()}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mk-demo-card" style={{ textAlign: "center", padding: "48px 32px" }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: "var(--tb-green)" }}>&#10003;</div>
        <h3 style={{ fontFamily: "var(--tb-serif)", marginBottom: 8, fontSize: 22 }}>Thank you!</h3>
        <p style={{ color: "var(--tb-text-sec)", marginBottom: 4 }}>
          We&apos;ve received your demo request.
        </p>
        <p style={{ color: "var(--tb-text-ter)", fontSize: 13 }}>
          Our team will contact you within 2 business hours.
        </p>
      </div>
    );
  }

  return (
    <div className="mk-demo-card">
      <h3>Request a free demo</h3>
      <p style={{ color: "var(--tb-text-sec)", fontSize: 14 }}>
        Tell us about your facility, and we&apos;ll schedule a personalized demo.
      </p>

      {serverError && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
          padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#DC2626",
        }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: "block", fontSize: 13, fontWeight: 600,
            color: "var(--tb-text-pri)", marginBottom: 6,
          }}>Full Name</label>
          <input
            className="mk-form-input" type="text"
            value={formData.fullName}
            onChange={(e) => {
              setFormData({ ...formData, fullName: e.target.value });
              if (errors.fullName) setErrors({ ...errors, fullName: "" });
            }}
            style={{ borderColor: errors.fullName ? "#C44536" : undefined }}
            required
          />
          {errors.fullName && <span style={{ fontSize: 12, color: "#C44536" }}>{errors.fullName}</span>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: "block", fontSize: 13, fontWeight: 600,
            color: "var(--tb-text-pri)", marginBottom: 6,
          }}>Facility / Company Name</label>
          <input
            className="mk-form-input" type="text"
            value={formData.companyName}
            onChange={(e) => {
              setFormData({ ...formData, companyName: e.target.value });
              if (errors.companyName) setErrors({ ...errors, companyName: "" });
            }}
            style={{ borderColor: errors.companyName ? "#C44536" : undefined }}
            required
          />
          {errors.companyName && <span style={{ fontSize: 12, color: "#C44536" }}>{errors.companyName}</span>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: "block", fontSize: 13, fontWeight: 600,
            color: "var(--tb-text-pri)", marginBottom: 6,
          }}>Email Address</label>
          <input
            className="mk-form-input" type="email"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: "" });
            }}
            style={{ borderColor: errors.email ? "#C44536" : undefined }}
            required
          />
          {errors.email && <span style={{ fontSize: 12, color: "#C44536" }}>{errors.email}</span>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: "block", fontSize: 13, fontWeight: 600,
            color: "var(--tb-text-pri)", marginBottom: 6,
          }}>Phone Number</label>
          <input
            className="mk-form-input" type="tel"
            value={formData.phone}
            onChange={(e) => {
              setFormData({ ...formData, phone: e.target.value });
              if (errors.phone) setErrors({ ...errors, phone: "" });
            }}
            style={{ borderColor: errors.phone ? "#C44536" : undefined }}
            required
          />
          {errors.phone && <span style={{ fontSize: 12, color: "#C44536" }}>{errors.phone}</span>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: "block", fontSize: 13, fontWeight: 600,
            color: "var(--tb-text-pri)", marginBottom: 6,
          }}>Location / Zip Code</label>
          <input
            className="mk-form-input" type="text"
            value={formData.zipCode}
            onChange={(e) => {
              setFormData({ ...formData, zipCode: e.target.value });
              if (errors.zipCode) setErrors({ ...errors, zipCode: "" });
            }}
            style={{ borderColor: errors.zipCode ? "#C44536" : undefined }}
            required
          />
          {errors.zipCode && <span style={{ fontSize: 12, color: "#C44536" }}>{errors.zipCode}</span>}
        </div>

        <button
          type="submit"
          className="mk-btn mk-btn-green mk-btn-lg mk-form-submit"
          disabled={submitting}
          style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
        >
          {submitting ? "Submitting..." : "Request Demo \u2192"}
        </button>
      </form>
    </div>
  );
}

/* ── Check Item ────────────────────────────────────────────────── */
export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li>
      <span className="mk-check-icon"><DuoIcon name="check" size={20} /></span>
      <span>{children}</span>
    </li>
  );
}

/* ── Animated Counter Component ────────────────────────────────── */
export function StatCounter({
  target,
  label,
  suffix = "",
  duration = 2000
}: {
  target: number;
  label: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuad = 1 - (1 - progress) * (1 - progress);
      setCount(Math.floor(target * easeOutQuad));
    }, 16);

    return () => clearInterval(interval);
  }, [isVisible, target, duration]);

  return (
    <div
      ref={ref}
      style={{
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: "var(--tb-green)",
          marginBottom: 8,
        }}
      >
        {count.toLocaleString()}{suffix}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--tb-text-sec)",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── Testimonial Swoosh SVG ────────────────────────────────────── */
export function TestimonialSwoosh() {
  return (
    <svg
      viewBox="0 0 500 350"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", color: "var(--tb-green)" }}
    >
      {/* Decorative curved path similar to Tebra screenshots */}
      <path
        d="M50 300 C50 300 50 150 250 150 C450 150 450 50 450 50"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M450 50 L470 60"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M450 50 L460 30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Section Decorative Icons ──────────────────────────────────── */
export function PricingBannerIcon() {
  return (
    <div style={{
      width: 56,
      height: 56,
      borderRadius: 14,
      background: "var(--tb-tint-gold)",
      color: "var(--tb-gold-dark)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      <DuoIcon name="billing" size={56} />
    </div>
  );
}
