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
import { patientAge } from '@/lib/patient-utils';
import { useTranslation } from '@/lib/i18n/useTranslation';

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
  paediatric: { iconBg: 'rgba(59, 130, 246,0.14)',   iconColor: '#1E3A8A',                ring: 'rgba(59, 130, 246,0.22)' },
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
  /** Whether the viewer may start a consultation (consultation capability). */
  canConsult: boolean;
}

export default function PatientIndex({ patient, counts, onJump, canConsult }: PatientIndexProps) {
  const { t } = useTranslation();
  const { activeAdmissions } = useWards();
  const admission = useMemo(
    () => activeAdmissions.find(a => a.patientId === patient._id),
    [activeAdmissions, patient._id],
  );

  const age = patientAge(patient);
  const isFemale = patient.gender === 'Female';
  const isAdult = age != null && age >= 15;
  const isUnder5 = age != null && age < 5;

  return (
    <div className="space-y-7">
      <header>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('patientIndex.headerTitle', { name: patient.firstName })}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('patientIndex.headerSubtitle')}
        </p>
      </header>

      <IndexGroup title={t('patientIndex.groupQuickView')}>
        <IndexCell
          icon={ClipboardList}
          label={t('tab.overview')}
          hint={t('patientIndex.overviewHint')}
          onClick={() => onJump('overview')}
        />
        <IndexCell
          icon={FileText}
          label={t('patientIndex.sbarHandoff')}
          hint={t('patientIndex.sbarHandoffHint')}
          onClick={() => onJump('sbar')}
        />
        <IndexCell
          icon={ClipboardList}
          label={t('patientIndex.timeline')}
          hint={t('patientIndex.timelineHint')}
          badge={counts.consultations || undefined}
          empty={counts.consultations === 0}
          onClick={() => onJump('timeline')}
        />
        <IndexCell
          icon={Activity}
          label={t('patientIndex.trends')}
          hint={t('patientIndex.trendsHint')}
          onClick={() => onJump('trends')}
        />
      </IndexGroup>

      <IndexGroup title={t('patientIndex.groupClinical')}>
        {canConsult && (
          <IndexCell
            icon={Stethoscope}
            label={t('action.newConsultation')}
            hint={t('patientIndex.newConsultationHint')}
            href={`/consultation?patientId=${patient._id}`}
          />
        )}
        <IndexCell
          icon={AlertTriangle}
          label={t('patientIndex.problemList')}
          hint={t('patientIndex.problemListHint')}
          badge={counts.activeProblems || undefined}
          empty={counts.activeProblems === 0}
          emphasis={counts.activeProblems > 0 ? 'safety' : 'default'}
          onClick={() => onJump('problems')}
        />
        <IndexCell
          icon={Activity}
          label={t('tab.vitals')}
          hint={t('patientIndex.vitalsHint')}
          onClick={() => onJump('vitals')}
        />
        <IndexCell
          icon={Brain}
          label={t('patientIndex.aiDecisionSupport')}
          hint={t('patientIndex.aiDecisionSupportHint')}
          onClick={() => onJump('history')}
        />
      </IndexGroup>

      <IndexGroup title={t('patientIndex.groupOrdersResults')}>
        <IndexCell
          icon={FlaskConical}
          label={t('tab.labResults')}
          hint={t('patientIndex.labResultsHint')}
          badge={counts.labs || undefined}
          empty={counts.labs === 0}
          emphasis={counts.criticalLabs > 0 ? 'safety' : 'default'}
          onClick={() => onJump('labs')}
        />
        <IndexCell
          icon={Pill}
          label={t('tab.prescriptions')}
          hint={t('patientIndex.prescriptionsHint')}
          badge={counts.prescriptions || undefined}
          empty={counts.prescriptions === 0}
          onClick={() => onJump('prescriptions')}
        />
        <IndexCell
          icon={TestTubes}
          label={t('patientIndex.orderNewLab')}
          hint={t('patientIndex.orderNewLabHint')}
          href={`/lab?patientId=${patient._id}&new=1`}
        />
        <IndexCell
          icon={Pill}
          label={t('nav.pharmacy')}
          hint={t('patientIndex.pharmacyHint')}
          href={`/pharmacy?patientId=${patient._id}`}
        />
      </IndexGroup>

      {/* Inpatient — only when admitted */}
      {admission && (
        <IndexGroup title={t('patientIndex.groupInpatient')}>
          <IndexCell
            icon={BedDouble}
            label={t('patientIndex.wardBed')}
            hint={`${admission.wardName}${admission.bedNumber ? ' · ' + admission.bedNumber : ''}`}
            href="/wards"
            emphasis="inpatient"
          />
          <IndexCell
            icon={Pill}
            label={t('mar.title')}
            hint={t('patientIndex.marHint')}
            href={`/wards/mar/${admission._id}`}
            emphasis="inpatient"
          />
          <IndexCell
            icon={ShieldAlert}
            label={t('ward.isolation')}
            hint={admission.isolationRequired ? (admission.isolationReason || t('patientIndex.isolationRequired')) : t('patientIndex.isolationNotRequired')}
            empty={!admission.isolationRequired}
            emphasis={admission.isolationRequired ? 'safety' : 'default'}
          />
          <IndexCell
            icon={ClipboardList}
            label={t('patientIndex.dischargePlan')}
            hint={t('patientIndex.dischargePlanHint')}
            href="/wards"
            emphasis="inpatient"
          />
        </IndexGroup>
      )}

      {/* Maternal — women of reproductive age */}
      {isFemale && isAdult && age != null && age <= 49 && (
        <IndexGroup title={t('patientIndex.groupMaternalHealth')}>
          <IndexCell
            icon={Heart}
            label={t('patientIndex.ancVisits')}
            hint={t('patientIndex.ancVisitsHint')}
            href={`/anc?patientId=${patient._id}`}
            emphasis="maternal"
          />
          <IndexCell
            icon={Baby}
            label={t('patientIndex.birthRegistration')}
            hint={t('patientIndex.birthRegistrationHint')}
            href={`/births?patientId=${patient._id}`}
            emphasis="maternal"
          />
        </IndexGroup>
      )}

      {/* Paediatric — under 5 */}
      {isUnder5 && (
        <IndexGroup title={t('patientIndex.groupPaediatricEpi')}>
          <IndexCell
            icon={Syringe}
            label={t('nav.immunizations')}
            hint={t('patientIndex.immunizationsHint')}
            badge={counts.immunizations || undefined}
            empty={counts.immunizations === 0}
            href={`/immunizations?patientId=${patient._id}`}
            emphasis="paediatric"
          />
          <IndexCell
            icon={Activity}
            label={t('patientIndex.growthMonitoring')}
            hint={t('patientIndex.growthMonitoringHint')}
            onClick={() => onJump('trends')}
            emphasis="paediatric"
          />
        </IndexGroup>
      )}

      <IndexGroup title={t('patientIndex.groupCoordination')}>
        <IndexCell
          icon={ArrowRightLeft}
          label={t('tab.referrals')}
          hint={t('patientIndex.referralsHint')}
          badge={counts.activeReferrals || undefined}
          empty={counts.referrals === 0}
          onClick={() => onJump('referrals')}
        />
        <IndexCell
          icon={MessageSquare}
          label={t('action.sendMessage')}
          hint={t('patientIndex.sendMessageHint')}
          href={`/messages?patientId=${patient._id}`}
        />
        <IndexCell
          icon={Wallet}
          label={t('billing.sidebarTitle')}
          hint={t('patientIndex.billingHint')}
          onClick={() => onJump('billing')}
        />
      </IndexGroup>
    </div>
  );
}
