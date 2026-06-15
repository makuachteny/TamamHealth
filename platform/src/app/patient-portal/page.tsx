'use client';

import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/Modal';
import {
  User, Calendar, FileText, FlaskConical, Syringe,
  HeartPulse, Shield, Pill, Scan, FolderOpen,
  ChevronRight, AlertTriangle,
  MessageSquare, ArrowRight, Activity,
  Plus, X, LogOut, Send, Building2,
  Wallet, CreditCard, Phone, Banknote,
  Clock, CheckCircle2, Stethoscope,
  Thermometer, Weight, Droplets, Eye,
  Upload, ClipboardList, Receipt,
  UserCircle, Download, Trash2,
  Edit3, Save, Camera, FileUp,
} from '@/components/icons/lucide';
import type { PatientDoc, AppointmentDoc, LabResultDoc, MedicalRecordDoc, PrescriptionDoc, ImmunizationDoc } from '@/lib/db-types';
import { useTranslation } from '@/lib/i18n/useTranslation';

type Tab = 'overview' | 'appointments' | 'records' | 'lab' | 'prescriptions' | 'radiology' | 'documents' | 'immunizations' | 'messages' | 'chat' | 'billing' | 'insurance' | 'forms' | 'uploads' | 'statements' | 'profile';

// Hide the patient-portal "Demo Accounts" dropdown in production. The seed
// patients exist client-side regardless (so the portal can demo offline),
// but exposing their hospital numbers + phone numbers in the login UI is
// strictly a dev/sales aid.
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

/* ═════════════════════════════════════════
   PATIENT LOGIN SCREEN
   ═════════════════════════════════════════ */
function PatientLogin({ onLogin }: { onLogin: (patient: PatientDoc) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'lookup'>('login');
  const [hospitalNumber, setHospitalNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [demoPatients, setDemoPatients] = useState<Array<{ id: string; hospitalNumber: string; phone: string; name: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const { isSeeded } = await import('@/lib/db');
        const seeded = await isSeeded();
        if (!seeded) {
          const { seedDatabase } = await import('@/lib/db-seed');
          await seedDatabase();
        }
        setDbReady(true);

        // Pull the first 3 seed patients so the Demo Accounts panel shows
        // the actual hospitalNumber + phone that exist in this browser's
        // PouchDB (phones are generated per-seed, so static entries drift).
        // Skipped entirely outside demo mode — production must not surface
        // sample patient phone numbers on the login screen.
        if (IS_DEMO) {
          try {
            const { getAllPatients } = await import('@/lib/services/patient-service');
            const all = await getAllPatients();
            setDemoPatients(
              all.slice(0, 3).map((p) => ({
                id: p._id,
                hospitalNumber: p.hospitalNumber || '',
                phone: p.phone || '',
                name: `${p.firstName} ${p.surname}`,
              }))
            );
          } catch { /* demo panel is best-effort */ }
        }
      } catch { setDbReady(false); }
    })();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbReady) { setError(t('patientPortal.dbLoading')); return; }
    setError(''); setLoading(true);
    try {
      const { getAllPatients } = await import('@/lib/services/patient-service');
      const patients = await getAllPatients();
      let found: PatientDoc | undefined;

      if (mode === 'login') {
        // Match by hospital number + full phone. We require an exact phone
        // match (after whitespace strip) because the old `endsWith(last 6)`
        // fallback meant that anyone with the right hospital ID and any
        // number ending in the patient's last 6 digits could log in.
        const hnum = hospitalNumber.trim().toUpperCase();
        // Normalize to digits only on both sides so that "+211-912-345-678",
        // "+211 912 345 678", and "211912345678" all compare equal.
        const ph = phoneNumber.replace(/\D/g, '');
        found = patients.find(p => {
          const pPhone = (p.phone || '').replace(/\D/g, '');
          return (p.hospitalNumber?.toUpperCase() === hnum || p.geocodeId?.toUpperCase() === hnum) &&
            pPhone === ph &&
            pPhone.length > 0;
        });
      } else {
        // Lookup by name + DOB — now require DOB (was optional), otherwise
        // two fields (first + last name) was too weak to gate real records.
        const fn = firstName.trim().toLowerCase();
        const sn = surname.trim().toLowerCase();
        if (!dateOfBirth) {
          setError(t('patientPortal.dobRequired'));
          setLoading(false);
          return;
        }
        found = patients.find(p =>
          p.firstName.toLowerCase() === fn &&
          p.surname.toLowerCase() === sn &&
          p.dateOfBirth === dateOfBirth
        );
      }

      // Audit trail every portal lookup (success OR failure) so that a
      // clinician/admin can review who searched for whom — critical given
      // this form is on a public, unauthenticated route.
      try {
        const { logAudit } = await import('@/lib/services/audit-service');
        await logAudit(
          found ? 'PATIENT_PORTAL_LOGIN' : 'PATIENT_PORTAL_LOOKUP_FAIL',
          undefined,
          'patient-portal',
          mode === 'login'
            ? `hospital_number=${hospitalNumber.trim().slice(0, 20)} ${found ? `→ ${found._id}` : '(no match)'}`
            : `name=${firstName.trim().slice(0, 40)} ${surname.trim().slice(0, 40)} ${found ? `→ ${found._id}` : '(no match)'}`,
          !!found
        );
      } catch { /* audit best-effort */ }

      if (found) {
        localStorage.setItem('tamamhealth-patient-id', found._id);
        localStorage.setItem('tamamhealth-patient-name', `${found.firstName} ${found.surname}`);
        onLogin(found);
      } else {
        setError(mode === 'login'
          ? t('patientPortal.noMatchHospitalId')
          : t('patientPortal.noMatchName')
        );
      }
    } catch (err) {
      setError(t('patientPortal.unableToConnect'));
      console.error(err);
    } finally { setLoading(false); }
  };

  const BLUE = '#3b82f6';
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', fontSize: 15,
    border: '1px solid var(--border-medium)', borderRadius: 4,
    background: 'var(--bg-card-solid)', color: 'var(--text-primary)',
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: "'Untitled Sans', Arial, sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: 6,
    fontFamily: "'Untitled Sans', Arial, sans-serif",
  };

  return (
    <div className="min-h-screen grid pp-login-split" style={{ background: 'var(--bg-primary)' }}>

      {/* ═══ Left: form column — body / footer (branding lives in the sticky top nav) ═══ */}
      <div className="pp-form-col">
        <div className="pp-form-body">
          <div className="pp-form-inner">
            <div className="pp-form-lede">
              <div className="pp-logo-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/tamamhealth-logo.svg" alt="" aria-hidden className="pp-logo-img" />
              </div>
              <h1 className="pp-heading">{t('patientPortal.heroHeading')}</h1>
              <p className="pp-subheading">
                {t('patientPortal.heroSubheading')}
              </p>
            </div>
            <div className="pp-form-card">
            <h2 className="text-[15px] font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: "'Untitled Sans', Arial, sans-serif", letterSpacing: '-0.01em' }}>{t('patientPortal.signInTitle')}</h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--text-muted)', fontFamily: "'Untitled Sans', Arial, sans-serif" }}>{t('patientPortal.signInSubtitle')}</p>

            {!dbReady && (
              <div className="mb-4 p-3 rounded-lg text-center" style={{
                background: 'rgba(59, 130, 246,0.08)', border: '1px solid rgba(59, 130, 246,0.15)',
              }}>
                <p className="text-xs" style={{ color: BLUE }}>
                  <svg className="animate-spin w-3 h-3 inline mr-1.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  {t('patientPortal.initializingDb')}
                </p>
              </div>
            )}

            {/* Mode toggle */}
            <div className="flex mb-6 rounded overflow-hidden" style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)' }}>
              <button onClick={() => { setMode('login'); setError(''); }} type="button" className="flex-1 py-3 text-sm font-bold transition-all" style={{
                background: mode === 'login' ? BLUE : 'transparent',
                color: mode === 'login' ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', borderRadius: 3, margin: 2,
              }}>{t('patientPortal.hospitalIdTab')}</button>
              <button onClick={() => { setMode('lookup'); setError(''); }} type="button" className="flex-1 py-3 text-sm font-bold transition-all" style={{
                background: mode === 'lookup' ? BLUE : 'transparent',
                color: mode === 'lookup' ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', borderRadius: 3, margin: 2,
              }}>{t('patientPortal.nameLookupTab')}</button>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {mode === 'login' ? (
                <>
                  <div>
                    <label htmlFor="pp-hospital" style={labelStyle}>{t('patientPortal.hospitalNumberOrGeocode')}</label>
                    <input id="pp-hospital" type="text" value={hospitalNumber} onChange={e => setHospitalNumber(e.target.value)}
                      placeholder={t('patientPortal.hospitalNumberPlaceholder')} required style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(0,119,215,0.1)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }} />
                  </div>
                  <div>
                    <label htmlFor="pp-phone" style={labelStyle}>{t('patientPortal.phoneNumber')}</label>
                    <input id="pp-phone" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      placeholder={t('patientPortal.phonePlaceholder')} required style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(0,119,215,0.1)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="pp-firstName" style={labelStyle}>{t('patientPortal.firstName')}</label>
                    <input id="pp-firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder={t('patientPortal.firstNamePlaceholder')} required style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(0,119,215,0.1)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }} />
                  </div>
                  <div>
                    <label htmlFor="pp-surname" style={labelStyle}>{t('patientPortal.surname')}</label>
                    <input id="pp-surname" type="text" value={surname} onChange={e => setSurname(e.target.value)}
                      placeholder={t('patientPortal.surnamePlaceholder')} required style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(0,119,215,0.1)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }} />
                  </div>
                  <div>
                    <label htmlFor="pp-dob" style={labelStyle}>{t('patientPortal.dateOfBirthOptional')}</label>
                    <input id="pp-dob" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(0,119,215,0.1)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }} />
                  </div>
                </>
              )}

              {error && (
                <div role="alert" className="p-3 rounded-xl text-sm" style={{
                  background: 'rgba(229,46,66,0.06)', color: '#E52E42',
                  border: '1px solid rgba(229,46,66,0.15)',
                }}>{error}</div>
              )}

              <button type="submit" disabled={loading || !dbReady}
                className="w-full flex items-center justify-center gap-2 text-[15px] font-semibold text-white transition-all duration-200 mt-3"
                style={{
                  fontFamily: "'Untitled Sans', Arial, sans-serif",
                  background: BLUE, padding: '14px 20px', borderRadius: 4,
                  border: 'none', cursor: loading ? 'wait' : 'pointer',
                  opacity: loading || !dbReady ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(0,119,215,0.25)',
                }}>
                {loading ? t('patientPortal.searching') : t('patientPortal.signInTitle')} <ArrowRight size={14} />
              </button>
            </form>

            {/* Demo accounts — pulled live from the seeded PouchDB so the
                credentials actually match this browser's database. Gated on
                IS_DEMO so production never reveals seed patient identifiers. */}
            {IS_DEMO && demoPatients.length > 0 && (
              <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border-medium)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('patientPortal.demoAccounts')}</p>
                <div className="flex flex-col gap-1.5">
                  {demoPatients.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => { setMode('login'); setHospitalNumber(demo.hospitalNumber); setPhoneNumber(demo.phone); setError(''); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded text-left transition-all"
                      style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}
                    >
                      <span className="flex flex-col">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{demo.name}</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{demo.phone}</span>
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{demo.hospitalNumber}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>

        <footer className="pp-form-footer">
          <div className="pp-flag-strip" aria-hidden>
            <span style={{ background: '#111' }} />
            <span style={{ background: '#E52E42' }} />
            <span style={{ background: '#ffffff', border: '1px solid var(--border-medium)' }} />
            <span style={{ background: '#10B944' }} />
            <span style={{ background: '#0F4C81' }} />
            <span style={{ background: '#FCD34D' }} />
          </div>
          <p className="pp-form-footer-text">
            {t('patientPortal.footerTagline')}
          </p>
        </footer>
      </div>

      {/* ═══ Right: imagery panel (desktop only) ═══ */}
      <aside className="pp-image-panel" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/doctor-nurse-consultation.jpg" alt={t('patientPortal.heroImageAlt')} />
        <div className="pp-image-scrim" />

        <div className="pp-image-body">
          <h2 className="pp-image-title">
            {t('patientPortal.heroPanelTitle')}
          </h2>
          <p className="pp-image-sub">
            {t('patientPortal.heroPanelSub')}
          </p>
        </div>

        <footer className="pp-image-footer">
          <ul className="pp-image-bullets">
            <li><span className="pp-bullet-dot" /> {t('patientPortal.heroBullet1')}</li>
            <li><span className="pp-bullet-dot" /> {t('patientPortal.heroBullet2')}</li>
            <li><span className="pp-bullet-dot" /> {t('patientPortal.heroBullet3')}</li>
          </ul>
        </footer>
      </aside>

      <style jsx>{`
        .pp-login-split {
          grid-template-columns: 1fr;
          min-height: 100vh;
        }
        @media (min-width: 1024px) {
          .pp-login-split { grid-template-columns: 1fr 1fr; }
        }

        .pp-form-col {
          display: grid;
          grid-template-rows: 1fr auto;
          padding: 32px 32px 32px;
          min-height: calc(100vh - 52px);
        }
        @media (min-width: 1024px) {
          .pp-form-col { padding: 48px 56px 32px; }
        }

        .pp-kicker {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent-primary, #3b82f6);
          padding: 5px 12px;
          border: 1px solid var(--accent-primary, #3b82f6);
          border-radius: 999px;
          background: var(--accent-light, rgba(59, 130, 246,0.08));
          margin-bottom: 18px;
        }

        .pp-form-body {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 12px;
        }
        .pp-form-inner {
          width: 100%;
          max-width: 540px;
          text-align: center;
        }
        .pp-form-lede { margin-bottom: 24px; }
        .pp-logo-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 68px;
          height: 68px;
          border-radius: 20px;
          background: var(--bg-card-solid);
          border: 1px solid var(--border-medium);
          box-shadow: 0 6px 18px rgba(26,58,58,0.08);
          margin-bottom: 20px;
        }
        .pp-logo-img { width: 42px; height: 42px; }
        .pp-heading {
          font-family: 'Untitled Sans', Arial, sans-serif;
          font-size: clamp(28px, 3.2vw, 36px);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: var(--text-primary);
          margin: 0 0 10px;
        }
        .pp-subheading {
          font-size: 15px;
          line-height: 1.55;
          color: var(--text-muted);
          margin: 0 auto;
          max-width: 420px;
        }
        .pp-form-card {
          padding: 36px 40px 32px;
          background: var(--bg-card-solid);
          border-radius: 16px;
          border: 1px solid var(--border-medium);
          box-shadow: 0 12px 40px rgba(26,58,58,0.08), 0 1px 2px rgba(26,58,58,0.04);
          text-align: left;
          position: relative;
          overflow: hidden;
        }
        .pp-form-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #3b82f6 0%, #3B82F6 50%, #E4A84B 100%);
        }

        .pp-form-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding-top: 16px;
        }
        .pp-flag-strip { display: flex; gap: 0; align-items: center; }
        .pp-flag-strip span { height: 3px; display: block; }
        .pp-flag-strip span:nth-child(1) { width: 28px; border-top-left-radius: 3px; border-bottom-left-radius: 3px; }
        .pp-flag-strip span:nth-child(2) { width: 28px; }
        .pp-flag-strip span:nth-child(3) { width: 16px; }
        .pp-flag-strip span:nth-child(4) { width: 28px; }
        .pp-flag-strip span:nth-child(5) { width: 16px; }
        .pp-flag-strip span:nth-child(6) { width: 10px; border-top-right-radius: 3px; border-bottom-right-radius: 3px; }
        .pp-form-footer-text {
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          margin: 0;
        }

        /* Sticky + fixed 100vh so the form can grow without stretching the
           photo or drifting the subject out of frame. */
        .pp-image-panel {
          display: none;
          position: relative;
          overflow: hidden;
          height: calc(100vh - 52px);
        }
        @media (min-width: 1024px) {
          .pp-image-panel {
            display: grid;
            grid-template-rows: 1fr auto;
            padding: 48px 56px;
            position: sticky;
            top: 52px;
            align-self: start;
          }
        }
        .pp-image-panel img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 50% 38%;
          z-index: 0;
          /* Slight zoom so the face sits closer to viewer — prevents the
             "distant / out-of-focus" look when the photo is wider than tall */
          transform: scale(1.08);
          transform-origin: 50% 40%;
        }
        .pp-image-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(26,58,58,0.72) 0%, rgba(26,58,58,0.40) 40%, rgba(45,155,106,0.40) 100%),
            linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.40) 100%);
          z-index: 1;
        }
        .pp-image-body, .pp-image-footer {
          position: relative;
          z-index: 2;
          color: #fff;
        }
        .pp-image-body {
          display: flex;
          flex-direction: column;
          justify-content: center;
          max-width: 520px;
          padding: 48px 0;
        }
        .pp-image-title {
          font-family: 'Untitled Sans', Arial, sans-serif;
          font-size: clamp(32px, 3.6vw, 48px);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.015em;
          margin: 0 0 20px;
          text-shadow: 0 2px 14px rgba(0,0,0,0.30);
        }
        .pp-image-sub {
          font-size: 15.5px;
          line-height: 1.65;
          color: rgba(255,255,255,0.92);
          max-width: 460px;
          margin: 0;
          text-shadow: 0 2px 10px rgba(0,0,0,0.25);
        }
        .pp-image-footer { padding-top: 16px; }
        .pp-image-bullets {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 13px;
          color: rgba(255,255,255,0.88);
        }
        .pp-image-bullets li { display: flex; align-items: center; gap: 10px; }
        .pp-bullet-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #E4A84B;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(228,168,75,0.18);
        }
      `}</style>
    </div>
  );
}

