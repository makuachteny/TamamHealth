'use client';

import {
  DuotoneStethoscope as Stethoscope,
  DuotoneFlask as FlaskConical,
  DuotonePill as Pill,
  DuotoneVaccine as Syringe,
  DuotoneReferral as ArrowRightLeft,
  DuotoneMCH as HeartPulse,
  DuotoneFileText as FileText,
  DuotoneActivity as Activity,
} from '@/components/icons';
import type {
  MedicalRecordDoc, LabResultDoc, PrescriptionDoc, ImmunizationDoc,
  ReferralDoc, ANCVisitDoc, AppointmentDoc, TriageDoc,
} from '@/lib/db-types';

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
  badge?: { label: string; bg: string; color: string };
}

const CATEGORY_CONFIG: Record<TimelineEvent['category'], { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string; label: string }> = {
  triage:        { icon: Activity,       color: '#FB923C',               bg: 'rgba(251,146,60,0.14)', label: 'Triage' },
  consultation:  { icon: Stethoscope,    color: 'var(--accent-primary)', bg: 'rgba(43,111,224,0.12)', label: 'Consultation' },
  lab:           { icon: FlaskConical,   color: '#7C3AED',               bg: 'rgba(124,58,237,0.12)', label: 'Lab' },
  prescription:  { icon: Pill,           color: '#0D9488',               bg: 'rgba(13,148,136,0.12)', label: 'Rx' },
  immunization:  { icon: Syringe,        color: '#059669',               bg: 'rgba(5,150,105,0.12)',  label: 'Vaccine' },
  referral:      { icon: ArrowRightLeft, color: '#F59E0B',               bg: 'rgba(245,158,11,0.12)', label: 'Referral' },
  anc:           { icon: HeartPulse,     color: '#EC4899',               bg: 'rgba(236,72,153,0.12)', label: 'ANC' },
  appointment:   { icon: FileText,       color: '#6366F1',               bg: 'rgba(99,102,241,0.12)', label: 'Appointment' },
};

