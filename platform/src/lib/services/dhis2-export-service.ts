import { getAllBirths, getBirthStats } from './birth-service';
import { getAllDeaths, getDeathStats } from './death-service';
import { getAllAssessments } from './facility-assessment-service';
import { getNationalDataQuality } from './data-quality-service';
import { hospitalsDB, patientsDB, referralsDB, diseaseAlertsDB, labResultsDB, prescriptionsDB, immunizationsDB, ancDB } from '../db';
import type { HospitalDoc, PatientDoc, ReferralDoc, DiseaseAlertDoc, LabResultDoc, PrescriptionDoc, ImmunizationDoc, ANCVisitDoc } from '../db-types';
import { findByType } from './db-query';

// DHIS2 only accepts compact period codes (YYYYMM / YYYYWww / YYYY) — accept
// the HTML-friendly YYYY-MM the UI emits but reject anything else.
export function normalizeDhis2Period(period: string, frequency: 'monthly' | 'weekly' | 'yearly' = 'monthly'): string {
  if (frequency === 'monthly') {
    const m = /^(\d{4})-?(\d{2})$/.exec(period);
    if (m) return `${m[1]}${m[2]}`;
  } else if (frequency === 'yearly') {
    if (/^\d{4}$/.test(period)) return period;
  } else if (frequency === 'weekly') {
    const m = /^(\d{4})-?W(\d{2})$/.exec(period);
    if (m) return `${m[1]}W${m[2]}`;
  }
  throw new Error('Invalid DHIS2 period format: ' + period);
}

// An aggregate emitted at the wrong level shows up at DHIS2 as a national
// submission — scope down to facility/payam/org when present, only fall
// back to 'SS' for truly national exporters.
export function aggregateOrgUnit(scope?: { hospitalId?: string; orgId?: string; role?: string }): string {
  if (!scope) return 'SS';
  if (scope.hospitalId) return scope.hospitalId;
  if (scope.orgId) return scope.orgId;
  return 'SS';
}

export interface DHIS2ExportScope {
  hospitalId?: string;
  orgId?: string;
  role?: string;
}

export interface DHIS2DataSet {
  exportDate: string;
  period: string;
  orgUnit: string;
  dataValues: DHIS2DataValue[];
}

export interface DHIS2DataValue {
  dataElement: string;
  category: string;
  value: string;
  period: string;
  orgUnit: string;
}

