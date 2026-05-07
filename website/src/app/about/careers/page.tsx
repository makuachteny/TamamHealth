"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Reveal,
} from "@/components/marketing/MarketingShared";
import { DuoIcon } from "@/components/marketing/DuoIcon";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Careers — Build healthcare technology that matters
   ═══════════════════════════════════════════════════════════════════ */

export default function CareersPage() {
  const benefits = [
    {
      title: "Remote-first",
      description: "Work from anywhere across East Africa. We believe great talent shouldn't be constrained by location.",
    },
    {
      title: "Healthcare coverage",
      description: "Comprehensive health insurance for you and your family, including dental and vision.",
    },
    {
      title: "Learning budget",
      description: "$2,000 annually for courses, conferences, books, and professional development.",
    },
    {
      title: "Flexible hours",
      description: "Results matter more than hours. Flexible scheduling that works with your life.",
    },
    {
      title: "Equity",
      description: "Own a piece of TamamHealth. All full-time team members receive equity grants with 4-year vesting.",
    },
    {
      title: "Team retreats",
      description: "Annual in-person gatherings where we align on strategy, build relationships, and celebrate wins.",
    },
  ];

  const jobs = [
    {
      title: "Software Engineer (Frontend)",
      location: "Remote",
      type: "Full-time",
      description: "Build intuitive interfaces for clinicians using React, TypeScript, and our design system. You'll partner closely with product and medical teams to ensure every interaction is thoughtful and efficient.",
    },
    {
      title: "Software Engineer (Backend)",
      location: "Juba / Remote",
      type: "Full-time",
      description: "Design and scale TamamHealth's API and data infrastructure. You'll work with Node.js, PostgreSQL, and cloud systems to power our platform serving thousands of healthcare providers.",
    },
    {
      title: "Clinical Advisor",
      location: "Juba",
      type: "Full-time",
      description: "Bridge the gap between clinical needs and product development. You'll lead user research with providers, define clinical workflows, and ensure TamamHealth aligns with South Sudan's healthcare standards.",
    },
    {
      title: "Product Designer",
      location: "Remote",
      type: "Full-time",
      description: "Design healthcare experiences that work. You'll research user needs, create prototypes, and guide implementation to ensure every feature is intuitive and clinically sound.",
    },
    {
      title: "Sales Lead (East Africa)",
      location: "Remote / Nairobi",
      type: "Full-time",
      description: "Own relationships with health system leaders and clinic networks across East Africa. You'll build partnerships, close deals, and expand TamamHealth's footprint in the region.",
    },
    {
      title: "Implementation Specialist",
      location: "Juba / Remote",
      type: "Full-time",
      description: "Lead clinic go-live projects. You'll coordinate training, manage data migration, and support clinics through launch to ensure successful adoption and positive outcomes.",
    },
  ];

  return (
    <>
      {/* ── HERO SECTION ────────────────────────────────────────────── */}
      <section className="mk-hero">
        <div className="mk-container">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}>
            <Reveal>
              <div style={{ marginBottom: 40 }}>
                <Image
                  src="/assets/doctor-nurse-consultation.jpg"
                  alt="Medical team collaborating during a meeting"
                  width={600}
                  height={350}
                  style={{ width: "100%", height: "auto", borderRadius: 12 }}
                />
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mk-h1">Build healthcare technology that matters</h1>
              <p className="mk-body-lg" style={{ marginTop: "24px", color: "var(--tb-text-sec)" }}>
                Join TamamHealth and help transform healthcare in South Sudan. We&apos;re looking for talented engineers, designers, and healthcare professionals who want to solve real problems in underserved regions.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── WHY TamamHealth SECTION ───────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: 800, margin: "0 auto", marginBottom: 60 }}>
              <h2 className="mk-h2">Why work at TamamHealth</h2>
              <p className="mk-body-lg" style={{ marginTop: 20, color: "var(--tb-text-sec)", lineHeight: 1.7 }}>
                At TamamHealth, you&apos;re not building another SaaS product. You&apos;re building healthcare technology
                for people who literally can&apos;t afford for it to fail. Every line of code, every design decision,
                every conversation is in service of doctors and nurses in South Sudan who are trying to save lives
                with limited resources. You work alongside founders who grew up in refugee camps and understand
                the problem you&apos;re solving.
              </p>
            </div>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, maxWidth: 1100, margin: "0 auto", marginBottom: 60 }}>
            <WhyCard
              title="Ship code that saves lives"
              description="Your commits don&apos;t just close tickets — they keep patient records alive when the power goes out. Every feature you build serves healthcare workers in some of the world&apos;s toughest environments."
              icon={<DuoIcon name="heart" size={44} />}
            />
            <WhyCard
              title="Hard problems, real constraints"
              description="Offline-first sync across unreliable networks. Sub-second search over thousands of encrypted records on low-end Android tablets. FHIR compliance for national health systems. This isn&apos;t CRUD — it&apos;s engineering at the edge."
              icon={<DuoIcon name="rocket" size={44} />}
            />
            <WhyCard
              title="Ground-floor equity, outsized ownership"
              description="We&apos;re three co-founders building from Tufts University. You won&apos;t be employee #500 lost in a Slack channel. You&apos;ll be in the room where architecture decisions happen and product direction gets set."
              icon={<DuoIcon name="users" size={44} />}
            />
          </div>

          {/* Stats section */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 32, maxWidth: 900, margin: "60px auto 0", paddingTop: 60, borderTop: "1px solid var(--tb-cream-300)" }}>
            <Reveal>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 8, fontFamily: "var(--tb-serif)" }}>6</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tb-text-sec)" }}>modules shipped</div>
              </div>
            </Reveal>
            <Reveal>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 8, fontFamily: "var(--tb-serif)" }}>2 weeks</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tb-text-sec)" }}>average implementation time</div>
              </div>
            </Reveal>
            <Reveal>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--tb-green)", marginBottom: 8, fontFamily: "var(--tb-serif)" }}>$10K</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tb-text-sec)" }}>won at Tufts New Ventures</div>
              </div>
            </Reveal>
            <Reveal>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--tb-blue-700)", marginBottom: 8, fontFamily: "var(--tb-serif)" }}>3</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tb-text-sec)" }}>co-founders, all from Tufts</div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── BENEFITS SECTION ────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: "60px" }}>Compensation & benefits</h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
            <Reveal>
              <div className="mk-benefits-grid">
                {benefits.map((benefit, idx) => (
                  <BenefitCard key={idx} benefit={benefit} />
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <Image
                src="/assets/community-health-worker.jpg"
                alt="Community health worker providing care"
                width={450}
                height={500}
                style={{ width: "100%", height: "auto", borderRadius: 12 }}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── APPLICATION PROCESS ────────────────────────────────────── */}
      <section className="mk-section mk-section-teal" style={{ borderTop: "4px solid var(--tb-gold)" }}>
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: 56, color: "white" }}>Application process</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 32, maxWidth: 1000, margin: "0 auto" }}>
              <ProcessStep number="1" title="Apply" description="Submit your CV and a brief note about why TamamHealth excites you." />
              <ProcessStep number="2" title="Screening call" description="Chat with our team about your background and what you're looking for (30 min)." />
              <ProcessStep number="3" title="Project or interview" description="Depending on the role, a technical project, design exercise, or deep-dive conversation." />
              <ProcessStep number="4" title="Conversation with founders" description="Meet with the team leading your area. We talk about culture, vision, and fit." />
              <ProcessStep number="5" title="Decision" description="We move fast. You'll hear back within a week of final conversations." />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── OPEN POSITIONS ──────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ textAlign: "center", marginBottom: "60px" }}>Open positions</h2>
            <div className="mk-jobs-grid">
              {jobs.map((job, idx) => (
                <JobCard key={idx} job={job} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── APPLICATION CTA ─────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
              <h2 className="mk-h2">Don&apos;t see your role?</h2>
              <p className="mk-body-lg" style={{ marginTop: "16px", marginBottom: "32px", color: "var(--tb-text-sec)" }}>
                We&apos;re always interested in talented people excited about our mission. Send us your CV and tell us what you&apos;d like to work on.
              </p>
              <Link href="mailto:careers@tamamhealth.org" className="mk-btn mk-btn-green mk-btn-lg">
                Send your CV
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </>
  );
}

/* ── Components ──────────────────────────────────────────────────── */

function WhyCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: 32, border: "1px solid var(--tb-border)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--tb-tint-blue)", color: "var(--tb-blue-700)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ width: 24, height: 24 }}>{icon}</div>
      </div>
      <h3 className="mk-h3" style={{ fontSize: "1.15rem", marginBottom: 12 }}>{title}</h3>
      <p className="mk-body" style={{ color: "var(--tb-text-sec)", margin: 0, lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

function BenefitCard({ benefit }: { benefit: { title: string; description: string } }) {
  return (
    <Reveal>
      <div className="mk-benefit-card">
        <h3 className="mk-h3" style={{ marginBottom: "12px" }}>{benefit.title}</h3>
        <p className="mk-body" style={{ color: "var(--tb-text-sec)" }}>{benefit.description}</p>
      </div>
    </Reveal>
  );
}

function ProcessStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: "center", color: "white" }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "rgba(255, 255, 255, 0.2)",
        border: "2px solid rgba(255, 255, 255, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 20px",
        fontSize: "1.5rem",
        fontWeight: 700,
        fontFamily: "var(--tb-serif)"
      }}>
        {number}
      </div>
      <h3 style={{ fontSize: "1.15rem", fontWeight: 600, margin: "0 0 8px", color: "white" }}>{title}</h3>
      <p style={{ fontSize: 14, margin: 0, opacity: 0.9, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

function JobCard({ job }: { job: { title: string; location: string; type: string; description: string } }) {
  return (
    <Reveal>
      <div className="mk-job-card">
        <div className="mk-job-header">
          <h3 className="mk-h3" style={{ marginBottom: "8px" }}>{job.title}</h3>
          <div className="mk-job-meta">
            <span className="mk-badge">{job.location}</span>
            <span className="mk-badge">{job.type}</span>
          </div>
        </div>
        <p className="mk-body" style={{ color: "var(--tb-text-sec)", marginTop: "16px", lineHeight: "1.6" }}>
          {job.description}
        </p>
        <Link href="/about/contact" className="mk-btn mk-btn-outline-green" style={{ marginTop: "16px", display: "inline-block" }}>
          Apply now
        </Link>
      </div>
    </Reveal>
  );
}
