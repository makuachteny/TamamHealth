'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ChevronRight } from '@/components/icons/lucide';
import { Icon } from '@/components/icons';
import { hospitals } from '@/data/mock';
import { useApp } from '@/lib/context';
import { getDefaultDashboard } from '@/lib/permissions';

const TEAL = '#1B9AAA';
const TEAL_DEEP = '#0E5566';
const TEAL_NIGHT = '#0A3D49';

// Demo-account role → icon name (rendered via the Taban-aware Icon component).
const DEMO_ROLE_ICON: Record<string, string> = {
  'Government': 'globe',
  'Super Admin': 'shield',
  'Org Admin': 'building',
  'Doctor': 'stethoscope',
  'Doctor (2)': 'stethoscope',
  'Doctor (Private)': 'stethoscope',
  'Clinical Officer': 'stethoscope',
  'Nurse': 'heart',
  'Lab Tech': 'flask',
  'Pharmacist': 'pill',
  'Front Desk': 'user',
  'Payam Supervisor': 'mapPin',
  'Boma Health Worker': 'patient',
  'Data Entry Clerk': 'edit',
  'Med. Superintendent': 'shield',
  'Health Records (HRIO)': 'record',
  'CHV (Community)': 'users',
  'Nutritionist': 'apple',
  'Radiologist': 'eye',
};

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, currentUser, dbReady } = useApp();
  const [hospitalId, setHospitalId] = useState('');
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [demoCreds, setDemoCreds] = useState<Record<string, string>>({});
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

  // Pull the freshly-generated demo passwords from the server (one-time per
  // page load). Without this the dropdown would list usernames but never
  // be able to autofill — and we deliberately don't ship the plaintexts in
  // the JS bundle.
  useEffect(() => {
    if (!demoEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/demo-credentials', { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json() as { profiles: { username: string; password: string | null }[] };
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const p of body.profiles) {
          if (p.password) map[p.username] = p.password;
        }
        setDemoCreds(map);
      } catch {
        // Demo creds are a developer convenience; failing silently is fine.
      }
    })();
    return () => { cancelled = true; };
  }, [demoEnabled]);

  const filteredHospitals = hospitals.filter(h =>
    !hospitalSearch || h.name.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    h.state.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    h.type.replace(/_/g, ' ').toLowerCase().includes(hospitalSearch.toLowerCase())
  );

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      router.push(getDefaultDashboard(currentUser.role));
    }
  }, [isAuthenticated, currentUser, router]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center" style={{
            background: TEAL,
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(27,154,170,0.25)',
          }}>
            <svg className="animate-spin w-6 h-6 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password, hospitalId || undefined);
      if (result) {
        router.push(getDefaultDashboard(result));
      } else {
        setError('Invalid credentials. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  // Demo-account roster — passwords are NOT bundled into this file. They get
  // populated from `demoCreds` (fetched from /api/demo-credentials) at runtime.
  const demoAccounts = [
    { role: 'Government', user: 'admin', desc: 'National MoH oversight', color: '#078930', hospital: '' },
    { role: 'Super Admin', user: 'superadmin', desc: 'Platform-wide access', color: '#DC2626', hospital: '' },
    { role: 'Org Admin', user: 'org.admin', desc: 'Mercy Hospital Group', color: '#7C3AED', hospital: '' },
    { role: 'Doctor', user: 'dr.wani', desc: 'Juba Teaching Hospital', color: TEAL, hospital: 'hosp-001' },
    { role: 'Doctor (2)', user: 'dr.achol', desc: 'Juba Teaching Hospital', color: '#1E4D4A', hospital: 'hosp-001' },
    { role: 'Clinical Officer', user: 'co.deng', desc: 'Wau State Hospital', color: '#0891B2', hospital: 'hosp-002' },
    { role: 'Nurse', user: 'nurse.stella', desc: 'Malakal Teaching Hospital', color: '#EC4899', hospital: 'hosp-003' },
    { role: 'Lab Tech', user: 'lab.gatluak', desc: 'Bentiu State Hospital', color: '#8B5CF6', hospital: 'hosp-004' },
    { role: 'Pharmacist', user: 'pharma.rose', desc: 'Juba Teaching Hospital', color: '#E4A84B', hospital: 'hosp-001' },
    { role: 'Front Desk', user: 'desk.amira', desc: 'Juba Teaching Hospital', color: '#6366F1', hospital: 'hosp-001' },
    { role: 'Doctor (Private)', user: 'dr.mercy', desc: 'Mercy Org · Juba Teaching', color: '#4F46E5', hospital: 'hosp-001' },
    { role: 'Payam Supervisor', user: 'sup.mary', desc: 'Kajo-keji PHCC', color: '#D97706', hospital: 'phcc-001' },
    { role: 'Boma Health Worker', user: 'bhw.akol', desc: 'Kajo-keji Boma PHCU', color: '#059669', hospital: 'phcu-001' },
    { role: 'Data Entry Clerk', user: 'data.ayen', desc: 'Juba Teaching Hospital', color: '#0891B2', hospital: 'hosp-001' },
    { role: 'Med. Superintendent', user: 'supt.lado', desc: 'Juba Teaching Hospital', color: '#1E40AF', hospital: 'hosp-001' },
    { role: 'Health Records (HRIO)', user: 'hrio.dut', desc: 'Juba Teaching Hospital', color: '#0F766E', hospital: 'hosp-001' },
    { role: 'CHV (Community)', user: 'chv.ajak', desc: 'Kajo-keji Boma PHCU', color: '#16A34A', hospital: 'phcu-001' },
    { role: 'Nutritionist', user: 'nutr.nyabol', desc: 'Juba Teaching Hospital', color: '#EA580C', hospital: 'hosp-001' },
    { role: 'Radiologist', user: 'rad.tamamhealth', desc: 'Juba Teaching Hospital', color: '#7C3AED', hospital: 'hosp-001' },
  ];

  return (
    <div className="hl-shell">
     <div className="hl-card">
      {/* ───────────────── Left: form column ───────────────── */}
      <section className="hl-form-side">
        <header className="hl-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/tamamhealth-logo.svg"
            alt=""
            aria-hidden
            className="hl-brand-icon"
          />
          <span className="hl-brand-mark">TamamHealth</span>
        </header>
        <div className="hl-form-wrap">
          <div className="hl-form-head">
            <h1>Log in to your account</h1>
            <p>Enter your credentials to continue.</p>
          </div>

          {!dbReady && (
            <div className="hl-db-banner">
              <svg className="animate-spin w-3 h-3 inline mr-1.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Initializing offline database...
            </div>
          )}

          <form onSubmit={handleSubmit} className="hl-form">
            {/* Hospital selector */}
            <div className="hl-field">
              <label htmlFor="login-hospital">Hospital / Facility</label>
              <div className="hl-input-wrap">
                <span className="hl-input-icon">
                  <Icon name="building" size={18} color={TEAL} />
                </span>
                <input
                  id="login-hospital"
                  type="text"
                  value={hospitalSearch}
                  onChange={(e) => { setHospitalSearch(e.target.value); setShowHospitalDropdown(true); setHospitalId(''); }}
                  onFocus={() => setShowHospitalDropdown(true)}
                  placeholder="Search by name, state, or type..."
                  autoComplete="off"
                  className="hl-input"
                />
              </div>
              {hospitalId && (
                <div className="hl-field-ok">
                  <Icon name="building" size={12} color={TEAL_DEEP} /> {hospitals.find(h => h.id === hospitalId)?.name || hospitalId}
                </div>
              )}
              {showHospitalDropdown && hospitalSearch.length > 0 && (
                <div className="hl-dropdown">
                  {filteredHospitals.length === 0 ? (
                    <p className="hl-dropdown-empty">No facilities found</p>
                  ) : (
                    filteredHospitals.slice(0, 8).map(h => {
                      const typeLabel = h.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => { setHospitalId(h.id); setHospitalSearch(h.name); setShowHospitalDropdown(false); }}
                          className="hl-dropdown-item"
                        >
                          <Icon name="building" size={14} color={TEAL} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="hl-dropdown-name">{h.name}</div>
                            <div className="hl-dropdown-meta">{typeLabel} — {h.state}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="hl-field">
              <label htmlFor="login-username">Username or Staff ID</label>
              <div className="hl-input-wrap">
                <span className="hl-input-icon">
                  <Icon name="patient" size={18} color={TEAL} />
                </span>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. dr.wani"
                  autoComplete="username"
                  className="hl-input"
                />
              </div>
            </div>

            <div className="hl-field">
              <label htmlFor="login-password">Password</label>
              <div className="hl-input-wrap">
                <span className="hl-input-icon">
                  <Icon name="shield" size={18} color={TEAL} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="hl-input hl-input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="hl-input-eye"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="hl-error">{error}</div>
            )}

            <div className="hl-row">
              <label className="hl-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember for 30 days</span>
              </label>
              <a href="#" className="hl-forgot" onClick={(e) => e.preventDefault()}>Forgot password</a>
            </div>

            <button
              type="submit"
              disabled={loading || !dbReady}
              className="hl-submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Signing in…
                </span>
              ) : (
                <span>Log in</span>
              )}
            </button>

            <div className="hl-divider"><span>OR</span></div>

            <a href="/patient-portal" className="hl-secondary">
              <Icon name="patient" size={18} color={TEAL_DEEP} />
              Sign in as a patient
            </a>
          </form>

          {/* Demo accounts — kept available, collapsible */}
          {demoEnabled && (
            <div className="hl-demo">
              <button
                type="button"
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                className="hl-demo-toggle"
              >
                <span>Demo Accounts</span>
                <ChevronRight
                  className="w-3.5 h-3.5"
                  style={{ transform: showDemoAccounts ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                />
              </button>
              {showDemoAccounts && (
                <div className="hl-demo-list">
                  {demoAccounts.map((acc, i) => {
                    const pw = demoCreds[acc.user];
                    return (
                      <button
                        key={acc.user}
                        type="button"
                        disabled={!pw}
                        onClick={() => {
                          if (!pw) return;
                          setUsername(acc.user);
                          setPassword(pw);
                          setHospitalId(acc.hospital || 'hosp-001');
                        }}
                        className="hl-demo-item"
                        style={{ borderBottom: i < demoAccounts.length - 1 ? '1px solid var(--border-medium)' : 'none', opacity: pw ? 1 : 0.5 }}
                      >
                        <span className="hl-demo-icon" style={{ color: acc.color }}>
                          <Icon name={(DEMO_ROLE_ICON[acc.role] || 'user') as Parameters<typeof Icon>[0]['name']} size={16} color={acc.color} />
                        </span>
                        <div className="hl-demo-meta">
                          <div className="hl-demo-meta-row">
                            <span className="hl-demo-role">{acc.role}</span>
                            <span className="hl-demo-desc">{acc.desc}</span>
                          </div>
                          <p className="hl-demo-creds">{acc.user} &middot; {pw ? pw : 'loading…'}</p>
                        </div>
                        <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <p className="hl-terms">
            By signing in you agree to the
            {' '}
            <a href="#" onClick={(e) => e.preventDefault()}>Terms of Use</a>
            {' '}and{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
          </p>
        </div>
      </section>

      {/* ───────────────── Right: marketing panel ───────────────── */}
      <aside className="hl-promo-side" aria-hidden>
        <div className="hl-promo-shape hl-promo-shape-1" />
        <div className="hl-promo-shape hl-promo-shape-2" />

        <div className="hl-promo-copy">
          <h2 className="hl-promo-title">Care that reaches every facility.</h2>
          <p className="hl-promo-sub">
            A patient record system built for hospitals, PHCCs, and community
            health teams across {process.env.NEXT_PUBLIC_ORG_COUNTRY || 'South Sudan'} — offline by default, sync when
            signal returns.
          </p>
        </div>

        <div className="hl-promo-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/doctor-nurse-consultation.jpg" alt="" aria-hidden />
        </div>

        <p className="hl-promo-foot">
          {process.env.NEXT_PUBLIC_LOGIN_FOOTER || `Republic of ${process.env.NEXT_PUBLIC_ORG_COUNTRY || 'South Sudan'} · Ministry of Health · v2.0`}
        </p>
      </aside>
     </div>

      <style jsx>{`
        /* ── shell: dark teal mat with the rounded card centered ─────── */
        .hl-shell {
          height: 100vh;
          padding: clamp(12px, 1.6vw, 28px);
          background:
            radial-gradient(circle at 0% 100%, rgba(74, 192, 206, 0.10), transparent 50%),
            linear-gradient(160deg, ${TEAL_DEEP} 0%, ${TEAL_NIGHT} 100%);
          display: flex;
          overflow: hidden;
        }

        /* ── card: rounded inner that holds form + promo split ─────────
           Fixed to fill the shell so demo-accounts toggling never grows
           the page. Each side scrolls internally if needed. */
        .hl-card {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr;
          background: var(--bg-card-solid);
          border-radius: clamp(16px, 1.4vw, 24px);
          overflow: hidden;
          box-shadow:
            0 30px 60px rgba(4, 24, 30, 0.30),
            0 12px 24px rgba(4, 24, 30, 0.18);
          min-height: 0;
          height: 100%;
        }
        @media (min-width: 1024px) {
          .hl-card { grid-template-columns: minmax(420px, 1fr) 1.05fr; }
        }

        /* ── left: form column ───────────────────────────────────────── */
        .hl-form-side {
          background: var(--bg-card-solid);
          padding: clamp(28px, 3.5vw, 56px) clamp(24px, 4vw, 64px);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          min-height: 0;
        }

        .hl-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .hl-brand-icon { width: 32px; height: 32px; flex-shrink: 0; }
        .hl-brand-mark {
          font-family: 'DM Sans', 'Inter', sans-serif;
          font-weight: 800;
          font-size: clamp(20px, 1.6vw, 24px);
          letter-spacing: -0.015em;
          color: var(--text-primary);
          line-height: 1;
        }

        .hl-form-wrap {
          flex: 1;
          margin: 0 auto;
          width: 100%;
          max-width: 420px;
          padding-top: clamp(36px, 5vh, 72px);
          display: flex;
          flex-direction: column;
        }

        .hl-form-head { margin-bottom: 28px; }
        .hl-form-head h1 {
          font-size: clamp(26px, 3vw, 32px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin: 0 0 8px;
        }
        .hl-form-head p {
          font-size: 14.5px;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
        }

        .hl-db-banner {
          margin-bottom: 14px;
          padding: 8px 12px;
          font-size: 11px;
          color: ${TEAL_DEEP};
          background: var(--accent-light);
          border: 1px solid var(--accent-border);
          border-radius: 6px;
          text-align: center;
        }

        /* ── form fields ─────────────────────────────────────────────── */
        .hl-form { display: flex; flex-direction: column; gap: 16px; }
        .hl-field { position: relative; display: flex; flex-direction: column; gap: 6px; }
        .hl-field label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: 0;
          text-transform: none;
          margin: 0;
          font-family: 'Inter', 'DM Sans', sans-serif;
        }
        .hl-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .hl-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .hl-input {
          width: 100%;
          padding: 11px 14px 11px 42px;
          font-size: 14.5px;
          font-family: inherit;
          color: var(--text-primary);
          background: var(--bg-card-solid);
          border: 1px solid var(--border-medium);
          border-radius: 8px;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .hl-input::placeholder { color: var(--text-muted); }
        .hl-input:hover { border-color: ${TEAL}; }
        .hl-input:focus {
          border-color: ${TEAL};
          box-shadow: 0 0 0 4px var(--accent-glow);
        }
        .hl-input-password { padding-right: 44px; }
        .hl-input-eye {
          position: absolute;
          right: 4px;
          padding: 8px;
          color: var(--text-muted);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .hl-input-eye:hover { color: ${TEAL_DEEP}; background: var(--overlay-subtle); }

        .hl-field-ok {
          margin-top: 4px;
          font-size: 11px;
          color: var(--color-success);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .hl-dropdown {
          position: absolute;
          left: 0;
          right: 0;
          top: 100%;
          margin-top: 4px;
          background: var(--bg-card-solid);
          border: 1px solid var(--border-medium);
          border-radius: 8px;
          box-shadow: var(--card-shadow-lg);
          z-index: 20;
          max-height: 220px;
          overflow-y: auto;
        }
        .hl-dropdown-empty {
          padding: 10px 14px;
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
        }
        .hl-dropdown-item {
          width: 100%;
          padding: 9px 14px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hl-dropdown-item:hover { background: var(--overlay-subtle); }
        .hl-dropdown-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .hl-dropdown-meta { font-size: 10px; color: var(--text-muted); }

        .hl-error {
          padding: 10px 12px;
          font-size: 13px;
          background: var(--color-danger-bg);
          color: var(--color-danger-text);
          border: 1px solid rgba(196, 69, 54, 0.20);
          border-radius: 6px;
        }

        /* ── remember + forgot row ───────────────────────────────────── */
        .hl-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .hl-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: 0;
          text-transform: none;
          margin: 0;
          cursor: pointer;
          user-select: none;
        }
        .hl-check input {
          width: 15px;
          height: 15px;
          accent-color: ${TEAL};
          margin: 0;
        }
        .hl-forgot {
          font-size: 13px;
          font-weight: 600;
          color: ${TEAL_DEEP};
          text-decoration: none;
        }
        .hl-forgot:hover { text-decoration: underline; }

        /* ── primary submit ──────────────────────────────────────────── */
        .hl-submit {
          width: 100%;
          padding: 12px 24px;
          font-size: 14.5px;
          font-weight: 600;
          font-family: inherit;
          color: #fff;
          background: ${TEAL};
          border: 1px solid ${TEAL};
          border-radius: 8px;
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 1px 2px rgba(14, 85, 102, 0.10);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hl-submit:hover:not(:disabled) {
          background: ${TEAL_DEEP};
          border-color: ${TEAL_DEEP};
          box-shadow: 0 4px 14px rgba(14, 85, 102, 0.20);
        }
        .hl-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        /* ── divider ─────────────────────────────────────────────────── */
        .hl-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 4px 0 0;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
        }
        .hl-divider::before,
        .hl-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border-light);
        }

        /* ── secondary auth ──────────────────────────────────────────── */
        .hl-secondary {
          width: 100%;
          padding: 11px 24px;
          font-size: 14.5px;
          font-weight: 600;
          font-family: inherit;
          color: var(--text-primary);
          background: var(--bg-card-solid);
          border: 1px solid var(--border-medium);
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.18s, border-color 0.18s;
        }
        .hl-secondary:hover {
          background: var(--overlay-subtle);
          border-color: var(--card-hover-border);
          color: var(--text-primary);
        }

        /* ── demo accounts ───────────────────────────────────────────── */
        .hl-demo { margin-top: 22px; }
        .hl-demo-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 14px;
          background: transparent;
          border: 1px dashed var(--border-medium);
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .hl-demo-list {
          margin-top: 6px;
          background: var(--bg-card-solid);
          border: 1px solid var(--border-medium);
          border-radius: 8px;
          box-shadow: var(--card-shadow);
          overflow: hidden;
          max-height: 280px;
          overflow-y: auto;
        }
        .hl-demo-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .hl-demo-item:hover { background: var(--overlay-subtle); }
        .hl-demo-icon {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: var(--overlay-subtle);
        }
        .hl-demo-meta { flex: 1; min-width: 0; }
        .hl-demo-meta-row { display: flex; align-items: center; gap: 8px; }
        .hl-demo-role { font-size: 12px; font-weight: 700; color: var(--text-primary); }
        .hl-demo-desc { font-size: 10px; color: var(--text-muted); }
        .hl-demo-creds {
          font-size: 10px;
          color: var(--text-muted);
          font-family: ui-monospace, monospace;
          margin: 2px 0 0;
        }

        /* ── terms footer ────────────────────────────────────────────── */
        .hl-terms {
          margin: auto 0 0;
          padding-top: 32px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .hl-terms a {
          color: var(--text-secondary);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .hl-terms a:hover { color: ${TEAL_DEEP}; }

        /* ───────────── right: marketing panel ───────────── */
        .hl-promo-side {
          display: none;
          position: relative;
          overflow: hidden;
          padding: 32px clamp(28px, 4vw, 56px);
          background:
            radial-gradient(circle at 20% 0%, rgba(255,255,255,0.10), transparent 50%),
            linear-gradient(160deg, ${TEAL_DEEP} 0%, ${TEAL_NIGHT} 100%);
          color: #fff;
          flex-direction: column;
        }
        @media (min-width: 1024px) {
          .hl-promo-side { display: flex; }
        }
        .hl-promo-shape {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(circle, rgba(255,255,255,0.10), transparent 70%);
          z-index: 0;
        }
        .hl-promo-shape-1 { width: 520px; height: 520px; right: -160px; top: -200px; }
        .hl-promo-shape-2 { width: 380px; height: 380px; left: -140px; bottom: -120px; background: radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%); }

        .hl-promo-copy {
          position: relative;
          z-index: 1;
          max-width: 460px;
        }
        .hl-promo-title {
          font-family: 'DM Sans', 'Inter', sans-serif;
          font-size: clamp(32px, 3.6vw, 46px);
          font-weight: 800;
          letter-spacing: -0.025em;
          line-height: 1.1;
          margin: 0 0 16px;
          color: #fff;
        }
        .hl-promo-sub {
          font-size: 15px;
          line-height: 1.6;
          color: rgba(255,255,255,0.78);
          margin: 0;
          max-width: 440px;
        }

        /* ── hero image ──────────────────────────────────────────────── */
        .hl-promo-image {
          position: relative;
          z-index: 1;
          flex: 1;
          margin: clamp(24px, 4vw, 40px) 0;
          border-radius: 18px;
          overflow: hidden;
          box-shadow:
            0 24px 48px rgba(4, 24, 30, 0.42),
            0 8px 16px rgba(4, 24, 30, 0.28),
            inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        .hl-promo-image img {
          width: 100%;
          height: 100%;
          min-height: 300px;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        .hl-promo-foot {
          position: relative;
          z-index: 1;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.04em;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
