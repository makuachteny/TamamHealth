"use client";

import Image from "next/image";
import Link from "next/link";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";

const TEAM = [
  { name: "Teny Makuach", role: "Founder", image: "/assets/founder-teny.jpg" },
  { name: "Ekow Williams", role: "Community & Partnerships", image: "/assets/founder-ekow.jpg" },
  { name: "Toye Adebayo", role: "Project Manager", image: "/assets/founder-toye.jpg" },
  { name: "Mark Dosu", role: "Software Developer", image: "/assets/Mark-Dosu.jpeg" },
  { name: "Chinonye Hycent", role: "Research Lead", image: "/assets/chinonye-hycent.jpg" },
  { name: "Isaac Kyalo", role: "Technical Lead", image: "/assets/isaac-kyalo.jpg" },
] as const;

export default function AboutPage() {
  return (
    <main className="mk-main">
      <MarketingHero
        variant="photo"
        eyebrow="OUR STORY"
        title="We are building Tamam from the problem up."
        subtitle="Tamam started with a simple belief: health workers should not have to depend on paper systems that lose the patient story. We are starting with offline-ready records for clinics and hospitals."
        primaryCta={{ label: "Talk to us", href: "/about/contact#contact-form" }}
        image="/assets/team-derby-center.jpg"
        imageAlt="Tamam team"
        imagePriority
      />

      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split" style={{ gap: 44, alignItems: "center" }}>
              <div className="mk-split-content">
                <p className="mk-label">WHY WE EXIST</p>
                <h2 className="mk-h2">The first job is remembering the patient.</h2>
                <p className="mk-body" style={{ marginTop: 18, lineHeight: 1.65 }}>
                  In paper-heavy facilities, a patient can move from registration to triage, consultation, lab, pharmacy, and billing with fragments of their story scattered across notebooks and forms.
                </p>
                <p className="mk-body" style={{ marginTop: 14, lineHeight: 1.65 }}>
                  Tamam is focused on one practical outcome: keep that story connected so health workers can make decisions with better context, even when the internet is unreliable.
                </p>
              </div>
              <div className="mk-split-image" style={{ borderRadius: 8, overflow: "hidden", aspectRatio: "4 / 3", position: "relative" }}>
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare team reviewing care information"
                  fill
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading" style={{ maxWidth: 780 }}>
              <p className="mk-label">WHAT WE ARE BUILDING</p>
              <h2 className="mk-h2">A lean health record for real facility workflows.</h2>
            </div>
          </Reveal>
          <div className="mk-products-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 16 }}>
            {[
              ["Offline-ready records", "Document visits during network gaps and sync when connection returns."],
              ["Connected departments", "Registration, clinical care, lab, pharmacy, billing, and reports stay tied to the same patient."],
              ["Practical rollout", "Start with the workflows a facility needs first, then expand as the team is ready."],
            ].map(([title, body]) => (
              <Reveal key={title}>
                <div className="mk-value-card" style={{ borderRadius: 8, padding: 22 }}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading" style={{ maxWidth: 720 }}>
              <p className="mk-label">TEAM</p>
              <h2 className="mk-h2">A small team building with focus.</h2>
            </div>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 22, maxWidth: 1040, margin: "0 auto" }}>
            {TEAM.map((member) => (
              <Reveal key={member.name}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 144, height: 144, borderRadius: "50%", overflow: "hidden", margin: "0 auto 14px", border: "2px solid var(--tb-cream-300)" }}>
                    <Image
                      src={member.image}
                      alt={`${member.name}, ${member.role} at Tamam`}
                      width={144}
                      height={144}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "var(--tb-text-pri)" }}>{member.name}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--tb-text-sec)", fontWeight: 700 }}>{member.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-cta-banner">
        <div className="mk-container">
          <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            <h2 className="mk-h2" style={{ marginBottom: 14 }}>Want to see the product?</h2>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--tb-text-sec)", marginBottom: 24 }}>
              We can walk through the current platform and talk honestly about what is ready, what is next, and what a pilot would require.
            </p>
            <Link href="/about/contact?intent=demo#contact-form" className="mk-btn mk-btn-green mk-btn-lg">
              Book a demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
