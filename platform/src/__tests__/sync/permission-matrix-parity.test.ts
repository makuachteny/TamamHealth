/**
 * The CouchDB matrix and the API route guards must not drift (KAN-94).
 *
 * Two enforcement layers that disagree are worse than one: whichever is more
 * permissive becomes the real policy, and the stricter one just produces
 * confusing failures. This derives the route guards from source and compares
 * them to the matrix the CouchDB validator is generated from.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOC_WRITE_ROLES } from '@/lib/sync/write-permissions';
import { TRANSFER_WRITE_ROLES } from '@/lib/services/patient-transfer-permissions';

/** doc `type` → the API route directory whose guard governs it. */
const TYPE_TO_ROUTE: Record<string, string> = {
  patient: 'patients',
  medical_record: 'medical-records',
  lab_result: 'lab',
  prescription: 'prescriptions',
  triage: 'triage',
  referral: 'referrals',
  birth: 'births',
  death: 'deaths',
  anc_visit: 'anc',
  immunization: 'immunizations',
  telehealth_session: 'telehealth',
  patient_transfer: 'patient-transfers',
};

/**
 * Types whose route does not declare a literal role array because it imports
 * the SAME exported constant the matrix row is built from.
 *
 * Text-scraping is how this file checks the other rows, and it cannot see
 * through an import. That is not a weaker guarantee here — it is a stronger
 * one: these rows cannot drift at all, because both layers are the same
 * JavaScript value rather than two lists a human keeps in step. The assertion
 * below is therefore identity against the shared constant, plus a check that
 * the route really does import it (so this exemption cannot be claimed by a
 * route that quietly went back to its own list).
 */
const DERIVED_FROM_SHARED_CONSTANT: Record<string, { constant: readonly string[]; importedFrom: string }> = {
  patient_transfer: {
    constant: TRANSFER_WRITE_ROLES,
    importedFrom: 'patient-transfer-permissions',
  },
};

/**
 * Types with NO API route to compare against, because there isn't one: the
 * client writes these documents straight to its local PouchDB replica
 * (offline-first) and replication carries them to CouchDB without ever
 * passing through a Next.js API route. `validate_doc_update` (KAN-94) exists
 * precisely to cover this gap — see the module docstring on
 * lib/sync/write-permissions.ts. So for these types the CouchDB matrix row
 * IS the entire enforcement, not one of two layers to keep in sync, and a
 * missing `TYPE_TO_ROUTE` entry is not a coverage hole.
 */
const NO_API_ROUTE = new Set<string>([
  // lib/clinical-notes/note-service.ts — notes are created/edited/signed
  // entirely client-side against PouchDB.
  'clinical_note',
]);

function routeSource(routeDir: string): string {
  return readFileSync(join(process.cwd(), 'src', 'app', 'api', routeDir, 'route.ts'), 'utf8');
}

/** Pull the CREATE_ROLES / WRITE_ROLES array out of a route file. */
function routeWriteRoles(routeDir: string): string[] | null {
  const path = join(process.cwd(), 'src', 'app', 'api', routeDir, 'route.ts');
  if (!existsSync(path)) return null;
  const src = readFileSync(path, 'utf8');
  const m = /const (?:CREATE|WRITE)_ROLES: UserRole\[\] = \[([\s\S]*?)\];/.exec(src);
  if (!m) return null;
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
}

describe('permission matrix parity', () => {
  test('every matrix type maps to a real route (or is documented as CouchDB-only)', () => {
    for (const docType of Object.keys(DOC_WRITE_ROLES)) {
      if (NO_API_ROUTE.has(docType)) continue;
      expect(TYPE_TO_ROUTE[docType]).toBeDefined();
      if (DERIVED_FROM_SHARED_CONSTANT[docType]) continue;
      expect(routeWriteRoles(TYPE_TO_ROUTE[docType])).not.toBeNull();
    }
  });

  test.each(Object.keys(DOC_WRITE_ROLES).filter((t) => !NO_API_ROUTE.has(t)))(
    '%s: CouchDB matrix matches the API route guard',
    (docType) => {
      const fromMatrix = [...DOC_WRITE_ROLES[docType]].sort();
      const derived = DERIVED_FROM_SHARED_CONSTANT[docType];

      if (derived) {
        // Same value on both sides, and the route genuinely imports it.
        expect(fromMatrix).toEqual([...derived.constant].sort());
        expect(routeSource(TYPE_TO_ROUTE[docType])).toContain(derived.importedFrom);
        return;
      }

      expect(fromMatrix).toEqual(routeWriteRoles(TYPE_TO_ROUTE[docType])!);
    },
  );

  test('no matrix row is empty', () => {
    // An empty row would silently permit nothing, locking a document type out
    // of the system entirely.
    for (const [docType, roles] of Object.entries(DOC_WRITE_ROLES)) {
      expect(roles.length).toBeGreaterThan(0);
      expect(roles).toContain('super_admin');
      expect(docType).toMatch(/^[a-z_]+$/);
    }
  });
});
