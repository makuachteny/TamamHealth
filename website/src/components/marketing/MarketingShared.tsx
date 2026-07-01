"use client";

import { useState, ReactNode } from "react";
import { Check, Minus, Plus } from "@/components/marketing/icons";

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
        {open ? <Minus size={20} strokeWidth={1.8} /> : <Plus size={20} strokeWidth={1.8} />}
      </button>
      <div className={`mk-faq-answer ${open ? "open" : ""}`}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

/* ── Check Item ────────────────────────────────────────────────── */
export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li>
      <span className="mk-check-icon"><Check size={20} strokeWidth={1.8} /></span>
      <span>{children}</span>
    </li>
  );
}

/* ── Static Counter Component ──────────────────────────────────── */
export function StatCounter({
  target,
  label,
  suffix = "",
}: {
  target: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div
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
        {target.toLocaleString()}{suffix}
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
