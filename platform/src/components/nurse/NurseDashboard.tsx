'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Pill, FileText, BedDouble, AlertTriangle,
  Syringe, Users, Calendar, Activity, Baby, UserX,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import { useWards } from '@/lib/hooks/useWards';
import { patientAgeLabel, patientFullName, patientGenderAge, patientRegisteredAt } from '@/lib/patient-utils';
import { getRoleConfig } from '@/lib/permissions';
import EhrCareDashboard, { type EhrCareDashboardAction, type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import WardWorkflow from './WardWorkflow';
import MarWorkflow from './MarWorkflow';
import TriageWorkflow from './TriageWorkflow';
import HandoffWorkflow from './HandoffWorkflow';

type StationTab = 'ward' | 'mar' | 'triage' | 'handoff';

// Only plots a time when the source field is a full timestamp (contains a
// clock component) — registration/admission dates are sometimes date-only,
// and an invented hour would misreport when the work actually happened.
function rowTime(iso?: string): string | undefined {
  if (!iso || !/T\d{2}:\d{2}/.test(iso)) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

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
  // Ward-roster acuity/status counts, mirrored from the Ward patients view so
  // the station side card carries the same at-a-glance numbers.
  const urgentTriage = triageToday.filter(tr => tr.priority === 'YELLOW').length;
  const waitingTriage = triageToday.filter(tr => tr.status === 'pending').length;
  const inConsultTriage = triageToday.filter(tr => tr.status === 'seen').length;

  // The Quick Actions cards act as the station switcher — each swaps the inline
  // body below (the clinical-officer dashboard pattern: quick-action cards drive
  // the view rather than top-bar tabs).
  const [activeTab, setActiveTab] = useState<StationTab>('ward');

  // Free-text search for the station lives in the LEFT RAIL (between the
  // mini-calendar and the day chart); WardWorkflow receives it as a prop so
  // the board has no inline search bar of its own.
  const [railSearch, setRailSearch] = useState('');

  const stationLabel = useMemo<Record<StationTab, string>>(() => ({
    ward: t('nurse.tabWard'),
    mar: t('nurse.tabMar'),
    triage: t('nurse.tabTriage'),
    handoff: t('nurse.shiftHandoff'),
  }), [t]);

  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;
  const allowedRoutes = useMemo(() => roleConfig?.allowedRoutes ?? [], [roleConfig]);
  const canUseRoute = useCallback((href: string) => allowedRoutes.includes(href), [allowedRoutes]);

  const stationTabs = useMemo(() => ([
    { key: 'ward' as const, label: stationLabel.ward, count: activeAdmissions.length || patients.length },
    { key: 'mar' as const, label: stationLabel.mar, count: activeAdmissions.length },
    { key: 'triage' as const, label: stationLabel.triage, count: triageToday.length },
    { key: 'handoff' as const, label: stationLabel.handoff },
  ]), [activeAdmissions.length, patients.length, stationLabel.handoff, stationLabel.mar, stationLabel.triage, stationLabel.ward, triageToday.length]);

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
    return stationActions;
  }, [activeTab, stationTabs]);

  const rows = useMemo<EhrCareDashboardRow[]>(() => {
    if (activeTab === 'triage') {
      return triageToday.slice(0, 10).map(triage => {
        const time = rowTime(triage.triagedAt);
        return {
          id: triage._id,
          title: triage.patientName,
          subtitle: triage.chiefComplaint || 'ETAT assessment',
          meta: `${triage.modeOfArrival || 'walk-in'} · ${time || 'No time'}`,
          time,
          status: triage.status,
          statusTone: triage.priority === 'RED' ? 'danger' : triage.priority === 'YELLOW' ? 'warning' : 'ready',
          // RED/YELLOW need attention now (Urgent); GREEN is routine — a more
          // useful split for this station than the done-based default, which
          // would never place a still-open triage in the second series.
          chartSeries: (triage.priority === 'RED' || triage.priority === 'YELLOW' ? 0 : 1) as 0 | 1,
          priority: triage.priority,
          room: triage.assignedRoom,
          date: (triage.triagedAt || today).slice(0, 10),
          onClick: () => router.push(`/patients/${triage.patientId}`),
          actionLabel: 'Open',
          onAction: () => router.push(`/patients/${triage.patientId}`),
        };
      });
    }

    if (activeTab === 'mar') {
      return activeAdmissions.slice(0, 10).map(admission => {
        const time = rowTime(admission.admissionDate);
        return {
          id: admission._id,
          title: admission.patientName,
          subtitle: `${admission.wardName}${admission.bedNumber ? ` · Bed ${admission.bedNumber}` : ''}`,
          meta: `${admission.hospitalNumber || 'No MRN'} · ${admission.admittingDiagnosis || 'No diagnosis'} · ${admission.attendingPhysicianName || 'No physician'}`,
          time,
          status: 'admitted',
          statusTone: admission.severity === 'critical' ? 'danger' : admission.severity === 'severe' ? 'warning' : 'ready',
          chartSeries: (admission.severity === 'critical' || admission.severity === 'severe' ? 0 : 1) as 0 | 1,
          priority: admission.severity,
          room: admission.nurseAssignedName,
          date: (admission.admissionDate || today).slice(0, 10),
          onClick: () => router.push(`/wards/mar/${admission._id}`),
          actionLabel: 'MAR',
          onAction: () => router.push(`/wards/mar/${admission._id}`),
        };
      });
    }

    return patients.slice(0, 10).map(patient => {
      const time = rowTime(patientRegisteredAt(patient));
      return {
        id: patient._id,
        title: patientFullName(patient),
        subtitle: patientGenderAge(patient),
        meta: `${patient.hospitalNumber || 'No MRN'} · ${patient.phone || 'No phone'} · ${patient.county || 'No location'}`,
        time,
        status: patient.assignedDoctor ? 'assigned' : 'needs routing',
        statusTone: patient.assignedDoctor ? 'ready' : 'warning',
        // Already routed to a doctor is "Routine"; still needing routing is "Urgent".
        chartSeries: (patient.assignedDoctor ? 1 : 0) as 0 | 1,
        priority: patientAgeLabel(patient),
        room: patient.assignedDoctorName,
        date: (patient.registeredAt || patient.registrationDate || today).slice(0, 10),
        onClick: () => router.push(`/patients/${patient._id}`),
        actionLabel: 'Open',
        onAction: () => router.push(`/patients/${patient._id}`),
      };
    });
  }, [activeAdmissions, activeTab, patients, router, today, triageToday]);

  const dateLabel = useMemo(() => (
    new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' }).format(new Date())
  ), []);

  // Critical/Urgent/Waiting/In consult are acuity signals not already surfaced
  // by a tab count — Patients/Active admissions/Triage today were dropped as
  // they just echoed the Ward/MAR/Triage tab counts above.
  const metrics = useMemo(() => ([
    { label: 'Critical', value: criticalTriage, tone: criticalTriage > 0 ? 'danger' as const : 'neutral' as const },
    { label: 'Urgent', value: urgentTriage, tone: urgentTriage > 0 ? 'warning' as const : 'neutral' as const },
    { label: 'Waiting', value: waitingTriage },
    { label: 'In consult', value: inConsultTriage },
  ]), [criticalTriage, urgentTriage, waitingTriage, inConsultTriage]);

  const checklist = useMemo(() => ([
    { label: 'Complete triage queue', done: triageToday.length === 0, onClick: () => setActiveTab('triage') },
  ]), [triageToday.length]);

  if (!currentUser) return null;

  return (
    <>
      <main className="page-container page-enter">
        <EhrCareDashboard
          title={t('nurse.title')}
          eyebrow={roleConfig?.label || 'Nursing'}
          greetingName={currentUser.name || 'nurse'}
          dateLabel={dateLabel}
          tabs={stationTabs}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as StationTab)}
          searchValue={railSearch}
          onSearchChange={setRailSearch}
          searchPlaceholder={t('nurse.searchPatientPlaceholder')}
          filters={[]}
          actions={actions}
          // Meaning shifts with the active station (triage acuity, admission
          // severity, or routing status), so chartSeries is set explicitly per
          // row rather than relying on the done-based default — none of these
          // three stations' rows ever reach a 'done' statusTone.
          chartSeriesNames={['Urgent', 'Routine']}
          actionStrip={[
            ...(canUseRoute('/patients') ? [{ label: 'Patient search', icon: Users, onClick: () => router.push('/patients') }] : []),
            ...(canUseRoute('/wards') ? [{ label: 'Wards', icon: BedDouble, onClick: () => router.push('/wards') }] : []),
            ...(canUseRoute('/lab') ? [{ label: 'Lab results', icon: Activity, onClick: () => router.push('/lab') }] : []),
            ...(canUseRoute('/immunizations') ? [{ label: 'Immunizations', icon: Syringe, onClick: () => router.push('/immunizations') }] : []),
            ...(canUseRoute('/anc') ? [{ label: 'ANC', icon: Baby, onClick: () => router.push('/anc') }] : []),
            ...(canUseRoute('/births') ? [{ label: 'Births', icon: Baby, onClick: () => router.push('/births') }] : []),
            ...(canUseRoute('/deaths') ? [{ label: 'Deaths', icon: UserX, onClick: () => router.push('/deaths') }] : []),
            ...(canUseRoute('/appointments') ? [{ label: 'Appointments', icon: Calendar, onClick: () => router.push('/appointments') }] : []),
          ]}
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
          emptyTitle="No patients in this station"
          hideRowList
        >
          <div className="flex flex-col" style={{ minHeight: 0 }}>
            {activeTab === 'ward' && <WardWorkflow search={railSearch} showHeader={false} />}
            {activeTab === 'mar' && <MarWorkflow />}
            {activeTab === 'triage' && <TriageWorkflow />}
            {activeTab === 'handoff' && <HandoffWorkflow variant="page" />}
          </div>
        </EhrCareDashboard>
      </main>
    </>
  );
}
