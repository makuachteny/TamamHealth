'use client';

import type { Patient } from '@/data/mock';
import { avatarColor } from '@/lib/patient-utils';

// Coverage type → circle colour (fill). Muted, accessible palette — all pass
// WCAG AA against white text (#fff) at these sizes.
const COVERAGE_COLOR: Record<string, string> = {
  'out-of-pocket': '#C2410C',   // muted orange — self-pay
  'program':       'var(--color-success-700)',   // clinical green — government/programme
  'exemption':     '#015697',   // mid-blue — fee waiver / exemption
  'ngo':           '#015697',   // teal — NGO covered
  'unknown':       'var(--color-slate-500)',   // slate — no info
};

// Short label shown in tooltip
const COVERAGE_LABEL: Record<string, string> = {
  'out-of-pocket': 'Self-pay',
  'program':       'Programme',
  'exemption':     'Exemption',
  'ngo':           'NGO',
  'unknown':       'Unknown',
};

function getInitials(p: { firstName?: string; surname?: string; name?: string }): string {
  if (p.firstName && p.surname) {
    return `${p.firstName[0]}${p.surname[0]}`.toUpperCase();
  }
  if (p.name) {
    const parts = p.name.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return '?';
}

function getCoverage(p: { payorInfo?: { coverageType?: string } }): string {
  return p.payorInfo?.coverageType || 'unknown';
}

interface Props {
  patient: Pick<Patient, 'firstName' | 'surname'> & { payorInfo?: Patient['payorInfo']; photoUrl?: string };
  size?: number;
  /** Override the circle color (e.g. acuity color in worklists) */
  color?: string;
}

export default function PatientAvatar({ patient, size = 32, color: colorProp }: Props) {
  const coverage = getCoverage(patient);
  // Round colour-coded patient avatar: red/orange/green, deterministic per name,
  // unless an explicit colour is passed (e.g. acuity colour in worklists).
  const color = colorProp ?? avatarColor(`${patient.firstName || ''} ${patient.surname || ''}`.trim() || 'patient');
  const label = COVERAGE_LABEL[coverage] || 'Unknown';
  const initials = getInitials(patient);
  const fontSize = Math.round(size * 0.36);

  if (patient.photoUrl) {
    return (
      <div
        className="flex-shrink-0 relative"
        style={{ width: size, height: size }}
        title={`${label} coverage`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={patient.photoUrl}
          alt={initials}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        />
        {/* Small coverage dot */}
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(8, Math.round(size * 0.28)),
            height: Math.max(8, Math.round(size * 0.28)),
            borderRadius: '50%',
            background: color,
            border: '1.5px solid var(--bg-card-solid, #fff)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center font-bold text-white select-none"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        fontSize,
        letterSpacing: 0.3,
        flexShrink: 0,
      }}
      title={`${label} coverage`}
      aria-label={`${initials} — ${label}`}
    >
      {initials}
    </div>
  );
}

export { COVERAGE_COLOR, COVERAGE_LABEL, getInitials, getCoverage };
