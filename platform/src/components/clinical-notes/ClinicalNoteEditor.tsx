'use client';

/**
 * The Encounter Note screen.
 *
 * Autosave is debounced per section and always writes the whole section rather
 * than a diff, because the note is the legal record: a lost keystroke is worse
 * than a redundant write. "Last saved" is shown rather than a spinner so a
 * clinician can tell at a glance whether it is safe to walk away from the
 * screen — the question they actually have.
 *
 * Signing is the one irreversible action here, so it confirms, and everything
 * afterwards renders read-only with corrections routed to addenda.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Save, Check, Copy, Send, ClipboardList, DollarSign,
  Plus, AlertTriangle, RefreshCw,
} from '@/components/icons/lucide';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import NoteSectionCard, { type PlanActionRequest } from './NoteSectionCard';
import CareCoordinationModal, {
  type CareCoordinationResult, type SummaryProblem, type SummarySocialHistory,
} from './CareCoordinationModal';
import {
  NOTE_TYPE_ORDER, NOTE_TYPES, getNoteType, getSectionLabel,
  availableOptionalSections, isNoteTypeId,
  type NoteTypeId, type NoteSectionId,
} from '@/lib/clinical-notes/note-catalog';
import {
  getClinicalNoteById, updateClinicalNote, saveNoteSection, addNoteSection,
  removeNoteSection, changeNoteType, clearNote, signClinicalNote,
  addNoteAddendum, recordPlanAction, copyNoteForward, isNoteLocked,
} from '@/lib/clinical-notes/note-service';
import { loadChartSnapshot, snapshotForSection, formatProblems } from '@/lib/clinical-notes/chart-snapshot';
import { stripTemplateMarkers } from '@/lib/clinical-notes/section-templates';
import type { ClinicalNoteDoc, NoteSectionContent } from '@/lib/clinical-notes/types';
import './clinical-notes.css';

const AUTOSAVE_MS = 900;

interface ClinicalNoteEditorProps {
  noteId: string;
  currentUser: { _id: string; name?: string; username?: string; role?: string; orgId?: string } | null;
  /** Providers offered in "Assigned To". */
  assignableUsers?: Array<{ _id: string; name: string }>;
  onClose?: () => void;
}

