'use client';

/**
 * PatientSBAR — auto-generated SBAR handoff document.
 *
 * SBAR = Situation, Background, Assessment, Recommendation. Standard
 * shift-handover format used worldwide; the WHO and the Joint Commission
 * both call it out as the single most effective intervention against
 * preventable harm at handoff (the leading cause of in-hospital error).
 *
 * This component composes the document from the live chart — no manual
 * entry. A nurse going off shift prints this; the night nurse reads it.
 */

import { useMemo } from 'react';
import { Printer, FileText, ShieldAlert, Heart } from '@/components/icons/lucide';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type {
  PatientDoc, MedicalRecordDoc, LabResultDoc, PrescriptionDoc, TriageDoc, ProblemDoc,
} from '@/lib/db-types';
import { formatDateTime } from '@/lib/format-utils';
import { patientAge, patientFullName } from '@/lib/patient-utils';
import { priorityColor } from '@/lib/clinical/triage-display';
import { formatPhoneDisplay } from '@/lib/field-formats';

interface PatientSBARProps {
  patient: PatientDoc;
  records: MedicalRecordDoc[];
  labs: LabResultDoc[];
  prescriptions: PrescriptionDoc[];
  triages: TriageDoc[];
  problems: ProblemDoc[];
}


const LETTER_COLORS = {
  S: { bg: 'rgba(196,69,54,0.12)',  fg: 'var(--tamamhealth-red)' },
  B: { bg: 'rgba(228,168,75,0.18)', fg: 'var(--color-warning)' },
  A: { bg: 'rgba(33, 145, 208, 0.14)', fg: '#1E3A8A' },
  R: { bg: 'var(--accent-light)',   fg: 'var(--accent-primary)' },
} as const;

function Section({ letter, title, hint, children }: {
  letter: keyof typeof LETTER_COLORS;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  const tint = LETTER_COLORS[letter];
  return (
    <section className="card-elevated overflow-hidden">
      <header
        className="px-5 py-3 border-b flex items-center gap-3"
        style={{ borderColor: 'var(--border-light)', background: 'var(--overlay-subtle)' }}
      >
        <div
          className="shrink-0 flex items-center justify-center font-black"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: tint.bg, color: tint.fg, fontSize: 18, lineHeight: 1,
          }}
        >
          {letter}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase" style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            {title}
          </h3>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>
        </div>
      </header>
      <div className="px-5 py-4 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {children}
      </div>
    </section>
  );
}

