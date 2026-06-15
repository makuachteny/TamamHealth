import type { Patient } from '@/data/mock';
import { patientFullName, patientInitials } from '@/lib/patient-utils';

/** Minimal shape needed to render a patient's avatar + name. */
export type PatientNameLike = Pick<Patient, 'firstName' | 'surname'> & {
  middleName?: string;
  gender?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Canonical patient identity chip: a coloured initials "logo" square followed
 * by the full name. Use this EVERYWHERE a patient is listed so the style is
 * identical across the app (queues, tables, cards, feeds, pickers).
 *
 * Pass either a `patient` object OR a plain `name` string (for queues/records
 * that only carry the name). The square is gradient-tinted by gender
 * (female = warm, male/other = brand blue) — same treatment as the registry.
 */
export default function PatientName({
  patient,
  name,
  gender,
  size = 32,
  nameClassName = 'text-sm',
  className = '',
}: {
  patient?: PatientNameLike;
  name?: string;
  gender?: string;
  size?: number;
  nameClassName?: string;
  className?: string;
}) {
  const displayName = patient ? patientFullName(patient) : (name || 'Unknown');
  const initials = patient ? patientInitials(patient) : initialsFromName(name || '');
  const isFemale = (patient?.gender ?? gender) === 'Female';
  return (
    <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      <span
        className="flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.34),
          letterSpacing: 0.3,
          background: isFemale
            ? 'linear-gradient(135deg, #D96E59 0%, #C44536 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #1E3A8A 100%)',
        }}
        aria-hidden
      >
        {initials}
      </span>
      <span className={`font-semibold truncate ${nameClassName}`} style={{ color: 'var(--text-primary)' }}>
        {displayName}
      </span>
    </span>
  );
}
