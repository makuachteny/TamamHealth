/**
 * PatientCostSection — coverage line + account balance, the facts that
 * actually block a dispense at the pharmacy window in this system (no US
 * insurance/coupon concepts here).
 */
import PatientCostSection from '@/components/clinical-notes/prescribe/PatientCostSection';
import { mount, qa } from './test-utils';
import type { PatientDoc } from '@/lib/db-types';

function patient(payorInfo?: PatientDoc['payorInfo']): PatientDoc {
  return { _id: 'p1', type: 'patient', name: 'Test Patient', payorInfo } as unknown as PatientDoc;
}

describe('PatientCostSection', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows "no coverage recorded" when the patient has no payor info', () => {
    const { container, unmount } = mount(<PatientCostSection patient={patient(undefined)} balance={0} />);
    expect(container.textContent).toContain('No coverage recorded — treated as out-of-pocket.');
    unmount();
  });

  it('shows out-of-pocket coverage', () => {
    const { container, unmount } = mount(
      <PatientCostSection patient={patient({ coverageType: 'out-of-pocket' })} balance={0} />,
    );
    expect(container.textContent).toContain('Out-of-pocket');
    unmount();
  });

  it('shows programme coverage, naming the programme when present', () => {
    const { container, unmount } = mount(
      <PatientCostSection patient={patient({ coverageType: 'program', programEnrollment: 'TB DOTS' })} balance={0} />,
    );
    expect(container.textContent).toContain('Programme: TB DOTS');
    unmount();
  });

  it('falls back to a generic programme line when unnamed', () => {
    const { container, unmount } = mount(
      <PatientCostSection patient={patient({ coverageType: 'program' })} balance={0} />,
    );
    expect(container.textContent).toContain('enrolled (programme not named)');
    unmount();
  });

  it('shows NGO coverage', () => {
    const { container, unmount } = mount(
      <PatientCostSection patient={patient({ coverageType: 'ngo', ngoName: 'MSF' })} balance={0} />,
    );
    expect(container.textContent).toContain('NGO cover: MSF');
    unmount();
  });

  it('shows exemption coverage with its reason', () => {
    const { container, unmount } = mount(
      <PatientCostSection patient={patient({ coverageType: 'exemption', exemptionReason: 'Under 5' })} balance={0} />,
    );
    expect(container.textContent).toContain('Exempt: Under 5');
    unmount();
  });

  it('shows "Checking…" while the balance is still loading (null)', () => {
    const { container, unmount } = mount(<PatientCostSection patient={patient()} balance={null} />);
    expect(qa(container, '.cn-rx-panelbody')[1].textContent).toBe('Checking…');
    unmount();
  });

  it('shows "Nothing outstanding" for a zero or negative balance', () => {
    const { container, unmount } = mount(<PatientCostSection patient={patient()} balance={0} />);
    expect(container.textContent).toContain('Nothing outstanding.');
    unmount();
  });

  it('flags an outstanding balance with the formatted amount', () => {
    const { container, unmount } = mount(<PatientCostSection patient={patient()} balance={4500} />);
    expect(container.textContent).toContain('outstanding — the pharmacy will ask for payment before dispensing.');
    unmount();
  });
});
