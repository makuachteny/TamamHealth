"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Reveal,
  TestimonialSwoosh,
} from "@/components/marketing/MarketingShared";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Case Studies Page
   Real-world success stories from South Sudan healthcare facilities
   ═══════════════════════════════════════════════════════════════════ */

export default function CaseStudiesPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const caseStudies = [
    {
      id: 1,
      hospital: "Juba Teaching Hospital",
      location: "Juba, Central Equatoria",
      type: "Hospital",
      staffSize: "450+ staff, 500 beds",
      challenge: "Overcrowded patient waiting areas and long wait times were impacting patient satisfaction and clinical throughput across all departments. Manual appointment systems caused missed appointments and scheduling conflicts.",
      solution: "Implemented TamamHealth EHR with integrated appointment scheduling, mobile check-in, and automated patient routing to optimize clinic flow. Staff trained on new workflows with dedicated support.",
      results: "Successfully transitioned all departments to digital workflows within 8 weeks. Real-time dashboards enabled administrators to monitor bottlenecks.",
      image: "doctor-nurse-consultation.jpg",
      imageAlt: "Doctor and nurse consultation during rounds",
      metrics: [
        { label: "Wait Times Reduced", value: "45%", context: "Average from 90 to 50 minutes" },
        { label: "Daily Throughput Increase", value: "30%", context: "600 to 780 patient visits/day" },
        { label: "Patient Satisfaction", value: "+52%", context: "HCAHPS scores improved" },
        { label: "No-show Rate Reduction", value: "38%", context: "Automated SMS reminders" },
      ],
    },
    {
      id: 2,
      hospital: "Upper Nile Rural Clinics Network",
      location: "Malakal, Upper Nile State",
      type: "Clinic",
      staffSize: "12 centers, 180+ CHWs",
      challenge: "Disconnected clinics across rural areas faced reporting delays, data inconsistencies, and inability to track Ministry of Health compliance metrics. Manual DHIS2 reporting took weeks.",
      solution: "Deployed TamamHealth's offline-first architecture with automated DHIS2 sync, enabling real-time data aggregation across all facilities even with limited connectivity. Training workshops held monthly.",
      results: "All 12 facilities now report compliant data monthly. Automated exports reduced administrative burden by 20+ hours/month across the network.",
      image: "community-health-worker.jpg",
      imageAlt: "Mother and child during health visit",
      metrics: [
        { label: "System Uptime", value: "98.5%", context: "Even in low-connectivity areas" },
        { label: "DHIS2 Compliance", value: "100%", context: "All submissions on time" },
        { label: "Data Sync Time", value: "-80%", context: "From 3 weeks to 4 days" },
        { label: "Administrative Savings", value: "240 hours/year", context: "Per network across all centers" },
      ],
    },
    {
      id: 3,
      hospital: "Malakal Women's Health Center",
      location: "Malakal, Upper Nile",
      type: "Clinic",
      staffSize: "95 staff, 8 clinicians",
      challenge: "High billing error rates and slow payment collection were straining clinic finances and reducing revenue from maternal health services. No visibility into payment status.",
      solution: "Integrated TamamHealth's billing module with mobile money connectivity and automated claims processing, streamlining revenue cycle management. Mobile money integration enabled direct patient payments.",
      results: "Billing errors virtually eliminated through automated validations. Mobile money payments increased to 65% of revenue. Staff now spend 3 hours/week vs 15 hours/week on billing.",
      image: "community-health-worker.jpg",
      imageAlt: "Community health worker in maternal health program",
      metrics: [
        { label: "Billing Error Reduction", value: "89%", context: "From 2.3% to 0.25% error rate" },
        { label: "Revenue Recovered (Year 1)", value: "$47,500", context: "Previously uncollected charges" },
        { label: "Collection Speed", value: "4x faster", context: "Same-day mobile money settlements" },
        { label: "Staff Time Savings", value: "12 hrs/week", context: "Per staff member on billing" },
      ],
    },
    {
      id: 4,
      hospital: "Bentiu Primary Health Center",
      location: "Bentiu, Unity State",
      type: "Health Center",
      staffSize: "25 staff, 2 doctors",
      challenge: "Limited resources and no digital infrastructure made patient tracking difficult. Medication stockouts occurred regularly due to poor inventory visibility.",
      solution: "Implemented TamamHealth's compact EHR with inventory tracking and automated reorder alerts. Mobile app enabled staff to update records even with intermittent power.",
      results: "Drug stockouts reduced by 92%. Staff productivity increased 40% with streamlined workflows. Integration with suppliers improved ordering accuracy.",
      image: "doctor-prescription.jpg",
      imageAlt: "Pharmacy shelves with medication",
      metrics: [
        { label: "Stockout Reduction", value: "92%", context: "From 18 to 1.5 per month" },
        { label: "Staff Productivity", value: "+40%", context: "More patient time, less paperwork" },
        { label: "Ordering Accuracy", value: "98%", context: "Up from 75% manual ordering" },
        { label: "Training Time", value: "12 hours", context: "Across all staff, very quick adoption" },
      ],
    },
  ];

  const facilityTypes = ["Hospital", "Clinic", "Health Center"];
  const filteredStudies = selectedType
    ? caseStudies.filter((study) => study.type === selectedType)
    : caseStudies;

  return (
    <>
      {/* ── HERO SECTION (side-by-side) ──────────────────────────────── */}
      <section className="mk-hero-split">
        <div className="mk-container">
          <div className="mk-hero-split-grid">
            <Reveal>
              <div className="mk-hero-split-text">
                <span className="mk-label">CASE STUDIES</span>
                <h1 className="mk-h1">What digital health rollouts deliver</h1>
                <p>
                  Stories from comparable healthcare facilities across East Africa — proven strategies
                  that drive efficiency, improve patient care, and strengthen facility finances.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mk-hero-split-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/community-health-worker.jpg"
                  alt="Community health worker on outreach"
                  loading="eager"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── STATS BANNER ──────────────────────────────────────────────── */}
      <section className="mk-stat-band">
        <div className="mk-container">
          <Reveal>
            <div className="mk-stat-row">
              <div className="mk-stat-badge">
                <strong>4</strong>
                <span>Facilities Studied</span>
              </div>
              <div className="mk-stat-badge">
                <strong>$150K+</strong>
                <span>Revenue recovered</span>
              </div>
              <div className="mk-stat-badge">
                <strong>98%</strong>
                <span>Average uptime</span>
              </div>
              <div className="mk-stat-badge">
                <strong>45%</strong>
                <span>Avg efficiency gain</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FACILITY TYPE FILTER ──────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ marginBottom: 48 }}>
              <h2 className="mk-h2" style={{ marginBottom: 24 }}>Filter by facility type</h2>
              <div style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}>
                <button
                  onClick={() => setSelectedType(null)}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 8,
                    border: !selectedType ? "2px solid var(--tb-green)" : "1px solid var(--tb-cream-300)",
                    background: !selectedType ? "var(--tb-green)" : "var(--tb-white)",
                    color: !selectedType ? "var(--tb-white)" : "var(--tb-text-pri)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  All Facilities
                </button>
                {facilityTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 8,
                      border: selectedType === type ? "2px solid var(--tb-green)" : "1px solid var(--tb-cream-300)",
                      background: selectedType === type ? "var(--tb-green)" : "var(--tb-white)",
                      color: selectedType === type ? "var(--tb-white)" : "var(--tb-text-pri)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CASE STUDY CARDS (alternating layout) ─────────────────────── */}
      {filteredStudies.map((study, index) => (
        <section
          key={study.id}
          className={`mk-section ${index % 2 === 0 ? "mk-section-white" : "mk-section-cream"}`}
        >
          <div className="mk-container">
            <Reveal>
              <div className={`mk-split ${index % 2 === 1 ? "mk-split-reverse" : ""}`}>
                <div className="mk-split-content">
                  <div style={{ marginBottom: 20 }}>
                    <span className="mk-label" style={{ color: "var(--tb-green)", fontSize: 11, fontWeight: 700 }}>
                      {study.type.toUpperCase()}
                    </span>
                    <p style={{ fontSize: 12, color: "var(--tb-text-ter)", marginTop: 8 }}>
                      {study.staffSize}
                    </p>
                  </div>

                  <h2 className="mk-h2" style={{ marginBottom: 8 }}>
                    {study.hospital}
                  </h2>
                  <p style={{ color: "var(--tb-text-sec)", marginBottom: 32, fontSize: 15 }}>
                    {study.location}
                  </p>

                  {/* Challenge Box */}
                  <div style={{ marginBottom: 28, padding: "20px", background: index % 2 === 0 ? "var(--tb-cream-50)" : "var(--tb-blue-50)", borderRadius: 8, borderLeft: "4px solid var(--tb-green)" }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--tb-text-pri)" }}>
                      Challenge
                    </h4>
                    <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, margin: 0 }}>
                      {study.challenge}
                    </p>
                  </div>

                  {/* Solution Box */}
                  <div style={{ marginBottom: 28, padding: "20px", background: index % 2 === 0 ? "var(--tb-cream-50)" : "var(--tb-blue-50)", borderRadius: 8, borderLeft: "4px solid var(--tb-blue-700)" }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--tb-text-pri)" }}>
                      Solution
                    </h4>
                    <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, margin: 0 }}>
                      {study.solution}
                    </p>
                  </div>

                  {/* Results Box */}
                  <div style={{ marginBottom: 32, padding: "20px", background: "var(--tb-green-50)", borderRadius: 8, borderLeft: "4px solid var(--tb-green)" }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--tb-text-pri)" }}>
                      Results
                    </h4>
                    <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, margin: 0 }}>
                      {study.results}
                    </p>
                  </div>

                  {/* Metrics Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                    {study.metrics.map((metric, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 18,
                          background: index % 2 === 0 ? "var(--tb-cream-100)" : "var(--tb-cream-200)",
                          borderRadius: 10,
                          border: "1px solid var(--tb-cream-300)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 26,
                            fontWeight: 700,
                            color: "var(--tb-green)",
                            marginBottom: 6,
                          }}
                        >
                          {metric.value}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--tb-text-pri)",
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          {metric.label}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--tb-text-ter)",
                            lineHeight: 1.4,
                          }}
                        >
                          {metric.context}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mk-split-image">
                  <Image
                    src={`/assets/${study.image}`}
                    alt={study.imageAlt}
                    width={600}
                    height={500}
                    style={{ width: "100%", height: "auto", borderRadius: 8 }}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      {/* ── TESTIMONIAL SECTION ─────────────────────────────────────── */}
      <section className="mk-section mk-section-teal">
        <div className="mk-container">
          <Reveal>
            <div className="mk-testimonial-inner">
              <div className="mk-testimonial-swoosh">
                <TestimonialSwoosh />
              </div>

              <div className="mk-testimonial-quote">
                <div className="mk-quote-mark">&ldquo;</div>
                <blockquote>
                  TamamHealth transformed how we operate. The EHR gives us visibility across our entire clinic network, even in areas with poor connectivity. Revenue recovery and compliance reporting are now automated — it&apos;s given us back dozens of hours each month that we spend on patient care instead of paperwork.
                </blockquote>
                <cite>
                  <strong>Dr. Emmanuel Okello</strong>
                  <span>Clinical Director, Upper Nile Rural Clinics Network</span>
                </cite>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BOTTOM CTA SECTION ────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
              <h2 className="mk-h2" style={{ marginBottom: 16 }}>
                See how TamamHealth can transform your practice
              </h2>
              <p
                className="mk-body-lg"
                style={{
                  marginBottom: 32,
                  color: "var(--tb-text-sec)",
                }}
              >
                Schedule a personalized demo to explore how facilities like yours achieved these results with TamamHealth.
              </p>
              <Link href="/ehr" className="mk-btn mk-btn-green mk-btn-lg">
                Schedule a demo
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
