"use client";

import Image from "next/image";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal } from "@/components/marketing/MarketingShared";

const team = [
  {
    name: "Teny Makuach",
    role: "Founder",
    image: "/assets/founder-teny.jpg",
    initials: "TM",
  },
  {
    name: "Ekow Williams",
    role: "Community & Partnerships",
    image: "/assets/founder-ekow.jpg",
    initials: "EW",
  },
  {
    name: "Toye Adebayo",
    role: "Project Manager",
    image: "/assets/founder-toye.jpg",
    initials: "TA",
  },
  {
    name: "Mark Dosu",
    role: "Software Developer",
    image: "/assets/Mark-Dosu.jpeg",
    initials: "MD",
  },
  {
    name: "Chinonye Hycent",
    role: "Research Lead",
    image: "/assets/chinonye-hycent.jpg",
    initials: "CH",
  },
  {
    name: "Isaac Kyalo",
    role: "Technical Lead",
    image: "/assets/isaac-kyalo.jpg",
    initials: "IK",
  },
];

export default function TeamPage() {
  return (
    <>
      <MarketingHero
        variant="mosaic"
        eyebrow="OUR TEAM"
        title="The people building TamamHealth"
        subtitle="A multidisciplinary team building digital health infrastructure for facilities, health workers, patients, and public health leaders."
        image="/assets/team-derby-center.jpg"
        imageAlt="TamamHealth team"
        imagePriority
        className="mk-hero-team"
      />

      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-team-intro">
              <p className="mk-label">our mission</p>
              <h2 className="mk-h2">One mission, many hands.</h2>
              <p>
                TamamHealth started with Teny&apos;s firsthand experience of how broken paper records can fail patients. Today, the mission belongs to the whole team: build reliable, offline-ready health technology that helps clinics, hospitals, communities, and governments keep every patient story connected.
              </p>
            </div>
          </Reveal>

          <div className="mk-team-grid">
            {team.map((member, index) => (
              <Reveal key={member.name} delay={index * 0.04}>
                <TeamCard member={member} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-teal" style={{ borderTop: "4px solid var(--tb-gold)" }}>
        <div className="mk-container">
          <Reveal>
            <div className="mk-team-mission-band">
              <div>
                <p className="mk-label">how we work</p>
                <h2 className="mk-h2">Built close to the problem.</h2>
              </div>
              <p>
                We bring together product, engineering, research, partnerships, and implementation work so TamamHealth is not just software on a screen. Every decision is tested against real clinical workflows, low-connectivity settings, facility operations, and the reporting needs of health systems.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <p className="mk-label" style={{ color: "var(--tb-gold-dark)" }}>APRIL 2026</p>
                <h2 className="mk-h2">$10,000 Healthcare Track Winner</h2>
                <p className="mk-body" style={{ lineHeight: 1.8 }}>
                  In April 2026, TamamHealth competed in the Tufts $100K New Ventures Competition, the flagship venture competition at Tufts University hosted by the Derby Entrepreneurship Center.
                </p>
                <p className="mk-body" style={{ marginTop: 16, lineHeight: 1.8 }}>
                  The judges recognized a team building from lived experience, technical discipline, and a clear understanding of why healthcare software must keep working when infrastructure is unreliable.
                </p>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/team-tufts-win.jpg"
                  alt="TamamHealth team winning $10,000 at Tufts New Ventures Competition 2026"
                  width={600}
                  height={800}
                  style={{ width: "100%", height: "auto", borderRadius: 16 }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: "720px", margin: "0 auto" }}>
              <h2 className="mk-h2">Join the mission</h2>
              <p className="mk-body-lg" style={{ marginTop: "20px", marginBottom: "40px", color: "var(--tb-text-sec)", lineHeight: 1.7 }}>
                We&apos;re looking for builders, clinical advisors, researchers, and partners who believe health systems deserve tools that work in the real world.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <a href="mailto:support.tamam@gmail.com" className="mk-btn mk-btn-green">Get in touch</a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function TeamCard({ member }: { member: { name: string; role: string; image?: string; initials: string } }) {
  return (
    <article className="mk-team-card">
      <div className="mk-team-photo">
        {member.image ? (
          <Image
            src={member.image}
            alt={`${member.name}, ${member.role}`}
            fill
            sizes="(max-width: 760px) 86vw, 360px"
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        ) : (
          <span>{member.initials}</span>
        )}
      </div>
      <h3>{member.name}</h3>
      <p>{member.role}</p>
    </article>
  );
}
