/**
 * PharmacyInfoSection — where the prescription goes and dispenser notes.
 */
import { useState } from 'react';
import PharmacyInfoSection from '@/components/clinical-notes/prescribe/PharmacyInfoSection';
import { emptyDraft, type RxDraft } from '@/components/clinical-notes/prescribe/types';
import { mount, setValue, setSelect, q } from './test-utils';

function Harness({ pharmacies, onPatch }: { pharmacies: string[]; onPatch?: (p: Partial<RxDraft>) => void }) {
  const [draft, setDraft] = useState<RxDraft>(() => emptyDraft(pharmacies[0]));
  const [pharmacy, setPharmacy] = useState(pharmacies[0]);
  return (
    <PharmacyInfoSection
      draft={draft}
      onChange={(p) => { setDraft(d => ({ ...d, ...p })); onPatch?.(p); }}
      pharmacies={pharmacies}
      pharmacy={pharmacy}
      onPharmacyChange={setPharmacy}
    />
  );
}

describe('PharmacyInfoSection', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('lists every pharmacy option and reflects the current selection', () => {
    const { container, unmount } = mount(<Harness pharmacies={['Juba Hospital Pharmacy', 'Wau Clinic Pharmacy']} />);
    const select = q<HTMLSelectElement>(container, 'select')!;
    expect(Array.from(select.options).map(o => o.value)).toEqual(['Juba Hospital Pharmacy', 'Wau Clinic Pharmacy']);
    expect(select.value).toBe('Juba Hospital Pharmacy');
    unmount();
  });

  it('changing the pharmacy select calls onPharmacyChange', () => {
    const { container, unmount } = mount(<Harness pharmacies={['A Pharmacy', 'B Pharmacy']} />);
    const select = q<HTMLSelectElement>(container, 'select')!;
    setSelect(select, 'B Pharmacy');
    expect(select.value).toBe('B Pharmacy');
    unmount();
  });

  it('typing pharmacy instructions patches pharmacyNote', () => {
    const onPatch = jest.fn();
    const { container, unmount } = mount(<Harness pharmacies={['A Pharmacy']} onPatch={onPatch} />);
    const input = q<HTMLInputElement>(container, 'input[aria-label="Pharmacy instructions"]')!;
    setValue(input, 'Dispense in blister pack');
    expect(onPatch).toHaveBeenCalledWith({ pharmacyNote: 'Dispense in blister pack' });
    expect(input.value).toBe('Dispense in blister pack');
    unmount();
  });
});
