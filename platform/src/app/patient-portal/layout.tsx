'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, LogOut, ChevronDown, Building2 } from '@/components/icons/lucide';

const PATIENT_PORTAL_SESSION_KEY = 'tamamhealth-patient-portal-session';

type HeaderIdentity = { name: string; initials: string; sub: string };

function readIdentity(): HeaderIdentity | null {
  try {
    const raw = sessionStorage.getItem(PATIENT_PORTAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { patient?: { firstName?: string; surname?: string; hospitalNumber?: string } };
    const p = parsed.patient;
    if (!p) return null;
    const name = [p.firstName, p.surname].filter(Boolean).join(' ').trim() || 'Patient';
    const initials = [p.firstName, p.surname]
      .filter(Boolean)
      .map(s => s!.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || 'P';
    return { name, initials, sub: p.hospitalNumber || '' };
  } catch {
    return null;
  }
}

export default function PatientPortalLayout({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [identity, setIdentity] = useState<HeaderIdentity | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const check = () => setIdentity(readIdentity());
    // Initial read on mount.
    check();
    // `storage` covers sibling-tab changes; the custom event (dispatched by the
    // page's session write/clear helpers) covers same-tab sign-in/out so the
    // header chip appears/disappears without a reload.
    window.addEventListener('storage', check);
    window.addEventListener('patient-portal-session-change', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('patient-portal-session-change', check);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    sessionStorage.removeItem(PATIENT_PORTAL_SESSION_KEY);
    setIdentity(null);
    setMenuOpen(false);
    router.push('/patient-portal');
    router.refresh();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top rail — mirrors the staff EHR shell: deep-navy bar with the white
          full logo lockup and a right-aligned user chip, so a patient sees the
          same header treatment as every other user. Hidden while signed out —
          the sign-in screen is a full-viewport card exactly like /login, which
          has no chrome above it either. */}
      {identity && (
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--tb-blue-900)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        padding: '0 16px', height: 60, display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, width: '100%' }}>
          <Link href="/patient-portal" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamamhealth-logo-full-white.svg" alt="Tamam Healthcare System" style={{ height: 26, width: 'auto' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.16)' }}>Patient</span>
          </Link>

          <div style={{ flex: 1 }} />

          {identity && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={identity.name}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 9, padding: '5px 10px 5px 6px',
                  background: menuOpen ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.20)', borderRadius: 999, cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 30, height: 30, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 12, fontWeight: 800,
                }}>{identity.initials}</span>
                <span className="hidden sm:inline" style={{ fontSize: 13, fontWeight: 600, color: '#fff', maxWidth: 160, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{identity.name}</span>
                <ChevronDown size={14} color="#fff" style={{ opacity: 0.85 }} />
              </button>

              {menuOpen && (
                <div role="menu" style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 220,
                  background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)',
                  borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--card-shadow-lg, 0 16px 48px rgba(0,0,0,0.18))',
                  zIndex: 60,
                }}>
                  <div style={{ padding: '13px 15px', borderBottom: '1px solid var(--border-light)' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{identity.name}</p>
                    {identity.sub && (
                      <p style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <Building2 size={12} /> {identity.sub}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                      padding: '11px 15px', border: 'none', cursor: 'pointer', background: 'transparent',
                      fontSize: 13, fontWeight: 600, color: 'var(--color-danger)', textAlign: 'left',
                    }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="sm:hidden" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation menu" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#fff' }}>
            {mobileNav ? <X size={34} /> : <Menu size={34} />}
          </button>
        </div>
      </header>
      )}

      {/* Mobile nav */}
      {identity && mobileNav && (
        <div className="sm:hidden" style={{ background: 'var(--bg-card-solid)', borderBottom: '1px solid var(--border-medium)', padding: '8px 20px 16px' }}>
          {['Home', 'Appointments', 'Records', 'Lab Results'].map(item => (
            <Link key={item} href={`/patient-portal${item === 'Home' ? '' : '#' + item.toLowerCase().replace(' ', '-')}`}
              onClick={() => setMobileNav(false)}
              style={{ display: 'block', padding: '12px 0', fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none', borderBottom: '1px solid var(--border-light)' }}>
              {item}
            </Link>
          ))}
        </div>
      )}

      <main style={{ width: '100%' }}>
        {children}
      </main>
    </div>
  );
}
