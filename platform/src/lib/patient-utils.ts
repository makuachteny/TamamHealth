/**
 * Patient field accessors and sorting.
 *
 * Patient records accumulate registration/visit timestamps from several sources
 * (interactive registration, seed data, birth-derived records), so individual
 * date fields are inconsistently populated. These helpers expose ONE canonical
 * value per concept with a deterministic fallback chain, so every list sorts and
 * displays the same way and undated records never render as a blank "—".
 */

import type { PatientDoc, Patient } from './db-types';

type PatientLike = Partial<Patient> & { createdAt?: string };

/**
 * Canonical registration instant (ISO). Prefers the precise timestamp, falls
 * back to the date-only field, then to the document's createdAt. Always returns
 * a string so callers can sort/format without guarding for undefined.
 */
export function patientRegisteredAt(p: PatientLike): string {
  return p.registeredAt || p.registrationDate || p.createdAt || '';
}

/** Canonical "most recent activity" instant (ISO) — last consult, else last visit. */
export function patientLastActivity(p: PatientLike): string {
  return p.lastConsultedAt || p.lastVisitDate || '';
}

/** Full display name, collapsing any missing middle name and stray whitespace. */
export function patientFullName(p: Pick<Patient, 'firstName' | 'surname'> & { middleName?: string }): string {
  return `${p.firstName} ${p.middleName || ''} ${p.surname}`.replace(/\s+/g, ' ').trim();
}

/** Two-letter initials for avatars (first name + surname), upper-cased. */
export function patientInitials(p: { firstName?: string; surname?: string }): string {
  return `${(p.firstName || '?')[0]}${(p.surname || '?')[0]}`.toUpperCase();
}

/**
 * Patient age in whole years. Prefers an explicit estimatedAge, otherwise
 * derives it from dateOfBirth with a month/day adjustment so it never reads a
 * year too high. Returns null when age is genuinely unknown — every display
 * should use this so the same patient never shows two different ages.
 */
export function patientAge(p: { estimatedAge?: number; dateOfBirth?: string }): number | null {
  if (typeof p.estimatedAge === 'number' && p.estimatedAge > 0) return p.estimatedAge;
  if (!p.dateOfBirth) return null;
  const d = new Date(p.dateOfBirth);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Age label like "34y", or "—" when unknown. */
export function patientAgeLabel(p: { estimatedAge?: number; dateOfBirth?: string }): string {
  const a = patientAge(p);
  return a == null ? '—' : `${a}y`;
}

/** Combined "Male · 34y" identity line; drops parts that are missing. */
export function patientGenderAge(p: { gender?: string; estimatedAge?: number; dateOfBirth?: string }): string {
  const parts: string[] = [];
  if (p.gender) parts.push(p.gender);
  const a = patientAge(p);
  if (a != null) parts.push(`${a}y`);
  return parts.join(' · ');
}

export type PatientSort = 'recent' | 'name' | 'visited' | 'oldest';

export const PATIENT_SORT_OPTIONS: { value: PatientSort; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'visited', label: 'Last visit' },
];

/**
 * Comparator for the given sort key. Stable and total: ties and missing values
 * fall back to name then id so the order is fully deterministic.
 */
export function comparePatients(sort: PatientSort): (a: PatientDoc, b: PatientDoc) => number {
  const byName = (a: PatientDoc, b: PatientDoc) =>
    patientFullName(a).localeCompare(patientFullName(b)) || (a._id || '').localeCompare(b._id || '');

  switch (sort) {
    case 'name':
      return byName;
    case 'oldest':
      return (a, b) => patientRegisteredAt(a).localeCompare(patientRegisteredAt(b)) || byName(a, b);
    case 'visited':
      return (a, b) => patientLastActivity(b).localeCompare(patientLastActivity(a)) || byName(a, b);
    case 'recent':
    default:
      return (a, b) => patientRegisteredAt(b).localeCompare(patientRegisteredAt(a)) || byName(a, b);
  }
}
