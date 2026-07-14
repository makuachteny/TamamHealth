'use client';

/**
 * ChartHeader — the sticky OpenMRS O3-style patient header. Stage 1: visual
 * shell only. The triage badge / pregnancy pill are still owned by the page
 * (they carry their own popup state) and are passed in as rendered nodes so
 * that logic isn't duplicated or destabilized here.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { MoreVertical, MessageSquare, Printer, FileText, ClipboardList, Pill, FlaskConical, ArrowRightLeft } from '@/components/icons/lucide';
import { Icon as DuotoneInfoIcon } from '@/components/icons';
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
  const [showActions, setShowActions] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const initials = patientInitials(patient);
  const photoUrl = (patient as { photoUrl?: string }).photoUrl;
  const genderSymbol = patient.gender === 'Male' ? '♂' : patient.gender === 'Female' ? '♀' : null;
  const genderClass = patient.gender === 'Male' ? 'male' : patient.gender === 'Female' ? 'female' : '';
  const patientIdDisplay = patient.hospitalNumber || patient.geocodeId || '—';

  const runAction = (fn: () => void) => {
    setShowActions(false);
    fn();
  };

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
        <button type="button" className="omrs-header-actions-btn omrs-link" onClick={onStickyNote} title="Open patient notes">
          <FileText className="w-3.5 h-3.5" /> Sticky note
        </button>
        <button type="button" className="omrs-header-actions-btn omrs-link" onClick={() => setShowMore(v => !v)}>
          Show more {showMore ? '▲' : '▼'}
        </button>
        <div style={{ position: 'relative' }}>
          <button type="button" className="omrs-header-actions-btn" onClick={() => setShowActions(v => !v)} aria-haspopup="menu" aria-expanded={showActions}>
            Actions <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {showActions && (
            <>
              <div className="fixed inset-0" style={{ zIndex: 25 }} onClick={() => setShowActions(false)} />
              <div className="omrs-actions-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => runAction(onMessage)}><MessageSquare /> Pt. Msg</button>
                <button type="button" role="menuitem" onClick={() => runAction(onPrint)}><Printer /> Print</button>
                <button type="button" role="menuitem" onClick={() => runAction(onPatientEd)}><FileText /> Pt. Ed.</button>
                <button type="button" role="menuitem" onClick={() => runAction(onNote)}><ClipboardList /> + Note</button>
                <button type="button" role="menuitem" onClick={() => runAction(onScripts)}><Pill /> Scripts</button>
                <button type="button" role="menuitem" onClick={() => runAction(onOrders)}><FlaskConical /> Orders</button>
                <button type="button" role="menuitem" onClick={() => runAction(onExchange)}><ArrowRightLeft /> Exchange</button>
                <button type="button" role="menuitem" onClick={() => runAction(onEdit)}><DuotoneInfoIcon name="edit" size={15} /> Edit</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
