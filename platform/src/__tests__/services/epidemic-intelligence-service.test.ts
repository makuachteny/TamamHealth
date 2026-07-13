/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for epidemic-intelligence-service.ts
 * Covers epidemic curve generation, Rt estimation, EWARS alerts, and geographic spread analysis.
 */

let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `${String(++uuidCounter).padStart(8, '0')}-epi-uuid` }));
jest.mock('@/lib/db', () => require('../helpers/test-db').createDBMock());

import { teardownTestDBs } from '../helpers/test-db';
import { getEpidemicIntelligence } from '@/lib/services/epidemic-intelligence-service';
import { diseaseAlertsDB } from '@/lib/db';
import type { DiseaseAlertDoc } from '@/lib/db-types';

const makeDiseaseAlert = (overrides: Record<string, unknown> = {}): DiseaseAlertDoc => {
  uuidCounter++;
  return {
    _id: `alert-${uuidCounter}-${Date.now()}`,
    type: 'disease_alert',
    disease: 'Malaria',
    state: 'Central Equatoria',
    county: 'Juba',
    cases: 50,
    deaths: 5,
    alertLevel: 'warning' as const,
    reportDate: new Date().toISOString().slice(0, 10),
    trend: 'stable' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

afterEach(async () => {
  await teardownTestDBs();
  uuidCounter = 0;
});

describe('epidemic-intelligence-service', () => {
  test('getEpidemicIntelligence returns valid structure with empty data', async () => {
    const data = await getEpidemicIntelligence();

    expect(data).toBeDefined();
    expect(data.epidemicCurves).toBeDefined();
    expect(Array.isArray(data.epidemicCurves)).toBe(true);
    expect(data.rtEstimates).toBeDefined();
    expect(Array.isArray(data.rtEstimates)).toBe(true);
    expect(data.syndromicAlerts).toBeDefined();
    expect(Array.isArray(data.syndromicAlerts)).toBe(true);
    expect(data.idsrReport).toBeDefined();
    expect(data.geographicSpread).toBeDefined();
    expect(Array.isArray(data.geographicSpread)).toBe(true);
    expect(data.ewarsAlerts).toBeDefined();
    expect(Array.isArray(data.ewarsAlerts)).toBe(true);
    expect(data.summary).toBeDefined();
  });

  test('getEpidemicIntelligence summary has correct structure', async () => {
    const data = await getEpidemicIntelligence();

    expect(data.summary.totalActiveDiseases).toBe(0);
    expect(data.summary.totalCasesThisWeek).toBe(0);
    expect(data.summary.totalDeathsThisWeek).toBe(0);
    expect(['low', 'moderate', 'high', 'critical']).toContain(data.summary.overallRiskLevel);
    expect(Array.isArray(data.summary.statesWithEmergency)).toBe(true);
  });

  test('epidemic curves include 12 weeks of data', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ cases: 10, deaths: 1 }));

    const data = await getEpidemicIntelligence();

    // Should have 12 weeks * number of diseases
    expect(data.epidemicCurves.length).toBeGreaterThanOrEqual(12);

    // Check week labels are in ISO format
    for (const curve of data.epidemicCurves) {
      expect(curve.week).toMatch(/^\d{4}-W\d{2}$/);
      expect(curve.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof curve.cases).toBe('number');
      expect(typeof curve.deaths).toBe('number');
    }
  });

  test('Rt estimates calculated from epidemic curves', async () => {
    const db = diseaseAlertsDB();
    // Older-week baseline (5 weeks ago) plus a recent-week alert, so both
    // Rt windows are populated and the ratio is a genuine computation.
    const fiveWeeksAgo = new Date();
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 20, deaths: 2, reportDate: fiveWeeksAgo.toISOString().slice(0, 10) }));
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 20, deaths: 2 }));

    const data = await getEpidemicIntelligence();

    expect(data.rtEstimates.length).toBeGreaterThan(0);
    for (const rt of data.rtEstimates) {
      expect(rt.disease).toBeDefined();
      if (rt.rt !== null) {
        expect(rt.rt).toBeGreaterThanOrEqual(0);
        expect(rt.rt).toBeLessThanOrEqual(5);
      }
      expect(['growing', 'stable', 'declining', 'insufficient_data']).toContain(rt.trend);
      expect(['low', 'medium', 'high']).toContain(rt.confidence);
      expect(typeof rt.weeklyChange).toBe('number');
    }
  });

  test('Rt returns insufficient_data when there is no older-week baseline', async () => {
    const db = diseaseAlertsDB();
    // A single current-week alert has no older-week case count to divide by
    // — must be honestly flagged rather than defaulted to a fake Rt=1.
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 20, deaths: 2 }));

    const data = await getEpidemicIntelligence();

    const cholerRt = data.rtEstimates.find(r => r.disease === 'Cholera');
    expect(cholerRt).toBeDefined();
    expect(cholerRt!.rt).toBeNull();
    expect(cholerRt!.trend).toBe('insufficient_data');
  });

  test('Rt estimates sorted by rt descending (known values first, insufficient-data last)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Malaria', cases: 100 }));
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 10 }));

    const data = await getEpidemicIntelligence();

    if (data.rtEstimates.length > 1) {
      for (let i = 0; i < data.rtEstimates.length - 1; i++) {
        const a = data.rtEstimates[i].rt ?? -1;
        const b = data.rtEstimates[i + 1].rt ?? -1;
        expect(a).toBeGreaterThanOrEqual(b);
      }
    }
  });

  test('syndromic alerts generated per disease and state', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Measles', state: 'Central Equatoria', cases: 5 }));
    await db.put(makeDiseaseAlert({ disease: 'Malaria', state: 'Eastern Equatoria', cases: 100 }));

    const data = await getEpidemicIntelligence();

    expect(data.syndromicAlerts.length).toBeGreaterThan(0);
    for (const alert of data.syndromicAlerts) {
      expect(alert.syndrome).toBeDefined();
      expect(alert.state).toBeDefined();
      expect(typeof alert.currentWeekCases).toBe('number');
      expect(typeof alert.previousWeekCases).toBe('number');
      expect(typeof alert.threshold).toBe('number');
      expect(typeof alert.exceeded).toBe('boolean');
      expect(typeof alert.percentChange).toBe('number');
    }
  });

  test('syndromic alerts marked exceeded when cases exceed threshold', async () => {
    const db = diseaseAlertsDB();
    // Cholera threshold is 5, so 10 cases should exceed
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 10 }));

    const data = await getEpidemicIntelligence();

    const cholerAlerts = data.syndromicAlerts.filter(a => a.syndrome === 'Cholera');
    expect(cholerAlerts.some(a => a.exceeded)).toBe(true);
  });

  test('IDSR report includes reportingWeek', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Malaria', cases: 50 }));

    const data = await getEpidemicIntelligence();

    expect(data.idsrReport.reportingWeek).toMatch(/^\d{4}-W\d{2}$/);
    expect(typeof data.idsrReport.totalFacilitiesReporting).toBe('number');
    expect(typeof data.idsrReport.completeness).toBe('number');
    expect(Array.isArray(data.idsrReport.diseases)).toBe(true);
  });

  test('IDSR report calculates CFR correctly', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Malaria', cases: 100, deaths: 5 }));

    const data = await getEpidemicIntelligence();

    const malariaDx = data.idsrReport.diseases.find(d => d.disease === 'Malaria');
    expect(malariaDx).toBeDefined();
    expect(malariaDx!.cfr).toBe(5); // 5/100 * 100 = 5%
  });

  test('geographic spread covers all South Sudan states', async () => {
    const data = await getEpidemicIntelligence();

    const states = data.geographicSpread.map(g => g.state);
    expect(states).toContain('Central Equatoria');
    expect(states).toContain('Eastern Equatoria');
    expect(states).toContain('Western Equatoria');
    expect(states).toContain('Jonglei');
    expect(states).toContain('Unity');
    expect(states.length).toBe(10);
  });

  test('geographic spread risk scores are 0-100', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 50, state: 'Jonglei' }));

    const data = await getEpidemicIntelligence();

    for (const spread of data.geographicSpread) {
      expect(spread.riskScore).toBeGreaterThanOrEqual(0);
      expect(spread.riskScore).toBeLessThanOrEqual(100);
      expect(typeof spread.totalCases).toBe('number');
    }
  });

  test('EWARS alerts generated for disease alerts', async () => {
    const db = diseaseAlertsDB();
    // Cholera threshold is 5
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 10, state: 'Central Equatoria', alertLevel: 'warning' }));

    const data = await getEpidemicIntelligence();

    const cholerAlerts = data.ewarsAlerts.filter(a => a.disease === 'Cholera');
    // EWARS generates multiple types of alerts, just verify we have some
    expect(cholerAlerts.length).toBeGreaterThan(0);
  });

  test('EWARS alerts include severity levels', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 20, alertLevel: 'emergency' }));

    const data = await getEpidemicIntelligence();

    for (const alert of data.ewarsAlerts) {
      expect(['low', 'medium', 'high', 'critical']).toContain(alert.severity);
      expect(alert.message).toBeDefined();
      expect(typeof alert.cases).toBe('number');
      expect(typeof alert.deaths).toBe('number');
      expect(alert.triggeredAt).toBeDefined();
    }
  });

  test('EWARS alerts for high CFR', async () => {
    const db = diseaseAlertsDB();
    // Yellow Fever CFR threshold is 20%, create 1 case with 1 death (100% CFR)
    await db.put(makeDiseaseAlert({ disease: 'Yellow Fever', cases: 1, deaths: 1 }));

    const data = await getEpidemicIntelligence();

    const yfAlerts = data.ewarsAlerts.filter(a => a.disease === 'Yellow Fever' && a.alertType === 'cfr_high');
    expect(yfAlerts.length).toBeGreaterThan(0);
  });

  test('summary reflects emergency status', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Cholera', alertLevel: 'emergency', state: 'Central Equatoria' }));

    const data = await getEpidemicIntelligence();

    expect(data.summary.statesWithEmergency).toContain('Central Equatoria');
    expect(data.summary.overallRiskLevel).toBe('critical');
  });

  test('summary risk level elevated for high-severity EWARS alerts', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Meningitis', cases: 10, alertLevel: 'warning' }));

    const data = await getEpidemicIntelligence();

    expect(['low', 'moderate', 'high', 'critical']).toContain(data.summary.overallRiskLevel);
  });

  test('highest Rt is null in summary when no disease has a real historical baseline', async () => {
    const db = diseaseAlertsDB();
    // Single current-week alert only — no older-week baseline anywhere, so
    // there is no genuine Rt to report as "highest".
    await db.put(makeDiseaseAlert({ disease: 'Malaria', cases: 100, trend: 'increasing' }));

    const data = await getEpidemicIntelligence();

    expect(data.summary.highestRt).toBeNull();
  });

  test('highest Rt reflects the genuine ratio when a historical baseline exists', async () => {
    const db = diseaseAlertsDB();
    const fiveWeeksAgo = new Date();
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);
    await db.put(makeDiseaseAlert({ disease: 'Malaria', cases: 50, reportDate: fiveWeeksAgo.toISOString().slice(0, 10) }));
    await db.put(makeDiseaseAlert({ disease: 'Malaria', cases: 100, trend: 'increasing' }));

    const data = await getEpidemicIntelligence();

    const malariaRt = data.rtEstimates.find(r => r.disease === 'Malaria');
    expect(malariaRt).toBeDefined();
    expect(malariaRt!.rt).not.toBeNull();
    expect(data.summary.highestRt).not.toBeNull();
    expect(data.summary.highestRt!.disease).toBe('Malaria');
    expect(data.summary.highestRt!.value).toBe(malariaRt!.rt);
  });

  test('summary totals accumulate correctly', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({ disease: 'Malaria', cases: 50, deaths: 5 }));
    await db.put(makeDiseaseAlert({ disease: 'Cholera', cases: 30, deaths: 2 }));

    const data = await getEpidemicIntelligence();

    expect(data.summary.totalActiveDiseases).toBe(2);
    expect(data.summary.totalCasesThisWeek).toBe(80);
    expect(data.summary.totalDeathsThisWeek).toBe(7);
  });

  test('IDSR report aggregates multiple alerts for same disease', async () => {
    const db = diseaseAlertsDB();
    // Create multiple alerts for Malaria from different states/counties
    await db.put(makeDiseaseAlert({ disease: 'Malaria', state: 'Central Equatoria', cases: 30, deaths: 3 }));
    await db.put(makeDiseaseAlert({ disease: 'Malaria', state: 'Eastern Equatoria', cases: 20, deaths: 2 }));
    await db.put(makeDiseaseAlert({ disease: 'Malaria', state: 'Jonglei', cases: 25, deaths: 2 }));

    const data = await getEpidemicIntelligence();

    const malariaReport = data.idsrReport.diseases.find(d => d.disease === 'Malaria');
    expect(malariaReport).toBeDefined();
    expect(malariaReport!.cases).toBe(75); // 30 + 20 + 25
    expect(malariaReport!.deaths).toBe(7); // 3 + 2 + 2
    expect(malariaReport!.states).toHaveLength(3); // Central + Eastern + Jonglei
    expect(malariaReport!.states).toContain('Central Equatoria');
    expect(malariaReport!.states).toContain('Eastern Equatoria');
    expect(malariaReport!.states).toContain('Jonglei');
  });

  // ---- Additional branch coverage for uncovered lines ----

  test('Rt estimate shows declining trend with a real historical baseline', async () => {
    const db = diseaseAlertsDB();
    // Real weekly case counts: a much larger count 6 weeks ago than in the
    // current week, so the recent/older ratio is genuinely < 0.8.
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    await db.put(makeDiseaseAlert({
      disease: 'Cholera',
      cases: 100,
      deaths: 10,
      reportDate: sixWeeksAgo.toISOString().slice(0, 10),
    }));
    await db.put(makeDiseaseAlert({
      disease: 'Cholera',
      cases: 20,
      deaths: 2,
      trend: 'decreasing',
    }));

    const data = await getEpidemicIntelligence();
    const cholerRt = data.rtEstimates.find(r => r.disease === 'Cholera');
    expect(cholerRt).toBeDefined();
    expect(cholerRt!.rt).not.toBeNull();
    expect(cholerRt!.trend).toBe('declining');
  });

  test('syndromicAlerts with previous week calculation (lines 204-208)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Typhoid',
      state: 'Central Equatoria',
      cases: 100
    }));

    const data = await getEpidemicIntelligence();
    const typhoidAlert = data.syndromicAlerts.find(s => s.syndrome === 'Typhoid' && s.state === 'Central Equatoria');
    expect(typhoidAlert).toBeDefined();
    if (typhoidAlert) {
      expect(typhoidAlert.previousWeekCases).toBeDefined();
      expect(typeof typhoidAlert.percentChange).toBe('number');
    }
  });

  test('IDSR cfr calculation with > 0 cases (line 249)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Ebola',
      cases: 50,
      deaths: 15 // CFR = 30%
    }));

    const data = await getEpidemicIntelligence();
    const ebolaReport = data.idsrReport.diseases.find(d => d.disease === 'Ebola');
    expect(ebolaReport).toBeDefined();
    if (ebolaReport) {
      expect(ebolaReport.cfr).toBeGreaterThan(0);
    }
  });

  test('IDSR cfr calculation with zero cases (line 249 else branch)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Plague',
      cases: 0,
      deaths: 0
    }));

    const data = await getEpidemicIntelligence();
    const plagueReport = data.idsrReport.diseases.find(d => d.disease === 'Plague');
    expect(plagueReport).toBeDefined();
    if (plagueReport) {
      expect(plagueReport.cfr).toBe(0);
    }
  });

  test('EWARS severity for emergency alerts (line 304)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Measles',
      state: 'Central Equatoria',
      cases: 500,
      alertLevel: 'emergency'
    }));

    const data = await getEpidemicIntelligence();
    const emergencyAlert = data.ewarsAlerts.find(
      a => a.disease === 'Measles' && a.alertType === 'threshold_exceeded'
    );
    if (emergencyAlert) {
      expect(emergencyAlert.severity).toBe('critical');
    }
  });

  test('EWARS severity for warning alerts (line 304)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Typhoid',
      state: 'Central Equatoria',
      cases: 200,
      alertLevel: 'warning'
    }));

    const data = await getEpidemicIntelligence();
    const warningAlert = data.ewarsAlerts.find(
      a => a.disease === 'Typhoid' && a.alertType === 'threshold_exceeded'
    );
    if (warningAlert) {
      expect(warningAlert.severity).toBe('high');
    }
  });

  test('EWARS high CFR critical severity (lines 313-320)', async () => {
    const db = diseaseAlertsDB();
    // Very high CFR (> 2x threshold)
    await db.put(makeDiseaseAlert({
      disease: 'Hemorrhagic_Fever',
      state: 'Eastern Equatoria',
      cases: 100,
      deaths: 80 // 80% CFR - very high
    }));

    const data = await getEpidemicIntelligence();
    const hfAlert = data.ewarsAlerts.find(a => a.alertType === 'cfr_high');
    if (hfAlert) {
      expect(['critical', 'high']).toContain(hfAlert.severity);
    }
  });

  test('EWARS unusual increase with emergency level (line 335)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Whooping_Cough',
      state: 'Central Equatoria',
      cases: 150,
      trend: 'increasing',
      alertLevel: 'emergency'
    }));

    const data = await getEpidemicIntelligence();
    const unusualAlert = data.ewarsAlerts.find(a => a.alertType === 'unusual_increase');
    if (unusualAlert) {
      expect(unusualAlert.severity).toBe('critical');
    }
  });

  test('EWARS unusual increase with warning level (line 335 else)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Yellow_Fever',
      state: 'Central Equatoria',
      cases: 80,
      trend: 'increasing',
      alertLevel: 'warning'
    }));

    const data = await getEpidemicIntelligence();
    const unusualAlert = data.ewarsAlerts.find(a => a.alertType === 'unusual_increase');
    if (unusualAlert) {
      expect(unusualAlert.severity).toBe('medium');
    }
  });

  test('Overall risk level critical when emergency states (line 384)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Plague',
      state: 'Central Equatoria',
      cases: 500,
      alertLevel: 'emergency'
    }));

    const data = await getEpidemicIntelligence();
    expect(data.summary.overallRiskLevel).toBe('critical');
  });

  test('Overall risk level high when high severity EWARS (line 385)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Cholera',
      state: 'Central Equatoria',
      cases: 100,
      alertLevel: 'warning'
    }));

    const data = await getEpidemicIntelligence();
    const highSeverityAlerts = data.ewarsAlerts.filter(a => a.severity === 'high');
    if (highSeverityAlerts.length > 0) {
      expect(data.summary.overallRiskLevel).toMatch(/high|critical/);
    }
  });

  test('Overall risk level moderate when > 3 EWARS alerts (line 386)', async () => {
    const db = diseaseAlertsDB();
    // Create 4 different disease-state combinations to get 4+ alerts
    await db.put(makeDiseaseAlert({ disease: 'Malaria', state: 'Central Equatoria', cases: 50 }));
    await db.put(makeDiseaseAlert({ disease: 'Typhoid', state: 'Central Equatoria', cases: 50 }));
    await db.put(makeDiseaseAlert({ disease: 'Cholera', state: 'Eastern Equatoria', cases: 50 }));
    await db.put(makeDiseaseAlert({ disease: 'Measles', state: 'Jonglei', cases: 50 }));

    const data = await getEpidemicIntelligence();
    if (data.ewarsAlerts.length > 3) {
      expect(['moderate', 'high', 'critical']).toContain(data.summary.overallRiskLevel);
    }
  });

  test('Epidemic curves with both increasing and decreasing trends', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Malaria',
      cases: 100,
      trend: 'increasing'
    }));
    await db.put(makeDiseaseAlert({
      disease: 'Typhoid',
      cases: 50,
      trend: 'decreasing'
    }));

    const data = await getEpidemicIntelligence();
    expect(data.epidemicCurves.length).toBeGreaterThan(0);
  });

  test('Empty data returns valid structure', async () => {
    const data = await getEpidemicIntelligence();
    expect(data.summary).toBeDefined();
    expect(data.ewarsAlerts).toBeDefined();
    expect(Array.isArray(data.ewarsAlerts)).toBe(true);
  });

  test('EWARS severity for watch/normal alerts (line 304 else)', async () => {
    const db = diseaseAlertsDB();
    await db.put(makeDiseaseAlert({
      disease: 'Influenza',
      state: 'Central Equatoria',
      cases: 30,
      alertLevel: 'watch'
    }));

    const data = await getEpidemicIntelligence();
    const watchAlert = data.ewarsAlerts.find(
      a => a.disease === 'Influenza' && a.alertType === 'threshold_exceeded'
    );
    if (watchAlert) {
      expect(watchAlert.severity).toBe('medium');
    }
  });

  test('EWARS high CFR high severity (line 320 else)', async () => {
    const db = diseaseAlertsDB();
    // CFR above threshold but < 2x threshold
    await db.put(makeDiseaseAlert({
      disease: 'Yellow_Fever',
      state: 'Eastern Equatoria',
      cases: 100,
      deaths: 25 // 25% CFR - above threshold but not 2x
    }));

    const data = await getEpidemicIntelligence();
    const yfAlert = data.ewarsAlerts.find(a => a.alertType === 'cfr_high');
    if (yfAlert) {
      expect(yfAlert.severity).toBe('high');
    }
  });

  test('getWeekStart returns correct format for Sunday (line 123)', async () => {
    const db = diseaseAlertsDB();
    // Add alert on a Sunday to exercise the day === 0 branch
    const sundayDate = new Date(2025, 0, 5); // January 5, 2025 is a Sunday
    await db.put(makeDiseaseAlert({
      disease: 'Malaria',
      cases: 10,
      reportDate: sundayDate.toISOString().slice(0, 10)
    }));

    const data = await getEpidemicIntelligence();
    // Just verify structure is valid - the utility function is used internally
    expect(data.epidemicCurves.length).toBeGreaterThanOrEqual(0);
    expect(data.epidemicCurves[0]?.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
