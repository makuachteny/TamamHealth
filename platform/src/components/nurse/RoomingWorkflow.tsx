'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { useRooming } from '@/lib/hooks/useRooming';
import { BedDouble, Clock, CheckCircle2, ArrowRightLeft, LogIn } from '@/components/icons/lucide';
import type { RoomingWorklistEntry } from '@/lib/services/rooming-service';

/**
 * The rooming station (KAN-99 / KAN-108).
 *
 * The step between triage and the clinician: acknowledge the patient reached
 * the clinic, put them in a room, take rooming vitals, and mark them ready.
 * Every action drives a real encounter transition, so the clinician's worklist
 * updates as a consequence rather than by a separate write.
 */

const STEP_LABEL: Record<RoomingWorklistEntry['step'], string> = {
  awaiting_arrival: 'Not yet arrived',
  awaiting_rooming: 'Waiting for a room',
  being_roomed: 'In room',
};

/**
 * Wait bands. Colour is driven by how long someone has been waiting because
 * that is the only thing on this screen that gets worse on its own — nothing
 * else here needs to compete for attention.
 */
function waitTone(minutes: number): { bg: string; fg: string } {
  if (minutes >= 60) return { bg: 'var(--danger-light)', fg: 'var(--color-danger)' };
  if (minutes >= 30) return { bg: 'var(--warning-light)', fg: 'var(--color-warning)' };
  return { bg: 'var(--overlay-subtle)', fg: 'var(--text-secondary)' };
}

export default function RoomingWorkflow() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const { entries, loading, error, markArrived, assignRoom, transferClinic, markReady } = useRooming();

  // Room being typed, keyed by encounter — several patients can be part-way
  // through rooming at once, so a single shared input would leak one nurse's
  // half-finished entry onto another patient's row.
  const [roomDraft, setRoomDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const actor = { actorId: currentUser?._id, actorName: currentUser?.name };

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusy(id);
    try {
      await action();
      toast.showToast(success, 'success');
    } catch (err) {
      // Surface the machine's own message — "Assign a room before marking the
      // patient ready" is more use than a generic failure.
      toast.showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Loading the rooming worklist…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  }

  return (
    <div data-tour="rooming-board" className="overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BedDouble className="w-6 h-6 mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nobody waiting to be roomed</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Patients appear here once triage routes them to your clinic.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ minHeight: 0 }}>
          {entries.map(({ encounter, step, waitingMinutes }) => {
            const tone = waitTone(waitingMinutes);
            const isBusy = busy === encounter._id;

            return (
              <div
                key={encounter._id}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {encounter.patientName}
                    </span>
                    {encounter.roomNumber && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}
                      >
                        Room {encounter.roomNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{STEP_LABEL[step]}</span>
                    {encounter.destinationClinic && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        · {encounter.destinationClinic}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded flex-shrink-0"
                  style={{ background: tone.bg, color: tone.fg }}
                  title="Time since this visit started"
                >
                  <Clock className="w-3 h-3" /> {waitingMinutes}m
                </span>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {step === 'awaiting_arrival' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => run(encounter._id, () => markArrived(encounter._id, currentUser?._id), 'Patient marked arrived')}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded"
                      style={{ background: 'var(--overlay-subtle)', color: 'var(--text-primary)' }}
                    >
                      <LogIn className="w-3.5 h-3.5" /> Arrived
                    </button>
                  )}

                  {step === 'awaiting_rooming' && (
                    <>
                      <input
                        value={roomDraft[encounter._id] || ''}
                        onChange={e => setRoomDraft(d => ({ ...d, [encounter._id]: e.target.value }))}
                        placeholder="Room"
                        aria-label={`Room for ${encounter.patientName}`}
                        className="text-xs px-2 py-1.5 rounded"
                        style={{ width: 76, border: '1px solid var(--border-light)', background: 'var(--bg-app)' }}
                      />
                      <button
                        type="button"
                        disabled={isBusy || !(roomDraft[encounter._id] || '').trim()}
                        onClick={() => run(
                          encounter._id,
                          () => assignRoom(encounter._id, roomDraft[encounter._id], actor),
                          'Room assigned',
                        )}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded"
                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                      >
                        <BedDouble className="w-3.5 h-3.5" /> Assign
                      </button>
                    </>
                  )}

                  {step === 'being_roomed' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => run(encounter._id, () => markReady(encounter._id, actor), 'Ready for the clinician')}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded"
                      style={{ background: 'var(--accent-primary)', color: '#fff' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                    </button>
                  )}

                  {step !== 'awaiting_arrival' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        const clinic = window.prompt('Route this patient to which clinic?');
                        if (clinic?.trim()) {
                          run(encounter._id, () => transferClinic(encounter._id, clinic, actor), 'Patient re-routed');
                        }
                      }}
                      title="Route to a different clinic"
                      aria-label={`Route ${encounter.patientName} to a different clinic`}
                      className="flex items-center justify-center rounded"
                      style={{ width: 30, height: 30, color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
