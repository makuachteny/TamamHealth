'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Pill, FileText, BedDouble, AlertTriangle,
  Syringe, HeartPulse, Users, SendHorizontal,
  ClipboardCheck, Calendar, FlaskConical,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import { useWards } from '@/lib/hooks/useWards';
import { patientAgeLabel, patientFullName, patientGenderAge } from '@/lib/patient-utils';
import { getRoleConfig } from '@/lib/permissions';
import EhrCareDashboard, { type EhrCareDashboardAction, type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
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
  const { activeAdmissions } = useWards();
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

  const stationLabel = useMemo<Record<StationTab, string>>(() => ({
    ward: t('nurse.tabWard'),
    mar: t('nurse.tabMar'),
    triage: t('nurse.tabTriage'),
    handoff: t('nurse.shiftHandoff'),
  }), [t]);

  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;
  const allowedRoutes = useMemo(() => roleConfig?.allowedRoutes ?? [], [roleConfig]);
  const canUseRoute = useCallback((href: string) => allowedRoutes.includes(href), [allowedRoutes]);

  const stationTabs = useMemo(() => {
    const tabs: { key: StationTab; label: string; count: number }[] = [];
    if (currentUser?.role === 'triage_nurse') {
      tabs.push({ key: 'triage', label: stationLabel.triage, count: triageToday.length });
      tabs.push({ key: 'ward', label: stationLabel.ward, count: patients.length });
      return tabs;
    }
    if (currentUser?.role === 'rooming_nurse') {
      tabs.push({ key: 'ward', label: 'Rooming', count: patients.length });
      tabs.push({ key: 'triage', label: stationLabel.triage, count: triageToday.length });
      return tabs;
    }
    tabs.push({ key: 'ward', label: stationLabel.ward, count: activeAdmissions.length || patients.length });
    tabs.push({ key: 'mar', label: stationLabel.mar, count: activeAdmissions.length });
    tabs.push({ key: 'triage', label: stationLabel.triage, count: triageToday.length });
    tabs.push({ key: 'handoff', label: stationLabel.handoff, count: 0 });
    return tabs;
  }, [activeAdmissions.length, currentUser?.role, patients.length, stationLabel.handoff, stationLabel.mar, stationLabel.triage, stationLabel.ward, triageToday.length]);

  useEffect(() => {
    if (!stationTabs.some(tab => tab.key === activeTab) && stationTabs[0]) {
      setActiveTab(stationTabs[0].key);
    }
  }, [activeTab, stationTabs]);

  const actions = useMemo<EhrCareDashboardAction[]>(() => {
    const stationActions: EhrCareDashboardAction[] = stationTabs.map(tab => ({
      label: tab.label,
      icon: tab.key === 'ward' ? BedDouble : tab.key === 'mar' ? Pill : tab.key === 'triage' ? AlertTriangle : FileText,
      onClick: () => setActiveTab(tab.key),
      active: activeTab === tab.key,
      tone: activeTab === tab.key ? 'primary' : 'neutral',
    }));
    const routeActions: EhrCareDashboardAction[] = [
      ...(canUseRoute('/patients') ? [{ label: t('dashboard.newPatient'), icon: Users, onClick: () => router.push('/patients/new') }] : []),
      ...(canUseRoute('/patient-intake') ? [{ label: 'Patient intake', icon: ClipboardCheck, onClick: () => router.push('/patient-intake') }] : []),
      ...(canUseRoute('/immunizations') ? [{ label: t('dashboard.immunization'), icon: Syringe, onClick: () => router.push('/immunizations') }] : []),
      ...(canUseRoute('/anc') ? [{ label: t('dashboard.ancVisit'), icon: HeartPulse, onClick: () => router.push('/anc') }] : []),
      ...(canUseRoute('/referrals') ? [{ label: t('nav.referrals'), icon: SendHorizontal, onClick: () => router.push('/referrals') }] : []),
      ...(canUseRoute('/appointments') ? [{ label: t('nav.appointments'), icon: Calendar, onClick: () => router.push('/appointments') }] : []),
      ...(canUseRoute('/lab') ? [{ label: 'Lab results', icon: FlaskConical, onClick: () => router.push('/lab') }] : []),
    ];
    return [...stationActions, ...routeActions];
  }, [activeTab, canUseRoute, router, stationTabs, t]);

  const rows = useMemo<EhrCareDashboardRow[]>(() => {
    if (activeTab === 'triage') {
      return triageToday.slice(0, 10).map(triage => ({
        id: triage._id,
        title: triage.patientName,
        subtitle: triage.chiefComplaint || 'ETAT assessment',
        meta: `${triage.modeOfArrival || 'walk-in'} · ${triage.triagedAt ? new Date(triage.triagedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'No time'}`,
        status: triage.status,
        statusTone: triage.priority === 'RED' ? 'danger' : triage.priority === 'YELLOW' ? 'warning' : 'ready',
        priority: triage.priority,
        room: triage.assignedRoom,
        date: (triage.triagedAt || today).slice(0, 10),
        onClick: () => router.push(`/patients/${triage.patientId}`),
        actionLabel: 'Open',
        onAction: () => router.push(`/patients/${triage.patientId}`),
      }));
    }

    if (activeTab === 'mar') {
      return activeAdmissions.slice(0, 10).map(admission => ({
        id: admission._id,
        title: admission.patientName,
        subtitle: `${admission.wardName}${admission.bedNumber ? ` · Bed ${admission.bedNumber}` : ''}`,
        meta: `${admission.hospitalNumber || 'No MRN'} · ${admission.admittingDiagnosis || 'No diagnosis'} · ${admission.attendingPhysicianName || 'No physician'}`,
        status: 'admitted',
        statusTone: admission.severity === 'critical' ? 'danger' : admission.severity === 'severe' ? 'warning' : 'ready',
        priority: admission.severity,
        room: admission.nurseAssignedName,
        date: (admission.admissionDate || today).slice(0, 10),
        onClick: () => router.push(`/wards/mar/${admission._id}`),
        actionLabel: 'MAR',
        onAction: () => router.push(`/wards/mar/${admission._id}`),
      }));
    }

    return patients.slice(0, 10).map(patient => ({
      id: patient._id,
      title: patientFullName(patient),
      subtitle: patientGenderAge(patient),
      meta: `${patient.hospitalNumber || 'No MRN'} · ${patient.phone || 'No phone'} · ${patient.county || 'No location'}`,
      status: patient.assignedDoctor ? 'assigned' : 'needs routing',
      statusTone: patient.assignedDoctor ? 'ready' : 'warning',
      priority: patientAgeLabel(patient),
      room: patient.assignedDoctorName,
      date: (patient.registeredAt || patient.registrationDate || today).slice(0, 10),
      onClick: () => router.push(`/patients/${patient._id}`),
      actionLabel: 'Open',
      onAction: () => router.push(`/patients/${patient._id}`),
    }));
  }, [activeAdmissions, activeTab, patients, router, today, triageToday]);

  const dateLabel = useMemo(() => (
    new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date())
  ), []);

  const metrics = useMemo(() => ([
    { label: 'Patients', value: patients.length },
    { label: 'Active admissions', value: activeAdmissions.length },
    { label: 'Triage today', value: triageToday.length },
    { label: 'Critical', value: criticalTriage, tone: criticalTriage > 0 ? 'danger' as const : 'neutral' as const },
    { label: 'Active station', value: stationLabel[activeTab] },
  ]), [activeAdmissions.length, activeTab, criticalTriage, patients.length, stationLabel, triageToday.length]);

  const checklist = useMemo(() => ([
    { label: 'Review assigned patients', done: patients.length === 0, onClick: () => setActiveTab('ward') },
    { label: 'Complete triage queue', done: triageToday.length === 0, onClick: () => setActiveTab('triage') },
    { label: 'Medication administration', done: activeTab === 'mar', onClick: () => setActiveTab('mar') },
    { label: 'Shift handoff', done: activeTab === 'handoff', onClick: () => setActiveTab('handoff') },
  ].filter(item => stationTabs.some(tab => item.label === 'Review assigned patients' && tab.key === 'ward' || item.label === 'Complete triage queue' && tab.key === 'triage' || item.label === 'Medication administration' && tab.key === 'mar' || item.label === 'Shift handoff' && tab.key === 'handoff'))), [activeTab, patients.length, stationTabs, triageToday.length]);

  if (!currentUser) return null;

  return (
    <>
      <TopBar title={t('nurse.title')} hideSearch />
      <main className="page-container page-enter">
        <EhrCareDashboard
          title={currentUser.role === 'triage_nurse' ? 'Triage station' : currentUser.role === 'rooming_nurse' ? 'Rooming station' : t('nurse.title')}
          eyebrow={roleConfig?.label || 'Nursing'}
          greetingName={currentUser.name || 'nurse'}
          dateLabel={dateLabel}
          tabs={stationTabs}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as StationTab)}
          filters={stationTabs.map(tab => ({
            label: tab.label,
            value: tab.count,
            active: activeTab === tab.key,
            onClick: () => setActiveTab(tab.key),
          }))}
          actions={actions}
          rows={rows}
          metrics={metrics}
          checklist={checklist}
          calendarEventDates={[
            ...triageToday.map(triage => (triage.triagedAt || today).slice(0, 10)),
            ...activeAdmissions.map(admission => (admission.admissionDate || today).slice(0, 10)),
          ]}
          metricsTitle="Nursing station"
          checklistTitle="Nursing checklist"
          checklistDescription="Ward care, triage, medications, and handoff."
          missionTitle="Bedside care"
          missionDescription="Keep assigned patients, urgent triage, and medication work visible."
          showMissionCard={false}
          emptyTitle="No patients in this station"
        >
          <div className="flex flex-col" style={{ minHeight: 0 }}>
            {activeTab === 'ward' && <WardWorkflow filters={wardFilters} setFilters={setWardFilters} />}
            {activeTab === 'mar' && <MarWorkflow />}
            {activeTab === 'triage' && <TriageWorkflow />}
            {activeTab === 'handoff' && <HandoffWorkflow variant="page" />}
          </div>
        </EhrCareDashboard>
      </main>
    </>
  );
}
