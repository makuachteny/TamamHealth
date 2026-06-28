"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { NewsletterSignup } from "@/components/marketing/NewsletterSignup";
import {
  Reveal,
} from "@/components/marketing/MarketingShared";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Blog & Insights Page
   Healthcare insights, digital health trends, South Sudan focus
   ═══════════════════════════════════════════════════════════════════ */

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const blogPosts = [
    {
      id: 1,
      title: "From Filing Cabinets to Cloud: A Clinic&apos;s 2-Week Migration Story",
      excerpt: "One clinic&apos;s journey from paper records to a fully digital system in just 14 days. See how staff adoption, training, and implementation went smoothly—and what they learned along the way.",
      category: "Digital Health",
      date: "March 15, 2025",
      image: "doctor-writing-notes.jpg",
      imageAlt: "Doctor writing clinical notes",
      readTime: 8,
      featured: false,
    },
    {
      id: 2,
      title: "200km to See a Doctor: How Telehealth Is Closing the Gap",
      excerpt: "In rural South Sudan, patients travel hundreds of kilometers for specialist consultation. Discover how telehealth is eliminating travel time and bringing specialist care to remote clinics on unreliable networks.",
      category: "Implementation",
      date: "March 8, 2025",
      image: "doctor-tablet-review.jpg",
      imageAlt: "Telehealth video consultation",
      readTime: 7,
      featured: false,
    },
    {
      id: 3,
      title: "M-Pesa Meets Medicine: How Clinics Collect 37% More Revenue",
      excerpt: "Integrating mobile money into clinic billing transforms patient payment collection. See how one facility increased payment collection by over a third in the first month.",
      category: "Technology",
      date: "February 28, 2025",
      image: "doctor-tablet-review.jpg",
      imageAlt: "Mobile health app on smartphone",
      readTime: 6,
      featured: false,
    },
    {
      id: 4,
      title: "The 3-Day Report That Now Takes 3 Minutes",
      excerpt: "Ministry of Health reporting used to consume days of manual data work. See how DHIS2 automation cuts monthly reporting time from 3 days to 3 minutes—with zero data entry errors.",
      category: "Policy",
      date: "February 20, 2025",
      image: "Dashboard.png",
      imageAlt: "Data analytics dashboard with charts",
      readTime: 9,
      featured: false,
    },
    {
      id: 5,
      title: "No Internet? No Problem. Engineering Healthcare at the Edge",
      excerpt: "How offline-first architecture ensures that patient records, charting, and clinical workflows continue seamlessly even when internet drops. Sync happens automatically when connectivity returns.",
      category: "Technology",
      date: "February 12, 2025",
      image: "doctor-prescription.jpg",
      imageAlt: "Pharmacy shelves with medication",
      readTime: 10,
      featured: false,
    },
    {
      id: 6,
      title: "Encrypting Patient Records When the Power Grid Fails",
      excerpt: "Healthcare data security in resource-limited settings requires different thinking. Learn how TamamHealth protects patient privacy even when clinics run on generators and backup batteries.",
      category: "Digital Health",
      date: "February 5, 2025",
      image: "village-community.jpg",
      imageAlt: "Community health outreach event",
      readTime: 7,
      featured: false,
    },
    {
      id: 7,
      title: "Paper Kills: How Offline Clinics Are Going Fully Digital",
      excerpt: "Manual paper records contribute to missed diagnoses and lost patient histories. See how digital-first clinics are reducing medical errors while improving care quality and staff efficiency.",
      category: "Case Studies",
      date: "March 22, 2025",
      image: "Dashboard.png",
      imageAlt: "Digital health transformation with analytics dashboard",
      readTime: 12,
      featured: true,
    },
    {
      id: 8,
      title: "Government Reporting That Doesn&apos;t Slow You Down",
      excerpt: "Ministry of Health compliance and DHIS2 integration doesn&apos;t have to be a bottleneck. Learn how modern EHRs can automate reporting while staying clinically focused.",
      category: "Policy",
      date: "March 18, 2025",
      image: "doctor-nurse-consultation.jpg",
      imageAlt: "Healthcare team reviewing data",
      readTime: 8,
      featured: false,
    },
    {
      id: 9,
      title: "12,000 Records in 14 Days: Malakal&apos;s Digital Leap",
      excerpt: "One of South Sudan&apos;s largest clinics migrated over 12,000 paper patient records to a digital system in two weeks. Here&apos;s how the team managed data quality, staff training, and minimal downtime.",
      category: "Case Studies",
      date: "March 10, 2025",
      image: "community-health-worker.jpg",
      imageAlt: "Community health worker with patient",
      readTime: 6,
      featured: false,
    },
  ];

  const categories = [
    "Digital Health",
    "Implementation",
    "Policy",
    "Technology",
    "Case Studies",
  ];

  const filteredPosts = selectedCategory
    ? blogPosts.filter((post) => post.category === selectedCategory)
    : blogPosts.filter((post) => !post.featured);

  const featuredPost = blogPosts.find((post) => post.featured);

  return (
    <>
      <MarketingHero
        variant="photo"
        eyebrow="INSIGHTS & RESOURCES"
        title="Insights for modern healthcare in South Sudan"
        subtitle="Articles on digital health transformation, EHR best practices, and healthcare innovation for facilities moving from paper to reliable digital workflows."
        primaryCta={{ label: "Read featured article", href: "#featured-article" }}
        image="/assets/doctor-writing-notes.jpg"
        imageAlt="Clinician writing notes"
        imagePriority
      />

      {/* ── FEATURED ARTICLE SECTION (mk-split) ───────────────────────── */}
      {featuredPost && (
        <section className="mk-section mk-section-white" id="featured-article">
          <div className="mk-container">
            <Reveal>
              <h2 className="mk-h2" style={{ marginBottom: 40 }}>Featured Article</h2>
              <div className="mk-split">
                <div className="mk-split-content">
                  <span className="mk-label" style={{ color: "var(--tb-green)" }}>FEATURED</span>
                  <h3 className="mk-h3" style={{ marginTop: 12, marginBottom: 16 }}>
                    {featuredPost.title}
                  </h3>
                  <p className="mk-body" style={{ marginBottom: 20 }}>
                    {featuredPost.excerpt}
                  </p>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
                    <span style={{ fontSize: 13, color: "var(--tb-text-ter)" }}>
                      {featuredPost.date}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--tb-text-ter)" }}>
                      {featuredPost.readTime} min read
                    </span>
                  </div>
                  <Link href="/about/contact#contact-form" className="mk-btn mk-btn-green">
                    Read article
                  </Link>
                </div>
                <div className="mk-split-image">
                  <Image
                    src={`/assets/${featuredPost.image}`}
                    alt={featuredPost.imageAlt}
                    width={600}
                    height={400}
                    style={{ width: "100%", height: "auto" }}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── CATEGORY FILTER TABS ──────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ marginBottom: 40 }}>
              <h2 className="mk-h2" style={{ marginBottom: 24 }}>All Articles</h2>
              <div style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: !selectedCategory ? "2px solid var(--tb-green)" : "1px solid var(--tb-cream-300)",
                    background: !selectedCategory ? "var(--tb-green)" : "var(--tb-white)",
                    color: !selectedCategory ? "var(--tb-white)" : "var(--tb-text-pri)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  All Articles
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: selectedCategory === cat ? "2px solid var(--tb-green)" : "1px solid var(--tb-cream-300)",
                      background: selectedCategory === cat ? "var(--tb-green)" : "var(--tb-white)",
                      color: selectedCategory === cat ? "var(--tb-white)" : "var(--tb-text-pri)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* BLOG GRID SECTION (responsive) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 32,
              }}
            >
              {filteredPosts.map((post, index) => (
                <Reveal key={post.id} delay={index * 0.05}>
                  <div
                    className="mk-product-card"
                    style={{
                      background: "var(--tb-white)",
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      overflow: "hidden",
                      boxShadow: "none",
                      transition: "none",
                      cursor: "pointer",
                    }}
                  >
                    {/* Image with 240px height, rounded top corners */}
                    <div
                      style={{
                        width: "100%",
                        height: 240,
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: "8px 8px 0 0",
                        background: "var(--tb-cream-200)",
                      }}
                    >
                      <Image
                        src={`/assets/${post.image}`}
                        alt={post.imageAlt}
                        width={340}
                        height={240}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center 25%",
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div
                      style={{
                        padding: "28px",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        marginBottom: 16,
                      }}>
                        <span
                          className="mk-label"
                          style={{
                            color: "var(--tb-green)",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {post.category}
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: "var(--tb-text-ter)",
                          fontWeight: 500,
                        }}>
                          {post.readTime} min read
                        </span>
                      </div>
                      <h3
                        className="mk-h3"
                        style={{
                          marginBottom: 12,
                          flex: 1,
                          fontSize: 18,
                          lineHeight: 1.4,
                        }}
                      >
                        {post.title}
                      </h3>
                      <p
                        className="mk-body"
                        style={{
                          marginBottom: 24,
                          color: "var(--tb-text-sec)",
                          flex: 1,
                          fontSize: 14,
                          lineHeight: 1.6,
                        }}
                      >
                        {post.excerpt}
                      </p>

                      {/* Date and Link */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: 16,
                          borderTop: "1px solid var(--tb-cream-300)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--tb-text-ter)",
                          }}
                        >
                          {post.date}
                        </span>
                        <Link
                          href="/about/contact#contact-form"
                          style={{
                            fontSize: 14,
                            color: "var(--tb-green)",
                            fontWeight: 600,
                            textDecoration: "none",
                            transition: "none",
                          }}
                        >
                          Read →
                        </Link>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── NEWSLETTER SIGNUP SECTION ────────────────────────────────── */}
      <section
        className="mk-section mk-section-teal"
        style={{ paddingTop: 64, paddingBottom: 64, borderTop: "4px solid var(--tb-gold)" }}
      >
        <div className="mk-container">
          <Reveal>
            <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
              <h2 className="mk-h2" style={{ marginBottom: 16 }}>
                Stay updated with digital health insights
              </h2>
              <p
                className="mk-body-lg"
                style={{
                  marginBottom: 32,
                  color: "var(--tb-text-sec)",
                }}
              >
                Get the latest healthcare insights, EHR best practices, and digital transformation tips delivered to your inbox.
              </p>
              <NewsletterSignup />
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
                Want to see these insights in action?
              </h2>
              <p
                className="mk-body-lg"
                style={{
                  marginBottom: 32,
                  color: "var(--tb-text-sec)",
                }}
              >
                Schedule a personalized demo to explore how TamamHealth transforms healthcare operations.
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
