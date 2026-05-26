/**
 * Tests for the per-table conflict policy on the CouchDB → PostgreSQL
 * writeback. Pairs with `docs/architecture/sync-conflict-policy.md`.
 *
 * The `pg` Pool is mocked so we can capture every SQL string that
 * `upsertDocument` emits and assert that the right policy was applied for
 * each table — without needing a real Postgres.
 */

// Capture every (sql, params) pair the production code passes to `pg`.
const capturedQueries: { sql: string; params: unknown[] }[] = [];

jest.mock('pg', () => {
  class FakePool {
    connect() {
      return Promise.resolve({
        query: jest.fn().mockImplementation((sql: string, params?: unknown[]) => {
          capturedQueries.push({ sql, params: params ?? [] });
          return Promise.resolve({ rows: [], rowCount: 1 });
        }),
        release: jest.fn(),
      });
    }
    on() {}
  }
  return { Pool: FakePool };
});

process.env.DATABASE_URL = 'postgres://test';

import {
  upsertDocument,
  buildUpsertSql,
  ConflictPolicy,
  TABLE_CONFLICT_POLICY,
} from '@/lib/db/postgres';

beforeEach(() => {
  capturedQueries.length = 0;
});

describe('TABLE_CONFLICT_POLICY map', () => {
  it('classifies audit_log as APPEND_ONLY', () => {
    expect(TABLE_CONFLICT_POLICY.audit_log).toBe(ConflictPolicy.APPEND_ONLY);
  });

  it('classifies the clinical-grade tables as CLINICAL_FINALIZED', () => {
    for (const t of ['medical_records', 'lab_results', 'prescriptions', 'births', 'deaths']) {
      expect(TABLE_CONFLICT_POLICY[t]).toBe(ConflictPolicy.CLINICAL_FINALIZED);
    }
  });

  it('classifies referrals and disease_alerts as CLINICAL_FINALIZED', () => {
    expect(TABLE_CONFLICT_POLICY.referrals).toBe(ConflictPolicy.CLINICAL_FINALIZED);
    expect(TABLE_CONFLICT_POLICY.disease_alerts).toBe(ConflictPolicy.CLINICAL_FINALIZED);
  });

  it('classifies patients and other reference tables as LAST_WRITE_WINS', () => {
    for (const t of [
      'patients', 'hospitals', 'organizations', 'facility_assessments',
      'sync_metadata', 'immunizations', 'anc_visits', 'boma_visits',
    ]) {
      expect(TABLE_CONFLICT_POLICY[t]).toBe(ConflictPolicy.LAST_WRITE_WINS);
    }
  });
});

describe('buildUpsertSql — pure SQL shape', () => {
  it('LAST_WRITE_WINS emits a plain ON CONFLICT DO UPDATE SET', () => {
    const sql = buildUpsertSql('patients', ['id', 'name', 'gender'], ConflictPolicy.LAST_WRITE_WINS);
    expect(sql).toMatch(/INSERT INTO patients \(id, name, gender\)/);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE SET/);
    expect(sql).toMatch(/name = \$2/);
    expect(sql).toMatch(/gender = \$3/);
    expect(sql).not.toMatch(/DO NOTHING/);
    expect(sql).not.toMatch(/WHERE/);
  });

  it('APPEND_ONLY emits ON CONFLICT DO NOTHING for audit_log', () => {
    const sql = buildUpsertSql(
      'audit_log',
      ['id', 'action', 'user_id'],
      ConflictPolicy.APPEND_ONLY,
    );
    expect(sql).toMatch(/INSERT INTO audit_log/);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO NOTHING/);
    expect(sql).not.toMatch(/DO UPDATE SET/);
  });

  it('CLINICAL_FINALIZED emits a status + updated_at WHERE guard for lab_results', () => {
    const sql = buildUpsertSql(
      'lab_results',
      ['id', 'status', 'updated_at'],
      ConflictPolicy.CLINICAL_FINALIZED,
    );
    expect(sql).toMatch(/INSERT INTO lab_results/);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE SET/);
    expect(sql).toMatch(/WHERE/);
    expect(sql).toMatch(/lab_results\.status NOT IN \('closed', 'resolved', 'cancelled', 'finalized'\)/);
    expect(sql).toMatch(/COALESCE\(lab_results\.updated_at/);
  });

  it('CLINICAL_FINALIZED on tables without a status column emits only the updated_at guard', () => {
    // medical_records / births / deaths have no `status` column in the
    // schema — the SQL must not reference one or the UPSERT will fail.
    for (const table of ['medical_records', 'births', 'deaths']) {
      const sql = buildUpsertSql(
        table,
        ['id', 'updated_at'],
        ConflictPolicy.CLINICAL_FINALIZED,
      );
      expect(sql).toMatch(new RegExp(`INSERT INTO ${table}`));
      expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE SET/);
      expect(sql).toMatch(/WHERE/);
      expect(sql).toMatch(new RegExp(`COALESCE\\(${table}\\.updated_at`));
      expect(sql).not.toMatch(new RegExp(`${table}\\.status`));
    }
  });

  it('CLINICAL_FINALIZED on prescriptions / referrals / disease_alerts emits both guards', () => {
    for (const table of ['prescriptions', 'referrals', 'disease_alerts']) {
      const sql = buildUpsertSql(
        table,
        ['id', 'status', 'updated_at'],
        ConflictPolicy.CLINICAL_FINALIZED,
      );
      expect(sql).toMatch(new RegExp(`${table}\\.status NOT IN`));
      expect(sql).toMatch(new RegExp(`COALESCE\\(${table}\\.updated_at`));
    }
  });
});

