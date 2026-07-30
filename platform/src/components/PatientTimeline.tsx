'use client';

import { Fragment, useState } from 'react';
import { ChevronDown } from '@/components/icons/lucide';

import type {
  MedicalRecordDoc, LabResultDoc, PrescriptionDoc, ImmunizationDoc,
  ReferralDoc, ANCVisitDoc, AppointmentDoc, TriageDoc,
} from '@/lib/db-types';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatRxSig, humanizeStatus } from '@/lib/format-utils';
import ChartSection, { OmrsEmptyState } from '@/components/ehr/chart/ChartSection';

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

// Marker color per category — rendered as a colored timeline dot (the icon
// chips added noise without aiding recognition; the colored category label
// carries the same signal).
const CATEGORY_CONFIG: Record<TimelineEvent['category'], { color: string; labelKey: string }> = {
  triage:        { color: '#FB923C',               labelKey: 'timeline.categoryTriage' },
  consultation:  { color: 'var(--accent-primary)', labelKey: 'timeline.categoryConsultation' },
  lab:           { color: 'var(--accent-primary)', labelKey: 'timeline.categoryLab' },
  prescription:  { color: '#0D9488',               labelKey: 'timeline.categoryRx' },
  immunization:  { color: '#059669',               labelKey: 'timeline.categoryVaccine' },
  referral:      { color: '#F59E0B',               labelKey: 'timeline.categoryReferral' },
  anc:           { color: '#EC4899',               labelKey: 'timeline.categoryAnc' },
  appointment:   { color: '#6366F1',               labelKey: 'timeline.categoryAppointment' },
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
      subtitle: tr.assessmentSource === 'clerical_checkin' || tr.airway === 'not_assessed'
        ? t('timeline.triageNotAssessed')
        : `A: ${tr.airway} · B: ${tr.breathing} · C: ${tr.circulation} · AVPU-${tr.consciousness.toUpperCase()[0]}`,
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
      badge: r.visitType ? { label: humanizeStatus(r.visitType), bg: 'rgba(59, 130, 246,0.10)', color: 'var(--accent-primary)' } : undefined,
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
      subtitle: formatRxSig(rx),
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
      badge: { label: humanizeStatus(ref.status), bg: 'rgba(245,158,11,0.10)', color: 'var(--color-warning)' },
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
      title: ap.reason || (ap.appointmentType ? `${humanizeStatus(ap.appointmentType)} appointment` : t('timeline.titleAppointment')),
      subtitle: ap.department,
      meta: ap.providerName,
      badge: { label: humanizeStatus(ap.status), bg: 'rgba(99,102,241,0.10)', color: '#6366F1' },
    });
  }

  return events
    .filter(e => !!e.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export default function PatientTimeline(props: PatientTimelineProps) {
  const { t } = useTranslation();
  const events = buildEvents(props, t);
  const [filter, setFilter] = useState<'all' | TimelineEvent['category']>('all');
  // Rows expanded to show their subtitle/meta. Kept as a set so several can be
  // open at once — comparing two events is the common reason to expand.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleDetail = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const visibleEvents = filter === 'all' ? events : events.filter(event => event.category === filter);
  const categoryOptions: Array<{ id: 'all' | TimelineEvent['category']; label: string }> = [
    { id: 'all', label: 'All activity' },
    { id: 'consultation', label: 'Consultations' },
    { id: 'lab', label: 'Results' },
    { id: 'prescription', label: 'Medications' },
    { id: 'appointment', label: 'Appointments' },
    { id: 'referral', label: 'Coordination' },
    { id: 'triage', label: 'Triage' },
    { id: 'immunization', label: 'Immunizations' },
    { id: 'anc', label: 'ANC' },
  ];

  if (events.length === 0) {
    return (
      <ChartSection title="Activity">
        <OmrsEmptyState itemLabel="activity" />
      </ChartSection>
    );
  }

  return (
    <ChartSection
      title="Activity"
      filterSlot={(
        <div className="tamam-activity-filters" role="tablist" aria-label="Filter patient activity">
          {categoryOptions.map(option => (
            <button
              key={option.id}
              type="button"
              className={filter === option.id ? 'is-active' : ''}
              onClick={() => setFilter(option.id)}
              role="tab"
              aria-selected={filter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    >
      <div className="tamam-activity-summary">
        <span><strong>{visibleEvents.length}</strong> {filter === 'all' ? 'events' : 'matching events'}</span>
        <span>Most recent first</span>
      </div>
      {visibleEvents.length === 0 ? (
        <OmrsEmptyState itemLabel="matching activity" />
      ) : (
      /* One line per event. The timeline rail (dot + connector) is gone: it
         cost a 30px column and ~34px of height per row to say only "these are
         in order", which the date column already says. Detail that used to
         sit under every title now lives behind a per-row disclosure, so the
         table stays scannable and only the row you ask about expands. */
      <table className="omrs-table tamam-activity-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            <th scope="col">Event</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="tamam-visually-hidden">Details</span></th>
          </tr>
        </thead>
        <tbody>
          {visibleEvents.map(e => {
            const cfg = CATEGORY_CONFIG[e.category];
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
            // Only rows that actually carry more than the four columns show
            // get a disclosure — an expander that opens onto nothing is worse
            // than no expander.
            const hasDetail = Boolean(e.subtitle || e.meta);
            const isOpen = hasDetail && expanded.has(e.id);
            return (
              <Fragment key={e.id}>
                <tr
                  className={`tamam-activity-tr${badgeIsAlarm ? ' is-alarm' : ''}${hasDetail ? ' has-detail' : ''}${isOpen ? ' is-open' : ''}`}
                  onClick={hasDetail ? () => toggleDetail(e.id) : undefined}
                >
                  <td className="tamam-activity-date"><time dateTime={e.date}>{dateLabel}</time></td>
                  <td>
                    <span className="tamam-activity-type">
                      <i aria-hidden style={{ background: cfg.color }} />
                      {t(cfg.labelKey)}
                    </span>
                  </td>
                  <td className="tamam-activity-title">{e.title}</td>
                  <td>
                    {e.badge?.dot
                      ? <i className="tamam-activity-severity" style={{ background: e.badge.color }} title="Priority indicator" />
                      : e.badge?.label
                        ? <em className="tamam-activity-badge" style={{ background: e.badge.bg, color: e.badge.color, borderColor: `${e.badge.color}30` }}>{e.badge.label}</em>
                        : <span className="tamam-activity-dash">—</span>}
                  </td>
                  <td className="tamam-activity-toggle-cell">
                    {hasDetail && (
                      <button
                        type="button"
                        className="tamam-activity-toggle"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Hide details for ${e.title}` : `Show details for ${e.title}`}
                        onClick={event => { event.stopPropagation(); toggleDetail(e.id); }}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="tamam-activity-detail">
                    <td colSpan={5}>
                      {e.subtitle && <p>{e.subtitle}</p>}
                      {e.meta && <small>{e.meta}</small>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      )}
    </ChartSection>
  );
}