function buildEvents(props: PatientTimelineProps): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const t of props.triages || []) {
    const vitals: string[] = [];
    if (t.temperature) vitals.push(`T ${t.temperature}°C`);
    if (t.pulse) vitals.push(`HR ${t.pulse}`);
    if (t.respiratoryRate) vitals.push(`RR ${t.respiratoryRate}`);
    if (t.oxygenSaturation) vitals.push(`SpO₂ ${t.oxygenSaturation}%`);
    if (t.systolic && t.diastolic) vitals.push(`BP ${t.systolic}/${t.diastolic}`);
    events.push({
      id: `triage-${t._id}`,
      date: t.triagedAt || t.createdAt,
      category: 'triage',
      title: t.chiefComplaint || `${t.priority} triage`,
      subtitle: `A: ${t.airway} · B: ${t.breathing} · C: ${t.circulation} · AVPU-${t.consciousness.toUpperCase()[0]}`,
      meta: `${t.triagedByName}${vitals.length ? ' · ' + vitals.join(' · ') : ''}`,
      badge: t.priority === 'RED'
        ? { label: 'RED', bg: 'rgba(229,46,66,0.14)', color: 'var(--color-danger)' }
        : t.priority === 'YELLOW'
        ? { label: 'YELLOW', bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' }
        : { label: 'GREEN', bg: 'rgba(16,185,129,0.12)', color: 'var(--color-success)' },
    });
  }

  for (const r of props.medicalRecords || []) {
    const dx = (r.diagnoses || []).slice(0, 2).map(d => d.name).join(', ');
    events.push({
      id: `mr-${r._id}`,
      date: r.consultedAt || r.visitDate || r.createdAt,
      category: 'consultation',
      title: r.chiefComplaint || 'Clinical consultation',
      subtitle: dx || r.providerName || undefined,
      meta: r.providerName ? `${r.providerName}${r.department ? ` · ${r.department}` : ''}` : r.department,
      badge: r.visitType ? { label: r.visitType, bg: 'rgba(43,111,224,0.10)', color: 'var(--accent-primary)' } : undefined,
    });
  }

  for (const lr of props.labResults || []) {
    const status = lr.status === 'completed' ? lr.result || 'completed' : lr.status.replace('_', ' ');
    events.push({
      id: `lab-${lr._id}`,
      date: lr.completedAt || lr.orderedAt || lr.createdAt,
      category: 'lab',
      title: lr.testName,
      subtitle: status,
      meta: lr.specimen ? `Specimen: ${lr.specimen}` : undefined,
      badge: lr.critical
        ? { label: 'CRITICAL', bg: 'rgba(229,46,66,0.14)', color: 'var(--color-danger)' }
        : lr.abnormal
        ? { label: 'Abnormal', bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' }
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
        ? { label: 'Dispensed', bg: 'rgba(16,185,129,0.14)', color: 'var(--color-success)' }
        : { label: 'Pending', bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' },
    });
  }

  for (const im of props.immunizations || []) {
    events.push({
      id: `imm-${im._id}`,
      date: im.dateGiven || im.createdAt,
      category: 'immunization',
      title: `${im.vaccine} ${im.doseNumber > 0 ? `dose ${im.doseNumber}` : ''}`.trim(),
      subtitle: im.batchNumber ? `Batch ${im.batchNumber}` : undefined,
      meta: im.facilityName,
    });
  }

  for (const ref of props.referrals || []) {
    events.push({
      id: `ref-${ref._id}`,
      date: ref.referralDate || ref.createdAt,
      category: 'referral',
      title: `Referred to ${ref.toHospital || 'facility'}`,
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
      title: `ANC visit ${a.visitNumber}`,
      subtitle: `Gestational age ${a.gestationalAge || '—'}w · Risk: ${a.riskLevel}`,
      meta: a.facilityName,
      badge: a.riskLevel === 'high'
        ? { label: 'HIGH RISK', bg: 'rgba(229,46,66,0.14)', color: 'var(--color-danger)' }
        : a.riskLevel === 'moderate'
        ? { label: 'Moderate', bg: 'rgba(252,211,77,0.14)', color: 'var(--color-warning)' }
        : undefined,
    });
  }

  for (const ap of props.appointments || []) {
    events.push({
      id: `apt-${ap._id}`,
      date: `${ap.appointmentDate}T${ap.appointmentTime || '00:00'}`,
      category: 'appointment',
      title: ap.appointmentType?.replace(/_/g, ' ') || 'Appointment',
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
  const events = buildEvents(props);

  if (events.length === 0) {
    return (
      <div className="card-elevated p-8 text-center">
        <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No clinical events recorded for this patient yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card-elevated p-5">
      <div className="relative" style={{ paddingLeft: 4 }}>
        {events.map((e, i) => {
          const cfg = CATEGORY_CONFIG[e.category];
          const Icon = cfg.icon;
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
          const tileBg = badgeIsAlarm ? 'rgba(196, 69, 54, 0.06)' : 'transparent';
          const tileBorder = badgeIsAlarm ? 'rgba(196, 69, 54, 0.28)' : 'var(--border-light)';
          return (
            <div key={e.id} className="flex gap-4" style={{ marginBottom: i === events.length - 1 ? 0 : 16 }}>
              {/* Rail column: icon badge + connector */}
              <div className="flex flex-col items-center" style={{ width: 38, flexShrink: 0 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${cfg.color}14`, border: `1.5px solid ${cfg.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                {i < events.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: 'var(--border-light)', marginTop: 6, minHeight: 20 }} />
                )}
              </div>
              {/* Body tile */}
              <div
                className="flex-1 min-w-0"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: tileBg,
                  border: tileBg === 'transparent' ? 'none' : `1px solid ${tileBorder}`,
                }}
              >
                <div className="flex items-baseline flex-wrap gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{e.title}</span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{dateLabel}</span>
                </div>
                {e.subtitle && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>{e.subtitle}</p>
                )}
                {e.meta && (
                  <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-muted)' }}>{e.meta}</p>
                )}
                {e.badge && (
                  <div className="mt-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{
                      background: e.badge.bg,
                      color: e.badge.color,
                      border: `1px solid ${e.badge.color}30`,
                    }}>
                      {e.badge.label}
                    </span>
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
