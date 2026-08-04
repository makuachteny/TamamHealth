'use client';

/**
 * Start a clinical note from wherever the clinician already is.
 *
 * The point of creating from an appointment rather than from a blank screen is
 * that the appointment already knows the patient, the provider, the date, the
 * time and whether the visit is telehealth. Every one of those is a field the
 * clinician would otherwise re-enter, and re-entry is where mismatched notes
 * come from.
 *
 * If a draft already exists for the same appointment, this reopens it instead
 * of starting a second one — clicking twice should not fork the record.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClinicalNote, listClinicalNotes } from './note-service';
import { getNoteType, type NoteTypeId } from './note-catalog';
import type { ClinicalNoteDoc } from './types';

export interface CreateNoteFromVisitInput {
  patientId: string;
  patientName: string;
  mrn?: string;
  patientDob?: string;
  /** Defaults to SOAP, or Telehealth SOAP when the visit is telehealth. */
  noteType?: NoteTypeId;
  appointmentId?: string;
  encounterId?: string;
  telehealth?: boolean;
  serviceDate?: string;
  serviceTime?: string;
  assignedToId?: string;
  assignedToName?: string;
}

export interface CurrentUserLike {
  _id: string;
  name?: string;
  username?: string;
  hospitalId?: string;
  hospitalName?: string;
  orgId?: string;
}

export function useCreateNote(currentUser: CurrentUserLike | null) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const createNote = useCallback(async (
    input: CreateNoteFromVisitInput,
    options: { navigate?: boolean } = {},
  ): Promise<ClinicalNoteDoc | null> => {
    const navigate = options.navigate ?? true;
    setCreating(true);
    try {
      // Reopen rather than fork: a second draft against one appointment splits
      // the encounter across two records.
      if (input.appointmentId) {
        const existing = await listClinicalNotes({ patientId: input.patientId });
        const draft = existing.find(
          n => n.appointmentId === input.appointmentId && n.status === 'draft',
        );
        if (draft) {
          if (navigate) router.push(`/notes/${draft._id}`);
          return draft;
        }
      }

      const now = new Date();
      const noteType: NoteTypeId = input.noteType
        ?? (input.telehealth ? 'telehealth_soap' : 'soap');

      const note = await createClinicalNote({
        patientId: input.patientId,
        patientName: input.patientName,
        mrn: input.mrn,
        patientDob: input.patientDob,
        noteType,
        serviceDate: input.serviceDate || now.toISOString().slice(0, 10),
        serviceTime: input.serviceTime || now.toTimeString().slice(0, 5),
        appointmentId: input.appointmentId,
        encounterId: input.encounterId,
        telehealth: input.telehealth ?? getNoteType(noteType).telehealth,
        assignedToId: input.assignedToId ?? currentUser?._id,
        assignedToName: input.assignedToName ?? currentUser?.name ?? currentUser?.username,
        authorId: currentUser?._id,
        authorName: currentUser?.name ?? currentUser?.username,
        hospitalId: currentUser?.hospitalId,
        hospitalName: currentUser?.hospitalName,
        orgId: currentUser?.orgId,
      });

      if (navigate) router.push(`/notes/${note._id}`);
      return note;
    } finally {
      setCreating(false);
    }
  }, [currentUser, router]);

  return { createNote, creating };
}
