'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  BedDouble, ArrowRightLeft, Plus, Printer,
  Syringe, Users, Calendar, Activity, Baby, UserX,
} from '@/components/icons/lucide';
import type { WardDoc } from '@/lib/db-types-ward';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import { useWards } from '@/lib/hooks/useWards';
import { patientFullName, patientGenderAge, patientRegisteredAt } from '@/lib/patient-utils';
import { getRoleConfig } from '@/lib/permissions';
import { DEMO_WARD_PATIENTS, IS_DEMO } from '@/components/nurse/shared';
import { useCapabilities } from '@/lib/hooks/useCapabilities';
import EhrCareDashboard, { type EhrCareDashboardAction, type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import WardWorkflow from './WardWorkflow';
import MarWorkflow from './MarWorkflow';
import TriageWorkflow from './TriageWorkflow';
import HandoffWorkflow from './HandoffWorkflow';

type StationTab = 'ward' | 'mar' | 'triage';

/* ── Ward occupancy (left rail, design 02) ──
   One meter per active ward: occupied beds over capacity, "N free" beside it.
   Amber once a ward is down to its last free bed; the in-bar count flips to
   white when the fill reaches it. Hidden entirely when no ward carries bed
   counts (small facilities). */
function WardOccupancyCard({ wards }: { wards: WardDoc[] }) {
  const active = wards.filter(ward => ward.isActive !== false && (ward.totalBeds || 0) > 0);
  if (active.length === 0) return null;
  const total = active.reduce((sum, ward) => sum + ward.totalBeds, 0);
  const used = active.reduce((sum, ward) => sum + (ward.occupiedBeds || 0), 0);
  return (
    <div className="ehr-occupancy-card">
      <div className="ehr-occupancy-head">
        <h3>Ward occupancy</h3>
        <b>{used}/{total}</b>
      </div>
      <div className="ehr-occupancy-rows">
        {active.slice(0, 6).map(ward => {
          const occupied = ward.occupiedBeds || 0;
          const free = Math.max(0, ward.totalBeds - occupied);
          const pct = Math.min(100, Math.round((occupied / ward.totalBeds) * 100));
          const tight = free <= 1;
          return (
            <div key={ward._id} className="ehr-occupancy-row">
              <div className="ehr-occupancy-row-name">
                <span title={ward.name}>{ward.name}</span>
                <b className={tight ? 'is-tight' : undefined}>{free} free</b>
              </div>
              <div className={`ehr-occupancy-bar${tight ? ' is-tight' : ''}${pct >= 92 ? ' is-full' : ''}`}>
                <i style={{ width: `${pct}%` }} />
                <span>{occupied}/{ward.totalBeds}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const { activeAdmissions, wards } = useWards();
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
  // Shift handoff opens as a popup over the dashboard, not a station view.
  const [handoffOpen, setHandoffOpen] = useState(false);

  // Free-text search for the station lives in the LEFT RAIL (between the
  // mini-calendar and the day chart); WardWorkflow receives it as a prop so
  // the board has no inline search bar of its own.
  const [railSearch, setRailSearch] = useState('');

  const stationLabel = useMemo<Record<StationTab, string>>(() => ({
    ward: t('nurse.tabWard'),
    mar: t('nurse.tabMar'),
    triage: t('nurse.tabTriage'),
  }), [t]);

  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;
  const allowedRoutes = useMemo(() => roleConfig?.allowedRoutes ?? [], [roleConfig]);
  const canUseRoute = useCallback((href: string) => allowedRoutes.includes(href), [allowedRoutes]);

  // Tab counts must match what each station board actually displays. The ward
  // board (shared.tsx `wardPatients`) swaps in the demo roster when the real
  // roster is thin in demo mode — mirror that rule here so the tab never says
  // "0" above a visibly populated board.
  const wardBoardCount = (patients.length >= 10 || !IS_DEMO) ? patients.length : DEMO_WARD_PATIENTS.length;
  const stationTabs = useMemo(() => ([
    { key: 'ward' as const, label: stationLabel.ward, count: wardBoardCount },
    // MAR carries no count: its board lists medication entries (built inside
    // MarWorkflow), and the only number available here — active admissions —
    // routinely disagrees with what the board displays. No count beats a
    // wrong one.
    { key: 'mar' as const, label: stationLabel.mar },
    { key: 'triage' as const, label: stationLabel.triage, count: triageToday.length },
  ]), [wardBoardCount, stationLabel.mar, stationLabel.triage, stationLabel.ward, triageToday.length]);

  // Ward/MAR/Triage switch via the daybar tabs (design 02); Handoff is a popup.
  const daybarTabs = stationTabs;
  useEffect(() => {
    if (!daybarTabs.some(tab => tab.key === activeTab) && daybarTabs[0]) {
      setActiveTab(daybarTabs[0].key);
    }
  }, [activeTab, daybarTabs]);

  // Header actions per the nurse-station design: "+ New triage" as the rail
  // CTA, then Print and the primary "Start handoff" on the right.
  const actions = useMemo<EhrCareDashboardAction[]>(() => ([
    { label: 'New triage', icon: Plus, onClick: () => setActiveTab('triage'), tone: 'primary' },
    { label: 'Print', icon: Printer, onClick: () => window.print(), tone: 'neutral' },
    { label: 'Start handoff', icon: ArrowRightLeft, onClick: () => setHandoffOpen(true), tone: 'primary' },
  ]), []);

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
          statusLabel: 'Admitted',
          statusTone: admission.severity === 'critical' ? 'danger' : admission.severity === 'severe' ? 'warning' : 'ready',
          chartSeries: (admission.severity === 'critical' || admission.severity === 'severe' ? 0 : 1) as 0 | 1,
          // Admission severity is a real acuity — same RED/YELLOW pill as
          // triage, not a free-text label.
          priority: admission.severity === 'critical' ? 'RED' : admission.severity === 'severe' ? 'YELLOW' : undefined,
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
        statusLabel: patient.assignedDoctor ? 'Assigned' : 'Needs routing',
        statusTone: patient.assignedDoctor ? 'ready' : 'warning',
        // Already routed to a doctor is "Routine"; still needing routing is "Urgent".
        chartSeries: (patient.assignedDoctor ? 1 : 0) as 0 | 1,
        // Age already reads in the subtitle (patientGenderAge) — it isn't an
        // acuity, so it doesn't belong in the priority pill.
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

  // Capabilities card — each item latches checked forever the first time this
  // nurse does it (see useCapabilities), never un-checked by later state.
  const capabilityItems = useMemo(() => ([
    {
      key: 'nurse.triage',
      label: 'Complete a triage assessment',
      // Scoped to assessments THIS nurse performed, not the whole facility's queue.
      signal: triageToday.some(tr => tr.triagedBy === currentUser?._id),
      onClick: () => setActiveTab('triage'),
    },
    // WardWorkflow's rows only navigate to the patient chart's Vitals tab —
    // recording itself happens on that page, outside this dashboard's reach,
    // so there's no completion point to latch on here. Stays unchecked until
    // the nurse actually records a vital sign in the chart.
    { key: 'nurse.vitals', label: 'Record ward vitals', onClick: () => setActiveTab('ward') },
    { key: 'nurse.mar', label: 'Administer medications (MAR)', onClick: () => setActiveTab('mar') },
    { key: 'nurse.handoff', label: 'Hand off a shift', onClick: () => setHandoffOpen(true) },
  ]), [triageToday, currentUser?._id]);
  const { checklist, mark: markCapability } = useCapabilities(currentUser?._id, capabilityItems);

  if (!currentUser) return null;

  return (
    <>
      <main className="page-container page-enter">
        <EhrCareDashboard
          title={t('nurse.title')}
          eyebrow={roleConfig?.label || 'Nursing'}
          greetingName={currentUser.name || 'nurse'}
          dateLabel={dateLabel}
          // Ward/MAR/Triage switch uses the shared doctor-module daybar pills;
          // Handoff opens from the header button.
          tabs={daybarTabs}
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
          chartTitle="Triage activity"
          chartSeriesNames={['Acute', 'Routine']}
          railContent={<WardOccupancyCard wards={wards} />}
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
          // The design's daybar carries only the station title + tabs — the
          // tabs already show each board's count, so no subtitle.
          centerTitle="Nursing station"
          centerSubtitle=""
          metrics={metrics}
          checklist={checklist}
          calendarEventDates={[
            ...triageToday.map(triage => (triage.triagedAt || today).slice(0, 10)),
            ...activeAdmissions.map(admission => (admission.admissionDate || today).slice(0, 10)),
          ]}
          metricsTitle="Today's triage"
          checklistTitle="Capabilities"
          checklistDescription="Ward care, triage, medications, and handoff."
          emptyTitle="No patients in this station"
          hideRowList
        >
          <div className="flex flex-col" style={{ minHeight: 0 }}>
            {activeTab === 'ward' && <WardWorkflow search={railSearch} showHeader={false} />}
            {activeTab === 'mar' && <MarWorkflow onAdminister={() => markCapability('nurse.mar')} />}
            {activeTab === 'triage' && <TriageWorkflow />}
          </div>
        </EhrCareDashboard>
        {handoffOpen && (
          <HandoffWorkflow
            variant="modal"
            onClose={() => setHandoffOpen(false)}
            onSigned={() => markCapability('nurse.handoff')}
          />
        )}
      </main>
    </>
  );
}
