import { auditLogDB } from '../db';
import type { AuditLogDoc } from '../db-types';
import { v4 as uuidv4 } from 'uuid';
import { findByType } from './db-query';

export async function logAuditSafe(...args: Parameters<typeof logAudit>): Promise<void> {
  try {
    await logAudit(...args);
  } catch (err) {
    // Don't break the caller's transaction, but make the loss visible
    // so monitoring can alert on '[AUDIT LOST]' patterns.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[AUDIT LOST] ${args[0] || 'unknown'}: ${msg}`);
  }
}

export async function logAudit(
  action: string,
  userId: string | undefined,
  username: string | undefined,
  details: string,
  success: boolean = true
): Promise<void> {
  try {
    const db = auditLogDB();
    const now = new Date().toISOString();
    const doc: AuditLogDoc = {
      _id: `audit-${uuidv4()}`,
      type: 'audit_log',
      action,
      userId,
      username,
      details,
      success,
      createdAt: now,
      updatedAt: now,
    };
    await db.put(doc);
  } catch (err) {
    // Never let audit logging failures break the main flow
    console.error('[Audit] Failed to write audit log:', err);
  }
}

/** Log a data access event for compliance tracking */
export async function logDataAccess(
  userId: string | undefined,
  username: string | undefined,
  resource: string,
  resourceId: string,
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT'
): Promise<void> {
  await logAudit(
    `DATA_${action}`,
    userId,
    username,
    `${action} ${resource}: ${resourceId}`
  );
}

export async function getRecentAuditLogs(limit: number = 50): Promise<AuditLogDoc[]> {
  const db = auditLogDB();
  const docs = await findByType<AuditLogDoc>(db, 'audit_log');
  /* istanbul ignore next -- defensive null-safety in sort comparator */
  docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return docs.slice(0, limit);
}
