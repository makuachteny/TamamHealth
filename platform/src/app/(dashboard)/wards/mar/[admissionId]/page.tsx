'use client';

/**
 * MAR — Medication Administration Record.
 *
 * The classic time-grid view nurses use at the bedside on inpatient wards.
 * Rows are scheduled medications for one admission; columns are the
 * scheduled dose times for the selected day. Each cell is one dose: open
 * to record GIVEN / MISSED / REFUSED / HELD with a witness for controlled
 * substances. Append-only by design — the legal record of who gave what,
 * when, to whom.
 *
 * Schedule resolution is best-effort: the prescription's `frequency`
 * string is parsed into clock times. Anything we can't parse (e.g. PRN)
 * gets a single "as needed" column.
 */

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pill, CheckCircle2, X, AlertTriangle, ShieldAlert, Printer, BedDouble,
} from '@/components/icons/lucide';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useWards } from '@/lib/hooks/useWards';
import { usePatients } from '@/lib/hooks/usePatients';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { useToast } from '@/components/Toast';
import type { PrescriptionDoc, MedicationAdministration } from '@/lib/db-types';

/**
 * Parse a free-text frequency string into scheduled clock times for one
 * 24-hour day. Best-effort — falls back to standard q-times for the most
 * common patterns and a single "PRN" slot when nothing matches.
 */
