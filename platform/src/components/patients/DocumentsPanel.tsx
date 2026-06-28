'use client';

/**
 * Chart documents panel — drop a PDF/photo, categorise it, then browse filed
 * documents with category filter chips and inline preview. The HealthBridge
 * paperless-journey surface (scan the old yellow file, attach radiology, etc.).
 */
import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import FileUpload from '@/components/FileUpload';
import { usePatientDocuments } from '@/lib/hooks/usePatientDocuments';
import type { Attachment } from '@/data/mock';
import type { PatientDoc, PatientDocumentCategory } from '@/lib/db-types';
import { FileText, Image as ImageIcon, X, Eye } from '@/components/icons/lucide';

const CATEGORY_LABELS: Record<PatientDocumentCategory, string> = {
  radiology: 'Radiology',
  lab_report: 'Lab Report',
  referral_letter: 'Referral Letter',
  discharge_summary: 'Discharge Summary',
  consent: 'Consent Form',
  advance_directive: 'Advance Directive',
  legal_document: 'Legal Document',
  treatment_agreement: 'Treatment Agreement',
  insurance: 'Insurance',
  id_document: 'ID Document',
  prescription: 'Prescription',
  scanned_record: 'Scanned Record',
  external_medical_record: 'External Medical Record',
  other: 'Other',
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as PatientDocumentCategory[];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPanel({ patient }: { patient: PatientDoc }) {
  const { currentUser } = useApp();
  const { documents, add, remove } = usePatientDocuments(patient._id);
  const [category, setCategory] = useState<PatientDocumentCategory>('radiology');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<PatientDocumentCategory | 'all'>('all');
  const [preview, setPreview] = useState<{ mimeType: string; base64Data: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const onAdd = async (att: Attachment) => {
    setBusy(true);
    try {
      await add({
        patientId: patient._id,
        title: att.name,
        category,
        fileName: att.name,
        mimeType: att.mimeType,
        base64Data: att.base64Data,
        sizeBytes: att.sizeBytes,
        note: note || undefined,
        uploadedById: currentUser?._id,
        uploadedByName: currentUser?.name || currentUser?.username,
        hospitalId: currentUser?.hospitalId,
        orgId: currentUser?.orgId,
      });
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  // Categories that actually have documents, for the filter chips.
  const presentCategories = useMemo(() => {
    const set = new Set(documents.map(d => d.category));
    return CATEGORY_OPTIONS.filter(c => set.has(c));
  }, [documents]);

  const shown = filter === 'all' ? documents : documents.filter(d => d.category === filter);

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        <h3 className="font-semibold text-sm">Documents</h3>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Scans, films, letters &amp; IDs</span>
      </div>

      {/* Add: pick a category + optional note, then drop / choose / photograph a file */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          File under
          <select value={category} onChange={e => setCategory(e.target.value as PatientDocumentCategory)}
            className="w-full p-2 rounded-md text-[12px] mt-0.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Note (optional)
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Contacted patient, all well"
            className="w-full p-2 rounded-md text-[12px] mt-0.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }} />
        </label>
      </div>
      <FileUpload attachments={[]} onAdd={onAdd} onRemove={() => {}} uploaderName={currentUser?.name || 'Staff'} />
      {busy && <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Saving…</p>}

      {/* Filter chips */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4 mb-2">
          {(['all', ...presentCategories] as const).map(c => {
            const active = filter === c;
            const label = c === 'all' ? `All (${documents.length})` : `${CATEGORY_LABELS[c]} (${documents.filter(d => d.category === c).length})`;
            return (
              <button key={c} type="button" onClick={() => setFilter(c)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                style={{ background: active ? 'var(--accent-primary)' : 'var(--overlay-subtle)', color: active ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filed documents */}
      {documents.length === 0 ? (
        <p className="text-[12px] mt-3" style={{ color: 'var(--text-muted)' }}>No documents filed yet.</p>
      ) : (
        <div className="space-y-2">
          {shown.map(d => {
            const isImage = d.mimeType.startsWith('image/');
            return (
              <div key={d._id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                {isImage ? (
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:${d.mimeType};base64,${d.base64Data}`} alt={d.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{d.title}</span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>{CATEGORY_LABELS[d.category]}</span>
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {formatSize(d.sizeBytes)}{d.uploadedByName ? ` · ${d.uploadedByName}` : ''}{d.note ? ` · ${d.note}` : ''}
                  </div>
                </div>
                <button onClick={() => setPreview({ mimeType: d.mimeType, base64Data: d.base64Data, title: d.title })} className="p-1.5 rounded flex-shrink-0" style={{ background: 'var(--accent-light)' }} title="Preview">
                  <Eye className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                </button>
                <button onClick={() => remove(d._id, currentUser?._id)} className="p-1.5 rounded flex-shrink-0" style={{ background: 'rgba(229,46,66,0.12)' }} title="Remove">
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl max-h-[90vh] rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2">
                {preview.mimeType.startsWith('image/') ? <ImageIcon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} /> : <FileText className="w-4 h-4" style={{ color: 'var(--color-danger)' }} />}
                <span className="text-sm font-medium">{preview.title}</span>
              </div>
              <button onClick={() => setPreview(null)} className="p-1 rounded" style={{ background: 'var(--overlay-subtle)' }}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
              {preview.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:${preview.mimeType};base64,${preview.base64Data}`} alt={preview.title} className="max-w-full h-auto rounded" />
              ) : preview.mimeType === 'application/pdf' ? (
                <iframe src={`data:application/pdf;base64,${preview.base64Data}`} className="w-full rounded" style={{ height: '70vh' }} title={preview.title} />
              ) : (
                <div className="text-center py-12"><FileText className="w-16 h-16 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Preview not available.</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
