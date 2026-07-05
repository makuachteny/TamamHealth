"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { HOME_CRISIS_STATS, HOME_GOAL_STATS, HOME_PRINCIPLES, HOME_TEAM } from "@/data/home";
import { Check, FileText, HeartPulse, Mail, MapPin, Network, ShieldCheck } from "@/components/marketing/icons";
import { Reveal } from "@/components/marketing/MarketingShared";

const PRINCIPLE_ICONS = {
  record: <FileText size={48} strokeWidth={1.7} />,
  offline: <HeartPulse size={48} strokeWidth={1.7} />,
  shield: <ShieldCheck size={48} strokeWidth={1.7} />,
  network: <Network size={48} strokeWidth={1.7} />,
} as const;

const PLATFORM_WORKFLOW_STEPS = [
  "Register",
  "Triage",
  "Consult",
  "Order",
  "Dispense",
  "Bill",
  "Report",
] as const;

const PLATFORM_OUTCOMES = [
  {
    title: "No duplicate records",
    body: "Each visit adds to the same patient story, so teams stop rebuilding history from paper slips.",
  },
  {
    title: "One source for operations",
    body: "Clinical work, pharmacy activity, billing, and reporting all stay connected to the encounter.",
  },
  {
    title: "Built for low connectivity",
    body: "Facilities can keep working through network gaps and sync when the connection returns.",
  },
] as const;