export async function generateDHIS2Export(
  rawPeriod: string,
  scope?: DHIS2ExportScope,
  frequency: 'monthly' | 'weekly' | 'yearly' = 'monthly',
): Promise<DHIS2DataSet> {
  const period = normalizeDhis2Period(rawPeriod, frequency);
  const orgUnit = aggregateOrgUnit(scope);
  const now = new Date().toISOString();

  // Gather all data
  const hDB = hospitalsDB();
  const hospitals = await findByType<HospitalDoc>(hDB, 'hospital');

  const pDB = patientsDB();
  const patients = await findByType<PatientDoc>(pDB, 'patient');

  const rDB = referralsDB();
  const referrals = await findByType<ReferralDoc>(rDB, 'referral');

  const daDB = diseaseAlertsDB();
  const alerts = await findByType<DiseaseAlertDoc>(daDB, 'disease_alert');

  const birthStats = await getBirthStats();
  const deathStats = await getDeathStats();
  const births = await getAllBirths();
  const deaths = await getAllDeaths();
  const assessments = await getAllAssessments();
  const dataQuality = await getNationalDataQuality();

  // Lab data
  const labDB = labResultsDB();
  const labResults = await findByType<LabResultDoc>(labDB, 'lab_result');

  // Prescription data
  const rxDB = prescriptionsDB();
  const prescriptions = await findByType<PrescriptionDoc>(rxDB, 'prescription');

  // Immunization data
  const immDB = immunizationsDB();
  const immunizations = await findByType<ImmunizationDoc>(immDB, 'immunization');

  // ANC data
  const ancDatabase = ancDB();
  const ancVisits = await findByType<ANCVisitDoc>(ancDatabase, 'anc_visit');

  const dataValues: DHIS2DataValue[] = [];

  // Population health indicators
  dataValues.push(
    { dataElement: 'TOTAL_HOSPITALS', category: 'default', value: hospitals.length.toString(), period, orgUnit },
    { dataElement: 'TOTAL_PATIENTS', category: 'default', value: patients.length.toString(), period, orgUnit },
    { dataElement: 'TOTAL_BEDS', category: 'default', value: hospitals.reduce((s, h) => s + h.totalBeds, 0).toString(), period, orgUnit },
    { dataElement: 'TOTAL_DOCTORS', category: 'default', value: hospitals.reduce((s, h) => s + h.doctors, 0).toString(), period, orgUnit },
    { dataElement: 'TOTAL_NURSES', category: 'default', value: hospitals.reduce((s, h) => s + h.nurses, 0).toString(), period, orgUnit },
    { dataElement: 'TOTAL_CLINICAL_OFFICERS', category: 'default', value: hospitals.reduce((s, h) => s + h.clinicalOfficers, 0).toString(), period, orgUnit },
  );

  // CRVS indicators
  dataValues.push(
    { dataElement: 'BIRTHS_REGISTERED', category: 'default', value: birthStats.total.toString(), period, orgUnit },
    { dataElement: 'BIRTHS_MALE', category: 'male', value: birthStats.byGender.male.toString(), period, orgUnit },
    { dataElement: 'BIRTHS_FEMALE', category: 'female', value: birthStats.byGender.female.toString(), period, orgUnit },
    { dataElement: 'BIRTHS_CAESAREAN', category: 'default', value: birthStats.byDeliveryType.caesarean.toString(), period, orgUnit },
    { dataElement: 'DEATHS_REGISTERED', category: 'default', value: deathStats.total.toString(), period, orgUnit },
    { dataElement: 'DEATHS_WITH_ICD11', category: 'default', value: deathStats.withICD11Code.toString(), period, orgUnit },
    { dataElement: 'MATERNAL_DEATHS', category: 'default', value: deathStats.maternalDeaths.toString(), period, orgUnit },
    { dataElement: 'UNDER5_DEATHS', category: 'default', value: deathStats.under5Deaths.toString(), period, orgUnit },
    { dataElement: 'NEONATAL_DEATHS', category: 'default', value: deathStats.neonatalDeaths.toString(), period, orgUnit },
    { dataElement: 'DEATH_NOTIFICATION_RATE', category: 'default', value: deathStats.total ? Math.round(deathStats.notified / deathStats.total * 100).toString() : '0', period, orgUnit },
    { dataElement: 'DEATH_REGISTRATION_RATE', category: 'default', value: deathStats.total ? Math.round(deathStats.registered / deathStats.total * 100).toString() : '0', period, orgUnit },
  );

  // Disease surveillance
  dataValues.push(
    { dataElement: 'ACTIVE_DISEASE_ALERTS', category: 'default', value: alerts.filter(a => a.alertLevel === 'emergency' || a.alertLevel === 'warning').length.toString(), period, orgUnit },
    { dataElement: 'TOTAL_REFERRALS', category: 'default', value: referrals.length.toString(), period, orgUnit },
  );

  // Lab indicators
  const labCompleted = labResults.filter(l => l.status === 'completed').length;
  const labPending = labResults.filter(l => l.status === 'pending').length;
  const labInProgress = labResults.filter(l => l.status === 'in_progress').length;
  const labCritical = labResults.filter(l => l.critical).length;
  dataValues.push(
    { dataElement: 'LAB_TESTS_TOTAL', category: 'default', value: labResults.length.toString(), period, orgUnit },
    { dataElement: 'LAB_TESTS_COMPLETED', category: 'default', value: labCompleted.toString(), period, orgUnit },
    { dataElement: 'LAB_TESTS_PENDING', category: 'default', value: labPending.toString(), period, orgUnit },
    { dataElement: 'LAB_TESTS_IN_PROGRESS', category: 'default', value: labInProgress.toString(), period, orgUnit },
    { dataElement: 'LAB_CRITICAL_RESULTS', category: 'default', value: labCritical.toString(), period, orgUnit },
  );

  // Prescription indicators
  const rxDispensed = prescriptions.filter(p => p.status === 'dispensed').length;
  const rxPending = prescriptions.filter(p => p.status === 'pending').length;
  dataValues.push(
    { dataElement: 'PRESCRIPTIONS_TOTAL', category: 'default', value: prescriptions.length.toString(), period, orgUnit },
    { dataElement: 'PRESCRIPTIONS_DISPENSED', category: 'default', value: rxDispensed.toString(), period, orgUnit },
    { dataElement: 'PRESCRIPTIONS_PENDING', category: 'default', value: rxPending.toString(), period, orgUnit },
  );

  // Immunization indicators
  const bcgCompleted = immunizations.filter(i => i.vaccine === 'BCG' && i.status === 'completed').length;
  const penta3Completed = immunizations.filter(i => i.vaccine === 'Penta' && i.doseNumber === 3 && i.status === 'completed').length;
  const measles1Completed = immunizations.filter(i => i.vaccine === 'Measles' && i.doseNumber === 1 && i.status === 'completed').length;
  const immDefaulters = immunizations.filter(i => i.status === 'overdue' || i.status === 'missed').length;
  const uniqueChildren = new Set(immunizations.map(i => i.patientId)).size;
  dataValues.push(
    { dataElement: 'IMM_CHILDREN_TOTAL', category: 'default', value: uniqueChildren.toString(), period, orgUnit },
    { dataElement: 'IMM_BCG_COMPLETED', category: 'default', value: bcgCompleted.toString(), period, orgUnit },
    { dataElement: 'IMM_PENTA3_COMPLETED', category: 'default', value: penta3Completed.toString(), period, orgUnit },
    { dataElement: 'IMM_MEASLES1_COMPLETED', category: 'default', value: measles1Completed.toString(), period, orgUnit },
    { dataElement: 'IMM_DEFAULTERS', category: 'default', value: immDefaulters.toString(), period, orgUnit },
    { dataElement: 'IMM_BCG_COVERAGE', category: 'default', value: uniqueChildren > 0 ? Math.round(bcgCompleted / uniqueChildren * 100).toString() : '0', period, orgUnit },
    { dataElement: 'IMM_PENTA3_COVERAGE', category: 'default', value: uniqueChildren > 0 ? Math.round(penta3Completed / uniqueChildren * 100).toString() : '0', period, orgUnit },
    { dataElement: 'IMM_MEASLES1_COVERAGE', category: 'default', value: uniqueChildren > 0 ? Math.round(measles1Completed / uniqueChildren * 100).toString() : '0', period, orgUnit },
  );

  // ANC indicators
  const uniqueMothers = new Set(ancVisits.map(a => a.motherId)).size;
  const anc4Plus = new Map<string, number>();
  ancVisits.forEach(a => {
    anc4Plus.set(a.motherId, (anc4Plus.get(a.motherId) || 0) + 1);
  });
  const mothersWithANC4Plus = [...anc4Plus.values()].filter(v => v >= 4).length;
  const highRiskMothers = new Set(ancVisits.filter(a => a.riskLevel === 'high').map(a => a.motherId)).size;
  dataValues.push(
    { dataElement: 'ANC_MOTHERS_TOTAL', category: 'default', value: uniqueMothers.toString(), period, orgUnit },
    { dataElement: 'ANC_VISITS_TOTAL', category: 'default', value: ancVisits.length.toString(), period, orgUnit },
    { dataElement: 'ANC_4PLUS_VISITS', category: 'default', value: mothersWithANC4Plus.toString(), period, orgUnit },
    { dataElement: 'ANC_HIGH_RISK', category: 'default', value: highRiskMothers.toString(), period, orgUnit },
  );

  // Data quality indicators (from WHO report)
  dataValues.push(
    { dataElement: 'REPORTING_COMPLETENESS', category: 'default', value: dataQuality.avgCompleteness.toString(), period, orgUnit },
    { dataElement: 'REPORTING_TIMELINESS', category: 'default', value: dataQuality.avgTimeliness.toString(), period, orgUnit },
    { dataElement: 'DATA_QUALITY_SCORE', category: 'default', value: dataQuality.avgQuality.toString(), period, orgUnit },
    { dataElement: 'DHIS2_ADOPTION_RATE', category: 'default', value: dataQuality.dhis2Adoption.toString(), period, orgUnit },
    { dataElement: 'FACILITIES_ASSESSED', category: 'default', value: assessments.length.toString(), period, orgUnit },
    { dataElement: 'HIS_WORKFORCE', category: 'default', value: dataQuality.totalHISStaff.toString(), period, orgUnit },
  );

  // Per-facility births/deaths — emit zeros so a facility that reported 0 is
  // distinguishable from a facility that didn't report at all.
  for (const h of hospitals) {
    const fBirths = births.filter(b => b.facilityId === h._id).length;
    const fDeaths = deaths.filter(d => d.facilityId === h._id).length;
    dataValues.push({ dataElement: 'FACILITY_BIRTHS', category: 'default', value: fBirths.toString(), period, orgUnit: h._id });
    dataValues.push({ dataElement: 'FACILITY_DEATHS', category: 'default', value: fDeaths.toString(), period, orgUnit: h._id });
  }

  return {
    exportDate: now,
    period,
    orgUnit,
    dataValues,
  };
}

