'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context';
import { makeCoalescer } from './live-reload';
import { referralsDB, appointmentsDB, labResultsDB, prescriptionsDB, intakeFormsDB } from '../db';

export type NotificationItem = {
  id: string;
  type: 'alert' | 'referral' | 'lab' | 'appointment' | 'intake' | 'prescription';
  title: string;
  subtitle: string;
  time: string;
  href: string;
};

/**
 * Aggregates every facility-level event a user should be notified about into
 * one list for the TopBar notification bell:
 *   - incoming/updated referrals
 *   - active disease-outbreak alerts
 *   - lab results (critical + newly ready to review)
 *   - appointments awaiting approval + patients checked in and waiting
 *   - patient intake forms awaiting review
 *   - prescriptions awaiting dispensing
 * Messaging is intentionally excluded — chat has its own unread indicator.
 * Loads per scope; the panel can call reload(), and referral/appointment
 * writes live-refresh the badge.
 */
/** User preference: play a sound when new notifications arrive, or stay
 *  silent. Persisted per device; read at chime time so no re-render needed. */
const ALERT_PREF_KEY = 'tamamhealth-notification-alerts';
export type NotificationAlertPref = 'sound' | 'muted';

export function getNotificationAlertPref(): NotificationAlertPref {
  if (typeof window === 'undefined') return 'sound';
  return window.localStorage.getItem(ALERT_PREF_KEY) === 'muted' ? 'muted' : 'sound';
}

export function setNotificationAlertPref(pref: NotificationAlertPref) {
  try { window.localStorage.setItem(ALERT_PREF_KEY, pref); } catch { /* private mode */ }
}

/** Short two-tone chime via WebAudio — no asset needed, works offline. */
function playAlertChime() {
  try {
    type AudioCtor = typeof AudioContext;
    const Ctx: AudioCtor | undefined = window.AudioContext
      || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Autoplay policy: a context created without a recent user gesture starts
    // suspended and plays nothing — try to resume, and bail quietly if the
    // browser refuses (the badge still updates visually).
    if (ctx.state === 'suspended') { void ctx.resume(); }
    const play = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    };
    play(880, 0);
    play(1174.66, 0.16);
    setTimeout(() => { void ctx.close(); }, 800);
  } catch { /* audio blocked — stay silent */ }
}

