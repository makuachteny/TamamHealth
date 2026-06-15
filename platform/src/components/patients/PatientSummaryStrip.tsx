'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock, Clock, Pill, Building2, FileText,
  ShieldCheck, Phone, MapPin, User, Stethoscope,
  Wallet, CheckCircle, ChevronRight,
} from '@/components/icons/lucide';
import type { AppointmentDoc, PatientNoteDoc, PatientDoc } from '@/lib/db-types';
import { usePatientPayments } from '@/lib/hooks/usePayments';
import { getNotesByPatient } from '@/lib/services/patient-note-service';
import { formatDate } from '@/lib/format-utils';

/* ═══════════════════════════════════════════════════════════════════
   PatientSummaryStrip

   An at-a-glance band across the top of the patient Overview, inspired by
   the dense summary panels in mature EHRs: Last & Next Appointment, plus
   Insurance / Pharmacy / Notes. Deliberately does NOT repeat the clinical
   "Most Recent Record" hero (chief complaint, diagnosis, meds) or the
   Billing sidebar card — it surfaces the administrative context those
   panels don't already cover.
   ═══════════════════════════════════════════════════════════════════ */

const PAYER_LABEL: Record<string, string> = {
  donor: 'Donor program',
  government: 'Government',
  nhis: 'National Health Insurance',
  cbhi: 'Community-based health insurance',
  private: 'Private insurance',
  employer: 'Employer plan',
  self_pay: 'Self-pay',
};

function apptDate(a: AppointmentDoc): number {
  // Combine YYYY-MM-DD + HH:MM into a comparable timestamp.
  return new Date(`${a.appointmentDate}T${(a.appointmentTime || '00:00')}:00`).getTime();
}

interface CardShellProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}

