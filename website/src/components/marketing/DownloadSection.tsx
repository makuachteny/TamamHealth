"use client";

import Link from "next/link";
import { Reveal, CheckItem, FAQItem } from "@/components/marketing/MarketingShared";
import { ShieldCheck } from "@/components/marketing/icons";

/* ═══════════════════════════════════════════════════════════════════
   Download & Set Up — how facilities get and install TamamHealth.
   The platform is an offline-first PWA: install it from the browser on
   any device, get the Android app, or self-host a national server.
   ─────────────────────────────────────────────────────────────────
   EDIT THESE before launch:
   - APP_URL: the live platform URL facilities open (e.g. https://app.tamamhealth.org)
   - ANDROID_APK_URL: the APK download (e.g. GitHub release asset)
   ═══════════════════════════════════════════════════════════════════ */
const APP_URL = "https://app.tamamhealth.org";
const ANDROID_APK_URL = "https://github.com/tamamhealth/tamamhealth/releases/latest";

export function DownloadSection() {
  return (
    <div id="download">
      {/* The console hero that used to open this section now leads the whole
          one-pager (see HomeHero); this section starts at the install guide. */}
      {/* ── THREE WAYS TO INSTALL ────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading">
              <p className="mk-label">CHOOSE YOUR DEVICE</p>
              <h2 className="mk-h2">Three ways to install</h2>
            </div>
          </Reveal>

          <div className="mk-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {/* Web app / PWA */}
            <Reveal>
              <div className="mk-card" style={{ background: "#FEFFF9", borderRadius: 16, padding: 28, border: "1px solid var(--tb-cream-300)", height: "100%" }}>
                <p className="mk-label">RECOMMENDED</p>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Web app (phone, tablet, desktop)</h3>
                <p style={{ marginBottom: 16 }}>Open the app in any modern browser, then add it to your home screen — it installs like a normal app and runs offline.</p>
                <ol style={{ paddingLeft: 18, lineHeight: 1.9, fontSize: 15 }}>
                  <li>Open <strong>{APP_URL.replace("https://", "")}</strong> in Chrome, Edge or Safari.</li>
                  <li>Tap the browser menu → <strong>Install app</strong> (Android/desktop) or <strong>Add to Home Screen</strong> (iPhone/iPad).</li>
                  <li>Launch it from your home screen — it now works without internet.</li>
                </ol>
              </div>
            </Reveal>

            {/* Android APK */}
            <Reveal delay={0.05}>
              <div className="mk-card" style={{ background: "#FEFFF9", borderRadius: 16, padding: 28, border: "1px solid var(--tb-cream-300)", height: "100%" }}>
                <p className="mk-label">ANDROID</p>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Android app (.apk)</h3>
                <p style={{ marginBottom: 16 }}>For phones without Play Store access. Download the signed APK and install it directly.</p>
                <ol style={{ paddingLeft: 18, lineHeight: 1.9, fontSize: 15 }}>
                  <li>Tap <strong>Download for Android</strong> below.</li>
                  <li>Open the downloaded file; allow &ldquo;Install from this source&rdquo; if prompted.</li>
                  <li>Open TamamHealth and sign in.</li>
                </ol>
                <a href={ANDROID_APK_URL} className="mk-btn mk-btn-green mk-btn-sm" target="_blank" rel="noopener noreferrer" style={{ marginTop: 16 }}>
                  Download for Android
                </a>
              </div>
            </Reveal>

            {/* Self-host */}
            <Reveal delay={0.1}>
              <div className="mk-card" style={{ background: "#FEFFF9", borderRadius: 16, padding: 28, border: "1px solid var(--tb-cream-300)", height: "100%" }}>
                <p className="mk-label">MINISTRIES &amp; IT TEAMS</p>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Run your own server</h3>
                <p style={{ marginBottom: 16 }}>Host the national server in-country so all patient data stays within your borders. One command on an Ubuntu server.</p>
                <ol style={{ paddingLeft: 18, lineHeight: 1.9, fontSize: 15 }}>
                  <li>Provision an in-country Ubuntu 22.04 server.</li>
                  <li>Set your domain + secrets, run the deploy script (Docker + auto-TLS).</li>
                  <li>Facilities point their app at your server and sync to it.</li>
                </ol>
                <Link href="/?intent=partnership#contact-form" className="mk-btn mk-btn-outline mk-btn-sm" style={{ marginTop: 16 }}>
                  Get the deployment guide
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── SETTING IT UP AT A FACILITY ──────────────────────── */}
      <section className="mk-section">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading">
              <p className="mk-label">FIRST-TIME SETUP</p>
              <h2 className="mk-h2">Setting it up at your facility</h2>
              <p>Five steps to go from nothing to charting patients — most facilities are live the same day.</p>
            </div>
          </Reveal>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <Reveal>
              <ul className="mk-check-list" style={{ display: "grid", gap: 14 }}>
                <CheckItem><strong>1. Get access.</strong> Your facility administrator (or the Ministry) creates your account and gives you a username and a temporary password.</CheckItem>
                <CheckItem><strong>2. Install the app.</strong> Use any method above — web install is fastest and works on the devices you already have.</CheckItem>
                <CheckItem><strong>3. Sign in &amp; set your password.</strong> First login asks you to choose a new password. Set a screen-lock PIN when prompted.</CheckItem>
                <CheckItem><strong>4. Pick your role view.</strong> The app shows the right workspace for your role — reception, nurse, clinical officer, doctor, lab, pharmacy, records.</CheckItem>
                <CheckItem><strong>5. Work offline.</strong> Register and chart patients with or without internet. The app syncs to the server automatically whenever you reconnect.</CheckItem>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── REQUIREMENTS ─────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container">
          <Reveal>
            <div className="mk-section-heading">
              <p className="mk-label">REQUIREMENTS</p>
              <h2 className="mk-h2">What you need</h2>
            </div>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, maxWidth: 900, margin: "0 auto" }}>
            <Reveal><div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}><ShieldCheck size={18} strokeWidth={1.8} /> Any device</h3><p style={{ fontSize: 15 }}>Android 8+, iPhone/iPad, or any Windows/Mac/Linux computer with a modern browser (Chrome, Edge, Safari, Firefox).</p></div></Reveal>
            <Reveal delay={0.05}><div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}><ShieldCheck size={18} strokeWidth={1.8} /> No constant internet</h3><p style={{ fontSize: 15 }}>Works fully offline after install. You only need a connection occasionally to sync — even a brief mobile-data window is enough.</p></div></Reveal>
            <Reveal delay={0.1}><div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}><ShieldCheck size={18} strokeWidth={1.8} /> An account</h3><p style={{ fontSize: 15 }}>Provided by your facility admin or Ministry. Don&apos;t have one yet? Request a demo and we&apos;ll get you set up.</p></div></Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="mk-section">
        <div className="mk-container" style={{ maxWidth: 760 }}>
          <Reveal>
            <div className="mk-section-heading">
              <p className="mk-label">QUESTIONS</p>
              <h2 className="mk-h2">Download &amp; setup FAQ</h2>
            </div>
          </Reveal>
          <Reveal>
            <FAQItem question="Does it really work without internet?" answer="Yes. After you install it, the app stores everything securely on the device and runs entirely offline. When a connection is available it syncs in the background — you never have to wait for the network to see or save a patient." />
            <FAQItem question="Where is patient data stored?" answer="On your device while you work, and on your organisation's server when it syncs. For South Sudan the national server is hosted in-country, so patient data stays within the country. Everything is encrypted in transit and access is role-based and audit-logged." />
            <FAQItem question="Do I need to pay or download from an app store?" answer="No app store is needed — you install the web app directly, or sideload the Android APK. Talk to us about licensing for your facility or ministry." />
            <FAQItem question="How do I get a login?" answer="Your facility administrator or the Ministry creates accounts. If your organisation isn't using TamamHealth yet, request a demo and we'll help you get started." />
            <FAQItem question="Can our Ministry host its own server?" answer="Yes — that's the recommended setup for a national rollout. The whole stack runs from one command on an in-country Ubuntu server with automatic TLS and encrypted backups. Contact us for the deployment guide." />
          </Reveal>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="mk-section mk-section-cream">
        <div className="mk-container" style={{ textAlign: "center" }}>
          <Reveal>
            <h2 className="mk-h2">Ready to start?</h2>
            <p style={{ maxWidth: 560, margin: "0 auto 24px" }}>Open the app now, or talk to us about rolling it out across your facility or ministry.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={APP_URL} className="mk-btn mk-btn-green mk-btn-lg" target="_blank" rel="noopener noreferrer">Open the web app</a>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
