import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — TamamHealth',
  description: 'Privacy Policy for the TamamHealth digital health records platform.',
};

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 20px' }}>
      <article style={{ maxWidth: 760, margin: '0 auto', color: 'var(--text-primary)' }}>
        <Link href="/login" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-text)', textDecoration: 'none' }}>
          ← Back to sign in
        </Link>
        <h1 style={{ marginTop: 16 }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          TamamHealth — Digital Health Records Platform
        </p>

        <section style={{ marginTop: 24, fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          <p>
            TamamHealth processes personal and health information to support patient care,
            facility operations, and public-health reporting. This policy summarises how that
            information is handled.
          </p>

          <h2 style={{ marginTop: 24, fontSize: 18 }}>1. Information we process</h2>
          <p>
            Patient demographics and clinical records entered by healthcare workers; staff
            account details; and operational data (appointments, billing, inventory). Access
            and changes are recorded in an audit log.
          </p>

          <h2 style={{ marginTop: 24, fontSize: 18 }}>2. How it is used</h2>
          <p>
            Information is used to deliver and coordinate care, to operate participating
            facilities, and to produce aggregated, de-identified statistics for health
            authorities. It is not sold.
          </p>

          <h2 style={{ marginTop: 24, fontSize: 18 }}>3. Storage and security</h2>
          <p>
            The platform is offline-first: data is stored encrypted on the device and
            synchronised to the organisation’s servers when online. Access is restricted by
            role and scoped to a user’s organisation and facility. Passwords are stored only
            as salted hashes.
          </p>

          <h2 style={{ marginTop: 24, fontSize: 18 }}>4. Sharing</h2>
          <p>
            Patient data is shared between facilities only where needed for referrals and
            continuity of care, and with health authorities as required by law. Sub-processors
            are bound by equivalent confidentiality obligations.
          </p>

          <h2 style={{ marginTop: 24, fontSize: 18 }}>5. Your rights and contact</h2>
          <p>
            Patients may request access to or correction of their records through their
            facility. For privacy questions, contact your facility administrator or{' '}
            <a href="mailto:support.tamam@gmail.com" style={{ color: 'var(--accent-text)' }}>support.tamam@gmail.com</a>.
          </p>

          <p style={{ marginTop: 28, fontSize: 12.5, color: 'var(--text-muted)' }}>
            This summary is provided for convenience. The operating organisation (e.g. the
            Ministry of Health) maintains the binding policy; contact your administrator for
            the full, current version.
          </p>
        </section>
      </article>
    </main>
  );
}
