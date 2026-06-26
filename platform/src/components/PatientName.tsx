import Link from 'next/link';
import type { Patient } from '@/data/mock';
import { patientFullName } from '@/lib/patient-utils';

/** Minimal shape needed to render a patient's name. */
export type PatientNameLike = Pick<Patient, 'firstName' | 'surname'> & {
  middleName?: string;
  gender?: string;
};

/**
 * Canonical patient identity label: the patient's full name. Use this
 * EVERYWHERE a patient is listed so the style is identical across the app
 * (queues, tables, cards, feeds, pickers).
 *
 * Pass either a `patient` object OR a plain `name` string (for queues/records
 * that only carry the name).
 *
 * When `patientId` is provided, the name renders as a link to that patient's
 * record (`/patients/{id}`) so a patient is clickable everywhere they appear.
 * Omit `patientId` (e.g. demo rows with no real record) to render plain text.
 */
export default function PatientName({
  patient,
  name,
  patientId,
  nameClassName = 'text-sm',
  className = '',
}: {
  patient?: PatientNameLike;
  name?: string;
  /** When set, the name links to `/patients/{patientId}`. */
  patientId?: string;
  gender?: string;
  size?: number;
  nameClassName?: string;
  className?: string;
}) {
  const displayName = patient ? patientFullName(patient) : (name || 'Unknown');
  return (
    <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      {patientId ? (
        <Link
          href={`/patients/${patientId}`}
          onClick={(e) => e.stopPropagation()}
          className={`font-semibold truncate hover:underline ${nameClassName}`}
          style={{ color: 'var(--text-primary)' }}
        >
          {displayName}
        </Link>
      ) : (
        <span className={`font-semibold truncate ${nameClassName}`} style={{ color: 'var(--text-primary)' }}>
          {displayName}
        </span>
      )}
    </span>
  );
}
