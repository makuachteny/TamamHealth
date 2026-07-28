/**
 * CouchDB write RBAC (KAN-94).
 *
 * RBAC was enforced only in the API routes, but this platform is offline-first:
 * clients write to a local PouchDB replica and replicate straight to CouchDB,
 * never passing an API guard. Any authenticated user could therefore create or
 * modify documents their role has no business touching — a cashier could write
 * a medical record — simply by writing locally and letting sync carry it.
 *
 * These tests EXECUTE the generated validator rather than inspecting its text.
 * That matters twice over: it proves the rules actually hold, and it proves the
 * function parses at all — a syntax error in a validate_doc_update BLOCKS EVERY
 * WRITE to the database it is installed on.
 */
import {
  DOC_WRITE_ROLES,
  IMMUTABLE_FIELDS,
  buildValidateDocUpdateFn,
  ORG_SCOPED_VALIDATE_FN,
} from '@/lib/sync/write-permissions';

type UserCtx = { name?: string; roles: string[] };

/** Compile the validator the same way CouchDB does — from source. */
function compile(source: string = ORG_SCOPED_VALIDATE_FN) {
   
  const fn = new Function(`return (${source});`)() as (
    newDoc: Record<string, unknown>,
    oldDoc: Record<string, unknown> | null,
    userCtx: UserCtx,
    secObj: unknown,
  ) => void;
  return fn;
}

const validate = compile();

/** Run the validator, returning the forbidden message or null when allowed. */
function check(
  newDoc: Record<string, unknown>,
  userCtx: UserCtx,
  oldDoc: Record<string, unknown> | null = null,
): string | null {
  try {
    validate(newDoc, oldDoc, userCtx, {});
    return null;
  } catch (e) {
    return (e as { forbidden?: string }).forbidden ?? String(e);
  }
}

const ORG = 'org-moh-ss';
const user = (role: string, org = ORG): UserCtx => ({ roles: [`role:${role}`, `org:${org}`] });

describe('the validator compiles', () => {
  test('parses as valid JavaScript', () => {
    expect(() => compile()).not.toThrow();
    expect(typeof validate).toBe('function');
  });

  test('uses only CouchDB-compatible syntax', () => {
    expect(ORG_SCOPED_VALIDATE_FN).not.toMatch(/=>/);
    expect(ORG_SCOPED_VALIDATE_FN).not.toMatch(/\bconst\b/);
    expect(ORG_SCOPED_VALIDATE_FN).not.toMatch(/\blet\b/);
    expect(ORG_SCOPED_VALIDATE_FN).not.toMatch(/\.includes\(/);
  });
});

describe('role-based write permission', () => {
  test('a doctor may write a medical record', () => {
    expect(check({ type: 'medical_record', orgId: ORG }, user('doctor'))).toBeNull();
  });

  test('a CASHIER may NOT write a medical record', () => {
    const err = check({ type: 'medical_record', orgId: ORG }, user('cashier'));
    expect(err).toMatch(/role cashier may not write documents of type medical_record/);
  });

  test('front desk may register a patient but NOT prescribe', () => {
    expect(check({ type: 'patient', orgId: ORG }, user('front_desk'))).toBeNull();
    expect(check({ type: 'prescription', orgId: ORG }, user('front_desk')))
      .toMatch(/may not write documents of type prescription/);
  });

  test('a lab tech may write a lab result but not a prescription', () => {
    expect(check({ type: 'lab_result', orgId: ORG }, user('lab_tech'))).toBeNull();
    expect(check({ type: 'prescription', orgId: ORG }, user('lab_tech'))).toMatch(/may not write/);
  });

  test('every role in the matrix is genuinely accepted for its type', () => {
    for (const [docType, roles] of Object.entries(DOC_WRITE_ROLES)) {
      for (const role of roles) {
        expect(check({ type: docType, orgId: ORG }, user(role))).toBeNull();
      }
    }
  });

  test('a user with NO role claim is rejected, not trusted', () => {
    const err = check({ type: 'medical_record', orgId: ORG }, { roles: [`org:${ORG}`] });
    expect(err).toMatch(/no role claim/);
  });

  test('the acting role comes from userCtx, never the document body', () => {
    const err = check(
      { type: 'medical_record', orgId: ORG, role: 'doctor', createdBy: 'doctor' },
      user('cashier'),
    );
    expect(err).toMatch(/role cashier may not write/);
  });
});

describe('tenant boundary', () => {
  test('a document without orgId is rejected', () => {
    expect(check({ type: 'patient' }, user('doctor'))).toMatch(/orgId is required/);
  });

  test('writing into another org is rejected', () => {
    expect(check({ type: 'patient', orgId: 'org-other' }, user('doctor')))
      .toMatch(/orgId mismatch/);
  });
});

describe('immutable fields', () => {
  test.each(IMMUTABLE_FIELDS)('%s cannot be changed after creation', (field) => {
    const oldDoc = { type: 'patient', orgId: ORG, hospitalId: 'hosp-1' };
    const newDoc = { ...oldDoc, [field]: 'tampered' };
    expect(check(newDoc, user('doctor'), oldDoc)).not.toBeNull();
  });

  test('changing type would move a doc between permission rows — refused', () => {
    const oldDoc = { type: 'patient', orgId: ORG };
    const err = check({ type: 'medical_record', orgId: ORG }, user('front_desk'), oldDoc);
    expect(err).toMatch(/type is immutable/);
  });

  test('an ordinary update that touches nothing immutable is allowed', () => {
    const oldDoc = { type: 'patient', orgId: ORG, hospitalId: 'hosp-1', firstName: 'Achol' };
    expect(check({ ...oldDoc, firstName: 'Achol Mary' }, user('doctor'), oldDoc)).toBeNull();
  });
});

describe('operational passthroughs', () => {
  test('deletes propagate', () => {
    expect(check({ _deleted: true }, user('nurse'))).toBeNull();
  });

  test('_admin (sync-worker, migrations) bypasses', () => {
    expect(check({ type: 'medical_record', orgId: 'any-org' }, { roles: ['_admin'] })).toBeNull();
  });

  test('an unknown document type is allowed through', () => {
    expect(check({ type: 'some_future_type', orgId: ORG }, user('cashier'))).toBeNull();
  });
});

describe('generation from the matrix', () => {
  test('a custom matrix produces a validator enforcing it', () => {
    const fn = compile(buildValidateDocUpdateFn({ widget: ['doctor'] }));
    const run = (doc: Record<string, unknown>, ctx: UserCtx) => {
      try { fn(doc, null, ctx, {}); return null; } catch (e) { return (e as { forbidden: string }).forbidden; }
    };
    expect(run({ type: 'widget', orgId: ORG }, user('doctor'))).toBeNull();
    expect(run({ type: 'widget', orgId: ORG }, user('nurse'))).toMatch(/may not write/);
  });
});
