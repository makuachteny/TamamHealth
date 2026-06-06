'use client';

/**
 * PatientStoryboard — Epic-style left rail anchored on every screen that
 * has an active patient context. Shows the safety-critical facts a
 * clinician must see *before* making any decision: allergies, precautions,
 * active problems, current medications, attending, recent critical labs.
 *
 * Designed to read from existing hooks only — no new APIs. The Storyboard
 * is best-effort: missing data renders a quiet placeholder rather than an
 * error, so it stays useful even on freshly-registered patients.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import {
  AlertTriangle, Heart, ShieldAlert, Pill, FlaskConical,
  Stethoscope, Activity, ChevronRight, BedDouble,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useProblems } from '@/lib/hooks/useProblems';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { usePrescriptions } from '@/lib/hooks/usePrescriptions';
import { useTriage } from '@/lib/hooks/useTriage';
import { useWards } from '@/lib/hooks/useWards';
import { formatDateTime } from '@/lib/format-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface PatientStoryboardProps {
  patientId: string;
  /** Hide the panel chrome (used inside printable views) */
  embedded?: boolean;
}

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function isPregnancyProblem(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('pregnan') || n.includes('antenatal') || n.includes('gravid');
}

interface SectionProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  title: string;
  children: React.ReactNode;
  /** When true, treat the whole card as a safety alert (red wash) */
  alarm?: boolean;
}

function Section({ icon: Icon, iconBg, iconColor, title, children, alarm }: SectionProps) {
  return (
    <section
      className="card-elevated"
      style={{
        background: alarm ? 'rgba(196,69,54,0.05)' : 'var(--bg-card-solid)',
        borderColor: alarm ? 'rgba(196,69,54,0.25)' : 'var(--border-light)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          borderColor: alarm ? 'rgba(196,69,54,0.18)' : 'var(--border-light)',
          background: alarm ? 'transparent' : 'var(--overlay-subtle)',
        }}
      >
        <div className="icon-box-sm" style={{ background: iconBg }}>
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </div>
        <h3
          className="font-bold uppercase"
          style={{ fontSize: 10.5, letterSpacing: '0.06em', color: alarm ? 'var(--tamamhealth-red)' : 'var(--text-secondary)' }}
        >
          {title}
        </h3>
      </div>
      <div className="px-3 py-2.5" style={{ fontSize: 12 }}>
        {children}
      </div>
    </section>
  );
}

