'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  ArrowRightLeft, Plus, Printer,
  PieChart as PieChartIcon,
} from '@/components/icons/lucide';
import { usePatients } from '@/lib/hooks/usePatients';
import { useTriage } from '@/lib/hooks/useTriage';
import { useWards } from '@/lib/hooks/useWards';
import { patientFullName, patientGenderAge, patientRegisteredAt } from '@/lib/patient-utils';
import { getRoleConfig } from '@/lib/permissions';
import { DEMO_WARD_PATIENTS, IS_DEMO } from '@/components/nurse/shared';
import EhrCareDashboard, { type EhrCareDashboardAction, type EhrCareDashboardRow } from '@/components/ehr/EhrCareDashboard';
import { tooltipStyle } from '@/components/ChartCard';
import WardWorkflow from './WardWorkflow';
import MarWorkflow from './MarWorkflow';
import TriageWorkflow from './TriageWorkflow';
import RoomingWorkflow from './RoomingWorkflow';
import HandoffWorkflow from './HandoffWorkflow';

/* Handoff is no longer a station: it is a dialog raised by "Start handoff", so
   it has no tab and no board of its own. Triage and rooming remain addressable
   stations — the "New triage" action and queue deep links open them — but they
   are not offered as tabs either; the strip is the two boards a nurse parks on
   for a shift. */
type StationTab = 'ward' | 'mar' | 'triage' | 'rooming';
const STATION_TABS: readonly StationTab[] = ['ward', 'mar', 'triage', 'rooming'];

function isStationTab(value: string | null): value is StationTab {
  return !!value && STATION_TABS.includes(value as StationTab);
}

