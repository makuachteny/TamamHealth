'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useApp } from '@/lib/context';
import { useWards } from '@/lib/hooks/useWards';
import Modal from '@/components/Modal';
import { Pill, X, CheckCircle2, RotateCcw, Filter } from '@/components/icons/lucide';
import type { MedicationAdministration } from '@/lib/db-types';
import { useMarEntries, type MAREntry } from './shared';
import ListSearch from './ListSearch';
import { initials, stateColor } from '@/lib/patient-utils';
import { formatTimeUntil } from '@/lib/format-utils';

type AdminStatus = 'given' | 'held' | 'refused' | 'missed';

export default function MarWorkflow({ onAdminister }: { onAdminister?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { marEntries, recordEntry, undoAdministration } = useMarEntries();
  const { activeAdmissions } = useWards();
  // "Now" for the Time column's relative subline — captured once on mount
  // (live-ish, matching the Recent Triages list), not re-read during render.
  const [now] = useState(() => new Date());

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
  // The Filters panel opens as a dropdown anchored to its trigger — same
  // pattern as the patients list. Close on outside click or Escape.
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showFilters) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFilters(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [showFilters]);
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

  return (
    // No card chrome of its own — like the ward board, the MAR sits directly
    // on the centre panel's white body; the rows are the only cards.
    <div className="overflow-hidden flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {/* No extra side padding — the centre panel already insets its body, so
          the title/search share the queue cards' left edge. */}
      <div className="pt-2 pb-3 flex-shrink-0">
        {/* Title + status stats (inline, right-aligned — mirrors the patients
            list header: colored legend dots with live counts). */}
        <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
          <span style={{ fontFamily: 'var(--font-platform)', fontWeight: 800, fontSize: 16, lineHeight: 1.2, letterSpacing: 0, color: 'var(--ehr-text)' }}>
            {t('nurse.marTitle')}
          </span>
          <div className="flex items-center gap-3 flex-wrap justify-end pb-0.5">
            {[
              { label: t('patients.all'), value: marEntries.length, color: 'var(--text-muted)' },
              { label: t('nurse.marOverdue'), value: marEntries.filter(e => e.status === 'overdue').length, color: 'var(--color-danger)' },
              { label: t('nurse.marDueNow'), value: marEntries.filter(e => e.status === 'due').length, color: '#D97706' },
              { label: t('nurse.marUpcoming'), value: marEntries.filter(e => e.status === 'upcoming').length, color: '#2191D0' },
              { label: t('nurse.marGiven'), value: marEntries.filter(e => e.status === 'given').length, color: '#15795C' },
            ].map(s => (
              <span key={s.label} className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.label} ({s.value.toLocaleString()})
              </span>
            ))}
          </div>
        </div>
        {/* Search + filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ListSearch value={search} onChange={setSearch} placeholder={t('nurse.searchPatientPlaceholder')} />
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilters(s => !s)}
              aria-expanded={showFilters}
              aria-label={t('patients.filtersTitle')}
              title={t('patients.filtersTitle')}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, padding: 0, borderRadius: 999,
                border: `1px solid ${statusFilter !== 'all' ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                background: statusFilter !== 'all' ? 'rgba(33,145,208,0.08)' : 'var(--bg-card-solid)',
                color: statusFilter !== 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Filter className="w-4 h-4" />
              {statusFilter !== 'all' && (
                <span className="absolute inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold" style={{ top: -4, right: -4, background: '#2191D0', color: '#fff' }}>
                  1
                </span>
              )}
            </button>
            {showFilters && (
              <div
                className="absolute right-0 mt-2 rounded-2xl overflow-hidden z-50"
                style={{ width: 220, background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: 'var(--card-shadow-lg, 0 16px 48px rgba(0,0,0,0.2))' }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('patients.filtersTitle')}</span>
                  <div className="flex items-center gap-2">
                    {statusFilter !== 'all' && (
                      <button onClick={() => setStatusFilter('all')} className="text-[11px] font-semibold" style={{ color: 'var(--accent-primary)' }}>{t('nurse.clearAllFilters')}</button>
                    )}
                    <button type="button" onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-[var(--overlay-subtle)]" aria-label={t('action.close')}>
                      <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                </div>
                <div className="py-1">
                  {STATUS_FILTERS.map(f => {
                    const on = statusFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => { setStatusFilter(f.key); setShowFilters(false); }}
                        className="w-full flex items-center justify-between px-4 py-2 text-[13px] text-left hover:bg-[var(--overlay-subtle)]"
                        style={{ color: on ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: on ? 600 : 400 }}
                      >
                        {f.label}
                        {on && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1" style={{ overflow: 'auto', minHeight: 0 }}>
        {filteredEntries.length === 0 ? (
          // No bare column-header row over an empty list — the guide only
          // renders when there are rows to label.
          <div className="ehr-empty-state">
            <Pill className="w-8 h-8" />
            <strong>{t('nurse.noMedications')}</strong>
            <span>{search.trim() || statusFilter !== 'all'
              ? 'Nothing matches the current search or filter.'
              : 'Scheduled doses will appear here as prescriptions are charted.'}</span>
          </div>
        ) : (
        <div className="appointment-card-surface">
          {/* The appointments-page table, exactly: PATIENT / TIME / LOCATION /
              MEDICATION / STATUS with the dose as the status cue. */}
          <div className="appointment-card-flow">
            <div className="appointment-card-head" aria-hidden="true">
              {['Patient', 'Time', 'Location', 'Medication', 'Status'].map(head => (
                <span key={head}>{head}</span>
              ))}
            </div>
            {filteredEntries.map(entry => {
              const sc = marStatusColor(entry.status);
              const tone = DUE_TONE[entry.status];
              const admission = admissionByPatient.get(entry.patientId);
              const source = admission ? `${admission.wardName}${admission.bedNumber ? ` · ${admission.bedNumber}` : ''}` : '—';
              // Time column: what already happened (last given) takes priority
              // over the schedule slot — matches "next-due/last-given" spec.
              const timeText = entry.status === 'given' && entry.givenAt
                ? new Date(entry.givenAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : (entry.time || '—');
              const timeSub = entry.status === 'given' && entry.givenAt
                ? formatTimeUntil(entry.givenAt, now)
                : formatTimeUntil(entry.scheduledFor, now);
              const overdue = entry.status === 'overdue';
              const statusPillClass = entry.status === 'overdue' ? 'status-no-show'
                : entry.status === 'due' ? 'status-attention'
                : entry.status === 'given' ? 'status-completed'
                : '';
              // A not-yet-due dose must not read like an administered one —
              // neutral (upcoming) keeps the grey avatar instead of green.
              const avatarBg = tone === 'neutral' ? 'var(--ehr-muted)' : stateColor(tone.toUpperCase());
              return (
                <div
                  key={entry.id}
                  className="ehr-appointment-row appointment-card-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => openModal(entry)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openModal(entry);
                    }
                  }}
                >
                  <div className="ehr-appointment-identity">
                    <div className="ehr-patient-icon" style={{ background: avatarBg, color: '#fff' }}>{initials(entry.patientName)}</div>
                    <div className="ehr-appointment-main appointment-card-patient">
                      <button type="button" onClick={(event) => { event.stopPropagation(); router.push(`/patients/${entry.patientId}`); }}>
                        {entry.patientName}
                      </button>
                      <p>{entry.frequency || 'Scheduled dose'}</p>
                    </div>
                  </div>

                  <div className="ehr-appointment-time">
                    <strong style={overdue ? { color: '#C24135' } : undefined}>{timeText}</strong>
                    {timeSub && <span className={overdue ? 'is-soon' : ''}>{timeSub}</span>}
                  </div>

                  <div className="appointment-card-provider">
                    <strong>{source}</strong>
                    <span>{admission ? 'Ward · bed' : 'Location'}</span>
                  </div>

                  <div className="appointment-card-provider">
                    <strong>{entry.medication}</strong>
                    <span>{[entry.dose, entry.route].filter(Boolean).join(' · ') || 'Medication'}</span>
                  </div>

                  <div className="appointment-card-status">
                    <span className={`appointment-status-pill ${statusPillClass}`.trim()}>{sc.label}</span>
                    <small>{entry.status === 'given' ? 'Recorded' : 'Tap to record'}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>

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
                {modalEntry.status === 'given' && modalEntry.administrationId && (
                  <button onClick={() => handleUndo(modalEntry)} className="btn btn-secondary inline-flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" />
                    {t('action.undo')}
                  </button>
                )}
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