function CardShell({ icon, iconBg, title, action, children }: CardShellProps) {
  return (
    <div className="card-elevated flex flex-col">
      <div className="px-5 py-3 border-b flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-light)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="icon-box-sm" style={{ background: iconBg }}>{icon}</div>
          <h3 className="font-semibold text-sm truncate">{title}</h3>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-0.5 text-xs font-semibold flex-shrink-0 transition-colors"
            style={{ color: 'var(--accent-primary)' }}
          >
            {action.label} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function money(n?: number): string {
  if (typeof n !== 'number') return 'SSP 0';
  return `SSP ${Math.round(n).toLocaleString()}`;
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{text}</p>;
}

export default function PatientSummaryStrip({
  patient,
  appointments,
  showNotes = true,
  onViewBilling,
}: {
  patient: PatientDoc;
  appointments: AppointmentDoc[];
  /** Notes can carry clinical context — hide them for non-clinical roles. */
  showNotes?: boolean;
  /** Jump to the Billing tab from the Balance card. */
  onViewBilling?: () => void;
}) {
  const { policies, balance, summary } = usePatientPayments(patient._id);
  const [notes, setNotes] = useState<PatientNoteDoc[]>([]);

  useEffect(() => {
    let cancelled = false;
    getNotesByPatient(patient._id)
      .then(n => { if (!cancelled) setNotes(n); })
      .catch(() => { /* notes are best-effort */ });
    return () => { cancelled = true; };
  }, [patient._id]);

  const now = Date.now();
  const sorted = [...(appointments || [])]
    .filter(a => a.status !== 'cancelled' && a.status !== 'no_show')
    .sort((a, b) => apptDate(a) - apptDate(b));
  const nextAppt = sorted.find(a => apptDate(a) >= now);
  const lastAppt = [...sorted].reverse().find(a => apptDate(a) < now);

  const primary = policies?.find(p => p.isPrimary && p.isActive) || policies?.find(p => p.isActive) || policies?.[0];
  const latestNote = notes[0];
  const pharmacy = patient.preferredPharmacy;

  const apptCell = (label: string, a?: AppointmentDoc, accent = 'var(--accent-primary)') => (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {a ? (
        <>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatDate(`${a.appointmentDate}T${a.appointmentTime || '00:00'}:00`)}
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}> · {a.appointmentTime}</span>
          </p>
          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <User className="w-3 h-3" style={{ color: accent }} /> {a.providerName || '—'}
          </p>
          <p className="text-xs mt-0.5 flex items-center gap-1.5 truncate" style={{ color: 'var(--text-muted)' }}>
            <Stethoscope className="w-3 h-3" /> {a.department || a.reason || '—'}
          </p>
        </>
      ) : (
        <Empty text={label === 'Last visit' ? 'No past appointments' : 'None scheduled'} />
      )}
    </div>
  );

  const row = (label: string, value?: string, mono = false) => (
    value ? (
      <div className="flex justify-between gap-3">
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-xs font-medium text-right truncate" style={{ color: 'var(--text-primary)', fontFamily: mono ? 'JetBrains Mono, ui-monospace, monospace' : 'inherit' }}>{value}</span>
      </div>
    ) : null
  );

  const outstanding = summary?.totalBalance ?? balance ?? 0;
  const overdue = summary?.overdueBalance ?? 0;
  const isPaid = outstanding <= 0;

  return (
    <div className="space-y-5 mb-5">
      {/* Row 1 — Balance + Last & Next Appointment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CardShell
          icon={<Wallet className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />}
          iconBg="rgba(31,157,111,0.12)"
          title="Balance"
          action={onViewBilling ? { label: 'View all', onClick: onViewBilling } : undefined}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                {isPaid ? 'Account status' : 'Outstanding balance'}
              </p>
              {isPaid ? (
                <p className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>Paid in full</p>
              ) : (
                <>
                  <p className="text-xl font-bold" style={{ color: overdue > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{money(outstanding)}</p>
                  {overdue > 0 && (
                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--color-danger)' }}>{money(overdue)} past due</p>
                  )}
                </>
              )}
              <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-3 h-3" />
                {summary?.lastPaymentDate
                  ? `Last payment ${money(summary.lastPaymentAmount)} · ${formatDate(summary.lastPaymentDate)}`
                  : 'No payments recorded'}
              </p>
            </div>
            {isPaid && (
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(31,157,111,0.12)' }}>
                <CheckCircle className="w-6 h-6" style={{ color: 'var(--color-success)' }} />
              </div>
            )}
          </div>
        </CardShell>

        <CardShell
          icon={<CalendarClock className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />}
          iconBg="var(--accent-light)"
          title="Last & Next Appointment"
        >
          <div className="flex items-stretch gap-5">
            {apptCell('Last visit', lastAppt, '#E4A84B')}
            <div style={{ width: 1, background: 'var(--border-light)' }} aria-hidden />
            {apptCell('Next visit', nextAppt, 'var(--accent-primary)')}
          </div>
        </CardShell>
      </div>

      {/* Insurance · Pharmacy · Notes */}
      <div className={`grid grid-cols-1 gap-5 ${showNotes ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <CardShell
          icon={<ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />}
          iconBg="rgba(31,157,111,0.12)"
          title="Insurance"
        >
          {primary ? (
            <div className="data-row-divider-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{primary.payerName}</span>
                {primary.isPrimary && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>Primary</span>
                )}
              </div>
              {row('Type', PAYER_LABEL[primary.payerType] || primary.payerType)}
              {row('Member ID', primary.memberId, true)}
              {row('Policy', primary.policyNumber, true)}
              {typeof primary.coinsurancePct === 'number' && primary.coinsurancePct > 0 && row('Co-insurance', `${primary.coinsurancePct}%`)}
              {typeof primary.copayAmount === 'number' && primary.copayAmount > 0 && row('Co-pay', `SSP ${primary.copayAmount.toLocaleString()}`)}
              {(policies?.length || 0) > 1 && (
                <p className="text-[11px] pt-1" style={{ color: 'var(--text-muted)' }}>+{(policies!.length - 1)} more {policies!.length - 1 === 1 ? 'policy' : 'policies'} on file</p>
              )}
            </div>
          ) : (
            <Empty text="No insurance on file — self-pay" />
          )}
        </CardShell>

        <CardShell
          icon={<Pill className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />}
          iconBg="rgba(59,130,246,0.12)"
          title="Preferred Pharmacy"
        >
          {pharmacy ? (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> {pharmacy.name}
              </p>
              {pharmacy.address && (
                <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin className="w-3 h-3" style={{ color: 'var(--text-muted)' }} /> {pharmacy.address}
                </p>
              )}
              {pharmacy.phone && (
                <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                  <Phone className="w-3 h-3" style={{ color: 'var(--text-muted)' }} /> {pharmacy.phone}
                </p>
              )}
            </div>
          ) : (
            <Empty text="No preferred pharmacy set" />
          )}
        </CardShell>

        {showNotes && (
        <CardShell
          icon={<FileText className="w-3.5 h-3.5" style={{ color: '#E4A84B' }} />}
          iconBg="rgba(228,168,75,0.14)"
          title="Notes"
        >
          {latestNote ? (
            <div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{latestNote.body}</p>
              <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-3 h-3" /> {latestNote.authorName} · {formatDate(latestNote.createdAt)}
                {notes.length > 1 && <span>· +{notes.length - 1} more</span>}
              </p>
            </div>
          ) : (
            <Empty text="No notes recorded" />
          )}
        </CardShell>
        )}
      </div>
    </div>
  );
}
