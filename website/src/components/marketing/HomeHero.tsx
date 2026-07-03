"use client";

import Image from "next/image";
import { MarketingActionModalButton } from "./MarketingActionModal";

// Real field photo — a South Sudanese clinician recording care on paper —
// to make the offline, paper-heavy status quo concrete rather than
// abstract. (No stand-ins from other countries/faith contexts — South
// Sudan is majority Christian/traditional, not Muslim, so imagery needs
// to reflect that.)
const HERO_IMAGE = {
  src: "/assets/images/doctor-clipboard-review.jpeg",
  alt: "A clinician reviewing a patient's paper chart on a clipboard in a South Sudanese facility",
};

export function HomeHero() {
  return (
    <section className="mk-home-photo-hero">
      <div className="mk-home-photo-hero-media">
        <Image
          src={HERO_IMAGE.src}
          alt={HERO_IMAGE.alt}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className="mk-home-photo-hero-scrim" aria-hidden="true" />
      </div>

      <div className="mk-container mk-home-photo-hero-container">
        <div className="mk-home-photo-hero-card">
          <p className="mk-home-photo-hero-kicker">Our mission</p>
          <h1 className="mk-home-photo-hero-title">
            We aspire to connect every health facility in South Sudan
            through a unified patient record.
          </h1>
          <MarketingActionModalButton
            intent="demo"
            className="mk-btn mk-btn-white mk-home-photo-hero-cta"
            source="home-photo-hero"
          >
            Book a Demo
          </MarketingActionModalButton>
        </div>
      </div>
    </section>
  );
}
