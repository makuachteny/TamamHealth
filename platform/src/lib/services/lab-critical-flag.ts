/**
 * Bridge between the lab result-entry UI and the QC service's critical-value
 * table. The lab UI carries free-text test names ("Full Blood Count",
 * "Hemoglobin (g/dL)") and string-typed result values, while
 * `DEFAULT_CRITICAL_VALUES` keys on a friendly analyte name with numeric
 * thresholds. These helpers do the fuzzy name match and numeric coercion so
 * the page can flag critical values without duplicating QC logic.
 */
import { DEFAULT_CRITICAL_VALUES, isCritical, type CriticalValueRule } from './qc-service';

/**
 * Match a free-text lab test name against the QC critical-value table by
 * comparing the leading analyte word in either direction (so "Hemoglobin",
 * "Hemoglobin (g/dL)" and "Full Blood Count — Hemoglobin" all resolve).
 */
export function matchCriticalRule(testName: string): CriticalValueRule | undefined {
  const name = (testName || '').toLowerCase();
  if (!name) return undefined;
  return DEFAULT_CRITICAL_VALUES.find(rule => {
    const analyte = rule.testName.split(' (')[0].toLowerCase();
    return name.includes(analyte) || analyte.includes(name);
  });
}

export interface CriticalCheck {
  rule?: CriticalValueRule;
  isCriticalValue: boolean;
}

/**
 * Run an entered result value through the matched critical-value rule. Only
 * numeric values are evaluated — qualitative results return not-critical.
 */
export function evaluateCritical(testName: string, value: string): CriticalCheck {
  const rule = matchCriticalRule(testName);
  if (!rule) return { isCriticalValue: false };
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return { rule, isCriticalValue: false };
  return { rule, isCriticalValue: isCritical(num, rule) };
}
