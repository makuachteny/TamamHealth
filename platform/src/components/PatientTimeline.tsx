'use client';

// Clean single-stroke Tailwind Labs Heroicons via the local compatibility shim.
import {
  Stethoscope,
  FlaskConical,
  Pill,
  Syringe,
  ArrowRightLeft,
  HeartPulse,
  FileText,
  Activity,
} from '@/components/icons/lucide';
import type {
  MedicalRecordDoc, LabResultDoc, PrescriptionDoc, ImmunizationDoc,
  ReferralDoc, ANCVisitDoc, AppointmentDoc, TriageDoc,
} from '@/lib/db-types';
import { useTranslation } from '@/lib/i18n/useTranslation';

type TFunc = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Patient 360 timeline — merges every encounter type into a single
 * chronological feed so a clinician can see the patient's full journey
 * without flipping between tabs.
 *
 * Each input list is optional: pass only what you have. The component
 * normalises every record into a TimelineEvent and renders them sorted
 * newest-first.
 */
export interface PatientTimelineProps {
  medicalRecords?: MedicalRecordDoc[];
  labResults?: LabResultDoc[];
  prescriptions?: PrescriptionDoc[];
  immunizations?: ImmunizationDoc[];
  referrals?: ReferralDoc[];
  ancVisits?: ANCVisitDoc[];
  appointments?: AppointmentDoc[];
  triages?: TriageDoc[];
}

interface TimelineEvent {
  id: string;
  date: string;            // ISO or YYYY-MM-DD
  category: 'triage' | 'consultation' | 'lab' | 'prescription' | 'immunization' | 'referral' | 'anc' | 'appointment';
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { label?: string; bg: string; color: string; dot?: boolean };
}

const CATEGORY_CONFIG: Record<TimelineEvent['category'], { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; labelKey: string }> = {
  triage:        { icon: Activity,       color: '#FB923C',               labelKey: 'timeline.categoryTriage' },
  consultation:  { icon: Stethoscope,    color: 'var(--accent-primary)', labelKey: 'timeline.categoryConsultation' },
  lab:           { icon: FlaskConical,   color: 'var(--accent-primary)',               labelKey: 'timeline.categoryLab' },
  prescription:  { icon: Pill,           color: '#0D9488',               labelKey: 'timeline.categoryRx' },
  immunization:  { icon: Syringe,        color: '#059669',               labelKey: 'timeline.categoryVaccine' },
  referral:      { icon: ArrowRightLeft, color: '#F59E0B',               labelKey: 'timeline.categoryReferral' },
  anc:           { icon: HeartPulse,     color: '#EC4899',               labelKey: 'timeline.categoryAnc' },
  appointment:   { icon: FileText,       color: '#6366F1',               labelKey: 'timeline.categoryAppointment' },
};

