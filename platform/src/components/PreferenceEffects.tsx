'use client';

/**
 * Applies per-user UI preferences app-wide:
 *  - spacing density → <html data-density> (CSS targets it)
 *  - desktop notifications for new staff chat messages addressed to the
 *    current user while the tab is in the background.
 *
 * Renders nothing; mounted once inside the dashboard shell.
 */
import { useEffect } from 'react';
import { useApp } from '@/lib/context';
import { getUserPrefs, applyDensity, subscribeUserPrefs } from '@/lib/user-prefs';
import { messagesDB } from '@/lib/db';
import type { MessageDoc } from '@/lib/db-types';

export default function PreferenceEffects() {
  const { currentUser } = useApp();
  const userId = currentUser?._id;

  // Density: apply on mount and whenever it changes.
  useEffect(() => {
    applyDensity(getUserPrefs().density);
    return subscribeUserPrefs(p => applyDensity(p.density));
  }, []);

  // Desktop notifications for new staff messages addressed to me.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let feed: { cancel: () => void } | null = null;
    try {
      feed = messagesDB()
        .changes({ since: 'now', live: true, include_docs: true })
        .on('change', (change: { doc?: unknown }) => {
          if (cancelled) return;
          const prefs = getUserPrefs();
          if (!prefs.messageNotifications) return;
          if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
          if (typeof document !== 'undefined' && !document.hidden) return; // only when not focused
          const doc = change.doc as MessageDoc | undefined;
          if (!doc || doc.type !== 'message' || doc.recipientType !== 'staff') return;
          if (doc.patientId !== userId) return;     // not addressed to me
          if (doc.fromDoctorId === userId) return;  // my own message echoing back
          try {
            const n = new Notification(doc.fromDoctorName || 'New message', {
              body: (doc.body || 'You have a new message').slice(0, 140),
              tag: doc.conversationId || doc._id,
            });
            n.onclick = () => { try { window.focus(); } catch { /* noop */ } n.close(); };
          } catch { /* notification failed — ignore */ }
        })
        .on('error', () => { /* swallow */ }) as unknown as { cancel: () => void };
    } catch {
      feed = null;
    }
    return () => { cancelled = true; try { feed?.cancel(); } catch { /* noop */ } };
  }, [userId]);

  return null;
}
