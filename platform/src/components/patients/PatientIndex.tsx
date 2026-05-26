'use client';

/**
 * PatientIndex — Epic-style "table of contents" for one patient.
 *
 * Renders a curated grid of activities grouped by clinical domain. Each
 * cell is one click into a deep workflow (lab orders, ANC visits, referrals,
 * etc.). Cells are surfaced conditionally — ANC only shows for women, EPI
 * only for under-5, MAR only for currently-admitted patients. The point is
 * to compress "where do I go next?" into a single screen so a clinician
 * doesn't hunt through the global sidebar.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Stethoscope, FlaskConical, Pill, Syringe, Heart, Baby,
  ArrowRightLeft, ClipboardList, FileText, Activity, BedDouble,
  AlertTriangle, MessageSquare, Wallet, ShieldAlert, Brain, TestTubes,
} from '@/components/icons/lucide';
import type { PatientDoc } from '@/lib/db-types';
import { useWards } from '@/lib/hooks/useWards';

interface IndexCellProps {
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  hint?: string;
  /** Active count or status badge (small) */
  badge?: string | number;
  /** Render dimmed when no data exists yet */
  empty?: boolean;
  /** Tinted variant (used for safety-critical groups like alerts) */
  emphasis?: 'default' | 'safety' | 'maternal' | 'paediatric' | 'inpatient';
}

const EMPHASIS_TINTS: Record<NonNullable<IndexCellProps['emphasis']>, { iconBg: string; iconColor: string; ring: string }> = {
  default:    { iconBg: 'var(--accent-light)',     iconColor: 'var(--accent-primary)',  ring: 'var(--border-light)' },
  safety:     { iconBg: 'rgba(196,69,54,0.14)',    iconColor: 'var(--tamamhealth-red)', ring: 'rgba(196,69,54,0.20)' },
  maternal:   { iconBg: 'rgba(236,72,153,0.14)',   iconColor: '#EC4899',                ring: 'rgba(236,72,153,0.22)' },
  paediatric: { iconBg: 'rgba(20,184,166,0.14)',   iconColor: '#0D9488',                ring: 'rgba(20,184,166,0.22)' },
  inpatient:  { iconBg: 'rgba(124,58,237,0.14)',   iconColor: '#7C3AED',                ring: 'rgba(124,58,237,0.22)' },
};

