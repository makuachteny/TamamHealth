/**
 * Chart-snapshot: the derived-section fetchers and formatters a note pulls its
 * vitals/medications/allergies/problems text from.
 *
 * These tests exist to prove:
 *   - each formatter renders what it's given, and nothing when there's nothing;
 *   - the newest-vitals picker genuinely compares triage against the medical
 *     record rather than always preferring one source;
 *   - a failed read is never mistaken for a confirmed empty list — the defect
 *     this suite was written to catch (see "negative assertions" below).
 */
import {
  formatVitals, formatMedications, formatAllergies, formatProblems,
  snapshotForSection, loadChartSnapshot,
  type ChartSnapshotInput,
} from '@/lib/clinical-notes/chart-snapshot';
import type { AllergyEntry } from '@/lib/types/patient-clinical';
import type { PrescriptionDoc, ProblemDoc, MedicalRecordDoc, TriageDoc } from '@/lib/db-types';

// The fetchers are pulled in with `await import(...)` inside chart-snapshot.ts
// so a failing source doesn't take the whole snapshot down with it. Jest mocks
// intercept the dynamic import the same way it would a static one.
const getPrescriptionsByPatient = jest.fn();
jest.mock('@/lib/services/prescription-service', () => ({
  getPrescriptionsByPatient: (...args: unknown[]) => getPrescriptionsByPatient(...args),
}));

const getActiveAllergies = jest.fn();
jest.mock('@/lib/services/allergy-service', () => ({
  getActiveAllergies: (...args: unknown[]) => getActiveAllergies(...args),
}));

const getProblemsByPatient = jest.fn();
jest.mock('@/lib/services/problem-service', () => ({
  getProblemsByPatient: (...args: unknown[]) => getProblemsByPatient(...args),
}));

const getRecordsByPatient = jest.fn();
jest.mock('@/lib/services/medical-record-service', () => ({
  getRecordsByPatient: (...args: unknown[]) => getRecordsByPatient(...args),
}));

