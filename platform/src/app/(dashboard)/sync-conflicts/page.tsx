'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n/useTranslation';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/lib/context';
import {
  listConflicts,
  resolveConflict,
  dismissConflict,
} from '@/lib/services/conflict-service';
import type { ConflictQueueDoc } from '@/lib/db-types';
import {
  DuotoneAlert as AlertTriangle,
  DuotoneCheck as Check,
  DuotoneClose as X,
} from '@/components/icons';

type StatusFilter = 'pending' | 'resolved' | 'dismissed' | 'all';
type RiskFilter = 'high' | 'medium' | 'low' | 'all';

const RISK_BADGES: Record<ConflictQueueDoc['risk'], { label: string; bg: string; fg: string }> = {
  high: { label: 'HIGH', bg: 'rgba(229,46,66,0.14)', fg: 'var(--color-danger)' },
  medium: { label: 'MEDIUM', bg: 'rgba(252,211,77,0.16)', fg: 'var(--color-warning)' },
  low: { label: 'LOW', bg: 'rgba(43,111,224,0.12)', fg: 'var(--accent-primary)' },
};

export default function SyncConflictsPage() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const [conflicts, setConflicts] = useState<ConflictQueueDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [chosenRev, setChosenRev] = useState<string>('');
  const [actionPending, setActionPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listConflicts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        risk: riskFilter === 'all' ? undefined : riskFilter,
        orgId: currentUser?.orgId,
      });
      setConflicts(items);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('syncConflicts.errorLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter, currentUser?.orgId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = useMemo(
    () => conflicts.find((c) => c._id === selectedId) ?? null,
    [conflicts, selectedId],
  );

  // Reset chosenRev whenever the selected conflict changes — the dropdown
  // must always start at the current winning rev.
  useEffect(() => {
    if (selected) {
      setChosenRev(selected.winningRev);
      setResolveNote('');
      setErrorMsg(null);
    }
  }, [selected?._id, selected]);

  const onResolve = async () => {
    if (!selected) return;
    setActionPending(true);
    setErrorMsg(null);
    try {
      const out = await resolveConflict(selected._id, {
        userId: currentUser?._id,
        username: currentUser?.username,
        chosenRev,
        note: resolveNote.trim() || undefined,
      });
      if (!out) {
        setErrorMsg(t('syncConflicts.errorResolveDeleted'));
        return;
      }
      setSelectedId(null);
      await reload();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('syncConflicts.errorResolutionFailed'));
    } finally {
      setActionPending(false);
    }
  };

  const onDismiss = async () => {
    if (!selected) return;
    if (!resolveNote.trim()) {
      setErrorMsg(t('syncConflicts.errorDismissNoteRequired'));
      return;
    }
    setActionPending(true);
    setErrorMsg(null);
    try {
      const out = await dismissConflict(selected._id, {
        userId: currentUser?._id,
        username: currentUser?.username,
        note: resolveNote.trim(),
      });
      if (!out) {
        setErrorMsg(t('syncConflicts.errorDismissDeleted'));
        return;
      }
      setSelectedId(null);
      await reload();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('syncConflicts.errorDismissFailed'));
    } finally {
      setActionPending(false);
    }
  };

  const counts = useMemo(() => {
    const out = { pending: 0, resolved: 0, dismissed: 0, high: 0 };
    for (const c of conflicts) {
      if (c.status === 'pending') out.pending++;
      if (c.status === 'resolved') out.resolved++;
      if (c.status === 'dismissed') out.dismissed++;
      if (c.risk === 'high' && c.status === 'pending') out.high++;
    }
    return out;
  }, [conflicts]);

  return (
    <>
      <TopBar title={t('syncConflicts.title')} />
      <main className="page-container page-enter">
        <PageHeader
          icon={AlertTriangle}
          title={t('syncConflicts.title')}
          subtitle={t('syncConflicts.subtitle')}
        />

        {/* Summary cards */}
        <div className="kpi-grid mb-6">
          {[
            {
              label: t('syncConflicts.kpiPending'),
              value: counts.pending,
              fg: 'var(--color-warning)',
              bg: 'rgba(252,211,77,0.14)',
            },
            {
              label: t('syncConflicts.kpiHighRiskPending'),
              value: counts.high,
              fg: 'var(--color-danger)',
              bg: 'rgba(229,46,66,0.14)',
            },
            {
              label: t('syncConflicts.kpiResolved'),
              value: counts.resolved,
              fg: 'var(--accent-primary)',
              bg: 'rgba(43,111,224,0.12)',
            },
            {
              label: t('syncConflicts.kpiDismissed'),
              value: counts.dismissed,
              fg: 'var(--text-muted)',
              bg: 'rgba(140,140,140,0.12)',
            },
          ].map((s) => (
            <div key={s.label} className="kpi">
              <div className="kpi__icon" style={{ background: s.bg }}>
                <AlertTriangle style={{ color: s.fg }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{s.value}</div>
                <div className="kpi__label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {t('syncConflicts.filterStatus')}
          </span>
          {(['pending', 'resolved', 'dismissed', 'all'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background:
                  statusFilter === s ? 'var(--accent-primary)' : 'var(--surface-1)',
                color: statusFilter === s ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {t(`syncConflicts.statusFilter_${s}`)}
            </button>
          ))}
          <span className="ml-4 text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {t('syncConflicts.filterRisk')}
          </span>
          {(['high', 'medium', 'low', 'all'] as RiskFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background:
                  riskFilter === r ? 'var(--accent-primary)' : 'var(--surface-1)',
                color: riskFilter === r ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {t(`syncConflicts.riskFilter_${r}`)}
            </button>
          ))}
        </div>

        {/* List + detail layout */}
        <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 1fr' : '1fr' }}>
          {/* List */}
          <div className="card-elevated p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-1)' }}>
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t('syncConflicts.colRisk')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('syncConflicts.colResource')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('syncConflicts.colId')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('syncConflicts.colCreated')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('syncConflicts.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      {t('syncConflicts.loading')}
                    </td>
                  </tr>
                ) : conflicts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      {t('syncConflicts.emptyState')}
                    </td>
                  </tr>
                ) : (
                  conflicts.map((c) => {
                    const badge = RISK_BADGES[c.risk];
                    const isSelected = selectedId === c._id;
                    return (
                      <tr
                        key={c._id}
                        onClick={() => setSelectedId(c._id)}
                        className="cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? 'var(--surface-1)' : 'transparent',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        <td className="px-3 py-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide"
                            style={{ background: badge.bg, color: badge.fg }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">{c.resourceType}</td>
                        <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                          {c.resourceId}
                        </td>
                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(c.createdAt || '').toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-xs uppercase tracking-wide">{c.status}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card-elevated p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {selected.resourceType}
                  </div>
                  <div className="font-mono text-sm mt-0.5">{selected.resourceId}</div>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1 rounded hover:bg-[var(--surface-1)]"
                  aria-label={t('syncConflicts.closeDetail')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs space-y-1 mb-4" style={{ color: 'var(--text-muted)' }}>
                <div>
                  {t('syncConflicts.detailCreated')} <span style={{ color: 'var(--text-primary)' }}>{new Date(selected.createdAt || '').toLocaleString()}</span>
                </div>
                {selected.resolvedAt && (
                  <div>
                    {t('syncConflicts.detailResolved')} <span style={{ color: 'var(--text-primary)' }}>
                      {t('syncConflicts.detailResolvedBy', { date: new Date(selected.resolvedAt).toLocaleString(), user: selected.resolvedBy ?? t('syncConflicts.unknownUser') })}
                    </span>
                  </div>
                )}
                {selected.resolutionNote && (
                  <div>
                    {t('syncConflicts.detailNote')} <span style={{ color: 'var(--text-primary)' }}>{selected.resolutionNote}</span>
                  </div>
                )}
              </div>

              {selected.status === 'pending' ? (
                <>
                  <label className="block text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('syncConflicts.chooseWinningRevision')}
                  </label>
                  <select
                    value={chosenRev}
                    onChange={(e) => setChosenRev(e.target.value)}
                    className="w-full mb-3 px-3 py-2 rounded text-sm"
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value={selected.winningRev}>
                      {t('syncConflicts.keepCurrentWinning', { rev: selected.winningRev.slice(0, 12) })}
                    </option>
                    {selected.losingRevs.map((r) => (
                      <option key={r} value={r}>
                        {t('syncConflicts.useLosingRev', { rev: r.slice(0, 12) })}
                      </option>
                    ))}
                  </select>

                  <label className="block text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('syncConflicts.noteLabel')}
                  </label>
                  <textarea
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    rows={3}
                    placeholder={t('syncConflicts.notePlaceholder')}
                    className="w-full mb-3 px-3 py-2 rounded text-sm"
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />

                  {errorMsg && (
                    <div
                      className="mb-3 px-3 py-2 rounded text-xs"
                      style={{
                        background: 'rgba(229,46,66,0.12)',
                        color: 'var(--color-danger)',
                      }}
                    >
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={onResolve}
                      disabled={actionPending}
                      className="flex-1 px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--accent-primary)', color: '#fff' }}
                    >
                      <Check className="w-4 h-4" /> {t('syncConflicts.resolveButton')}
                    </button>
                    <button
                      onClick={onDismiss}
                      disabled={actionPending}
                      className="flex-1 px-4 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                      style={{
                        background: 'var(--surface-1)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <X className="w-4 h-4" /> {t('syncConflicts.dismissButton')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('syncConflicts.noFurtherAction', { status: selected.status })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
