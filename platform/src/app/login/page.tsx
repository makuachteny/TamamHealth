'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ChevronRight } from '@/components/icons/lucide';
import { Icon } from '@/components/icons';
import { hospitals } from '@/data/mock';
import { useApp } from '@/lib/context';
import { getDefaultDashboard } from '@/lib/permissions';
import type { UserRole } from '@/lib/db-types';

// Tamam brand accent — Tailwind blue scale.
const ACCENT = '#3b82f6';
const ACCENT_DEEP = '#1e3a8a';

type IconName = Parameters<typeof Icon>[0]['name'];

/**
 * Per-role personality for the adaptive login. Every role shares the same accent
 * theme; uniqueness comes from the mark + the welcome copy. Keyed by UserRole.
 */
const ROLE_PROFILE: Record<UserRole, { icon: string; greet: string; tagline: string }> = {
  super_admin:                { icon: 'shield',      greet: 'Platform Administration',   tagline: 'Full oversight across every organization and facility.' },
  org_admin:                  { icon: 'building',    greet: 'Organization Console',      tagline: 'Manage your hospital group, staff, and branding.' },
  doctor:                     { icon: 'stethoscope', greet: 'Welcome back, Doctor',      tagline: 'Your patients and consultations are ready.' },
  clinical_officer:           { icon: 'stethoscope', greet: 'Welcome, Clinical Officer', tagline: 'Diagnose, treat, and refer with confidence.' },
  nurse:                      { icon: 'heart',       greet: 'Welcome, Nurse',            tagline: 'Ward rounds, vitals, and patient care in one place.' },
  midwife:                    { icon: 'heart',       greet: 'Welcome, Midwife',          tagline: 'Antenatal, delivery, and newborn care — together.' },
  lab_tech:                   { icon: 'flask',       greet: 'Laboratory',                tagline: 'Process orders and publish results.' },
  pharmacist:                 { icon: 'pill',        greet: 'Pharmacy',                  tagline: 'Dispense safely and keep stock in check.' },
  front_desk:                 { icon: 'user',        greet: 'Reception',                 tagline: 'Register patients and manage appointments.' },
  cashier:                    { icon: 'record',      greet: 'Cashier',                   tagline: 'Collect payments and issue receipts.' },
  government:                 { icon: 'globe',       greet: 'National Health Dashboard', tagline: 'Population health and surveillance at a glance.' },
  county_health_director:     { icon: 'mapPin',      greet: 'County Health Office',      tagline: 'Oversee facilities, data quality, and reporting.' },
  boma_health_worker:         { icon: 'patient',     greet: 'Boma Health Worker',        tagline: 'Care for your community — online or off.' },
  payam_supervisor:           { icon: 'mapPin',      greet: 'Payam Supervision',         tagline: 'Support and monitor your community teams.' },
  data_entry_clerk:           { icon: 'edit',        greet: 'Data Entry',                tagline: 'Keep facility records accurate and current.' },
  medical_superintendent:     { icon: 'shield',      greet: 'Medical Superintendent',    tagline: 'Lead clinical operations for your hospital.' },
  hrio:                       { icon: 'record',      greet: 'Health Records',            tagline: 'Own data quality and DHIS2 reporting.' },
  community_health_volunteer: { icon: 'users',       greet: 'Community Volunteer',       tagline: 'Reach households with essential care.' },
  nutritionist:               { icon: 'apple',       greet: 'Nutrition',                 tagline: 'Assess, counsel, and track nutrition programs.' },
  radiologist:                { icon: 'eye',         greet: 'Imaging',                   tagline: 'Read studies and report findings.' },
  hospital_manager:           { icon: 'building',    greet: 'Hospital Management',       tagline: 'Operations, finance, and facility oversight.' },
  medical_biller:             { icon: 'record',      greet: 'Billing & Claims',          tagline: 'Submit claims and manage collections.' },
};