// Chart palette per design spec: flat clinical look, matched to triage colors.
const CHART_GREEN = '#199e70';
const CHART_RED = '#e34948';
const CHART_AMBER = '#eda100';

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
  const { currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const routineTriage = triageToday.filter(tr => tr.priority === 'GREEN').length;

  // Triage queue by acuity — today's RED/YELLOW/GREEN split, straight from
  // triage-service data already loaded above (no extra fetch).
  const acuityData = useMemo(() => ([
    { name: 'Red', value: criticalTriage, color: CHART_RED },
    { name: 'Yellow', value: urgentTriage, color: CHART_AMBER },
    { name: 'Green', value: routineTriage, color: CHART_GREEN },
  ]), [criticalTriage, urgentTriage, routineTriage]);
  const acuityTotal = criticalTriage + urgentTriage + routineTriage;

  // The station is URL-addressable so notifications, redirects, bookmarks, and
  // the browser back button can return a nurse to the exact station they need.
  // Null until the nurse explicitly picks a station, so the role-aware default
  // below can resolve after currentUser hydrates: a rooming nurse's home
  // station is Rooming (KAN-108 AC-1); everyone else starts on the ward board.
  const [fallbackStation, setFallbackStation] = useState<StationTab | null>(() => (
    isStationTab(searchParams.get('station')) ? searchParams.get('station') as StationTab : null
  ));
  const urlStation = searchParams.get('station');
  const initialTriagePatientId = searchParams.get('patient') ?? undefined;
  const defaultStation: StationTab = currentUser?.role === 'rooming_nurse' ? 'rooming' : 'ward';
  const activeTab: StationTab = isStationTab(urlStation) ? urlStation : (fallbackStation ?? defaultStation);

  // Free-text search for the station lives in the LEFT RAIL (between the
  // mini-calendar and the day chart); WardWorkflow receives it as a prop so
  // the board has no inline search bar of its own.
  const [railSearch, setRailSearch] = useState('');

  // The shift handoff, as a dialog over whichever board the nurse is on.
  // `?station=handoff` still opens it, so the /dashboard/nurse/handoff redirect,
  // the shift tour and any existing bookmark all land on the same thing they
  // used to — it is a dialog now rather than a fifth board.
  const [handoffOpen, setHandoffOpen] = useState(urlStation === 'handoff');
  useEffect(() => {
    if (urlStation === 'handoff') setHandoffOpen(true);
  }, [urlStation]);

  const stationLabel = useMemo<Record<StationTab, string>>(() => ({
    ward: t('nurse.tabWard'),
    mar: t('nurse.tabMar'),
    triage: t('nurse.tabTriage'),
    rooming: 'Rooming',
  }), [t]);

  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;

  // Tab counts must match what each station board actually displays. The ward
  // board (shared.tsx `wardPatients`) swaps in the demo roster when the real
  // roster is thin in demo mode — mirror that rule here so the tab never says
  // "0" above a visibly populated board.
  const wardBoardCount = (patients.length >= 10 || !IS_DEMO) ? patients.length : DEMO_WARD_PATIENTS.length;
  // The two boards a nurse works a shift from. Triage, rooming and handoff came
  // off this strip: each is a task you start and finish, not a place to sit, and
  // the three of them pushed the two standing boards to the far left of a
  // five-tab row.
  const stationTabs = useMemo(() => ([
    { key: 'ward' as const, label: stationLabel.ward, count: wardBoardCount },
    // MAR carries no count: its board lists medication entries (built inside
    // MarWorkflow), and the only number available here — active admissions —
    // routinely disagrees with what the board displays. No count beats a
    // wrong one.
    { key: 'mar' as const, label: stationLabel.mar },
  ]), [wardBoardCount, stationLabel.mar, stationLabel.ward]);

  const selectStation = useCallback((station: StationTab) => {
    setFallbackStation(station);
    const params = new URLSearchParams(searchParams.toString());
    params.set('station', station);
    // A triage deep link may contain a patient id. Clear it whenever the user
    // changes stations so a later return to Triage does not reopen stale work.
    params.delete('patient');
    // Push station changes so browser Back returns to the previous station.
    router.push(`/dashboard/nurse?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Ward/MAR/Triage/Rooming/Handoff switch via the daybar tabs.
  const daybarTabs = stationTabs;

  // Header actions per the nurse-station design: "+ New triage" as the rail
  // CTA, then Print and the primary "Start handoff" on the right.
  const actions = useMemo<EhrCareDashboardAction[]>(() => ([
    { label: 'New triage', icon: Plus, onClick: () => selectStation('triage'), tone: 'primary' },
    { label: 'Print', icon: Printer, onClick: () => window.print(), tone: 'neutral' },
    { label: 'Start handoff', icon: ArrowRightLeft, onClick: () => setHandoffOpen(true), tone: 'primary' },
  ]), [selectStation]);

  // Patient portraits by id, so triage and ward rows show the same face as the
  // patient register instead of falling back to initials.
  const photoByPatientId = useMemo(() => {
    const map = new Map<string, string>();
    for (const patient of patients) {
      const photo = (patient as { photoUrl?: string }).photoUrl;
      if (photo) map.set(patient._id, photo);
    }
    return map;
  }, [patients]);

  const rows = useMemo<EhrCareDashboardRow[]>(() => {
    // The rail search filters the centre work list on every tab. Filtering
    // happens BEFORE the 10-row cap, so a match further down the queue is
    // still reachable instead of being sliced away first.
    const q = railSearch.trim().toLowerCase();
    const hit = (...values: Array<unknown>) =>
      !q || values.some(value => String(value ?? '').toLowerCase().includes(q));

    if (activeTab === 'triage') {
      return triageToday.filter(triage => hit(
        triage.patientName, triage.chiefComplaint, triage.modeOfArrival,
        triage.status, triage.priority, triage.triagedByName, triage.assignedRoom,
      )).slice(0, 10).map(triage => {
        const time = rowTime(triage.triagedAt);
        return {
          id: triage._id,
          photoUrl: photoByPatientId.get(triage.patientId),
          title: triage.patientName,
          subtitle: triage.chiefComplaint || 'ETAT assessment',
          meta: `${triage.modeOfArrival || 'walk-in'} · ${time || 'No time'}`,
          time,
          timeSecondary: (triage.triagedAt || today).slice(0, 10),
          status: triage.status,
          statusLabel: triage.status === 'seen' ? 'Seen' : triage.status === 'pending' ? 'Waiting' : triage.status,
          statusSecondary: triage.priority === 'RED' ? 'Critical' : triage.priority === 'YELLOW' ? 'Urgent' : 'Routine',
          statusTone: triage.priority === 'RED' ? 'danger' : triage.priority === 'YELLOW' ? 'warning' : 'ready',
          // RED/YELLOW need attention now (Urgent); GREEN is routine — a more
          // useful split for this station than the done-based default, which
          // would never place a still-open triage in the second series.
          chartSeries: (triage.priority === 'RED' || triage.priority === 'YELLOW' ? 0 : 1) as 0 | 1,
          priority: triage.priority,
          careTeam: triage.triagedByName || 'Nurse unassigned',
          careTeamSecondary: 'Triage nurse',
          careTeamLabel: 'Care team',
          room: triage.assignedRoom,
          locationSecondary: triage.modeOfArrival || 'Triage',
          date: (triage.triagedAt || today).slice(0, 10),
          patientId: triage.patientId,
          onClick: () => router.push(`/patients/${triage.patientId}`),
          actionLabel: 'Open',
          onAction: () => router.push(`/patients/${triage.patientId}`),
        };
      });
    }

    if (activeTab === 'mar') {
      return activeAdmissions.filter(admission => hit(
        admission.patientName, admission.wardName, admission.bedNumber, admission.hospitalNumber,
        admission.admittingDiagnosis, admission.attendingPhysicianName, admission.nurseAssignedName,
      )).slice(0, 10).map(admission => {
        const time = rowTime(admission.admissionDate);
        return {
          id: admission._id,
          photoUrl: photoByPatientId.get(admission.patientId),
          title: admission.patientName,
          subtitle: `${admission.wardName}${admission.bedNumber ? ` · Bed ${admission.bedNumber}` : ''}`,
          meta: `${admission.hospitalNumber || 'No MRN'} · ${admission.admittingDiagnosis || 'No diagnosis'} · ${admission.attendingPhysicianName || 'No physician'}`,
          time,
          timeSecondary: (admission.admissionDate || today).slice(0, 10),
          status: 'admitted',
          statusLabel: 'Admitted',
          statusSecondary: admission.severity === 'critical' ? 'Critical' : admission.severity === 'severe' ? 'Severe' : 'Stable',
          statusTone: admission.severity === 'critical' ? 'danger' : admission.severity === 'severe' ? 'warning' : 'ready',
          chartSeries: (admission.severity === 'critical' || admission.severity === 'severe' ? 0 : 1) as 0 | 1,
          // Admission severity is a real acuity — same RED/YELLOW pill as
          // triage, not a free-text label.
          priority: admission.severity === 'critical' ? 'RED' : admission.severity === 'severe' ? 'YELLOW' : undefined,
          careTeam: admission.attendingPhysicianName || 'Doctor unassigned',
          careTeamSecondary: admission.nurseAssignedName || 'Nurse unassigned',
          careTeamLabel: 'Care team',
          room: admission.bedNumber ? `${admission.wardName} · Bed ${admission.bedNumber}` : admission.wardName,
          locationSecondary: 'Ward',
          date: (admission.admissionDate || today).slice(0, 10),
          patientId: admission.patientId,
          onClick: () => router.push(`/wards/mar/${admission._id}`),
          actionLabel: 'MAR',
          onAction: () => router.push(`/wards/mar/${admission._id}`),
        };
      });
    }

    return patients.filter(patient => hit(
      patientFullName(patient), patient.hospitalNumber, patient.phone,
      patient.county, patient.state, patient.assignedDoctorName,
    )).slice(0, 10).map(patient => {
      const time = rowTime(patientRegisteredAt(patient));
      return {
        id: patient._id,
        photoUrl: (patient as { photoUrl?: string }).photoUrl,
        title: patientFullName(patient),
        subtitle: patientGenderAge(patient),
        meta: `${patient.hospitalNumber || 'No MRN'} · ${patient.phone || 'No phone'} · ${patient.county || 'No location'}`,
        time,
        timeSecondary: (patient.registeredAt || patient.registrationDate || today).slice(0, 10),
        status: patient.assignedDoctor ? 'assigned' : 'needs routing',
        statusLabel: patient.assignedDoctor ? 'Assigned' : 'Needs routing',
        statusSecondary: patient.assignedDoctor ? 'Care team assigned' : 'Needs care team',
        statusTone: patient.assignedDoctor ? 'ready' : 'warning',
        // Already routed to a doctor is "Routine"; still needing routing is "Urgent".
        chartSeries: (patient.assignedDoctor ? 1 : 0) as 0 | 1,
        // Age already reads in the subtitle (patientGenderAge) — it isn't an
        // acuity, so it doesn't belong in the priority pill.
        careTeam: patient.assignedDoctorName || 'Doctor unassigned',
        careTeamSecondary: patient.assignedByName || 'Nurse unassigned',
        careTeamLabel: 'Care team',
        room: patient.county || patient.state,
        locationSecondary: 'Location',
        date: (patient.registeredAt || patient.registrationDate || today).slice(0, 10),
        patientId: patient._id,
        onClick: () => router.push(`/patients/${patient._id}`),
        actionLabel: 'Open',
        onAction: () => router.push(`/patients/${patient._id}`),
      };
    });
  }, [activeAdmissions, activeTab, patients, photoByPatientId, railSearch, router, today, triageToday]);

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

  if (!currentUser) return null;

  return (
    <>
      <main className="page-container page-enter">
        <EhrCareDashboard
          title={t('nurse.title')}
          eyebrow={roleConfig?.label || 'Nursing'}
          greetingName={currentUser.name || 'nurse'}
          dateLabel={dateLabel}
          // All nursing stations use the same URL-addressable daybar.
          tabs={daybarTabs}
          activeTab={activeTab}
          onTabChange={(tab) => selectStation(tab as StationTab)}
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
          // Triage acuity donut — today's RED/YELLOW/GREEN split, rendered in
          // the left rail directly below the Triage activity chart.
          railContent={(
            <div className="ehr-day-stats">
              <div className="ehr-day-stats-head">
                <h3 className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4" style={{ color: CHART_RED }} />
                  Triage acuity today
                </h3>
              </div>
              {acuityTotal === 0 ? (
                <p className="ehr-day-stats-empty">No triages recorded today</p>
              ) : (
                <div className="flex items-center gap-4" style={{ marginTop: 12 }}>
                  <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={acuityData} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={3} stroke="none">
                          {acuityData.map(d => <Cell key={d.name} fill={d.color} />)}
                        </Pie>
                        <Tooltip {...tooltipStyle} formatter={(v, name) => [v ?? 0, String(name ?? '')]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{acuityTotal}</span>
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>seen today</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {acuityData.map(d => (
                      <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.color }} />
                          {d.name}
                        </span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          // The rail search and global module menu already provide patient and
          // cross-service navigation. Keeping a second action strip here made
          // the same destinations appear twice on every nursing station.
          rows={rows}
          // The design's daybar carries only the station title + tabs — the
          // tabs already show each board's count, so no subtitle.
          centerTitle="Nursing station"
          centerSubtitle=""
          metrics={metrics}
          calendarEventDates={[
            ...triageToday.map(triage => (triage.triagedAt || today).slice(0, 10)),
            ...activeAdmissions.map(admission => (admission.admissionDate || today).slice(0, 10)),
          ]}
          metricsTitle="Today's triage"
          emptyTitle="No patients in this station"
          hideRowList
        >
          <div className="flex flex-col" style={{ minHeight: 0 }}>
            {activeTab === 'ward' && <WardWorkflow search={railSearch} showHeader={false} />}
            {activeTab === 'mar' && <MarWorkflow />}
            {activeTab === 'triage' && <TriageWorkflow initialPatientId={initialTriagePatientId} />}
            {activeTab === 'rooming' && <RoomingWorkflow />}
          </div>
        </EhrCareDashboard>

        {handoffOpen && (
          <HandoffWorkflow
            variant="modal"
            onClose={() => setHandoffOpen(false)}
          />
        )}
      </main>
    </>
  );
}
