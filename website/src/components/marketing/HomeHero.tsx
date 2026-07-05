"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { DuoIcon } from "./DuoIcon";
import { Reveal } from "./MarketingShared";

// Real field photos — South Sudanese health workers and the everyday strain
// of running a facility on paper — to make "the problem" concrete rather
// than abstract. (No stand-ins from other countries/faith contexts — South
// Sudan is majority Christian/traditional, not Muslim, so imagery needs to
// reflect that.)
const HERO_SLIDES = [
  {
    src: "/assets/landing-img.jpg",
    alt: "A team of South Sudanese midwives outside a maternity tent",
  },
  {
    src: "/assets/images/reviewing-health-records.jpeg",
    alt: "A family reviewing paper health records",
  },
  {
    src: "/assets/images/doctor-clipboard-review.jpeg",
    alt: "A clinician reviewing a patient's paper chart on a clipboard",
  },
  {
    src: "/assets/images/community-medication-distribution.jpeg",
    alt: "A health worker distributing medication and recording it in a paper register",
  },
  {
    src: "/assets/images/pediatric-ward-interior.jpeg",
    alt: "A crowded pediatric ward with limited beds",
  },
];

const SLIDE_DURATION_MS = 5000;

export function HomeHero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((current) => (current + 1) % HERO_SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <>
    <section className="mk-home-split-hero">
      <div className="mk-home-split-hero-body">
        <div className="mk-container mk-home-split-hero-grid">
          <Reveal>
            <div className="mk-home-split-hero-copy">
              <span className="mk-home-split-hero-tag">
                <DuoIcon name="location" size={13} color="currentColor" />
                South Sudan &middot; The world&apos;s youngest country
              </span>
              <h1 className="mk-h1 mk-home-split-hero-title">
                Here, a mother is more likely to die giving birth than almost anywhere on Earth.
              </h1>
              <p className="mk-body-lg mk-home-split-hero-subtitle">
                Not because no one cares — but because the clinics that serve her run on paper,
                without power, without records, without a way to know her story. Tamam is changing that.
              </p>
              <div className="mk-home-split-hero-actions">
                <a href="#problem" className="mk-btn mk-btn-green">
                  Understand the crisis
                  <DuoIcon name="chevron-down" size={14} color="currentColor" />
                </a>
                <a href="#solution" className="mk-btn mk-btn-outline-white">
                  See our solution
                  <DuoIcon name="arrow-right" size={14} color="currentColor" />
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mk-home-split-hero-visual">
              <span className="mk-home-split-hero-glow" aria-hidden="true" />
              <div className="mk-home-split-hero-image" role="group" aria-label="Photos illustrating the problem Tamam solves">
                {HERO_SLIDES.map((slide, index) => (
                  <Image
                    key={slide.src}
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    className={`mk-home-split-hero-slide${index === active ? " is-active" : ""}`}
                    aria-hidden={index !== active}
                  />
                ))}
              </div>
              <div className="mk-home-split-hero-dots" role="tablist" aria-label="Hero photos">
                {HERO_SLIDES.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={index === active}
                    aria-label={`Show photo ${index + 1}`}
                    className={index === active ? "is-active" : ""}
                    onClick={() => setActive(index)}
                  />
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="mk-container mk-home-split-hero-footer">
        <p className="mk-home-split-hero-eyebrow">
          <span className="mk-home-split-hero-eyebrow-dot" aria-hidden="true" />
          Offline-ready digital health infrastructure
        </p>
      </div>
    </section>
    </>
  );
}
