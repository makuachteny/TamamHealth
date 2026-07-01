'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, User, Moon, Sun, LogOut } from '@/components/icons/lucide';
import { useApp } from '@/lib/context';

const PATIENT_PORTAL_SESSION_KEY = 'tamamhealth-patient-portal-session';

export default function PatientPortalLayout({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const { theme, toggleTheme } = useApp();

  useEffect(() => {
    const check = () => setIsLoggedIn(!!sessionStorage.getItem(PATIENT_PORTAL_SESSION_KEY));
    // Initial read from localStorage on mount.
    check();
    // The browser fires `storage` events when ANOTHER tab mutates localStorage,
    // so a sibling-tab logout will flip this tab's UI without polling. Same-tab
    // changes are already handled by the explicit `setIsLoggedIn` calls in this
    // component (e.g. handleLogout below) — no 1Hz interval needed.
    window.addEventListener('storage', check);
    return () => { window.removeEventListener('storage', check); };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem(PATIENT_PORTAL_SESSION_KEY);
    setIsLoggedIn(false);
    router.push('/patient-portal');
    router.refresh();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Compact top bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg-card-solid)',
        borderBottom: '1px solid var(--border-medium)',
        padding: '0 20px', height: 52, display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, width: '100%' }}>
          <Link href="/patient-portal" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamamhealth-logo.svg" alt="TamamHealth" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>TamamHealth</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-primary)', padding: '3px 8px', borderRadius: 6, background: 'var(--accent-light)' }}>Patient</span>
          </Link>

          <div style={{ flex: 1 }} />

          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', borderRadius: 6, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36 }}
          >
            {theme === 'light' ? <Moon size={16} style={{ color: 'var(--text-secondary)' }} /> : <Sun size={16} style={{ color: 'var(--text-secondary)' }} />}
          </button>

          {isLoggedIn ? (
            <button onClick={handleLogout} aria-label="Sign out" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              fontSize: 13, fontWeight: 600, background: 'var(--bg-card-solid)',
              border: '1px solid var(--border-medium)', borderRadius: 6, cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}>
              <LogOut size={14} /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          ) : (
            <button onClick={() => router.push('/login')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              fontSize: 13, fontWeight: 600, background: 'var(--bg-card-solid)',
              border: '1px solid var(--border-medium)', borderRadius: 6, cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}>
              <User size={14} /> <span className="hidden sm:inline">Staff Login</span>
            </button>
          )}

          <button className="sm:hidden" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation menu" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-secondary)' }}>
            {mobileNav ? <X size={34} /> : <Menu size={34} />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileNav && (
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
