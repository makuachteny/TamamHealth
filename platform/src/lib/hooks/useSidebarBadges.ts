'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { useDataScope } from './useDataScope';
import { makeCoalescer } from './live-reload';
import { messagesDB, referralsDB } from '../db';

export interface SidebarBadges {
  messages: number;
  referrals: number;
}

export function useSidebarBadges(): SidebarBadges {
  const { currentUser } = useApp();
  const scope = useDataScope();
  const [badges, setBadges] = useState<SidebarBadges>({ messages: 0, referrals: 0 });

  const load = useCallback(async () => {
    if (!currentUser) return;
    const [{ getAllMessages }, { getAllReferrals }] = await Promise.all([
      import('../services/message-service'),
      import('../services/referral-service'),
    ]);

    const [msgs, refs] = await Promise.all([
      getAllMessages(scope),
      getAllReferrals(scope),
    ]);

    const unreadMessages = msgs.filter(m =>
      m.direction === 'patient_to_staff' &&
      !(m.readBy ?? []).includes(currentUser._id)
    ).length;

    const pendingReferrals = refs.filter(r =>
      r.status === 'sent' || r.status === 'received'
    ).length;

    setBadges({ messages: unreadMessages, referrals: pendingReferrals });
  }, [currentUser, scope]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      // Don't fully swallow failures — a broken badge load should at least be
      // visible in the console instead of silently rendering 0/0 forever.
      load().catch(err => console.warn('Sidebar badge load failed', err));
    };

    run();

    // Live PouchDB subscriptions: a new patient message or incoming referral
    // (local write OR replicated from another device) bumps the badges without
    // needing a navigation/reload — same pattern as useMessages/useReferrals.
    const reload = makeCoalescer(run);
    const msgChanges = messagesDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* transient feed errors are non-fatal; next load resyncs */ });
    const refChanges = referralsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* as above */ });

    return () => {
      cancelled = true;
      reload.cancel();
      try { msgChanges.cancel(); } catch { /* noop */ }
      try { refChanges.cancel(); } catch { /* noop */ }
    };
  }, [currentUser, load]);

  return badges;
}
