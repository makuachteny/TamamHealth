// ============================================
// Performance Color Scales (WHO-style red→yellow→green)
// ============================================

/** Discrete 4-stop color: red(<40), amber(40-59), yellow(60-79), green(80+) */
export function getPerformanceColor(value: number): string {
  if (value < 40) return 'var(--color-danger)';   // red
  if (value < 60) return 'var(--color-warning)';  // amber
  if (value < 80) return 'var(--color-warning)';  // yellow
  return 'var(--color-success)';                   // green
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