describe('upsertDocument — end-to-end query capture', () => {
  it('emits DO NOTHING for an audit_log insert', async () => {
    await upsertDocument('audit_log', 'aud-1', {
      id: 'aud-1',
      action: 'login',
      user_id: 'u-1',
    });
    // last query is the upsert (no other queries fire from this path)
    const last = capturedQueries[capturedQueries.length - 1];
    expect(last.sql).toMatch(/INSERT INTO audit_log/);
    expect(last.sql).toMatch(/ON CONFLICT \(id\) DO NOTHING/);
    expect(last.sql).not.toMatch(/DO UPDATE SET/);
  });

  it('emits a CLINICAL_FINALIZED guard for medical_records', async () => {
    await upsertDocument('medical_records', 'mr-1', {
      id: 'mr-1',
      patient_id: 'p-1',
      diagnosis: 'malaria',
      updated_at: '2026-05-09T12:00:00Z',
    });
    const last = capturedQueries[capturedQueries.length - 1];
    expect(last.sql).toMatch(/INSERT INTO medical_records/);
    expect(last.sql).toMatch(/ON CONFLICT \(id\) DO UPDATE SET/);
    expect(last.sql).toMatch(/WHERE/);
    expect(last.sql).toMatch(/COALESCE\(medical_records\.updated_at/);
  });

  it('emits a CLINICAL_FINALIZED guard for lab_results, prescriptions, births, deaths', async () => {
    const cases: Array<{ table: string; row: Record<string, unknown> }> = [
      { table: 'lab_results',   row: { id: 'lr-1', test_name: 'CBC',         status: 'pending', updated_at: '2026-05-09T12:00:00Z' } },
      { table: 'prescriptions', row: { id: 'rx-1', medication: 'amoxicillin', status: 'pending', updated_at: '2026-05-09T12:00:00Z' } },
      { table: 'births',        row: { id: 'b-1',  child_first_name: 'A', child_surname: 'B', child_gender: 'F', date_of_birth: '2026-01-01', updated_at: '2026-05-09T12:00:00Z' } },
      { table: 'deaths',        row: { id: 'd-1',  deceased_first_name: 'A', deceased_surname: 'B', deceased_gender: 'M', date_of_death: '2026-01-01', updated_at: '2026-05-09T12:00:00Z' } },
    ];
    for (const c of cases) {
      capturedQueries.length = 0;
      await upsertDocument(c.table, String(c.row.id), c.row);
      const last = capturedQueries[capturedQueries.length - 1];
      expect(last.sql).toMatch(new RegExp(`INSERT INTO ${c.table}`));
      expect(last.sql).toMatch(/ON CONFLICT \(id\) DO UPDATE SET/);
      expect(last.sql).toMatch(/WHERE/);
      expect(last.sql).toMatch(new RegExp(`COALESCE\\(${c.table}\\.updated_at`));
    }
  });

  it('emits LAST_WRITE_WINS for patients (no DO NOTHING, no WHERE)', async () => {
    await upsertDocument('patients', 'pat-1', {
      id: 'pat-1',
      name: 'Test',
      gender: 'Female',
    });
    const last = capturedQueries[capturedQueries.length - 1];
    expect(last.sql).toMatch(/INSERT INTO patients/);
    expect(last.sql).toMatch(/ON CONFLICT \(id\) DO UPDATE SET/);
    expect(last.sql).not.toMatch(/DO NOTHING/);
    expect(last.sql).not.toMatch(/WHERE/);
  });

  it('rejects an unknown table — the policy dispatch must not bypass the allowlist', async () => {
    await expect(
      upsertDocument('evil_table', 'x', { id: 'x' }),
    ).rejects.toThrow(/allowlist/);
  });

  it('rejects an unknown column on a known table', async () => {
    await expect(
      upsertDocument('patients', 'pat-2', {
        id: 'pat-2',
        evil_column: 'x',
      }),
    ).rejects.toThrow(/allowlist/);
  });

  it('returns a written-flag and the applied policy', async () => {
    const result = await upsertDocument('patients', 'pat-1', {
      id: 'pat-1',
      name: 'T',
    });
    expect(result.policy).toBe(ConflictPolicy.LAST_WRITE_WINS);
    // mocked rowCount is 1, so a successful write is reported
    expect(result.written).toBe(true);
  });
});
