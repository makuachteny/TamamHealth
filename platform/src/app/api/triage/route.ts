/**
 * API: /api/triage
 * GET  — List triage encounters (supports ?status=pending&patientId=xxx)
 * POST — Create a new triage assessment (ETAT model)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthPayload, unauthorized, forbidden, hasRole, serverError, logApiError,
} from '@/lib/api-auth';
import { withAuditLog } from '@/lib/audit/with-audit';
import type { UserRole, TriageDoc, TriagePriority } from '@/lib/db-types';
const READ_ROLES: UserRole[] = [
  'super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse',
  'front_desk', 'medical_superintendent',
];
const CREATE_ROLES: UserRole[] = [
  'super_admin', 'doctor', 'clinical_officer', 'nurse', 'front_desk',
  'medical_superintendent',
];
/**
 * Auto-calculate ETAT priority from ABCC assessment.
 * RED = any emergency sign; YELLOW = priority sign; GREEN = non-urgent.
 */
function calculatePriority(data: Record<string, unknown>): TriagePriority {
  if (
    data.airway === 'obstructed' ||
    data.breathing === 'absent' ||
    data.circulation === 'absent' ||
    data.consciousness === 'unresponsive'
  ) {
    return 'RED';
  }
  if (
    data.breathing === 'distressed' ||
    data.circulation === 'impaired' ||
    data.consciousness === 'pain' ||
    data.consciousness === 'verbal'
  ) {
    return 'YELLOW';
  }
  return 'GREEN';
}
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, READ_ROLES)) return forbidden();
    const { getDB } = await import('@/lib/db');
    const db = getDB('tamamhealth_triage');
    const result = await db.allDocs({ include_docs: true });
    let docs = result.rows
      .map(r => r.doc as TriageDoc)
      .filter(d => d && d.type === 'triage')
      .sort((a, b) => (b.triagedAt || '').localeCompare(a.triagedAt || ''));
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const patientId = url.searchParams.get('patientId');
    if (status) docs = docs.filter(d => d.status === status);
    if (patientId) docs = docs.filter(d => d.patientId === patientId);
    return NextResponse.json({ triageRecords: docs, total: docs.length });
  } catch (err) {
    logApiError('[API /triage GET]', err);
    return serverError();
  }
}
async function postHandler(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) return unauthorized();
    if (!hasRole(auth, CREATE_ROLES)) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { sanitizePayload } = await import('@/lib/validation');
    body = sanitizePayload(body);
    if (!body.patientId || !body.patientName) {
      return NextResponse.json(
        { error: 'patientId and patientName are required' },
        { status: 400 }
      );
    }
    // Auto-calculate priority if not explicitly set
    if (!body.priority) {
      body.priority = calculatePriority(body);
    }
    const { v4: uuidv4 } = await import('uuid');
    const { getDB } = await import('@/lib/db');
    const db = getDB('tamamhealth_triage');
    const now = new Date().toISOString();
    const doc: TriageDoc = {
      _id: `triage-${uuidv4().slice(0, 8)}`,
      type: 'triage',
      patientId: body.patientId as string,
      patientName: body.patientName as string,
      hospitalNumber: body.hospitalNumber as string | undefined,
      airway: (body.airway as TriageDoc['airway']) || 'clear',
      breathing: (body.breathing as TriageDoc['breathing']) || 'normal',
      circulation: (body.circulation as TriageDoc['circulation']) || 'normal',
      consciousness: (body.consciousness as TriageDoc['consciousness']) || 'alert',
      priority: body.priority as TriagePriority,
      temperature: body.temperature as string | undefined,
      pulse: body.pulse as string | undefined,
      respiratoryRate: body.respiratoryRate as string | undefined,
      systolic: body.systolic as string | undefined,
      diastolic: body.diastolic as string | undefined,
      oxygenSaturation: body.oxygenSaturation as string | undefined,
      weight: body.weight as string | undefined,
      chiefComplaint: body.chiefComplaint as string | undefined,
      notes: body.notes as string | undefined,
      triagedBy: auth.sub,
      triagedByName: auth.name,
      triagedAt: now,
      facilityId: auth.hospitalId,
      facilityName: body.facilityName as string | undefined,
      orgId: auth.orgId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const resp = await db.put(doc);
    doc._rev = resp.rev;
    return NextResponse.json({ triage: doc }, { status: 201 });
  } catch (err) {
    logApiError('[API /triage POST]', err);
    return serverError();
  }
}
export const POST = withAuditLog(postHandler, { action: 'triage.create' });
