'use client';

/**
 * Medications popup — opened by clicking the Medications section of a note.
 *
 * Left: the working medication list split Active / Discontinued / Not
 * Administered, the "no known medications" attestation, the reconciliation
 * status, and the row actions (Renew / Discontinue / Mark as Error / Cancel
 * Rx). Renewing runs the same interaction check as any new prescription.
 *
 * Right: the patient's network medication history (their prescriptions across
 * facilities in the shared record) behind an explicit consent gate. The gate
 * is real, not decorative: the answer — either way — is written to the
 * patient record with who obtained it and when, because looking at another
 * facility's prescribing without recorded consent is exactly the kind of PHI
 * access an audit asks about.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Plus, X } from '@/components/icons/lucide';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { pharmacyStage, pharmacyStageLabel } from '@/lib/pharmacy-workflow';
import type { PrescriptionStatus } from '@/lib/clinical-flow/order-lifecycles';
import type { PatientDoc, PrescriptionDoc } from '@/lib/db-types';
import './clinical-notes.css';

/** Ordered but never given: held, stockout-referred, or recalled. */
const NOT_ADMINISTERED_STAGES = new Set<PrescriptionStatus>([
  'held_awaiting_clarification', 'stockout_partial_referred', 'dispensing_error_recalled',
]);

type MedTab = 'active' | 'discontinued' | 'not_administered';

const TAB_LABELS: Record<MedTab, string> = {
  active: 'Active',
  discontinued: 'Discontinued',
  not_administered: 'Not Administered',
};

const LIST_HEADINGS: Record<MedTab, string> = {
  active: 'Active Medications',
  discontinued: 'Discontinued Medications',
  not_administered: 'Not Administered',
};

const RECONCILIATION_OPTIONS = [
  'Reconciled with patient',
  'Partially reconciled',
  'Patient unable to confirm',
];

function bucketOf(rx: PrescriptionDoc): MedTab {
  if (rx.status === 'discontinued') return 'discontinued';
  return NOT_ADMINISTERED_STAGES.has(pharmacyStage(rx)) ? 'not_administered' : 'active';
}

interface MedicationsModalProps {
  patientId: string;
  patientName: string;
  currentUser: { _id: string; name?: string; username?: string; orgId?: string } | null;
  onClose: () => void;
}

