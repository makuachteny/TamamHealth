"use client";

import { FAQItem, Reveal, RelatedLinksGrid, TestimonialSwoosh } from "@/components/marketing/MarketingShared";

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
  image: string;
}

export interface FeatureTestimonial {
  quote: string;
  attribution: string;
  variant?: "teal" | "cream";
}

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
              <cite style={{ fontStyle: "normal", fontSize: 14, fontWeight: 600, color: "var(--tb-text-sec)" }}>
                {testimonial.attribution}
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
              <cite>{testimonial.attribution}</cite>
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
    <RelatedLinksGrid
      heading={heading}
      items={products.map((product) => ({
        label: "Explore",
        title: product.title,
        body: product.body,
        href: product.href,
        image: product.image,
      }))}
    />
  );
}