export function useNotifications() {
  const { currentUser } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Known notification ids — lets us chime only for genuinely new arrivals
  // (never on the first load of a session).
  const seenIds = useRef<Set<string> | null>(null);
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

    const todayIso = new Date().toISOString().slice(0, 10);
    const RECENT_MS = 3 * 24 * 60 * 60 * 1000;
    const nowMsLocal = Date.now();

    try {
      const { getAllLabResults } = await import('../services/lab-service');
      const labs = await getAllLabResults(scope);
      // Critical results first, then non-critical results that just came back
      // (ready for the clinician to review) within a recent window.
      for (const l of labs.filter(x => x.critical && x.status === 'completed')) {
        out.push({ id: `lab-${l._id}`, type: 'lab', title: `Critical result · ${l.testName}`, subtitle: l.patientName, time: l.completedAt || l.orderedAt || l.createdAt, href: l.patientName ? `/lab?patient=${encodeURIComponent(l.patientName)}` : '/lab' });
      }
      const readyLabs = labs
        .filter(x => !x.critical && x.status === 'completed')
        .filter(x => {
          const ms = Date.parse(x.completedAt || x.updatedAt || x.createdAt || '');
          return Number.isNaN(ms) || nowMsLocal - ms <= RECENT_MS;
        })
        .slice(0, 20);
      for (const l of readyLabs) {
        out.push({ id: `lab-ready-${l._id}`, type: 'lab', title: `Result ready · ${l.testName}`, subtitle: `${l.patientName} · ready to review`, time: l.completedAt || l.updatedAt || l.createdAt, href: l.patientName ? `/lab?patient=${encodeURIComponent(l.patientName)}` : '/lab' });
      }
    } catch { /* offline */ }

    // Appointments — approvals needed + patients checked in and waiting.
    try {
      const { getAllAppointments } = await import('../services/appointment-service');
      const appts = await getAllAppointments(scope);
      // Awaiting approval: explicitly requested, or today's scheduled slots that
      // still need confirmation.
      const pending = appts
        .filter(a => a.status === 'requested' || (a.status === 'scheduled' && a.appointmentDate >= todayIso))
        .sort((a, b) => (a.appointmentDate + (a.appointmentTime || '')).localeCompare(b.appointmentDate + (b.appointmentTime || '')))
        .slice(0, 20);
      for (const a of pending) {
        out.push({ id: `appt-appr-${a._id}`, type: 'appointment', title: `Appointment to confirm · ${a.patientName}`, subtitle: `${a.appointmentDate}${a.appointmentTime ? ` ${a.appointmentTime}` : ''} · ${a.providerName || a.department || 'awaiting approval'}`, time: a.updatedAt || a.createdAt || a.appointmentDate, href: '/appointments' });
      }
      // Checked in today, waiting to be seen.
      for (const a of appts.filter(a => a.status === 'checked_in' && a.appointmentDate === todayIso).slice(0, 20)) {
        out.push({ id: `appt-ci-${a._id}`, type: 'appointment', title: `Checked in · ${a.patientName}`, subtitle: `${a.appointmentTime ? `${a.appointmentTime} · ` : ''}${a.department || a.reason || 'waiting to be seen'}`, time: a.checkedInAt || a.updatedAt || a.appointmentDate, href: '/appointments' });
      }
    } catch { /* offline */ }

    // Patient intake forms awaiting review.
    try {
      const { getAllIntakeForms } = await import('../services/intake-form-service');
      const forms = await getAllIntakeForms(scope);
      for (const f of forms.filter(x => x.status === 'pending_review').slice(0, 20)) {
        out.push({ id: `intake-${f._id}`, type: 'intake', title: `Intake form · ${f.patientName}`, subtitle: `${f.fields?.length ? `${f.fields.length} fields` : 'Submitted'} · ready to review`, time: f.receivedAt || f.requestedAt || f.createdAt, href: '/patient-intake' });
      }
    } catch { /* offline */ }

    // Prescriptions awaiting dispensing (pharmacy queue).
    try {
      const { getAllPrescriptions } = await import('../services/prescription-service');
      const rxs = await getAllPrescriptions(scope);
      for (const rx of rxs.filter(x => x.status === 'pending').slice(0, 20)) {
        out.push({ id: `rx-${rx._id}`, type: 'prescription', title: `Prescription · ${rx.patientName}`, subtitle: `${rx.medication} · awaiting dispensing`, time: rx.updatedAt || rx.createdAt, href: '/pharmacy' });
      }
    } catch { /* offline */ }

    out.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    if (seenIds.current === null) {
      seenIds.current = new Set(out.map(n => n.id));
    } else {
      const fresh = out.filter(n => !seenIds.current!.has(n.id));
      if (fresh.length > 0 && getNotificationAlertPref() === 'sound') playAlertChime();
      for (const n of out) seenIds.current.add(n.id);
    }
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
    const refChanges = referralsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow — offline */ });
    const apptChanges = appointmentsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow — offline */ });
    // Labs / prescriptions / intake also produce notifications — without
    // these feeds a new critical result never chimes (or badges) until the
    // page is reopened.
    const labChanges = labResultsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow — offline */ });
    const rxChanges = prescriptionsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow — offline */ });
    const intakeChanges = intakeFormsDB().changes({ since: 'now', live: true, include_docs: false })
      .on('change', () => reload.trigger())
      .on('error', () => { /* swallow — offline */ });
    return () => {
      cancelled = true;
      reload.cancel();
      try { refChanges.cancel(); } catch { /* noop */ }
      try { apptChanges.cancel(); } catch { /* noop */ }
      try { labChanges.cancel(); } catch { /* noop */ }
      try { rxChanges.cancel(); } catch { /* noop */ }
      try { intakeChanges.cancel(); } catch { /* noop */ }
    };
  }, [load]);

  return { items, count: items.length, loading, reload: load };
}
