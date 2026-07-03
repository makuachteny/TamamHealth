"use client";

import { useState, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
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

/* ── Split Feature Block ───────────────────────────────────────
   Alternating solid-color-panel + photo section, used to give a
   single idea (mission, story, safeguard) its own full-width
   moment instead of competing inside a card grid.
*/
export function SplitFeatureBlock({
  eyebrow,
  title,
  body,
  checks,
  href,
  linkLabel = "Learn more",
  image,
  imageAlt,
  imageSide = "right",
  tone = "navy",
}: {
  eyebrow: string;
  title: string;
  body: string;
  checks?: string[];
  href?: string;
  linkLabel?: string;
  image: string;
  imageAlt: string;
  imageSide?: "left" | "right";
  tone?: "navy" | "cream";
}) {
  return (
    <section className={`mk-feature-split mk-feature-split-${tone}${imageSide === "left" ? " mk-feature-split-reverse" : ""}`}>
      <div className="mk-feature-split-panel">
        <p className="mk-label mk-feature-split-eyebrow">{eyebrow}</p>
        <h2 className="mk-h2 mk-feature-split-title">{title}</h2>
        <p className="mk-feature-split-body">{body}</p>
        {checks && (
          <ul className="mk-check-list mk-feature-split-checks">
            {checks.map((item) => (
              <CheckItem key={item}>{item}</CheckItem>
            ))}
          </ul>
        )}
        {href && (
          <Link href={href} className="mk-feature-split-link">
            {linkLabel} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      <div className="mk-feature-split-media">
        <Image src={image} alt={imageAlt} fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
      </div>
    </section>
  );
}

/* ── Related Links Grid ───────────────────────────────────────
   Photo cards in a row, Merck "Explore our stories" style. Pass
   `href` on an item to make it a link to another page; omit it to
   render a plain, non-navigating info card (e.g. an in-page product
   summary that doesn't send the reader anywhere else).
*/
export function RelatedLinksGrid({
  heading,
  items,
  className,
}: {
  heading?: string;
  items: { label: string; title: string; body?: string; href?: string; image: string }[];
  className?: string;
}) {
  return (
    <section className={className ? `mk-related-links ${className}` : "mk-related-links"}>
      <div className="mk-container">
        {heading && <h3 className="mk-related-links-heading">{heading}</h3>}
        <div className="mk-related-links-grid">
          {items.map((item) => {
            const content = (
              <>
                <div className="mk-related-links-image">
                  <Image src={item.image} alt="" fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                </div>
                <span className="mk-related-links-label">{item.label}</span>
                <span className="mk-related-links-title">
                  {item.title} {item.href && <span aria-hidden="true">→</span>}
                </span>
                {item.body && <p className="mk-related-links-body">{item.body}</p>}
              </>
            );

            return item.href ? (
              <Link key={item.title} href={item.href} className="mk-related-links-card">
                {content}
              </Link>
            ) : (
              <div key={item.title} className="mk-related-links-card mk-related-links-card--static">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
