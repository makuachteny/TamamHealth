'use client';

/**
 * Patient Communication — in-chart, staff-facing messaging module (spec §3).
 *
 * Left/main: a single shared two-way SMS-style timeline between the care team
 * and the patient (sourced from getMessagesByPatient — internal staff chat is
 * already excluded by that service).
 *
 * Right panel: INTERNAL clinical notes that the patient never sees. These live
 * in a completely separate database (tamamhealth_patient_notes) via
 * patient-note-service, so they can never leak into any patient-facing query.
 */

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { ROLE_LABEL } from '@/lib/role-display';
import type { MessageDoc, PatientNoteDoc } from '@/lib/db-types';
import { Send, Lock, Trash2, MessageSquare, ShieldCheck } from '@/components/icons/lucide';

interface Props {
  patientId: string;
  patientName: string;
  patientPhone?: string;
}

function clockTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Staff-only delivery/read state derived from direction + status + readBy. */
function deliveryLabel(m: MessageDoc): string {
  if (m.direction === 'patient_to_staff' || m.fromDoctorId === 'patient') return 'Patient replied';
  if (m.readBy && m.readBy.length > 0) return 'Read by patient';
  if (m.status === 'delivered' || m.smsResult?.ok) return 'Delivered';
  if (m.status === 'failed' || m.smsResult?.ok === false) return 'Failed';
  return 'Sent';
}

