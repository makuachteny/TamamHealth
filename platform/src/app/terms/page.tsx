import type { Metadata } from 'next';
import PublicLegalShell from '@/components/PublicLegalShell';

export const metadata: Metadata = {
  title: 'Terms of Use — TamamHealth',
  description: 'Terms of Use for the TamamHealth digital health records platform.',
};

export default function TermsPage() {
  return (
    <PublicLegalShell title="Terms of Use" subtitle="TamamHealth — Digital Health Records Platform">
      <p>
        These Terms of Use govern access to and use of the TamamHealth platform by
        authorised healthcare workers and administrators of participating facilities.
        By signing in you confirm that you are an authorised user and agree to use the
        system only for legitimate clinical, administrative, and public-health purposes.
      </p>

      <h2>1. Authorised use</h2>
      <p>
        Accounts are issued by your facility or organisation administrator. You are
        responsible for all activity under your account, must keep your credentials
        confidential, and must not share your login. Report any suspected compromise to
        your administrator immediately.
      </p>

      <h2>2. Patient data</h2>
      <p>
        Patient information must be accessed strictly on a need-to-know basis for the care
        of patients within your scope of practice. You must not export, copy, or disclose
        patient data except as required for treatment, payment, or operations and as
        permitted by applicable law and your organisation&rsquo;s policies.
      </p>

      <h2>3. Acceptable conduct</h2>
      <p>
        You agree not to attempt to bypass access controls, interfere with system
        integrity, or use the platform to store or transmit unlawful content. All access
        is logged for audit and compliance.
      </p>

      <h2>4. Availability</h2>
      <p>
        The platform is offline-first and synchronises when connectivity is available. It
        is provided on an &ldquo;as available&rdquo; basis; your organisation is responsible for
        clinical decisions and for maintaining appropriate fallback procedures.
      </p>

      <h2>5. Contact</h2>
      <p>
        Questions about these terms should be directed to your facility administrator or
        the platform operator at <a href="mailto:support.tamam@gmail.com">support.tamam@gmail.com</a>.
      </p>

      <p className="lg-note">
        This summary is provided for convenience. The operating organisation (e.g. the
        Ministry of Health) maintains the binding policy; contact your administrator for
        the full, current version.
      </p>
    </PublicLegalShell>
  );
}
