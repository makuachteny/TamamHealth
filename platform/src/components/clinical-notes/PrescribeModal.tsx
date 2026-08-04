'use client';

/**
 * "Prescribe Medications" — the prescription-writing popup from the reference,
 * adapted to this platform's formulary and pharmacy:
 *
 *   · Drug Info: Drug Name* typeahead over the formulary (inline result list),
 *     Quantity* / Refill / Days Supply / Effective On, Allow Substitution.
 *   · Service Location, Reason For Rx (picked from the patient's active
 *     problems, shown as "code · name"), Patient Instructions* with
 *     Recommended Sigs, Add To Favorites.
 *   · Pharmacy Info: the facility pharmacy plus free-text instructions.
 *   · Right rail: the drug panel — live interaction + allergy warnings from
 *     the platform's own checkers (the reference shows a monograph; the
 *     warnings here are computed against this patient, which is worth more).
 *   · Footer: Cancel · Print · Add Rx · Send Medication. Add Rx writes the
 *     prescription and keeps the form open for the next one; Send Medication
 *     writes it straight into the pharmacy queue and closes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from '@/components/icons/lucide';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { medications as FORMULARY_MEDICATIONS } from '@/lib/data/formulary';
import type { PatientDoc, PrescriptionDoc, ProblemDoc } from '@/lib/db-types';
import './clinical-notes.css';

const RECOMMENDED_SIGS = [
  'Once daily',
  'Twice daily with food',
  'Three times daily after meals',
  'Every 8 hours until finished',
  'At bedtime',
  'As needed for pain, up to three times daily',
];

/** Strength fragment from a formulary name, for the stored dose. */
function doseFrom(name: string): string {
  const m = name.match(/\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|%|iu)(?:\/\S+)?/i);
  return m ? m[0] : 'As directed';
}

interface PrescribeModalProps {
  patientId: string;
  patientName: string;
  currentUser: { _id: string; name?: string; username?: string; orgId?: string; hospitalId?: string; hospitalName?: string } | null;
  onClose: () => void;
  /** Called after any prescription is written, so the host can refresh. */
  onPrescribed?: () => void;
}

