import Image from "next/image";
import { Reveal } from "./MarketingShared";

/* ═══════════════════════════════════════════════════════════════════
   Products page hero — full-bleed navy field, oversized light headline
   on the left, rounded photo-tile collage on the right, scroll cue,
   and a bracket-ruled stats band below. All stats are product truths
   (TamamHealth is pre-launch — no installed-base claims).
   ═══════════════════════════════════════════════════════════════════ */

const COLLAGE_TILES = [
  { src: "/assets/african-nurse.jpg", alt: "Nurse at a South Sudan facility", area: "a" },
  { src: "/assets/doctor-prescription.jpg", alt: "Clinician writing a prescription", area: "b" },
  { src: "/assets/doctor-tablet-review.jpg", alt: "Clinician reviewing records on a tablet", area: "c" },
  { src: "/assets/community-health-worker.jpg", alt: "Community health worker on outreach", area: "d" },
  { src: "/assets/doctor-nurse-consultation.jpg", alt: "Doctor and nurse in consultation", area: "e" },
] as const;

const STATS = [
  { value: "6", label: "Connected Systems" },
  { value: "25+", label: "Care & Admin Roles" },
  { value: "100%", label: "Offline-Ready" },
] as const;

export function ProductsHero() {
  return (
    <section className="mk-products-hero">
      <div className="mk-container mk-products-hero-top">
        <Reveal>
          <div className="mk-products-hero-copy">
            <h1 className="mk-products-hero-title">
              We&rsquo;re on
              <br />
              a journey to
              <br />
              digitize healthcare
              <br />
              across South Sudan
            </h1>
            <a href="#products-grid" className="mk-products-hero-scroll" aria-label="Scroll to services">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="12" y1="4" x2="12" y2="20" />
                <polyline points="5 13 12 20 19 13" />
              </svg>
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mk-products-hero-collage" aria-hidden="true">
            {COLLAGE_TILES.map((tile) => (
              <div key={tile.area} className={`mk-products-hero-tile mk-products-hero-tile--${tile.area}`}>
                <Image src={tile.src} alt={tile.alt} fill sizes="(max-width: 959px) 100vw, 40vw" style={{ objectFit: "cover" }} />
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="mk-container mk-products-hero-stats">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delay={0.1 + i * 0.08}>
            <div className="mk-products-hero-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