function scheduleForFrequency(freq: string): string[] {
  const f = (freq || '').toLowerCase().trim();
  if (!f) return [];

  if (f.includes('prn') || f.includes('as needed') || f.includes('as required')) return ['PRN'];
  if (f === 'od' || f === 'qd' || f.includes('once') || f.includes('daily')) return ['08:00'];
  if (f === 'bd' || f === 'bid' || f.includes('twice')) return ['08:00', '20:00'];
  if (f === 'tds' || f === 'tid' || f.includes('three times') || f.includes('thrice')) {
    return ['08:00', '14:00', '22:00'];
  }
  if (f === 'qds' || f === 'qid' || f.includes('four times')) {
    return ['06:00', '12:00', '18:00', '00:00'];
  }
  const qMatch = f.match(/q\s*(\d+)\s*h/);
  if (qMatch) {
    const interval = parseInt(qMatch[1], 10);
    if (interval > 0 && interval <= 24) {
      const times: string[] = [];
      for (let h = 0; h < 24; h += interval) {
        times.push(`${h.toString().padStart(2, '0')}:00`);
      }
      return times;
    }
  }
  return ['PRN'];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildScheduledFor(day: string, time: string): string {
  if (time === 'PRN') return new Date().toISOString();
  return new Date(`${day}T${time}:00`).toISOString();
}

function findAdministration(
  rx: PrescriptionDoc,
  day: string,
  time: string,
): MedicationAdministration | undefined {
  const target = buildScheduledFor(day, time);
  return (rx.administrations || []).find(a => a.scheduledFor === target);
}

const STATUS_TINT: Record<MedicationAdministration['status'], { bg: string; color: string; ring: string; label: string }> = {
  given:     { bg: 'rgba(16,185,129,0.12)',  color: '#047857',                ring: 'rgba(16,185,129,0.30)', label: 'Given' },
  missed:    { bg: 'rgba(196,69,54,0.12)',   color: 'var(--tamamhealth-red)', ring: 'rgba(196,69,54,0.30)',  label: 'Missed' },
  refused:   { bg: 'rgba(228,168,75,0.18)',  color: 'var(--color-warning)',   ring: 'rgba(228,168,75,0.32)', label: 'Refused' },
  held:      { bg: 'rgba(100,116,139,0.12)', color: '#475569',                ring: 'rgba(100,116,139,0.26)', label: 'Held' },
  corrected: { bg: 'rgba(124,58,237,0.12)',  color: '#6D28D9',                ring: 'rgba(124,58,237,0.26)', label: 'Corrected' },
};

interface CellProps {
  rx: PrescriptionDoc;
  day: string;
  time: string;
  onRecord: (rx: PrescriptionDoc, scheduledFor: string) => void;
}

function MARCell({ rx, day, time, onRecord }: CellProps) {
  const adm = findAdministration(rx, day, time);
  const scheduledFor = buildScheduledFor(day, time);

  if (adm) {
    const tint = STATUS_TINT[adm.status];
    return (
      <button
        onClick={() => onRecord(rx, scheduledFor)}
        className="w-full h-full p-1.5 text-left rounded-md transition-all"
        style={{
          background: tint.bg,
          color: tint.color,
          border: `1px solid ${tint.ring}`,
          minHeight: 52,
        }}
        title={`${adm.status} by ${adm.administeredByName} at ${new Date(adm.recordedAt).toLocaleTimeString()}`}
      >
        <div className="text-[10.5px] font-bold uppercase" style={{ letterSpacing: '0.04em' }}>
          {tint.label}
        </div>
        <div className="text-[10.5px] truncate" style={{ color: 'var(--text-muted)' }}>
          {adm.administeredByName}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onRecord(rx, scheduledFor)}
      className="w-full h-full rounded-md transition-all hover:bg-blue-50"
      style={{
        border: '1px dashed var(--border-medium)',
        color: 'var(--text-muted)',
        background: 'var(--bg-card-solid)',
        fontSize: 18,
        fontWeight: 600,
        minHeight: 52,
      }}
      aria-label="Record administration"
    >
      +
    </button>
  );
}

export default function MARPage() {
  const params = useParams();
  const admissionId = params?.admissionId as string;
  const router = useRouter();
  const { currentUser } = useApp();
  const { activeAdmissions } = useWards();
  const { patients } = usePatients();
  const { prescriptions, administer } = usePrescriptions();
  const { showToast } = useToast();

  const [day, setDay] = useState<string>(todayISO());
  const [modalRx, setModalRx] = useState<PrescriptionDoc | null>(null);
  const [modalScheduledFor, setModalScheduledFor] = useState<string>('');
  const [modalStatus, setModalStatus] = useState<MedicationAdministration['status']>('given');
  const [modalReason, setModalReason] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalWitness, setModalWitness] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const admission = useMemo(
    () => activeAdmissions.find(a => a._id === admissionId),
    [activeAdmissions, admissionId],
  );

  const patient = useMemo(
    () => admission ? patients.find(p => p._id === admission.patientId) : undefined,
    [patients, admission],
  );

  const allergies = useMemo(
    () => (patient?.allergies || []).filter(a => a && a.toLowerCase() !== 'none known' && a.toLowerCase() !== 'none'),
    [patient],
  );

  const patientRx = useMemo(
    () => prescriptions.filter(rx =>
      rx.patientId === admission?.patientId &&
      (rx.admissionId === admissionId || (!rx.admissionId && rx.status === 'pending'))
    ),
    [prescriptions, admission, admissionId],
  );

  // Union of all scheduled times across active prescriptions, sorted
  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const rx of patientRx) {
      for (const t of scheduleForFrequency(rx.frequency)) set.add(t);
    }
    const times = Array.from(set);
    const clock = times.filter(t => t !== 'PRN').sort();
    if (times.includes('PRN')) clock.push('PRN');
    return clock.length > 0 ? clock : ['08:00'];
  }, [patientRx]);

  const openModal = (rx: PrescriptionDoc, scheduledFor: string) => {
    const existing = (rx.administrations || []).find(a => a.scheduledFor === scheduledFor);
    setModalRx(rx);
    setModalScheduledFor(scheduledFor);
    setModalStatus(existing?.status || 'given');
    setModalReason(existing?.reason || '');
    setModalNotes(existing?.notes || '');
    setModalWitness(existing?.witnessName || '');
  };

  const closeModal = () => {
    setModalRx(null);
    setModalScheduledFor('');
    setModalStatus('given');
    setModalReason('');
    setModalNotes('');
    setModalWitness('');
  };

  const handleSubmit = async () => {
    if (!modalRx || !currentUser) return;
    try {
      setSubmitting(true);
      await administer({
        prescriptionId: modalRx._id,
        scheduledFor: modalScheduledFor,
        status: modalStatus,
        administeredBy: currentUser._id || currentUser.username,
        administeredByName: currentUser.name,
        witnessName: modalWitness.trim() || undefined,
        reason: modalReason.trim() || undefined,
        notes: modalNotes.trim() || undefined,
      });
      showToast('Administration recorded', 'success');
      closeModal();
    } catch (err) {
      console.error(err);
      showToast('Failed to record administration', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!admission) {
    return (
      <>
        <TopBar title="MAR" />
        <main className="page-container">
          <div className="card-elevated p-6 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Admission not found, or the patient is not currently admitted.
            </p>
            <button onClick={() => router.push('/wards')} className="btn btn-primary mt-3">
              Return to wards
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="MAR" />
      <main className="page-container">
        {/* Page header card */}
        <div className="card-elevated p-5 flex items-start justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="mt-0.5 p-1.5 rounded hover:bg-gray-100 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </button>
            <div className="icon-box-lg" style={{ background: 'var(--accent-light)' }}>
              <Pill className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Medication Administration Record
              </h1>
              <div className="mt-1 text-sm flex items-center flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {admission.patientName}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  {admission.wardName}{admission.bedNumber ? ` · ${admission.bedNumber}` : ''}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Attending: {admission.attendingPhysicianName}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold uppercase" style={{
              color: 'var(--text-muted)', letterSpacing: '0.06em',
            }}>Day</label>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={{ minWidth: 160 }}
            />
            <button
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="btn btn-secondary inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        {/* Safety banners */}
        {(allergies.length > 0 || admission.isolationRequired) && (
          <div className="space-y-2 mb-4">
            {allergies.length > 0 && (
              <div
                className="card-elevated px-4 py-3 flex items-start gap-3"
                style={{
                  background: 'rgba(196,69,54,0.05)',
                  borderColor: 'rgba(196,69,54,0.30)',
                }}
              >
                <div className="icon-box-sm shrink-0" style={{ background: 'rgba(196,69,54,0.16)' }}>
                  <ShieldAlert className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-red)' }} />
                </div>
                <div>
                  <div className="text-[10.5px] font-bold uppercase" style={{
                    color: 'var(--tamamhealth-red)', letterSpacing: '0.06em',
                  }}>
                    Allergies
                  </div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--tamamhealth-red-text)' }}>
                    {allergies.join(', ')}
                  </div>
                </div>
              </div>
            )}
            {admission.isolationRequired && (
              <div
                className="card-elevated px-4 py-3 flex items-start gap-3"
                style={{
                  background: 'rgba(228,168,75,0.08)',
                  borderColor: 'rgba(228,168,75,0.30)',
                }}
              >
                <div className="icon-box-sm shrink-0" style={{ background: 'rgba(228,168,75,0.20)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
                </div>
                <div>
                  <div className="text-[10.5px] font-bold uppercase" style={{
                    color: 'var(--color-warning)', letterSpacing: '0.06em',
                  }}>
                    Isolation required
                  </div>
                  <div className="text-sm font-medium mt-0.5">
                    {admission.isolationReason || 'PPE before entry'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MAR grid */}
        {patientRx.length === 0 ? (
          <div className="card-elevated p-8 text-center" style={{ borderStyle: 'dashed' }}>
            <div className="icon-box-lg mx-auto" style={{ background: 'var(--overlay-subtle)' }}>
              <Pill className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm font-semibold mt-3" style={{ color: 'var(--text-secondary)' }}>
              No active prescriptions for this admission.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Order a medication from the consultation page to populate the MAR.
            </p>
          </div>
        ) : (
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: 'var(--overlay-subtle)' }}>
                    <th
                      className="text-left px-4 py-3 font-bold sticky left-0 z-10"
                      style={{
                        minWidth: 280,
                        borderBottom: '1px solid var(--border-light)',
                        color: 'var(--text-secondary)',
                        background: 'var(--overlay-subtle)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Medication
                    </th>
                    {columns.map(t => (
                      <th
                        key={t}
                        className="px-2 py-3 font-bold text-center"
                        style={{
                          minWidth: 100,
                          borderBottom: '1px solid var(--border-light)',
                          color: 'var(--text-secondary)',
                          fontSize: 11,
                          letterSpacing: '0.04em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patientRx.map((rx, idx) => (
                    <tr key={rx._id} style={{
                      background: idx % 2 === 0 ? 'transparent' : 'var(--overlay-subtle)',
                    }}>
                      <td
                        className="px-4 py-3 align-top sticky left-0 z-[5]"
                        style={{
                          background: idx % 2 === 0 ? 'var(--bg-card-solid)' : 'var(--overlay-subtle)',
                          borderBottom: '1px solid var(--border-light)',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="icon-box-sm shrink-0" style={{ background: 'rgba(20,184,166,0.14)' }}>
                            <Pill className="w-3.5 h-3.5" style={{ color: '#0D9488' }} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {rx.medication}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {rx.dose} · {rx.route} · {rx.frequency}
                              {rx.duration && <> · {rx.duration}</>}
                            </div>
                            <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              by {rx.prescribedBy}
                            </div>
                          </div>
                        </div>
                      </td>
                      {columns.map(t => (
                        <td
                          key={t}
                          className="p-1.5 align-middle"
                          style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                          <MARCell rx={rx} day={day} time={t} onRecord={openModal} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
          {(['given', 'missed', 'refused', 'held'] as const).map(s => (
            <span key={s} className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <span
                className="inline-block"
                style={{
                  width: 12, height: 12, borderRadius: 4,
                  background: STATUS_TINT[s].bg,
                  border: `1px solid ${STATUS_TINT[s].ring}`,
                }}
              />
              {STATUS_TINT[s].label}
            </span>
          ))}
          <span style={{ color: 'var(--text-muted)' }}>· Click any cell to record an administration.</span>
        </div>

        {/* Record-administration modal */}
        {modalRx && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(10,18,16,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={closeModal}
          >
            <div
              className="w-full max-w-md card-elevated overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ boxShadow: 'var(--card-shadow-xl)' }}
            >
              <header
                className="px-5 py-3 border-b flex items-start justify-between gap-3"
                style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="icon-box" style={{ background: 'rgba(20,184,166,0.14)' }}>
                    <Pill className="w-4 h-4" style={{ color: '#0D9488' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-bold uppercase" style={{
                      color: 'var(--text-muted)', letterSpacing: '0.06em',
                    }}>Administer</div>
                    <h3 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {modalRx.medication}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {modalRx.dose} · {modalRx.route} · scheduled{' '}
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(modalScheduledFor).toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>
                <button onClick={closeModal} aria-label="Close" className="p-1 rounded hover:bg-gray-100 shrink-0">
                  <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </header>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                    color: 'var(--text-muted)', letterSpacing: '0.06em',
                  }}>Status</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['given', 'missed', 'refused', 'held'] as const).map(s => {
                      const tint = STATUS_TINT[s];
                      const on = modalStatus === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setModalStatus(s)}
                          className="px-2 py-2 text-[11px] font-bold uppercase rounded transition-all"
                          style={{
                            background: on ? tint.bg : 'transparent',
                            color: on ? tint.color : 'var(--text-secondary)',
                            border: `1px solid ${on ? tint.ring : 'var(--border-light)'}`,
                            letterSpacing: '0.06em',
                          }}
                        >
                          {tint.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {modalStatus !== 'given' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                      color: 'var(--text-muted)', letterSpacing: '0.06em',
                    }}>
                      Reason {modalStatus === 'refused' ? '(patient refusal)' : modalStatus === 'held' ? '(why held)' : '(why missed)'}
                    </label>
                    <input
                      type="text"
                      value={modalReason}
                      onChange={(e) => setModalReason(e.target.value)}
                      className="w-full"
                      placeholder="Required"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                    color: 'var(--text-muted)', letterSpacing: '0.06em',
                  }}>
                    Witness <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                      — required for controlled substances
                    </span>
                  </label>
                  <input
                    type="text"
                    value={modalWitness}
                    onChange={(e) => setModalWitness(e.target.value)}
                    className="w-full"
                    placeholder="Witness name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                    color: 'var(--text-muted)', letterSpacing: '0.06em',
                  }}>Notes</label>
                  <textarea
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    rows={2}
                    className="w-full"
                    placeholder="Site, response, patient comments…"
                  />
                </div>
              </div>

              <footer
                className="px-5 py-3 border-t flex items-center justify-between gap-2"
                style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
              >
                <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  Recorded as <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.name}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={closeModal} className="btn btn-secondary">Cancel</button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || (modalStatus !== 'given' && !modalReason.trim())}
                    className="btn btn-primary inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Saving…' : 'Record'}
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