export default function PatientCommunication({ patientId, patientName, patientPhone }: Props) {
  const { currentUser } = useApp();

  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [notes, setNotes] = useState<PatientNoteDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState('');
  const [noReply, setNoReply] = useState(false);
  const [sending, setSending] = useState(false);

  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadMessages = useCallback(async () => {
    const { getMessagesByPatient } = await import('@/lib/services/message-service');
    const data = await getMessagesByPatient(patientId);
    // Service returns newest-first; render oldest-first (chat order).
    setMessages([...data].reverse());
  }, [patientId]);

  const loadNotes = useCallback(async () => {
    const { getNotesByPatient } = await import('@/lib/services/patient-note-service');
    setNotes(await getNotesByPatient(patientId));
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadMessages(), loadNotes()]);
      } catch (err) {
        console.error('Failed to load patient communication', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadMessages, loadNotes]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !currentUser || sending) return;
    setSending(true);
    try {
      const { createMessage } = await import('@/lib/services/message-service');
      const now = new Date().toISOString();
      await createMessage({
        direction: 'staff_to_patient',
        recipientType: 'patient',
        patientId,
        patientName,
        patientPhone: patientPhone || '',
        fromDoctorId: currentUser._id || `user-${currentUser.username}`,
        fromDoctorName: currentUser.name,
        fromHospitalId: currentUser.hospitalId || '',
        fromHospitalName: currentUser.hospitalName || '',
        // The "system / no-reply" toggle marks an automated message the patient
        // cannot respond to — flagged via the subject (kept simple per spec).
        subject: noReply ? 'Automated notification (no reply)' : 'Message from your care team',
        body,
        channel: 'sms',
        sentAt: now,
        orgId: currentUser.orgId,
      });
      setDraft('');
      setNoReply(false);
      await loadMessages();
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const handleAddNote = async () => {
    const body = noteDraft.trim();
    if (!body || !currentUser || savingNote) return;
    setSavingNote(true);
    try {
      const { createPatientNote } = await import('@/lib/services/patient-note-service');
      await createPatientNote({
        patientId,
        body,
        authorId: currentUser._id || `user-${currentUser.username}`,
        authorName: currentUser.name,
        authorRole: ROLE_LABEL[currentUser.role] || currentUser.role,
        hospitalId: currentUser.hospitalId,
        orgId: currentUser.orgId,
      });
      setNoteDraft('');
      await loadNotes();
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    const { deletePatientNote } = await import('@/lib/services/patient-note-service');
    await deletePatientNote(id);
    await loadNotes();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ───── Conversation timeline ───── */}
      <div
        className="lg:col-span-2 flex flex-col"
        style={{
          background: 'var(--bg-card-solid)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--card-radius, 16px)',
          boxShadow: 'var(--card-shadow)',
          minHeight: 460,
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <MessageSquare className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <div className="text-sm font-semibold">Conversation with {patientName}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {patientPhone || 'No phone on file'} · Shared two-way SMS timeline
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No messages yet. Send the patient a message below.
            </p>
          ) : (
            messages.map((m) => {
              const fromPatient = m.direction === 'patient_to_staff' || m.fromDoctorId === 'patient';
              const mine = !fromPatient; // staff messages on one side, patient on the other
              return (
                <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div style={{ maxWidth: '78%' }}>
                    <div
                      className="text-[10px] mb-0.5 px-1"
                      style={{ color: 'var(--text-muted)', textAlign: mine ? 'right' : 'left' }}
                    >
                      {fromPatient ? patientName : m.fromDoctorName}
                      {!fromPatient && m.fromHospitalName ? ` · ${m.fromHospitalName}` : ''}
                    </div>
                    <div
                      className="px-3 py-2 text-[13px]"
                      style={{
                        background: mine ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: mine ? '#fff' : 'var(--text-primary)',
                        border: mine ? 'none' : '1px solid var(--border-light)',
                        borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.subject && m.subject.toLowerCase().includes('no reply') && (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide mb-1"
                          style={{ opacity: 0.85 }}
                        >
                          <Lock className="w-2.5 h-2.5" /> Automated
                        </span>
                      )}
                      <div>{m.body}</div>
                    </div>
                    <div
                      className="text-[10px] mt-0.5 px-1 flex items-center gap-1.5"
                      style={{ color: 'var(--text-muted)', justifyContent: mine ? 'flex-end' : 'flex-start' }}
                    >
                      <span>{clockTime(m.sentAt)}</span>
                      <span>·</span>
                      <span>{deliveryLabel(m)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--border-light)' }}>
          <label
            className="flex items-center gap-1.5 text-[11px] font-medium mb-2 cursor-pointer w-fit"
            style={{ color: 'var(--text-muted)' }}
          >
            <input type="checkbox" checked={noReply} onChange={e => setNoReply(e.target.checked)} />
            <Lock className="w-3 h-3" /> System / no-reply message (patient can&apos;t respond)
          </label>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
              }}
              rows={2}
              placeholder={`Message ${patientName} via SMS…`}
              className="flex-1 text-[13px]"
              style={{ padding: '9px 12px', borderRadius: 10, resize: 'none' }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="flex items-center justify-center text-white flex-shrink-0"
              style={{
                width: 42, height: 42, borderRadius: 10,
                background: draft.trim() && !sending ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                cursor: draft.trim() && !sending ? 'pointer' : 'default',
              }}
              title="Send"
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {/* ───── Internal notes (staff-only) ───── */}
      <div
        className="flex flex-col"
        style={{
          background: 'var(--bg-card-solid)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--card-radius, 16px)',
          boxShadow: 'var(--card-shadow)',
          minHeight: 460,
        }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
            <div className="text-sm font-semibold">Internal Notes</div>
          </div>
          <div
            className="text-[10px] font-semibold uppercase tracking-wide mt-1"
            style={{ color: 'var(--color-warning)' }}
          >
            Internal — not visible to patient
          </div>
        </div>

        <div className="p-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <textarea
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            rows={3}
            placeholder="Quick internal note (e.g. left voicemail, family contacted)…"
            className="w-full text-[13px]"
            style={{ padding: '9px 12px', borderRadius: 10, resize: 'none' }}
          />
          <button
            onClick={handleAddNote}
            disabled={!noteDraft.trim() || savingNote}
            className="mt-2 w-full text-[12px] font-semibold py-2 rounded-lg text-white"
            style={{
              background: noteDraft.trim() && !savingNote ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
              cursor: noteDraft.trim() && !savingNote ? 'pointer' : 'default',
            }}
          >
            Add internal note
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: 0 }}>
          {notes.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No internal notes yet.</p>
          ) : (
            notes.map((n) => (
              <div
                key={n._id}
                className="p-2.5 rounded-lg group"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
              >
                <div className="text-[13px]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.body}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {n.authorName}{n.authorRole ? ` · ${n.authorRole}` : ''} · {clockTime(n.createdAt)}
                  </div>
                  <button
                    onClick={() => handleDeleteNote(n._id)}
                    className="p-1 rounded opacity-60 hover:opacity-100"
                    style={{ color: 'var(--color-danger)' }}
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
