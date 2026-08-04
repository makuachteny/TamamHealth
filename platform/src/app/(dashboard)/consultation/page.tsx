'use client';

/**
 * /consultation — now the entry ramp into a clinical note.
 *
 * The seven-step consultation wizard this route used to render has been
 * retired: documentation happens in the Clinical Notes module, where the
 * clinician picks the note type up front and writes into the sections that type
 * defines, rather than being walked through one fixed sequence that fits an
 * outpatient consult and nothing else.
 *
 * The route is kept rather than deleted because a dozen things already point at
 * it — the sidebar, the top rail's primary create action, the "Documents to
 * sign" tile, and `callPatient` on the clinician worklist. Redirecting here
 * means every one of those keeps working and lands on the note, instead of each
 * call site having to be found and rewritten (and one being missed).
 *
 * With a `patientId` it resumes today's draft for that patient or starts one;
 * without, it opens the notes queue, so "Consultation" in the nav still leads
 * somewhere useful.
 *
 * The wizard remains in git history if any of its order-entry steps need to be
 * recovered into the note's Plan section.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/context';
import { listClinicalNotes, createClinicalNote } from '@/lib/clinical-notes/note-service';
import { defaultNoteTypeFor } from '@/components/clinical-notes/CreateNoteButton';
import '@/components/clinical-notes/clinical-notes.css';

export default function ConsultationRedirectPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { currentUser } = useApp();
  const [error, setError] = useState<string | null>(null);
  // Effects run twice under React StrictMode in development; without this the
  // first pass would create one note and the second another for the same visit.
  const started = useRef(false);

  const patientId = params?.get('patientId') || '';

  useEffect(() => {
    if (started.current) return;
    if (!currentUser) return;          // wait for auth to hydrate
    started.current = true;

    (async () => {
      if (!patientId) { router.replace('/notes'); return; }

      try {
        const today = new Date().toISOString().slice(0, 10);
        const existing = await listClinicalNotes({ patientId });

        // Resume rather than duplicate: pressing "Start consultation" twice in
        // one clinic session must not split the encounter across two records.
        const draft = existing.find(n => n.status === 'draft' && n.serviceDate === today)
          ?? existing.find(n => n.status === 'draft');
        if (draft) { router.replace(`/notes/${draft._id}`); return; }

        const { getPatientById } = await import('@/lib/services/patient-service');
        const patient = await getPatientById(patientId).catch(() => null);
        const patientName = patient
          ? [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' ')
          : 'Patient';

        const note = await createClinicalNote({
          patientId,
          patientName,
          mrn: patient?.hospitalNumber,
          patientDob: patient?.dateOfBirth,
          noteType: defaultNoteTypeFor({ role: currentUser.role }),
          serviceDate: today,
          serviceTime: new Date().toTimeString().slice(0, 5),
          assignedToId: currentUser._id,
          assignedToName: currentUser.name || currentUser.username,
          authorId: currentUser._id,
          authorName: currentUser.name || currentUser.username,
          hospitalId: currentUser.hospitalId,
          hospitalName: currentUser.hospitalName,
          orgId: currentUser.orgId,
        });
        router.replace(`/notes/${note._id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open a clinical note.');
      }
    })();
  }, [currentUser, patientId, router]);

  if (error) {
    return (
      <div className="cn-empty">
        <p>{error}</p>
        <button type="button" className="cn-btn" onClick={() => router.push('/notes')}>
          Go to Clinical Notes
        </button>
      </div>
    );
  }

  return <div className="cn-empty">Opening clinical note…</div>;
}