/* ── The Problem ─────────────────────────────────────────────────── */
export function HomeProblemSection() {
  return (
    <section className="mk-section mk-section-teal" id="problem">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-heading">
            <p className="mk-label mk-label--light">the problem</p>
            <h2 className="mk-h2" style={{ color: "#fff" }}>
              A health system asked to do the impossible
            </h2>
            <p className="mk-body" style={{ color: "rgba(255,255,255,0.78)", maxWidth: 640, margin: "16px auto 0" }}>
              South Sudan became independent in 2011 and has weathered civil war, flooding, and displacement
              ever since. These aren&apos;t abstractions — they are the odds facing every family, every day.
            </p>
          </div>
        </Reveal>

        <div className="mk-home-crisis-grid">
          {HOME_CRISIS_STATS.map((stat, i) => (
            <Reveal key={stat.value} delay={i * 0.06}>
              <div className="mk-home-crisis-card">
                <div className="mk-home-crisis-value">{stat.value}</div>
                <div className="mk-home-crisis-unit">{stat.unit}</div>
                <p className="mk-home-crisis-context">{stat.context}</p>
                <span className="mk-home-crisis-source">{stat.source}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mk-home-crisis-sources">
            Sources:{" "}
            <a href="https://data.who.int/countries/728" target="_blank" rel="noopener noreferrer">WHO</a> ·{" "}
            <a href="https://southsudan.unfpa.org/en/topics/maternal-health" target="_blank" rel="noopener noreferrer">UNFPA South Sudan</a> ·{" "}
            <a href="https://www.unocha.org/south-sudan" target="_blank" rel="noopener noreferrer">UN OCHA</a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── The Solution — guiding pillars ──────────────────────────────── */
export function HomePrinciplesSection() {
  return (
    <section className="mk-products-section" id="solution">
      <div className="mk-container">
        <Reveal>
          <div className="mk-products-header">
            <p className="mk-label">the solution</p>
            <h2 className="mk-h2">Simple enough for the front desk. Strong enough for the nation.</h2>
          </div>
        </Reveal>

        <div className="mk-products-grid mk-home-numbered-grid">
          {HOME_PRINCIPLES.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05}>
              <div className="mk-product-card mk-home-numbered-card">
                <span>{item.number}</span>
                <div className="mk-product-card-icon">
                  {PRINCIPLE_ICONS[item.icon]}
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomePlatformSection() {
  return (
    <section className="mk-section mk-section-white mk-home-platform-section">
      <div className="mk-container">
        <Reveal>
          <div className="mk-home-platform-flow">
            <p className="mk-label">The FLOW</p>
            <div className="mk-home-platform-flow-line" aria-label="TamamHealth workflow from registration to reporting">
              {PLATFORM_WORKFLOW_STEPS.map((step) => (
                <span key={step}>{step}</span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-split mk-home-platform-split">
            <div className="mk-split-image mk-dashboard-showcase">
              <Image
                src="/assets/Dashboard.png"
                alt="TamamHealth platform dashboard"
                width={1280}
                height={740}
                priority
              />
            </div>
            <div className="mk-split-content">
              <h2 className="mk-h2 mk-home-platform-heading">
                <span>Workflow</span>
              </h2>
              <p>
                From the front desk to the ward, every step in TamamHealth links back to the same patient encounter. Clinicians, facility teams, and health leaders can work from cleaner records without duplicating data.
              </p>
              <div className="mk-home-platform-checks">
                <span>Patient history</span>
                <span>Facility operations</span>
                <span>National reporting</span>
              </div>
              <a href="#team" className="mk-btn mk-btn-outline-green mk-home-platform-cta">
                Meet the team
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-home-platform-outcomes">
            {PLATFORM_OUTCOMES.map((item) => (
              <div className="mk-home-platform-outcome" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── The Goal ─────────────────────────────────────────────────────── */
export function HomeGoalSection() {
  return (
    <section className="mk-section mk-section-cream" id="goal">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-heading">
            <p className="mk-label" style={{ color: "var(--tb-gold-dark)" }}>the goal</p>
            <h2 className="mk-h2">Prove it works, then bring it to every clinic that needs it</h2>
            <p className="mk-body" style={{ color: "var(--tb-text-sec)", maxWidth: 620, margin: "16px auto 0" }}>
              We&apos;re raising $100,000 to launch TamamHealth in 10 clinics across Juba and greater South
              Sudan — proof that offline-first digital records can work in the hardest conditions on Earth.
            </p>
          </div>
        </Reveal>

        <div className="mk-home-goal-grid">
          {HOME_GOAL_STATS.map((stat, i) => (
            <Reveal key={stat.value} delay={i * 0.06}>
              <div className="mk-home-goal-stat">
                <span className="mk-home-goal-value">{stat.value}</span>
                <span className="mk-home-goal-label">{stat.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── The Team ─────────────────────────────────────────────────────── */
export function HomeTeamSection() {
  return (
    <section className="mk-section mk-section-white" id="team">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-heading">
            <p className="mk-label">the team</p>
            <h2 className="mk-h2">Built by people who lived it</h2>
            <p className="mk-body" style={{ color: "var(--tb-text-sec)", maxWidth: 620, margin: "16px auto 0" }}>
              TamamHealth started with Teny Makuach&apos;s firsthand experience of paper records failing
              patients in Kakuma Refugee Camp. At Tufts University, that beginning became a shared team
              mission — and in April 2026, the team won the $10,000 Healthcare Track at the Tufts $100K New
              Ventures Competition, selected from over 300 startups.
            </p>
          </div>
        </Reveal>

        <div className="mk-home-team-grid">
          {HOME_TEAM.map((member, i) => (
            <Reveal key={member.name} delay={i * 0.06}>
              <div className="mk-home-team-card">
                <div className="mk-home-team-photo">
                  <Image
                    src={member.image}
                    alt={`${member.name}, ${member.role} at TamamHealth`}
                    width={180}
                    height={180}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <h3>{member.name}</h3>
                <p>{member.role}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Get Involved / Contact ──────────────────────────────────────── */
export function HomeContactSection() {
  const [formData, setFormData] = useState({ name: "", email: "", facility: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, subject: "Website contact request" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setSubmitted(true);
      setFormData({ name: "", email: "", facility: "", message: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mk-section mk-section-teal" id="get-involved">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-heading">
            <p className="mk-label mk-label--light">get involved</p>
            <h2 className="mk-h2" style={{ color: "#fff" }}>The problem is enormous. The fix is buildable.</h2>
            <p className="mk-body" style={{ color: "rgba(255,255,255,0.78)", maxWidth: 560, margin: "16px auto 0" }}>
              Facility, NGO, funder, or just curious — tell us what you&apos;re building or how you want to help.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-home-contact-wrap">
            {submitted ? (
              <div className="mk-home-contact-success">
                <span aria-hidden="true"><Check size={30} strokeWidth={1.9} /></span>
                <h3>Message received.</h3>
                <p>Thank you for reaching out — we&apos;ll follow up where there&apos;s a clear fit for the mission.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mk-home-contact-form">
                {error && <p className="mk-home-contact-error">{error}</p>}
                <div className="mk-home-contact-row">
                  <label>
                    <span>Full name</span>
                    <input name="name" value={formData.name} onChange={handleChange} placeholder="Your name" required />
                  </label>
                  <label>
                    <span>Email</span>
                    <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required />
                  </label>
                  <label>
                    <span>Facility (optional)</span>
                    <input name="facility" value={formData.facility} onChange={handleChange} placeholder="Clinic or hospital" />
                  </label>
                </div>
                <label className="mk-home-contact-message">
                  <span>Message</span>
                  <textarea name="message" rows={4} value={formData.message} onChange={handleChange} placeholder="What you're building, or how you'd like to help." required />
                </label>
                <button type="submit" className="mk-btn mk-btn-green mk-btn-lg" disabled={submitting}>
                  {submitting ? "Sending…" : "Send message"}
                </button>
              </form>
            )}

            <div className="mk-home-contact-direct">
              <Mail size={16} strokeWidth={1.8} />
              <a href="mailto:support.tamam@gmail.com">support.tamam@gmail.com</a>
              <span className="mk-home-contact-divider" aria-hidden="true" />
              <MapPin size={16} strokeWidth={1.8} />
              <span>Founded at Tufts University · building for South Sudan</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
