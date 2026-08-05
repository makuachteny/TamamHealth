/**
 * The one place that totals a clinician's "documents to sign" count from a
 * `useSigningInbox()` result.
 *
 * Both the desktop dashboard (app/(dashboard)/dashboard/page.tsx, via
 * doctor-worklist.ts) and the mobile shell
 * (lib/mobile-shell/use-clinical-dashboard-data.ts) need this number. They
 * used to each sum the four arrays themselves — which is how `unsignedNotes`
 * shipped on the hook while neither consumer's own arithmetic had been
 * updated to include it, so the "Documents to sign" badge silently
 * undercounted everywhere it was read. Routing both consumers through one
 * function means a field added to the hook can't be missed in just one of
 * the two places again.
 */
import type { AssessmentDoc, MedicalRecordDoc } from '../db-types';
import type { ClinicalNoteDoc } from '../clinical-notes/types';

export interface SigningInboxCounts {
  unsignedDrafts: MedicalRecordDoc[];
  awaitingCosign: MedicalRecordDoc[];
  heldAssessments: AssessmentDoc[];
  unsignedNotes: ClinicalNoteDoc[];
}

export function computeSignCount(inbox: SigningInboxCounts): number {
  return (
    inbox.unsignedDrafts.length +
    inbox.awaitingCosign.length +
    inbox.heldAssessments.length +
    inbox.unsignedNotes.length
  );
}
