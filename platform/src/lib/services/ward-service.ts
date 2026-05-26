/**
 * Ward Management Service — handles ward/bed tracking, admissions,
 * discharges, and bed occupancy for inpatient facilities.
 *
 * Applicable to Level 3+ facilities (County, State, National hospitals).
 */
import { getDB } from '../db';
import type { WardDoc, BedDoc, AdmissionDoc, BedStatus } from '../db-types-ward';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';
import { v4 as uuidv4 } from 'uuid';
import { logAuditSafe } from './audit-service';

const wardDB = () => getDB('tamamhealth_wards');

// ===== Ward Operations =====

export async function getAllWards(scope?: DataScope): Promise<WardDoc[]> {
  const db = wardDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as WardDoc)
    .filter(d => d && d.type === 'ward')
    .sort((a, b) => a.name.localeCompare(b.name));
  return scope ? filterByScope(all, scope) : all;
}

export async function getWardById(id: string): Promise<WardDoc | null> {
  try {
    const db = wardDB();
    return await db.get(id) as WardDoc;
  } catch {
    return null;
  }
}

export async function createWard(data: Omit<WardDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'occupiedBeds' | 'availableBeds'>): Promise<WardDoc> {
  const db = wardDB();
  const now = new Date().toISOString();
  const doc: WardDoc = {
    _id: `ward-${uuidv4().slice(0, 8)}`,
    type: 'ward',
    ...data,
    occupiedBeds: 0,
    availableBeds: data.totalBeds,
    createdAt: now,
    updatedAt: now,
  };
  const resp = await db.put(doc);
  doc._rev = resp.rev;
  await logAuditSafe('WARD_CREATED', undefined, undefined, `Ward ${doc.name} created at ${doc.facilityName}`);
  return doc;
}

// ===== Bed Operations =====

export async function getBedsByWard(wardId: string): Promise<BedDoc[]> {
  const db = wardDB();
  const result = await db.allDocs({ include_docs: true });
  return result.rows
    .map(r => r.doc as BedDoc)
    .filter(d => d && d.type === 'bed' && d.wardId === wardId)
    .sort((a, b) => a.bedNumber.localeCompare(b.bedNumber));
}

export async function getAvailableBeds(wardId: string): Promise<BedDoc[]> {
  const beds = await getBedsByWard(wardId);
  return beds.filter(b => b.status === 'available');
}

export async function updateBedStatus(bedId: string, status: BedStatus, patientId?: string, patientName?: string, admissionId?: string): Promise<BedDoc | null> {
  const db = wardDB();
  try {
    const bed = await db.get(bedId) as BedDoc;
    bed.status = status;
    bed.currentPatientId = patientId;
    bed.currentPatientName = patientName;
    bed.currentAdmissionId = admissionId;
    if (status === 'available') {
      bed.currentPatientId = undefined;
      bed.currentPatientName = undefined;
      bed.currentAdmissionId = undefined;
      bed.lastCleanedAt = new Date().toISOString();
    }
    bed.updatedAt = new Date().toISOString();
    const resp = await db.put(bed);
    bed._rev = resp.rev;
    return bed;
  } catch {
    return null;
  }
}

// ===== Admission Operations =====

export async function getAllAdmissions(scope?: DataScope): Promise<AdmissionDoc[]> {
  const db = wardDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as AdmissionDoc)
    .filter(d => d && d.type === 'admission');
  /* istanbul ignore next -- defensive null-safety in sort */
  all.sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''));
  return scope ? filterByScope(all, scope) : all;
}

export async function getActiveAdmissions(scope?: DataScope): Promise<AdmissionDoc[]> {
  const all = await getAllAdmissions(scope);
  return all.filter(a => a.status === 'admitted');
}

export async function getAdmissionsByPatient(patientId: string): Promise<AdmissionDoc[]> {
  const all = await getAllAdmissions();
  return all.filter(a => a.patientId === patientId);
}

export interface AdmitPatientInput {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  admittingDiagnosis: string;
  icd11Code?: string;
  severity: AdmissionDoc['severity'];
  admittedBy: string;
  admittedByName: string;
  wardId: string;
  wardName: string;
  bedId?: string;
  bedNumber?: string;
  facilityId: string;
  facilityName: string;
  facilityLevel: AdmissionDoc['facilityLevel'];
  attendingPhysician: string;
  attendingPhysicianName: string;
  nurseAssigned?: string;
  nurseAssignedName?: string;
  dietaryRequirements?: string;
  isolationRequired?: boolean;
  isolationReason?: string;
  state: string;
  county?: string;
  orgId?: string;
}

