'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useApp } from '@/lib/context';
import { Pill, Check, X, CheckCircle2, RotateCcw, FileText } from '@/components/icons/lucide';
import type { MedicationAdministration } from '@/lib/db-types';
import { useMarEntries, type MAREntry } from './shared';
import RowActionsMenu from '@/components/referrals/RowActionsMenu';
import ListSearch from './ListSearch';

type AdminStatus = 'given' | 'held' | 'refused' | 'missed';

export default function MarWorkflow() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { marEntries, markGiven, recordEntry, undoAdministration } = useMarEntries();

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
    if (ok) closeModal();
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
                  border: `1px solid ${on ? 'var(--accent-border, rgba(59,130,246,0.25))' : 'var(--border-light)'}`,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1" style={{ overflow: 'auto', minHeight: 0 }}>
        <table className="w-full" style={{ minWidth: 840 }}>
          <thead>
            <tr>
              {[t('nurse.colTime'), t('nurse.colPatient'), t('nurse.colMedication'), t('nurse.colDose'), t('nurse.colRoute'), t('nurse.colStatus'), t('nurse.colAction')].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(entry => {
              const sc = marStatusColor(entry.status);
              return (
                <tr
                  key={entry.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--table-row-hover)]"
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    background: sc.bg,
                  }}
                >
                  <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: 'var(--text-primary)' }}>{entry.time}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => router.push(`/patients/${entry.patientId}`)} className="text-left hover:underline">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{entry.patientName}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-semibold" style={{ color: sc.color }}>{entry.medication}</td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{entry.dose}</td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{entry.route}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[9px] font-bold px-2 py-1 rounded" style={{ background: `${sc.color}20`, color: sc.color }}>
                      {sc.label}
                    </span>
                    {entry.givenAt && (
                      <p className="text-[8px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(entry.givenAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      ariaLabel={t('nurse.colAction')}
                      actions={
                        entry.status !== 'given'
                          ? [
                              { key: 'given', label: t('nurse.marQuickGiven'), tone: 'success' as const, icon: <Check className="w-4 h-4" />, onClick: () => markGiven(entry.id) },
                              { key: 'outcome', label: t('nurse.marDetailsAction'), icon: <FileText className="w-4 h-4" />, onClick: () => openModal(entry) },
                            ]
                          : [
                              { key: 'outcome', label: t('nurse.marDetailsAction'), icon: <FileText className="w-4 h-4" />, onClick: () => openModal(entry) },
                              ...(entry.administrationId ? [{ key: 'undo', label: t('action.undo'), icon: <RotateCcw className="w-4 h-4" />, onClick: () => handleUndo(entry) }] : []),
                            ]
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {marEntries.length === 0 && (
        <div className="text-center py-12">
          <Pill className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('nurse.noMedications')}</p>
        </div>
      )}

      {/* Record-administration modal */}
      {modalEntry && (
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
                <div className="icon-box" style={{ background: 'rgba(59, 130, 246,0.14)' }}>
                  <Pill className="w-4 h-4" style={{ color: '#1E3A8A' }} />
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
                          background: on ? 'rgba(59,130,246,0.12)' : 'transparent',
                          color: on ? '#1E3A8A' : 'var(--text-secondary)',
                          border: `1px solid ${on ? 'rgba(59,130,246,0.30)' : 'var(--border-light)'}`,
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
        </div>
      )}
    </div>
  );
}
