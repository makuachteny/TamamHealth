'use client';

/**
 * ChartHeader — the sticky OpenMRS O3-style patient header. Stage 1: visual
 * shell only. The triage badge / pregnancy pill are still owned by the page
 * (they carry their own popup state) and are passed in as rendered nodes so
 * that logic isn't duplicated or destabilized here.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon as DuotoneIcon } from '@/components/icons';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { patientFullName, patientInitials, patientAgeLabel, avatarColor } from '@/lib/patient-utils';
import type { PatientDoc } from '@/lib/db-types';

/** dd-MMM-yyyy, e.g. "17-Jun-1990" — the OpenMRS convention, distinct from
 *  this app's general-purpose `formatDate` ("Jun 17, 1990"). */
function formatDobOmrs(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${day}-${month}-${d.getFullYear()}`;
}

interface ChartHeaderProps {
  patient: PatientDoc;
  triageBadge?: ReactNode;
  pregnancyPill?: ReactNode;
  hasActiveVisit: boolean;
  patientBalance: number;
  onCollectPayment: () => void;
  onMessage: () => void;
  onPrint: () => void;
  onPatientEd: () => void;
  onNote: () => void;
  onScripts: () => void;
  onOrders: () => void;
  onExchange: () => void;
  onEdit: () => void;
  onStickyNote: () => void;
}

export default function ChartHeader({
  patient, triageBadge, pregnancyPill, hasActiveVisit, patientBalance,
  onCollectPayment, onMessage, onPrint, onPatientEd, onNote, onScripts, onOrders, onExchange, onEdit, onStickyNote,
}: ChartHeaderProps) {
  const [showMore, setShowMore] = useState(true);

  // Only surface the actions this role actually uses — e.g. a registration
  // clerk never writes clinical notes or prescriptions, so those buttons are
  // dropped rather than dead weight on the card.
  const {
    canSendMessages, canViewClinical, canPrescribe, canDispense,
    canOrderLabs, canEnterLabResults, canManageReferrals, canRegisterPatients,
  } = usePermissions();

  const initials = patientInitials(patient);
  const photoUrl = (patient as { photoUrl?: string }).photoUrl;
  const genderSymbol = patient.gender === 'Male' ? '♂' : patient.gender === 'Female' ? '♀' : null;
  const genderClass = patient.gender === 'Male' ? 'male' : patient.gender === 'Female' ? 'female' : '';
  const patientIdDisplay = patient.hospitalNumber || patient.geocodeId || '—';

  return (
    <div className="omrs-header">
      <div
        className="omrs-avatar"
        style={{ background: avatarColor(patientFullName(patient)) }}
        aria-hidden
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" />
        ) : (
          initials
        )}
      </div>

      <div className="omrs-header-body">
        <div className="omrs-header-name-row">
          <h1 className="omrs-header-name">{patientFullName(patient)}</h1>
          {genderSymbol && <span className={`omrs-gender-symbol ${genderClass}`} aria-label={patient.gender}>{genderSymbol}</span>}
          {triageBadge}
          {pregnancyPill}
          {hasActiveVisit && (
            <>
              <span className="omrs-chip omrs-chip--active-visit">Active Visit</span>
              <span className="omrs-chip omrs-chip--ontime">On time</span>
            </>
          )}
        </div>
        <div className="omrs-header-meta">
          {patientAgeLabel(patient)} &middot; {formatDobOmrs(patient.dateOfBirth)} &middot; TamamHealth ID: {patientIdDisplay}
        </div>

        {showMore && (
          <div className="omrs-header-more">
            <span>Phone: <strong>{patient.phone || '—'}</strong></span>
            <span>Location: <strong>{patient.state || '—'}{patient.county ? `, ${patient.county}` : ''}</strong></span>
            <button type="button" className="omrs-vitals-link" onClick={onCollectPayment}>
              Balance: <strong style={{ color: patientBalance > 0 ? 'var(--color-danger)' : 'inherit' }}>${patientBalance.toFixed(2)} due</strong>
            </button>
          </div>
        )}
      </div>

      <div className="omrs-header-actions no-print">
        {canViewClinical && (
          <button type="button" className="omrs-header-actions-btn omrs-link" onClick={onStickyNote} title="Open patient notes">
            <DuotoneIcon name="record" size={15} /> Sticky note
          </button>
        )}
        <button type="button" className="omrs-header-actions-btn omrs-link" onClick={() => setShowMore(v => !v)}>
          {showMore ? 'Show less ▲' : 'Show more ▼'}
        </button>
        {canSendMessages && (
          <button type="button" className="omrs-header-actions-btn" onClick={onMessage}><DuotoneIcon name="message" size={15} /> Pt. Msg</button>
        )}
        <button type="button" className="omrs-header-actions-btn" onClick={onPrint}><DuotoneIcon name="printer" size={15} /> Print</button>
        {canViewClinical && (
          <button type="button" className="omrs-header-actions-btn" onClick={onPatientEd}><DuotoneIcon name="fileText" size={15} /> Pt. Ed.</button>
        )}
        {canViewClinical && (
          <button type="button" className="omrs-header-actions-btn" onClick={onNote}><DuotoneIcon name="prescription" size={15} /> + Note</button>
        )}
        {(canPrescribe || canDispense) && (
          <button type="button" className="omrs-header-actions-btn" onClick={onScripts}><DuotoneIcon name="pill" size={15} /> Scripts</button>
        )}
        {(canOrderLabs || canEnterLabResults) && (
          <button type="button" className="omrs-header-actions-btn" onClick={onOrders}><DuotoneIcon name="flask" size={15} /> Orders</button>
        )}
        {canManageReferrals && (
          <button type="button" className="omrs-header-actions-btn" onClick={onExchange}><DuotoneIcon name="arrowRightLeft" size={15} /> Exchange</button>
        )}
        {canRegisterPatients && (
          <button type="button" className="omrs-header-actions-btn" onClick={onEdit}><DuotoneIcon name="edit" size={15} /> Edit</button>
        )}
      </div>
    </div>
  );
}
