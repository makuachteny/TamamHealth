/**
 * Transfer permissions.
 *
 * Capability alone must never be enough. Each test below pairs a role that HAS
 * the capability with a relationship that should still block it — those pairs
 * are where a naive `hasRole()` check would wrongly allow the action.
 */
import {
  canRequestTransfer,
  canDecideTransfer,
  canCancelTransfer,
  canForceTransfer,
  isOnCareTeam,
  hasTransferCapability,
  TRANSFER_WRITE_ROLES,
  TRANSFER_READ_ROLES,
} from '@/lib/services/patient-transfer-permissions';
import type { AuthPayload } from '@/lib/api-auth';
import type { PatientDoc, PatientTransferDoc, UserRole } from '@/lib/db-types';

function auth(role: UserRole, sub = 'user-1', extra: Partial<AuthPayload> = {}): AuthPayload {
  return {
    sub,
    username: sub,
    name: sub,
    role,
    hospitalId: 'hosp-1',
    orgId: 'org-1',
    ...extra,
  };
}

function patient(overrides: Partial<PatientDoc> = {}): PatientDoc {
  return {
    _id: 'pat-1',
    assignedDoctor: 'doc-1',
    assignedDoctorName: 'Dr Achol',
    registrationHospital: 'hosp-1',
    orgId: 'org-1',
    ...overrides,
  } as unknown as PatientDoc;
}

function transfer(overrides: Partial<PatientTransferDoc> = {}): PatientTransferDoc {
  return {
    _id: 'xfer-1',
    type: 'patient_transfer',
    patientId: 'pat-1',
    transferType: 'permanent',
    status: 'requested',
    urgency: 'routine',
    from: { providerId: 'doc-1' },
    to: { providerId: 'doc-2' },
    reason: 'Cardiology follow-up',
    requestedById: 'doc-1',
    events: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as PatientTransferDoc;
}

describe('requesting', () => {
  test('a clinician not involved in the patient’s care cannot transfer them', () => {
    const result = canRequestTransfer(auth('doctor', 'doc-9'), patient());
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/current care team/i);
  });

  test('the owning clinician and the assigning nurse can', () => {
    expect(canRequestTransfer(auth('doctor', 'doc-1'), patient()).allowed).toBe(true);
    expect(canRequestTransfer(
      auth('nurse', 'nurse-1'),
      patient({ assignedBy: 'nurse-1' }),
    ).allowed).toBe(true);
  });

  test('an active care-team member can, an expired one cannot', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const past = new Date(Date.now() - 3600_000).toISOString();
    const withGrant = (expiresAt: string) => patient({
      careTeam: [{
        providerId: 'doc-5', role: 'consult', grantedAt: past, expiresAt,
      }],
    });
    expect(isOnCareTeam(auth('doctor', 'doc-5'), withGrant(future))).toBe(true);
    expect(isOnCareTeam(auth('doctor', 'doc-5'), withGrant(past))).toBe(false);
  });

  test('roles without the capability are refused regardless of relationship', () => {
    expect(canRequestTransfer(auth('front_desk', 'doc-1'), patient()).allowed).toBe(false);
    expect(canRequestTransfer(auth('lab_tech', 'doc-1'), patient()).allowed).toBe(false);
  });

  test('a cross-org destination needs the stronger capability', () => {
    expect(canRequestTransfer(auth('doctor', 'doc-1'), patient(), { crossOrg: true }).allowed)
      .toBe(false);
    expect(canRequestTransfer(auth('org_admin', 'admin-1'), patient(), { crossOrg: true }).allowed)
      .toBe(true);
  });
});

describe('deciding', () => {
  test('the addressed provider can accept; another provider cannot', () => {
    expect(canDecideTransfer(auth('doctor', 'doc-2'), transfer()).allowed).toBe(true);
    const other = canDecideTransfer(auth('doctor', 'doc-7'), transfer());
    expect(other.allowed).toBe(false);
    expect(other.reason).toMatch(/another provider/i);
  });

  test('a requester cannot accept their own request', () => {
    const result = canDecideTransfer(auth('doctor', 'doc-1'), transfer({ to: { providerId: 'doc-1' } }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/yourself/i);
  });

  test('a nurse cannot accept on a doctor’s behalf', () => {
    expect(canDecideTransfer(auth('nurse', 'doc-2'), transfer()).allowed).toBe(false);
  });

  test('a department-addressed transfer can be answered from the destination facility only', () => {
    const t = transfer({ to: { department: 'Cardiology', facilityId: 'hosp-1' } });
    expect(canDecideTransfer(auth('doctor', 'doc-3'), t).allowed).toBe(true);
    expect(canDecideTransfer(
      auth('doctor', 'doc-3', { hospitalId: 'hosp-2' }), t,
    ).allowed).toBe(false);
  });

  test('an already-decided transfer cannot be decided again', () => {
    const result = canDecideTransfer(auth('doctor', 'doc-2'), transfer({ status: 'completed' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/completed/);
  });
});

describe('cancelling and forcing', () => {
  test('the sender can withdraw; an unrelated clinician cannot', () => {
    expect(canCancelTransfer(auth('doctor', 'doc-1'), transfer()).allowed).toBe(true);
    expect(canCancelTransfer(auth('doctor', 'doc-8'), transfer()).allowed).toBe(false);
  });

  test('an admin can withdraw anyone’s pending transfer', () => {
    expect(canCancelTransfer(auth('org_admin', 'admin-1'), transfer()).allowed).toBe(true);
  });

  test('a completed transfer cannot be withdrawn', () => {
    expect(canCancelTransfer(auth('org_admin', 'admin-1'), transfer({ status: 'completed' })).allowed)
      .toBe(false);
  });

  test('only force-capable admins can bypass acceptance', () => {
    expect(canForceTransfer(auth('doctor', 'doc-1'), patient()).allowed).toBe(false);
    expect(canForceTransfer(auth('hospital_manager', 'hm-1'), patient()).allowed).toBe(false);
    expect(canForceTransfer(auth('medical_superintendent', 'ms-1'), patient()).allowed).toBe(true);
    expect(canForceTransfer(auth('super_admin', 'sa-1'), patient()).allowed).toBe(true);
  });
});

describe('role allowlists', () => {
  test('read-only roles appear in the read list but never the write list', () => {
    for (const role of ['front_desk', 'lab_tech', 'government', 'cashier'] as UserRole[]) {
      expect(TRANSFER_READ_ROLES).toContain(role);
      expect(TRANSFER_WRITE_ROLES).not.toContain(role);
      expect(hasTransferCapability(role, 'patient.transfer.request')).toBe(false);
    }
  });

  test('clinical roles that can move a patient are in the write list', () => {
    for (const role of ['doctor', 'nurse', 'clinical_officer', 'org_admin'] as UserRole[]) {
      expect(TRANSFER_WRITE_ROLES).toContain(role);
    }
  });
});
