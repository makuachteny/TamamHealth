/**
 * DrugMonographPanel — the drug rail. Only facts this platform actually holds
 * (formulary identity, live interaction/allergy warnings, this facility's own
 * inventory) are ever shown; sections with nothing real to say, say so rather
 * than inventing content — that is the defect class this file guards against.
 */
import DrugMonographPanel, { type MonographWarning } from '@/components/clinical-notes/prescribe/DrugMonographPanel';
import type { FormularyDrug } from '@/lib/data/formulary';
import type { PharmacyInventoryDoc } from '@/lib/db-types';
import { mount, click, q, qa } from './test-utils';

const COARTEM: FormularyDrug = { name: 'Artemether-Lumefantrine (Coartem)', category: 'Antimalarial', atc: 'P01BF01', form: 'Tablet' };
const INJECTABLE: FormularyDrug = { name: 'Artesunate (injection)', category: 'Antimalarial', atc: 'P01BE03', form: 'Injection' };

function inventory(overrides: Partial<PharmacyInventoryDoc> = {}): PharmacyInventoryDoc {
  return {
    _id: 'inv1', type: 'pharmacy_inventory', hospitalId: 'h1', hospitalName: 'Juba Hospital',
    medicationName: 'Artemether-Lumefantrine', category: 'Antimalarial',
    stockLevel: 50, unit: 'tablets', reorderLevel: 20, batchNumber: 'B123', expiryDate: '2027-01-01',
    dispensedToday: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as PharmacyInventoryDoc;
}

describe('DrugMonographPanel', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('says to pick a drug rather than rendering an empty shell', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={null} warnings={[]} observations="" inventory={null} currentMedications={[]} />,
    );
    expect(container.textContent).toContain('Pick a drug to see what it means for this patient.');
    unmount();
  });

  it('extracts the brand name from a parenthetical, but not a dosage-form parenthetical', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={null} currentMedications={[]} />,
    );
    expect(q(container, '.cn-rx-drugname')!.textContent).toBe('ARTEMETHER-LUMEFANTRINE');
    expect(container.textContent).toContain('Coartem');
    unmount();
  });

  it('does not mistake a dosage-form parenthetical for a brand name', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={INJECTABLE} warnings={[]} observations="" inventory={null} currentMedications={[]} />,
    );
    expect(container.textContent).toContain('Not recorded in the formulary.');
    unmount();
  });

  it('falls back to "no patient observations available" when there are none', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={null} currentMedications={[]} />,
    );
    expect(container.textContent).toContain('No patient observations available.');
    unmount();
  });

  it('shows real observations when supplied', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="Weight 12 kg — dose weight-based medicines against this." inventory={null} currentMedications={[]} />,
    );
    expect(container.textContent).toContain('Weight 12 kg');
    unmount();
  });

  it('Warnings tab: no warnings says so explicitly rather than an empty list', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={null} currentMedications={[]} />,
    );
    expect(container.textContent).toContain('No interaction or allergy warnings for this patient.');
    // Tab label carries no count when there are none.
    const warningsTab = qa<HTMLButtonElement>(container, '[role="tab"]')[0];
    expect(warningsTab.textContent).toBe('Warnings');
    unmount();
  });

  it('Warnings tab: renders each warning and the count badge, with severity carried as a data attribute', () => {
    const warnings: MonographWarning[] = [
      { severity: 'contraindicated', text: 'CONTRAINDICATED: X ↔ Y — do not combine.' },
      { severity: 'allergy', text: 'ALLERGY: recorded Penicillin allergy.' },
    ];
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={warnings} observations="" inventory={null} currentMedications={['Amoxicillin 500mg']} />,
    );
    const warningsTab = qa<HTMLButtonElement>(container, '[role="tab"]')[0];
    expect(warningsTab.textContent).toBe('Warnings · 2');
    const items = qa(container, '.cn-rx-warnings li[data-severity]');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('data-severity')).toBe('contraindicated');
    expect(container.textContent).toContain('Checked against');
    expect(container.textContent).toContain('Amoxicillin 500mg');
    unmount();
  });

  it('the "checked against" list is capped at 8 current medications', () => {
    const meds = Array.from({ length: 12 }, (_, i) => `Drug ${i}`);
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={null} currentMedications={meds} />,
    );
    expect(qa(container, '.cn-rx-currentmeds li')).toHaveLength(8);
    unmount();
  });

  it('Uses tab: shows class, ATC and form, and never invents indication text', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={null} currentMedications={[]} />,
    );
    click(qa<HTMLButtonElement>(container, '[role="tab"]')[1]);
    expect(container.textContent).toContain('Class: Antimalarial');
    expect(container.textContent).toContain('WHO ATC: P01BF01');
    expect(container.textContent).toContain('Form: Tablet');
    expect(container.textContent).toContain('Indication text is not bundled with this formulary');
    unmount();
  });

  it('Cautions tab: not stocked at this facility when there is no inventory row', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={null} currentMedications={[]} />,
    );
    click(qa<HTMLButtonElement>(container, '[role="tab"]')[2]);
    expect(container.textContent).toContain('Not stocked at this facility — the patient may need an external pharmacy.');
    unmount();
  });

  it('Cautions tab: reports stock level and flags at/below reorder level', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={inventory({ stockLevel: 5, reorderLevel: 20 })} currentMedications={[]} />,
    );
    click(qa<HTMLButtonElement>(container, '[role="tab"]')[2]);
    expect(container.textContent).toContain('Stock at this facility: 5 tablets — at or below reorder level.');
    expect(container.textContent).toContain('expires 2027-01-01');
    unmount();
  });

  it('Cautions tab: does not flag reorder level when stock is healthy', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel drug={COARTEM} warnings={[]} observations="" inventory={inventory({ stockLevel: 100, reorderLevel: 20 })} currentMedications={[]} />,
    );
    click(qa<HTMLButtonElement>(container, '[role="tab"]')[2]);
    expect(container.textContent).toContain('Stock at this facility: 100 tablets.');
    expect(container.textContent).not.toContain('at or below reorder level');
    unmount();
  });

  it('Cautions tab: controlled drugs require register entry and witnessed dispensing', () => {
    const { container, unmount } = mount(
      <DrugMonographPanel
        drug={COARTEM}
        warnings={[]}
        observations=""
        inventory={inventory({ controlledSchedule: 'II', requiresWitness: true })}
        currentMedications={[]}
      />,
    );
    click(qa<HTMLButtonElement>(container, '[role="tab"]')[2]);
    expect(container.textContent).toContain('Controlled drug (schedule II) — register entry required at dispensing.');
    expect(container.textContent).toContain('Dispensing must be witnessed and co-signed.');
    unmount();
  });
});
