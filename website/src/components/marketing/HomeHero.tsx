"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketingActionModalButton } from "./MarketingActionModal";
import { Reveal } from "./MarketingShared";

type IntroContent = {
  kind: "intro";
};

type StatContent = {
  kind: "stat";
  eyebrow: string;
  value: string;
  /** Longer values (e.g. "64 per 1,000") need a smaller ceiling than short
   *  ones (e.g. "45-50%") to stay on a single line at the same container
   *  width — this overrides the default clamp() per slide. */
  valueSize?: string;
  body: string;
};

type HeroContent = IntroContent | StatContent;

// Single fixed background image — the content overlay is what slides, not
// the photo. Existing asset only.
const HERO_BACKGROUND = {
  src: "/assets/landing-img.jpg",
  alt: "TamamHealth field team of nurses outside a maternity tent in South Sudan",
};

const HERO_CONTENT: HeroContent[] = [
  { kind: "intro" },
  {
    kind: "stat",
    eyebrow: "South Sudan today",
    value: "45-50%",
    body: "of the population can physically reach a functioning health facility",
  },
  {
    kind: "stat",
    eyebrow: "South Sudan today",
    value: "64 per 1,000",
    valueSize: "clamp(36px, 6vw, 84px)",
    body: "newborn deaths at live births",
  },
  {
    kind: "stat",
    eyebrow: "South Sudan today",
    value: "2-3%",
    body: "of annual government spending goes to health",
  },
];

const SLIDE_DURATION_MS = 6000;

export function HomeHero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((current) => (current + 1) % HERO_CONTENT.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <>
    <section className="mk-photo-hero">
      <div className="mk-photo-hero-slides" aria-hidden="true">
        <Image
          src={HERO_BACKGROUND.src}
          alt={HERO_BACKGROUND.alt}
          fill
          priority
          sizes="100vw"
          className="mk-photo-hero-img"
        />
        <div className="mk-photo-hero-scrim" />
      </div>

      <div className="mk-photo-hero-content">
        <div className={`mk-container mk-photo-hero-top mk-photo-hero-top--${HERO_CONTENT[active].kind}`}>
          <Reveal>
            <div className="mk-photo-hero-slider">
              {HERO_CONTENT.map((content, index) => (
                <div
                  key={index}
                  className={`mk-photo-hero-slide-content${index === active ? " is-active" : ""}`}
                  aria-hidden={index !== active}
                >
                  {content.kind === "stat" ? (
                    <div className="mk-photo-hero-stat" role="status" aria-live="polite">
                      <p className="mk-photo-hero-stat-eyebrow">{content.eyebrow}</p>
                      <span className="mk-photo-hero-stat-rule" aria-hidden="true" />
                      <strong
                        className="mk-photo-hero-stat-value"
                        style={content.valueSize ? { fontSize: content.valueSize } : undefined}
                      >
                        {content.value}
                      </strong>
                      <p className="mk-photo-hero-stat-body">{content.body}</p>
                    </div>
                  ) : (
                    <div className="mk-photo-hero-intro">
                      <h1 className="mk-photo-hero-title">
                        Many communities.
                        <br />
                        One system of care.
                      </h1>
                      <p className="mk-photo-hero-subtitle">
                        Tamam brings patients, wards, pharmacy, lab, blood bank, maternal &amp; child health, and
                        registration into a single platform for the whole facility — built to work in every corner
                        of South Sudan, online or off.
                      </p>
                      <div className="mk-photo-hero-actions">
                        <MarketingActionModalButton
                          intent="demo"
                          className="mk-btn mk-btn-green mk-photo-hero-cta"
                          source="home-photo-hero"
                        >
                          Book a Demo
                        </MarketingActionModalButton>
                        <Link href="/about/contact" className="mk-photo-hero-secondary">
                          Get in Touch
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mk-container mk-photo-hero-bottom">
          <div className="mk-photo-hero-brand">
            <Image
              src="/assets/logos/SVG/Tamam_Style_Guide-31.svg"
              alt="Tamam"
              width={220}
              height={45}
              className="mk-photo-hero-wordmark"
            />
            <p className="mk-photo-hero-tagline">
              <span className="mk-photo-hero-dot" aria-hidden="true" />
              Offline-ready digital health infrastructure
            </p>
          </div>

          <div className="mk-photo-hero-dots" role="tablist" aria-label="Hero slides">
            {HERO_CONTENT.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Show slide ${index + 1}`}
                className={index === active ? "is-active" : ""}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>

    <div className="mk-photo-hero-statement">
      <p>
        Starting in South Sudan &ndash; built to scale to every{" "}
        <span className="mk-photo-hero-statement-accent">underserved</span> health system.
      </p>
    </div>
    </>
  );
}
