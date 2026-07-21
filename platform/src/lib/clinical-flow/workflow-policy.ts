import type { PatientDoc } from '../db-types';
import type { EncounterStationKey, FacilitySettings, PatientProfileKey } from '../settings/facility-settings';

export interface WorkflowPatientContext {
  ageYears?: number;
  gender?: string;
  pregnant?: boolean;
  emergency?: boolean;
  postnatal?: boolean;
}

export function patientWorkflowProfile(patient?: PatientDoc | null, context: WorkflowPatientContext = {}): PatientProfileKey {
  if (context.emergency) return 'emergency';
  if (context.postnatal) return 'postnatal';
  if (context.pregnant) return 'pregnant';
  const gender = String(context.gender || patient?.gender || '').toLowerCase();
  if (gender.includes('female') && context.pregnant) return 'pregnant';
  const ageYears = context.ageYears ?? ageFromDate(patient?.dateOfBirth);
  if (typeof ageYears === 'number' && ageYears < 15) return 'child';
  return 'adult';
}

export function requiresTriage(settings: FacilitySettings, profile: PatientProfileKey): boolean {
  return settings.triageRequiredFor.includes(profile);
}

export function firstStationForArrival(
  settings: FacilitySettings,
  arrivalType: 'appointment' | 'walkIn' | 'referral',
  profile: PatientProfileKey,
): EncounterStationKey {
  if (profile === 'emergency') return 'triage';
  if (requiresTriage(settings, profile)) return 'triage';
  if (arrivalType === 'walkIn' && settings.routingDefaults.walkIn === 'triage') return 'triage';
  return settings.stationSequence.includes('rooming') ? 'rooming' : 'consultation';
}

export function nextConfiguredStation(
  settings: FacilitySettings,
  current: EncounterStationKey,
  completedStations: readonly EncounterStationKey[] = [],
): EncounterStationKey | null {
  const currentIndex = settings.stationSequence.indexOf(current);
  if (currentIndex < 0) return settings.stationSequence[0] ?? null;
  for (const station of settings.stationSequence.slice(currentIndex + 1)) {
    if (!completedStations.includes(station)) return station;
  }
  return null;
}

export function unmetCheckoutGates(settings: FacilitySettings, satisfiedKeys: readonly string[]): string[] {
  return settings.checkoutGateKeys.filter(key => !satisfiedKeys.includes(key));
}

function ageFromDate(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}
