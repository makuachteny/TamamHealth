'use client';

import { useMemo } from 'react';
import { useApp } from '@/lib/context';
import { useAppointments } from '@/lib/hooks/useAppointments';
import { useSigningInbox } from '@/lib/hooks/useSigningInbox';
import { usePhoneNotesInbox } from '@/lib/hooks/usePhoneNotesInbox';
import { useReferrals } from '@/lib/hooks/useReferrals';
import { useIntakeForms } from '@/lib/hooks/useIntakeForms';
import { useLabResults } from '@/lib/hooks/useLabResults';
import { useTelehealth } from '@/lib/hooks/useTelehealth';
import { getRoleConfig } from '@/lib/permissions';
import { isHrefAllowed } from '@/components/ehr/ehr-navigation';
import type { AppointmentDoc } from '@/lib/db-types';
import type { MobileDashboardData, MobileLane, MobileOutstandingItem } from './dashboard-strategy';

function todayIso(): string {
  // Local calendar date, not UTC — see identical helper + rationale in
  // use-mobile-shell-state.ts (must stay in sync with the calendar tab's
  // default day and the dashboard header's locale-based "today" heading).
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Clinical-archetype dashboard data (doctor/CO/nurse/clinician/midwife/
 * triage_nurse/rooming_nurse). Lane grouping and outstanding-item counts
 * deliberately mirror the exact computations in
 * app/(dashboard)/dashboard/page.tsx so the mobile numbers agree with the
 * desktop dashboard for the same user — see phase 3 verification in
 * plans/fancy-snacking-noodle.md.
 */
export function useClinicalDashboardData(): MobileDashboardData {
  const { currentUser } = useApp();
  const { appointments, loading: apptLoading } = useAppointments();
  const { unsignedDrafts, awaitingCosign, heldAssessments, loading: signLoading } = useSigningInbox();
  const { notes: phoneNotes, loading: phoneLoading } = usePhoneNotesInbox();
  const { referrals, loading: referralsLoading } = useReferrals();
  const { forms: intakeForms, loading: intakeLoading } = useIntakeForms();
  const { results: labResults, loading: labLoading } = useLabResults();
  const { sessions: telehealthSessions, loading: telehealthLoading } = useTelehealth();

  const today = todayIso();
  const allowedRoutes = useMemo(
    () => (currentUser ? getRoleConfig(currentUser.role).allowedRoutes : []),
    [currentUser]
  );
  const hasTelehealth = isHrefAllowed('/telehealth', allowedRoutes);

  const lanes = useMemo<MobileLane<AppointmentDoc>[]>(() => {
    const todays = appointments.filter((a) => a.appointmentDate === today);
    const scheduled = todays.filter((a) => ['requested', 'scheduled', 'confirmed'].includes(a.status));
    const inOffice = todays.filter((a) => ['checked_in', 'in_progress'].includes(a.status));
    const finished = todays.filter((a) => a.status === 'completed');
    return [
      { key: 'scheduled', label: `${scheduled.length} Scheduled`, tone: 'info', items: scheduled },
      { key: 'in_office', label: `${inOffice.length} In Office`, tone: 'warning', items: inOffice },
      { key: 'finished', label: `${finished.length} Finished`, tone: 'success', items: finished },
    ];
  }, [appointments, today]);

  const outstanding = useMemo<MobileOutstandingItem[]>(() => {
    const signCount = unsignedDrafts.length + awaitingCosign.length + heldAssessments.length;
    const myReferralsCount = referrals.filter((r) => r.createdBy === currentUser?._id).length;
    const pendingIntake = intakeForms.filter((f) => f.status === 'pending_review').length;
    const awaitingLabs = labResults.filter(
      (r) => (r.status === 'pending' || r.status === 'in_progress') && r.orderedBy === currentUser?.name
    ).length;

    const items: MobileOutstandingItem[] = [
      { key: 'documents', label: 'Documents to sign', count: signCount, href: '/dashboard' },
      { key: 'phone_notes', label: 'Phone notes', count: phoneNotes.length, href: '/dashboard' },
      { key: 'referrals', label: 'Open referrals', count: myReferralsCount, href: '/referrals' },
      { key: 'intake', label: 'Patient intake', count: pendingIntake, href: '/patient-intake' },
      { key: 'labs', label: 'Awaiting labs', count: awaitingLabs, href: '/lab' },
    ];

    // Nurses don't have /telehealth in their allowedRoutes — omit the tile
    // entirely rather than show a misleading 0.
    if (hasTelehealth) {
      const todayTelehealth = telehealthSessions.filter(
        (s) => s.scheduledDate === today && (s.status === 'scheduled' || s.status === 'waiting_room')
      ).length;
      items.push({ key: 'telehealth', label: 'Telehealth visits', count: todayTelehealth, href: '/telehealth' });
    }

    return items;
  }, [unsignedDrafts, awaitingCosign, heldAssessments, referrals, intakeForms, labResults, telehealthSessions, currentUser, hasTelehealth, today]);

  const loading = apptLoading || signLoading || phoneLoading || referralsLoading || intakeLoading || labLoading || telehealthLoading;

  return { lanes, outstanding, loading };
}
