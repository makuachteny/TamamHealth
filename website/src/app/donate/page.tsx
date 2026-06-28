"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MarketingHero } from "@/components/marketing/MarketingHero";
import { Reveal, FAQItem, CheckItem, StatCounter } from "@/components/marketing/MarketingShared";
import { FileText, Users, Tablet, Hospital, Heart, BarChart3, HeartPulse } from "@/components/marketing/icons";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth — Fund Our Pilot / Donation Page
   Fundraising page for the first clinical pilot in South Sudan
   Goal: $100,000 to launch across 10 clinics
   ═══════════════════════════════════════════════════════════════════ */

const GOFUNDME_URL = "https://gofundme.com/tamamhealth-pilot";

const impactTiers = [
  {
    amount: "$50",
    title: "Digitize a Clinic Week",
    description: "Covers the cost of migrating one week of paper records to TamamHealth for a rural clinic, preserving critical patient histories.",
    color: "var(--tb-tint-blue)",
    iconColor: "var(--tb-blue-700)",
    icon: <FileText size={56} strokeWidth={1.8} />,
  },
  {
    amount: "$250",
    title: "Train a Health Worker",
    description: "Funds a complete training program for one healthcare worker to master digital records, from charting to telehealth.",
    color: "var(--tb-tint-green)",
    iconColor: "var(--tb-green)",
    icon: <Users size={56} strokeWidth={1.8} />,
  },
  {
    amount: "$2,500",
    title: "Equip a Full Clinic",
    description: "Provides tablets, solar chargers, protective cases, and local server hardware for one clinic to go fully digital.",
    color: "var(--tb-tint-gold)",
    iconColor: "var(--tb-gold-dark)",
    icon: <Tablet size={56} strokeWidth={1.8} />,
  },
  {
    amount: "$10,000",
    title: "Launch a Pilot Site",
    description: "Covers 6 months of full operations for one pilot clinic — hardware, training, connectivity, support, and impact measurement.",
    color: "var(--tb-tint-green)",
    iconColor: "var(--tb-green)",
    icon: <Hospital size={56} strokeWidth={1.8} />,
  },
];

const presetAmounts = [25, 50, 100, 250, 500, 1000, 2500, 5000];