export default function MedicationsModal({
  patientId, patientName, currentUser, onClose,
}: MedicationsModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const userName = currentUser?.name || currentUser?.username || 'Unknown user';

  const [prescriptions, setPrescriptions] = useState<PrescriptionDoc[]>([]);
  const [patient, setPatient] = useState<PatientDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MedTab>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Consent form state; null = follow whatever the patient record says.
  const [consentDraft, setConsentDraft] = useState<'yes' | 'no' | null>(null);
  const [editingConsent, setEditingConsent] = useState(false);
  // "+ Med List": record a medication the patient reports taking.
  const [showAddMed, setShowAddMed] = useState(false);
  const [addMed, setAddMed] = useState({ medication: '', dose: '', frequency: '' });

  const load = useCallback(async () => {
    const { getPrescriptionsByPatient } = await import('@/lib/services/prescription-service');
    const { getPatientById } = await import('@/lib/services/patient-service');
    const [rx, pt] = await Promise.all([
      getPrescriptionsByPatient(patientId),
      getPatientById(patientId),
    ]);
    rx.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    setPrescriptions(rx);
    setPatient(pt);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<MedTab, number> = { active: 0, discontinued: 0, not_administered: 0 };
    for (const rx of prescriptions) c[bucketOf(rx)] += 1;
    return c;
  }, [prescriptions]);

  const rows = useMemo(
    () => prescriptions.filter(rx => bucketOf(rx) === tab),
    [prescriptions, tab],
  );
  const selected = rows.find(rx => rx._id === selectedId) || null;

  const savePatient = useCallback(async (patch: Partial<PatientDoc>) => {
    const { updatePatient } = await import('@/lib/services/patient-service');
    const updated = await updatePatient(patientId, patch);
    if (updated) setPatient(updated);
    return updated;
  }, [patientId]);

  // ── Row actions ─────────────────────────────────────────────────────────
  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (err) {
      showToast(err instanceof Error ? err.message : 'The change could not be saved.', 'error');
    } finally { setBusy(false); }
  };

  const stopFields = (reason: string) => ({
    status: 'discontinued' as const,
    stoppedAt: new Date().toISOString(),
    stoppedBy: currentUser?._id,
    stoppedByName: userName,
    stoppedSource: 'clinician' as const,
    stoppedReason: reason,
  });

  const handleRenew = () => selected && withBusy(async () => {
    const { createPrescription } = await import('@/lib/services/prescription-service');
    const result = await createPrescription({
      patientId,
      patientName,
      medication: selected.medication,
      dose: selected.dose,
      route: selected.route,
      frequency: selected.frequency,
      duration: selected.duration,
      prescribedBy: userName,
      status: 'pending',
      orderStatus: 'prescribed',
      orgId: currentUser?.orgId,
    } as Omit<PrescriptionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>);
    if (result.interactionWarnings?.hasInteractions) {
      showToast(`Renewed with interaction warning: ${result.interactionWarnings.interactions.map(i => `${i.drug1} ↔ ${i.drug2}`).join(', ')}`, 'error');
    } else {
      showToast(`${selected.medication} renewed.`, 'success');
    }
    await load();
    setSelectedId(null);
  });

  const handleDiscontinue = () => selected && withBusy(async () => {
    const reason = window.prompt('Reason for discontinuing (optional):') ?? '';
    const { updatePrescription } = await import('@/lib/services/prescription-service');
    await updatePrescription(selected._id, stopFields(reason.trim() || 'Discontinued at medications review'));
    showToast(`${selected.medication} discontinued.`, 'success');
    await load();
    setSelectedId(null);
  });

  const handleMarkError = () => selected && withBusy(async () => {
    const { updatePrescription } = await import('@/lib/services/prescription-service');
    await updatePrescription(selected._id, { orderStatus: 'dispensing_error_recalled' });
    showToast(`${selected.medication} marked as a dispensing error.`, 'success');
    await load();
    setSelectedId(null);
  });

  const handleCancelRx = () => selected && withBusy(async () => {
    const { updatePrescription } = await import('@/lib/services/prescription-service');
    await updatePrescription(selected._id, stopFields('Prescription cancelled (ordered in error)'));
    showToast(`${selected.medication} cancelled.`, 'success');
    await load();
    setSelectedId(null);
  });

  const handleAddMed = () => withBusy(async () => {
    if (!addMed.medication.trim() || !addMed.dose.trim() || !addMed.frequency.trim()) {
      showToast('Medication, dose and frequency are required.', 'error');
      return;
    }
    const { createPrescription } = await import('@/lib/services/prescription-service');
    await createPrescription({
      patientId,
      patientName,
      medication: addMed.medication.trim(),
      dose: addMed.dose.trim(),
      route: '',
      frequency: addMed.frequency.trim(),
      duration: '',
      prescribedBy: `${userName} (med list entry)`,
      status: 'pending',
      orderStatus: 'prescribed',
      orgId: currentUser?.orgId,
    } as Omit<PrescriptionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>);
    showToast(`${addMed.medication.trim()} added to the med list.`, 'success');
    setAddMed({ medication: '', dose: '', frequency: '' });
    setShowAddMed(false);
    await load();
  });

  // ── Consent gate ────────────────────────────────────────────────────────
  const consent = patient?.medHistoryConsent;
  const showHistory = consent?.granted === true && !editingConsent;
  const consentAnswer = consentDraft ?? (consent ? (consent.granted ? 'yes' : 'no') : null);

  const handleSaveConsent = () => withBusy(async () => {
    if (!consentAnswer) return;
    await savePatient({
      medHistoryConsent: {
        granted: consentAnswer === 'yes',
        byId: currentUser?._id,
        byName: userName,
        at: new Date().toISOString(),
      },
    });
    setEditingConsent(false);
    setConsentDraft(null);
  });

  const shortDate = (iso?: string) => (iso ? iso.slice(0, 10) : '');

  return (
    <Modal onClose={onClose} width={1120} align="top" labelledBy="cn-meds-title">
      <div className="cn-meds">
        <div className="cn-meds-header">
          <h2 className="cn-meds-title" id="cn-meds-title">Medications</h2>
          <button type="button" className="cn-meds-close" onClick={onClose} aria-label="Close medications">
            <X size={18} />
          </button>
        </div>

        <div className="cn-meds-body">
          {/* ── Working med list ── */}
          <div className="cn-meds-left">
            <div className="cn-meds-controlrow">
              <div className="cn-segmented" aria-label="Medication lists">
                {(Object.keys(TAB_LABELS) as MedTab[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={tab === key}
                    onClick={() => { setTab(key); setSelectedId(null); }}
                  >
                    {TAB_LABELS[key]}{counts[key] > 0 ? ` · ${counts[key]}` : ''}
                  </button>
                ))}
              </div>
              <div className="cn-meds-adders">
                <button
                  type="button"
                  className="cn-btn"
                  onClick={() => router.push(`/patients/${patientId}?tab=prescriptions`)}
                >
                  <Plus size={13} /> Prescription
                </button>
                <button type="button" className="cn-btn" onClick={() => setShowAddMed(v => !v)} aria-expanded={showAddMed}>
                  <Plus size={13} /> Med List
                </button>
              </div>
            </div>

            <label className="cn-meds-nkm">
              <input
                type="checkbox"
                checked={Boolean(patient?.noKnownMedications)}
                disabled={busy || counts.active > 0}
                title={counts.active > 0 ? 'The patient has active medications' : undefined}
                onChange={e => void savePatient({ noKnownMedications: e.target.checked })}
              />
              No known medications
            </label>

            <label className="cn-meds-reconcile">
              <span>Medication reconciliation</span>
              <select
                className="cn-select"
                value={patient?.medReconciliation || ''}
                disabled={busy}
                onChange={e => void savePatient({
                  medReconciliation: e.target.value || undefined,
                  medReconciliationAt: e.target.value ? new Date().toISOString() : undefined,
                })}
              >
                <option value="" />
                {RECONCILIATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {patient?.medReconciliation && patient.medReconciliationAt && (
                <span className="cn-meds-reconcile-at">recorded {shortDate(patient.medReconciliationAt)}</span>
              )}
            </label>

            {showAddMed && (
              <div className="cn-meds-add">
                <input className="cn-input" placeholder="Medication" value={addMed.medication}
                  onChange={e => setAddMed(m => ({ ...m, medication: e.target.value }))} aria-label="Medication name" />
                <input className="cn-input" placeholder="Dose" value={addMed.dose}
                  onChange={e => setAddMed(m => ({ ...m, dose: e.target.value }))} aria-label="Dose" />
                <input className="cn-input" placeholder="Frequency" value={addMed.frequency}
                  onChange={e => setAddMed(m => ({ ...m, frequency: e.target.value }))} aria-label="Frequency" />
                <button type="button" className="cn-btn cn-btn-primary" onClick={handleAddMed} disabled={busy}>Add</button>
              </div>
            )}

            <h3 className="cn-meds-listhead">{LIST_HEADINGS[tab]}</h3>
            <div className="cn-meds-list" role="listbox" aria-label={LIST_HEADINGS[tab]}>
              {loading && <p className="cn-card-empty">Loading medications…</p>}
              {!loading && rows.length === 0 && (
                <p className="cn-card-empty">
                  {tab === 'active' && patient?.noKnownMedications
                    ? 'No known medications recorded for this patient.'
                    : `No ${LIST_HEADINGS[tab].toLowerCase()} for this patient.`}
                </p>
              )}
              {rows.map(rx => (
                <div
                  key={rx._id}
                  role="option"
                  aria-selected={selectedId === rx._id}
                  tabIndex={0}
                  className={`cn-meds-row${selectedId === rx._id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(prev => (prev === rx._id ? null : rx._id))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(prev => (prev === rx._id ? null : rx._id));
                    }
                  }}
                >
                  <div className="cn-meds-row-main">
                    <strong>{rx.medication}</strong>
                    <span>{[rx.dose, rx.route, rx.frequency, rx.duration].filter(Boolean).join(' · ')}</span>
                    <span className="cn-meds-row-meta">
                      {rx.prescribedBy || 'Prescriber not recorded'} · {shortDate(rx.createdAt)}
                      {rx.status === 'discontinued' && rx.stoppedReason ? ` · ${rx.stoppedReason}` : ''}
                    </span>
                  </div>
                  <span className="cn-meds-row-stage">
                    {rx.status === 'discontinued' ? 'Stopped' : pharmacyStageLabel(pharmacyStage(rx))}
                  </span>
                </div>
              ))}
            </div>

            <div className="cn-meds-footer">
              <button type="button" className="cn-btn" onClick={handleRenew} disabled={busy || !selected}>Renew</button>
              <button type="button" className="cn-btn" onClick={handleDiscontinue} disabled={busy || !selected || selected.status === 'discontinued'}>Discontinue</button>
              <button type="button" className="cn-btn" onClick={handleMarkError} disabled={busy || !selected}>Mark as Error</button>
              <button type="button" className="cn-btn" onClick={handleCancelRx} disabled={busy || !selected || selected.status === 'discontinued'}>Cancel Rx</button>
              <button type="button" className="cn-btn" onClick={onClose}>Close</button>
            </div>
          </div>

          {/* ── Network history behind the consent gate ── */}
          <div className="cn-meds-right">
            <h3 className="cn-meds-histhead">
              Med History via TamamHealth Network
              <span title="Prescriptions recorded for this patient across facilities in the shared record."><Info size={14} /></span>
            </h3>

            {!showHistory && (
              <div className="cn-consent-card">
                <h4>Obtain Consent from Patient</h4>
                <p>
                  You can view medication history retrieved from the TamamHealth shared record for
                  this patient. You must obtain consent before viewing this information.
                </p>
                <p>
                  Disclaimer: Certain information may not be available or accurate in this report,
                  including medications the patient asked not to be disclosed, over-the-counter
                  medicines, or records from facilities outside the network. The provider should
                  independently verify medication history with the patient.
                </p>
                <p className="cn-consent-question">
                  I have this patient&rsquo;s consent to view their medication history.
                </p>
                <label className="cn-consent-option">
                  <input
                    type="radio"
                    name="cn-med-consent"
                    checked={consentAnswer === 'yes'}
                    onChange={() => setConsentDraft('yes')}
                  />
                  Yes
                </label>
                <label className="cn-consent-option">
                  <input
                    type="radio"
                    name="cn-med-consent"
                    checked={consentAnswer === 'no'}
                    onChange={() => setConsentDraft('no')}
                  />
                  No
                </label>
                {consent && !consent.granted && !editingConsent && (
                  <p className="cn-consent-note">
                    Consent declined — recorded by {consent.byName || 'staff'} on {shortDate(consent.at)}.
                  </p>
                )}
                <button
                  type="button"
                  className="cn-btn"
                  onClick={handleSaveConsent}
                  disabled={busy || !consentAnswer}
                >
                  Save
                </button>
              </div>
            )}

            {showHistory && (
              <div className="cn-meds-history">
                <p className="cn-consent-note">
                  Consent recorded by {consent?.byName || 'staff'} on {shortDate(consent?.at)}.{' '}
                  <button type="button" className="cn-card-head-action" onClick={() => { setEditingConsent(true); setConsentDraft(null); }}>
                    Change
                  </button>
                </p>
                {prescriptions.length === 0 && (
                  <p className="cn-card-empty">No medication history found in the network record.</p>
                )}
                {prescriptions.map(rx => (
                  <div key={rx._id} className="cn-meds-histrow">
                    <span className="cn-meds-histdate">{shortDate(rx.createdAt)}</span>
                    <span className="cn-meds-histmed">
                      {rx.medication}{rx.dose ? ` ${rx.dose}` : ''}
                      <span className="cn-meds-row-meta"> · {rx.prescribedBy || 'Prescriber not recorded'}</span>
                    </span>
                    <span className="cn-meds-row-stage">
                      {rx.status === 'discontinued' ? 'Stopped' : pharmacyStageLabel(pharmacyStage(rx))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