export default function PrescribeModal({
  patientId, patientName, currentUser, onClose, onPrescribed,
}: PrescribeModalProps) {
  const { showToast } = useToast();
  const userName = currentUser?.name || currentUser?.username || 'Unknown user';
  const pharmacyName = `${currentUser?.hospitalName || 'Facility'} Pharmacy`;

  const [patient, setPatient] = useState<PatientDoc | null>(null);
  const [problems, setProblems] = useState<ProblemDoc[]>([]);
  const [activeRx, setActiveRx] = useState<PrescriptionDoc[]>([]);
  const [busy, setBusy] = useState(false);

  const [drugQuery, setDrugQuery] = useState('');
  const [drug, setDrug] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [refills, setRefills] = useState('0');
  const [daysSupply, setDaysSupply] = useState('');
  const [effectiveOn, setEffectiveOn] = useState(new Date().toISOString().slice(0, 10));
  const [allowSub, setAllowSub] = useState(true);
  const [showReasonPick, setShowReasonPick] = useState(false);
  const [reason, setReason] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showSigs, setShowSigs] = useState(true);
  const [pharmacyNote, setPharmacyNote] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getPatientById } = await import('@/lib/services/patient-service');
        const pt = await getPatientById(patientId);
        if (!cancelled) setPatient(pt);
      } catch { /* warnings simply have less to check against */ }
      try {
        const { getProblemsByPatient } = await import('@/lib/services/problem-service');
        const rows = await getProblemsByPatient(patientId);
        if (!cancelled) setProblems(rows.filter(p => p.status === 'active' || p.status === 'chronic'));
      } catch { /* reason picker shows empty */ }
      try {
        const { getPrescriptionsByPatient } = await import('@/lib/services/prescription-service');
        const rx = await getPrescriptionsByPatient(patientId);
        if (!cancelled) setActiveRx(rx.filter(r => r.status !== 'discontinued'));
      } catch { /* interaction check runs at save regardless */ }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const results = useMemo(() => {
    const q = drugQuery.trim().toLowerCase();
    if (q.length < 2 || drug) return [];
    return FORMULARY_MEDICATIONS
      .filter(m => m.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [drugQuery, drug]);

  // Live warnings for the picked drug: interactions against current meds and a
  // straight substring check against the patient's recorded allergies.
  useEffect(() => {
    let cancelled = false;
    if (!drug) { setWarnings([]); return; }
    (async () => {
      const found: string[] = [];
      try {
        const { checkNewPrescription } = await import('@/lib/services/drug-interaction-service');
        const result = checkNewPrescription(drug, activeRx.map(r => r.medication));
        for (const i of result.interactions) {
          found.push(`${i.severity.toUpperCase()}: ${i.drug1} ↔ ${i.drug2}${i.description ? ` — ${i.description}` : ''}`);
        }
      } catch { /* interaction data unavailable */ }
      const allergies = (patient?.structuredAllergies || [])
        .filter(a => a.status === 'active')
        .filter(a => drug.toLowerCase().includes(a.substance.split(' ')[0].toLowerCase()));
      for (const a of allergies) {
        found.push(`ALLERGY: patient has a recorded ${a.substance} allergy${a.reaction ? ` (${a.reaction})` : ''}`);
      }
      if (!cancelled) setWarnings(found);
    })();
    return () => { cancelled = true; };
  }, [drug, activeRx, patient]);

  const write = useCallback(async (send: boolean) => {
    if (!drug) { showToast('Pick the drug first.', 'error'); return null; }
    if (!instructions.trim()) { showToast('Patient instructions are required.', 'error'); return null; }
    setBusy(true);
    try {
      const { createPrescription } = await import('@/lib/services/prescription-service');
      const result = await createPrescription({
        patientId,
        patientName,
        medication: drug,
        dose: doseFrom(drug),
        route: '',
        frequency: instructions.trim(),
        duration: daysSupply ? `${daysSupply} days` : '',
        prescribedBy: userName,
        status: 'pending',
        orderStatus: send ? 'received_in_pharmacy_queue' : 'prescribed',
        quantityToDispense: Math.max(1, parseInt(quantity, 10) || 1),
        indication: reason || undefined,
        allowSubstitution: allowSub,
        refills: parseInt(refills, 10) || 0,
        effectiveOn,
        pharmacyInstructions: pharmacyNote.trim() || undefined,
        hospitalId: currentUser?.hospitalId,
        orgId: currentUser?.orgId,
      } as Omit<PrescriptionDoc, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>);
      if (result.interactionWarnings?.hasInteractions) {
        showToast(`Written with interaction warning: ${result.interactionWarnings.interactions.map(i => `${i.drug1} ↔ ${i.drug2}`).join(', ')}`, 'error');
      }
      onPrescribed?.();
      return result.prescription;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not write the prescription.', 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [drug, instructions, patientId, patientName, userName, daysSupply, quantity, reason, allowSub, refills, effectiveOn, pharmacyNote, currentUser, onPrescribed, showToast]);

  const resetDrug = () => {
    setDrug(null); setDrugQuery(''); setQuantity('1'); setRefills('0');
    setDaysSupply(''); setInstructions(''); setReason(''); setPharmacyNote('');
  };

  const handleAddRx = async () => {
    const rx = await write(false);
    if (rx) { showToast(`${rx.medication} added.`, 'success'); resetDrug(); }
  };

  const handleSend = async () => {
    const rx = await write(true);
    if (rx) { showToast(`${rx.medication} sent to ${pharmacyName}.`, 'success'); onClose(); }
  };

  return (
    <Modal onClose={onClose} width={1120} align="top" labelledBy="cn-rx-title">
      <div className="cn-meds">
        <div className="cn-meds-header">
          <h2 className="cn-meds-title" id="cn-rx-title">Prescribe Medications</h2>
          <button type="button" className="cn-meds-close" onClick={onClose} aria-label="Close prescribe medications">
            <X size={18} />
          </button>
        </div>

        <div className="cn-meds-body">
          <div className="cn-meds-left">
            {/* ── Drug Info ── */}
            <h3 className="cn-rx-sectionhead">Drug Info</h3>
            <div className="cn-rx-grid">
              <label className="cn-rx-field cn-rx-field--wide">
                <span>Drug Name *</span>
                <input
                  className="cn-input"
                  placeholder="Search the formulary…"
                  value={drug ?? drugQuery}
                  onChange={e => { setDrug(null); setDrugQuery(e.target.value); }}
                  aria-label="Drug name"
                />
                {results.length > 0 && (
                  <div className="cn-inc-results cn-rx-results">
                    {results.map(m => (
                      <button key={m.name} type="button" onClick={() => { setDrug(m.name); setDrugQuery(''); }}>
                        <span>{m.name}</span>
                        <span className="cn-meds-row-meta">{m.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label className="cn-rx-field">
                <span>Quantity *</span>
                <input className="cn-input" type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} aria-label="Quantity" />
              </label>
              <label className="cn-rx-field">
                <span>Refill</span>
                <input className="cn-input" type="number" min={0} value={refills} onChange={e => setRefills(e.target.value)} aria-label="Refills" />
              </label>
              <label className="cn-rx-field">
                <span>Days Supply</span>
                <input className="cn-input" type="number" min={0} value={daysSupply} onChange={e => setDaysSupply(e.target.value)} aria-label="Days supply" />
              </label>
              <label className="cn-rx-field">
                <span>Effective On</span>
                <input className="cn-input" type="date" value={effectiveOn} onChange={e => setEffectiveOn(e.target.value)} aria-label="Effective on" />
              </label>
            </div>

            <label className="cn-meds-nkm">
              <input type="checkbox" checked={allowSub} onChange={e => setAllowSub(e.target.checked)} />
              Allow Substitution
            </label>

            <div className="cn-rx-grid">
              <label className="cn-rx-field cn-rx-field--wide">
                <span>Service Location</span>
                <select className="cn-select" aria-label="Service location" defaultValue={currentUser?.hospitalName || ''}>
                  <option>{currentUser?.hospitalName || 'This facility'}</option>
                </select>
              </label>
              <div className="cn-rx-field cn-rx-field--wide">
                <span>Reason For Rx</span>
                <div className="cn-rx-reason">
                  {reason ? <span className="cn-rx-reason-chip">{reason}</span> : <span className="cn-meds-row-meta">None recorded</span>}
                  <button type="button" className="cn-card-head-action" onClick={() => setShowReasonPick(v => !v)} aria-expanded={showReasonPick}>
                    Add Reason
                  </button>
                </div>
                {showReasonPick && (
                  <div className="cn-inc-results cn-rx-results">
                    {problems.length === 0 && <p className="cn-consent-note" style={{ padding: '8px 10px' }}>No active problems to cite.</p>}
                    {problems.map(p => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => { setReason(`${p.icd11Code ? `${p.icd11Code} · ` : ''}${p.name}`); setShowReasonPick(false); }}
                      >
                        {p.icd11Code && <span className="cn-inc-code">{p.icd11Code}</span>}
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <label className="cn-rx-field cn-rx-field--wide">
              <span>Patient Instructions *</span>
              <textarea
                className="cn-textarea cn-rx-instructions"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="e.g. 2 sprays daily; administer into each nostril"
                aria-label="Patient instructions"
              />
            </label>

            <button
              type="button"
              className="cn-card-head-action cn-inc-details-toggle"
              onClick={() => setShowSigs(v => !v)}
              aria-expanded={showSigs}
            >
              Recommended Sigs {showSigs ? '▾' : '▸'}
            </button>
            {showSigs && (
              <ul className="cn-rx-sigs">
                {RECOMMENDED_SIGS.map(sig => (
                  <li key={sig}>
                    <button type="button" onClick={() => setInstructions(sig)}>• {sig}</button>
                  </li>
                ))}
              </ul>
            )}

            {/* ── Pharmacy Info ── */}
            <h3 className="cn-rx-sectionhead">Pharmacy Info</h3>
            <div className="cn-rx-grid">
              <label className="cn-rx-field cn-rx-field--wide">
                <span>Pharmacy *</span>
                <select className="cn-select" aria-label="Pharmacy" defaultValue={pharmacyName}>
                  <option>{pharmacyName}</option>
                </select>
              </label>
              <label className="cn-rx-field cn-rx-field--wide">
                <span>Pharmacy Instructions</span>
                <input
                  className="cn-input"
                  value={pharmacyNote}
                  onChange={e => setPharmacyNote(e.target.value)}
                  placeholder="Note to the dispensing pharmacist…"
                  aria-label="Pharmacy instructions"
                />
              </label>
            </div>

            <div className="cn-meds-footer">
              <button type="button" className="cn-btn" onClick={onClose}>Cancel</button>
              <button type="button" className="cn-btn" onClick={() => window.print()}>Print</button>
              <button type="button" className="cn-btn" onClick={handleAddRx} disabled={busy}>Add Rx</button>
              <button type="button" className="cn-btn cn-btn-primary" onClick={handleSend} disabled={busy}>Send Medication</button>
            </div>
          </div>

          {/* ── Drug panel: live warnings for THIS patient ── */}
          <div className="cn-meds-right">
            {drug ? (
              <>
                <h3 className="cn-rx-drugname">{drug.toUpperCase()}</h3>
                <h4 className="cn-rx-panelhead">Warnings</h4>
                {warnings.length === 0 && (
                  <p className="cn-consent-note">
                    No interaction or allergy warnings found for this patient.
                  </p>
                )}
                <ul className="cn-rx-warnings">
                  {warnings.map(w => <li key={w}>{w}</li>)}
                </ul>
                <h4 className="cn-rx-panelhead">Current medications</h4>
                {activeRx.length === 0 && <p className="cn-consent-note">No active medications on file.</p>}
                <ul className="cn-rx-warnings cn-rx-currentmeds">
                  {activeRx.slice(0, 8).map(r => <li key={r._id}>{r.medication} · {r.dose}</li>)}
                </ul>
              </>
            ) : (
              <p className="cn-card-empty">Pick a drug to see warnings for this patient.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
