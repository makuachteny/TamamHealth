/**
 * The demo chart documents are generated PDFs, so the generator has to produce
 * a file a viewer will actually open: byte offsets in the cross-reference table
 * must line up with the objects they point at, and `startxref` must point at
 * the table. Those are exactly the invariants that break silently when the
 * document text changes, hence a test rather than a one-off manual check.
 */
import { buildSeedPdf, seedPatientDocumentDefs, buildSeedPatientDocument } from '../lib/seed-patient-documents';

/** The PDF is latin1 bytes, not UTF-8 — decode it the way a viewer would. */
function decode(base64: string): string {
  return Buffer.from(base64, 'base64').toString('latin1');
}

describe('buildSeedPdf', () => {
  const { base64, sizeBytes } = buildSeedPdf('Referral letter', ['Line one', 'Line two (with parens)']);
  const raw = decode(base64);

  it('produces a complete PDF envelope', () => {
    expect(raw.startsWith('%PDF-1.4')).toBe(true);
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(sizeBytes).toBe(raw.length);
  });

  it('points every xref entry at its own object', () => {
    const table = raw.slice(raw.lastIndexOf('\nxref\n'));
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
    expect(offsets).toHaveLength(6);
    offsets.forEach((offset, i) => {
      expect(raw.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('points startxref at the xref table', () => {
    const startxref = Number(raw.slice(raw.lastIndexOf('startxref') + 'startxref'.length).trim().split('\n')[0]);
    expect(raw.slice(startxref, startxref + 4)).toBe('xref');
  });

  it('declares the true length of the content stream', () => {
    const declared = Number(/<< \/Length (\d+) >>/.exec(raw)![1]);
    const stream = raw.slice(raw.indexOf('stream\n') + 'stream\n'.length, raw.indexOf('\nendstream'));
    expect(stream).toHaveLength(declared);
  });

  it('escapes PDF text syntax instead of emitting it raw', () => {
    const stream = raw.slice(raw.indexOf('stream\n'), raw.indexOf('\nendstream'));
    expect(stream).toContain('\\(with parens\\)');
  });

  it('keeps the payload ASCII, so offsets stay byte-accurate', () => {
    const { base64: accented } = buildSeedPdf('Résumé — dash', ['Café']);
    const bytes = decode(accented);
    // Each non-ASCII character becomes exactly one '-', so lengths stay stable.
    expect(bytes).toContain('R-sum- - dash');
    expect(bytes).toContain('Caf-');
    expect(bytes.length).toBe(Buffer.byteLength(bytes, 'latin1'));
  });
});

describe('seedPatientDocumentDefs', () => {
  it('has unique ids', () => {
    const ids = seedPatientDocumentDefs.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all three views of the chart Documents section for one patient', () => {
    const forDeng = seedPatientDocumentDefs.filter(d => d.patientId === 'pat-00001');
    expect(forDeng.some(d => d.category === 'referral_letter')).toBe(true);
    expect(forDeng.some(d => d.category === 'patient_education')).toBe(true);
    expect(forDeng.some(d => d.category !== 'referral_letter' && d.category !== 'patient_education')).toBe(true);
  });

  it('builds documents the chart can render and preview', () => {
    for (const def of seedPatientDocumentDefs) {
      const doc = buildSeedPatientDocument(def, '2026-08-01T09:00:00Z', 'org-public');
      expect(doc.type).toBe('patient_document');
      expect(doc.mimeType).toBe('application/pdf');
      expect(doc.fileName).toMatch(/^[a-z0-9-]+\.pdf$/);
      expect(doc.sizeBytes).toBeGreaterThan(400);
      // Under the 5 MB upload ceiling by three orders of magnitude.
      expect(doc.sizeBytes).toBeLessThan(20_000);
      expect(decode(doc.base64Data).startsWith('%PDF')).toBe(true);
    }
  });
});