function buildEvents(props: PatientTimelineProps, t: TFunc): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const tr of props.triages || []) {
    const vitals: string[] = [];
    if (tr.temperature) vitals.push(`T ${tr.temperature}°C`);
    if (tr.pulse) vitals.push(`HR ${tr.pulse}`);
    if (tr.respiratoryRate) vitals.push(`RR ${tr.respiratoryRate}`);
    if (tr.oxygenSaturation) vitals.push(`SpO₂ ${tr.oxygenSaturation}%`);
    if (tr.systolic && tr.diastolic) vitals.push(`BP ${tr.systolic}/${tr.diastolic}`);
    events.push({
      id: `triage-${tr._id}`,
      date: tr.triagedAt || tr.createdAt,
      category: 'triage',
      title: tr.chiefComplaint || t('timeline.titleTriage'),
      subtitle: `A: ${tr.airway} · B: ${tr.breathing} · C: ${tr.circulation} · AVPU-${tr.consciousness.toUpperCase()[0]}`,
      meta: `${tr.triagedByName}${vitals.length ? ' · ' + vitals.join(' · ') : ''}`,
      badge: tr.priority === 'RED'
        ? { dot: true, bg: 'rgba(229,46,66,0.14)', color: 'var(--color-danger)' }
        : tr.priority === 'YELLOW'
        ? { dot: true, bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' }
        : { dot: true, bg: 'rgba(31, 157, 111,0.12)', color: 'var(--color-success)' },
    });
  }

  for (const r of props.medicalRecords || []) {
    const dx = (r.diagnoses || []).slice(0, 2).map(d => d.name).join(', ');
    events.push({
      id: `mr-${r._id}`,
      date: r.consultedAt || r.visitDate || r.createdAt,
      category: 'consultation',
      title: r.chiefComplaint || t('timeline.titleConsultation'),
      subtitle: dx || r.providerName || undefined,
      meta: r.providerName ? `${r.providerName}${r.department ? ` · ${r.department}` : ''}` : r.department,
      badge: r.visitType ? { label: r.visitType, bg: 'rgba(59, 130, 246,0.10)', color: 'var(--accent-primary)' } : undefined,
    });
  }

  for (const lr of props.labResults || []) {
    const status = lr.status === 'completed' ? lr.result || t('timeline.statusCompleted') : lr.status.replace('_', ' ');
    events.push({
      id: `lab-${lr._id}`,
      date: lr.completedAt || lr.orderedAt || lr.createdAt,
      category: 'lab',
      title: lr.testName,
      subtitle: status,
      meta: lr.specimen ? t('timeline.metaSpecimen', { specimen: lr.specimen }) : undefined,
      badge: lr.critical
        ? { label: t('timeline.badgeCritical'), bg: 'rgba(229,46,66,0.14)', color: 'var(--color-danger)' }
        : lr.abnormal
        ? { label: t('timeline.badgeAbnormal'), bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' }
        : undefined,
    });
  }

  for (const rx of props.prescriptions || []) {
    events.push({
      id: `rx-${rx._id}`,
      date: rx.createdAt,
      category: 'prescription',
      title: rx.medication,
      subtitle: `${rx.dose || ''} ${rx.frequency || ''}${rx.duration ? ` · ${rx.duration}` : ''}`.trim(),
      meta: rx.prescribedBy,
      badge: rx.status === 'dispensed'
        ? { label: t('timeline.badgeDispensed'), bg: 'rgba(31, 157, 111,0.14)', color: 'var(--color-success)' }
        : { label: t('timeline.badgePending'), bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' },
    });
  }

  for (const im of props.immunizations || []) {
    events.push({
      id: `imm-${im._id}`,
      date: im.dateGiven || im.createdAt,
      category: 'immunization',
      title: `${im.vaccine} ${im.doseNumber > 0 ? t('timeline.doseNumber', { number: im.doseNumber }) : ''}`.trim(),
      subtitle: im.batchNumber ? t('timeline.batchNumber', { batch: im.batchNumber }) : undefined,
      meta: im.facilityName,
    });
  }

  for (const ref of props.referrals || []) {
    events.push({
      id: `ref-${ref._id}`,
      date: ref.referralDate || ref.createdAt,
      category: 'referral',
      title: t('timeline.titleReferral', { facility: ref.toHospital || t('timeline.facilityFallback') }),
      subtitle: ref.reason || ref.department,
      meta: ref.referringDoctor,
      badge: { label: ref.status, bg: 'rgba(245,158,11,0.10)', color: 'var(--color-warning)' },
    });
  }

  for (const a of props.ancVisits || []) {
    events.push({
      id: `anc-${a._id}`,
      date: a.visitDate || a.createdAt,
      category: 'anc',
      title: t('timeline.titleAncVisit', { number: a.visitNumber }),
      subtitle: t('timeline.subtitleAnc', { weeks: a.gestationalAge || '—', risk: a.riskLevel }),
      meta: a.facilityName,
      badge: a.riskLevel === 'high'
        ? { label: t('timeline.badgeHighRisk'), bg: 'rgba(229,46,66,0.14)', color: 'var(--color-danger)' }
        : a.riskLevel === 'moderate'
        ? { label: t('timeline.badgeModerate'), bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' }
        : undefined,
    });
  }

  for (const ap of props.appointments || []) {
    events.push({
      id: `apt-${ap._id}`,
      date: `${ap.appointmentDate}T${ap.appointmentTime || '00:00'}`,
      category: 'appointment',
      title: ap.appointmentType?.replace(/_/g, ' ') || t('timeline.titleAppointment'),
      subtitle: ap.reason,
      meta: ap.providerName,
      badge: { label: ap.status, bg: 'rgba(99,102,241,0.10)', color: '#6366F1' },
    });
  }

  return events
    .filter(e => !!e.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export default function PatientTimeline(props: PatientTimelineProps) {
  const { t } = useTranslation();
  const events = buildEvents(props, t);

  if (events.length === 0) {
    return (
      <div className="card-elevated px-6 py-7 text-center">
        <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('timeline.emptyState')}
        </p>
      </div>
    );
  }

  return (
    <div className="card-elevated p-5">
      <div className="relative">
        {events.map((e, i) => {
          const cfg = CATEGORY_CONFIG[e.category];
          const Icon = cfg.icon;
          const isLast = i === events.length - 1;
          const dateLabel = (() => {
            try {
              return new Date(e.date).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                ...(e.date.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}),
              });
            } catch { return e.date; }
          })();
          // An event counts as "alarming" when its badge text reads as a
          // clinical emergency (critical lab, high-risk triage, etc.).
          // Color-sniffing is fragile (hexes vary), so we match the label.
          const badgeLabel = (e.badge?.label || '').toLowerCase();
          const badgeIsAlarm = /critical|emergency|red|severe|abnormal|high risk|overdue|hypo|hyper/.test(badgeLabel);
          return (
            <div key={e.id} className="flex gap-3.5" style={{ paddingBottom: isLast ? 0 : 16 }}>
              {/* Rail column: continuous connector behind a tinted icon node */}
              <div className="relative flex-shrink-0" style={{ width: 40 }}>
                {!isLast && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute', top: 20, bottom: -16, left: 20,
                      transform: 'translateX(-50%)', width: 2,
                      background: 'var(--border-light)',
                    }}
                  />
                )}
                <div
                  className="relative"
                  style={{
                    width: 40, height: 40, borderRadius: 12, zIndex: 1,
                    background: `${cfg.color}14`, border: `1.5px solid ${cfg.color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon className="w-[18px] h-[18px]" style={{ color: cfg.color }} />
                </div>
              </div>
              {/* Body card — uniform bordered surface; alarming events tint red */}
              <div
                className="flex-1 min-w-0"
                style={{
                  padding: '11px 16px',
                  borderRadius: 12,
                  background: badgeIsAlarm ? 'rgba(196, 69, 54, 0.05)' : 'var(--overlay-subtle)',
                  border: `1px solid ${badgeIsAlarm ? 'rgba(196, 69, 54, 0.28)' : 'var(--border-light)'}`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{e.title}</span>
                    <span
                      className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: `${cfg.color}14`, color: cfg.color }}
                    >
                      {t(cfg.labelKey)}
                    </span>
                  </div>
                  <span className="text-[11px] flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{dateLabel}</span>
                </div>
                {e.subtitle && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>{e.subtitle}</p>
                )}
                {e.meta && (
                  <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-muted)' }}>{e.meta}</p>
                )}
                {e.badge && !e.badge.dot && (
                  <div className="mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{
                      background: e.badge.bg,
                      color: e.badge.color,
                      border: `1px solid ${e.badge.color}30`,
                    }}>
                      {e.badge.label}
                    </span>
                  </div>
                )}
                {e.badge?.dot && (
                  <div className="mt-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full align-middle" style={{ background: e.badge.color }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
