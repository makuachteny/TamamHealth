import { hasPersonalFeed, isOwnedByViewer, isForViewer } from '@/lib/notification-scope';

const doctor = { _id: 'u-1', name: 'Dr. Peter Garang Deng', role: 'doctor' };
const otherDoctor = { _id: 'u-2', name: 'Dr. Mary Aluel', role: 'doctor' };
const frontDesk = { _id: 'u-3', name: 'Stella Keji', role: 'front_desk' };

describe('hasPersonalFeed', () => {
  it('gives a narrowed feed to roles that carry their own panel', () => {
    expect(hasPersonalFeed('doctor')).toBe(true);
    expect(hasPersonalFeed('clinical_officer')).toBe(true);
    expect(hasPersonalFeed('clinician')).toBe(true);
  });

  it('leaves floor-wide roles on the facility feed', () => {
    // Their job IS everyone — a triage nurse who only saw "her" patients would
    // be looking at an empty waiting room.
    for (const role of ['front_desk', 'nurse', 'triage_nurse', 'lab_tech', 'pharmacist']) {
      expect(hasPersonalFeed(role)).toBe(false);
    }
    expect(hasPersonalFeed(undefined)).toBe(false);
  });
});

describe('isOwnedByViewer', () => {
  it('matches on id when the record stores one', () => {
    expect(isOwnedByViewer({ ownerId: 'u-1' }, doctor)).toBe(true);
    expect(isOwnedByViewer({ ownerId: 'u-2' }, doctor)).toBe(false);
  });

  it('falls back to the name for records that only store one', () => {
    expect(isOwnedByViewer({ ownerName: 'Dr. Peter Garang Deng' }, doctor)).toBe(true);
    expect(isOwnedByViewer({ ownerName: 'Dr. Mary Aluel' }, doctor)).toBe(false);
  });

  it('forgives the casing and padding free-text names arrive with', () => {
    expect(isOwnedByViewer({ ownerName: '  dr. peter garang deng ' }, doctor)).toBe(true);
  });

  it('claims nothing when the record names nobody', () => {
    expect(isOwnedByViewer({}, doctor)).toBe(false);
    expect(isOwnedByViewer({ ownerId: 'u-1' }, null)).toBe(false);
  });
});

describe('isForViewer', () => {
  it('passes everything through for a floor-wide role', () => {
    expect(isForViewer({ ownerId: 'u-1', severity: 'info' }, frontDesk)).toBe(true);
  });

  it('keeps a clinician to their own routine work', () => {
    expect(isForViewer({ ownerId: 'u-1', severity: 'info' }, doctor)).toBe(true);
    expect(isForViewer({ ownerId: 'u-2', severity: 'info' }, doctor)).toBe(false);
    expect(isForViewer({ ownerId: 'u-2', severity: 'warning' }, doctor)).toBe(false);
  });

  it('never withholds a critical row, whoever it belongs to', () => {
    // The cost of showing it to the wrong doctor is a moment's attention; the
    // cost of hiding it from the right one is a patient.
    expect(isForViewer({ ownerId: 'u-2', severity: 'critical' }, doctor)).toBe(true);
    expect(isForViewer({ severity: 'critical' }, otherDoctor)).toBe(true);
  });

  it('drops an unowned routine row from a clinician\'s feed', () => {
    expect(isForViewer({ severity: 'info' }, doctor)).toBe(false);
  });
});
