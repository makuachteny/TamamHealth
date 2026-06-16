'use client';

// Last-resort crash screen: rendered by Next.js when the ROOT layout itself
// throws, which means none of the app's providers, CSS, or i18n are available.
// Everything here MUST therefore be self-contained — inline literal styles only,
// no context hooks, no CSS variables (globals.css isn't loaded at this level),
// no translation chunks (they may be the very thing that failed to load).
// If this screen depended on any of those, a hard crash would fall through to
// raw, unstyled browser HTML instead of a usable error page.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0f1117', color: '#f1f5f9', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(229,46,66,0.12)', border: '1px solid rgba(229,46,66,0.25)' }}>
              <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>⚠️</span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.5 }}>
              The app ran into an unexpected problem. Reloading usually fixes it. If it keeps happening, contact your administrator.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => { try { reset(); } catch { window.location.reload(); } }}
                style={{ background: '#2563EB', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ background: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.18)', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