function IndexCell({ href, onClick, icon: Icon, label, hint, badge, empty, emphasis = 'default' }: IndexCellProps) {
  const tint = EMPHASIS_TINTS[emphasis];
  const interactive = href || onClick;

  const inner = (
    <div
      className="card-elevated h-full p-3.5 transition-all"
      style={{
        opacity: empty ? 0.6 : 1,
        cursor: interactive ? 'pointer' : 'default',
        minHeight: 96,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderColor: tint.ring,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="icon-box" style={{ background: tint.iconBg }}>
          <Icon className="w-4 h-4" style={{ color: tint.iconColor }} />
        </div>
        {badge !== undefined && badge !== '' && Number(badge) > 0 && (
          <span
            className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: tint.iconColor,
              color: 'white',
              minWidth: 20,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <div className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        {hint && (
          <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block h-full" aria-label={label}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full h-full text-left" aria-label={label}>{inner}</button>;
  return inner;
}

interface IndexGroupProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

function IndexGroup({ title, count, children }: IndexGroupProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <h3
          className="text-[11px] font-bold uppercase"
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}
        >
          {title}
        </h3>
        {count != null && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            · {count}
          </span>
        )}
        <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </section>
  );
}

export interface PatientIndexProps {
  patient: PatientDoc;
  counts: {
    consultations: number;
    labs: number;
    prescriptions: number;
    referrals: number;
    immunizations: number;
    activeProblems: number;
    criticalLabs: number;
    activeReferrals: number;
  };
  onJump: (tabId: string) => void;
}

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return new Date().getFullYear() - d.getFullYear();
}

export default function PatientIndex({ patient, counts, onJump }: PatientIndexProps) {
  const { activeAdmissions } = useWards();
  const admission = useMemo(
    () => activeAdmissions.find(a => a.patientId === patient._id),
    [activeAdmissions, patient._id],
  );

  const age = calcAge(patient.dateOfBirth);
  const isFemale = patient.gender === 'Female';
  const isAdult = age != null && age >= 15;
  const isUnder5 = age != null && age < 5;

  return (
    <div className="space-y-7">
      <header>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          What can I do for {patient.firstName}?
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Curated index of activities for this patient. Cells light up only when relevant data is present.
        </p>
      </header>

      <IndexGroup title="Quick View">
        <IndexCell
          icon={ClipboardList}
          label="Overview"
          hint="Vitals, last visit"
          onClick={() => onJump('overview')}
        />
        <IndexCell
          icon={FileText}
          label="SBAR Handoff"
          hint="Auto-generated"
          onClick={() => onJump('sbar')}
        />
        <IndexCell
          icon={ClipboardList}
          label="Timeline"
          hint="Encounter history"
          badge={counts.consultations || undefined}
          empty={counts.consultations === 0}
          onClick={() => onJump('timeline')}
        />
        <IndexCell
          icon={Activity}
          label="Trends"
          hint="Vital sign charts"
          onClick={() => onJump('trends')}
        />
      </IndexGroup>

      <IndexGroup title="Clinical">
        <IndexCell
          icon={Stethoscope}
          label="New Consultation"
          hint="Start an encounter"
          href={`/consultation/${patient._id}`}
        />
        <IndexCell
          icon={AlertTriangle}
          label="Problem List"
          hint="Active & chronic"
          badge={counts.activeProblems || undefined}
          empty={counts.activeProblems === 0}
          emphasis={counts.activeProblems > 0 ? 'safety' : 'default'}
          onClick={() => onJump('problems')}
        />
        <IndexCell
          icon={Activity}
          label="Vitals"
          hint="All readings"
          onClick={() => onJump('vitals')}
        />
        <IndexCell
          icon={Brain}
          label="AI Decision Support"
          hint="Per-encounter"
          onClick={() => onJump('history')}
        />
      </IndexGroup>

      <IndexGroup title="Orders & Results">
        <IndexCell
          icon={FlaskConical}
          label="Lab Results"
          hint="Ordered tests"
          badge={counts.labs || undefined}
          empty={counts.labs === 0}
          emphasis={counts.criticalLabs > 0 ? 'safety' : 'default'}
          onClick={() => onJump('labs')}
        />
        <IndexCell
          icon={Pill}
          label="Prescriptions"
          hint="Active & dispensed"
          badge={counts.prescriptions || undefined}
          empty={counts.prescriptions === 0}
          onClick={() => onJump('prescriptions')}
        />
        <IndexCell
          icon={TestTubes}
          label="Order New Lab"
          hint="Add to lab queue"
          href={`/lab?patientId=${patient._id}&new=1`}
        />
        <IndexCell
          icon={Pill}
          label="Pharmacy"
          hint="Dispense / interactions"
          href={`/pharmacy?patientId=${patient._id}`}
        />
      </IndexGroup>

      {/* Inpatient — only when admitted */}
      {admission && (
        <IndexGroup title="Inpatient">
          <IndexCell
            icon={BedDouble}
            label="Ward Bed"
            hint={`${admission.wardName}${admission.bedNumber ? ' · ' + admission.bedNumber : ''}`}
            href="/wards"
            emphasis="inpatient"
          />
          <IndexCell
            icon={Pill}
            label="MAR"
            hint="Bedside med admin"
            href={`/wards/mar/${admission._id}`}
            emphasis="inpatient"
          />
          <IndexCell
            icon={ShieldAlert}
            label="Isolation"
            hint={admission.isolationRequired ? (admission.isolationReason || 'Required') : 'Not required'}
            empty={!admission.isolationRequired}
            emphasis={admission.isolationRequired ? 'safety' : 'default'}
          />
          <IndexCell
            icon={ClipboardList}
            label="Discharge Plan"
            hint="Summary & follow-up"
            href="/wards"
            emphasis="inpatient"
          />
        </IndexGroup>
      )}

      {/* Maternal — women of reproductive age */}
      {isFemale && isAdult && age != null && age <= 49 && (
        <IndexGroup title="Maternal Health">
          <IndexCell
            icon={Heart}
            label="ANC Visits"
            hint="WHO 8-contact"
            href={`/anc?patientId=${patient._id}`}
            emphasis="maternal"
          />
          <IndexCell
            icon={Baby}
            label="Birth Registration"
            hint="CRVS"
            href={`/births?patientId=${patient._id}`}
            emphasis="maternal"
          />
        </IndexGroup>
      )}

      {/* Paediatric — under 5 */}
      {isUnder5 && (
        <IndexGroup title="Paediatric / EPI">
          <IndexCell
            icon={Syringe}
            label="Immunizations"
            hint="EPI schedule"
            badge={counts.immunizations || undefined}
            empty={counts.immunizations === 0}
            href={`/immunizations?patientId=${patient._id}`}
            emphasis="paediatric"
          />
          <IndexCell
            icon={Activity}
            label="Growth Monitoring"
            hint="Weight / MUAC"
            onClick={() => onJump('trends')}
            emphasis="paediatric"
          />
        </IndexGroup>
      )}

      <IndexGroup title="Coordination">
        <IndexCell
          icon={ArrowRightLeft}
          label="Referrals"
          hint="In & out"
          badge={counts.activeReferrals || undefined}
          empty={counts.referrals === 0}
          onClick={() => onJump('referrals')}
        />
        <IndexCell
          icon={MessageSquare}
          label="Send Message"
          hint="Patient or clinician"
          href={`/messages?patientId=${patient._id}`}
        />
        <IndexCell
          icon={Wallet}
          label="Billing"
          hint="Charges & balance"
          onClick={() => onJump('billing')}
        />
      </IndexGroup>
    </div>
  );
}