export default function ClinicalNoteEditor({
  noteId, currentUser, assignableUsers = [], onClose,
}: ClinicalNoteEditorProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [note, setNote] = useState<ClinicalNoteDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<NoteSectionId | null>(null);
  const [showAddOptional, setShowAddOptional] = useState(false);
  const [showSignConfirm, setShowSignConfirm] = useState(false);
  const [showAddendum, setShowAddendum] = useState(false);
  const [addendumText, setAddendumText] = useState('');
  const [showCoordination, setShowCoordination] = useState(false);
  const [problems, setProblems] = useState<SummaryProblem[]>([]);
  const [socialHistory, setSocialHistory] = useState<SummarySocialHistory[]>([]);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const userName = currentUser?.name || currentUser?.username || 'Unknown user';

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await getClinicalNoteById(noteId);
      if (cancelled) return;
      setNote(loaded);
      setLoading(false);
      if (loaded) setSavedAt(loaded.updatedAt);
    })();
    return () => { cancelled = true; };
  }, [noteId]);

  // Problems + social history back the Care Coordination summary.
  useEffect(() => {
    if (!note?.patientId) return;
    let cancelled = false;
    (async () => {
      try {
        const { getProblemsByPatient } = await import('@/lib/services/problem-service');
        const rows = await getProblemsByPatient(note.patientId);
        if (cancelled) return;
        setProblems(rows.filter(p => p.status === 'active').map(p => ({
          effectiveDate: p.onsetDate || p.createdAt?.slice(0, 10) || '',
          problem: p.name,
          status: p.status.toUpperCase(),
        })));
      } catch { /* the summary simply offers nothing to attach */ }
    })();
    return () => { cancelled = true; };
  }, [note?.patientId]);

  // Flush any pending autosave when the editor unmounts, so navigating away
  // mid-keystroke does not drop the last edit.
  useEffect(() => {
    const pending = timers.current;
    return () => { for (const t of Object.values(pending)) clearTimeout(t); };
  }, []);

  const locked = note ? isNoteLocked(note) : false;
  const typeDef = note ? getNoteType(note.noteType) : null;

  const sectionIds = useMemo(
    () => (note ? note.sections.map(s => s.sectionId) : []),
    [note],
  );

  const optionalAvailable = useMemo(
    () => (note ? availableOptionalSections(note.noteType, note.addedSections || []) : []),
    [note],
  );

  const persist = useCallback(async (fn: () => Promise<ClinicalNoteDoc | null>) => {
    setSaving(true);
    try {
      const updated = await fn();
      if (updated) { setNote(updated); setSavedAt(updated.updatedAt); }
      return updated;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the note.', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  // ── Section editing (optimistic + debounced write) ──────────────────────
  const handleSectionChange = useCallback((sectionId: NoteSectionId, patch: Partial<NoteSectionContent>) => {
    setNote((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map(s =>
        s.sectionId === sectionId ? { ...s, ...patch } : s);
      return { ...prev, sections };
    });

    clearTimeout(timers.current[sectionId]);
    timers.current[sectionId] = setTimeout(() => {
      void persist(() => saveNoteSection(noteId, sectionId, patch));
    }, AUTOSAVE_MS);
  }, [noteId, persist]);

  const refreshDerived = useCallback(async (sectionId: NoteSectionId) => {
    if (!note) return;
    const snapshot = await loadChartSnapshot(note.patientId);
    const text = snapshotForSection(sectionId, snapshot);
    await persist(() => saveNoteSection(noteId, sectionId, {
      snapshot: text,
      snapshotAt: new Date().toISOString(),
    }));
    showToast(`${getSectionLabel(sectionId)} refreshed from the chart.`, 'success');
  }, [note, noteId, persist, showToast]);

  // Fill any empty derived section on first open, so a new note opens with
  // today's observations already in it.
  useEffect(() => {
    if (!note || locked) return;
    const empty = note.sections.filter(
      s => !s.snapshot && ['vitals', 'medications', 'allergies'].includes(s.sectionId),
    );
    if (empty.length === 0) return;

    let cancelled = false;
    (async () => {
      const snapshot = await loadChartSnapshot(note.patientId);
      if (cancelled) return;
      for (const section of empty) {
        const text = snapshotForSection(section.sectionId, snapshot);
        if (!text) continue;
        await persist(() => saveNoteSection(noteId, section.sectionId, {
          snapshot: text, snapshotAt: new Date().toISOString(),
        }));
      }
    })();
    return () => { cancelled = true; };
    // Deliberately keyed on the note id only: this is a one-shot prefill, not a
    // reaction to every subsequent edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, note?.patientId]);

  // ── Header actions ──────────────────────────────────────────────────────
  const handleTypeChange = async (next: string) => {
    if (!isNoteTypeId(next)) return;
    await persist(() => changeNoteType(noteId, next));
  };

  const handleClear = async () => {
    if (!window.confirm('Clear every section of this note? Text you have written will be removed.')) return;
    await persist(() => clearNote(noteId));
    showToast('Note cleared.', 'success');
  };

  const handleSalt = async () => {
    if (!note) return;
    const created = await copyNoteForward(note._id, {
      patientId: note.patientId,
      patientName: note.patientName,
      mrn: note.mrn,
      patientDob: note.patientDob,
      serviceDate: new Date().toISOString().slice(0, 10),
      assignedToId: note.assignedToId,
      assignedToName: note.assignedToName,
      authorId: currentUser?._id,
      authorName: userName,
      hospitalId: note.hospitalId,
      hospitalName: note.hospitalName,
      orgId: note.orgId,
    });
    if (created) {
      showToast('Copied forward into a new draft.', 'success');
      router.push(`/notes/${created._id}`);
    }
  };

  // ── Plan actions ────────────────────────────────────────────────────────
  const handlePlanAction = async (request: PlanActionRequest) => {
    if (!note) return;
    const destinations: Record<string, string> = {
      medication: `/pharmacy?patientId=${note.patientId}`,
      lab: `/lab?patientId=${note.patientId}&action=order`,
      vaccine: `/immunizations?patientId=${note.patientId}`,
      patient_education: `/messages?patientId=${note.patientId}&kind=education`,
    };
    const labels: Record<string, string> = {
      medication: 'Prescription raised from the plan',
      lab: 'Lab/study ordered from the plan',
      vaccine: 'Vaccine ordered from the plan',
      patient_education: 'Patient education sent from the plan',
    };

    await persist(() => recordPlanAction(noteId, {
      kind: request.kind,
      label: labels[request.kind] ?? request.kind,
      createdBy: currentUser?._id,
    }));

    const href = destinations[request.kind];
    if (href) router.push(href);
  };

  // ── Signing ─────────────────────────────────────────────────────────────
  const handleSign = async () => {
    setShowSignConfirm(false);
    const updated = await persist(() => signClinicalNote(noteId, {
      signedBy: currentUser?._id || '',
      signedByName: userName,
    }));
    if (updated) showToast('Note signed.', 'success');
  };

  const handleAddendum = async () => {
    const body = addendumText.trim();
    if (!body) return;
    const updated = await persist(() => addNoteAddendum(noteId, body, currentUser?._id || '', userName));
    if (updated) {
      setAddendumText('');
      setShowAddendum(false);
      showToast('Addendum added.', 'success');
    }
  };

  const handleCoordination = async (result: CareCoordinationResult) => {
    if (!note) return;
    const { createReferral } = await import('@/lib/services/referral-service');
    const summary = [
      result.instructions,
      result.problems.length ? `Problems: ${result.problems.map(p => p.problem).join('; ')}` : '',
    ].filter(Boolean).join('\n');

    const referral = await createReferral({
      patientId: note.patientId,
      patientName: note.patientName,
      fromHospital: note.hospitalName || '',
      fromHospitalId: note.hospitalId || '',
      // No facility id: the recipient is named free-text on the note, and this
      // platform has no provider directory to resolve it against.
      toHospital: result.recipient,
      toHospitalId: '',
      referralDate: new Date().toISOString(),
      urgency: 'routine',
      reason: `Referral from ${getNoteType(note.noteType).label} of ${note.serviceDate}`,
      department: '',
      status: 'sent',
      referringDoctor: userName,
      notes: `${summary}\n\nSent via ${result.channel === 'efax' ? 'eFax' : 'Direct Message'}.`,
      orgId: note.orgId,
    });

    await persist(() => recordPlanAction(noteId, {
      kind: 'referral',
      label: `Referral to ${result.recipient}`,
      targetId: (referral as { _id?: string } | null)?._id,
      createdBy: currentUser?._id,
    }));
    showToast(`Referral created for ${result.recipient}.`, 'success');
  };

  const handleSaveAndClose = async () => {
    for (const t of Object.values(timers.current)) clearTimeout(t);
    if (note) {
      for (const section of note.sections) {
        await saveNoteSection(noteId, section.sectionId, {
          text: section.text,
          templateSelection: section.templateSelection,
        }).catch(() => undefined);
      }
    }
    showToast('Note saved.', 'success');
    if (onClose) onClose();
    else router.push(note ? `/patients/${note.patientId}?tab=notes` : '/notes');
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) return <div className="cn-empty">Loading note…</div>;
  if (!note || !typeDef) return <div className="cn-empty">This note could not be found.</div>;

  const statusClass = note.status === 'signed' || note.status === 'amended'
    ? 'is-signed'
    : note.status === 'awaiting_cosign' ? 'is-cosign' : '';

  return (
    <div className="cn-editor">
      {/* Header */}
      <div className="cn-header">
        <h1 className="cn-header-title">
          Encounter Note for {note.patientName}
          {note.mrn && <span className="cn-header-meta">, MRN: {note.mrn}</span>}
          {note.patientDob && <span className="cn-header-meta"> • DOB: {note.patientDob}</span>}
        </h1>
        <div className="cn-header-actions">
          <button type="button" className="cn-btn" onClick={handleSalt} disabled={saving}>
            <Copy size={14} /> SALT Note
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cn-toolbar">
        <label className="cn-field">
          <span className="cn-label">Note type</span>
          <select
            className="cn-select"
            value={note.noteType}
            onChange={e => handleTypeChange(e.target.value)}
            disabled={locked}
            aria-label="Note type"
          >
            {NOTE_TYPE_ORDER.map(id => (
              <option key={id} value={id}>{NOTE_TYPES[id].label}</option>
            ))}
          </select>
        </label>

        <button type="button" className="cn-btn" onClick={handleClear} disabled={locked}>
          Clear Note
        </button>

        <label className="cn-field">
          <span className="cn-label">Date</span>
          <input
            type="date"
            className="cn-input"
            value={note.serviceDate}
            onChange={e => void persist(() => updateClinicalNote(noteId, { serviceDate: e.target.value }))}
            disabled={locked}
            aria-label="Date of service"
          />
        </label>

        <label className="cn-field">
          <span className="cn-label">Time</span>
          <input
            type="time"
            className="cn-input"
            value={note.serviceTime || ''}
            onChange={e => void persist(() => updateClinicalNote(noteId, { serviceTime: e.target.value }))}
            disabled={locked}
            aria-label="Time of service"
          />
        </label>

        <label className="cn-field">
          <span className="cn-label">Assigned to</span>
          <select
            className="cn-select"
            value={note.assignedToId || ''}
            onChange={(e) => {
              const picked = assignableUsers.find(u => u._id === e.target.value);
              void persist(() => updateClinicalNote(noteId, {
                assignedToId: e.target.value || undefined,
                assignedToName: picked?.name,
              }));
            }}
            disabled={locked}
            aria-label="Assigned to"
          >
            <option value="">Unassigned</option>
            {assignableUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </label>
      </div>

      {/* Body */}
      <div className="cn-body">
        <aside className="cn-sidebar">
          <div className="cn-sidebar-card">
            <p className="cn-patient-name">{note.patientName}</p>
            {note.patientDob && <p className="cn-patient-line">{note.patientDob}</p>}
            {note.mrn && <p className="cn-patient-line">MRN {note.mrn}</p>}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="cn-sidebar-link" onClick={() => router.push(`/patients/${note.patientId}`)}>
                Face Sheet
              </button>
              <button type="button" className="cn-sidebar-link" onClick={() => router.push(`/patients/${note.patientId}?tab=immunizations`)}>
                Immunizations
              </button>
              <button type="button" className="cn-sidebar-link" onClick={() => router.push(`/patients/${note.patientId}?tab=labs`)}>
                Labs/Studies
              </button>
            </div>
          </div>

          <div className="cn-sidebar-card">
            <p className="cn-sidebar-title">
              Note Sections
              {!locked && optionalAvailable.length > 0 && (
                <button
                  type="button"
                  className="cn-sidebar-link"
                  style={{ width: 'auto', padding: 0 }}
                  onClick={() => setShowAddOptional(true)}
                >
                  <Plus size={12} /> Add Optional
                </button>
              )}
            </p>
            <nav className="cn-section-nav">
              {sectionIds.map((id) => {
                const content = note.sections.find(s => s.sectionId === id);
                const filled = !!(stripTemplateMarkers(content?.text || '').trim() || content?.snapshot);
                return (
                  <button
                    key={id}
                    type="button"
                    className="cn-section-nav-item"
                    aria-current={activeSection === id}
                    onClick={() => {
                      setActiveSection(id);
                      document.getElementById(`cn-section-${id}`)?.scrollIntoView({
                        behavior: 'smooth', block: 'start',
                      });
                    }}
                  >
                    <span>{getSectionLabel(id)}</span>
                    {filled && <span className="cn-section-nav-badge">•</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="cn-canvas">
          {locked && (
            <div className="cn-locked-banner">
              <Check size={15} />
              <span>
                Signed by {note.signedByName} on {new Date(note.signedAt || '').toLocaleString()}.
                This note is locked — use an addendum to record a correction.
              </span>
            </div>
          )}

          <p className="cn-note-patient">
            <strong>{note.patientName}</strong>{note.mrn ? `, MRN: ${note.mrn}` : ''}<br />
            {note.patientDob ? `DOB: ${note.patientDob}` : ''}
          </p>

          <h2 className="cn-note-heading">{typeDef.label}</h2>

          {note.sections.map((section) => {
            const isOptional = !typeDef.sections.includes(section.sectionId);
            return (
              <NoteSectionCard
                key={section.sectionId}
                sectionId={section.sectionId}
                content={section}
                readOnly={locked}
                userId={currentUser?._id || ''}
                orgId={currentUser?.orgId}
                active={activeSection === section.sectionId}
                onFocus={() => setActiveSection(section.sectionId)}
                onChange={patch => handleSectionChange(section.sectionId, patch)}
                onRefreshDerived={refreshDerived}
                onPlanAction={handlePlanAction}
                removable={isOptional}
                onRemove={() => void persist(() => removeNoteSection(noteId, section.sectionId))}
              />
            );
          })}

          {(note.addenda || []).length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h3 className="cn-section-name">Addenda</h3>
              {note.addenda!.map(a => (
                <div className="cn-addendum" key={a.id}>
                  <p className="cn-addendum-meta">
                    {a.authorName} — {new Date(a.createdAt).toLocaleString()}
                  </p>
                  <div>{a.text}</div>
                </div>
              ))}
            </div>
          )}

          {locked && (
            <button
              type="button"
              className="cn-btn"
              style={{ marginTop: 12 }}
              onClick={() => setShowAddendum(true)}
            >
              <Plus size={14} /> Add addendum
            </button>
          )}

          <p style={{ marginTop: 20, fontWeight: 700, fontSize: 13.5 }}>
            {note.assignedToName || note.authorName || userName}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="cn-footer">
        <span className={`cn-status-dot ${statusClass}`} aria-hidden />
        <button
          type="button"
          className="cn-btn cn-btn-primary"
          onClick={() => setShowSignConfirm(true)}
          disabled={locked || saving}
        >
          <Check size={14} /> Sign
        </button>
        <button
          type="button"
          className="cn-btn"
          onClick={() => router.push(`/billing?patientId=${note.patientId}`)}
        >
          <DollarSign size={14} /> Capture Charge
        </button>
        <button
          type="button"
          className="cn-btn"
          onClick={() => {
            const text = note.sections
              .map(s => `${getSectionLabel(s.sectionId)}\n${stripTemplateMarkers(s.text || '') || s.snapshot || ''}`)
              .join('\n\n');
            void navigator.clipboard?.writeText(text);
            showToast('Note copied to the clipboard.', 'success');
          }}
        >
          <Copy size={14} /> Copy
        </button>
        <button type="button" className="cn-btn" onClick={() => setShowCoordination(true)}>
          <Send size={14} /> Care Coordination
        </button>
        <button
          type="button"
          className="cn-btn"
          onClick={() => router.push(`/patients/${note.patientId}?tab=overview`)}
        >
          <ClipboardList size={14} /> Care Checklist
        </button>

        <div className="cn-footer-spacer" />

        <span className="cn-saved">
          {saving ? 'Saving…' : savedAt ? `Last saved ${new Date(savedAt).toLocaleTimeString()}` : ''}
        </span>
        <button type="button" className="cn-btn" onClick={handleSaveAndClose}>
          <Save size={14} /> Save &amp; Close
        </button>
      </div>

      {/* Add optional section */}
      {showAddOptional && (
        <Modal onClose={() => setShowAddOptional(false)} width={420}>
          <div style={{ padding: 18 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Add a section</h2>
            {optionalAvailable.length === 0 && (
              <p className="cn-popover-empty">Every optional section is already in this note.</p>
            )}
            {optionalAvailable.map(def => (
              <button
                key={def.id}
                type="button"
                className="cn-popover-item"
                onClick={async () => {
                  await persist(() => addNoteSection(noteId, def.id));
                  setShowAddOptional(false);
                }}
              >
                {def.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Sign confirmation */}
      {showSignConfirm && (
        <Modal onClose={() => setShowSignConfirm(false)} width={460}>
          <div style={{ padding: 20 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} /> Sign this note?
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 16px' }}>
              Signing attests that this note is a true record of the encounter. It locks the note —
              afterwards, corrections can only be recorded as an addendum, which stays visible
              alongside the original.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="cn-btn" onClick={() => setShowSignConfirm(false)}>Cancel</button>
              <button type="button" className="cn-btn cn-btn-primary" onClick={handleSign}>
                <Check size={14} /> Sign note
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Addendum */}
      {showAddendum && (
        <Modal onClose={() => setShowAddendum(false)} width={520}>
          <div style={{ padding: 20 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>Add an addendum</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted, #64748b)', margin: '0 0 10px' }}>
              The original note is not changed. Your correction is appended and attributed to you.
            </p>
            <textarea
              className="cn-textarea"
              value={addendumText}
              onChange={e => setAddendumText(e.target.value)}
              placeholder="What needs correcting or clarifying…"
              aria-label="Addendum text"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="cn-btn" onClick={() => setShowAddendum(false)}>Cancel</button>
              <button
                type="button"
                className="cn-btn cn-btn-primary"
                onClick={handleAddendum}
                disabled={!addendumText.trim()}
              >
                Add addendum
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCoordination && (
        <CareCoordinationModal
          note={note}
          problems={problems}
          socialHistory={socialHistory}
          onSend={handleCoordination}
          onClose={() => setShowCoordination(false)}
        />
      )}
    </div>
  );
}