export default function PatientStoryboard({ patientId, embedded }: PatientStoryboardProps) {
  const { t } = useTranslation();
  const { patients } = usePatients();
  const { active: activeProblems } = useProblems(patientId);
  const { results: allLabs } = useLabResults();
  const { prescriptions: allRx } = usePrescriptions();
  const { triages } = useTriage(patientId);
  const { activeAdmissions } = useWards();

  const patient = useMemo(() => patients.find(p => p._id === patientId), [patients, patientId]);

  const allergies = useMemo(
    () => (patient?.allergies || []).filter(a => a && a.toLowerCase() !== 'none known' && a.toLowerCase() !== 'none'),
    [patient],
  );
  const chronicFromPatient = useMemo(
    () => (patient?.chronicConditions || []).filter(c => c && c.toLowerCase() !== 'none'),
    [patient],
  );

  const currentMeds = useMemo(
    () => allRx.filter(rx => rx.patientId === patientId && rx.status === 'pending'),
    [allRx, patientId],
  );

  const criticalLabs = useMemo(
    () => allLabs
      .filter(l => l.patientId === patientId && l.critical && l.status === 'completed')
      .slice(0, 3),
    [allLabs, patientId],
  );

  const latestTriage = triages?.[0];
  const admission = useMemo(
    () => activeAdmissions.find(a => a.patientId === patientId),
    [activeAdmissions, patientId],
  );

  const isPregnant = useMemo(
    () => activeProblems.some(p => isPregnancyProblem(p.name)),
    [activeProblems],
  );

  if (!patient) {
    return (
      <aside
        aria-label={t('storyboard.patientContext')}
        className="hidden xl:flex flex-col w-72 shrink-0 px-3 py-4 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        {t('storyboard.loadingPatientContext')}
      </aside>
    );
  }

  const age = calcAge(patient.dateOfBirth);
  const fullName = `${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.surname}`.trim();
  const triageColor = latestTriage?.priority === 'RED' ? '#C44536' : latestTriage?.priority === 'YELLOW' ? '#B8741C' : '#15795C';

  return (
    <aside
      aria-label={t('storyboard.patientContextFor', { name: fullName })}
      className={
        embedded
          ? 'flex flex-col gap-3'
          : 'hidden xl:flex flex-col w-[296px] shrink-0 gap-3 px-4 py-4 overflow-y-auto'
      }
      style={!embedded ? {
        background: 'var(--bg-card-solid)',
        borderLeft: '1px solid var(--border-light)',
      } : undefined}
    >
      {/* Patient header — photo + name + meta */}
      <div className="card-elevated p-3 flex items-start gap-3">
        {patient.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={patient.photoUrl}
            alt=""
            className="w-12 h-12 rounded-full object-cover shrink-0"
            style={{ border: '2px solid var(--accent-primary)' }}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
            style={{ background: 'var(--accent-primary)', color: 'white' }}
          >
            {patient.firstName.charAt(0)}{patient.surname.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/patients/${patient._id}`}
            className="block text-sm font-bold leading-tight truncate hover:underline"
            style={{ color: 'var(--text-primary)' }}
          >
            {fullName}
          </Link>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {patient.gender}{age != null ? ` · ${age}y` : ''}
          </div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {patient.hospitalNumber}
          </div>
        </div>
      </div>

      {/* Allergies — alarm card if any present */}
      <Section
        icon={ShieldAlert}
        iconBg={allergies.length ? 'rgba(196,69,54,0.16)' : 'rgba(0,0,0,0.04)'}
        iconColor={allergies.length ? 'var(--tamamhealth-red)' : 'var(--text-muted)'}
        title={t('patient.allergies')}
        alarm={allergies.length > 0}
      >
        {allergies.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>{t('patient.noneKnown')}</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {allergies.map(a => (
              <span
                key={a}
                className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md"
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
      </Section>

      {/* Precautions: triage priority + isolation */}
      {(latestTriage?.priority || admission?.isolationRequired) && (
        <Section
          icon={AlertTriangle}
          iconBg="rgba(228,168,75,0.18)"
          iconColor="var(--color-warning)"
          title={t('storyboard.precautions')}
        >
          <div className="data-row-divider-sm">
            {latestTriage?.priority && (
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>{t('storyboard.triage')}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style={{ background: `${triageColor}1F`, color: triageColor }}
                >
                  {latestTriage.priority}
                </span>
              </div>
            )}
            {admission?.isolationRequired && (
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: 'var(--text-muted)' }}>{t('storyboard.isolation')}</span>
                <span className="font-medium text-right truncate" style={{ color: 'var(--text-primary)' }}>
                  {admission.isolationReason || t('mar.required')}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Pregnancy badge */}
      {isPregnant && (
        <Section
          icon={Heart}
          iconBg="rgba(236,72,153,0.14)"
          iconColor="#EC4899"
          title={t('storyboard.pregnant')}
        >
          <Link
            href={`/anc?patientId=${patient._id}`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
            style={{ color: '#EC4899' }}
          >
            {t('storyboard.viewAncVisits')} <ChevronRight className="w-3 h-3" />
          </Link>
        </Section>
      )}

      {/* Active inpatient admission */}
      {admission && (
        <Section
          icon={BedDouble}
          iconBg="var(--accent-light)"
          iconColor="var(--accent-primary)"
          title={t('dashboard.admitted')}
        >
          <div className="data-row-divider-sm">
            <div className="flex justify-between gap-2">
              <span style={{ color: 'var(--text-muted)' }}>{t('storyboard.ward')}</span>
              <span className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>
                {admission.wardName}{admission.bedNumber ? ` · ${admission.bedNumber}` : ''}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span style={{ color: 'var(--text-muted)' }}>{t('storyboard.attending')}</span>
              <span className="font-medium text-right truncate" style={{ color: 'var(--text-primary)' }}>
                {admission.attendingPhysicianName}
              </span>
            </div>
          </div>
          <Link
            href={`/wards/mar/${admission._id}`}
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold hover:underline"
            style={{ color: 'var(--accent-primary)' }}
          >
            {t('storyboard.openMar')} <ChevronRight className="w-3 h-3" />
          </Link>
        </Section>
      )}

      {/* Active problems */}
      <Section
        icon={Activity}
        iconBg="rgba(124,58,237,0.12)"
        iconColor="#7C3AED"
        title={t('storyboard.problemsCount', { count: activeProblems.length || chronicFromPatient.length })}
      >
        {activeProblems.length === 0 && chronicFromPatient.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>{t('storyboard.noneRecorded')}</div>
        ) : (
          <ul className="space-y-1.5">
            {activeProblems.slice(0, 5).map(p => (
              <li key={p._id} className="flex items-start gap-2">
                <span
                  className="mt-1 shrink-0"
                  style={{
                    width: 6, height: 6, borderRadius: 3,
                    background: p.status === 'chronic' ? '#7C3AED' : 'var(--tamamhealth-red)',
                  }}
                />
                <span className="leading-snug flex-1 min-w-0">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  {p.icd11Code && (
                    <span className="ml-1 text-[10px]" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {p.icd11Code}
                    </span>
                  )}
                </span>
              </li>
            ))}
            {activeProblems.length === 0 && chronicFromPatient.map(c => (
              <li key={c} className="flex items-start gap-2">
                <span className="mt-1 shrink-0" style={{ width: 6, height: 6, borderRadius: 3, background: '#7C3AED' }} />
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Current medications */}
      <Section
        icon={Pill}
        iconBg="rgba(20,184,166,0.14)"
        iconColor="#14B8A6"
        title={t('storyboard.currentMedsCount', { count: currentMeds.length })}
      >
        {currentMeds.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>{t('storyboard.noneActive')}</div>
        ) : (
          <ul className="data-row-divider-sm">
            {currentMeds.slice(0, 5).map(rx => (
              <li key={rx._id} className="leading-snug">
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{rx.medication}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {rx.dose} · {rx.frequency}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Recent critical labs */}
      {criticalLabs.length > 0 && (
        <Section
          icon={FlaskConical}
          iconBg="rgba(196,69,54,0.16)"
          iconColor="var(--tamamhealth-red)"
          title={t('storyboard.criticalLabs')}
          alarm
        >
          <ul className="data-row-divider-sm">
            {criticalLabs.map(l => (
              <li key={l._id} className="leading-snug">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{l.testName}</span>
                  <span className="font-bold" style={{ color: 'var(--tamamhealth-red-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {l.result} {l.unit}
                  </span>
                </div>
                <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  {formatDateTime(l.completedAt)}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Last visit footer */}
      <Section
        icon={Stethoscope}
        iconBg="var(--accent-light)"
        iconColor="var(--accent-primary)"
        title={t('frontDesk.lastVisit')}
      >
        <div className="leading-snug">
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {patient.lastVisitDate || t('storyboard.noPriorVisits')}
          </div>
          {patient.lastConsultedBy && (
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {t('storyboard.consultedBy', { name: patient.lastConsultedBy })}
            </div>
          )}
        </div>
      </Section>
    </aside>
  );
}
