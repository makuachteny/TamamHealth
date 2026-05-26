'use client';

/**
 * Staff-login layout — minimal shell so the login page renders edge-to-edge
 * without a top nav. Branding lives in the page body itself (the orbit and
 * the title block on the form panel).
 */
export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <main style={{ width: '100%' }}>{children}</main>
    </div>
  );
}
