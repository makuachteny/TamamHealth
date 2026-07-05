'use client';

/**
 * Admin → Conflict Reconciliation queue.
 * Shows PouchDB revision conflicts that were flagged as high/medium risk.
 * Admins pick a winning rev or dismiss the conflict.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ConflictQueueDoc } from '@/lib/db-types';
import { useApp } from '@/lib/context';
import { apiFetch } from '@/lib/api-fetch';
import { useToast } from '@/components/Toast';
import { CONFLICT_RESOLUTION_ROLES } from '@/lib/permissions';
import { useTranslation } from '@/lib/i18n/useTranslation';

const RISK_STYLES: Record<ConflictQueueDoc['risk'], { bg: string; fg: string; border: string; label: string }> = {
  high:   { bg: 'rgba(229,46,66,0.08)',  fg: '#C44536', border: 'rgba(229,46,66,0.25)', label: 'HIGH' },
  medium: { bg: 'rgba(228,168,75,0.12)', fg: '#8A5C0F', border: 'rgba(228,168,75,0.35)', label: 'MEDIUM' },
  low:    { bg: 'rgba(33,145,208,0.08)', fg: '#015697', border: 'rgba(33,145,208,0.25)', label: 'LOW' },
};

export default function ConflictsPage() {
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [conflicts, setConflicts] = useState<ConflictQueueDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'resolved' | 'dismissed'>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/conflicts?status=${filterStatus}`);
      if (res.ok) {
        const data = await res.json();
        setConflicts(data.conflicts || []);
      } else {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || t('conflicts.errorLoadFailedHttp', { status: res.status });
        setConflicts([]);
        setErrorMsg(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('syncConflicts.errorLoadFailed');
      setConflicts([]);
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, showToast, t]);

  useEffect(() => { loadConflicts(); }, [loadConflicts]);

  // We keep window.prompt for the note input — replacing it requires a real
  // modal dialog which is out of scope for this pass. The user-facing wins
  // here are surfacing success/failure as toasts instead of alert(), which
  // also makes failures non-blocking and accessible.
  const handleResolve = async (id: string, chosenRev: string) => {
    const note = window.prompt(t('conflicts.promptResolutionNote'));
    if (note === null) return;
    try {
      const res = await apiFetch(`/api/admin/conflicts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', chosenRev, note: note || undefined }),
      });
      if (res.ok) {
        showToast(t('conflicts.toastResolved'), 'success');
        await loadConflicts();
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(body?.error || t('conflicts.toastResolveFailed'), 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('conflicts.toastResolveFailed'), 'error');
    }
  };

  const handleDismiss = async (id: string) => {
    if (!window.confirm(t('conflicts.confirmDismiss'))) return;
    const note = window.prompt(t('conflicts.promptDismissReason'));
    try {
      const res = await apiFetch(`/api/admin/conflicts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', note: note || undefined }),
      });
      if (res.ok) {
        showToast(t('conflicts.toastDismissed'), 'success');
        await loadConflicts();
      } else {
        const body = await res.json().catch(() => ({}));
        showToast(body?.error || t('conflicts.toastDismissFailed'), 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('conflicts.toastDismissFailed'), 'error');
    }
  };

  const allowed = !!currentUser && CONFLICT_RESOLUTION_ROLES.includes(currentUser.role);

  if (!allowed) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t('conflicts.title')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{t('conflicts.accessRestricted')}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 6px' }}>{t('conflicts.eyebrow')}</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>{t('conflicts.title')}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            {t('conflicts.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['pending', 'resolved', 'dismissed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: `1.5px solid ${filterStatus === s ? 'var(--accent-primary, #2191D0)' : 'var(--border-medium)'}`,
                background: filterStatus === s ? 'var(--accent-primary, #2191D0)' : 'transparent',
                color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}>
              {t(`conflicts.status_${s}`)}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 8,
            background: 'rgba(229,46,66,0.08)',
            border: '1px solid rgba(229,46,66,0.25)',
            color: '#C44536',
            fontSize: 13,
          }}>
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>{t('syncConflicts.loading')}</div>
      ) : conflicts.length === 0 ? (
        <div style={{
          padding: 48, textAlign: 'center',
          background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', borderRadius: 10,
          color: 'var(--text-muted)',
        }}>
          {t('conflicts.emptyState', { status: t(`conflicts.status_${filterStatus}`) })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {conflicts.map((c) => {
            const risk = RISK_STYLES[c.risk];
            return (
              <div key={c._id} style={{
                background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', borderRadius: 10, padding: 18,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                        padding: '3px 10px', borderRadius: 999,
                        background: risk.bg, color: risk.fg, border: `1px solid ${risk.border}`,
                      }}>{t(`conflicts.risk_${c.risk}`)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.resourceType}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-platform-mono)' }}>
                        {c.resourceId}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {t('conflicts.defaultWinner')} <span style={{ fontFamily: 'var(--font-platform-mono)', color: 'var(--text-primary)' }}>{c.winningRev}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('conflicts.losingRevisions')} {c.losingRevs.map((r) => (
                        <span key={r} style={{ fontFamily: 'var(--font-platform-mono)', color: 'var(--text-primary)', marginRight: 8 }}>{r}</span>
                      ))}
                    </div>
                    {c.status !== 'pending' && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        {t('conflicts.resolvedBy', {
                          action: c.status === 'resolved' ? t('conflicts.actionResolved') : t('conflicts.actionDismissed'),
                          user: c.resolvedBy || t('syncConflicts.unknownUser'),
                          date: c.resolvedAt?.slice(0, 16).replace('T', ' ') ?? '',
                        })}
                        {c.resolvedRev && <> → {t('conflicts.kept')} <span style={{ fontFamily: 'var(--font-platform-mono)' }}>{c.resolvedRev}</span></>}
                        {c.resolutionNote && <> — “{c.resolutionNote}”</>}
                      </div>
                    )}
                  </div>
                  {c.status === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleResolve(c._id, c.winningRev)}
                        style={{
                          padding: '6px 14px', borderRadius: 6,
                          background: 'var(--accent-primary, #2191D0)', color: '#fff',
                          border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>
                        {t('conflicts.keepWinner')}
                      </button>
                      {c.losingRevs.map((rev) => (
                        <button
                          key={rev}
                          type="button"
                          onClick={() => handleResolve(c._id, rev)}
                          style={{
                            padding: '6px 14px', borderRadius: 6,
                            background: 'transparent', color: 'var(--text-primary)',
                            border: '1.5px solid var(--border-medium)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}>
                          {t('conflicts.useRev', { rev: rev.slice(0, 6) })}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleDismiss(c._id)}
                        style={{
                          padding: '6px 14px', borderRadius: 6,
                          background: 'transparent', color: 'var(--text-muted)',
                          border: '1.5px solid var(--border-medium)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>
                        {t('syncConflicts.dismissButton')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
