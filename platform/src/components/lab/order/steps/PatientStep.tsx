'use client';

/**
 * Step 1 — Patient. Confirms who the order is for and who is ordering it.
 * Pre-filled from the Create Order dialog; changeable here without losing the
 * tests and diagnoses already picked.
 */

import LabOrderPatientPicker from '../LabOrderPatientPicker';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { coverageLabel } from '../LabOrderPatientStrip';
import type { LabOrderController } from '../useLabOrderDraft';

export default function PatientStep({
  controller,
  lockPatient = false,
}: {
  controller: LabOrderController;
  lockPatient?: boolean;
}) {
  const { t } = useTranslation();
  const { draft, patch, patient, patients } = controller;

  return (
    <div>
      {/* Locked to a chart, the identity strip above the stepper already names
          the patient — a picker here would only repeat it, unchangeably. */}
      {!lockPatient && (
        <div className="labord-section">
          <div className="labord-section-head">{t('labOrder.patient')}</div>
          <div className="labord-section-body">
            <LabOrderPatientPicker
              patients={patients}
              selectedId={draft.patientId}
              onSelect={patientId => patch({ patientId })}
              autoFocus={!draft.patientId}
            />
            {!draft.patientId && <p className="labord-help">{t('labOrder.patientHelp')}</p>}
          </div>
        </div>
      )}

      <div className="labord-section">
        <div className="labord-section-head">{t('labOrder.orderingDetails')}</div>
        <div className="labord-section-body">
          <div className="labord-grid-2">
            <div>
              <label htmlFor="labord-ordered-by">{t('labOrder.orderingProvider')}</label>
              <input
                id="labord-ordered-by"
                type="text"
                value={draft.orderedByName}
                onChange={e => patch({ orderedByName: e.target.value })}
                placeholder={t('labOrder.orderingProviderPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="labord-processing">{t('labOrder.processing')}</label>
              <select
                id="labord-processing"
                value={draft.processing}
                onChange={e => patch({ processing: e.target.value as typeof draft.processing })}
              >
                <option value="in_house">{t('labOrder.processingInHouse')}</option>
                <option value="send_out">{t('labOrder.processingSendOut')}</option>
              </select>
              <p className="labord-help">{t('labOrder.processingHelp')}</p>
            </div>
          </div>

          {patient && (
            <div style={{ marginTop: 12 }}>
              <span className="labord-field-label">{t('labOrder.fieldCoverage')}</span>
              <span className="labord-field-value">{coverageLabel(patient)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
