'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useApp } from '@/lib/context';
import { useWards } from '@/lib/hooks/useWards';
import Modal from '@/components/Modal';
import { Pill, Check, X, CheckCircle2, RotateCcw, FileText } from '@/components/icons/lucide';
import type { MedicationAdministration } from '@/lib/db-types';
import { useMarEntries, type MAREntry } from './shared';
import RowActionsMenu from '@/components/referrals/RowActionsMenu';
import ListSearch from './ListSearch';
import { initials } from '@/lib/patient-utils';

type AdminStatus = 'given' | 'held' | 'refused' | 'missed';

export default function MarWorkflow({ onAdminister }: { onAdminister?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { marEntries, markGiven, recordEntry, undoAdministration } = useMarEntries();
  const { activeAdmissions } = useWards();

  // patientId → their active ward/bed placement, for the Source column —
  // MAREntry itself carries no ward/bed (it's sourced from prescriptions),
  // so this is the same real-admission join WardWorkflow uses.
  const admissionByPatient = useMemo(() => {
    const map = new Map<string, { wardName: string; bedNumber?: string }>();
    for (const a of activeAdmissions) {
      if (!map.has(a.patientId)) map.set(a.patientId, { wardName: a.wardName, bedNumber: a.bedNumber });
    }
    return map;
  }, [activeAdmissions]);

  // Administration modal state
  const [modalEntry, setModalEntry] = useState<MAREntry | null>(null);
  const [modalStatus, setModalStatus] = useState<AdminStatus>('given');
  const [modalReason, setModalReason] = useState('');
  const [modalDose, setModalDose] = useState('');
  const [modalRoute, setModalRoute] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalWitness, setModalWitness] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline list search — filters the MAR rows by patient or medication.
  const [search, setSearch] = useState('');
  // Status filter — narrows the rows to a single administration status.
  const [statusFilter, setStatusFilter] = useState<'all' | MAREntry['status']>('all');
  const q = search.trim().toLowerCase();
  const filteredEntries = marEntries.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (q && !(e.patientName.toLowerCase().includes(q) || e.medication.toLowerCase().includes(q))) return false;
    return true;
  });

  const STATUS_FILTERS: { key: 'all' | MAREntry['status']; label: string }[] = [
    { key: 'all', label: t('patients.all') },
    { key: 'overdue', label: t('nurse.marOverdue') },
    { key: 'due', label: t('nurse.marDueNow') },
    { key: 'upcoming', label: t('nurse.marUpcoming') },
    { key: 'given', label: t('nurse.marGiven') },
  ];

  const STATUS_LABEL: Record<AdminStatus, string> = {
    given: t('nurse.marStatusGiven'),
    held: t('nurse.marStatusHeld'),
    refused: t('nurse.marStatusRefused'),
    missed: t('nurse.marStatusMissed'),
  };

  // Queue-card pill tone for each due-state — honest, distinct colors: red
  // for overdue, yellow for due-now, green for given, and a plain neutral
  // (not yet due, nothing to flag) for upcoming.
  const DUE_TONE: Record<MAREntry['status'], 'red' | 'yellow' | 'green' | 'neutral'> = {
    overdue: 'red', due: 'yellow', upcoming: 'neutral', given: 'green',
  };

  const marStatusColor = (status: MAREntry['status']) => {
    switch (status) {
      case 'overdue': return { bg: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', label: t('nurse.marOverdue') };
      case 'due': return { bg: 'rgba(251,191,36,0.12)', color: 'var(--color-warning)', label: t('nurse.marDueNow') };
      case 'upcoming': return { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)', label: t('nurse.marUpcoming') };
      case 'given': return { bg: 'rgba(74,222,128,0.12)', color: 'var(--color-success)', label: t('nurse.marGiven') };
    }
  };

  const openModal = (entry: MAREntry) => {
    setModalEntry(entry);
    setModalStatus((entry.administrationStatus as AdminStatus) || 'given');
    setModalReason('');
    setModalDose(entry.dose);
    setModalRoute(entry.route);
    setModalNotes('');
    setModalWitness('');
  };

  const closeModal = () => {
    setModalEntry(null);
    setSubmitting(false);
  };

  // Undo a dose recorded by mistake. Confirms first, then voids the satisfying
  // administration entry (append-only — history is preserved) so the slot
  // returns to due/overdue.
  const handleUndo = async (entry: MAREntry) => {
    if (!window.confirm(t('action.confirm'))) return;
    await undoAdministration(entry, t('action.undo'));
  };

  const handleSubmit = async () => {
    if (!modalEntry) return;
    setSubmitting(true);
    const ok = await recordEntry(modalEntry, {
      status: modalStatus as MedicationAdministration['status'],
      doseGiven: modalDose,
      route: modalRoute,
      reason: modalReason,
      notes: modalNotes,
      witnessName: modalWitness,
    });
    setSubmitting(false);
    if (ok) {
      onAdminister?.();
      closeModal();
    }
  };

  // Quick "Given" row action — same capability signal as the modal path.
  const handleMarkGiven = async (entryId: string) => {
    const ok = await markGiven(entryId);
    if (ok) onAdminister?.();
  };

  return (
    <div className="dash-card overflow-hidden flex flex-col" style={{ padding: '0', flex: 1, minHeight: 0 }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <ListSearch value={search} onChange={setSearch} placeholder={t('nurse.searchPatientPlaceholder')} />
        <div className="flex items-center gap-1 flex-shrink-0">
          {STATUS_FILTERS.map(f => {
            const on = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-colors"
                style={{
                  background: on ? 'var(--accent-light)' : 'transparent',
                  color: on ? 'var(--accent-primary)' : 'var(--text-muted)',
                  border: `1px solid ${on ? 'var(--accent-border, rgba(33,145,208,0.25))' : 'var(--border-light)'}`,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1" style={{ overflow: 'auto', minHeight: 0 }}>
        <div className="ehr-queue-scroll">
          <div className="ehr-queue-cards">
            {filteredEntries.map(entry => {
              const sc = marStatusColor(entry.status);
              const tone = DUE_TONE[entry.status];
              const admission = admissionByPatient.get(entry.patientId);
              const source = admission ? `${admission.wardName}${admission.bedNumber ? ` · ${admission.bedNumber}` : ''}` : '—';
              const context = [entry.medication, entry.dose, entry.route].filter(Boolean).join(' · ') || '—';
              // Time column: what already happened (last given) takes priority
              // over the schedule slot — matches "next-due/last-given" spec.
              const timeText = entry.status === 'given' && entry.givenAt
                ? new Date(entry.givenAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : (entry.time || '—');
              return (
                <div key={entry.id} className="ehr-queue-card">
                  <div className="ehr-queue-patient">
                    {/* A not-yet-due dose must not read like an administered one —
                        neutral (upcoming) keeps the grey tint instead of green. */}
                    <span className="ehr-patient-icon" data-acuity={tone === 'neutral' ? 'neutral' : tone.toUpperCase()}>{initials(entry.patientName)}</span>
                    <div className="ehr-queue-patient-text">
                      <button type="button" className="ehr-queue-name" onClick={() => router.push(`/patients/${entry.patientId}`)}>
                        {entry.patientName}
                      </button>
                    </div>
                  </div>

                  <div className="ehr-queue-cell ehr-queue-muted-cell">{source}</div>

                  <div className="ehr-queue-cell">
                    <span className="ehr-queue-pill" data-tone={tone}>{sc.label}</span>
                  </div>

                  <div className="ehr-queue-cell">—</div>

                  <div className="ehr-queue-cell ehr-queue-muted-cell">{context}</div>

                  <div className="ehr-queue-cell ehr-queue-num-col">
                    <strong>{timeText}</strong>
                  </div>

                  <div className="ehr-queue-actions">
                    <RowActionsMenu
                      ariaLabel={t('nurse.colAction')}
                      actions={
                        entry.status !== 'given'
                          ? [
                              { key: 'given', label: t('nurse.marQuickGiven'), tone: 'success' as const, icon: <Check className="w-4 h-4" />, onClick: () => handleMarkGiven(entry.id) },
                              { key: 'outcome', label: t('nurse.marDetailsAction'), icon: <FileText className="w-4 h-4" />, onClick: () => openModal(entry) },
                            ]
                          : [
                              { key: 'outcome', label: t('nurse.marDetailsAction'), icon: <FileText className="w-4 h-4" />, onClick: () => openModal(entry) },
                              ...(entry.administrationId ? [{ key: 'undo', label: t('action.undo'), icon: <RotateCcw className="w-4 h-4" />, onClick: () => handleUndo(entry) }] : []),
                            ]
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {marEntries.length === 0 && (
        <div className="text-center py-12">
          <Pill className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('nurse.noMedications')}</p>
        </div>
      )}

      {/* Record-administration modal */}
      {modalEntry && (
        <Modal onClose={closeModal} width={448}>
          <div
            className="modal-content card-elevated overflow-hidden"
            style={{ width: '100%' }}
          >
            <header
              className="px-5 py-3 border-b flex items-start justify-between gap-3"
              style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="icon-box">
                  <Pill className="w-4 h-4" style={{ color: '#015697' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] font-bold uppercase" style={{
                    color: 'var(--text-muted)', letterSpacing: '0.06em',
                  }}>{t('nurse.marAdminister')}</div>
                  <h3 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {modalEntry.medication}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {modalEntry.patientName} · {modalEntry.dose} · {modalEntry.route} · {t('nurse.marScheduled')}{' '}
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{modalEntry.time}</span>
                  </p>
                </div>
              </div>
              <button onClick={closeModal} aria-label={t('nurse.marClose')} className="p-1 rounded hover:bg-gray-100 shrink-0">
                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </header>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                }}>{t('nurse.marStatusLabel')}</label>
                <div className="grid grid-cols-4 gap-1.5 keep-cols">
                  {(['given', 'held', 'refused', 'missed'] as const).map(s => {
                    const on = modalStatus === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setModalStatus(s)}
                        className="px-2 py-2 text-[11px] font-bold uppercase rounded transition-all"
                        style={{
                          background: on ? 'rgba(33,145,208,0.12)' : 'transparent',
                          color: on ? '#015697' : 'var(--text-secondary)',
                          border: `1px solid ${on ? 'rgba(33,145,208,0.30)' : 'var(--border-light)'}`,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {modalStatus !== 'given' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                    color: 'var(--text-muted)', letterSpacing: '0.06em',
                  }}>{t('nurse.marReason')}</label>
                  <input
                    type="text"
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                    className="w-full"
                    placeholder={t('nurse.marReasonRequired')}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                    color: 'var(--text-muted)', letterSpacing: '0.06em',
                  }}>{t('nurse.marActualDose')}</label>
                  <input
                    type="text"
                    value={modalDose}
                    onChange={(e) => setModalDose(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                    color: 'var(--text-muted)', letterSpacing: '0.06em',
                  }}>{t('nurse.marRoute')}</label>
                  <input
                    type="text"
                    value={modalRoute}
                    onChange={(e) => setModalRoute(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                }}>
                  {t('nurse.marWitness')} <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                    {t('nurse.marWitnessHint')}
                  </span>
                </label>
                <input
                  type="text"
                  value={modalWitness}
                  onChange={(e) => setModalWitness(e.target.value)}
                  className="w-full"
                  placeholder={t('nurse.marWitnessName')}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase mb-1.5" style={{
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                }}>{t('nurse.marNotes')}</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  className="w-full"
                  placeholder={t('nurse.marNotesPlaceholder')}
                />
              </div>
            </div>

            <footer
              className="px-5 py-3 border-t flex items-center justify-between gap-2"
              style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
            >
              <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                {t('nurse.marRecordedAs')} <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.name}</strong>
              </p>
              <div className="flex items-center gap-2">
                <button onClick={closeModal} className="btn btn-secondary">{t('nurse.marCancel')}</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || (modalStatus !== 'given' && !modalReason.trim())}
                  className="btn btn-primary inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? t('nurse.marSaving') : t('nurse.marRecord')}
                </button>
              </div>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}
