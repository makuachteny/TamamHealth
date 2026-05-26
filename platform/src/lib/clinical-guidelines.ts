// Clinical threshold ranges for vital signs.
// Sources: WHO IMAI, PIH Clinical Handbook, South Sudan MoH triage protocol.
// Each tier returns a severity label used to tint UI tiles and badges.

export type VitalSeverity = 'normal' | 'warning' | 'danger';

export type VitalKey =
  | 'temperature'
  | 'systolic'
  | 'diastolic'
  | 'pulse'
  | 'respiratoryRate'
  | 'oxygenSaturation'
  | 'bmi'
  | 'glucose';

interface BandRange { min: number; max: number }

interface VitalBands {
  normal: BandRange;
  warning?: BandRange;      // amber tier (borderline on the low side)
  warningHigh?: BandRange;  // amber tier (borderline on the high side)
  dangerLow?: number;       // <= this → danger
  dangerHigh?: number;      // >= this → danger
  unit: string;
  label: string;
}

// Adult reference ranges. Pediatric overrides can be threaded later via
// getVitalStatus(key, value, { ageYears }) but aren't used yet.
export const VITAL_THRESHOLDS: Record<VitalKey, VitalBands> = {
  temperature:      { normal: { min: 36.1, max: 37.5 },  warning: { min: 35.5, max: 36.0 }, warningHigh: { min: 37.6, max: 38.5 }, dangerLow: 35.0, dangerHigh: 39.0, unit: '°C',    label: 'Temperature' },
  systolic:         { normal: { min: 90,   max: 120 },   warning: { min: 85,   max: 89 },    warningHigh: { min: 121,  max: 139 },  dangerLow: 80,   dangerHigh: 140,  unit: 'mmHg',  label: 'Systolic BP' },
  diastolic:        { normal: { min: 60,   max: 80 },    warning: { min: 55,   max: 59 },    warningHigh: { min: 81,   max: 89 },   dangerLow: 50,   dangerHigh: 90,   unit: 'mmHg',  label: 'Diastolic BP' },
  pulse:            { normal: { min: 60,   max: 100 },   warning: { min: 50,   max: 59 },    warningHigh: { min: 101,  max: 119 },  dangerLow: 45,   dangerHigh: 120,  unit: 'bpm',   label: 'Heart Rate' },
  respiratoryRate:  { normal: { min: 12,   max: 20 },                                        warningHigh: { min: 21,   max: 24 },   dangerLow: 8,    dangerHigh: 25,   unit: '/min',  label: 'Respiration' },
  oxygenSaturation: { normal: { min: 95,   max: 100 },   warning: { min: 92,   max: 94 },                                           dangerLow: 92,                     unit: '%',     label: 'SpO₂' },
  bmi:              { normal: { min: 18.5, max: 24.9 },  warning: { min: 17.0, max: 18.4 },  warningHigh: { min: 25.0, max: 29.9 }, dangerLow: 16.5, dangerHigh: 30.0, unit: '',      label: 'BMI' },
  glucose:          { normal: { min: 70,   max: 140 },   warning: { min: 65,   max: 69 },    warningHigh: { min: 141,  max: 200 },  dangerLow: 60,   dangerHigh: 200,  unit: 'mg/dL', label: 'Glucose' },
};

export function getVitalStatus(key: VitalKey, value: number | null | undefined): VitalSeverity {
  if (value == null || Number.isNaN(value)) return 'normal';
  const b = VITAL_THRESHOLDS[key];
  if (b.dangerLow != null && value <= b.dangerLow) return 'danger';
  if (b.dangerHigh != null && value >= b.dangerHigh) return 'danger';
  if (b.warning && value >= b.warning.min && value <= b.warning.max) return 'warning';
  if (b.warningHigh && value >= b.warningHigh.min && value <= b.warningHigh.max) return 'warning';
  return 'normal';
}

// Combined BP severity — worst of the two readings wins.
export function getBloodPressureStatus(systolic?: number, diastolic?: number): VitalSeverity {
  const s = getVitalStatus('systolic', systolic);
  const d = getVitalStatus('diastolic', diastolic);
  if (s === 'danger' || d === 'danger') return 'danger';
  if (s === 'warning' || d === 'warning') return 'warning';
  return 'normal';
}

// One-line clinical hint for badges (kept terse — the color tells most of it).
export function getVitalHint(key: VitalKey, value: number | null | undefined): string | null {
  if (value == null) return null;
  const s = getVitalStatus(key, value);
  if (s === 'normal') return null;
  const b = VITAL_THRESHOLDS[key];
  if (key === 'oxygenSaturation') return s === 'danger' ? 'Hypoxia' : 'Low';
  if (key === 'temperature') return value > b.normal.max ? (s === 'danger' ? 'High fever' : 'Febrile') : (s === 'danger' ? 'Hypothermic' : 'Low');
  if (key === 'systolic' || key === 'diastolic') return value > b.normal.max ? (s === 'danger' ? 'Hypertensive' : 'Elevated') : (s === 'danger' ? 'Hypotensive' : 'Low');
  if (key === 'pulse') return value > b.normal.max ? (s === 'danger' ? 'Tachycardic' : 'Elevated') : (s === 'danger' ? 'Bradycardic' : 'Low');
  if (key === 'respiratoryRate') return s === 'danger' ? 'Respiratory distress' : 'Tachypneic';
  if (key === 'bmi') return value > b.normal.max ? (s === 'danger' ? 'Obese' : 'Overweight') : (s === 'danger' ? 'Severely underweight' : 'Underweight');
  if (key === 'glucose') return value > b.normal.max ? (s === 'danger' ? 'Hyperglycemic' : 'Elevated') : (s === 'danger' ? 'Hypoglycemic' : 'Low');
  return null;
}

// UI color tokens per severity — consumed by VitalCard, AlertTile, etc.
export const SEVERITY_TOKENS: Record<VitalSeverity, {
  tile: string;           // background
  tileBorder: string;
  badge: string;          // pill background
  text: string;           // value color
  accent: string;         // icon + label color
  ring: string;           // inset ring for danger pulse
}> = {
  normal: {
    tile: 'var(--bg-tinted, #F2F5F3)',
    tileBorder: 'var(--border-light, #E8E6E2)',
    badge: 'rgba(27, 158, 119, 0.12)',
    text: 'var(--text-primary, #1A2C2A)',
    accent: 'var(--accent-primary, #1B9AAA)',
    ring: 'transparent',
  },
  warning: {
    tile: 'rgba(228, 168, 75, 0.10)',
    tileBorder: 'rgba(228, 168, 75, 0.32)',
    badge: 'rgba(228, 168, 75, 0.18)',
    text: '#8A5A0E',
    accent: '#B8741C',
    ring: 'rgba(228, 168, 75, 0.35)',
  },
  danger: {
    tile: 'rgba(196, 69, 54, 0.10)',
    tileBorder: 'rgba(196, 69, 54, 0.35)',
    badge: 'rgba(196, 69, 54, 0.18)',
    text: '#8B2E24',
    accent: '#C44536',
    ring: 'rgba(196, 69, 54, 0.38)',
  },
};