function Tile({ label, value, severity }: { label: string; value: string; severity?: 'normal' | 'warning' | 'danger' }) {
  const sev = severity || 'normal';
  const bg = sev === 'danger' ? 'rgba(196,69,54,0.06)' : sev === 'warning' ? 'rgba(228,168,75,0.08)' : 'var(--bg-tinted)';
  const ring = sev === 'danger' ? 'rgba(196,69,54,0.20)' : sev === 'warning' ? 'rgba(228,168,75,0.22)' : 'var(--border-light)';
  const fg = sev === 'danger' ? 'var(--tamamhealth-red)' : sev === 'warning' ? 'var(--color-warning)' : 'var(--text-primary)';
  return (
    <div
      style={{
        background: bg, border: `1px solid ${ring}`, borderRadius: 10, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}
    >
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
        textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

export default function PatientSBAR({
  patient, records, labs, prescriptions, triages, problems,
}: PatientSBARProps) {
  const { t } = useTranslation();
  const age = patientAge(patient);
  const fullName = patientFullName(patient);
  const allergies = (patient.allergies || []).filter(a => a && a.toLowerCase() !== 'none known' && a.toLowerCase() !== 'none');
  const chronic = (patient.chronicConditions || []).filter(c => c && c.toLowerCase() !== 'none');

  const latestTriage = triages[0];
  const latestRecord = records[0];
  const latestVitals = latestRecord?.vitalSigns;
  const activeProblems = useMemo(
    () => problems.filter(p => p.status === 'active' || p.status === 'chronic'),
    [problems],
  );
  const activeRx = useMemo(
    () => prescriptions.filter(p => p.status === 'pending'),
    [prescriptions],
  );
  const recentCriticalLabs = useMemo(
    () => labs.filter(l => l.critical && l.status === 'completed').slice(0, 5),
    [labs],
  );
  const pendingLabs = useMemo(
    () => labs.filter(l => l.status === 'pending' || l.status === 'in_progress').slice(0, 5),
    [labs],
  );

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <div className="space-y-5">
      {/* Document header */}
      <div className="card-elevated p-5 flex items-start justify-between flex-wrap gap-3 no-print">
        <div className="flex items-start gap-3">
          <div className="icon-box-lg">
            <FileText className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('sbar.handoffTitle')} · {fullName}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('sbar.autoGeneratedFromChart')} · {formatDateTime(new Date().toISOString())}
            </p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn btn-secondary inline-flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> {t('action.print')}
        </button>
      </div>

      {/* Allergies banner — always visible at top, even when empty */}
      <div
        className="card-elevated px-4 py-3 flex items-center gap-3"
        style={{
          background: allergies.length ? 'rgba(196,69,54,0.05)' : 'var(--bg-card-solid)',
          borderColor: allergies.length ? 'rgba(196,69,54,0.25)' : 'var(--border-light)',
        }}
      >
        <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: allergies.length ? 'var(--tamamhealth-red)' : 'var(--text-muted)' }} />
        <span className="text-[10.5px] font-bold uppercase" style={{
          letterSpacing: '0.06em',
          color: allergies.length ? 'var(--tamamhealth-red)' : 'var(--text-muted)',
        }}>
          {t('patientNew.reviewAllergies')}
        </span>
        {allergies.length === 0 ? (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('patient.noneKnown')}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allergies.map(a => (
              <span
                key={a}
                className="text-xs font-semibold px-2 py-0.5 rounded-md"
                style={{
                  background: 'rgba(196,69,54,0.12)',
                  color: 'var(--tamamhealth-red-text)',
                  border: '1px solid rgba(196,69,54,0.22)',
                }}
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      <Section letter="S" title={t('sbar.situationTitle')} hint={t('sbar.situationHint')}>
        <p>
          <strong>{fullName}</strong>
          {age != null && <>, {t('sbar.yearOld', { age })} {patient.gender.toLowerCase()}</>}
          {patient.hospitalNumber && (
            <span style={{ color: 'var(--text-muted)' }}> · {patient.hospitalNumber}</span>
          )}
        </p>
        {latestTriage ? (
          <p className="mt-2">
            {t('sbar.currentlyTriaged')}{' '}
            <strong style={{ color: priorityColor(latestTriage.priority) }}>
              {latestTriage.priority === 'RED'
                ? t('nurse.priorityRedLabel')
                : latestTriage.priority === 'YELLOW'
                ? t('nurse.priorityYellowLabel')
                : t('nurse.priorityGreenLabel')}
            </strong>{' '}
            ({formatDateTime(latestTriage.triagedAt)}). {t('sbar.statusLabel')} {latestTriage.status}.
            {latestTriage.chiefComplaint && (
              <> {t('sbar.chiefComplaintLabel')} <em>{latestTriage.chiefComplaint}</em>.</>
            )}
          </p>
        ) : latestRecord?.chiefComplaint ? (
          <p className="mt-2">
            {t('sbar.lastConsult')} ({formatDateTime(latestRecord.consultedAt || latestRecord.visitDate)}):{' '}
            <em>{latestRecord.chiefComplaint}</em>
          </p>
        ) : (
          <p className="mt-2" style={{ color: 'var(--text-muted)' }}>{t('sbar.noActiveSituation')}</p>
        )}
      </Section>

      <Section letter="B" title={t('sbar.backgroundTitle')} hint={t('sbar.backgroundHint')}>
        <div className="data-row-divider-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {t('patient.bloodType')}
            </span>
            <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {patient.bloodType || t('consultation.unknown')}
            </span>
          </div>
          {(activeProblems.length > 0 || chronic.length > 0) && (
            <div>
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('sbar.activeProblems')}
              </span>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {(activeProblems.length ? activeProblems.map(p => p.name) : chronic).map(name => (
                  <li
                    key={name}
                    className="text-xs px-2 py-1 rounded-md font-medium inline-flex items-center gap-1.5"
                    style={{
                      background: 'rgba(124,58,237,0.08)',
                      color: '#6D28D9',
                      border: '1px solid rgba(124,58,237,0.20)',
                    }}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activeRx.length > 0 && (
            <div>
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('patient.medications')} · {activeRx.length}
              </span>
              <ul className="mt-1.5 space-y-1">
                {activeRx.map(rx => (
                  <li key={rx._id} className="text-sm px-3 py-1.5 rounded-md" style={{ background: 'var(--overlay-subtle)' }}>
                    <span className="font-semibold">{rx.medication}</span>
                    <span style={{ color: 'var(--text-muted)' }}> · {rx.dose} · {rx.frequency} · {rx.route}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {patient.nokName && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('patient.nextOfKin')}
              </span>
              <span className="font-medium text-right">
                {patient.nokName} <span style={{ color: 'var(--text-muted)' }}>({patient.nokRelationship}) · {formatPhoneDisplay(patient.nokPhone)}</span>
              </span>
            </div>
          )}
        </div>
      </Section>

      <Section letter="A" title={t('sbar.assessmentTitle')} hint={t('sbar.assessmentHint')}>
        {latestVitals ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
                {t('sbar.latestVitals')} · {formatDateTime(latestVitals.recordedAt)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Tile label={t('sbar.vitalTemp')} value={`${latestVitals.temperature}°C`} />
              <Tile label={t('sbar.vitalBp')} value={`${latestVitals.systolic}/${latestVitals.diastolic}`} />
              <Tile label={t('sbar.vitalPulse')} value={`${latestVitals.pulse}`} />
              <Tile label={t('sbar.vitalRr')} value={`${latestVitals.respiratoryRate}`} />
              <Tile label={t('sbar.vitalSpo2')} value={`${latestVitals.oxygenSaturation}%`} />
              <Tile label={t('sbar.vitalWt')} value={`${latestVitals.weight} kg`} />
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>{t('sbar.noVitals')}</p>
        )}

        {recentCriticalLabs.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-3.5 h-3.5" style={{ color: 'var(--tamamhealth-red)' }} />
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--tamamhealth-red)', letterSpacing: '0.06em' }}>
                {t('sbar.criticalLabResults')}
              </span>
            </div>
            <ul className="data-row-divider-sm">
              {recentCriticalLabs.map(l => (
                <li key={l._id} className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-semibold">{l.testName}</span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('sbar.refRange')} {l.referenceRange} · {formatDateTime(l.completedAt)}
                    </span>
                  </span>
                  <span className="font-bold whitespace-nowrap" style={{ color: 'var(--tamamhealth-red-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {l.result} {l.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {latestRecord?.diagnoses && latestRecord.diagnoses.length > 0 && (
          <div className="mt-5">
            <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {t('sbar.latestDiagnoses')}
            </span>
            <ul className="mt-1.5 space-y-1">
              {latestRecord.diagnoses.map((d, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {d.icd10Code} · {d.certainty} · {d.severity}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section letter="R" title={t('sbar.recommendationTitle')} hint={t('sbar.recommendationHint')}>
        <ul className="data-row-divider-sm">
          {pendingLabs.length > 0 && (
            <li>
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('sbar.pendingLabsFollowUp')}
              </span>
              <p className="mt-1">{pendingLabs.map(l => l.testName).join(', ')}</p>
            </li>
          )}
          {latestRecord?.followUp?.date && (
            <li>
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('sbar.followUpScheduled')}
              </span>
              <p className="mt-1">
                <span className="font-semibold">{latestRecord.followUp.date}</span>
                {latestRecord.followUp.reason && (
                  <span style={{ color: 'var(--text-muted)' }}> — {latestRecord.followUp.reason}</span>
                )}
              </p>
            </li>
          )}
          {activeRx.length > 0 && (
            <li>
              {t('sbar.continueMedications')} ·{' '}
              <span style={{ color: 'var(--text-muted)' }}>
                {activeRx.length === 1
                  ? t('sbar.activePrescriptionCount', { count: activeRx.length })
                  : t('sbar.activePrescriptionCountPlural', { count: activeRx.length })}
              </span>
            </li>
          )}
          {latestRecord?.treatmentPlan && (
            <li>
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {t('sbar.activePlan')}
              </span>
              <p className="mt-1">{latestRecord.treatmentPlan}</p>
            </li>
          )}
          {pendingLabs.length === 0 && !latestRecord?.followUp?.date && activeRx.length === 0 && !latestRecord?.treatmentPlan && (
            <li style={{ color: 'var(--text-muted)' }}>
              {t('sbar.noOutstandingActions')}
            </li>
          )}
        </ul>
      </Section>

      <p className="text-[11px] italic px-1" style={{ color: 'var(--text-muted)' }}>
        {t('sbar.disclaimer')}
      </p>
    </div>
  );
}
