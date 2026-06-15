'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context';
import { makeCoalescer } from './live-reload';
import { referralsDB } from '../db';

export type NotificationItem = {
  id: string;
  type: 'alert' | 'referral' | 'lab';
  title: string;
  subtitle: string;
  time: string;
  href: string;
};

/**
 * Aggregates the things a user should be notified about — incoming referrals,
 * active disease-outbreak alerts, and critical lab results — into one list for
 * the TopBar notification bell. Loads once per scope (no live feed, to avoid
 * re-render churn); the panel can call reload().
 */
export function useNotifications() {
  const { currentUser } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scopeKey = `${currentUser?.orgId ?? ''}|${currentUser?.hospitalId ?? ''}|${currentUser?.role ?? ''}`;

  const load = useCallback(async () => {
    setLoading(true);
    const scope = currentUser
      ? { orgId: currentUser.orgId, hospitalId: currentUser.hospitalId, role: currentUser.role }
      : undefined;
    const out: NotificationItem[] = [];

    try {
      const { getAllReferrals } = await import('../services/referral-service');
      const refs = await getAllReferrals(scope);
      const myHospitalId = currentUser?.hospitalId;
      // Recent-acceptance window so a sender's "patient received" banner clears
      // itself once the episode is under way, instead of lingering forever
      // while the referral sits in the terminal-ish `seen` state.
      const ACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      for (const x of refs) {
        const isIncoming = !!myHospitalId && x.toHospitalId === myHospitalId;
        const isOutgoing = !!myHospitalId && x.fromHospitalId === myHospitalId;
        // Incoming referral awaiting THIS facility's triage/acceptance. Admin
        // roles without a hospitalId keep the old behaviour (see everything).
        if ((isIncoming || !myHospitalId) && (x.status === 'sent' || x.status === 'received')) {
          out.push({ id: `ref-${x._id}`, type: 'referral', title: `Referral · ${x.patientName}`, subtitle: `${x.fromHospital} → ${x.toHospital}`, time: x.referralDate || x.createdAt, href: '/referrals' });
        }
        // Outgoing referral the receiving facility just accepted — close the
        // loop by telling the sender their patient was received on the other end.
        if (isOutgoing && x.status === 'seen') {
          const acceptedAt = x.updatedAt || x.referralDate || x.createdAt;
          const acceptedMs = Date.parse(acceptedAt || '');
          if (Number.isNaN(acceptedMs) || nowMs - acceptedMs <= ACK_WINDOW_MS) {
            out.push({ id: `ref-ack-${x._id}`, type: 'referral', title: `Patient received · ${x.patientName}`, subtitle: `${x.toHospital} accepted the referral`, time: acceptedAt, href: '/referrals' });
          }
        }
        // Outgoing referral the receiving facility closed out with a structured
        // outcome — surface the disposition so the referrer learns what happened.
        if (isOutgoing && x.status === 'completed' && x.outcome) {
          const closedAt = x.outcome.recordedAt || x.updatedAt || x.referralDate;
          const closedMs = Date.parse(closedAt || '');
          if (Number.isNaN(closedMs) || nowMs - closedMs <= ACK_WINDOW_MS) {
            const disposition = x.outcome.disposition.replace(/_/g, ' ');
            out.push({ id: `ref-out-${x._id}`, type: 'referral', title: `Referral outcome · ${x.patientName}`, subtitle: `${x.toHospital}: ${disposition}`, time: closedAt, href: '/referrals' });
          }
        }
      }
    } catch { /* offline */ }

    try {
      const { getActiveAlerts } = await import('../services/surveillance-service');
      const alerts = await getActiveAlerts();
      for (const a of alerts.slice(0, 20)) {
        out.push({ id: `alert-${a._id}`, type: 'alert', title: `${a.disease} outbreak alert`, subtitle: `${a.cases} cases · ${a.county}, ${a.state}`, time: a.reportDate || a.createdAt, href: '/surveillance' });
      }
    } catch { /* offline */ }

    try {
      const { getAllLabResults } = await import('../services/lab-service');
      const labs = await getAllLabResults(scope);
      for (const l of labs.filter(x => x.critical && x.status === 'completed')) {
        out.push({ id: `lab-${l._id}`, type: 'lab', title: `Critical result · ${l.testName}`, subtitle: l.patientName, time: l.completedAt || l.orderedAt || l.createdAt, href: '/lab' });
      }
    } catch { /* offline */ }

    out.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    setItems(out);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => { load(); }, [load]);

  // Live-refresh on referral writes so the bell badge reflects acceptance the
  // moment the receiving facility's `seen` update replicates in — otherwise the
  // sender's "patient received" notification only surfaces on a manual reopen.
  // Coalesced to avoid re-render churn on bursty replication.
  useEffect(() => {
    let cancelled = false;
    const reload = makeCoalescer(() => { if (!cancelled) load(); });
    const changes = referralsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow — offline */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { changes.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  return { items, count: items.length, loading, reload: load };
}
