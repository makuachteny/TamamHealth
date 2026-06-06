'use client';

// Nurse → doctor care-assignment modal. A nurse picks the clinician who will
// provide care for a patient; the choice is written onto the patient record
// (assignedDoctor*) and, when the patient came through triage, onto the triage
// handoff fields. The assigned doctor then sees the patient in their
// "assigned to you" worklist on the clinician dashboard.

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { useUsers } from '@/lib/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { Stethoscope, X, Check, Search } from '@/components/icons/lucide';
import type { UserRole } from '@/lib/db-types';

export interface AssignDoctorTarget {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  /** Triage record to stamp with the handoff, if this came from triage. */
  triageId?: string;
  /** Currently assigned doctor id, to pre-select / show as current. */
  currentDoctorId?: string;
}

// Clinicians who can be the responsible care provider for a patient.
const ASSIGNABLE_ROLES: UserRole[] = ['doctor', 'clinical_officer', 'medical_superintendent'];

export default function AssignDoctorModal({
  target,
  onClose,
  onAssigned,
}: {
  target: AssignDoctorTarget;
  onClose: () => void;
  onAssigned?: (doctor: { id: string; name: string }) => void;
}) {
  const { currentUser } = useApp();
  const { users, loading } = useUsers();
  const { showToast } = useToast();

  const [selectedId, setSelectedId] = useState<string>(target.currentDoctorId ?? '');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Doctors at the nurse's facility; fall back to all active clinicians if the
  // facility has none (or the nurse has no facility set) so the picker is never
  // empty.
  const doctors = useMemo(() => {
    const clinicians = users.filter(
      u => ASSIGNABLE_ROLES.includes(u.role) && u.isActive !== false,
    );
    const sameFacility = currentUser?.hospitalId
      ? clinicians.filter(u => u.hospitalId === currentUser.hospitalId)
      : [];
    const base = sameFacility.length > 0 ? sameFacility : clinicians;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? base.filter(u => u.name.toLowerCase().includes(q) || (u.specialty ?? '').toLowerCase().includes(q))
      : base;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [users, currentUser?.hospitalId, search]);

  const handleAssign = async () => {
    const doctor = doctors.find(d => d._id === selectedId) || users.find(u => u._id === selectedId);
    if (!doctor) {
      showToast('Select a doctor to assign', 'error');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { updatePatient } = await import('@/lib/services/patient-service');
      await updatePatient(target.patientId, {
        assignedDoctor: doctor._id,
        assignedDoctorName: doctor.name,
        assignedAt: now,
        assignedBy: currentUser?._id,
        assignedByName: currentUser?.name,
        assignmentNote: note.trim() || undefined,
      });

      // Stamp the triage handoff too, so the triage record shows who took over.
      if (target.triageId) {
        try {
          const { updateTriage } = await import('@/lib/services/triage-service');
          await updateTriage(target.triageId, {
            handoffTo: doctor._id,
            handoffToName: doctor.name,
            handoffAt: now,
          });
        } catch {
          // non-fatal — the patient assignment is the source of truth
        }
      }

      showToast(`${target.patientName} assigned to ${doctor.name}`, 'success');
      onAssigned?.({ id: doctor._id, name: doctor.name });
      onClose();
    } catch {
      showToast('Failed to assign patient', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card-elevated"
        style={{ maxWidth: 480, width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Assign to doctor</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {target.patientName}{target.hospitalNumber ? ` · ${target.hospitalNumber}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-black/5" aria-label="Close">
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search doctors…"
              className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
              style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-input, var(--bg-card-solid))', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Doctor list */}
          <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border-light)' }}>
            {loading ? (
              <p className="p-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Loading doctors…</p>
            ) : doctors.length === 0 ? (
              <p className="p-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No doctors available to assign.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {doctors.map(d => {
                  const selected = d._id === selectedId;
                  return (
                    <li key={d._id}>
                      <button
                        onClick={() => setSelectedId(d._id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors"
                        style={{ background: selected ? 'var(--accent-light)' : 'transparent' }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{d.name}</p>
                          <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                            {d.specialty || (d.role === 'clinical_officer' ? 'Clinical Officer' : d.role === 'medical_superintendent' ? 'Medical Superintendent' : 'Doctor')}
                            {d.hospitalName ? ` · ${d.hospitalName}` : ''}
                          </p>
                        </div>
                        {selected && (
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--accent-primary)' }}>
                            <Check className="w-3.5 h-3.5 text-white" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Handoff note */}
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Handoff note <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Febrile, ?malaria — needs review this morning"
              className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-input, var(--bg-card-solid))', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedId || saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent-primary)' }}
          >
            <Stethoscope className="w-4 h-4" />
            {saving ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
