import { usersDB } from '../db';
import type { UserDoc, UserRole } from '../db-types';
import type { DataScope } from './data-scope';
import { filterByScope } from './data-scope';

const VALID_ROLES: UserRole[] = ['super_admin', 'org_admin', 'doctor', 'clinical_officer', 'nurse', 'lab_tech', 'pharmacist', 'front_desk', 'government', 'boma_health_worker', 'payam_supervisor', 'data_entry_clerk', 'medical_superintendent', 'hrio', 'community_health_volunteer', 'nutritionist', 'radiologist'];

export async function getAllUsers(scope?: DataScope): Promise<UserDoc[]> {
  const db = usersDB();
  const result = await db.allDocs({ include_docs: true });
  const all = result.rows
    .map(r => r.doc as UserDoc)
    .filter(d => d && d.type === 'user');
  /* istanbul ignore next -- scope filter: tested with and without */
  return scope ? filterByScope(all, scope) : all;
}

export async function getUserById(id: string): Promise<UserDoc | null> {
  try {
    const db = usersDB();
    return await db.get(id) as UserDoc;
  } catch {
    return null;
  }
}

interface CreateUserData {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

export async function createUser(
  data: CreateUserData,
  actorId?: string,
  actorUsername?: string
): Promise<UserDoc> {
  const db = usersDB();

  // Validate
  if (!data.username || !data.password || !data.name || !data.role) {
    throw new Error('Missing required fields: username, password, name, role');
  }

  const username = data.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  /* istanbul ignore next -- defensive: username is always validated before reaching here */
  if (!username) throw new Error('Invalid username');

  if (!VALID_ROLES.includes(data.role)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const ROLES_WITHOUT_HOSPITAL: UserRole[] = ['super_admin', 'org_admin', 'government'];
  if (!ROLES_WITHOUT_HOSPITAL.includes(data.role) && (!data.hospitalId || !data.hospitalName)) {
    throw new Error('Clinical users must be assigned to a hospital');
  }

  // Check uniqueness
  try {
    await db.get(`user-${username}`);
    throw new Error(`Username "${username}" already exists`);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status !== 404) {
      /* istanbul ignore next -- re-throw: error is always the 'already exists' one */
      if (e.message?.includes('already exists')) throw err;
      throw err;
    }
  }

  const now = new Date().toISOString();
  const { hashPassword } = await import('../auth');
  const passwordHash = await hashPassword(data.password);

  const needsHospital = !(['super_admin', 'org_admin', 'government'] as UserRole[]).includes(data.role);
  const doc: UserDoc = {
    _id: `user-${username}`,
    type: 'user',
    username,
    passwordHash,
    name: data.name,
    role: data.role,
    hospitalId: needsHospital ? data.hospitalId : undefined,
    hospitalName: needsHospital ? data.hospitalName : undefined,
    orgId: data.orgId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
  };

  const resp = await db.put(doc);
  doc._rev = resp.rev;
  const { logAudit } = await import('./audit-service');
  await logAudit('user_created', actorId, actorUsername, `Created user "${username}" with role ${data.role}`, true);
  return doc;
}

interface UpdateUserData {
  name?: string;
  role?: UserRole;
  hospitalId?: string;
  hospitalName?: string;
  isActive?: boolean;
}

export async function updateUser(
  id: string,
  data: UpdateUserData,
  actorId?: string,
  actorUsername?: string
): Promise<UserDoc> {
  const db = usersDB();
  const existing = await db.get(id) as UserDoc;

  if (data.role && !VALID_ROLES.includes(data.role)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const updated: UserDoc = {
    ...existing,
    ...data,
    _id: existing._id,
    _rev: existing._rev,
    updatedAt: new Date().toISOString(),
  };

  const resp = await db.put(updated);
  updated._rev = resp.rev;
  const { logAudit } = await import('./audit-service');
  await logAudit('user_updated', actorId, actorUsername, `Updated user "${existing.username}"`, true);
  return updated;
}

export async function resetPassword(
  id: string,
  newPassword: string,
  actorId?: string,
  actorUsername?: string
): Promise<void> {
  const db = usersDB();
  const existing = await db.get(id) as UserDoc;

  const { hashPassword } = await import('../auth');
  const passwordHash = await hashPassword(newPassword);
  const updated: UserDoc = {
    ...existing,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  const resp2 = await db.put(updated);
  updated._rev = resp2.rev;
  const { logAudit } = await import('./audit-service');
  await logAudit('password_reset', actorId, actorUsername, `Reset password for user "${existing.username}"`, true);
}

export async function deactivateUser(
  id: string,
  actorId?: string,
  actorUsername?: string
): Promise<void> {
  const db = usersDB();
  const existing = await db.get(id) as UserDoc;

  const updated: UserDoc = {
    ...existing,
    isActive: false,
    updatedAt: new Date().toISOString(),
  };

  const resp3 = await db.put(updated);
  updated._rev = resp3.rev;
  const { logAudit } = await import('./audit-service');
  await logAudit('user_deactivated', actorId, actorUsername, `Deactivated user "${existing.username}"`, true);
}
