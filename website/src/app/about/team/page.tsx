"use client";

import Image from "next/image";
import {
  Reveal,
} from "@/components/marketing/MarketingShared";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Team — The three co-founders behind TamamHealth
   Real founders: Teny Makuach, Ekow Williams, Toye Adebayo
   Tufts University students, New Ventures 2026 Healthcare Track Winners
   ═══════════════════════════════════════════════════════════════════ */

export default function TeamPage() {
  return (
    <>
      {/* ── HERO SECTION WITH TEAM PHOTO BACKGROUND ───────────────────── */}
      <section className="mk-hero-photo-bg">
        <Image
          src="/assets/team-derby-center.jpg"
          alt="TamamHealth team"
          fill
          className="mk-hero-bg-img"
          priority
        />
        <div className="mk-container" style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <Reveal>
            <span className="mk-label" style={{ color: "var(--tb-gold)" }}>OUR TEAM</span>
            <h1 className="mk-h1" style={{ color: "#fff", marginTop: 12 }}>The people behind TamamHealth</h1>
            <p className="mk-body-lg" style={{ color: "var(--tb-text-inv-m)", marginTop: 16 }}>
              Three co-founders from Tufts University on a shared mission to transform
              healthcare delivery across Africa.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FOUNDER PROFILES ────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 56 }}>Meet the founders</h2>
          </Reveal>

          {/* ── TENY MAKUACH ──────────────────────────────────────────── */}
          <Reveal>
            <div className="mk-split" style={{ marginBottom: 64 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                  width: 300,
                  height: 300,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "5px solid var(--tb-gold)",
                  boxShadow: "0 16px 48px rgba(26,58,58,0.10)",
                  position: "relative"
                }}>
                  <Image
                    src="/assets/founder-teny.jpg"
                    alt="Teny Makuach"
                    fill
                    sizes="300px"
                    style={{ objectFit: "cover", objectPosition: "center top" }}
                  />
                </div>
              </div>
              <div>
                <span className="mk-label" style={{ color: "var(--tb-green)", marginBottom: 8 }}>FOUNDER &amp; CEO</span>
                <h2 className="mk-h3" style={{ marginTop: 8 }}>Teny Makuach</h2>
                <p className="mk-body" style={{ marginTop: 16 }}>
                  Teny founded TamamHealth and designed the platform&apos;s architecture — the offline-first engine, clinical workflows, and sync protocol. Born in Kakuma Refugee Camp, he brings firsthand understanding of what healthcare workers need when infrastructure fails. He leads product vision and ensures every feature serves the clinician at the bedside.
                </p>
              </div>
            </div>
          </Reveal>

          {/* ── TOYE ADEBAYO ─────────────────────────────────────────── */}
          <Reveal>
            <div className="mk-split mk-split-reverse" style={{ marginBottom: 64 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                  width: 300,
                  height: 300,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "5px solid var(--tb-gold)",
                  boxShadow: "0 16px 48px rgba(26,58,58,0.10)",
                  position: "relative"
                }}>
                  <Image
                    src="/assets/founder-toye.jpg"
                    alt="Toye Adebayo"
                    fill
                    sizes="300px"
                    style={{ objectFit: "cover", objectPosition: "center top" }}
                  />
                </div>
              </div>
              <div>
                <span className="mk-label" style={{ color: "var(--tb-green)", marginBottom: 8 }}>CO-FOUNDER &amp; CTO</span>
                <h2 className="mk-h3" style={{ marginTop: 8 }}>Toye Adebayo</h2>
                <p className="mk-body" style={{ marginTop: 16 }}>
                  Toye leads TamamHealth&apos;s technical execution — hardening the PouchDB-to-CouchDB sync protocol, building the FHIR-compliant API layer, and architecting the system to handle thousands of concurrent offline nodes. His distributed systems expertise ensures clinical data stays consistent across unreliable networks.
                </p>
              </div>
            </div>
          </Reveal>

          {/* ── EKOW WILLIAMS ────────────────────────────────────────── */}
          <Reveal>
            <div className="mk-split" style={{ marginBottom: 64 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{
                  width: 300,
                  height: 300,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "5px solid var(--tb-gold)",
                  boxShadow: "0 16px 48px rgba(26,58,58,0.10)",
                  position: "relative"
                }}>
                  <Image
                    src="/assets/founder-ekow.jpg"
                    alt="Ekow Williams"
                    fill
                    sizes="300px"
                    style={{ objectFit: "cover", objectPosition: "center top" }}
                  />
                </div>
              </div>
              <div>
                <span className="mk-label" style={{ color: "var(--tb-green)", marginBottom: 8 }}>CO-FOUNDER &amp; COO</span>
                <h2 className="mk-h3" style={{ marginTop: 8 }}>Ekow Williams</h2>
                <p className="mk-body" style={{ marginTop: 16 }}>
                  Ekow bridges hardware and operations — from the low-power connectivity infrastructure that keeps rural clinics online to the deployment logistics that put TamamHealth in the field. His electrical engineering background drives the hardware strategy that makes digital health possible where most technology fails.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TUFTS NEW VENTURES WIN ──────────────────────────────────── */}
      <section className="mk-section mk-section-teal" style={{ borderTop: "4px solid var(--tb-gold)" }}>
        <div className="mk-container">
          <Reveal>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 40, maxWidth: 900, margin: "0 auto" }}>
              <div className="mk-stat-card">
                <strong style={{ fontSize: 48, fontFamily: "var(--tb-serif)", color: "var(--tb-gold)" }}>$10K</strong>
                <span>Won the Healthcare &amp; Life Science Track at the Tufts $100K New Ventures Competition 2026</span>
              </div>
              <div className="mk-stat-card">
                <strong style={{ fontSize: 48, fontFamily: "var(--tb-serif)", color: "var(--tb-green)" }}>3</strong>
                <span>Co-founders from Tufts University building TamamHealth together</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TUFTS WIN PHOTO ─────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <p className="mk-label" style={{ color: "var(--tb-gold-dark)" }}>APRIL 2026</p>
                <h2 className="mk-h2">$10,000 Healthcare Track Winner</h2>
                <p className="mk-body" style={{ lineHeight: 1.8 }}>
                  In April 2026, the TamamHealth team competed in the Tufts $100K New Ventures
                  Competition — the flagship venture competition at Tufts University, hosted by
                  the Derby Entrepreneurship Center. Teams from across the university pitch
                  their ventures in three tracks: General, Social Impact, and Healthcare &amp;
                  Life Science.
                </p>
                <p className="mk-body" style={{ marginTop: 16, lineHeight: 1.8 }}>
                  TamamHealth won the Healthcare &amp; Life Science Track, taking home $10,000 in
                  prize funding. The judges recognized the team&apos;s deep connection to the
                  problem — a platform built by someone who grew up in a refugee camp,
                  engineered by students who understood that the best healthcare software is
                  the kind that works when everything else fails.
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

      {/* ── CULTURE SECTION ─────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <span className="mk-label" style={{ color: "var(--tb-green)" }}>HOW WE WORK</span>
                <h2 className="mk-h2" style={{ marginTop: 8 }}>Small team. Deep empathy. Relentless focus.</h2>
                <p className="mk-body" style={{ marginTop: 20, lineHeight: 1.8 }}>
                  TamamHealth was born from lived experience and a shared mission. We&apos;re a three-person founding team building out of Tufts University. We move fast, stay close to the problem, and talk to healthcare workers every week.
                </p>
                <p className="mk-body" style={{ marginTop: 16, lineHeight: 1.8 }}>
                  Everything we build is tested against real clinical workflows and validated by the people who will actually use it. We believe the best healthcare technology is built by small teams with deep empathy for the communities they serve.
                </p>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Healthcare team collaborating on patient care"
                  width={560}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── ADVISORS & MENTORS ──────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 56 }}>Advisors & mentors</h2>
          </Reveal>
          <Reveal>
            <div style={{ maxWidth: 800, margin: "0 auto", background: "var(--tb-cream-50)", border: "1px solid var(--tb-cream-300)", borderRadius: 16, padding: 48, textAlign: "center" }}>
              <p className="mk-body-lg" style={{ color: "var(--tb-text-sec)", marginBottom: 24 }}>
                We&apos;re building an advisory board of healthcare leaders, technologists, and operators from East Africa
                and the diaspora. If you&apos;re interested in advising TamamHealth, we&apos;d love to talk.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <a href="mailto:hello@tamamhealth.org" className="mk-btn mk-btn-green">Contact us</a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── JOINING TamamHealth ──────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: "720px", margin: "0 auto" }}>
              <h2 className="mk-h2">Join the mission</h2>
              <p className="mk-body-lg" style={{ marginTop: "20px", marginBottom: "40px", color: "var(--tb-text-sec)", lineHeight: 1.7 }}>
                We&apos;re looking for talented engineers, designers, clinical advisors, and healthcare professionals
                who believe that the best healthcare technology is built by people who understand the problem firsthand.
                If you want to build tools that work when lives are on the line, we want to talk.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <a href="mailto:careers@tamamhealth.org" className="mk-btn mk-btn-green">Get in touch</a>
              </div>
              <p className="mk-body" style={{ marginTop: 24, color: "var(--tb-text-sec)", fontSize: 14 }}>
                Or email us directly at <a href="mailto:careers@tamamhealth.org" style={{ color: "var(--tb-blue-700)", fontWeight: 600, textDecoration: "none" }}>careers@tamamhealth.org</a>
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
