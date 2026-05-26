import { hospitalsDB } from '../db';
import type { HospitalDoc } from '../db-types';
import { getAllAssessments } from './facility-assessment-service';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';

export interface DataCompletenessEntry {
  facilityId: string;
  facilityName: string;
  state: string;
  reportingCompleteness: number;  // 0-100
  reportingTimeliness: number;    // 0-100
  dataQualityScore: number;       // 0-100
  hasDHIS2: boolean;
  hisStaffCount: number;
  lastAssessmentDate: string;
}

export interface NationalDataQuality {
  avgCompleteness: number;
  avgTimeliness: number;
  avgQuality: number;
  facilitiesReporting: number;
  totalFacilities: number;
  completenessRate: number;        // % of facilities with >80% completeness
  dhis2Adoption: number;           // % facilities using DHIS2
  totalHISStaff: number;
  facilitiesWithTrainedStaff: number;
  entries: DataCompletenessEntry[];
}

export async function getNationalDataQuality(scope?: DataScope): Promise<NationalDataQuality> {
  const hDB = hospitalsDB();
  const hResult = await hDB.allDocs({ include_docs: true });
  let hospitals = hResult.rows
    .map(r => r.doc as HospitalDoc)
    .filter(d => d && d.type === 'hospital');

  // Tenant scoping — non-government users only see their own org/hospital.
  // Hospitals docs don't always have an explicit hospitalId field; the data
  // scope helper recognizes _id as an alias when no hospitalId is present.
  if (scope) {
    hospitals = filterByScope(
      hospitals.map(h => ({ ...h, hospitalId: (h as HospitalDoc & { hospitalId?: string }).hospitalId ?? h._id })),
      scope,
    ) as HospitalDoc[];
  }

  const assessments = await getAllAssessments(scope);

  // Latest assessment per facility
  const latestAssessment: Record<string, typeof assessments[0]> = {};
  for (const a of assessments) {
    if (!latestAssessment[a.facilityId] || a.assessmentDate > latestAssessment[a.facilityId].assessmentDate) {
      latestAssessment[a.facilityId] = a;
    }
  }

  const entries: DataCompletenessEntry[] = hospitals.map(h => {
    const assessment = latestAssessment[h._id];
    return {
      facilityId: h._id,
      facilityName: h.name,
      state: h.state,
      reportingCompleteness: assessment?.reportingCompleteness ?? 0,
      reportingTimeliness: assessment?.reportingTimeliness ?? 0,
      dataQualityScore: assessment?.dataQualityScore ?? 0,
      hasDHIS2: assessment?.hasDHIS2Reporting ?? false,
      hisStaffCount: assessment?.hisStaffCount ?? 0,
      lastAssessmentDate: assessment?.assessmentDate ?? '',
    };
  });

  const assessed = entries.filter(e => e.lastAssessmentDate);
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  // All percentage rates use `assessed.length` as the denominator. Mixing
  // `hospitals.length` (as `dhis2Adoption` did previously) drags every metric
  // toward zero whenever a facility has not been assessed yet, which is
  // misleading: the dashboard reports the share of *assessed* facilities
  // adopting DHIS2, not the share of all facilities. `facilitiesReporting`
  // and `totalFacilities` are surfaced separately for callers that need the
  // unassessed-vs-total picture.
  return {
    avgCompleteness: avg(assessed.map(e => e.reportingCompleteness)),
    avgTimeliness: avg(assessed.map(e => e.reportingTimeliness)),
    avgQuality: avg(assessed.map(e => e.dataQualityScore)),
    facilitiesReporting: assessed.length,
    totalFacilities: hospitals.length,
    completenessRate: assessed.length === 0 ? 0 : Math.round(assessed.filter(e => e.reportingCompleteness >= 80).length / assessed.length * 100),
    dhis2Adoption: assessed.length === 0 ? 0 : Math.round(assessed.filter(e => e.hasDHIS2).length / assessed.length * 100),
    totalHISStaff: assessed.reduce((s, e) => s + e.hisStaffCount, 0),
    facilitiesWithTrainedStaff: assessed.filter(e => e.hisStaffCount > 0).length,
    entries: entries.sort((a, b) => b.reportingCompleteness - a.reportingCompleteness),
  };
}