export function exportToJSON(dataset: DHIS2DataSet): string {
  return JSON.stringify(dataset, null, 2);
}

/**
 * Push a generated dataset to the configured DHIS2 server.
 * Reads NEXT_PUBLIC_DHIS2_BASE_URL (e.g. https://hmis.southsudan.health) and
 * sends the dataset as a `dataValueSets` POST. Returns a structured outcome
 * so the UI can show "queued for retry" on a flaky network without a
 * try/catch wrapper at every call site.
 */
export interface DHIS2PushResult {
  ok: boolean;
  status: 'pushed' | 'queued' | 'unconfigured' | 'failed';
  pushed?: number;
  message: string;
}

export async function pushDataSetToDHIS2(
  dataset: DHIS2DataSet,
  options: { baseUrl?: string; authHeader?: string; signal?: AbortSignal } = {},
): Promise<DHIS2PushResult> {
  // Server-side prefers DHIS2_BASE_URL (private, no NEXT_PUBLIC prefix) with
  // DHIS2_USER / DHIS2_PASSWORD or DHIS2_PAT credentials so the live-push
  // endpoint can assemble an authenticated request without leaking creds to
  // the browser. Falls back to the client-facing NEXT_PUBLIC_* for legacy UI
  // code and to blank (returns 'unconfigured') when neither is set.
  const baseUrl = options.baseUrl
    || (typeof process !== 'undefined' ? (process.env.DHIS2_BASE_URL || process.env.NEXT_PUBLIC_DHIS2_BASE_URL) : '')
    || '';
  if (!baseUrl) {
    return {
      ok: true,
      status: 'unconfigured',
      message: 'No DHIS2 server configured (DHIS2_BASE_URL unset). Export prepared locally — sync when online.',
    };
  }

  // Auto-compose Authorization header from env if caller didn't pass one.
  if (!options.authHeader && typeof process !== 'undefined') {
    const pat = process.env.DHIS2_PAT;
    const user = process.env.DHIS2_USER;
    const pass = process.env.DHIS2_PASSWORD;
    if (pat) {
      options = { ...options, authHeader: `ApiToken ${pat}` };
    } else if (user && pass) {
      const b64 = Buffer.from(`${user}:${pass}`).toString('base64');
      options = { ...options, authHeader: `Basic ${b64}` };
    }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: true,
      status: 'queued',
      message: 'Offline — sync queued for retry when network returns.',
    };
  }

  // Retry policy: DHIS2 servers commonly throttle (429) or take downtime for
  // backups (502/503/504). A naive single-shot push fails the export silently,
  // even though the next attempt seconds later would succeed. Three tries with
  // capped exponential backoff (250ms → 1s → 4s) cover the common transient
  // window without holding the user / cron up indefinitely. We DO NOT retry
  // 4xx errors other than 429: those are client-side problems (auth, payload
  // shape) where retry just wastes the operator's time.
  const url = `${baseUrl.replace(/\/$/, '')}/api/dataValueSets`;
  const body = JSON.stringify({
    period: dataset.period,
    orgUnit: dataset.orgUnit,
    completeDate: dataset.exportDate,
    dataValues: dataset.dataValues,
  });
  const headers = {
    'Content-Type': 'application/json',
    ...(options.authHeader ? { Authorization: options.authHeader } : {}),
  };
  const MAX_ATTEMPTS = 3;
  const isRetryableStatus = (s: number) => s === 408 || s === 429 || (s >= 500 && s < 600);
  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  let lastErr: { status: number | null; message: string } = { status: null, message: '' };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body, signal: options.signal });
      if (res.ok) {
        return {
          ok: true,
          status: 'pushed',
          pushed: dataset.dataValues?.length ?? 0,
          message: `Pushed ${dataset.dataValues?.length ?? 0} data values to DHIS2.`,
        };
      }
      const text = await res.text().catch(() => '');
      lastErr = { status: res.status, message: `DHIS2 server responded ${res.status}${text ? ': ' + text.slice(0, 200) : ''}` };
      if (!isRetryableStatus(res.status) || attempt === MAX_ATTEMPTS) {
        return { ok: false, status: 'failed', message: lastErr.message };
      }
    } catch (err) {
      // AbortError (caller cancelled) — propagate immediately, do NOT retry.
      const name = (err as Error)?.name;
      if (name === 'AbortError') {
        return { ok: false, status: 'failed', message: 'Push aborted by caller' };
      }
      lastErr = { status: null, message: `Network error: ${(err as Error).message}` };
      if (attempt === MAX_ATTEMPTS) {
        return { ok: false, status: 'failed', message: lastErr.message };
      }
    }
    // Backoff: 250ms, 1s, 4s. Jittered slightly so retries from many clients
    // don't synchronize against a flapping DHIS2 box.
    const base = 250 * Math.pow(4, attempt - 1);
    const jitter = Math.floor(Math.random() * 100);
    await sleep(base + jitter);
  }
  return { ok: false, status: 'failed', message: lastErr.message || 'Unknown error' };
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportToCSV(dataset: DHIS2DataSet): string {
  const header = 'dataElement,category,value,period,orgUnit';
  const rows = dataset.dataValues.map(v =>
    [v.dataElement, v.category, v.value, v.period, v.orgUnit].map(escapeCSV).join(',')
  );
  return [header, ...rows].join('\n');
}
