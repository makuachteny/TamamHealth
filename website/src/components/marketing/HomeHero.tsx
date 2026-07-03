"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MarketingActionModalButton } from "./MarketingActionModal";
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
              <p className="mk-home-split-hero-kicker">Our mission</p>
              <h1 className="mk-h1 mk-home-split-hero-title">
                We aspire to give every health facility in South Sudan one connected
                patient record — no matter what the network is doing.
              </h1>
              <p className="mk-body-lg mk-home-split-hero-subtitle">
                Tamam brings patients, wards, pharmacy, lab, blood bank, maternal &amp; child health, and
                registration into a single platform for the whole facility — built to work in every corner
                of South Sudan, online or off.
              </p>
              <div className="mk-home-split-hero-actions">
                <MarketingActionModalButton
                  intent="demo"
                  className="mk-btn mk-btn-green"
                  source="home-split-hero"
                >
                  Book a Demo
                </MarketingActionModalButton>
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

    <div className="mk-photo-hero-statement">
      <p className="mk-photo-hero-statement-lead">Starting in South Sudan &ndash; built to</p>
      <p className="mk-photo-hero-statement-main">
        scale to every <span className="mk-photo-hero-statement-accent">underserved</span>
      </p>
      <p className="mk-photo-hero-statement-lead">health system.</p>
    </div>
    </>
  );
}
