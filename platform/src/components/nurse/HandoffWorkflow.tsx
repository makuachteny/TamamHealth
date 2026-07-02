'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { patientFullName } from '@/lib/patient-utils';
import { formatLongDate } from '@/lib/format-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  FileText, BedDouble, AlertCircle, X, Printer, Pill, Check, ClipboardCheck, RotateCcw,
} from '@/components/icons/lucide';
import type { HandoffPatientEntry, ShiftHandoffDoc } from '@/lib/db-types';
import { ACCENT, useMarEntries, useWardRoster } from './shared';
import { useHandoffs } from '@/lib/hooks/useHandoffs';
import ListSearch from './ListSearch';

// Per-patient SBAR + tasks captured in the editor (string form for the textarea).
interface SbarDraft {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  tasks: string; // newline-separated; split on save
}

const EMPTY_SBAR: SbarDraft = { situation: '', background: '', assessment: '', recommendation: '', tasks: '' };

// Derive the shift bucket from the current hour.
function deriveShift(hour: number): ShiftHandoffDoc['shift'] {
  if (hour >= 7 && hour < 15) return 'day';
  if (hour >= 15 && hour < 23) return 'evening';
  return 'night';
}

export default function HandoffWorkflow({
  variant = 'page',
  onClose,
}: { variant?: 'page' | 'modal'; onClose?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const { wardPatients, patientTriageMap } = useWardRoster();
  const { marEntries } = useMarEntries();
  const { latest, create, acknowledge, unacknowledge } = useHandoffs();

  const [handoffNotes, setHandoffNotes] = useState('');
  const [incomingNurse, setIncomingNurse] = useState('');
  const [sbar, setSbar] = useState<Record<string, SbarDraft>>({});
  const [signing, setSigning] = useState(false);
  const [acking, setAcking] = useState(false);
  const [signedDoc, setSignedDoc] = useState<ShiftHandoffDoc | null>(null);
  // Inline search for the critical patient handover list.
  const [search, setSearch] = useState('');

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const shift = deriveShift(now.getHours());
  const todayDate = formatLongDate(now);
  const nowTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Critical = RED triage priority (real triage when present, demo inline otherwise).
  const criticalPatients = useMemo(
    () => wardPatients.filter(p => (patientTriageMap.get(p._id)?.priority ?? p._triage?.priority) === 'RED'),
    [wardPatients, patientTriageMap],
  );
  // The displayed handover list, narrowed by the inline search (name match).
  const sq = search.trim().toLowerCase();
  const filteredCritical = sq
    ? criticalPatients.filter(p => patientFullName(p).toLowerCase().includes(sq))
    : criticalPatients;

  // REAL metric counts only — no synthesized figures.
  const totalPatients = wardPatients.length;
  const criticalCount = criticalPatients.length;
  const overdueMarCount = marEntries.filter(e => e.status === 'overdue').length;
  const dueMarCount = marEntries.filter(e => e.status === 'due').length;

  if (!currentUser) return null;

  const shiftLabel = (s: ShiftHandoffDoc['shift']) =>
    s === 'day' ? t('nurse.shiftDay') : s === 'evening' ? t('nurse.shiftEvening') : t('nurse.shiftNight');

  const updateSbar = (id: string, field: keyof SbarDraft, value: string) =>
    setSbar(prev => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_SBAR), [field]: value } }));

  // Reverse an accidental SBAR/tasks entry for one patient — wipes the draft
  // back to empty (the handoff hasn't been signed yet, so this is purely local).
  const clearSbar = (id: string) =>
    setSbar(prev => ({ ...prev, [id]: { ...EMPTY_SBAR } }));

  const sbarHasContent = (d?: SbarDraft) =>
    !!d && (!!d.situation.trim() || !!d.background.trim() || !!d.assessment.trim() || !!d.recommendation.trim() || !!d.tasks.trim());

  // Sign off the shift: build a typed ShiftHandoffDoc and persist via the hook.
  const handleSignOff = async () => {
    if (signing || signedDoc) return;

    // Guard against a duplicate sign-off for the same nurse + shiftDate that
    // hasn't been acknowledged yet (prevents orphaned duplicates).
    if (
      latest &&
      latest.outgoingNurseId === currentUser._id &&
      latest.shiftDate === todayKey &&
      latest.status !== 'acknowledged'
    ) {
      showToast(t('nurse.handoffDuplicateToast'), 'error');
      return;
    }

    setSigning(true);
    try {
      // Structured per-patient SBAR + tasks for every critical patient that has
      // any detail entered. Patients with no detail are still listed (situational
      // awareness) but carry empty SBAR fields.
      const patients: HandoffPatientEntry[] = criticalPatients.map(p => {
        const d = sbar[p._id];
        const tasks = (d?.tasks ?? '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean);
        return {
          patientId: p._id,
          patientName: patientFullName(p),
          hospitalNumber: p.hospitalNumber || undefined,
          priority: 'RED',
          situation: d?.situation?.trim() || undefined,
          background: d?.background?.trim() || undefined,
          assessment: d?.assessment?.trim() || undefined,
          recommendation: d?.recommendation?.trim() || undefined,
          tasks: tasks.length ? tasks : undefined,
        };
      });

      // Real metrics only — omit values we don't truly have.
      const metrics: ShiftHandoffDoc['metrics'] = {
        totalPatients,
        critical: criticalCount,
        overdueMar: overdueMarCount,
        dueMar: dueMarCount,
      };

      const doc = await create({
        facilityId: currentUser.hospitalId,
        facilityName: currentUser.hospitalName,
        orgId: currentUser.orgId,
        shiftDate: todayKey,
        shift,
        outgoingNurseId: currentUser._id,
        outgoingNurseName: currentUser.name,
        incomingNurseName: incomingNurse.trim() || undefined,
        notes: handoffNotes.trim() || undefined,
        patients,
        metrics,
      });

      setSignedDoc(doc);
      showToast(t('nurse.handoffSignedToast'), 'success');
      if (variant === 'modal') setTimeout(() => onClose?.(), 1600);
    } catch (err) {
      console.error('Failed to sign handoff:', err);
      showToast(t('nurse.handoffSignFailedToast'), 'error');
    } finally {
      setSigning(false);
    }
  };

  // Oncoming nurse acknowledges the latest signed handoff.
  const handleAcknowledge = async () => {
    if (!latest || acking) return;
    setAcking(true);
    try {
      await acknowledge(latest._id, currentUser._id, currentUser.name);
      showToast(t('nurse.handoffAcknowledgedToast'), 'success');
    } catch (err) {
      console.error('Failed to acknowledge handoff:', err);
      showToast(t('nurse.handoffAcknowledgeFailedToast'), 'error');
    } finally {
      setAcking(false);
    }
  };

  // Reverse an accidental acknowledgement — confirms, then returns the
  // handoff to 'signed' so the oncoming nurse can re-acknowledge.
  const handleUnacknowledge = async () => {
    if (!latest || acking) return;
    if (!window.confirm(t('action.confirm'))) return;
    setAcking(true);
    try {
      await unacknowledge(latest._id, currentUser._id, currentUser.name);
    } catch (err) {
      console.error('Failed to reverse handoff acknowledgement:', err);
      showToast(t('nurse.handoffAcknowledgeFailedToast'), 'error');
    } finally {
      setAcking(false);
    }
  };

  const signedTime = signedDoc
    ? new Date(signedDoc.signedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Real KPI strip — only counts we actually have.
  const stats = [
    { icon: BedDouble, label: t('nurse.totalPatients'), value: totalPatients, color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
    { icon: AlertCircle, label: t('nurse.criticalPatients'), value: criticalCount, color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.12)' },
    { icon: Pill, label: t('nurse.medicationsOverdue'), value: overdueMarCount, color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.12)' },
    { icon: Pill, label: t('nurse.medicationsDueNow'), value: dueMarCount, color: 'var(--color-warning)', bg: 'rgba(228,168,75,0.12)' },
  ];

  // Previous-handoff read panel for the oncoming nurse.
  const previousPanel = (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
            <ClipboardCheck className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.previousHandoff')}</span>
        </div>
        {latest && latest.status === 'acknowledged' && (
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(27,158,119,0.12)', color: 'var(--color-success)' }}>
            <Check className="w-3 h-3 inline" />
          </span>
        )}
      </div>
      <div className="p-2.5 space-y-2">
        {!latest ? (
          <p className="text-[11px] py-3 text-center" style={{ color: 'var(--text-muted)' }}>{t('nurse.noPreviousHandoff')}</p>
        ) : (
          <>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {t('nurse.handoffFromNurse', { name: latest.outgoingNurseName, shift: shiftLabel(latest.shift), date: latest.shiftDate })}
            </p>
            {latest.notes && (
              <p className="text-[11px] whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{latest.notes}</p>
            )}
            {latest.patients.length > 0 && (
              <div className="space-y-1.5">
                {latest.patients.map(pt => (
                  <div key={pt.patientId} className="p-2 rounded-xl" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{pt.patientName}</span>
                    {(pt.situation || pt.background || pt.assessment || pt.recommendation || pt.tasks?.length) ? (
                      <ul className="mt-1 space-y-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {pt.situation && <li><b>{t('nurse.sbarSituation')}:</b> {pt.situation}</li>}
                        {pt.background && <li><b>{t('nurse.sbarBackground')}:</b> {pt.background}</li>}
                        {pt.assessment && <li><b>{t('nurse.sbarAssessment')}:</b> {pt.assessment}</li>}
                        {pt.recommendation && <li><b>{t('nurse.sbarRecommendation')}:</b> {pt.recommendation}</li>}
                        {pt.tasks?.length ? <li><b>{t('nurse.sbarTasks')}:</b> {pt.tasks.join('; ')}</li> : null}
                      </ul>
                    ) : (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('nurse.noHandoverDetail')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {latest.status === 'acknowledged' ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium" style={{ color: 'var(--color-success)' }}>
                  {t('nurse.handoffAcknowledgedBy', {
                    name: latest.acknowledgedByName ?? '',
                    time: latest.acknowledgedAt ? new Date(latest.acknowledgedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
                  })}
                </p>
                <button
                  onClick={handleUnacknowledge}
                  disabled={acking}
                  className="text-[10px] font-semibold inline-flex items-center gap-1 transition-opacity hover:opacity-80 flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  title={t('action.undo')}
                >
                  <RotateCcw className="w-3 h-3" /> {t('action.undo')}
                </button>
              </div>
            ) : (
              <button
                onClick={handleAcknowledge}
                disabled={acking}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                style={{ background: acking ? 'var(--text-muted)' : ACCENT }}
              >
                {t('nurse.acknowledgeHandoff')}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );

  const body = (
    <div className="p-4 space-y-3 print-handoff flex-1 min-h-0 overflow-y-auto">
      {/* KPI strip — real counts only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stats.map(s => (
          <div
            key={s.label}
            className="rounded-2xl px-4 py-2.5 flex items-center gap-3 transition-shadow hover:shadow-md"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'transparent' }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </span>
            <span className="text-[11px] font-medium leading-snug flex-1 min-w-0" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span className="text-2xl font-extrabold tabular-nums leading-none flex-shrink-0" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Previous shift handoff (read + acknowledge) */}
      {previousPanel}

      {/* Critical patients with per-patient SBAR editor */}
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
              <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.patientHandover')}</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
            {criticalCount}
          </span>
        </div>
        {criticalPatients.length > 0 && (
          <div className="px-3 py-2.5 flex items-center" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <ListSearch value={search} onChange={setSearch} placeholder={t('nurse.searchPatientPlaceholder')} />
          </div>
        )}
        <div className="p-2.5 space-y-2.5">
          {filteredCritical.length > 0 ? (
            filteredCritical.map(p => {
              const d = sbar[p._id] ?? EMPTY_SBAR;
              const inputStyle = { background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' } as const;
              // Surface the latest triage pain score / GCS read-only so the
              // oncoming nurse sees a critical patient's key neuro/pain status
              // at a glance — informational, not part of handoff persistence.
              const tri = patientTriageMap.get(p._id);
              const chipStyle = { background: 'rgba(239,68,68,0.10)', color: 'var(--color-danger)' } as const;
              return (
                <div key={p._id} className="p-2.5 rounded-xl space-y-2" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {p._demo ? (
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{patientFullName(p)}</span>
                      ) : (
                        <button
                          onClick={() => router.push(`/patients/${p._id}`)}
                          className="text-[11px] font-semibold text-left hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                          title={t('nurse.viewPatientRecord')}
                        >
                          {patientFullName(p)}
                        </button>
                      )}
                      {tri?.painScore && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={chipStyle}>
                          {t('nurse.painScore')} {tri.painScore}
                        </span>
                      )}
                      {tri?.gcs && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={chipStyle}>
                          {t('nurse.gcs')} {tri.gcs}
                        </span>
                      )}
                    </div>
                    {sbarHasContent(sbar[p._id]) && (
                      <button
                        onClick={() => clearSbar(p._id)}
                        className="text-[10px] font-semibold inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                        style={{ color: 'var(--text-muted)' }}
                        title={t('action.clear')}
                      >
                        <X className="w-3 h-3" /> {t('action.clear')}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={d.situation} onChange={e => updateSbar(p._id, 'situation', e.target.value)} placeholder={t('nurse.sbarSituation')} className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={inputStyle} />
                    <input value={d.background} onChange={e => updateSbar(p._id, 'background', e.target.value)} placeholder={t('nurse.sbarBackground')} className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={inputStyle} />
                    <input value={d.assessment} onChange={e => updateSbar(p._id, 'assessment', e.target.value)} placeholder={t('nurse.sbarAssessment')} className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={inputStyle} />
                    <input value={d.recommendation} onChange={e => updateSbar(p._id, 'recommendation', e.target.value)} placeholder={t('nurse.sbarRecommendation')} className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={inputStyle} />
                  </div>
                  <textarea rows={2} value={d.tasks} onChange={e => updateSbar(p._id, 'tasks', e.target.value)} placeholder={t('nurse.sbarTasksPlaceholder')} className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={inputStyle} />
                </div>
              );
            })
          ) : (
            <p className="text-[11px] py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('nurse.noCriticalPatients')}</p>
          )}
        </div>
      </section>

      {/* Shift-wide notes */}
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'transparent' }}>
            <FileText className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.notesOutgoingNurse')}</span>
        </div>
        <div className="p-2.5">
          <textarea
            rows={4}
            placeholder={t('nurse.handoffNotesPlaceholder')}
            value={handoffNotes}
            onChange={e => setHandoffNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
        </div>
      </section>

      {/* Sign-off */}
      <div className="rounded-2xl p-3" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
        {signedDoc ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'transparent' }}>
              <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
              {t('nurse.handoffSignedBy', { name: signedDoc.outgoingNurseName, time: signedTime })}
            </span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('nurse.incomingNurse')}
              </label>
              <input
                type="text"
                value={incomingNurse}
                onChange={e => setIncomingNurse(e.target.value)}
                placeholder={t('nurse.incomingNursePlaceholder')}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={handleSignOff}
              disabled={signing}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex-shrink-0"
              style={{ background: signing ? 'var(--text-muted)' : ACCENT }}
            >
              {signing ? t('nurse.signingOff') : t('nurse.signOffComplete')}
            </button>
          </div>
        )}
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
          {t('nurse.generatedBy', { name: currentUser.name, time: nowTime })} · {shiftLabel(shift)}
        </p>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'transparent' }}>
          <FileText className="w-4 h-4" style={{ color: ACCENT }} />
        </span>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('nurse.shiftHandoffReport')}</h2>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{todayDate} · {currentUser.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
          style={{ background: 'var(--accent-light)', color: ACCENT, border: '1px solid var(--accent-border)' }}
        >
          <Printer className="w-3 h-3" />
          {t('action.print')}
        </button>
        {variant === 'modal' && (
          <button onClick={() => onClose?.()} className="p-1.5 rounded-lg transition-all" style={{ background: 'var(--overlay-subtle)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <Modal onClose={() => onClose?.()} width={768}>
        <div
          className="modal-content card-elevated flex flex-col"
          style={{ width: '100%', maxHeight: '90vh' }}
        >
          {header}
          {body}
        </div>
      </Modal>
    );
  }

  // variant === 'page'
  return (
    <div className="dash-card overflow-hidden flex flex-col" style={{ padding: 0, flex: 1, minHeight: 0 }}>
      {header}
      {body}
    </div>
  );
}