export async function admitPatient(data: AdmitPatientInput): Promise<AdmissionDoc> {
  const db = wardDB();
  const now = new Date().toISOString();

  const doc: AdmissionDoc = {
    _id: `adm-${uuidv4().slice(0, 8)}`,
    type: 'admission',
    ...data,
    admissionDate: now,
    isolationRequired: data.isolationRequired || false,
    status: 'admitted',
    followUpRequired: false,
    createdAt: now,
    updatedAt: now,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;

  // Update bed status if a bed was assigned
  if (data.bedId) {
    await updateBedStatus(data.bedId, 'occupied', data.patientId, data.patientName, doc._id);
  }

  // Update ward occupancy
  await updateWardOccupancy(data.wardId);

  await logAuditSafe(
    'PATIENT_ADMITTED', data.admittedBy, data.admittedByName,
    `Admitted ${data.patientName} to ${data.wardName} (${data.admittingDiagnosis})`
  );

  return doc;
}

export async function dischargePatient(
  admissionId: string,
  dischargeData: {
    dischargeType: AdmissionDoc['dischargeType'];
    dischargeDiagnosis?: string;
    dischargeIcd11?: string;
    dischargeSummary?: string;
    dischargedBy: string;
    dischargedByName: string;
    followUpRequired?: boolean;
    followUpDate?: string;
    followUpInstructions?: string;
  }
): Promise<AdmissionDoc | null> {
  const db = wardDB();
  try {
    const admission = await db.get(admissionId) as AdmissionDoc;
    const now = new Date().toISOString();

    admission.status = dischargeData.dischargeType === 'death' ? 'deceased' : 'discharged';
    admission.dischargeDate = now;
    admission.dischargeType = dischargeData.dischargeType;
    admission.dischargeDiagnosis = dischargeData.dischargeDiagnosis;
    admission.dischargeIcd11 = dischargeData.dischargeIcd11;
    admission.dischargeSummary = dischargeData.dischargeSummary;
    admission.dischargedBy = dischargeData.dischargedBy;
    admission.dischargedByName = dischargeData.dischargedByName;
    admission.followUpRequired = dischargeData.followUpRequired || false;
    admission.followUpDate = dischargeData.followUpDate;
    admission.followUpInstructions = dischargeData.followUpInstructions;

    // Calculate length of stay
    const admDate = new Date(admission.admissionDate);
    const discDate = new Date(now);
    admission.lengthOfStay = Math.max(1, Math.ceil((discDate.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)));

    admission.updatedAt = now;
    const resp = await db.put(admission);
    admission._rev = resp.rev;

    // Free the bed
    if (admission.bedId) {
      await updateBedStatus(admission.bedId, 'cleaning');
    }

    // Update ward occupancy
    await updateWardOccupancy(admission.wardId);

    await logAuditSafe(
      'PATIENT_DISCHARGED', dischargeData.dischargedBy, dischargeData.dischargedByName,
      `Discharged ${admission.patientName} from ${admission.wardName} (LOS: ${admission.lengthOfStay}d)`
    );

    return admission;
  } catch {
    return null;
  }
}

/**
 * Recalculate and update ward occupancy counts.
 */
async function updateWardOccupancy(wardId: string): Promise<void> {
  const db = wardDB();
  try {
    const ward = await db.get(wardId) as WardDoc;
    const beds = await getBedsByWard(wardId);
    ward.occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    ward.availableBeds = ward.totalBeds - ward.occupiedBeds;
    ward.updatedAt = new Date().toISOString();
    await db.put(ward);
  } catch {
    // Ward occupancy update is best-effort
  }
}

/**
 * Get occupancy statistics across all wards for a facility.
 */
export async function getOccupancyStats(facilityId: string): Promise<{
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  wardBreakdown: { wardName: string; wardType: string; totalBeds: number; occupiedBeds: number; availableBeds: number }[];
}> {
  const wards = await getAllWards();
  const facilityWards = wards.filter(w => w.facilityId === facilityId && w.isActive);

  const totalBeds = facilityWards.reduce((s, w) => s + w.totalBeds, 0);
  const occupiedBeds = facilityWards.reduce((s, w) => s + w.occupiedBeds, 0);
  const availableBeds = totalBeds - occupiedBeds;

  return {
    totalBeds,
    occupiedBeds,
    availableBeds,
    occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    wardBreakdown: facilityWards.map(w => ({
      wardName: w.name,
      wardType: w.wardType,
      totalBeds: w.totalBeds,
      occupiedBeds: w.occupiedBeds,
      availableBeds: w.availableBeds,
    })),
  };
}