export default function DonatePage() {
  return (
    <>
      <MarketingHero
        variant="impact"
        eyebrow="FUNDRAISING CAMPAIGN"
        title="Help us bring digital health records to South Sudan"
        subtitle="We're raising $100,000 to launch TamamHealth in 10 clinics across Juba and greater South Sudan. Every dollar goes directly to equipment, training, and platform operations."
        primaryCta={{ label: "Donate on GoFundMe", href: GOFUNDME_URL }}
        secondaryCta={{ label: "See your impact", href: "#impact" }}
        stats={[
          { value: "$100K", label: "pilot goal" },
          { value: "10", label: "clinics in South Sudan" },
          { value: "100%", label: "pilot-focused funding" },
        ]}
        image="/assets/village-community.jpg"
        imageAlt="South Sudanese community members"
        imagePriority
        className="mk-hero-donate"
      />

      {/* ── DIVIDER ─────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── THE PROBLEM — Stats ─────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="mk-label" style={{ color: "var(--tb-gold-dark)" }}>THE PROBLEM</span>
              <h2 className="mk-h2" style={{ marginTop: 12 }}>Paper records are costing lives</h2>
              <p className="mk-body" style={{ color: "var(--tb-text-sec)", maxWidth: 560, margin: "12px auto 0" }}>
                In South Sudan, clinics lose patient records to floods, fires, and displacement. Healthcare workers spend hours on manual paperwork instead of patient care.
              </p>
            </div>
          </Reveal>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 32, maxWidth: 800, margin: "0 auto",
          }}>
            <Reveal delay={0}>
              <StatCounter target={83} suffix="%" label="of African health facilities still use paper records" />
            </Reveal>
            <Reveal delay={0.1}>
              <StatCounter target={40} suffix="%" label="of patient data is lost or incomplete during referrals" />
            </Reveal>
            <Reveal delay={0.2}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: "var(--tb-green)", marginBottom: 8 }}>6hrs</div>
                <div style={{ fontSize: 14, color: "var(--tb-text-sec)", fontWeight: 500 }}>spent weekly by clinicians on manual reporting</div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <p className="mk-body" style={{ textAlign: "center", marginTop: 40, color: "var(--tb-text-sec)", maxWidth: 640, marginLeft: "auto", marginRight: "auto", lineHeight: 1.8 }}>
              Our pilot will prove that offline-first digital records can work in the hardest conditions on Earth — and that the path to saving lives starts with better information.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── YOUR IMPACT — Tier Cards ───────────────────────────── */}
      <section id="impact" className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="mk-label" style={{ color: "var(--tb-green)" }}>YOUR IMPACT</span>
              <h2 className="mk-h2" style={{ marginTop: 12 }}>Every contribution transforms care</h2>
              <p className="mk-body" style={{ color: "var(--tb-text-sec)", maxWidth: 560, margin: "12px auto 0" }}>
                100% of donations go to the pilot. No admin fees, no overhead — just impact.
              </p>
            </div>
          </Reveal>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 24, maxWidth: 1040, margin: "0 auto",
          }}>
            {impactTiers.map((tier, i) => (
              <Reveal key={tier.title} delay={i * 0.08}>
                <div style={{
                  background: "#FEFFF9", borderRadius: 16, padding: "32px 28px",
                  border: "1px solid var(--tb-cream-300)", height: "100%",
                  display: "flex", flexDirection: "column", gap: 16,
                  boxShadow: "0 4px 16px rgba(26,58,58,0.04)",
                  transition: "box-shadow 0.25s, transform 0.25s",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: tier.color, color: tier.iconColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {tier.icon}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "var(--tb-green)" }}>{tier.amount}</div>
                  <h3 style={{ fontFamily: "var(--tb-serif)", fontSize: 18, fontWeight: 600, color: "var(--tb-text)", margin: 0 }}>
                    {tier.title}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.7, margin: 0, flex: 1 }}>
                    {tier.description}
                  </p>
                  <a
                    href={GOFUNDME_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mk-btn mk-btn-green mk-btn-sm"
                    style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                  >
                    Donate {tier.amount}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Custom Amount Picker */}
          <Reveal delay={0.2}>
            <DonationAmountPicker />
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── PILOT PLAN — Step Cards ─────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="mk-label">THE PILOT PLAN</span>
              <h2 className="mk-h2" style={{ marginTop: 12 }}>Where your money goes</h2>
              <p className="mk-body" style={{ color: "var(--tb-text-sec)", maxWidth: 560, margin: "12px auto 0" }}>
                A transparent breakdown of how we&apos;ll deploy $100,000 across 10 clinics in South Sudan over 12 months.
              </p>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, maxWidth: 1040, margin: "0 auto" }}>
            {[
              {
                step: "PHASE 1", title: "Equipment & Infrastructure", cost: "$30,000", timeline: "Month 1–2",
                items: ["Tablets and protective cases for 10 clinics", "Solar chargers and backup batteries", "Local server hardware and networking", "Secure data storage setup"],
                bg: "var(--tb-tint-blue)", color: "var(--tb-blue-700)",
                icon: <Tablet size={56} strokeWidth={1.8} />,
              },
              {
                step: "PHASE 2", title: "Training & Onboarding", cost: "$25,000", timeline: "Month 2–4",
                items: ["5-day intensive training per clinic", "40+ healthcare workers certified", "Paper-to-digital record migration", "On-site mentorship program"],
                bg: "var(--tb-tint-green)", color: "var(--tb-green)",
                icon: <Users size={56} strokeWidth={1.8} />,
              },
              {
                step: "PHASE 3", title: "Operations & Support", cost: "$30,000", timeline: "Month 3–10",
                items: ["On-site technical support teams", "Connectivity and data costs", "Ongoing maintenance and updates", "Community health worker integration"],
                bg: "var(--tb-tint-gold)", color: "var(--tb-gold-dark)",
                icon: <HeartPulse size={56} strokeWidth={1.8} />,
              },
              {
                step: "PHASE 4", title: "Measurement & Scale", cost: "$15,000", timeline: "Month 8–12",
                items: ["Impact measurement and data analysis", "DHIS2 national reporting integration", "Documentation for scale to 50+ clinics", "Sustainability planning"],
                bg: "var(--tb-tint-green)", color: "var(--tb-green)",
                icon: <BarChart3 size={56} strokeWidth={1.8} />,
              },
            ].map((phase, i) => (
              <Reveal key={phase.step} delay={i * 0.08}>
                <div style={{
                  background: "#FEFFF9", padding: 32, borderRadius: 16,
                  border: "1px solid var(--tb-cream-300)",
                  boxShadow: "0 4px 16px rgba(26,58,58,0.04)",
                  height: "100%", display: "flex", flexDirection: "column",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: phase.bg, color: phase.color,
                    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
                  }}>
                    {phase.icon}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: phase.color, letterSpacing: "0.05em", marginBottom: 4 }}>{phase.step}</div>
                  <div style={{ fontSize: 11, color: "var(--tb-text-ter)", marginBottom: 12 }}>{phase.timeline}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "var(--tb-text)", margin: "0 0 16px" }}>
                    {phase.title}
                  </h3>
                  <ul className="mk-check-list" style={{ marginBottom: 20, flex: 1 }}>
                    {phase.items.map((item) => (
                      <CheckItem key={item}>{item}</CheckItem>
                    ))}
                  </ul>
                  <div style={{ fontSize: 24, fontWeight: 800, color: phase.color }}>{phase.cost}</div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Total banner */}
          <Reveal delay={0.2}>
            <div style={{
              padding: "24px 32px", borderRadius: 16,
              background: "var(--tb-tint-green)", border: "2px solid var(--tb-green)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: 16, maxWidth: 1040, margin: "40px auto 0",
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tb-green)" }}>Total Campaign Goal</div>
                <div style={{ fontSize: 13, color: "var(--tb-text-sec)", marginTop: 4 }}>100% goes directly to the pilot — zero admin overhead</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--tb-green)" }}>$100,000</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DIVIDER ─────────────────────────────────────────────── */}
      <div className="mk-divider"></div>

      {/* ── FOUNDERS — Split Section ───────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <span className="mk-label" style={{ color: "var(--tb-gold-dark)" }}>THE TEAM</span>
                <h2 className="mk-h2">Built by people who lived it</h2>
                <p className="mk-body" style={{ lineHeight: 1.8 }}>
                  TamamHealth started with Teny Makuach&apos;s firsthand experience of how broken paper records can fail patients. Today, the work is carried by a growing team across product, engineering, research, partnerships, and implementation, building the digital health platform South Sudan deserves.
                </p>

                <ul className="mk-check-list" style={{ marginTop: 24 }}>
                  <CheckItem><strong>$10,000 Healthcare Track Winner</strong> — Tufts $100K New Ventures Competition</CheckItem>
                  <CheckItem>Clinician-designed with feedback from 15+ healthcare workers</CheckItem>
                  <CheckItem>Built offline-first for the hardest connectivity environments</CheckItem>
                </ul>

                <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
                  <a
                    href={GOFUNDME_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mk-btn mk-btn-gold mk-btn-lg"
                  >
                    Support our mission
                  </a>
                  <Link href="/about" className="mk-btn mk-btn-outline mk-btn-lg">
                    Read our story
                  </Link>
                </div>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/team-tufts-win.jpg"
                  alt="TamamHealth team winning at Tufts $100K Competition"
                  width={600}
                  height={450}
                  style={{ width: "100%", height: "auto", borderRadius: 16 }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="mk-faq-section">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2 mk-faq-title">Donation FAQs</h2>
            <div className="mk-faq-list">
              <FAQItem
                question="Where does my donation go?"
                answer="100% of donations go directly to the pilot program. This covers hardware (tablets, solar chargers), training for healthcare workers, connectivity, on-site support, and impact measurement. Our team's time is donated — zero admin overhead."
              />
              <FAQItem
                question="Why GoFundMe?"
                answer="GoFundMe is the most trusted fundraising platform globally, with donor protection and transparent fund tracking. It allows us to share updates with donors as the pilot progresses."
              />
              <FAQItem
                question="Is my donation tax-deductible?"
                answer="We are working toward 501(c)(3) status. In the meantime, donations are processed through GoFundMe. We can provide receipts for all contributions."
              />
              <FAQItem
                question="When does the pilot start?"
                answer="The pilot launches as soon as we reach our funding goal. We have partner clinics in Juba ready to go and a team on the ground. We expect to begin within 4 weeks of reaching the goal."
              />
              <FAQItem
                question="How will I know my donation made a difference?"
                answer="We send regular updates through GoFundMe showing exactly how funds are used, with photos, data, and stories from the clinics. You'll see the direct impact of your contribution."
              />
              <FAQItem
                question="Can I donate in other ways?"
                answer="Yes! We also accept donations of hardware (tablets, laptops), technical expertise, and partnerships. Contact us at support.tamam@gmail.com to discuss other ways to contribute."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section className="mk-section mk-section-teal" style={{ borderTop: "4px solid var(--tb-gold)" }}>
        <div className="mk-container">
          <Reveal>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
              <h2 className="mk-h2" style={{ color: "#fff" }}>Every dollar saves lives</h2>
              <p className="mk-body-lg" style={{ marginTop: 16, marginBottom: 32, color: "var(--tb-text-inv-m)" }}>
                Help us prove that offline-first digital health records can work in the hardest conditions on Earth. Your donation directly funds 10 pilot clinics in South Sudan.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <a
                  href={GOFUNDME_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mk-btn mk-btn-gold mk-btn-lg"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <Heart size={18} strokeWidth={1.8} />
                  Donate on GoFundMe
                </a>
                <Link href="/about/contact#contact-form" className="mk-btn mk-btn-outline-white mk-btn-lg">
                  Contact Us
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ── Custom Donation Amount Picker ────────────────────────────── */
function DonationAmountPicker() {
  const [selected, setSelected] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  const activeAmount = selected ?? (customAmount ? Number(customAmount) : null);
  const donateUrl = activeAmount && activeAmount > 0
    ? `${GOFUNDME_URL}?amount=${activeAmount}`
    : GOFUNDME_URL;

  return (
    <div style={{
      maxWidth: 640, margin: "48px auto 0",
      background: "#FEFFF9", borderRadius: 16, padding: "36px 32px",
      border: "1px solid var(--tb-cream-300)",
      boxShadow: "0 4px 16px rgba(26,58,58,0.04)",
    }}>
      <h3 style={{
        fontFamily: "var(--tb-serif)", fontSize: 20, fontWeight: 700,
        color: "var(--tb-text)", marginBottom: 8, textAlign: "center",
      }}>
        Choose your contribution
      </h3>
      <p style={{ fontSize: 14, color: "var(--tb-text-sec)", textAlign: "center", marginBottom: 24 }}>
        Select a preset amount or enter your own.
      </p>

      {/* Preset amount grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, marginBottom: 16,
      }}>
        {presetAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => { setSelected(amt); setCustomAmount(""); }}
            style={{
              padding: "12px 8px", borderRadius: 10,
              border: selected === amt ? "2px solid var(--tb-green)" : "1px solid var(--tb-cream-300)",
              background: selected === amt ? "var(--tb-tint-green)" : "#fff",
              fontSize: 15, fontWeight: 700, fontFamily: "inherit",
              color: selected === amt ? "var(--tb-green)" : "var(--tb-text)",
              cursor: "pointer", transition: "all 0.15s ease",
              outline: "none",
            }}
          >
            ${amt.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Custom amount input */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <span style={{
          position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
          fontSize: 16, fontWeight: 600, color: "var(--tb-text-sec)",
        }}>$</span>
        <input
          type="number"
          min="1"
          placeholder="Enter custom amount"
          value={customAmount}
          onChange={(e) => { setCustomAmount(e.target.value); setSelected(null); }}
          onFocus={() => setSelected(null)}
          style={{
            width: "100%", padding: "14px 16px 14px 32px",
            border: customAmount ? "2px solid var(--tb-green)" : "1px solid var(--tb-cream-300)",
            borderRadius: 10, fontSize: 15, fontFamily: "inherit",
            background: customAmount ? "var(--tb-tint-green)" : "#fff",
            boxSizing: "border-box", outline: "none",
          }}
        />
      </div>

      {/* Donate CTA */}
      <a
        href={donateUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "14px 24px", borderRadius: 10,
          background: activeAmount ? "var(--tb-green)" : "var(--tb-cream-300)",
          color: activeAmount ? "#fff" : "var(--tb-text-sec)",
          fontSize: 15, fontWeight: 700, textDecoration: "none",
          cursor: activeAmount ? "pointer" : "default",
          transition: "all 0.2s ease",
          pointerEvents: activeAmount ? "auto" : "none",
          opacity: activeAmount ? 1 : 0.6,
          boxSizing: "border-box",
        }}
      >
        <Heart size={16} strokeWidth={1.8} />
        {activeAmount ? `Donate $${activeAmount.toLocaleString()} on GoFundMe` : "Select an amount to donate"}
      </a>

      <p style={{ fontSize: 12, color: "var(--tb-text-ter)", textAlign: "center", marginTop: 12 }}>
        Secure payment processed through GoFundMe. 100% goes to the pilot.
      </p>
    </div>
  );
}
