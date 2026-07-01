'use client';
import DashboardHero from '@/components/dashboard/DashboardHero';
import SpotlightCard from '@/components/dashboard/SpotlightCard';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Pill, FileText, BedDouble, AlertTriangle,
  Syringe, HeartPulse, Users, SendHorizontal,
} from '@/components/icons/lucide';
import QuickActionsCard from '@/components/dashboard/QuickActionsCard';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import WardWorkflow from './WardWorkflow';
import { EMPTY_WARD_FILTERS, type WardFilterState } from './WardFilters';
import MarWorkflow from './MarWorkflow';
import TriageWorkflow from './TriageWorkflow';
import HandoffWorkflow from './HandoffWorkflow';

type StationTab = 'ward' | 'mar' | 'triage' | 'handoff';

export default function NurseDashboard() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const router = useRouter();
  const { patients } = usePatients();
  const { triages } = useTriage();
  const today = new Date().toISOString().slice(0, 10);
  const triageToday = triages.filter(tr => (tr.triagedAt || '').startsWith(today));
  const criticalTriage = triageToday.filter(tr => tr.priority === 'RED').length;

  // The Quick Actions cards act as the station switcher — each swaps the inline
  // body below (the clinical-officer dashboard pattern: quick-action cards drive
  // the view rather than top-bar tabs).
  const [activeTab, setActiveTab] = useState<StationTab>('ward');

  // Ward-queue structured filters — owned here so the filter dropdown can live
  // on the platform-wide search bar (TopBar searchTrailing) while WardWorkflow
  // reads the same state to narrow its list.
  const [wardFilters, setWardFilters] = useState<WardFilterState>(EMPTY_WARD_FILTERS);

  if (!currentUser) return null;

  const stationLabel: Record<StationTab, string> = {
    ward: t('nurse.tabWard'),
    mar: t('nurse.tabMar'),
    triage: t('nurse.tabTriage'),
    handoff: t('nurse.shiftHandoff'),
  };

  return (
    <>
      {/* Free-text search + ward filters now live inline in the ward list
          (WardWorkflow), so the platform-wide top search bar is hidden here. */}
      <TopBar title={t('nurse.title')} hideSearch />
      <main className="page-container page-enter">
        <div className="flex flex-col gap-5 h-full min-h-0">

          <DashboardHero
            className="flex-shrink-0"
            stats={[
              { label: 'Patients', value: patients.length },
              { label: 'Triage Today', value: triageToday.length },
              { label: 'Critical', value: criticalTriage },
            ]}
          />

          {/* ═══ QUICK ACTIONS — stations (active-highlighted) + common nav ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-shrink-0">
            <QuickActionsCard
              className="lg:col-span-2"
              actions={[
                { label: stationLabel.ward, icon: BedDouble, action: () => setActiveTab('ward'), color: 'var(--accent-primary)', active: activeTab === 'ward' },
                { label: stationLabel.mar, icon: Pill, action: () => setActiveTab('mar'), color: '#0D9488', active: activeTab === 'mar' },
                { label: stationLabel.triage, icon: AlertTriangle, action: () => setActiveTab('triage'), color: '#F59E0B', active: activeTab === 'triage' },
                { label: stationLabel.handoff, icon: FileText, action: () => setActiveTab('handoff'), color: 'var(--accent-primary)', active: activeTab === 'handoff' },
                { label: t('dashboard.newPatient'), icon: Users, action: () => router.push('/patients/new'), color: 'var(--accent-primary)' },
                { label: t('dashboard.immunization'), icon: Syringe, action: () => router.push('/immunizations'), color: '#059669' },
                { label: t('dashboard.ancVisit'), icon: HeartPulse, action: () => router.push('/anc'), color: '#EC4899' },
                { label: t('nav.referrals'), icon: SendHorizontal, action: () => router.push('/referrals'), color: '#F59E0B' },
              ]}
            />
            <SpotlightCard className="lg:col-span-1" title="Critical Triage" value={criticalTriage} caption={`${triageToday.length} triaged today`} href="/dashboard/nurse/triage" />
          </div>

          {/* ═══ ACTIVE STATION BODY ═══ */}
          {/* Each workflow renders its own titled card (full station name +
              controls + table), so we don't wrap it in a second card/header —
              that just duplicated the title and pushed the table down. */}
          <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
            {activeTab === 'ward' && <WardWorkflow filters={wardFilters} setFilters={setWardFilters} />}
            {activeTab === 'mar' && <MarWorkflow />}
            {activeTab === 'triage' && <TriageWorkflow />}
            {activeTab === 'handoff' && <HandoffWorkflow variant="page" />}
          </div>

        </div>
      </main>
    </>
  );
}
