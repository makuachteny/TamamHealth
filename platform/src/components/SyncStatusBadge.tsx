'use client';

/**
 * SyncStatusBadge — pill-shaped status indicator for the TopBar.
 *
 * Reads sync state from AppContext and renders a coloured dot + label.
 * Clicking opens a small popover with manual controls:
 *  - Pause/resume sync (calls toggleOnline() — persisted in localStorage)
 *  - Sync now (one-shot replication)
 *  - Last synced (relative time)
 *
 * Visual states:
 *  - green   → synced / online and idle
 *  - blue    → actively syncing (with subtle 1.5s opacity pulse on the dot)
 *  - amber   → user paused, or browser offline
 *  - red     → sync error
 *  - gray    → sync disabled (e.g. NEXT_PUBLIC_SYNC_ENABLED=false)
 */

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  DuotonePause as Pause,
  DuotonePlay as Play,
  DuotoneRefresh as RefreshCw,
} from '@/components/icons';

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

interface BadgeView {
  tone: Tone;
  label: string;
  pulse: boolean;
}

function formatRelative(iso: string | null | undefined, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (!iso) return t('sync.never');
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t('sync.never');
  const diffMs = Date.now() - then;
  if (diffMs < 0) return t('sync.justNow');
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return t('sync.justNow');
  if (sec < 60) return t('sync.secondsAgo', { count: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('sync.minutesAgo', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('sync.hoursAgo', { count: hr });
  const day = Math.floor(hr / 24);
  return t('sync.daysAgo', { count: day });
}

function toneToColor(tone: Tone): string {
  switch (tone) {
    case 'success': return 'var(--color-success)';
    case 'info':    return 'var(--accent-primary)';
    case 'warning': return 'var(--color-warning)';
    case 'danger':  return 'var(--color-danger)';
    case 'muted':   return 'var(--text-muted)';
  }
}

export default function SyncStatusBadge() {
  const { t } = useTranslation();
  const { isOnline, isNetworkUp, syncPaused, syncStatus, lastSync, toggleOnline, syncNow } = useApp();
  const [open, setOpen] = useState(false);
  // Force re-render every 30s so "Last synced: 2m ago" stays fresh.
  const [, setTick] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Close popover on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const view: BadgeView = (() => {
    if (!isNetworkUp) return { tone: 'warning', label: t('status.offline'), pulse: false };
    if (syncPaused)   return { tone: 'warning', label: t('sync.paused'),  pulse: false };
    const state = syncStatus?.state;
    if (state === 'disabled') return { tone: 'muted',   label: t('sync.localOnly'), pulse: false };
    if (state === 'error')    return { tone: 'danger',  label: t('sync.syncError'), pulse: false };
    if (state === 'syncing')  return { tone: 'info',    label: t('status.syncing'),    pulse: true };
    if (state === 'offline')  return { tone: 'warning', label: t('status.offline'),    pulse: false };
    // Follower: another tab in the same origin holds the leader Web Lock.
    // This tab will start syncing automatically once that tab closes.
    if (state === 'follower') return { tone: 'muted',   label: t('sync.followingTab'), pulse: false };
    if (state === 'synced')   return { tone: 'success', label: t('sync.synced'),     pulse: false };
    // 'idle' or null status while manager spins up
    return { tone: 'success', label: t('status.online'), pulse: false };
  })();

  const dotColor = toneToColor(view.tone);
  // Sync now is enabled only when: we're effectively online, sync isn't disabled
  // by config, the manager has been created, this tab is the elected leader,
  // and we aren't already syncing. (Errors don't gate it — the user explicitly
  // retrying is a valid action.)
  const syncDisabled = syncStatus?.state === 'disabled' || syncStatus === null;
  const isFollower = syncStatus?.state === 'follower';
  const canSyncNow = isOnline && !syncDisabled && !isFollower && !view.pulse;
  const errorMsg = (() => {
    if (!syncStatus) return null;
    for (const s of Object.values(syncStatus.databases)) {
      if (s.state === 'error' && s.error) return s.error;
      if (s.state === 'denied') return t('sync.authDenied');
    }
    return null;
  })();

  const interval = syncStatus?.activeDatabases ?? 0;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-pressed={!syncPaused}
        aria-label={t('sync.badgeAriaLabel', { label: view.label })}
        className="hidden sm:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border-medium)',
          color: 'var(--text-primary)',
        }}
      >
        <span className="relative inline-flex items-center justify-center w-2.5 h-2.5">
          <span
            aria-hidden="true"
            className={`block w-2 h-2 rounded-full ${view.pulse ? 'sync-dot-pulse' : ''}`}
            style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
          />
        </span>
        <span>{view.label}</span>
      </button>

      {/* Mobile-only compact icon button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-pressed={!syncPaused}
        aria-label={t('sync.badgeAriaLabel', { label: view.label })}
        className="sm:hidden w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ background: 'transparent' }}
      >
        <span
          aria-hidden="true"
          className={`block w-2.5 h-2.5 rounded-full ${view.pulse ? 'sync-dot-pulse' : ''}`}
          style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('sync.controlsAriaLabel')}
          className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl overflow-hidden sync-popover-enter"
          style={{
            background: 'var(--bg-card-solid)',
            border: '1px solid var(--border-medium)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span
                aria-hidden="true"
                className={`block w-2.5 h-2.5 rounded-full ${view.pulse ? 'sync-dot-pulse' : ''}`}
                style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
              />
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {view.label}
              </span>
            </div>
            <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
              {!isNetworkUp && t('sync.bodyOffline')}
              {isNetworkUp && syncPaused && t('sync.bodyPaused')}
              {isNetworkUp && !syncPaused && view.tone === 'danger' && (
                errorMsg ? t('sync.bodyErrorDetail', { msg: errorMsg }) : t('sync.bodyError')
              )}
              {isNetworkUp && !syncPaused && view.tone === 'info' && (
                interval === 1 ? t('sync.bodySyncingOne') : t('sync.bodySyncingMany', { count: interval })
              )}
              {isNetworkUp && !syncPaused && view.tone === 'muted' && isFollower && (
                t('sync.bodyFollower')
              )}
              {isNetworkUp && !syncPaused && view.tone === 'muted' && !isFollower && (
                t('sync.bodyDisabled')
              )}
              {isNetworkUp && !syncPaused && view.tone === 'success' && (
                t('sync.bodyOnline')
              )}
            </p>
          </div>

          <div className="px-4 py-3 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{t('sync.lastSynced')}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {formatRelative(lastSync || syncStatus?.lastSync, t)}
            </span>
          </div>

          <div className="px-3 pb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { toggleOnline(); }}
              aria-pressed={syncPaused}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{
                background: syncPaused ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                color: syncPaused ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
              }}
            >
              {syncPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {syncPaused ? t('sync.resume') : t('sync.pause')}
            </button>
            <button
              type="button"
              onClick={() => { void syncNow(); }}
              disabled={!canSyncNow}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{
                background: 'var(--overlay-subtle)',
                color: canSyncNow ? 'var(--text-primary)' : 'var(--text-muted)',
                border: '1px solid var(--border-medium)',
                opacity: canSyncNow ? 1 : 0.6,
                cursor: canSyncNow ? 'pointer' : 'not-allowed',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${view.pulse ? 'animate-spin' : ''}`} />
              {t('sync.syncNow')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
