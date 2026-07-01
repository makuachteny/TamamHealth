'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context';
import type { MedicalRecordDoc } from '@/lib/db-types';
import { Lock, Edit3, Plus, CheckCircle2, Clock, X } from '@/components/icons/lucide';
import { formatDateTime } from '@/lib/format-utils';
import { PROVIDER_ROLES, TRAINEE_AUTHOR_ROLES } from '@/lib/clinical-roles';

function statusOf(rec: MedicalRecordDoc): 'draft' | 'awaiting_cosign' | 'signed' | 'amended' {
  return rec.documentStatus ?? 'draft';
}

/**
 * Signature & lock controls for a single clinical document, shown on the
 * patient chart. Mirrors the Centricity "hold vs sign" model: a draft can be
 * signed (and is then locked); a trainee's note routes for co-signature; a
 * signed note can only be corrected via an append-only addendum.
 */
export default function RecordSignatureBar({ record }: { record: MedicalRecordDoc }) {
  const { currentUser } = useApp();
  const [displayRecord, setDisplayRecord] = useState(record);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<null | 'sign' | 'cosign'>(null);
  const [signatureName, setSignatureName] = useState('');
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [addendumText, setAddendumText] = useState('');

  useEffect(() => { setDisplayRecord(record); }, [record]);

  const status = statusOf(displayRecord);
  const role = currentUser?.role;
  const isProvider = !!role && PROVIDER_ROLES.includes(role);
  const isTrainee = !!role && TRAINEE_AUTHOR_ROLES.includes(role);
  const canAuthor = isProvider || isTrainee;

  const signer = {
    userId: currentUser?._id,
    userName: signatureName.trim() || currentUser?.name || currentUser?.username || 'Unknown',
    userRole: role,
  };

  async function run(fn: () => Promise<MedicalRecordDoc | null | unknown>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      if (updated && typeof updated === 'object' && '_id' in updated) {
        setDisplayRecord(updated as MedicalRecordDoc);
      }
      setConfirming(null);
      setSignatureName('');
      setAddendumOpen(false);
      setAddendumText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function doSign() {
    const svc = await import('@/lib/services/medical-record-service');
    // Providers sign as final; trainees sign and route for co-signature.
    return svc.signMedicalRecord(displayRecord._id, signer, { awaitingCosign: isTrainee && !isProvider });
  }
  async function doCosign() {
    const svc = await import('@/lib/services/medical-record-service');
    return svc.cosignMedicalRecord(displayRecord._id, signer);
  }
  async function doAddendum() {
    const svc = await import('@/lib/services/medical-record-service');
    return svc.addAddendum(displayRecord._id, addendumText, signer);
  }

  // ---- Status badge -------------------------------------------------------
  const badge = (() => {
    if (status === 'draft') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>
          <Edit3 className="w-3 h-3" /> Draft · unsigned
        </span>
      );
    }
    if (status === 'awaiting_cosign') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(217,119,6,0.12)', color: '#B45309' }}>
          <Clock className="w-3 h-3" /> Awaiting co-signature
        </span>
      );
    }
    // signed or amended
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
        style={{ background: 'rgba(21,121,92,0.12)', color: 'var(--color-success)' }}>
        <Lock className="w-3 h-3" /> {status === 'amended' ? 'Signed · amended' : 'Signed'}
      </span>
    );
  })();

  const signedMeta = displayRecord.signedAt && (
    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
      Signed by {displayRecord.signedByName} · {formatDateTime(displayRecord.signedAt)}
      {displayRecord.cosignedByName && <> · Co-signed by {displayRecord.cosignedByName}</>}
    </span>
  );

  return (
    <div className="rounded-lg p-2 record-signature-bar" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {badge}
          {signedMeta}
        </div>

        <div className="flex items-center gap-2">
          {/* Sign a draft */}
          {status === 'draft' && canAuthor && confirming !== 'sign' && (
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => { setSignatureName(currentUser?.name || currentUser?.username || ''); setConfirming('sign'); }}>
              <Lock className="w-3.5 h-3.5" /> {isProvider ? 'Sign' : 'Sign & route for co-sign'}
            </button>
          )}
          {status === 'draft' && confirming === 'sign' && (
            <span className="inline-flex items-center gap-2 flex-wrap justify-end">
              <input
                autoFocus
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Type signer name"
                className="record-signature-input"
                aria-label="Signer name"
              />
              <button className="btn btn-sm btn-primary" disabled={busy || !signatureName.trim()} onClick={() => run(doSign)}>Confirm</button>
              <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button>
            </span>
          )}

          {/* Co-sign a trainee note */}
          {status === 'awaiting_cosign' && isProvider && confirming !== 'cosign' && (
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => { setSignatureName(currentUser?.name || currentUser?.username || ''); setConfirming('cosign'); }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Co-sign
            </button>
          )}
          {status === 'awaiting_cosign' && isProvider && confirming === 'cosign' && (
            <span className="inline-flex items-center gap-2 flex-wrap justify-end">
              <input
                autoFocus
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Type co-signer name"
                className="record-signature-input"
                aria-label="Co-signer name"
              />
              <button className="btn btn-sm btn-primary" disabled={busy || !signatureName.trim()} onClick={() => run(doCosign)}>Confirm</button>
              <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button>
            </span>
          )}

          {/* Addendum on a signed/amended note */}
          {(status === 'signed' || status === 'amended') && canAuthor && !addendumOpen && (
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => setAddendumOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Add addendum
            </button>
          )}
        </div>
      </div>

      {/* Addendum composer */}
      {addendumOpen && (
        <div className="mt-3">
          <textarea
            value={addendumText}
            onChange={(e) => setAddendumText(e.target.value)}
            rows={3}
            placeholder="Add a correction or follow-up note. The original signed note stays unchanged."
            className="w-full p-2.5 rounded-lg text-[13px]"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button className="btn btn-sm btn-primary" disabled={busy || addendumText.trim().length === 0} onClick={() => run(doAddendum)}>
              Save addendum
            </button>
            <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => { setAddendumOpen(false); setAddendumText(''); }}>
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing addenda */}
      {(displayRecord.addenda || []).length > 0 && (
        <ul className="mt-3 space-y-2">
          {(displayRecord.addenda || []).map((a, i) => (
            <li key={i} className="rounded-lg p-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Addendum · {a.authorName} · {formatDateTime(a.createdAt)}
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.text}</p>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-[11px]" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