// Demo roster — passwords are fetched at runtime from /api/demo-credentials.
// Ordered to follow the clinical & data flow, from where care and data
// originate (community) through the facility patient journey, then up the
// reporting tiers (facility → payam → county → national → platform). The
// `group` drives the section headers in the picker.
const demoAccounts: { role: string; roleKey: UserRole; user: string; desc: string; hospital: string; group: string }[] = [
  // 1 ── Community & outreach: care and data start at the household / boma.
  { group: 'Community & outreach',         role: 'Community Volunteer',    roleKey: 'community_health_volunteer', user: 'chv.ajak',         desc: 'Kajo-keji Boma PHCU',       hospital: 'phcu-001' },
  { group: 'Community & outreach',         role: 'Boma Health Worker',     roleKey: 'boma_health_worker',         user: 'bhw.akol',         desc: 'Kajo-keji Boma PHCU',       hospital: 'phcu-001' },

  // 2 ── Facility · patient journey: register → pay → triage → see clinician
  //       → diagnostics → pharmacy → nutrition → billing.
  { group: 'Facility · patient journey',   role: 'Front Desk',             roleKey: 'front_desk',                 user: 'desk.amira',       desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · patient journey',   role: 'Cashier',                roleKey: 'cashier',                    user: 'cashier.deng',     desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · patient journey',   role: 'Nurse',                  roleKey: 'nurse',                      user: 'nurse.stella',     desc: 'Malakal Teaching Hospital', hospital: 'hosp-003' },
  { group: 'Facility · patient journey',   role: 'Doctor',                 roleKey: 'doctor',                     user: 'dr.wani',          desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · patient journey',   role: 'Doctor (Private)',       roleKey: 'doctor',                     user: 'dr.mercy',         desc: 'Mercy Org · Juba Teaching', hospital: 'hosp-001' },
  { group: 'Facility · patient journey',   role: 'Clinical Officer',       roleKey: 'clinical_officer',           user: 'co.deng',          desc: 'Wau State Hospital',        hospital: 'hosp-002' },
  { group: 'Facility · patient journey',   role: 'Midwife',                roleKey: 'midwife',                    user: 'midwife.nyakong',  desc: 'Malakal Teaching Hospital', hospital: 'hosp-003' },
  { group: 'Facility · patient journey',   role: 'Lab Tech',               roleKey: 'lab_tech',                   user: 'lab.gatluak',      desc: 'Bentiu State Hospital',     hospital: 'hosp-004' },
  { group: 'Facility · patient journey',   role: 'Radiologist',            roleKey: 'radiologist',                user: 'rad.tamamhealth',  desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · patient journey',   role: 'Pharmacist',             roleKey: 'pharmacist',                 user: 'pharma.rose',      desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · patient journey',   role: 'Nutritionist',           roleKey: 'nutritionist',               user: 'nutr.nyabol',      desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · patient journey',   role: 'Medical Biller',         roleKey: 'medical_biller',             user: 'biller.nyandeng',  desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },

  // 3 ── Facility · records & administration: capture, quality, oversight.
  { group: 'Facility · records & admin',   role: 'Data Entry Clerk',       roleKey: 'data_entry_clerk',           user: 'data.ayen',        desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · records & admin',   role: 'Health Records (HRIO)',  roleKey: 'hrio',                       user: 'hrio.dut',         desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · records & admin',   role: 'Med. Superintendent',    roleKey: 'medical_superintendent',     user: 'supt.lado',        desc: 'Juba Teaching Hospital',    hospital: 'hosp-001' },
  { group: 'Facility · records & admin',   role: 'Org Admin',              roleKey: 'org_admin',                  user: 'org.admin',        desc: 'Mercy Hospital Group',      hospital: '' },

  // 4 ── Sub-national oversight: data aggregates up payam → county.
  { group: 'Sub-national oversight',       role: 'Payam Supervisor',       roleKey: 'payam_supervisor',           user: 'sup.mary',         desc: 'Kajo-keji PHCC',            hospital: 'phcc-001' },
  { group: 'Sub-national oversight',       role: 'County Health Director', roleKey: 'county_health_director',      user: 'county.lopez',     desc: 'County Health Office',      hospital: '' },

  // 5 ── National & platform: MoH reporting and platform administration.
  { group: 'National & platform',          role: 'Government',             roleKey: 'government',                  user: 'admin',            desc: 'National MoH oversight',    hospital: '' },
  { group: 'National & platform',          role: 'Super Admin',            roleKey: 'super_admin',                user: 'superadmin',       desc: 'Platform-wide access',      hospital: '' },
];

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
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [demoCreds, setDemoCreds] = useState<Record<string, string>>({});
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

  // Returning-user personalization: restore the last user remembered on this
  // device so the username is pre-filled on this browser.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('tamamhealth-last-user');
      if (!raw) return;
      const saved = JSON.parse(raw) as { username?: string; role?: UserRole };
      if (saved.username) { setUsername(saved.username); setRemember(true); }
    } catch { /* corrupt/unavailable storage — ignore */ }
  }, []);

  // Pull freshly-generated demo passwords from the server (one-time per load).
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
        for (const p of body.profiles) if (p.password) map[p.username] = p.password;
        setDemoCreds(map);
      } catch { /* demo creds are a convenience; fail silently */ }
    })();
    return () => { cancelled = true; };
  }, [demoEnabled]);

  const filteredHospitals = hospitals.filter(h =>
    !hospitalSearch || h.name.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    h.state.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    h.type.replace(/_/g, ' ').toLowerCase().includes(hospitalSearch.toLowerCase())
  );

  useEffect(() => {
    if (isAuthenticated && currentUser) router.push(getDefaultDashboard(currentUser.role));
  }, [isAuthenticated, currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password, hospitalId || undefined);
      if (result) {
        // Remember this user on this device (only when they opt in) so they
        // return to their own personalized login screen — pre-filled username
        // and role-adaptive welcome/hero.
        try {
          if (remember) {
            localStorage.setItem('tamamhealth-last-user', JSON.stringify({ username, role: result }));
          } else {
            localStorage.removeItem('tamamhealth-last-user');
          }
        } catch { /* storage may be unavailable (private mode) — non-fatal */ }
        router.push(getDefaultDashboard(result));
      }
      else { setError('Invalid credentials. Please try again.'); setLoading(false); }
    } catch { setError('Login failed. Please try again.'); setLoading(false); }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
  };

  const pickDemo = (acc: typeof demoAccounts[number]) => {
    const pw = demoCreds[acc.user];
    setUsername(acc.user);
    if (pw) setPassword(pw);
    setHospitalId(acc.hospital || 'hosp-001');
    const h = hospitals.find(x => x.id === (acc.hospital || 'hosp-001'));
    if (h) setHospitalSearch(h.name);
    setShowDemoAccounts(false);
  };

  if (isAuthenticated) {
    return (
      <div className="tl-loading">
        <div className="tl-loading-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/tamam-icon.svg" alt="" aria-hidden width={40} height={40} />
        </div>
        <p>Redirecting to your dashboard…</p>
        <style jsx>{`
          .tl-loading { min-height: 100vh; display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center; background: #ffffff; }
          .tl-loading-mark { animation: tl-pulse 1.2s ease-in-out infinite; }
          .tl-loading p { color: ${ACCENT_DEEP}; font-size: 14px; font-weight: 600; }
          @keyframes tl-pulse { 0%,100% { opacity: .55; transform: scale(.96);} 50% { opacity: 1; transform: scale(1);} }
        `}</style>
      </div>
    );
  }

  return (
    <div className="tl-shell">
      <div className="tl-card">
        {/* ───────────── Left: form ───────────── */}
        <section className="tl-form-side">
          <header className="tl-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/tamam-icon.svg" alt="" aria-hidden className="tl-brand-icon" />
            <span className="tl-brand-mark">tamam<span className="tl-brand-light">health</span></span>
          </header>

          <div className="tl-form-wrap">
            {!dbReady && (
              <div className="tl-db-banner">
                <span className="tl-spin" /> Initializing offline database…
              </div>
            )}

            <form onSubmit={handleSubmit} className="tl-form">
              {/* Facility */}
              <div className="tl-field">
                <label htmlFor="login-hospital">Hospital / Facility</label>
                <div className="tl-input-wrap">
                  <span className="tl-input-icon"><Icon name="building" size={18} color={ACCENT} /></span>
                  <input
                    id="login-hospital" type="text" value={hospitalSearch}
                    onChange={(e) => { setHospitalSearch(e.target.value); setShowHospitalDropdown(true); setHospitalId(''); }}
                    onFocus={() => setShowHospitalDropdown(true)}
                    placeholder="Search by name, state, or type…" autoComplete="off" className="tl-input"
                  />
                </div>
                {hospitalId && (
                  <div className="tl-field-ok">
                    <Icon name="building" size={12} color={ACCENT_DEEP} /> {hospitals.find(h => h.id === hospitalId)?.name || hospitalId}
                  </div>
                )}
                {showHospitalDropdown && hospitalSearch.length > 0 && (
                  <div className="tl-dropdown">
                    {filteredHospitals.length === 0 ? (
                      <p className="tl-dropdown-empty">No facilities found</p>
                    ) : (
                      filteredHospitals.slice(0, 8).map(h => {
                        const typeLabel = h.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        return (
                          <button key={h.id} type="button"
                            onClick={() => { setHospitalId(h.id); setHospitalSearch(h.name); setShowHospitalDropdown(false); }}
                            className="tl-dropdown-item">
                            <Icon name="building" size={14} color={ACCENT} style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="tl-dropdown-name">{h.name}</div>
                              <div className="tl-dropdown-meta">{typeLabel} — {h.state}</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Username */}
              <div className="tl-field">
                <label htmlFor="login-username">Username or Staff ID</label>
                <div className="tl-input-wrap">
                  <span className="tl-input-icon"><Icon name="patient" size={18} color={ACCENT} /></span>
                  <input id="login-username" type="text" value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)} placeholder="e.g. dr.wani"
                    autoComplete="username" className="tl-input" />
                </div>
              </div>

              {/* Password */}
              <div className="tl-field">
                <label htmlFor="login-password">Password</label>
                <div className="tl-input-wrap">
                  <span className="tl-input-icon"><Icon name="shield" size={18} color={ACCENT} /></span>
                  <input id="login-password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    autoComplete="current-password" className="tl-input tl-input-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'} className="tl-input-eye">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <div role="alert" className="tl-error">{error}</div>}

              <div className="tl-row">
                <label className="tl-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember for 30 days</span>
                </label>
                <button type="button" className="tl-forgot" onClick={() => setForgotOpen(o => !o)}>Forgot password</button>
              </div>

              {forgotOpen && (
                <div className="tl-forgot-note" role="status">
                  Password resets are handled by your administrator. Contact your facility
                  administrator (or the Ministry of Health IT support desk) to have your
                  password reset — you’ll be asked to set a new one at your next sign-in.
                </div>
              )}

              <button type="submit" disabled={loading || !dbReady} className="tl-submit">
                {loading ? (<span className="tl-submit-loading"><span className="tl-spin tl-spin-light" /> Signing in…</span>)
                  : (<span>Sign in</span>)}
              </button>

              <div className="tl-divider"><span>or</span></div>

              <a href="/patient-portal" className="tl-secondary">
                <Icon name="patient" size={18} color={ACCENT_DEEP} /> Sign in as a patient
              </a>
            </form>

            {demoEnabled && (
              <div className="tl-demo">
                <button type="button" onClick={() => setShowDemoAccounts(!showDemoAccounts)} className="tl-demo-toggle">
                  <span>Demo accounts — pick a role</span>
                  <ChevronRight className="w-3.5 h-3.5" style={{ transform: showDemoAccounts ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s' }} />
                </button>
                {showDemoAccounts && (
                  <div className="tl-demo-list">
                    {demoAccounts.map((acc, i) => {
                      const pw = demoCreds[acc.user];
                      const p = ROLE_PROFILE[acc.roleKey];
                      const showHeader = i === 0 || demoAccounts[i - 1].group !== acc.group;
                      return (
                        <Fragment key={acc.user}>
                          {showHeader && <div className="tl-demo-group">{acc.group}</div>}
                          <button type="button" disabled={!pw} onClick={() => pickDemo(acc)}
                            className="tl-demo-item" style={{ opacity: pw ? 1 : 0.5 }}>
                            <span className="tl-demo-icon"><Icon name={(p?.icon ?? 'user') as IconName} size={16} color={ACCENT_DEEP} /></span>
                            <div className="tl-demo-meta">
                              <div className="tl-demo-meta-row">
                                <span className="tl-demo-role">{acc.role}</span>
                                <span className="tl-demo-desc">{acc.desc}</span>
                              </div>
                              <p className="tl-demo-creds">{acc.user}{pw ? '' : ' · loading…'}</p>
                            </div>
                            <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <p className="tl-terms">
              By signing in you agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a> and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </p>
          </div>
        </section>
      </div>

      <style jsx>{`
        .tl-shell {
          min-height: 100vh;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
        }
        .tl-card {
          width: 100%; max-width: 440px;
          display: flex; flex-direction: column;
          background: #ffffff;
        }

        /* form side */
        .tl-form-side {
          padding: 0;
          display: flex; flex-direction: column;
        }
        .tl-brand { display: flex; justify-content: center; align-items: center; gap: 10px; flex-shrink: 0; }
        .tl-brand-icon { width: 36px; height: 36px; }
        .tl-brand-mark { font-family: 'Untitled Sans', Arial, sans-serif; font-weight: 800; font-size: clamp(20px,1.6vw,24px); letter-spacing: -0.02em; color: ${ACCENT_DEEP}; line-height: 1; }
        .tl-brand-light { color: ${ACCENT}; }

        .tl-form-wrap { margin: 0 auto; width: 100%; max-width: 430px; padding-top: clamp(20px, 3.5vh, 36px); display: flex; flex-direction: column; }

        .tl-db-banner { margin-bottom: 14px; padding: 8px 12px; font-size: 11.5px; color: ${ACCENT_DEEP}; background: rgba(59, 130, 246,0.08); border: 1px solid rgba(59, 130, 246,0.20); border-radius: 8px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; }

        .tl-form { display: flex; flex-direction: column; gap: 15px; }
        .tl-field { position: relative; display: flex; flex-direction: column; gap: 6px; }
        .tl-field label { font-size: 13px; font-weight: 600; color: ${ACCENT_DEEP}; font-family: 'Untitled Sans', Arial, sans-serif; }
        .tl-input-wrap { position: relative; display: flex; align-items: center; }
        .tl-input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); display: inline-flex; pointer-events: none; }
        .tl-input {
          width: 100%; padding: 12px 14px 12px 42px; font-size: 14.5px;
          color: ${ACCENT_DEEP}; background: #f6f9ff; border: 1.5px solid #dbe6fb;
          border-radius: 10px; outline: none; transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .tl-input::placeholder { color: #94a3b8; }
        .tl-input:focus { border-color: ${ACCENT}; background: #ffffff; box-shadow: 0 0 0 4px rgba(59, 130, 246,0.12); }
        .tl-input-password { padding-right: 44px; }
        .tl-input-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: #64748b; cursor: pointer; border-radius: 6px; }
        .tl-input-eye:hover { background: rgba(59, 130, 246,0.08); color: ${ACCENT_DEEP}; }
        .tl-field-ok { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: ${ACCENT}; font-weight: 600; }

        .tl-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: #fff; border: 1px solid #dbe6fb; border-radius: 12px; box-shadow: 0 16px 40px rgba(30, 58, 138,0.16); z-index: 20; max-height: 240px; overflow-y: auto; padding: 6px; }
        .tl-dropdown-empty { padding: 12px; font-size: 13px; color: #94a3b8; text-align: center; margin: 0; }
        .tl-dropdown-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 10px; background: transparent; border: none; border-radius: 8px; cursor: pointer; text-align: left; }
        .tl-dropdown-item:hover { background: rgba(59, 130, 246,0.07); }
        .tl-dropdown-name { font-size: 13.5px; font-weight: 600; color: ${ACCENT_DEEP}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tl-dropdown-meta { font-size: 11.5px; color: #94a3b8; }

        .tl-error { padding: 10px 12px; font-size: 13px; color: #b3261e; background: rgba(196,69,54,0.08); border: 1px solid rgba(196,69,54,0.22); border-radius: 8px; }

        .tl-row { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
        .tl-check { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; cursor: pointer; }
        .tl-check input { width: 15px; height: 15px; accent-color: ${ACCENT}; margin: 0; }
        .tl-forgot { font-size: 13px; color: ${ACCENT}; font-weight: 600; text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
        .tl-forgot:hover { text-decoration: underline; }
        .tl-forgot-note { margin-top: 10px; padding: 10px 12px; font-size: 12.5px; line-height: 1.5; color: ${ACCENT_DEEP}; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.20); border-radius: 8px; }

        .tl-submit { width: 100%; padding: 13px 24px; margin-top: 6px; font-size: 15px; font-weight: 700; color: #fff; background: linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DEEP} 100%); border: none; border-radius: 10px; cursor: pointer; transition: transform .12s, box-shadow .15s, opacity .15s; box-shadow: 0 8px 20px rgba(59, 130, 246,0.28); }
        .tl-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(59, 130, 246,0.34); }
        .tl-submit:disabled { opacity: .6; cursor: not-allowed; }
        .tl-submit-loading { display: inline-flex; align-items: center; gap: 8px; }

        .tl-divider { display: flex; align-items: center; gap: 12px; margin: 4px 0; color: #94a3b8; font-size: 12px; }
        .tl-divider::before, .tl-divider::after { content: ''; flex: 1; height: 1px; background: #e4ecfb; }

        .tl-secondary { width: 100%; padding: 12px 24px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: ${ACCENT_DEEP}; background: #f0f5ff; border: 1.5px solid #d4e3fb; border-radius: 10px; text-decoration: none; transition: background .15s, border-color .15s; }
        .tl-secondary:hover { background: #eef4ff; border-color: #bfdbfe; }

        .tl-demo { margin-top: 22px; }
        .tl-demo-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; font-size: 13px; font-weight: 600; color: ${ACCENT_DEEP}; background: #f3f7ff; border: 1px solid #dfeafb; border-radius: 10px; cursor: pointer; }
        .tl-demo-toggle:hover { background: #ecf5ef; }
        .tl-demo-list { margin-top: 8px; border: 1px solid #e4ecfb; border-radius: 12px; overflow: hidden; max-height: 320px; overflow-y: auto; }
        .tl-demo-group { position: sticky; top: 0; z-index: 1; padding: 8px 13px 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${ACCENT}; background: #f4f8ff; border-bottom: 1px solid #e4ecfb; }
        .tl-demo-item { width: 100%; display: flex; align-items: center; gap: 11px; padding: 11px 13px; background: #fff; border: none; border-bottom: 1px solid #eef5f0; cursor: pointer; text-align: left; transition: background .12s; }
        .tl-demo-item:last-child { border-bottom: none; }
        .tl-demo-item:hover:not(:disabled) { background: rgba(59, 130, 246,0.06); }
        .tl-demo-icon { flex-shrink: 0; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; background: rgba(59, 130, 246,0.10); }
        .tl-demo-meta { flex: 1; min-width: 0; }
        .tl-demo-meta-row { display: flex; align-items: center; gap: 8px; }
        .tl-demo-role { font-size: 13px; font-weight: 700; color: ${ACCENT_DEEP}; }
        .tl-demo-desc { font-size: 11.5px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tl-demo-creds { font-size: 11.5px; color: #94a3b8; margin: 1px 0 0; font-family: ui-monospace, monospace; }

        .tl-terms { margin-top: 20px; font-size: 11.5px; color: #94a3b8; line-height: 1.5; text-align: center; }
        .tl-terms a { color: ${ACCENT}; text-decoration: none; }
        .tl-terms a:hover { text-decoration: underline; }

        .tl-spin { width: 13px; height: 13px; border: 2px solid rgba(59, 130, 246,0.25); border-top-color: ${ACCENT}; border-radius: 50%; display: inline-block; animation: tl-rot .7s linear infinite; }
        .tl-spin-light { border-color: rgba(255,255,255,0.4); border-top-color: #fff; }
        @keyframes tl-rot { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
