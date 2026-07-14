'use client';

import { useMemo } from 'react';
import { useIntakeForms } from '@/lib/hooks/useIntakeForms';
import { useReferrals } from '@/lib/hooks/useReferrals';
import type { PatientIntakeFormDoc } from '@/lib/db-types';
import type { MobileDashboardData, MobileLane, MobileOutstandingItem } from './dashboard-strategy';

/**
 * Front-desk archetype dashboard (front_desk/central_registration_clerk/
 * clinic_clerk): lanes grouped by IntakeFormStatus — the front-desk review
 * queue for patient-submitted intake forms.
 */
export function useFrontDeskDashboardData(): MobileDashboardData {
  const { forms, loading: formsLoading } = useIntakeForms();
  const { referrals, loading: referralsLoading } = useReferrals();

  const lanes = useMemo<MobileLane<PatientIntakeFormDoc>[]>(() => {
    const scheduled = forms.filter((f) => f.status === 'not_submitted');
    const inOffice = forms.filter((f) => f.status === 'pending_review');
    const finished = forms.filter((f) => f.status === 'merged');
    return [
      { key: 'scheduled', label: `${scheduled.length} Scheduled`, tone: 'info', items: scheduled },
      { key: 'in_office', label: `${inOffice.length} In Office`, tone: 'warning', items: inOffice },
      { key: 'finished', label: `${finished.length} Finished`, tone: 'success', items: finished },
    ];
  }, [forms]);

  const outstanding = useMemo<MobileOutstandingItem[]>(() => {
    const pendingIntake = forms.filter((f) => f.status === 'pending_review').length;
    const openReferrals = referrals.filter((r) => ['sent', 'received', 'seen'].includes(r.status)).length;
    return [
      { key: 'intake', label: 'Patient intake', count: pendingIntake, href: '/patient-intake' },
      { key: 'referrals', label: 'Open referrals', count: openReferrals, href: '/referrals' },
    ];
  }, [forms, referrals]);

  return { lanes, outstanding, loading: formsLoading || referralsLoading };
}