const getTriageByPatient = jest.fn();
jest.mock('@/lib/services/triage-service', () => ({
  getTriageByPatient: (...args: unknown[]) => getTriageByPatient(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Default happy-path: every source resolves to nothing found.
  getPrescriptionsByPatient.mockResolvedValue([]);
  getActiveAllergies.mockResolvedValue([]);
  getProblemsByPatient.mockResolvedValue([]);
  getRecordsByPatient.mockResolvedValue([]);
  getTriageByPatient.mockResolvedValue([]);
});

function prescription(over: Partial<PrescriptionDoc> = {}): PrescriptionDoc {
  return {
    _id: 'rx-1', type: 'prescription', patientId: 'pat-1', patientName: 'Deng Mabior',
    medication: 'Amoxicillin', dose: '500mg', route: 'PO', frequency: 'TID',
    duration: '5 days', prescribedBy: 'u-doc', status: 'pending',
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  } as PrescriptionDoc;
}

function allergy(over: Partial<AllergyEntry> = {}): AllergyEntry {
  return {
    id: 'al-1', substance: 'Penicillin', status: 'active',
    recordedAt: '2026-08-01T00:00:00Z',
    ...over,
  };
}

function problem(over: Partial<ProblemDoc> = {}): ProblemDoc {
  return {
    _id: 'prob-1', type: 'problem', patientId: 'pat-1', name: 'Hypertension',
    status: 'active', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  } as ProblemDoc;
}

// ─────────────────────────────────────────────────────────────────────────
describe('formatVitals', () => {
  test('renders a full set of observations, one per line', () => {
    const text = formatVitals({
      vitalSigns: {
        temperature: 38.1, systolic: 150, diastolic: 90, pulse: 92,
        respiratoryRate: 20, oxygenSaturation: 96, weight: 68, height: 170, bmi: 23.5,
      } as MedicalRecordDoc['vitalSigns'],
    });
    expect(text).toBe(
      'Temp: 38.1 °C\nBP: 150/90 mmHg\nHR: 92 bpm\nRR: 20/min\nSpO₂: 96%\nWt: 68 kg\nHt: 170 cm\nBMI: 23.5',
    );
  });

  test('returns empty string for null', () => {
    expect(formatVitals(null)).toBe('');
  });

  test('falls back to triageVitals when vitalSigns is absent', () => {
    const text = formatVitals({
      triageVitals: { temperature: '39.0', pulse: '110' } as unknown as MedicalRecordDoc['triageVitals'],
    });
    expect(text).toBe('Temp: 39 °C\nHR: 110 bpm');
  });

  test('vitalSigns wins over triageVitals when both are present', () => {
    const text = formatVitals({
      vitalSigns: { pulse: 80 } as MedicalRecordDoc['vitalSigns'],
      triageVitals: { pulse: '999' } as unknown as MedicalRecordDoc['triageVitals'],
    });
    expect(text).toBe('HR: 80 bpm');
  });

  test('BP needs both systolic and diastolic — half a reading is not shown', () => {
    const text = formatVitals({ vitalSigns: { systolic: 120 } as MedicalRecordDoc['vitalSigns'] });
    expect(text).not.toContain('BP');
  });

  test('a zero reading is treated as not-taken, not as a real value of zero', () => {
    // isNum() excludes 0 deliberately — a genuine 0 bpm/°C is not a plausible
    // observation, it means the field was never actually recorded/coerced.
    const text = formatVitals({ vitalSigns: { pulse: 0, temperature: 0 } as MedicalRecordDoc['vitalSigns'] });
    expect(text).toBe('');
  });

  test('an empty record with no vitalSigns or triageVitals produces nothing', () => {
    expect(formatVitals({})).toBe('');
  });
});

describe('formatMedications', () => {
  test('renders one line per active prescription, dose/route/frequency joined', () => {
    const text = formatMedications([prescription()]);
    expect(text).toBe('Amoxicillin · 500mg · PO · TID — 5 days');
  });

  test('omits discontinued prescriptions', () => {
    const text = formatMedications([
      prescription({ _id: 'rx-1', medication: 'Amoxicillin' }),
      prescription({ _id: 'rx-2', medication: 'Ibuprofen', status: 'discontinued' }),
    ]);
    expect(text).toBe('Amoxicillin · 500mg · PO · TID — 5 days');
  });

  test('returns empty string when there are no active prescriptions', () => {
    expect(formatMedications([])).toBe('');
    expect(formatMedications([prescription({ status: 'discontinued' })])).toBe('');
  });

  test('drops a missing field rather than leaving a dangling separator', () => {
    const text = formatMedications([prescription({ route: '', duration: '' })]);
    expect(text).toBe('Amoxicillin · 500mg · TID');
  });
});

describe('formatAllergies', () => {
  test('renders substance, reaction and criticality', () => {
    const text = formatAllergies([allergy({ reaction: 'anaphylaxis', criticality: 'severe' })]);
    expect(text).toBe('• Penicillin — anaphylaxis — severe criticality');
  });

  test('omits an unknown criticality rather than printing the word "unknown"', () => {
    const text = formatAllergies([allergy({ criticality: 'unknown' })]);
    expect(text).toBe('• Penicillin');
  });

  test('excludes inactive/resolved entries', () => {
    const text = formatAllergies([
      allergy({ id: 'a1', substance: 'Penicillin', status: 'active' }),
      allergy({ id: 'a2', substance: 'Latex', status: 'resolved' }),
    ]);
    expect(text).toBe('• Penicillin');
  });

  test('returns empty string for an empty or all-inactive list — it does not invent wording', () => {
    expect(formatAllergies([])).toBe('');
    expect(formatAllergies([allergy({ status: 'inactive' })])).toBe('');
  });
});

describe('formatProblems', () => {
  test('renders active problems with their ICD-11 code', () => {
    const text = formatProblems([problem({ icd11Code: 'BA00' })]);
    expect(text).toBe('• Hypertension [BA00]');
  });

  test('omits the code bracket when there is no code', () => {
    const text = formatProblems([problem({ icd11Code: undefined })]);
    expect(text).toBe('• Hypertension');
  });

  test('excludes resolved problems', () => {
    const text = formatProblems([
      problem({ _id: 'p1', name: 'Hypertension', status: 'active' }),
      problem({ _id: 'p2', name: 'Malaria', status: 'resolved' }),
    ]);
    expect(text).toBe('• Hypertension');
  });

  test('returns empty string when nothing is active', () => {
    expect(formatProblems([])).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('snapshotForSection', () => {
  const empty: ChartSnapshotInput = {};

  test('vitals/medications sections fall through to the formatter, blank when empty', () => {
    expect(snapshotForSection('vitals', empty)).toBe('');
    expect(snapshotForSection('medications', empty)).toBe('');
  });

  test('a narrative section (not derived) yields nothing — it is not this module’s job', () => {
    expect(snapshotForSection('cc', empty)).toBe('');
    expect(snapshotForSection('plan', { allergies: [allergy()] })).toBe('');
  });

  test('allergies renders the formatted list when present', () => {
    const text = snapshotForSection('allergies', { allergies: [allergy()] });
    expect(text).toBe('• Penicillin');
  });

  test('a genuinely empty, successfully-read allergy list gets the "no history documented" sentence', () => {
    const text = snapshotForSection('allergies', { allergies: [], allergiesLoadFailed: false });
    expect(text).toBe('No allergy history has been documented for this patient.');
  });

  test('omitting allergiesLoadFailed entirely (legacy caller) keeps the pre-existing behaviour', () => {
    // A ChartSnapshotInput built by hand (not via loadChartSnapshot) has no
    // opinion on whether the list is real — treat it as a real empty list,
    // same as before this field existed.
    expect(snapshotForSection('allergies', { allergies: [] })).toBe(
      'No allergy history has been documented for this patient.',
    );
  });

  // The defect this suite exists to pin: `safely()` maps "read threw" and
  // "read returned zero rows" onto the identical `[]`, which used to make
  // this function assert a specific negative clinical fact — "no allergy
  // history has been documented" — about a patient whose allergy history we
  // in fact know nothing about because the read failed. That is a fabricated
  // clinical statement, and it would get frozen into a signed note by refresh
  // or prefill. Fixed by tagging failures separately from real empty results.
  test('SNAPSHOT NEGATIVE ASSERTION — a FAILED allergy read must not produce the "no history" sentence', () => {
    const text = snapshotForSection('allergies', { allergies: [], allergiesLoadFailed: true });
    expect(text).not.toBe('No allergy history has been documented for this patient.');
    expect(text).toBe('');
  });

  test('a failed read and a genuine empty read are distinguishable through snapshotForSection', () => {
    const genuinelyEmpty = snapshotForSection('allergies', { allergies: [], allergiesLoadFailed: false });
    const failedRead = snapshotForSection('allergies', { allergies: [], allergiesLoadFailed: true });
    expect(genuinelyEmpty).not.toBe(failedRead);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('loadChartSnapshot', () => {
  test('assembles prescriptions, allergies, problems and vitals from their sources', async () => {
    getPrescriptionsByPatient.mockResolvedValue([prescription()]);
    getActiveAllergies.mockResolvedValue([allergy()]);
    getProblemsByPatient.mockResolvedValue([problem()]);
    getRecordsByPatient.mockResolvedValue([{
      _id: 'rec-1', type: 'medical_record', patientId: 'pat-1',
      consultedAt: '2026-08-01T09:00:00Z',
      vitalSigns: { pulse: 88 },
    } as unknown as MedicalRecordDoc]);

    const snap = await loadChartSnapshot('pat-1');
    expect(snap.prescriptions).toHaveLength(1);
    expect(snap.allergies).toHaveLength(1);
    expect(snap.problems).toHaveLength(1);
    expect(snap.vitalsRecord).toMatchObject({ vitalSigns: { pulse: 88 } });
    expect(snap.allergiesLoadFailed).toBe(false);
  });

  test('one failing source does not blank the others — a missing problem list still yields vitals', async () => {
    getProblemsByPatient.mockRejectedValue(new Error('index unavailable'));
    getRecordsByPatient.mockResolvedValue([{
      _id: 'rec-1', type: 'medical_record', patientId: 'pat-1',
      consultedAt: '2026-08-01T09:00:00Z',
      vitalSigns: { pulse: 88 },
    } as unknown as MedicalRecordDoc]);

    const snap = await loadChartSnapshot('pat-1');
    expect(snap.problems).toEqual([]);
    expect(snap.vitalsRecord).toMatchObject({ vitalSigns: { pulse: 88 } });
  });

  test('a failed allergy read is tagged so the note does not assert a false negative', async () => {
    getActiveAllergies.mockRejectedValue(new Error('couchdb timeout'));

    const snap = await loadChartSnapshot('pat-1');
    expect(snap.allergies).toEqual([]);
    expect(snap.allergiesLoadFailed).toBe(true);
    // And the end-to-end effect: the section text must not lie about it.
    expect(snapshotForSection('allergies', snap)).toBe('');
  });

  test('a successful read of a genuinely empty allergy list is NOT tagged as failed', async () => {
    getActiveAllergies.mockResolvedValue([]);

    const snap = await loadChartSnapshot('pat-1');
    expect(snap.allergiesLoadFailed).toBe(false);
    expect(snapshotForSection('allergies', snap)).toBe(
      'No allergy history has been documented for this patient.',
    );
  });

  test('passes the DataScope through to the tenant-boundary-sensitive reads', async () => {
    const scope = { role: 'nurse' as const, orgId: 'org-1', hospitalId: 'hosp-1' };
    await loadChartSnapshot('pat-1', scope);
    expect(getPrescriptionsByPatient).toHaveBeenCalledWith('pat-1', scope);
    expect(getRecordsByPatient).toHaveBeenCalledWith('pat-1', scope);
    expect(getTriageByPatient).toHaveBeenCalledWith('pat-1', scope);
  });

  // ── newest-vitals: triage vs. medical record ──────────────────────────
  describe('newest vitals picks whichever source is actually more recent', () => {
    function triage(over: Partial<TriageDoc> = {}): TriageDoc {
      return {
        _id: 'triage-1', type: 'triage', patientId: 'pat-1', patientName: 'Deng Mabior',
        airway: 'clear', breathing: 'normal', circulation: 'normal', consciousness: 'alert',
        priority: 'green', triagedAt: '2026-08-01T08:00:00Z',
        temperature: '38.5', pulse: '100',
        createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-01T08:00:00Z',
        ...over,
      } as unknown as TriageDoc;
    }
    function record(over: Partial<MedicalRecordDoc> = {}): MedicalRecordDoc {
      return {
        _id: 'rec-1', type: 'medical_record', patientId: 'pat-1',
        consultedAt: '2026-08-01T08:00:00Z',
        vitalSigns: { pulse: 70 },
        ...over,
      } as unknown as MedicalRecordDoc;
    }

    test('a triage stop newer than any medical record wins, and its vitals populate triageVitals', async () => {
      getTriageByPatient.mockResolvedValue([triage({ triagedAt: '2026-08-04T10:00:00Z', pulse: '120' })]);
      getRecordsByPatient.mockResolvedValue([record({ consultedAt: '2026-08-01T08:00:00Z' })]);

      const snap = await loadChartSnapshot('pat-1');
      expect(snap.vitalsRecord?.triageVitals).toBeDefined();
      expect(snap.vitalsRecord?.triageVitals?.pulse).toBe('120');
      expect(snap.vitalsRecord?.vitalSigns).toBeUndefined();
    });

    test('a medical record newer than the last triage stop wins, and its vitalSigns are used directly', async () => {
      getTriageByPatient.mockResolvedValue([triage({ triagedAt: '2026-08-01T08:00:00Z', pulse: '100' })]);
      getRecordsByPatient.mockResolvedValue([record({ consultedAt: '2026-08-04T10:00:00Z', vitalSigns: { pulse: 70 } as MedicalRecordDoc['vitalSigns'] })]);

      const snap = await loadChartSnapshot('pat-1');
      expect(snap.vitalsRecord?.vitalSigns).toEqual({ pulse: 70 });
      expect(snap.vitalsRecord?.triageVitals).toBeUndefined();
    });

    test('triage with no vitals-bearing fields is not picked, even if it is the newest triage row', async () => {
      getTriageByPatient.mockResolvedValue([
        // Newest by timestamp, but no vitals fields at all — must be skipped.
        triage({ triagedAt: '2026-08-05T00:00:00Z', temperature: undefined, pulse: undefined }),
        triage({ triagedAt: '2026-08-01T00:00:00Z', pulse: '90' }),
      ]);
      getRecordsByPatient.mockResolvedValue([]);

      const snap = await loadChartSnapshot('pat-1');
      expect(snap.vitalsRecord?.triageVitals?.pulse).toBe('90');
    });

    test('a medical record with neither vitalSigns nor triageVitals is skipped in favour of an older one that has them', async () => {
      getTriageByPatient.mockResolvedValue([]);
      getRecordsByPatient.mockResolvedValue([
        record({ _id: 'rec-2', consultedAt: '2026-08-05T00:00:00Z', vitalSigns: undefined }),
        record({ _id: 'rec-1', consultedAt: '2026-08-01T00:00:00Z', vitalSigns: { pulse: 70 } as MedicalRecordDoc['vitalSigns'] }),
      ]);

      const snap = await loadChartSnapshot('pat-1');
      expect(snap.vitalsRecord?.vitalSigns).toEqual({ pulse: 70 });
    });

    test('no vitals anywhere yields null, not a throw', async () => {
      getTriageByPatient.mockResolvedValue([]);
      getRecordsByPatient.mockResolvedValue([]);
      const snap = await loadChartSnapshot('pat-1');
      expect(snap.vitalsRecord).toBeNull();
    });

    test('both sources failing to read yields null rather than propagating the error', async () => {
      getTriageByPatient.mockRejectedValue(new Error('down'));
      getRecordsByPatient.mockRejectedValue(new Error('down'));
      const snap = await loadChartSnapshot('pat-1');
      expect(snap.vitalsRecord).toBeNull();
    });
  });
});