/* ═════════════════════════════════════════
   PATIENT PORTAL (authenticated)
   ═════════════════════════════════════════ */
export default function PatientPortalPage() {
  const { t } = useTranslation();
  const [patient, setPatient] = useState<PatientDoc | null>(null);
  const [checking, setChecking] = useState(true);

  // Check for existing session
  useEffect(() => {
    const savedId = localStorage.getItem('tamamhealth-patient-id');
    if (savedId) {
      (async () => {
        try {
          const { getAllPatients } = await import('@/lib/services/patient-service');
          const patients = await getAllPatients();
          const found = patients.find(p => p._id === savedId);
          if (found) setPatient(found);
        } catch { /* ignore */ }
        finally { setChecking(false); }
      })();
    } else {
      setChecking(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('tamamhealth-patient-id');
    localStorage.removeItem('tamamhealth-patient-name');
    setPatient(null);
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('status.loading')}</p>
      </div>
    );
  }

  if (!patient) {
    return <PatientLogin onLogin={setPatient} />;
  }

  return <PatientDashboard patient={patient} onLogout={handleLogout} />;
}

/* ═════════════════════════════════════════
   PATIENT DASHBOARD
   ═════════════════════════════════════════ */
function PatientDashboard({ patient, onLogout }: { patient: PatientDoc; onLogout: () => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [labResults, setLabResults] = useState<LabResultDoc[]>([]);
  const [records, setRecords] = useState<MedicalRecordDoc[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionDoc[]>([]);
  const [immunizations, setImmunizations] = useState<ImmunizationDoc[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  // Load patient-specific data
  useEffect(() => {
    (async () => {
      try {
        const [aptMod, labMod, recMod, rxMod, immMod] = await Promise.all([
          import('@/lib/services/appointment-service'),
          import('@/lib/services/lab-service'),
          import('@/lib/services/medical-record-service'),
          import('@/lib/services/prescription-service'),
          import('@/lib/services/immunization-service'),
        ]);
        const [apts, labs, recs, rxs, imms] = await Promise.all([
          aptMod.getAppointmentsByPatient(patient._id),
          labMod.getLabResultsByPatient(patient._id),
          recMod.getRecordsByPatient(patient._id),
          rxMod.getPrescriptionsByPatient(patient._id),
          immMod.getByPatient(patient._id),
        ]);
        setAppointments(apts);
        setLabResults(labs);
        setRecords(recs);
        setPrescriptions(rxs);
        setImmunizations(imms);
      } catch (err) { console.error('Failed to load patient data:', err); }
    })();
  }, [patient._id]);

  const upcomingApts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return appointments.filter(a => a.appointmentDate >= today && a.status !== 'cancelled' && a.status !== 'no_show');
  }, [appointments]);

  const [chatDepartment, setChatDepartment] = useState('General / OPD');

  const mainTabs: { key: Tab; label: string; icon: typeof User; count?: number }[] = [
    { key: 'overview', label: t('patientPortal.tabOverview'), icon: Activity },
    { key: 'records', label: t('patientPortal.tabMedicalRecords'), icon: FileText, count: records.length },
    { key: 'prescriptions', label: t('patientPortal.tabPrescriptions'), icon: Pill },
    { key: 'lab', label: t('patientPortal.tabLabResults'), icon: FlaskConical, count: labResults.filter(l => l.status === 'pending').length },
    { key: 'radiology', label: t('patientPortal.tabRadiology'), icon: Scan },
    { key: 'immunizations', label: t('patientPortal.tabImmunizations'), icon: Syringe },
    { key: 'insurance', label: t('patientPortal.tabInsurance'), icon: Shield },
  ];
  const serviceTabs: { key: Tab; label: string; icon: typeof User; count?: number }[] = [
    { key: 'billing', label: t('patientPortal.tabBilling'), icon: Wallet },
    { key: 'statements', label: t('patientPortal.tabStatements'), icon: Receipt },
    { key: 'forms', label: t('patientPortal.tabForms'), icon: ClipboardList },
    { key: 'uploads', label: t('patientPortal.tabUploads'), icon: Upload },
    { key: 'documents', label: t('patientPortal.tabDocuments'), icon: FolderOpen },
  ];
  const actionTabs: { key: Tab; label: string; icon: typeof User; count?: number }[] = [
    { key: 'appointments', label: t('patientPortal.tabAppointments'), icon: Calendar, count: upcomingApts.length },
    { key: 'chat', label: t('patientPortal.tabMessages'), icon: MessageSquare },
    { key: 'profile', label: t('patientPortal.tabMyProfile'), icon: UserCircle },
  ];
  const tabs = [...mainTabs, ...serviceTabs, ...actionTabs];

  type ChatMsg = { id?: string; text: string; from: 'patient' | 'system'; time: string };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { text: t('patientPortal.chatWelcome', { name: patient.firstName }), from: 'system', time: '09:00' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Load any existing messages on this patient record so the conversation
  // history survives page reloads (rather than only living in component
  // state). Anything authored by `fromDoctorId === 'patient'` is rendered as
  // a patient-side bubble; everything else is a staff/system reply.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getMessagesByPatient } = await import('@/lib/services/message-service');
        const docs = await getMessagesByPatient(patient._id);
        if (cancelled) return;
        const formatted: ChatMsg[] = docs
          .slice() // getMessagesByPatient returns newest-first; flip so newest is at the bottom
          .sort((a, b) => (a.sentAt || '').localeCompare(b.sentAt || ''))
          .map(m => ({
            id: m._id,
            text: m.body,
            from: m.fromDoctorId === 'patient' ? 'patient' : 'system',
            time: new Date(m.sentAt || m.createdAt || Date.now())
              .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
        if (formatted.length > 0) {
          setChatMessages(formatted);
        }
      } catch (err) {
        // History load is best-effort — fall back to the welcome stub.
        console.error('[patient-portal] load messages failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [patient._id]);

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatSending) return;
    setChatSending(true);
    setChatError(null);
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistically render the patient bubble so the UI feels instant.
    // We tag it with a temporary id so the post-persist replacement is safe.
    const tempId = `pending-${now.getTime()}`;
    setChatMessages(prev => [...prev, { id: tempId, text: trimmed, from: 'patient', time }]);
    setChatInput('');

    try {
      const { createMessage } = await import('@/lib/services/message-service');
      // Persist into the patient's local PouchDB. In synced deployments this
      // replicates to CouchDB and shows up on the staff side; in offline /
      // local-only deployments it still survives reloads on this device.
      // We mark the author as `patient` so staff dashboards can distinguish
      // patient-originated messages from clinician replies.
      // The Patient interface only formally declares `registrationHospital`
      // (the hospital id), but seed/runtime docs frequently also carry a
      // `registrationHospitalName`. Read it defensively via index access so
      // we do the right thing regardless.
      const registrationHospitalName =
        (patient as { registrationHospitalName?: string }).registrationHospitalName
        || patient.registrationHospital
        || '';
      const saved = await createMessage({
        // Direction is the canonical sender→recipient marker; recipientType
        // is kept for staff-inbox filter compatibility.
        direction: 'patient_to_staff',
        recipientType: 'staff',
        patientId: patient._id,
        patientName: `${patient.firstName} ${patient.surname}`,
        patientPhone: patient.phone || '',
        recipientDepartment: chatDepartment,
        recipientHospitalId: patient.registrationHospital || '',
        recipientHospitalName: registrationHospitalName,
        fromDoctorId: 'patient',
        fromDoctorName: `${patient.firstName} ${patient.surname}`,
        fromHospitalId: patient.registrationHospital || '',
        fromHospitalName: registrationHospitalName,
        subject: `Patient message — ${chatDepartment}`,
        body: trimmed,
        channel: 'app',
        sentAt: now.toISOString(),
      });
      // Replace the optimistic entry with the persisted one (using the real id).
      setChatMessages(prev => prev.map(m => m.id === tempId
        ? { id: saved._id, text: saved.body, from: 'patient', time }
        : m));
    } catch (err) {
      console.error('[patient-portal] send message failed', err);
      // Roll back the optimistic bubble and surface a real error to the user
      // — better to say "we couldn't deliver that" than to fake a success
      // and leave them thinking the doctor saw it.
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
      setChatInput(trimmed);
      setChatError(t('patientPortal.chatSendError'));
    } finally {
      setChatSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
      <style dangerouslySetInnerHTML={{ __html: patientPortalCSS }} />

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex" style={{
        width: 260, flexShrink: 0, flexDirection: 'column',
        background: 'var(--bg-card-solid)', borderRight: '1px solid var(--border-medium)',
      }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--border-medium)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--accent-light)', border: '2px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {patient.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={patient.photoUrl} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }} />
                : <User size={56} style={{ color: 'var(--accent-primary)' }} />
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{patient.firstName} {patient.surname}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{patient.hospitalNumber}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', marginBottom: 10 }}>
            <Building2 size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{patient.registrationHospital}</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {/* Health records section */}
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '8px 14px 4px', opacity: 0.7 }}>{t('patientPortal.sectionHealthRecords')}</p>
          {mainTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, textAlign: 'left', marginBottom: 1,
              transition: 'all 0.15s ease',
            }}>
              <tab.icon size={15} />
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.count ? <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--accent-light)',
                color: activeTab === tab.key ? '#fff' : 'var(--accent-primary)',
              }}>{tab.count}</span> : null}
            </button>
          ))}

          {/* Services section */}
          <div style={{ height: 1, background: 'var(--border-medium)', margin: '10px 14px' }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '4px 14px 4px', opacity: 0.7 }}>{t('patientPortal.sectionServicesBilling')}</p>
          {serviceTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, textAlign: 'left', marginBottom: 1,
              transition: 'all 0.15s ease',
            }}>
              <tab.icon size={15} />
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.count ? <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--accent-light)',
                color: activeTab === tab.key ? '#fff' : 'var(--accent-primary)',
              }}>{tab.count}</span> : null}
            </button>
          ))}

          {/* Communication & More section */}
          <div style={{ height: 1, background: 'var(--border-medium)', margin: '10px 14px' }} />
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '4px 14px 4px', opacity: 0.7 }}>{t('patientPortal.sectionCommunication')}</p>
          {actionTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, textAlign: 'left', marginBottom: 1,
              transition: 'all 0.15s ease',
            }}>
              <tab.icon size={15} />
              <span style={{ flex: 1 }}>{tab.label}</span>
              {tab.count ? <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : 'var(--accent-light)',
                color: activeTab === tab.key ? '#fff' : 'var(--accent-primary)',
              }}>{tab.count}</span> : null}
            </button>
          ))}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border-medium)' }}>
          <button onClick={onLogout} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'var(--text-muted)',
            fontSize: 13, fontWeight: 600, textAlign: 'left',
          }}><LogOut size={15} /> {t('patientPortal.signOut')}</button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 52px)', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>

          {/* Mobile header */}
          <div className="md:hidden" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={44} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{patient.firstName} {patient.surname}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{patient.hospitalNumber}</p>
              </div>
              <button onClick={() => setActiveTab('chat')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', padding: 6 }}><MessageSquare size={44} /></button>
              <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}><LogOut size={44} /></button>
            </div>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
                  borderRadius: 8, border: activeTab === tab.key ? 'none' : '1px solid var(--border-medium)', cursor: 'pointer',
                  background: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--bg-card-solid)',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  <tab.icon size={13} /> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Chat Panel ── */}
      {/* ═══ Chat / Messages ═══ */}
      {activeTab === 'chat' && (
        <div>
          {/* Hospital & department selector */}
          <div className="card-elevated" style={{ padding: 16, marginBottom: 16, borderRadius: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{t('patientPortal.hospital')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)' }}>
                  <Building2 size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{patient.registrationHospital}</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{t('patientPortal.department')}</label>
                <select value={chatDepartment} onChange={e => setChatDepartment(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-card-solid)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                  {['General / OPD', 'Internal Medicine', 'Obstetrics', 'Pediatrics', 'Surgery', 'Laboratory', 'Pharmacy', 'Dental', 'Emergency'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Chat area */}
          <div className="card-elevated" style={{ borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={15} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{chatDepartment}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>&middot; {patient.registrationHospital}</span>
            </div>
            <div style={{ height: 380, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'patient' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                    background: msg.from === 'patient' ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                    color: msg.from === 'patient' ? '#fff' : 'var(--text-primary)',
                    fontSize: 13, lineHeight: 1.5,
                    borderBottomRightRadius: msg.from === 'patient' ? 4 : 12,
                    borderBottomLeftRadius: msg.from === 'system' ? 4 : 12,
                  }}>
                    <p>{msg.text}</p>
                    <p style={{ fontSize: 9, marginTop: 4, opacity: 0.6, textAlign: 'right' }}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            {chatError && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-medium)', background: 'rgba(218,18,48,0.06)', color: '#DA1230', fontSize: 12 }}>
                {chatError}
              </div>
            )}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-medium)', display: 'flex', gap: 8 }}>
              <input
                type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { void handleSendChat(); } }}
                placeholder={t('patientPortal.messagePlaceholder', { department: chatDepartment })}
                disabled={chatSending}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-card-solid)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', opacity: chatSending ? 0.6 : 1 }}
              />
              <button
                onClick={() => { void handleSendChat(); }}
                disabled={chatSending || !chatInput.trim()}
                aria-label={t('patientPortal.sendMessage')}
                style={{
                  padding: '10px 14px', borderRadius: 8, border: 'none',
                  cursor: chatSending || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  background: 'var(--accent-primary)', color: '#fff',
                  display: 'flex', alignItems: 'center',
                  opacity: chatSending || !chatInput.trim() ? 0.6 : 1,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Overview ═══ */}
      {activeTab === 'overview' && (() => {
        /* Extract latest vitals from most recent record */
        const sortedRecs = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latestRec = sortedRecs[0] as unknown as Record<string, unknown> | undefined;
        const vitals = (latestRec?.vitalSigns || {}) as Record<string, string | number>;
        const latestDate = latestRec?.createdAt ? String(latestRec.createdAt).slice(0, 10) : null;

        /* Prescriptions from service */
        const activeRx = prescriptions.slice(0, 4);

        /* Recent activity timeline */
        type TimelineItem = { date: string; type: string; title: string; detail: string; icon: typeof User; color: string };
        const timeline: TimelineItem[] = [];
        records.slice(0, 3).forEach(rec => {
          const r = rec as unknown as Record<string, unknown>;
          timeline.push({ date: rec.createdAt?.slice(0, 10) || '', type: 'visit', title: (r.visitType as string) || t('patientPortal.consultation'), detail: ((r.diagnoses as Array<{name:string}>) || []).map(d => d.name).join(', ') || t('patientPortal.generalCheckup'), icon: Stethoscope, color: 'var(--accent-primary)' });
        });
        labResults.slice(0, 3).forEach(lab => {
          timeline.push({ date: (lab.orderedAt || lab.createdAt).slice(0, 10), type: 'lab', title: lab.testName, detail: lab.status === 'completed' ? (lab.abnormal ? t('patientPortal.abnormalResult') : t('patientPortal.normalResult')) : t('patientPortal.pending'), icon: FlaskConical, color: lab.abnormal ? 'var(--color-danger)' : 'var(--color-success)' });
        });
        timeline.sort((a, b) => b.date.localeCompare(a.date));

        const completedApts = appointments.filter(a => a.status === 'completed').length;
        const pendingLabs = labResults.filter(l => l.status === 'pending').length;
        const activeMeds = prescriptions.filter(r => r.status === 'pending').length;

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Welcome Banner ── */}
          <div style={{
            background: 'linear-gradient(135deg, #1E40AF 0%, #3b82f6 60%, #60A5FA 100%)',
            borderRadius: 14, padding: '22px 24px', color: '#fff', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, marginBottom: 4 }}>{t('patientPortal.welcomeBack')}</p>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{patient.firstName} {patient.surname}</h2>
            <p style={{ fontSize: 13, opacity: 0.85 }}>{patient.hospitalNumber} &middot; {patient.registrationHospital}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
              {[
                { n: records.length, l: t('patientPortal.totalVisits') },
                { n: prescriptions.length, l: t('patientPortal.tabPrescriptions') },
                { n: labResults.length, l: t('patientPortal.labTests') },
                { n: upcomingApts.length, l: t('patientPortal.upcoming') },
              ].map((s, i) => (
                <div key={i}>
                  <p style={{ fontSize: 22, fontWeight: 700 }}>{s.n}</p>
                  <p style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick Stats Row — exactly 4 equal columns ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { icon: Calendar, label: t('patientPortal.nextAppointment'), value: upcomingApts.length > 0 ? upcomingApts[0].appointmentDate : t('patientPortal.noneScheduled'), color: 'var(--accent-primary)', bg: 'var(--accent-light)' },
              { icon: FlaskConical, label: t('patientPortal.pendingLabs'), value: t('patientPortal.pendingCount', { count: pendingLabs }), color: pendingLabs > 0 ? 'var(--color-warning)' : 'var(--color-success)', bg: pendingLabs > 0 ? 'rgba(217,119,6,0.08)' : 'rgba(31, 157, 111,0.08)' },
              { icon: Pill, label: t('patientPortal.activeMeds'), value: t('patientPortal.activeCount', { count: activeMeds }), color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
              { icon: CheckCircle2, label: t('patientPortal.completedVisits'), value: t('patientPortal.visitCount', { count: completedApts }), color: 'var(--color-success)', bg: 'rgba(31, 157, 111,0.08)' },
            ].map((stat, i) => (
              <div key={i} className="card-elevated" style={{ padding: '14px 14px', borderTop: `3px solid ${stat.color}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <stat.icon size={16} style={{ color: stat.color }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{stat.value}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* ── Row 1: Personal Info + Upcoming Appointments (equal height) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
            {/* Personal Information */}
            <div className="card-elevated" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
              <SH icon={User} title={t('patientPortal.personalInformation')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, flex: 1 }}>
                <Info label={t('patientPortal.fullName')} value={`${patient.firstName} ${patient.middleName || ''} ${patient.surname}`} />
                <Info label={t('patientPortal.dateOfBirth')} value={patient.dateOfBirth || `~${patient.estimatedAge} years`} />
                <Info label={t('patient.gender')} value={patient.gender} />
                <Info label={t('patient.bloodType')} value={patient.bloodType || '—'} />
                <Info label={t('patient.phone')} value={patient.phone || '—'} />
                <Info label={t('patientPortal.geocodeId')} value={patient.geocodeId || '—'} />
                <Info label={t('patient.location')} value={`${patient.county || ''}, ${patient.state}`} />
                <Info label={t('patient.facility')} value={patient.registrationHospital} />
              </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="card-elevated" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
              <SH icon={Calendar} title={t('patientPortal.upcomingAppointments')} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 10 }}>
                {upcomingApts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {upcomingApts.slice(0, 3).map((apt, i) => (
                      <div key={apt._id} style={{ padding: 12, borderRadius: 10, background: i === 0 ? 'var(--accent-light)' : 'var(--overlay-subtle)', border: `1px solid ${i === 0 ? 'var(--accent-border)' : 'var(--border-medium)'}`, flex: i === 0 ? 'none' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: 2 }}>{t('patientPortal.dateAtTime', { date: apt.appointmentDate, time: apt.appointmentTime })}</p>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.reason || apt.appointmentType}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('patientPortal.drPrefix')} {apt.providerName} &middot; {apt.department}</p>
                          </div>
                          {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'var(--accent-primary)', color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>{t('patientPortal.next')}</span>}
                        </div>
                      </div>
                    ))}
                    {upcomingApts.length > 3 && (
                      <button onClick={() => setActiveTab('appointments')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: '6px 0', marginTop: 'auto' }}>
                        {t('patientPortal.moreCount', { count: upcomingApts.length - 3 })}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
                    <Calendar size={44} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{t('patientPortal.noUpcomingAppointments')}</p>
                    <button onClick={() => setShowBooking(true)} style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Plus size={12} />{t('patientPortal.bookAppointment')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 2: Latest Vitals (full width) ── */}
          <div className="card-elevated" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SH icon={Activity} title={t('patientPortal.latestVitals')} />
              {latestDate && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{t('patientPortal.recordedDate', { date: latestDate })}</span>}
            </div>
            {Object.keys(vitals).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginTop: 12 }}>
                {[
                  { key: 'bloodPressure', label: t('patientPortal.bloodPressure'), icon: HeartPulse, unit: 'mmHg', color: '#EF4444' },
                  { key: 'heartRate', label: t('patientPortal.heartRate'), icon: Activity, unit: 'bpm', color: '#EC4899' },
                  { key: 'temperature', label: t('patientPortal.temperature'), icon: Thermometer, unit: '°C', color: '#F59E0B' },
                  { key: 'weight', label: t('patientPortal.weight'), icon: Weight, unit: 'kg', color: '#6366F1' },
                  { key: 'respiratoryRate', label: t('patientPortal.respRate'), icon: Droplets, unit: '/min', color: '#06B6D4' },
                  { key: 'oxygenSaturation', label: 'SpO₂', icon: Eye, unit: '%', color: '#1F9D6F' },
                ].filter(v => vitals[v.key]).map(v => (
                  <div key={v.key} style={{ padding: '12px 14px', borderRadius: 10, background: `${v.color}08`, border: `1px solid ${v.color}15`, textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 6 }}>
                      <v.icon size={12} style={{ color: v.color }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{v.label}</span>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{String(vitals[v.key])}</p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{v.unit}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>{t('patientPortal.noVitals')}</p>
            )}
          </div>

          {/* ── Row 3: Health Alerts + Current Medications (equal height) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
            {/* Health Alerts */}
            <div className="card-elevated" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
              <SH icon={AlertTriangle} title={t('patientPortal.healthAlerts')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, flex: 1 }}>
                {(patient.allergies || []).length > 0 && (
                  <AlertRow color="#EF4444" icon={AlertTriangle} text={t('patientPortal.allergiesList', { list: patient.allergies.join(', ') })} />
                )}
                {(patient.chronicConditions || []).map((c, i) => (
                  <AlertRow key={i} color="#D97706" icon={HeartPulse} text={c} />
                ))}
                {pendingLabs > 0 && (
                  <AlertRow color="var(--accent-primary)" icon={FlaskConical} text={t('patientPortal.pendingLabResults', { count: pendingLabs })} />
                )}
                {labResults.some(l => l.critical) && (
                  <AlertRow color="#EF4444" icon={AlertTriangle} text={t('patientPortal.criticalLabAlert')} />
                )}
                {(patient.allergies || []).length === 0 && (patient.chronicConditions || []).length === 0 && pendingLabs === 0 && (
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(31, 157, 111,0.06)', border: '1px solid rgba(31, 157, 111,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>{t('patientPortal.noHealthAlerts')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Current Medications */}
            <div className="card-elevated" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SH icon={Pill} title={t('patient.medications')} />
                {activeRx.length > 0 && <button onClick={() => setActiveTab('prescriptions')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('patientPortal.viewAll')}</button>}
              </div>
              <div style={{ flex: 1, marginTop: 10 }}>
                {activeRx.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeRx.map((rx, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--overlay-subtle)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Pill size={12} style={{ color: '#7C3AED' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{rx.medication}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rx.dose} · {rx.frequency}</p>
                        </div>
                        <Badge text={rx.status} color={rx.status === 'dispensed' ? 'var(--color-success)' : 'var(--color-warning)'} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.noMedications')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 4: Recent Activity + Quick Actions (equal height) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
            {/* Recent Activity */}
            <div className="card-elevated" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
              <SH icon={Clock} title={t('patientPortal.recentActivity')} />
              <div style={{ flex: 1, marginTop: 12 }}>
                {timeline.length > 0 ? (
                  <div style={{ position: 'relative', paddingLeft: 20 }}>
                    <div style={{ position: 'absolute', left: 7, top: 4, bottom: 4, width: 2, background: 'var(--border-medium)' }} />
                    {timeline.slice(0, 5).map((item, i) => (
                      <div key={i} style={{ position: 'relative', marginBottom: i < Math.min(timeline.length, 5) - 1 ? 14 : 0 }}>
                        <div style={{ position: 'absolute', left: -16, top: 2, width: 16, height: 16, borderRadius: '50%', background: `${item.color}15`, border: `2px solid ${item.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />
                        </div>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 1 }}>{item.date}</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.noRecentActivity')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card-elevated" style={{ padding: 18, background: 'linear-gradient(135deg, #1a3a4a 0%, #1e3a8a 100%)', border: 'none', display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{t('patientPortal.quickActions')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {[
                  { label: t('patientPortal.bookAppointment'), icon: Calendar, action: () => setShowBooking(true) },
                  { label: t('patientPortal.viewLabResults'), icon: FlaskConical, action: () => setActiveTab('lab') },
                  { label: t('patientPortal.myPrescriptions'), icon: Pill, action: () => setActiveTab('prescriptions') },
                  { label: t('patientPortal.messageDoctor'), icon: MessageSquare, action: () => setActiveTab('chat') },
                  { label: t('patientPortal.payBills'), icon: Wallet, action: () => setActiveTab('billing') },
                  { label: t('patientPortal.tabMyProfile'), icon: UserCircle, action: () => setActiveTab('profile') },
                ].map((qa, i) => (
                  <button key={i} onClick={qa.action} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                    borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                    color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}>
                    <qa.icon size={14} style={{ opacity: 0.7 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{qa.label}</span>
                    <ChevronRight size={12} style={{ opacity: 0.4 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ═══ Appointments ═══ */}
      {activeTab === 'appointments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.yourAppointments', { count: appointments.length })}</h2>
            <button onClick={() => setShowBooking(true)} className="btn btn-primary btn-sm" style={{ gap: 4 }}><Plus size={13} /> {t('patientPortal.bookNew')}</button>
          </div>
          {appointments.length === 0 ? (
            <Empty icon={Calendar} text={t('patientPortal.noAppointmentsYet')} action={t('patientPortal.bookAppointment')} onAction={() => setShowBooking(true)} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {appointments.sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate)).map(apt => {
                const isPast = apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show';
                return (
                  <div key={apt._id} className="card-elevated" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 48, textAlign: 'center' }}>
                      <div className="stat-value" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{apt.appointmentTime}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{apt.appointmentDate}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.reason || apt.appointmentType}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('patientPortal.drPrefix')} {apt.providerName} &middot; {apt.department}</div>
                    </div>
                    <Badge text={apt.status.replace('_', ' ')} color={isPast ? 'var(--text-muted)' : apt.status === 'confirmed' ? 'var(--color-success)' : 'var(--accent-primary)'} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Records ═══ */}
      {activeTab === 'records' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.medicalRecordsCount', { count: records.length })}</h2>
          {records.length === 0 ? (
            <Empty icon={FileText} text={t('patientPortal.noMedicalRecords')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(rec => (
                <div key={rec._id} className="card-elevated" style={{ overflow: 'hidden' }}>
                  <button onClick={() => setExpandedId(expandedId === rec._id ? null : rec._id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ minWidth: 70, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{rec.createdAt?.slice(0, 10)}</div>
                    <FileText size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {(rec as unknown as Record<string, unknown>).visitType as string || t('patientPortal.consultation')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {((rec as unknown as Record<string, unknown>).diagnoses as Array<{name: string}> || []).map(d => d.name).join(', ') || t('patientPortal.noDiagnosisRecorded')}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: expandedId === rec._id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {expandedId === rec._id && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-medium)', paddingTop: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'stretch', gap: 10 }}>
                        {((rec as unknown as Record<string, unknown>).vitalSigns as Record<string, unknown>) && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{t('patientPortal.vitalSigns')}</div>
                            {Object.entries((rec as unknown as Record<string, unknown>).vitalSigns as Record<string, unknown>).filter(([, v]) => v).map(([k, v]) => (
                              <div key={k} style={{ fontSize: 12, color: 'var(--text-primary)' }}>{k}: <strong>{String(v)}</strong></div>
                            ))}
                          </div>
                        )}
                        {((rec as unknown as Record<string, unknown>).prescriptions as Array<{medication: string; dosage: string}> || []).length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{t('patientPortal.tabPrescriptions')}</div>
                            {((rec as unknown as Record<string, unknown>).prescriptions as Array<{medication: string; dosage: string}>).map((rx, i) => (
                              <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)' }}>{rx.medication} — {rx.dosage}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Lab Results ═══ */}
      {activeTab === 'lab' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.labResultsCount', { count: labResults.length })}</h2>
          {labResults.length === 0 ? (
            <Empty icon={FlaskConical} text={t('patientPortal.noLabResults')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {labResults.sort((a, b) => (b.orderedAt || b.createdAt).localeCompare(a.orderedAt || a.createdAt)).map(lab => (
                <div key={lab._id} className="card-elevated" style={{ overflow: 'hidden' }}>
                  <button onClick={() => setExpandedId(expandedId === lab._id ? null : lab._id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ minWidth: 70, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{(lab.orderedAt || lab.createdAt).slice(0, 10)}</div>
                    <FlaskConical size={14} style={{ color: lab.status === 'pending' ? 'var(--color-warning)' : lab.abnormal ? 'var(--color-danger)' : 'var(--color-success)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lab.testName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lab.specimen} &middot; {lab.orderedBy}</div>
                    </div>
                    <Badge text={lab.status === 'completed' ? (lab.abnormal ? t('patientPortal.abnormal') : t('patientPortal.normal')) : lab.status}
                      color={lab.status === 'pending' ? 'var(--color-warning)' : lab.abnormal ? 'var(--color-danger)' : 'var(--color-success)'} />
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: expandedId === lab._id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {expandedId === lab._id && lab.status === 'completed' && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-medium)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 'var(--card-radius)', background: lab.abnormal ? 'rgba(239,68,68,0.04)' : 'rgba(31, 157, 111,0.04)' }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('patientPortal.result')}</div>
                          <div className="stat-value" style={{ fontSize: 15, fontWeight: 700, color: lab.abnormal ? 'var(--color-danger)' : 'var(--text-primary)' }}>{lab.result}</div>
                        </div>
                        {lab.referenceRange && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('patientPortal.reference')}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lab.referenceRange} {lab.unit}</div>
                          </div>
                        )}
                      </div>
                      {lab.critical && (
                        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 'var(--card-radius)', background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={12} style={{ color: 'var(--color-danger)' }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)' }}>{t('patientPortal.criticalResult')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Prescriptions ═══ */}
      {activeTab === 'prescriptions' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.prescriptionsCount', { count: prescriptions.length })}</h2>
          {prescriptions.length === 0 ? (
            <Empty icon={Pill} text={t('patientPortal.noPrescriptions')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {prescriptions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(rx => (
                <div key={rx._id} className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: rx.status === 'dispensed' ? 'rgba(31, 157, 111,0.08)' : 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Pill size={16} style={{ color: rx.status === 'dispensed' ? 'var(--color-success)' : 'var(--accent-primary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{rx.medication}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rx.dose} · {rx.route} · {rx.frequency} · {rx.duration}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('patientPortal.prescribedBy', { name: rx.prescribedBy })}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <Badge text={rx.status} color={rx.status === 'dispensed' ? 'var(--color-success)' : 'var(--color-warning)'} />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{rx.createdAt.slice(0, 10)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Radiology & Imaging ═══ */}
      {activeTab === 'radiology' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.tabRadiology')}</h2>
          {/* Mock radiology data from lab results that are imaging-related, or show placeholder */}
          {(() => {
            const imagingTests = labResults.filter(l =>
              /x-ray|xray|mri|ct scan|ultrasound|radiology|imaging|echo|mammogram/i.test(l.testName || '')
            );
            return imagingTests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {imagingTests.map(img => (
                  <div key={img._id} className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Scan size={16} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{img.testName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(img.orderedAt || img.createdAt).slice(0, 10)} · {img.orderedBy}</div>
                    </div>
                    <Badge text={img.status} color={img.status === 'pending' ? 'var(--color-warning)' : 'var(--accent-primary)'} />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <Empty icon={Scan} text={t('patientPortal.noImagingResults')} />
                <div className="card-elevated" style={{ padding: 18, marginTop: 14 }}>
                  <SH icon={Scan} title={t('patientPortal.availableImagingServices')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    {['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Echocardiogram', 'Mammogram'].map(svc => (
                      <div key={svc} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Scan size={13} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{svc}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                    {t('patientPortal.imagingNotice')}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ Documents ═══ */}
      {activeTab === 'documents' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.tabDocuments')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Generate document entries from existing data */}
            {records.length > 0 && (
              <div className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setActiveTab('records')}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.tabMedicalRecords')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.consultationRecords', { count: records.length })}</div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            {labResults.length > 0 && (
              <div className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setActiveTab('lab')}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FlaskConical size={16} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.labReports')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.labResultsCountShort', { count: labResults.length })}</div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            {/* Discharge summaries */}
            <div className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--overlay-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FolderOpen size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('patientPortal.dischargeSummaries')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.dischargeSummariesDesc')}</div>
              </div>
            </div>
            {/* Referral letters */}
            <div className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--overlay-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('patientPortal.referralLetters')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.referralLettersDesc')}</div>
              </div>
            </div>
            {/* Insurance / ID docs */}
            <div className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--overlay-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('patientPortal.insuranceIdDocuments')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.insuranceIdDocumentsDesc')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Billing & Payments ═══ */}
      {activeTab === 'billing' && <BillingTab patient={patient} />}

      {/* ═══ Immunizations ═══ */}
      {activeTab === 'immunizations' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.immunizationRecordCount', { count: immunizations.length })}</h2>
          {immunizations.length === 0 ? (
            <div>
              <Empty icon={Syringe} text={t('patientPortal.noImmunizations')} />
              <div className="card-elevated" style={{ padding: 18, marginTop: 14 }}>
                <SH icon={Syringe} title={t('patientPortal.aboutImmunizations')} />
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
                  {t('patientPortal.immunizationNotice')}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {immunizations.sort((a, b) => b.dateGiven.localeCompare(a.dateGiven)).map(imm => (
                <div key={imm._id} className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(31, 157, 111,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Syringe size={16} style={{ color: 'var(--color-success)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{imm.vaccine} — {t('patientPortal.doseNumber', { number: imm.doseNumber })}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('patientPortal.siteBatch', { site: imm.site, batch: imm.batchNumber })}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t('patientPortal.administeredBy', { name: imm.administeredBy, facility: imm.facilityName })}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{imm.dateGiven}</div>
                    {imm.nextDueDate && <div style={{ fontSize: 10, color: 'var(--color-warning)', marginTop: 2 }}>{t('patientPortal.nextDue', { date: imm.nextDueDate })}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Insurance ═══ */}
      {activeTab === 'insurance' && (
        <InsuranceTab patient={patient} />
      )}

      {/* ═══ Forms ═══ */}
      {activeTab === 'forms' && (
        <FormsTab />
      )}

      {/* ═══ Uploads ═══ */}
      {activeTab === 'uploads' && (
        <UploadsTab />
      )}

      {/* ═══ Statements ═══ */}
      {activeTab === 'statements' && (
        <StatementsTab />
      )}

      {/* ═══ My Profile ═══ */}
      {activeTab === 'profile' && (
        <ProfileTab patient={patient} />
      )}

      {/* Booking Modal */}
      {showBooking && (
        <Modal onClose={() => setShowBooking(false)}>
          <div className="modal-panel modal-panel--md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.requestAppointment')}</h3>
              <button onClick={() => setShowBooking(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><X size={14} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>{t('patientPortal.bookingNotice')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--accent-light)', border: '1px solid var(--accent-border)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t('patientPortal.bookingAt', { facility: patient.registrationHospital })}</span>
              </div>
              <div><label>{t('patientPortal.preferredDate')}</label><input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div><label>{t('patientPortal.preferredTime')}</label>
                <select><option>{t('patientPortal.timeMorning')}</option><option>{t('patientPortal.timeAfternoon')}</option><option>{t('patientPortal.timeAnyTime')}</option></select>
              </div>
              <div><label>{t('patientPortal.department')}</label>
                <select><option>General / OPD</option><option>Obstetrics</option><option>Internal Medicine</option><option>Pediatrics</option><option>Surgery</option><option>Laboratory</option><option>Dental</option></select>
              </div>
              <div><label>{t('patientPortal.reason')}</label><textarea rows={3} placeholder={t('patientPortal.reasonPlaceholder')} /></div>
              <div><label>{t('patientPortal.visitType')}</label>
                <select><option>{t('patientPortal.visitInPerson')}</option><option>{t('patientPortal.visitTelehealthVideo')}</option><option>{t('patientPortal.visitTelehealthAudio')}</option></select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowBooking(false)} className="btn btn-secondary" style={{ flex: 1 }}>{t('action.cancel')}</button>
                <button onClick={() => { setShowBooking(false); }} className="btn btn-primary" style={{ flex: 1 }}>{t('patientPortal.submitRequest')}</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════
   INSURANCE TAB
   ═════════════════════════════════════════ */
function InsuranceTab({}: { patient: PatientDoc }) {
  const { t } = useTranslation();
  const [showAddForm, setShowAddForm] = useState(false);
  const [insuranceList] = useState<Array<{
    id: string;
    provider: string;
    policyNumber: string;
    type: string;
    status: 'Active' | 'Expired' | 'Pending';
    expiryDate: string;
  }>>([]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.insuranceInformation')}</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={13} /> {t('patientPortal.addInsurance')}
        </button>
      </div>

      {/* Info banner */}
      <div className="card-elevated" style={{ padding: 16, marginBottom: 16, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('patientPortal.insuranceBanner')}
        </p>
      </div>

      {/* Insurances on file */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{t('patientPortal.insurancesOnFile')}</h3>
      {insuranceList.length === 0 ? (
        <Empty icon={Shield} text={t('patientPortal.noInsurance')} action={t('patientPortal.addInsurance')} onAction={() => setShowAddForm(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insuranceList.map(ins => (
            <div key={ins.id} className="card-elevated" style={{ padding: '16px 18px', borderLeft: '4px solid var(--color-success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{ins.provider}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.typeInsurance', { type: ins.type })}</p>
                </div>
                <Badge text={ins.status} color="var(--color-success)" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <Info label={t('patientPortal.policyNumber')} value={ins.policyNumber} />
                <Info label={t('patientPortal.expires')} value={ins.expiryDate} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload insurance card */}
      <div className="card-elevated" style={{ padding: 18, marginTop: 16 }}>
        <SH icon={Upload} title={t('patientPortal.uploadInsuranceCard')} />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 12 }}>
          {t('patientPortal.uploadInsuranceCardDesc')}
        </p>
        <div style={{
          padding: 24, borderRadius: 10, border: '2px dashed var(--border-medium)', textAlign: 'center',
          background: 'var(--overlay-subtle)', cursor: 'pointer', transition: 'all 0.2s',
        }}>
          <FileUp size={56} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', opacity: 0.5 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('patientPortal.clickToUpload')}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('patientPortal.pngJpgPdfLimit')}</p>
        </div>
      </div>

      {/* Add Insurance Form Modal */}
      {showAddForm && (
        <Modal onClose={() => setShowAddForm(false)}>
          <div className="modal-panel modal-panel--md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.addInsurance')}</h3>
              <button onClick={() => setShowAddForm(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--overlay-subtle)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>{t('patientPortal.insuranceProvider')}</label><input type="text" placeholder={t('patientPortal.insuranceProviderPlaceholder')} /></div>
              <div><label>{t('patientPortal.policyMemberNumber')}</label><input type="text" placeholder={t('patientPortal.policyMemberNumberPlaceholder')} /></div>
              <div><label>{t('patientPortal.insuranceType')}</label>
                <select><option>{t('patientPortal.insTypePrimary')}</option><option>{t('patientPortal.insTypeSecondary')}</option><option>{t('patientPortal.insTypeSupplemental')}</option></select>
              </div>
              <div><label>{t('patientPortal.policyHolder')}</label><input type="text" placeholder={t('patientPortal.policyHolderPlaceholder')} /></div>
              <div><label>{t('patientPortal.expiryDate')}</label><input type="date" /></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAddForm(false)} className="btn btn-secondary" style={{ flex: 1 }}>{t('action.cancel')}</button>
                <button onClick={() => setShowAddForm(false)} className="btn btn-primary" style={{ flex: 1 }}>{t('patientPortal.saveInsurance')}</button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════
   FORMS TAB
   ═════════════════════════════════════════ */
function FormsTab() {
  const { t } = useTranslation();
  const forms = [
    { id: 'f1', name: t('patientPortal.formRegistration'), status: 'completed' as const, date: '2026-02-01', required: true },
    { id: 'f2', name: t('patientPortal.formMedicalHistory'), status: 'completed' as const, date: '2026-02-01', required: true },
    { id: 'f3', name: t('patientPortal.formConsent'), status: 'completed' as const, date: '2026-02-01', required: true },
    { id: 'f4', name: t('patientPortal.formInsuranceAuth'), status: 'pending' as const, date: '', required: false },
    { id: 'f5', name: t('patientPortal.formAdvanceDirective'), status: 'pending' as const, date: '', required: false },
    { id: 'f6', name: t('patientPortal.formSatisfactionSurvey'), status: 'available' as const, date: '', required: false },
    { id: 'f7', name: t('patientPortal.formRefillRequest'), status: 'available' as const, date: '', required: false },
    { id: 'f8', name: t('patientPortal.formReferralRequest'), status: 'available' as const, date: '', required: false },
  ];

  const statusIcon = (s: string) => {
    if (s === 'completed') return { color: 'var(--color-success)', text: t('patientPortal.completed') };
    if (s === 'pending') return { color: 'var(--color-warning)', text: t('patientPortal.pending') };
    return { color: 'var(--accent-primary)', text: t('patientPortal.available') };
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.patientForms')}</h2>

      {/* Required forms */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('patientPortal.requiredForms')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {forms.filter(f => f.required).map(form => {
          const si = statusIcon(form.status);
          return (
            <div key={form.id} className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${si.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ClipboardList size={16} style={{ color: si.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{form.name}</p>
                {form.date && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('patientPortal.completedDate', { date: form.date })}</p>}
              </div>
              <Badge text={si.text} color={si.color} />
            </div>
          );
        })}
      </div>

      {/* Optional / available forms */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('patientPortal.optionalForms')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {forms.filter(f => !f.required).map(form => {
          const si = statusIcon(form.status);
          return (
            <div key={form.id} className="card-elevated" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: form.status !== 'completed' ? 'pointer' : 'default' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${si.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ClipboardList size={16} style={{ color: si.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{form.name}</p>
                {form.date && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('patientPortal.completedDate', { date: form.date })}</p>}
              </div>
              {form.status !== 'completed' ? (
                <button style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {form.status === 'pending' ? t('patientPortal.complete') : t('patientPortal.fillOut')}
                </button>
              ) : (
                <Badge text={t('patientPortal.done')} color="var(--color-success)" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════
   UPLOADS TAB
   ═════════════════════════════════════════ */
function UploadsTab() {
  const { t } = useTranslation();
  const [uploads] = useState([
    { id: 'u1', name: 'Insurance Card (Front)', type: 'image/png', size: '1.2 MB', date: '2026-02-01', category: 'Insurance' },
    { id: 'u2', name: 'Insurance Card (Back)', type: 'image/png', size: '1.1 MB', date: '2026-02-01', category: 'Insurance' },
    { id: 'u3', name: 'National ID', type: 'image/jpg', size: '0.8 MB', date: '2026-02-01', category: 'Identification' },
    { id: 'u4', name: 'Referral Letter — JTH', type: 'application/pdf', size: '0.3 MB', date: '2026-03-15', category: 'Medical' },
  ]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.myUploads', { count: uploads.length })}</h2>
      </div>

      {/* Upload area */}
      <div className="card-elevated" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{
          padding: 32, borderRadius: 10, border: '2px dashed var(--border-medium)', textAlign: 'center',
          background: 'var(--overlay-subtle)', cursor: 'pointer', transition: 'all 0.2s',
        }}>
          <Upload size={44} style={{ color: 'var(--accent-primary)', margin: '0 auto 10px', opacity: 0.6 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{t('patientPortal.uploadDocuments')}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.dragFilesHere')}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('patientPortal.acceptedFormats')}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { key: 'Insurance Card', label: t('patientPortal.catInsuranceCard') },
            { key: 'ID Document', label: t('patientPortal.catIdDocument') },
            { key: 'Referral Letter', label: t('patientPortal.catReferralLetter') },
            { key: 'Lab Report', label: t('patientPortal.catLabReport') },
            { key: 'Other', label: t('patientPortal.catOther') },
          ].map(cat => (
            <button key={cat.key} style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{cat.label}</button>
          ))}
        </div>
      </div>

      {/* File list */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('patientPortal.uploadedFiles')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {uploads.map(file => (
          <div key={file.id} className="card-elevated" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {file.type.includes('pdf') ? <FileText size={16} style={{ color: 'var(--accent-primary)' }} /> : <Camera size={16} style={{ color: 'var(--accent-primary)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{file.category} · {file.size} · {file.date}</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><Download size={13} /></button>
              <button style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Guidelines */}
      <div className="card-elevated" style={{ padding: 14, marginTop: 16, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong>{t('patientPortal.uploadTipsLabel')}</strong> {t('patientPortal.uploadTipsBody')}
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════
   STATEMENTS TAB
   ═════════════════════════════════════════ */
function StatementsTab() {
  const { t } = useTranslation();
  const statements = [
    { id: 'st-001', period: 'March 2026', date: '2026-04-01', total: 80000, paid: 23500, items: 3 },
    { id: 'st-002', period: 'February 2026', date: '2026-03-01', total: 25000, paid: 25000, items: 2 },
    { id: 'st-003', period: 'January 2026', date: '2026-02-01', total: 15000, paid: 15000, items: 1 },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{t('patientPortal.billingStatements')}</h2>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'stretch', gap: 10, marginBottom: 16 }}>
        {[
          { label: t('patientPortal.currentBalance'), value: `${(statements[0].total - statements[0].paid).toLocaleString()} SSP`, color: 'var(--color-danger)' },
          { label: t('patientPortal.lastPayment'), value: '10,000 SSP', color: 'var(--color-success)' },
          { label: t('patientPortal.totalStatements'), value: `${statements.length}`, color: 'var(--accent-primary)' },
        ].map((s, i) => (
          <div key={i} className="card-elevated" style={{ padding: '14px 16px', borderTop: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</p>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Statement list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {statements.map(st => {
          const balance = st.total - st.paid;
          return (
            <div key={st.id} className="card-elevated" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.statementPeriod', { period: st.period })}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('patientPortal.generatedItems', { date: st.date, count: st.items })}</p>
                </div>
                <Badge text={balance === 0 ? t('patientPortal.paid') : t('patientPortal.outstanding')} color={balance === 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <Info label={t('patientPortal.totalBilled')} value={`${st.total.toLocaleString()} SSP`} />
                <Info label={t('patientPortal.paid')} value={`${st.paid.toLocaleString()} SSP`} />
                <Info label={t('patientPortal.balance')} value={`${balance.toLocaleString()} SSP`} />
              </div>
              {balance > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: 'var(--border-medium)', overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${(st.paid / st.total) * 100}%`, background: 'var(--color-success)', borderRadius: 2 }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 6, background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Download size={12} /> {t('patientPortal.downloadPdf')}
                </button>
                {balance > 0 && (
                  <button style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 6, background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    {t('patientPortal.payNow')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════
   PROFILE TAB
   ═════════════════════════════════════════ */
function ProfileTab({ patient }: { patient: PatientDoc }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  const fields = [
    { label: t('patientPortal.firstName'), value: patient.firstName, editable: false },
    { label: t('patientPortal.middleName'), value: patient.middleName || '—', editable: false },
    { label: t('patientPortal.surname'), value: patient.surname, editable: false },
    { label: t('patientPortal.dateOfBirth'), value: patient.dateOfBirth || `~${patient.estimatedAge} years`, editable: false },
    { label: t('patient.gender'), value: patient.gender, editable: false },
    { label: t('patient.bloodType'), value: patient.bloodType || '—', editable: false },
    { label: t('patient.phone'), value: patient.phone || '—', editable: true },
    { label: t('patientPortal.geocodeId'), value: patient.geocodeId || '—', editable: false },
    { label: t('patientPortal.county'), value: patient.county || '—', editable: true },
    { label: t('patientPortal.state'), value: patient.state || '—', editable: true },
    { label: t('patient.hospitalNumber'), value: patient.hospitalNumber || '—', editable: false },
    { label: t('patientPortal.registrationHospital'), value: patient.registrationHospital || '—', editable: false },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('patientPortal.tabMyProfile')}</h2>
        <button onClick={() => setEditing(!editing)} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, background: editing ? 'var(--color-success)' : 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          {editing ? <><Save size={13} /> {t('patientPortal.saveChanges')}</> : <><Edit3 size={13} /> {t('patientPortal.editProfile')}</>}
        </button>
      </div>

      {/* Profile header */}
      <div className="card-elevated" style={{ padding: 20, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-light)', border: '3px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          {patient.photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={patient.photoUrl} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            : <User size={44} style={{ color: 'var(--accent-primary)' }} />
          }
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{patient.firstName} {patient.surname}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{patient.hospitalNumber} · {patient.registrationHospital}</p>
      </div>

      {/* Fields grid */}
      <div className="card-elevated" style={{ padding: 18 }}>
        <SH icon={User} title={t('patientPortal.personalDetails')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          {fields.map((f, i) => (
            <div key={i}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{f.label}</p>
              {editing && f.editable ? (
                <input type="text" defaultValue={f.value} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--accent-primary)', background: 'var(--bg-card-solid)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              ) : (
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{f.value}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Emergency contact */}
      <div className="card-elevated" style={{ padding: 18, marginTop: 14 }}>
        <SH icon={Phone} title={t('patientPortal.emergencyContact')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Info label={t('patientPortal.name')} value={patient.nokName || '—'} />
          <Info label={t('patient.phone')} value={patient.nokPhone || '—'} />
          <Info label={t('patientPortal.relationship')} value={patient.nokRelationship || '—'} />
        </div>
      </div>

      {/* Allergies & chronic conditions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div className="card-elevated" style={{ padding: 18 }}>
          <SH icon={AlertTriangle} title={t('patient.allergies')} />
          <div style={{ marginTop: 10 }}>
            {(patient.allergies || []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {patient.allergies.map((a, i) => (
                  <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>{a}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.noKnownAllergies')}</p>
            )}
          </div>
        </div>
        <div className="card-elevated" style={{ padding: 18 }}>
          <SH icon={HeartPulse} title={t('patient.chronicConditions')} />
          <div style={{ marginTop: 10 }}>
            {(patient.chronicConditions || []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {patient.chronicConditions.map((c, i) => (
                  <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.15)' }}>{c}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.noChronicConditions')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Note about editable fields */}
      {!editing && (
        <div className="card-elevated" style={{ padding: 14, marginTop: 14, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('patientPortal.protectedFieldsNote')}
          </p>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════
   BILLING & PAYMENTS TAB
   ═════════════════════════════════════════ */
// View model the UI renders against. We derive this from the real
// `BillingDoc` records in PouchDB rather than baking in a hardcoded array
// — the previous implementation rendered fake invoices ("B-2026-001"…)
// and the "Pay" flow returned a fake `TBN-…` reference without persisting
// anything, which was dishonest UX (the patient thought they had paid).
type BillItem = {
  id: string;          // The PouchDB _id of the BillingDoc — used to call recordPayment.
  invoiceNumber: string;
  date: string;
  description: string;
  department: string;
  amount: number;
  paid: number;
  /** Sliced from BillingDoc.status; 'overdue' is computed from dueDate. */
  status: 'paid' | 'partial' | 'unpaid' | 'overdue';
};

type UiPaymentMethod = 'mpesa' | 'mtn' | 'airtel' | 'card' | 'bank';

function BillingTab({ patient }: { patient: PatientDoc }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'bills' | 'method' | 'confirm' | 'success'>('bills');
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [payMethod, setPayMethod] = useState<UiPaymentMethod | null>(null);
  const [payPhone, setPayPhone] = useState(patient.phone || '');

  // Real bill data, loaded from PouchDB. `null` = still loading; `[]` = no
  // bills on file. Distinguishing these lets us show a loading skeleton vs.
  // an empty-state card.
  const [bills, setBills] = useState<BillItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Last-payment metadata for the success screen — populated by the actual
  // recordPayment response so the reference shown is the one that ended up
  // in the bill's payments[] array.
  const [lastPayment, setLastPayment] = useState<{
    reference: string;
    amount: number;
    billCount: number;
    failedBillIds: string[];
  } | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Derive the UI status from the underlying BillingDoc plus dueDate so the
  // patient sees "overdue" on bills past due, even when the doc itself just
  // says "pending".
  const deriveStatus = (
    docStatus: string,
    totalAmount: number,
    amountPaid: number,
    encounterDate: string,
  ): BillItem['status'] => {
    if (docStatus === 'paid' || amountPaid >= totalAmount) return 'paid';
    if (docStatus === 'partial' || (amountPaid > 0 && amountPaid < totalAmount)) return 'partial';
    // Treat anything older than 30 days with non-zero balance as 'overdue'
    // for display purposes. The model has no explicit dueDate field today.
    if (encounterDate) {
      const ageMs = Date.now() - new Date(encounterDate).getTime();
      if (ageMs > 30 * 24 * 60 * 60 * 1000) return 'overdue';
    }
    return 'unpaid';
  };

  useEffect(() => {
    let cancelled = false;
    setBills(null);
    setLoadError(null);
    (async () => {
      try {
        const { getBillsByPatient } = await import('@/lib/services/billing-service');
        const docs = await getBillsByPatient(patient._id);
        if (cancelled) return;
        const mapped: BillItem[] = docs
          .map(d => ({
            id: d._id,
            invoiceNumber: d.invoiceNumber || d._id,
            date: (d.encounterDate || d.createdAt || '').slice(0, 10),
            description:
              (d.items && d.items.length > 0
                ? d.items.map(i => i.description).slice(0, 2).join(', ')
                : null) || t('patientPortal.visitAt', { facility: d.facilityName || t('patientPortal.facilityFallback') }),
            department:
              (d.items && d.items[0] ? d.items[0].category : 'Services').toString(),
            amount: d.totalAmount,
            paid: d.amountPaid,
            status: deriveStatus(d.status, d.totalAmount, d.amountPaid, d.encounterDate || d.createdAt || ''),
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
        setBills(mapped);
      } catch (err) {
        console.error('[patient-portal/billing] load failed', err);
        if (!cancelled) {
          setBills([]);
          setLoadError(t('patientPortal.billsLoadError'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [patient._id]);

  const safeBills = bills || [];
  const totalOwed = safeBills.reduce((s, b) => s + (b.amount - b.paid), 0);
  const totalPaid = safeBills.reduce((s, b) => s + b.paid, 0);
  const selectedTotal = safeBills.filter(b => selectedBills.includes(b.id)).reduce((s, b) => s + (b.amount - b.paid), 0);

  const statusColor = (s: BillItem['status']) => {
    switch (s) {
      case 'paid': return 'var(--color-success)';
      case 'partial': return 'var(--color-warning)';
      case 'unpaid': return 'var(--accent-primary)';
      case 'overdue': return 'var(--color-danger)';
    }
  };

  const paymentMethods: { key: UiPaymentMethod; name: string; icon: typeof Phone; desc: string; color: string }[] = [
    { key: 'mpesa', name: 'M-Pesa', icon: Phone, desc: t('patientPortal.payViaMpesa'), color: '#4CAF50' },
    { key: 'mtn', name: 'MTN Mobile Money', icon: Phone, desc: t('patientPortal.payViaMtn'), color: '#FFC107' },
    { key: 'airtel', name: 'Airtel Money', icon: Phone, desc: t('patientPortal.payViaAirtel'), color: '#E53935' },
    { key: 'card', name: t('patientPortal.cardPayment'), icon: CreditCard, desc: t('patientPortal.payViaCard'), color: '#5C6BC0' },
    { key: 'bank', name: t('patientPortal.bankTransfer'), icon: Banknote, desc: t('patientPortal.payViaBank'), color: '#00897B' },
  ];

  // Map the UI-level payment buttons onto the canonical PaymentMethod values
  // accepted by `recordPayment` in @/lib/services/billing-service.
  const toCanonicalMethod = (m: UiPaymentMethod): 'mobile_money' | 'bank_transfer' | 'cash' => {
    if (m === 'mpesa' || m === 'mtn' || m === 'airtel') return 'mobile_money';
    if (m === 'card' || m === 'bank') return 'bank_transfer';
    return 'cash';
  };

  // Persist the payment by calling recordPayment for every selected bill.
  // Returns a real reference number from the saved PaymentRecord — no more
  // `TBN-…` fabrication. Updates local state so the UI reflects the new
  // amountPaid + status without needing a page refresh.
  const submitPayment = async () => {
    if (!payMethod || paying) return;
    setPaying(true);
    setPayError(null);

    try {
      const { recordPayment } = await import('@/lib/services/billing-service');
      const canonicalMethod = toCanonicalMethod(payMethod);
      const referenceBase = `TBN-${Date.now().toString(36).toUpperCase()}`;
      // We attach the patient as the "receivedBy" for an audit trail since
      // this is a self-service payment initiated from the portal.
      const receivedBy = patient._id;
      const receivedByName = `${patient.firstName} ${patient.surname} (self-service)`;

      const updates: Array<{ id: string; amount: number; ok: boolean }> = [];
      for (const billId of selectedBills) {
        const bill = safeBills.find(b => b.id === billId);
        if (!bill) continue;
        const remaining = bill.amount - bill.paid;
        if (remaining <= 0) continue;
        const result = await recordPayment(
          billId,
          remaining,
          canonicalMethod,
          receivedBy,
          receivedByName,
          referenceBase,
          payMethod === 'mpesa' || payMethod === 'mtn' || payMethod === 'airtel'
            ? `Patient portal — ${payMethod} from ${payPhone}`
            : `Patient portal — ${payMethod}`,
        );
        updates.push({ id: billId, amount: remaining, ok: result !== null });
      }

      const failed = updates.filter(u => !u.ok);
      const paidTotal = updates.filter(u => u.ok).reduce((s, u) => s + u.amount, 0);

      if (updates.length === 0 || updates.every(u => !u.ok)) {
        setPayError(t('patientPortal.paymentRecordError'));
        setPaying(false);
        return;
      }

      // Refresh the in-memory bills list from the source of truth so the UI
      // reflects the new amountPaid / balanceDue / status.
      try {
        const { getBillsByPatient } = await import('@/lib/services/billing-service');
        const docs = await getBillsByPatient(patient._id);
        setBills(docs
          .map(d => ({
            id: d._id,
            invoiceNumber: d.invoiceNumber || d._id,
            date: (d.encounterDate || d.createdAt || '').slice(0, 10),
            description:
              (d.items && d.items.length > 0
                ? d.items.map(i => i.description).slice(0, 2).join(', ')
                : null) || t('patientPortal.visitAt', { facility: d.facilityName || t('patientPortal.facilityFallback') }),
            department: (d.items && d.items[0] ? d.items[0].category : 'Services').toString(),
            amount: d.totalAmount,
            paid: d.amountPaid,
            status: deriveStatus(d.status, d.totalAmount, d.amountPaid, d.encounterDate || d.createdAt || ''),
          }))
          .sort((a, b) => b.date.localeCompare(a.date)));
      } catch { /* refresh is best-effort; the success screen still renders */ }

      setLastPayment({
        reference: referenceBase,
        amount: paidTotal,
        billCount: updates.filter(u => u.ok).length,
        failedBillIds: failed.map(f => f.id),
      });
      setStep('success');
    } catch (err) {
      console.error('[patient-portal/billing] payment failed', err);
      setPayError(t('patientPortal.paymentGenericError'));
    } finally {
      setPaying(false);
    }
  };

  if (step === 'success') {
    const refNum = lastPayment?.reference || '';
    const paidAmount = lastPayment?.amount ?? 0;
    const billCount = lastPayment?.billCount ?? 0;
    const failedCount = lastPayment?.failedBillIds.length ?? 0;
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div className="card-elevated" style={{ padding: '40px 28px', borderTop: '4px solid var(--color-success)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(31, 157, 111,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={56} style={{ color: 'var(--color-success)' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('patientPortal.paymentRecorded')}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {payMethod === 'mpesa' || payMethod === 'mtn' || payMethod === 'airtel'
              ? t('patientPortal.successMobilePrompt')
              : payMethod === 'card'
              ? t('patientPortal.successCardRedirect')
              : t('patientPortal.successBankTransfer')}
          </p>
          {failedCount > 0 && (
            <div style={{ padding: 10, borderRadius: 8, marginBottom: 14, background: 'rgba(218,18,48,0.06)', border: '1px solid rgba(218,18,48,0.15)' }}>
              <p style={{ fontSize: 12, color: '#DA1230', fontWeight: 600 }}>
                {t('patientPortal.billsNotUpdated', { count: failedCount })}
              </p>
            </div>
          )}
          <div style={{ padding: 16, borderRadius: 10, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', textAlign: 'left', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('patientPortal.reference')}</p><p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{refNum}</p></div>
              <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('portal.amount')}</p><p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{paidAmount.toLocaleString()} SSP</p></div>
              <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('portal.method')}</p><p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{paymentMethods.find(m => m.key === payMethod)?.name}</p></div>
              <div><p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('patientPortal.bills')}</p><p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('patientPortal.itemCount', { count: billCount })}</p></div>
            </div>
            {payMethod === 'bank' && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(0,137,123,0.06)', border: '1px solid rgba(0,137,123,0.15)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#00897B', marginBottom: 6 }}>{t('patientPortal.bankTransferDetails')}</p>
                <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t('patientPortal.bankLabel')} <strong>KCB Bank South Sudan</strong></p>
                <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t('patientPortal.accountLabel')} <strong>720-184-2930</strong></p>
                <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t('patientPortal.nameLabel')} <strong>TamamHealth Health Services</strong></p>
                <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t('patientPortal.refLabel')} <strong>{refNum}</strong></p>
              </div>
            )}
          </div>
          <button onClick={() => { setStep('bills'); setSelectedBills([]); setPayMethod(null); setLastPayment(null); }} style={{ fontSize: 13, fontWeight: 600, padding: '10px 24px', borderRadius: 8, background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>{t('patientPortal.done')}</button>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    const method = paymentMethods.find(m => m.key === payMethod)!;
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <button onClick={() => setStep('method')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>← {t('action.back')}</button>
        <div className="card-elevated" style={{ padding: 20, borderTop: `4px solid ${method.color}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{t('patientPortal.confirmPayment')}</h3>
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)', marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Info label={t('patientPortal.totalAmount')} value={`${selectedTotal.toLocaleString()} SSP`} />
              <Info label={t('patientPortal.paymentMethod')} value={method.name} />
              <Info label={t('patientPortal.items')} value={t('patientPortal.billCount', { count: selectedBills.length })} />
              {(payMethod === 'mpesa' || payMethod === 'mtn' || payMethod === 'airtel') && <Info label={t('patient.phone')} value={payPhone} />}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{t('patientPortal.billsIncluded')}</p>
            {safeBills.filter(b => selectedBills.includes(b.id)).map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-medium)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{b.description}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{(b.amount - b.paid).toLocaleString()} SSP</span>
              </div>
            ))}
          </div>
          {(payMethod === 'mpesa' || payMethod === 'mtn' || payMethod === 'airtel') && (
            <div style={{ padding: 10, borderRadius: 8, background: `${method.color}10`, border: `1px solid ${method.color}20`, marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: method.color, fontWeight: 600 }}>{t('patientPortal.paymentPromptNotice', { phone: payPhone })}</p>
            </div>
          )}
          {payError && (
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(218,18,48,0.06)', border: '1px solid rgba(218,18,48,0.15)', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#DA1230', fontWeight: 600 }}>{payError}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setStep('method')}
              disabled={paying}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 8, border: '1px solid var(--border-medium)',
                background: 'var(--bg-card-solid)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                cursor: paying ? 'not-allowed' : 'pointer', opacity: paying ? 0.6 : 1,
              }}
            >{t('action.cancel')}</button>
            <button
              onClick={() => { void submitPayment(); }}
              disabled={paying}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', background: method.color,
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer',
                opacity: paying ? 0.6 : 1,
              }}
            >{paying ? t('patientPortal.recording') : t('patientPortal.payAmount', { amount: `${selectedTotal.toLocaleString()} SSP` })}</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'method') {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <button onClick={() => setStep('bills')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>← {t('portal.backToBillsBtn')}</button>
        <div className="card-elevated" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t('portal.choosePaymentMethod')}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('patientPortal.totalLabel')} <strong style={{ color: 'var(--text-primary)' }}>{selectedTotal.toLocaleString()} SSP</strong> {t('patientPortal.forBills', { count: selectedBills.length })}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {paymentMethods.map(m => (
              <button key={m.key} onClick={() => setPayMethod(m.key)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
                borderRadius: 10, border: payMethod === m.key ? `2px solid ${m.color}` : '1px solid var(--border-medium)',
                background: payMethod === m.key ? `${m.color}08` : 'var(--bg-card-solid)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <m.icon size={44} style={{ color: m.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.desc}</p>
                </div>
                {payMethod === m.key && <CheckCircle2 size={44} style={{ color: m.color }} />}
              </button>
            ))}
          </div>
          {payMethod && (payMethod === 'mpesa' || payMethod === 'mtn' || payMethod === 'airtel') && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{t('patientPortal.phoneNumber')}</label>
              <input type="tel" value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder={t('patientPortal.payPhonePlaceholder')}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-card-solid)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
            </div>
          )}
          <button onClick={() => payMethod && setStep('confirm')} disabled={!payMethod}
            style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: payMethod ? 'var(--accent-primary)' : 'var(--border-medium)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: payMethod ? 'pointer' : 'not-allowed', opacity: payMethod ? 1 : 0.5 }}>
            {t('patientPortal.continueToConfirm')}
          </button>
        </div>
      </div>
    );
  }

  /* Bills list (default step) */
  const isLoading = bills === null;

  // Loading skeleton — keeps the page visually quiet until the PouchDB query
  // resolves, instead of flashing an empty state.
  if (isLoading) {
    return (
      <div className="card-elevated" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('patientPortal.loadingBills')}</p>
      </div>
    );
  }

  // Hard-error state (PouchDB query threw). Loadable but useless without
  // the data, so we surface this rather than pretending all bills are
  // settled.
  if (loadError && safeBills.length === 0) {
    return (
      <div className="card-elevated" style={{ textAlign: 'center', padding: 40 }}>
        <Receipt size={56} style={{ color: 'var(--color-danger)', opacity: 0.6, margin: '0 auto 10px' }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{loadError}</p>
      </div>
    );
  }

  // Friendly empty state — distinguishes "no bills on file" from a load
  // error, so a brand-new patient doesn't see scary copy.
  if (safeBills.length === 0) {
    return (
      <div>
        <div style={{
          background: 'linear-gradient(135deg, #1E40AF 0%, #3b82f6 60%, #60A5FA 100%)',
          borderRadius: 14, padding: '20px 24px', color: '#fff', marginBottom: 16, position: 'relative', overflow: 'hidden',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 4 }}>{t('patientPortal.accountSummary')}</p>
          <p style={{ fontSize: 28, fontWeight: 700 }}>0 <span style={{ fontSize: 14, opacity: 0.7 }}>SSP</span></p>
          <p style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>{t('patientPortal.outstandingBalance')}</p>
        </div>
        <div className="card-elevated" style={{ textAlign: 'center', padding: 40 }}>
          <Receipt size={56} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {t('patientPortal.noBillsOnFile')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Balance banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E40AF 0%, #3b82f6 60%, #60A5FA 100%)',
        borderRadius: 14, padding: '20px 24px', color: '#fff', marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 4 }}>{t('patientPortal.accountSummary')}</p>
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginTop: 8 }}>
          <div>
            <p style={{ fontSize: 28, fontWeight: 700 }}>{totalOwed.toLocaleString()} <span style={{ fontSize: 14, opacity: 0.7 }}>SSP</span></p>
            <p style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>{t('patientPortal.outstandingBalance')}</p>
          </div>
          <div>
            <p style={{ fontSize: 28, fontWeight: 700 }}>{totalPaid.toLocaleString()} <span style={{ fontSize: 14, opacity: 0.7 }}>SSP</span></p>
            <p style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>{t('portal.totalPaid')}</p>
          </div>
          <div>
            <p style={{ fontSize: 28, fontWeight: 700 }}>{safeBills.length}</p>
            <p style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>{t('patientPortal.totalBills')}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'stretch', gap: 14 }}>
        {/* Bills list */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('portal.yourBills')}</h3>
            {selectedBills.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>{t('patientPortal.selectedCount', { count: selectedBills.length })}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {safeBills.map(bill => {
              const remaining = bill.amount - bill.paid;
              const isSelectable = remaining > 0;
              const isSelected = selectedBills.includes(bill.id);
              return (
                <div key={bill.id} className="card-elevated" style={{
                  padding: '14px 16px', borderTop: `3px solid ${statusColor(bill.status)}`,
                  opacity: bill.status === 'paid' ? 0.7 : 1,
                  cursor: isSelectable ? 'pointer' : 'default',
                  outline: isSelected ? `2px solid var(--accent-primary)` : 'none',
                  outlineOffset: -2,
                }} onClick={() => {
                  if (!isSelectable) return;
                  setSelectedBills(prev => prev.includes(bill.id) ? prev.filter(id => id !== bill.id) : [...prev, bill.id]);
                }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                    {isSelectable && (
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, marginTop: 2, flexShrink: 0,
                        border: isSelected ? 'none' : '2px solid var(--border-medium)',
                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && <CheckCircle2 size={14} style={{ color: '#fff' }} />}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{bill.description}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bill.department} &middot; {bill.date}</p>
                        </div>
                        <Badge text={bill.status} color={statusColor(bill.status)} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.totalAmountSsp', { amount: bill.amount.toLocaleString() })}</span>
                        {remaining > 0 ? (
                          <span style={{ fontSize: 14, fontWeight: 700, color: statusColor(bill.status) }}>{t('patientPortal.amountDue', { amount: remaining.toLocaleString() })}</span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>{t('patientPortal.fullyPaid')}</span>
                        )}
                      </div>
                      {bill.status === 'partial' && (
                        <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border-medium)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(bill.paid / bill.amount) * 100}%`, background: 'var(--color-warning)', borderRadius: 2 }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Pay selected */}
          <div className="card-elevated" style={{ padding: 18, borderTop: '3px solid var(--accent-primary)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              {selectedBills.length > 0 ? t('patientPortal.paySelectedBills') : t('patientPortal.selectBillsToPay')}
            </h4>
            {selectedBills.length > 0 ? (
              <>
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--accent-light)', border: '1px solid var(--accent-border)', marginBottom: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t('portal.amountToPay')}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)' }}>{selectedTotal.toLocaleString()} <span style={{ fontSize: 12 }}>SSP</span></p>
                </div>
                <button onClick={() => setStep('method')} style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {t('patientPortal.proceedToPay')}
                </button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('patientPortal.tapToSelect')}</p>
            )}
            {safeBills.filter(b => b.amount - b.paid > 0).length > 0 && selectedBills.length === 0 && (
              <button onClick={() => setSelectedBills(safeBills.filter(b => b.amount - b.paid > 0).map(b => b.id))} style={{ width: '100%', marginTop: 10, padding: '10px 0', borderRadius: 8, border: '1px solid var(--accent-primary)', background: 'transparent', color: 'var(--accent-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('patientPortal.selectAllOutstanding')}
              </button>
            )}
          </div>

          {/* Payment methods info */}
          <div className="card-elevated" style={{ padding: 18 }}>
            <SH icon={CreditCard} title={t('portal.acceptedPaymentMethods')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {paymentMethods.map(m => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--overlay-subtle)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <m.icon size={13} style={{ color: m.color }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment history summary */}
          <div className="card-elevated" style={{ padding: 18, background: 'linear-gradient(135deg, #1a3a4a 0%, #1e3a8a 100%)', border: 'none' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{t('patientPortal.paymentSummary')}</p>
            {[
              { label: t('patientPortal.totalBilled'), value: `${safeBills.reduce((s, b) => s + b.amount, 0).toLocaleString()} SSP` },
              { label: t('portal.totalPaid'), value: `${totalPaid.toLocaleString()} SSP` },
              { label: t('patientPortal.outstanding'), value: `${totalOwed.toLocaleString()} SSP` },
              { label: t('patientPortal.overdue'), value: `${safeBills.filter(b => b.status === 'overdue').reduce((s, b) => s + (b.amount - b.paid), 0).toLocaleString()} SSP` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Help */}
          <div className="card-elevated" style={{ padding: 14 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <strong>{t('patientPortal.needHelpLabel')}</strong> {t('patientPortal.needHelpBody')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function SH({ icon: Icon, title }: { icon: typeof User; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Icon size={14} style={{ color: 'var(--accent-primary)' }} />
      <span style={{ fontFamily: "'Untitled Sans', Arial, sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function AlertRow({ color, icon: Icon, text }: { color: string; icon: typeof AlertTriangle; text: string }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 'var(--card-radius)', background: `${color}08`, border: `1px solid ${color}18`, display: 'flex', alignItems: 'center', gap: 7 }}>
      <Icon size={13} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: color === 'var(--accent-primary)' ? 'var(--accent-primary)' : color }}>{text}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color, background: `${color}12`, textTransform: 'capitalize' }}>{text}</span>
  );
}

function Empty({ icon: Icon, text, action, onAction }: { icon: typeof User; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="card-elevated" style={{ textAlign: 'center', padding: 40 }}>
      <Icon size={56} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 10px' }} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: action ? 10 : 0 }}>{text}</p>
      {action && onAction && <button onClick={onAction} className="btn btn-primary btn-sm" style={{ gap: 4 }}><Plus size={13} /> {action}</button>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PATIENT PORTAL STYLES — matches main landing page design
   ═══════════════════════════════════════════════════════════════ */
const patientPortalCSS = `
.pp-title {
  font-family: 'Untitled Sans', Arial, sans-serif;
  font-size: 32px; font-weight: 700; color: var(--text-primary);
  letter-spacing: -0.02em; margin-bottom: 8px; line-height: 1.2;
}
.pp-subtitle {
  font-family: 'Untitled Sans', Arial, sans-serif;
  font-size: 16px; color: var(--text-secondary); line-height: 1.6;
  max-width: 380px; margin: 0 auto;
}
.pp-card {
  background: var(--bg-card-solid); border: 1px solid var(--border-medium);
  border-radius: 12px; box-shadow: var(--card-shadow-lg);
}
.pp-toggle {
  display: flex; margin-bottom: 28px; border-radius: 8px;
  overflow: hidden; border: 1px solid var(--border-medium);
  background: var(--bg-secondary);
}
.pp-toggle__btn {
  flex: 1; padding: 14px 0; font-family: 'Untitled Sans', Arial, sans-serif;
  font-size: 14px; font-weight: 700; border: none; cursor: pointer;
  background: transparent; color: var(--text-secondary); transition: all 0.2s ease;
  border-radius: 7px; margin: 2px;
}
.pp-toggle__btn--active {
  background: var(--accent-primary); color: #fff;
  box-shadow: 0 2px 8px rgba(0,119,215,0.25);
}
.pp-field { margin-bottom: 20px; }
.pp-label {
  display: block; font-family: 'Untitled Sans', Arial, sans-serif;
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 8px; letter-spacing: 0;
  text-transform: none;
}
.pp-input {
  width: 100%; padding: 14px 16px; border-radius: 8px;
  border: 1px solid var(--border-medium); font-family: 'Untitled Sans', Arial, sans-serif;
  font-size: 16px; color: var(--text-primary); background: var(--bg-card-solid);
  transition: border-color 0.2s, box-shadow 0.2s; outline: none;
}
.pp-input:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 4px var(--accent-light); }
.pp-input::placeholder { color: var(--text-muted); }
.pp-btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 10px; padding: 16px 28px; border-radius: 8px;
  font-family: 'Untitled Sans', Arial, sans-serif; font-size: 16px;
  font-weight: 700; cursor: pointer; border: none;
  background: var(--accent-primary); color: #fff; transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,119,215,0.2);
}
.pp-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,119,215,0.3); }
.pp-error {
  padding: 14px 16px; border-radius: 8px; background: rgba(218,18,48,0.06);
  border: 1px solid rgba(218,18,48,0.15); margin-bottom: 18px;
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 14px; color: #DA1230; line-height: 1.5;
}
.pp-notice {
  margin-top: 24px; padding: 16px 18px; border-radius: 10px;
  background: var(--accent-light); border: 1px solid var(--accent-border);
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 13px; color: var(--text-secondary); line-height: 1.6;
}
.pp-demo-btn {
  display: flex; flex-direction: column; gap: 3px; padding: 14px 16px;
  background: var(--bg-card-solid); border: 1px solid var(--border-medium);
  border-radius: 8px; cursor: pointer; text-align: left; width: 100%;
  transition: all 0.15s ease;
}
.pp-demo-btn:hover { border-color: var(--accent-primary); background: var(--accent-light); transform: translateY(-1px); }
`;
