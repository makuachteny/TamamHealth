"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { Check, Minus, Plus } from "@/components/marketing/icons";

/* ═══════════════════════════════════════════════════════════════════
   Tamam Marketing — Shared Utility Components
   ═══════════════════════════════════════════════════════════════════ */

/* ── Reveal ─────────────────────────────────────────────────────
   Lightweight scroll reveal used by the existing marketing pages.
   It respects reduced-motion and reveals each section only once.
*/
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // One-time mount initialization from a browser-only API (matchMedia); the
      // synchronous set is the correct pattern here, not a derived-state anti-pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`mk-reveal${visible ? " mk-reveal--visible" : ""}`}
      style={{ "--mk-reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
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
