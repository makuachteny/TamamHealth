"use client";

import Link from "next/link";
import { FAQItem, Reveal, TestimonialSwoosh } from "@/components/marketing/MarketingShared";

export interface FeatureStat {
  value: string;
  label: string;
}

export interface FeatureFAQ {
  question: string;
  answer: string;
}

export interface FeatureRelatedProduct {
  title: string;
  body: string;
  href: string;
  cta?: string;
  tone?: "blue" | "gold" | "green";
}

export interface FeatureTestimonial {
  quote: string;
  name: string;
  role: string;
  variant?: "teal" | "cream";
}

const RELATED_TONES: Record<NonNullable<FeatureRelatedProduct["tone"]>, string> = {
  blue: "var(--tb-tint-blue)",
  gold: "var(--tb-tint-gold)",
  green: "var(--tb-tint-green)",
};

export function FeatureStatsBand({ stats }: { stats: FeatureStat[] }) {
  return (
    <section className="mk-stat-band">
      <div className="mk-container">
        <Reveal>
          <div className="mk-stat-row">
            {stats.map((stat) => (
              <div className="mk-stat-badge" key={`${stat.value}-${stat.label}`}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FeatureTestimonialSection({ testimonial }: { testimonial: FeatureTestimonial }) {
  if (testimonial.variant === "cream") {
    return (
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
              <div style={{ fontSize: 48, color: "var(--tb-gold)", marginBottom: 24, fontFamily: "var(--tb-serif)" }}>&ldquo;</div>
              <blockquote style={{ fontSize: 20, lineHeight: 1.8, color: "var(--tb-text)", fontStyle: "normal", margin: "0 0 32px" }}>
                {testimonial.quote}
              </blockquote>
              <cite style={{ fontStyle: "normal" }}>
                <strong style={{ display: "block", fontSize: 16, fontWeight: 700, color: "var(--tb-text)" }}>{testimonial.name}</strong>
                <span style={{ fontSize: 14, color: "var(--tb-text-sec)" }}>{testimonial.role}</span>
              </cite>
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  return (
    <section className="mk-section mk-section-teal">
      <div className="mk-container">
        <Reveal>
          <div className="mk-testimonial-inner">
            <div className="mk-testimonial-swoosh">
              <TestimonialSwoosh />
            </div>

            <div className="mk-testimonial-quote">
              <div className="mk-quote-mark">&ldquo;</div>
              <blockquote>{testimonial.quote}</blockquote>
              <cite>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </cite>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FeatureFAQSection({ faqs }: { faqs: FeatureFAQ[] }) {
  return (
    <section className="mk-faq-section">
      <div className="mk-container">
        <Reveal>
          <h2 className="mk-h2 mk-faq-title">Frequently asked questions</h2>
          <div className="mk-faq-list">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FeatureRelatedProductsSection({
  heading,
  products,
}: {
  heading: string;
  products: FeatureRelatedProduct[];
}) {
  return (
    <section className="mk-section mk-section-white">
      <div className="mk-container">
        <Reveal>
          <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 48 }}>
            {heading}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 32 }}>
            {products.map((product) => (
              <div
                key={product.title}
                style={{
                  backgroundColor: RELATED_TONES[product.tone ?? "blue"],
                  padding: 32,
                  borderRadius: 12,
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--tb-text)" }}>
                  {product.title}
                </h3>
                <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 20, lineHeight: 1.6 }}>
                  {product.body}
                </p>
                <Link href={product.href} className="mk-btn mk-btn-outline-green mk-btn-sm">
                  {product.cta ?? "Learn more"}
                </Link>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
