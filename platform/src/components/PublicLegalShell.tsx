import Link from 'next/link';
import type { ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   PublicLegalShell — shared chrome for public legal pages (/privacy, /terms)
   Applies the platform design system (globals.css tokens): cream app canvas,
   white 14px-radius card with slate-100 border and the standard card shadow,
   DM Sans type scale, brand-blue links, dark footer matching the landing page.
   Server component — no client JS needed.
   ═══════════════════════════════════════════════════════════════════ */

export default function PublicLegalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="lg-shell">
      {/* ── Header ── */}
      <header className="lg-header">
        <div className="lg-container lg-header__inner">
          <Link href="/product" className="lg-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logos/SVG/Tamam_Style_Guide-21.svg" alt="TamamHealth" style={{ height: 26, width: 'auto' }} />
          </Link>
          <nav className="lg-header__nav">
            <Link href="/product" className="lg-header__link">Home</Link>
            <Link href="/login" className="lg-btn-secondary">Staff Sign In</Link>
          </nav>
        </div>
      </header>

      {/* ── Content card ── */}
      <main className="lg-main">
        <div className="lg-container">
          <article className="lg-card">
            <span className="lg-eyebrow">TamamHealth — Digital Health Records Platform</span>
            <h1 className="lg-title">{title}</h1>
            <p className="lg-subtitle">{subtitle}</p>
            <div className="lg-body">{children}</div>
          </article>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="lg-footer">
        <div className="lg-container lg-footer__inner">
          <p>© {new Date().getFullYear()} TamamHealth. All rights reserved.</p>
          <nav className="lg-footer__nav">
            <Link href="/product">Home</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:support.tamam@gmail.com">Contact</a>
          </nav>
        </div>
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
.lg-shell {
  min-height: 100vh;
  display: flex; flex-direction: column;
  background: var(--bg-app, #FEFFF9);
  font-family: var(--font-platform, var(--font-dm-sans), 'DM Sans', system-ui, sans-serif);
  color: var(--text-primary, #0F172A);
}
.lg-container { max-width: 860px; margin: 0 auto; padding: 0 24px; width: 100%; }

/* Header */
.lg-header {
  background: var(--bg-card-solid, #fff);
  border-bottom: 1px solid var(--border-light, #E4EBF1);
  padding: 14px 0;
}
.lg-header__inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.lg-logo { display: inline-flex; align-items: center; }
.lg-header__nav { display: flex; align-items: center; gap: 14px; }
.lg-header__link {
  font-size: 14px; font-weight: 500; color: var(--text-secondary, #334155);
  text-decoration: none; padding: 6px 10px; border-radius: 8px;
  transition: color 0.18s ease, background-color 0.18s ease;
}
.lg-header__link:hover { color: var(--accent-hover, #015697); background: var(--overlay-subtle, rgba(33,145,208,0.07)); }
.lg-btn-secondary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 18px; border-radius: var(--btn-radius, 10px);
  font-size: 0.82rem; font-weight: 600; letter-spacing: -0.01em;
  color: var(--text-secondary, #334155); text-decoration: none;
  background: var(--bg-card-solid, #fff);
  border: 1px solid var(--border-medium, #DDE6EE);
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}
.lg-btn-secondary:hover {
  background: var(--overlay-subtle, rgba(33,145,208,0.07));
  border-color: var(--color-brand-500, #2191D0);
  color: var(--text-primary, #0F172A);
}

/* Content card */
.lg-main { flex: 1; padding: 48px 0 72px; }
.lg-card {
  background: var(--bg-card-solid, #fff);
  border: 1px solid var(--border-light, #E4EBF1);
  border-radius: var(--card-radius, 14px);
  box-shadow: var(--card-shadow, 0 1px 2px rgba(16, 42, 67, 0.05));
  padding: clamp(28px, 5vw, 56px);
}
.lg-eyebrow {
  display: inline-block;
  font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--accent-text, #015697);
  background: var(--color-info-bg, rgba(33,145,208,0.12));
  padding: 5px 12px; border-radius: 100px; margin-bottom: 18px;
}
.lg-title {
  font-size: 1.875rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15;
  color: var(--text-primary, #0F172A); margin: 0;
}
.lg-subtitle { font-size: 13.5px; color: var(--text-muted, #64748B); margin: 8px 0 0; }
.lg-body { margin-top: 28px; font-size: 15px; line-height: 1.7; color: var(--text-secondary, #334155); }
.lg-body h2 {
  font-size: 1.1875rem; font-weight: 700; letter-spacing: -0.01em; line-height: 1.25;
  color: var(--text-primary, #0F172A);
  margin: 28px 0 8px; padding-top: 20px;
  border-top: 1px solid var(--border-light, #E4EBF1);
}
.lg-body h2:first-of-type { border-top: none; padding-top: 0; margin-top: 24px; }
.lg-body p { margin: 0 0 12px; }
.lg-body a { color: var(--link-color, #015697); font-weight: 600; text-decoration: none; }
.lg-body a:hover { text-decoration: underline; }
.lg-note {
  margin-top: 28px; padding: 14px 18px;
  font-size: 12.5px; line-height: 1.6; color: var(--text-muted, #64748B);
  background: var(--overlay-subtle, rgba(33,145,208,0.07));
  border: 1px solid var(--border-light, #E4EBF1);
  border-radius: var(--btn-radius, 10px);
}

/* Footer */
.lg-footer {
  background: #071e30; color: rgba(255,255,255,0.6);
  padding: 22px 0; font-size: 13px;
}
.lg-footer__inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.lg-footer__nav { display: flex; gap: 18px; }
.lg-footer__nav a { color: rgba(255,255,255,0.8); text-decoration: none; }
.lg-footer__nav a:hover { color: #fff; }
@media (max-width: 560px) {
  .lg-footer__inner { flex-direction: column; text-align: center; }
}
`,
        }}
      />
    </div>
  );
}
