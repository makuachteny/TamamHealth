'use client';

/**
 * Step 2 — Tests. Two boxes, as on the request form: what is already on the
 * order, and the catalogue to tick from. The catalogue's search lives in the
 * box header rather than above it, so the list below it is the whole box.
 */

import { useMemo, useState } from 'react';
import { X } from '@/components/icons/lucide';
import { useSettings } from '@/lib/settings/SettingsProvider';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { catalogFor, groupBySection, searchCatalog, specimenSummary, toOrderedTest } from '../lab-order-catalog';
import type { LabOrderController } from '../useLabOrderDraft';

export default function TestsStep({ controller }: { controller: LabOrderController }) {
  const { t } = useTranslation();
  const { labCatalog } = useSettings();
  const { draft, toggleTest, removeTest } = controller;
  const [query, setQuery] = useState('');

  const sections = useMemo(
    () => groupBySection(searchCatalog(catalogFor(labCatalog, draft.kind), query)),
    [labCatalog, draft.kind, query],
  );

  const specimens = specimenSummary(draft.tests);
  const selectedNames = new Set(draft.tests.map(test => test.name));
  const imaging = draft.kind === 'imaging';

  return (
    <div>
      <div className="labord-section">
        <div className="labord-section-head">
          <span>{imaging ? t('labOrder.selectedStudies', { count: draft.tests.length }) : t('labOrder.selectedTests', { count: draft.tests.length })}</span>
          {draft.tests.length > 0 && (
            <span className="labord-pick-meta">
              {specimens.map(s => `${s.specimen} ×${s.count}`).join(' · ')}
            </span>
          )}
        </div>
        <div className="labord-section-body" style={{ padding: draft.tests.length ? 0 : 12 }}>
          {draft.tests.length === 0 && <p className="labord-help" style={{ margin: 0 }}>{t('labOrder.noTestsYet')}</p>}
          {draft.tests.map((test, i) => (
            <div key={test.name} className="labord-numbered-row">
              <span className="labord-num">{i + 1}.</span>
              <span className="labord-numbered-body">
                <span className="labord-pick-name">{test.name}</span>
                <span className="labord-check-meta">
                  {test.specimen} · {test.tier === 'basic' ? t('labOrder.tierBasic') : t('labOrder.tierSpecial')}
                  {test.loinc ? ` · LOINC ${test.loinc}` : ''}
                </span>
              </span>
              <button
                type="button"
                className="labord-x"
                onClick={() => removeTest(test.name)}
                aria-label={t('labOrder.removeTest', { name: test.name })}
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="labord-section">
        <div className="labord-section-head">
          <span>{imaging ? t('labOrder.studyCatalog') : t('labOrder.testCatalog')}</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={imaging ? t('labOrder.searchStudies') : t('labOrder.searchTests')}
            aria-label={imaging ? t('labOrder.searchStudies') : t('labOrder.searchTests')}
          />
        </div>
        <div className="labord-section-body">
          {sections.length === 0 && <p className="labord-help" style={{ margin: 0 }}>{t('labOrder.noTestsMatch')}</p>}
          {sections.map(section => (
            <div key={section.section} style={{ marginBottom: 12 }}>
              <span className="labord-field-label">{section.section}</span>
              <div className="labord-check-grid">
                {section.tests.map(entry => {
                  const on = selectedNames.has(entry.name);
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      className={`labord-check${on ? ' labord-check--on' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggleTest(toOrderedTest(entry))}
                    >
                      <input type="checkbox" checked={on} readOnly tabIndex={-1} style={{ pointerEvents: 'none' }} />
                      <span style={{ minWidth: 0 }}>
                        {entry.name}
                        <span className="labord-check-meta">
                          {entry.specimen} · {entry.tier === 'basic' ? t('labOrder.tierBasic') : t('labOrder.tierSpecial')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
