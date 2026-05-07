"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Reveal,
  CheckItem,
} from "@/components/marketing/MarketingShared";
import { Icon } from "@iconify/react";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth API Documentation Page
   REST API, FHIR-compliant endpoints, SDK downloads
   ═══════════════════════════════════════════════════════════════════ */

export default function APIDocs() {
  const endpointCategories = [
    {
      id: 1,
      title: "Patient Records",
      description: "CRUD operations, search, demographics, medical history",
      endpoint: "GET /api/v1/patients",
    },
    {
      id: 2,
      title: "Appointments",
      description: "Scheduling, availability, reminders, cancellations",
      endpoint: "GET /api/v1/appointments",
    },
    {
      id: 3,
      title: "Clinical Data",
      description: "Encounters, observations, diagnoses, vital signs",
      endpoint: "GET /api/v1/encounters",
    },
    {
      id: 4,
      title: "Billing",
      description: "Claims, payments, eligibility verification",
      endpoint: "GET /api/v1/claims",
    },
    {
      id: 5,
      title: "Lab & Pharmacy",
      description: "Orders, results, prescriptions, medications",
      endpoint: "GET /api/v1/lab-orders",
    },
    {
      id: 6,
      title: "Reporting",
      description: "DHIS2 export, analytics queries, bulk data",
      endpoint: "GET /api/v1/reports",
    },
  ];

  const sdks = [
    {
      language: "Python",
      package: "pip install tamamhealth-sdk",
      icon: <Icon icon="logos:python" width={40} height={40} />,
    },
    {
      language: "JavaScript",
      package: "npm install tamamhealth-sdk",
      icon: <Icon icon="logos:javascript" width={40} height={40} />,
    },
    {
      language: "Java",
      package: "gradle add com.tamamhealth:sdk",
      icon: <Icon icon="logos:java" width={40} height={40} />,
    },
  ];

  return (
    <>
      {/* ── HERO SECTION (side-by-side) ──────────────────────────────── */}
      <section className="mk-hero-split">
        <div className="mk-container">
          <div className="mk-hero-split-grid">
            <Reveal>
              <div className="mk-hero-split-text">
                <span className="mk-label">DEVELOPER DOCS</span>
                <h1 className="mk-h1">TamamHealth API Documentation</h1>
                <p>
                  Build integrations with our FHIR-compliant REST APIs for healthcare data
                  exchange and system integration across South Sudan.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mk-hero-split-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/african-nurse.jpg"
                  alt="Health worker using TamamHealth on a phone"
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
                <strong>6</strong>
                <span>API Modules</span>
              </div>
              <div className="mk-stat-badge">
                <strong>FHIR R4</strong>
                <span>Compliant</span>
              </div>
              <div className="mk-stat-badge">
                <strong>OAuth 2.0</strong>
                <span>Authentication</span>
              </div>
              <div className="mk-stat-badge">
                <strong>99.9%</strong>
                <span>Uptime SLA</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── QUICK START SECTION ───────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ marginBottom: 40 }}>Quick Start</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 28,
            }}>
              <Reveal delay={0.05}>
                <div style={{
                  padding: 28,
                  background: "var(--tb-cream-50)",
                  borderRadius: 12,
                  border: "1px solid var(--tb-cream-300)",
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    background: "var(--tb-blue-100)",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 24 }}>1</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Get API Credentials</h4>
                  <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, marginBottom: 16 }}>
                    Log into your TamamHealth dashboard and navigate to Settings to generate your API key and client secret.
                  </p>
                  <Link href="/about/contact" style={{ fontSize: 14, color: "var(--tb-green)", fontWeight: 600, textDecoration: "none" }}>
                    Create credentials →
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={0.1}>
                <div style={{
                  padding: 28,
                  background: "var(--tb-cream-50)",
                  borderRadius: 12,
                  border: "1px solid var(--tb-cream-300)",
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    background: "var(--tb-blue-100)",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 24 }}>2</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Authenticate</h4>
                  <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, marginBottom: 16 }}>
                    Exchange your credentials for an OAuth 2.0 access token. Include the token in all API requests.
                  </p>
                  <Link href="/about/contact" style={{ fontSize: 14, color: "var(--tb-green)", fontWeight: 600, textDecoration: "none" }}>
                    View auth guide →
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={0.15}>
                <div style={{
                  padding: 28,
                  background: "var(--tb-cream-50)",
                  borderRadius: 12,
                  border: "1px solid var(--tb-cream-300)",
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    background: "var(--tb-blue-100)",
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 24 }}>3</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Make API Calls</h4>
                  <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, marginBottom: 16 }}>
                    Start making requests to endpoints. Use the code samples below or dive into full documentation.
                  </p>
                  <Link href="/about/contact" style={{ fontSize: 14, color: "var(--tb-green)", fontWeight: 600, textDecoration: "none" }}>
                    View examples →
                  </Link>
                </div>
              </Reveal>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── API OVERVIEW SECTION ──────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split">
              <div className="mk-split-content">
                <h2 className="mk-h2">API Fundamentals</h2>

                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--tb-text-pri)" }}>Base URL</h3>
                  <div style={{
                    padding: 12,
                    background: "var(--tb-white)",
                    border: "1px solid var(--tb-cream-300)",
                    borderRadius: 6,
                    fontFamily: "monospace",
                    fontSize: 14,
                    color: "var(--tb-blue-700)",
                    fontWeight: 500,
                    wordBreak: "break-word",
                  }}>
                    https://api.tamamhealth.org/v1
                  </div>
                </div>

                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--tb-text-pri)" }}>Authentication</h3>
                  <p style={{ fontSize: 14, color: "var(--tb-text-sec)", lineHeight: 1.6, marginBottom: 12 }}>
                    All API requests require OAuth 2.0 authentication. Obtain your client credentials from the TamamHealth dashboard and exchange them for access tokens.
                  </p>
                  <ul style={{ paddingLeft: 20, margin: 0 }}>
                    <li style={{ fontSize: 13, color: "var(--tb-text-sec)", marginBottom: 8 }}>Use client credentials grant flow</li>
                    <li style={{ fontSize: 13, color: "var(--tb-text-sec)", marginBottom: 8 }}>Access tokens expire after 1 hour</li>
                    <li style={{ fontSize: 13, color: "var(--tb-text-sec)" }}>Include Bearer token in Authorization header</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--tb-text-pri)" }}>Rate Limits</h3>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}>
                    <div style={{
                      padding: 12,
                      background: "var(--tb-white)",
                      borderRadius: 6,
                      border: "1px solid var(--tb-cream-300)",
                    }}>
                      <div style={{ fontSize: 12, color: "var(--tb-text-ter)", fontWeight: 600, marginBottom: 4 }}>Standard</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tb-green)" }}>1,000/hour</div>
                    </div>
                    <div style={{
                      padding: 12,
                      background: "var(--tb-white)",
                      borderRadius: 6,
                      border: "1px solid var(--tb-cream-300)",
                    }}>
                      <div style={{ fontSize: 12, color: "var(--tb-text-ter)", fontWeight: 600, marginBottom: 4 }}>Enterprise</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tb-green)" }}>Custom</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--tb-text-pri)" }}>Key Features</h3>
                  <ul className="mk-check-list">
                    <CheckItem>FHIR R4 compliant resources</CheckItem>
                    <CheckItem>OAuth 2.0 authentication</CheckItem>
                    <CheckItem>Webhook support for real-time events</CheckItem>
                    <CheckItem>Batch operations for bulk data</CheckItem>
                    <CheckItem>JSON request/response format</CheckItem>
                  </ul>
                </div>
              </div>
              <div className="mk-split-image">
                <Image
                  src="/assets/dashboard-screenshot.png"
                  alt="API documentation dashboard"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto", borderRadius: 8 }}
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── API ENDPOINTS SECTION ─────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ marginBottom: 40 }}>API Endpoints</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
            }}>
              {endpointCategories.map((category, index) => (
                <Reveal key={category.id} delay={index * 0.05}>
                  <Link href="/about/contact" style={{ textDecoration: "none" }}>
                    <div className="mk-product-card" style={{
                      background: "var(--tb-white)",
                      border: "1px solid var(--tb-cream-300)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}>
                      <h3 className="mk-h3" style={{ marginBottom: 8 }}>
                        {category.title}
                      </h3>
                      <p style={{ fontSize: 14, color: "var(--tb-text-sec)", marginBottom: 16, lineHeight: 1.6 }}>
                        {category.description}
                      </p>
                      <div style={{
                        padding: 8,
                        background: "var(--tb-cream-100)",
                        borderRadius: 4,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "var(--tb-blue-700)",
                        fontWeight: 600,
                      }}>
                        {category.endpoint}
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CODE EXAMPLE SECTION ──────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div className="mk-split mk-split-reverse">
              <div className="mk-split-image">
                <Image
                  src="/assets/doctor-tablet-review.jpg"
                  alt="Healthcare API integration"
                  width={600}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
              <div className="mk-split-content">
                <h2 className="mk-h2">Sample API Call</h2>
                <div style={{
                  background: "var(--tb-text-pri)",
                  borderRadius: 8,
                  padding: 20,
                  overflow: "auto",
                  marginTop: 24,
                }}>
                  <pre style={{
                    margin: 0,
                    fontFamily: "monospace",
                    fontSize: 13,
                    color: "#00ff00",
                    lineHeight: 1.6,
                  }}>
{`curl -X GET https://api.tamamhealth.org/v1/patients \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json"

// Response:
{
  "status": "success",
  "data": [
    {
      "id": "PAT-001",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1985-03-15",
      "gender": "M",
      "phone": "+19735664336"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SDKs SECTION ──────────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <h2 className="mk-h2" style={{ marginBottom: 24 }}>Official SDKs</h2>
            <p style={{ fontSize: 16, color: "var(--tb-text-sec)", marginBottom: 40, maxWidth: 600, lineHeight: 1.6 }}>
              Use our official SDKs to simplify API integration in your preferred programming language and reduce boilerplate code.
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}>
              {sdks.map((sdk, index) => (
                <Reveal key={index} delay={index * 0.1}>
                  <div className="mk-product-card" style={{
                    background: "var(--tb-white)",
                    border: "1px solid var(--tb-cream-300)",
                  }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      marginBottom: 16,
                    }}>
                      {sdk.icon}
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                      {sdk.language}
                    </h3>
                    <div style={{
                      padding: 12,
                      background: "var(--tb-cream-100)",
                      borderRadius: 4,
                      fontFamily: "monospace",
                      fontSize: 12,
                      marginBottom: 16,
                      color: "var(--tb-text-pri)",
                      wordBreak: "break-word",
                    }}>
                      {sdk.package}
                    </div>
                    <Link href="/about/contact" style={{ color: "var(--tb-green)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                      View docs →
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── GET API ACCESS CTA ────────────────────────────────────────── */}
      <section className="mk-section mk-section-white">
        <div className="mk-container">
          <Reveal>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
              <h2 className="mk-h2" style={{ marginBottom: 16 }}>Ready to build?</h2>
              <p style={{ marginBottom: 32, color: "var(--tb-text-sec)", fontSize: 16, lineHeight: 1.6 }}>
                Get your API credentials and start building integrations today. Our developer team is here to help.
              </p>
              <Link href="/ehr" className="mk-btn mk-btn-green mk-btn-lg">
                Get API access
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
