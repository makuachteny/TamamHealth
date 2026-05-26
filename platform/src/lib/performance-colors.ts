// ============================================
// Performance Color Scales (WHO-style red→yellow→green)
// ============================================

/** Discrete 4-stop color: red(<40), amber(40-59), yellow(60-79), green(80+) */
export function getPerformanceColor(value: number): string {
  if (value < 40) return '#C44536';   // red
  if (value < 60) return '#E4A84B';   // amber
  if (value < 80) return '#EAB308';   // yellow
  return '#1B9E77';                    // green
}

/** Smooth RGB gradient: red(0) → yellow(50) → green(100) */
export function getMetricColorInterpolated(value: number): string {
  const v = Math.max(0, Math.min(100, value));
  let r: number, g: number, b: number;
  if (v <= 50) {
    // red → yellow
    const t = v / 50;
    r = 239;
    g = Math.round(68 + t * (163 - 68));
    b = Math.round(68 - t * 57);
  } else {
    // yellow → green
    const t = (v - 50) / 50;
    r = Math.round(234 - t * (234 - 34));
    g = Math.round(179 + t * (197 - 179));
    b = Math.round(8 + t * (86 - 8));
  }
  return `rgb(${r},${g},${b})`;
}

export type PerformanceMetricKey = keyof typeof METRIC_LABELS;

/** Human-readable labels for each performance metric key */
export const METRIC_LABELS = {
  reportingCompleteness: 'Reporting',
  serviceReadinessScore: 'Readiness',
  tracerMedicineAvailability: 'Medicines',
  staffingScore: 'Staffing',
  opdVisitsPerMonth: 'OPD Visits',
  ancCoverage: 'ANC Coverage',
  immunizationCoverage: 'EPI Coverage',
  stockOutDays: 'Stock-out Days',
  qualityScore: 'Quality',
} as const;
