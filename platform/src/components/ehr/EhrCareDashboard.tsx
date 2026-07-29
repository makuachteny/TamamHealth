'use client';

import { Children, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Search, Stethoscope, X, type LucideIcon } from '@/components/icons/lucide';
import ProgressFeedCard from '@/components/ehr/ProgressFeedCard';
import EhrMiniCalendar, { formatDateTitle, parseIsoDate, startOfMonth, toIsoDate } from '@/components/ehr/EhrMiniCalendar';
import { EhrWeekActivityChart, type DayStatsItem } from '@/components/ehr/EhrDayStatsChart';
import { PRIORITY_META } from '@/components/ehr/EhrVisitPopup';
import EhrWorkItemProgress from '@/components/ehr/EhrWorkItemProgress';
import { initials, stateTint } from '@/lib/patient-utils';
import { formatAppointmentTimeUntil } from '@/lib/format-utils';

export type EhrCareDashboardAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  tone?: 'primary' | 'neutral' | 'warning' | 'success';
};

export type EhrCareDashboardTab = {
  key: string;
  label: string;
  count?: number;
};

export type EhrCareDashboardFilter = {
  label: string;
  value: number | string;
  active?: boolean;
  onClick?: () => void;
};

export type EhrCareDashboardMetric = {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  active?: boolean;
  href?: string;
  onClick?: () => void;
};

export type EhrCareDashboardRow = {
  id: string;
  title: string;
  subtitle: string;
  /** The patient's photo. When set the avatar shows the portrait; without one
   *  it falls back to initials — never a stand-in face, since the avatar is an
   *  identification cue. */
  photoUrl?: string;
  /** First line in the Wait column, usually the slot time or the time the
   *  patient entered the queue. Omit for rows with no time and the column reads
   *  "—". */
  time?: string;
  timeSecondary?: string;
  /** Full ISO timestamp behind `time`. When set, the Wait column also shows a
   *  live hours/minutes relative label under the time. */
  timeAt?: string;
  meta?: string;
  compactMeta?: string;
  careTeam?: string;
  careTeamSecondary?: string;
  careTeamLabel?: string;
  location?: string;
  locationSecondary?: string;
  locationLabel?: string;
  status?: string;
  statusSecondary?: string;
  statusLabel?: string;
  statusTone?: 'scheduled' | 'ready' | 'active' | 'done' | 'warning' | 'danger';
  priority?: string;
  room?: string;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Further row actions beyond the primary/secondary pair (e.g. the front
   *  desk's "Reschedule" / "No show"), rendered after them in the row popup. */
  extraActions?: { label: string; onClick: () => void; tone?: 'secondary' | 'danger' }[];
  detail?: ReactNode;
  popupDetail?: ReactNode;
  date?: string;
  /** Which "Day statistics" series this row belongs to — index into the
   *  dashboard's `chartSeriesNames`. Omit and the rail infers it from
   *  `statusTone` (done → second series, everything else → first). */
  chartSeries?: 0 | 1;
};

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Rows from a handful of consumers (front desk, nurse) carry a real triage
 *  acuity code on `priority`; everyone else uses `priority` as a free-text
 *  label. Only the former gets the shared clinician priority pill — this is
 *  what tells the two apart. */
function isTriageCode(value?: string): value is 'RED' | 'YELLOW' | 'GREEN' {
  return value === 'RED' || value === 'YELLOW' || value === 'GREEN';
}

function inferredChartSeries(row: EhrCareDashboardRow): 0 | 1 {
  if (row.chartSeries === 0 || row.chartSeries === 1) return row.chartSeries;
  const statusText = `${row.status || ''} ${row.statusLabel || ''}`.toLowerCase();
  if (/\b(done|complete|completed|resulted|reported|dispensed|approved|normal|checked out)\b/.test(statusText)) {
    return 1;
  }
  return row.statusTone === 'done' ? 1 : 0;
}

function detailPair(primary?: string, secondary?: string) {
  return [primary, secondary].filter(Boolean).join(' · ') || undefined;
}

function clockMinutes(value?: string): number | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (minutes > 59) return null;
  if (match[3] === 'AM') hours = hours === 12 ? 0 : hours;
  if (match[3] === 'PM') hours = hours === 12 ? 12 : hours + 12;
  return hours <= 23 ? hours * 60 + minutes : null;
}

function compareDashboardRows(a: EhrCareDashboardRow, b: EhrCareDashboardRow): number {
  const dateA = a.date || '9999-12-31';
  const dateB = b.date || '9999-12-31';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const timestampA = a.timeAt ? new Date(a.timeAt).getTime() : Number.NaN;
  const timestampB = b.timeAt ? new Date(b.timeAt).getTime() : Number.NaN;
  const timeA = clockMinutes(a.time) ?? (Number.isFinite(timestampA) ? timestampA : Number.POSITIVE_INFINITY);
  const timeB = clockMinutes(b.time) ?? (Number.isFinite(timestampB) ? timestampB : Number.POSITIVE_INFINITY);
  if (timeA !== timeB) return timeA - timeB;

  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);
}

/**
 * Stable `data-tour` anchors
 * -------------------------
 * The regions below carry `data-tour` attributes that the guided tour targets
 * (`src/lib/tour/journey-tours.ts`). They are NOT styling hooks — they exist so
 * a tour step can spotlight the thing it is describing instead of falling back
 * to a centred card floating over the page.
 *
 * Because this shell backs every role dashboard, one anchor here serves every
 * role. Renaming or removing one silently degrades those tours to floating
 * cards, so `journey-tours.test.ts` asserts each anchor still has a match here.
 */
export default function EhrCareDashboard({
  title,
  greetingName,
  dateLabel,
  tabs,
  activeTab,
  onTabChange,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filters,
  actions,
  actionStrip,
  rows,
  metrics,
  metricsActions,
  showCalendar = true,
  railContent,
  chart,
  chartTitle = 'Day activity',
  chartSeriesNames = ['Open', 'Completed'],
  showChart = true,
  calendarEventDates,
  metricsTitle = 'Today',
  missionTitle,
  missionDescription,
  footerContent,
  centerTitle,
  centerSubtitle,
  emptyTitle = 'No active work',
  emptyActionLabel,
  onEmptyAction,
  showActionStrip = false,
  showMissionCard = true,
  hideRowList = false,
  showRowOpenAction = true,
  autoOpenRowId,
  children,
}: {
  title: string;
  eyebrow?: string;
  greetingName?: string;
  dateLabel: string;
  tabs: EhrCareDashboardTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters: EhrCareDashboardFilter[];
  actions: EhrCareDashboardAction[];
  /** Quick-navigation strip shown under the work list, matching the
   *  Clinical Officer dashboard's clinical strip. Kept separate from header
   *  `actions` so nothing is duplicated between the header and the strip. */
  actionStrip?: EhrCareDashboardAction[];
  rows: EhrCareDashboardRow[];
  metrics: EhrCareDashboardMetric[];
  /** Icon + label shortcuts rendered at the bottom of the metrics ("Today")
   *  card — e.g. "View Referrals", "Appointments". Same shape as `actions`,
   *  just placed in the sidebar instead of the header/rail. */
  metricsActions?: EhrCareDashboardAction[];
  showCalendar?: boolean;
  /** Extra left-rail card(s) rendered between the day chart and the filter
   *  group — e.g. the nurse dashboard's ward-occupancy card. */
  railContent?: ReactNode;
  /** Explicit left-rail chart. When omitted, the shared "Day statistics"
   *  widget is plotted from this dashboard's own rows. */
  chart?: ReactNode;
  chartTitle?: string;
  /** The two series this station's work splits into, e.g.
   *  ['Dispensed', 'Pending'] for pharmacy. Keeps the widget identical across
   *  roles while the labels stay meaningful to each one. */
  chartSeriesNames?: [string, string];
  showChart?: boolean;
  calendarEventDates?: string[];
  metricsTitle?: string;
  missionTitle?: string;
  missionDescription?: string;
  footerContent?: ReactNode;
  centerTitle?: string;
  centerSubtitle?: string;
  emptyTitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  showActionStrip?: boolean;
  showMissionCard?: boolean;
  /** When the `children` workflow already renders its own patient list
   *  (e.g. the nurse stations' Ward/Triage/MAR workflows), set this to skip
   *  the generic row list so the workflow fills the center panel top-to-bottom
   *  instead of sitting below a duplicate list. */
  hideRowList?: boolean;
  /** Trailing pencil button on each row. Dashboards whose rows already open
   *  their own detail on click (reception) turn it off — the row *is* the
   *  affordance, so a per-row icon is just noise. */
  showRowOpenAction?: boolean;
  /** Opens a row detail popup from an external deep link, once per row id. */
  autoOpenRowId?: string | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  // The calendar main-view toggle was removed — the dashboard is the only view
  // for all users. Typed as the union so the (now-inert) calendar branches below
  // still compile; the mini-calendar sidebar (showCalendar) is unaffected.
  const effectiveView = 'dashboard' as 'dashboard' | 'calendar';
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  // Clicking a row opens a right-side detail slider where the actions live,
  // keeping the row itself clean (avatar · time · name).
  const [openRow, setOpenRow] = useState<EhrCareDashboardRow | null>(null);
  const [detailTab, setDetailTab] = useState<'visit' | 'financial'>('visit');
  const lastAutoOpenRowId = useRef<string | null>(null);
  const openDetail = (row: EhrCareDashboardRow) => { setDetailTab('visit'); setOpenRow(row); };
  const rowEventDates = useMemo(() => rows.map(row => row.date).filter((date): date is string => Boolean(date)), [rows]);
  const eventDates = calendarEventDates || rowEventDates;
  // The left rail runs the same "Day statistics" widget as the Clinical Officer
  // dashboard, plotted from this dashboard's own rows so each role sees its own
  // work. Rows carry `time`/`date` (falling back to today) and `chartSeries`;
  // when a page doesn't classify its rows, finished work (statusTone 'done')
  // forms the second series and everything still open forms the first.
  const chartItems = useMemo<DayStatsItem[]>(() => rows.map(row => ({
    date: row.date,
    time: row.time,
    series: inferredChartSeries(row),
  })), [rows]);
  const visibleRows = useMemo(() => {
    // The mini-calendar remains active in dashboard mode. Selecting a day
    // must change the worklist itself, not only the calendar highlight.
    const scopedRows = !showCalendar || rowEventDates.length === 0
      ? rows
      : rows.filter(row => row.date === selectedDate);
    return scopedRows.slice().sort(compareDashboardRows);
  }, [rowEventDates.length, rows, selectedDate, showCalendar]);
  // Live clock for the time column's countdown. Starts null so the
  // server-rendered markup and the first client render match, then ticks every
  // second so imminent meetings can show accurate seconds.
  const hasCountdown = useMemo(() => visibleRows.some(row => !!row.timeAt), [visibleRows]);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!hasCountdown) { setNow(null); return; }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [hasCountdown]);
  useEffect(() => {
    if (!openRow) return;
    const latest = visibleRows.find(row => row.id === openRow.id);
    const changed = latest && (
      latest.status !== openRow.status ||
      latest.priority !== openRow.priority ||
      latest.subtitle !== openRow.subtitle ||
      latest.meta !== openRow.meta ||
      latest.actionLabel !== openRow.actionLabel
    );
    if (latest && changed) setOpenRow(latest);
  }, [openRow, visibleRows]);
  useEffect(() => {
    if (!autoOpenRowId || lastAutoOpenRowId.current === autoOpenRowId) return;
    const row = visibleRows.find(item => item.id === autoOpenRowId);
    if (!row) return;
    lastAutoOpenRowId.current = autoOpenRowId;
    openDetail(row);
  }, [autoOpenRowId, visibleRows]);
  const selectedDateLabel = showCalendar ? formatDateTitle(selectedDate) : dateLabel;
  // The dashboard's primary action (first entry) is promoted to the header's
  // top-left slot as the Clinical Officer-style "+" CTA; every other action
  // renders in the right-hand header row (wrapping when needed) — including
  // panel toggles that swap what occupies the center.
  const primaryAction = actions[0];
  const headerActions = actions.slice(1);
  const headerTitle = greetingName ? `Welcome, ${greetingName}` : title;

  return (
    <div className="ehr-schedule-shell ehr-care-dashboard">
      <section className="ehr-schedule-header ehr-clinical-dashboard-header ehr-care-dashboard-header">
        <div className="ehr-clinical-dashboard-tabs">
          {primaryAction && (
            <div className="ehr-segmented ehr-segmented-single">
              <button type="button" className="active" aria-label={primaryAction.label} onClick={primaryAction.onClick}>
                <primaryAction.icon className="w-4 h-4" /> {primaryAction.label}
              </button>
            </div>
          )}
        </div>

        <div className="ehr-schedule-primary-controls ehr-clinical-dashboard-header-main">
          <div className="ehr-greeting-row">
            <div className="ehr-care-header-copy">
              {/* Only the "Welcome, {name}" greeting — no eyebrow/subtitle — so
                  every role matches the Clinical Officer header exactly. */}
              <p className="ehr-care-greeting">{headerTitle}</p>
            </div>
          </div>
        </div>

        <div className="ehr-schedule-actions" data-tour="station-actions">
          {headerActions.map(action => (
            <button key={action.label} type="button" className={action.tone === 'primary' || action.active ? 'primary' : ''} onClick={action.onClick}>
              <action.icon className="w-4 h-4" />{action.label}
            </button>
          ))}
        </div>
      </section>

      <div className={`ehr-workspace-grid ${effectiveView === 'calendar' ? 'is-calendar' : 'is-dashboard'}`}>
        <aside className="ehr-left-rail">
          {showCalendar && (
            <EhrMiniCalendar
              month={calendarMonth}
              selectedDate={selectedDate}
              today={todayIso}
              eventDates={eventDates}
              onMonthChange={setCalendarMonth}
              onDateSelect={setSelectedDate}
            />
          )}
          {/* Same markup and classes as the Clinical Officer rail search, so
              every role gets one search field of one design and width. */}
          {onSearchChange && (
            <div className="ehr-rail-search" data-tour="rail-search">
              <Search className="ehr-rail-search-icon w-4 h-4" />
              <input
                type="search"
                value={searchValue || ''}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder || 'Search'}
                aria-label={searchPlaceholder || 'Search'}
              />
              {searchValue && (
                <button
                  type="button"
                  className="ehr-rail-search-clear"
                  aria-label="Clear search"
                  onClick={() => onSearchChange('')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {showChart && (chart ?? (
            <EhrWeekActivityChart
              items={chartItems}
              seriesNames={chartSeriesNames}
              selectedDate={selectedDate}
              todayIso={todayIso}
              title={chartTitle}
              onSelectDate={iso => {
                setSelectedDate(iso);
                setCalendarMonth(startOfMonth(parseIsoDate(iso)));
              }}
            />
          ))}
          {railContent}
          {filters.length > 0 && (
            <div className="ehr-filter-group">
              {filters.map(filter => (
                <button
                  key={filter.label}
                  type="button"
                  className={`ehr-care-filter ${filter.active ? 'active' : ''}`}
                  onClick={filter.onClick}
                >
                  <span>{filter.label}</span>
                  <b>{filter.value}</b>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="ehr-center-panel" data-tour="station-queue">
          <div className="ehr-daybar">
            <div>
              <h2>{centerTitle || selectedDateLabel}</h2>
              {/* Pass an empty string to render no subtitle at all (the nurse
                  station design carries only the h2 + tabs on this bar). */}
              {centerSubtitle !== '' && (
                <p className="ehr-care-subtitle">
                  {centerSubtitle || `${visibleRows.length} active item${visibleRows.length === 1 ? '' : 's'}`}
                </p>
              )}
            </div>
            <div className="ehr-day-tabs" data-tour="station-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={activeTab === tab.key ? 'active' : ''}
                  onClick={() => onTabChange(tab.key)}
                >
                  {tab.label}{typeof tab.count === 'number' ? ` · ${tab.count}` : ''}
                </button>
              ))}
            </div>
          </div>

          {!hideRowList && (
          <div className="ehr-appointment-list ehr-care-list ehr-care-list--no-actions">
            {visibleRows.length === 0 ? (
              <div className="ehr-empty-state">
                <ClipboardList className="w-8 h-8" />
                <strong>{emptyTitle}</strong>
                {emptyActionLabel && onEmptyAction && (
                  <button type="button" onClick={onEmptyAction}>{emptyActionLabel}</button>
                )}
              </div>
            ) : (
              <div className="ehr-queue-scroll">
                {/* Exactly the appointments-page table: PATIENT / TIME /
                    CARE TEAM / DEPARTMENT / STATUS, reusing its classes so
                    every user's patient list reads identically. */}
                <div className="appointment-card-flow">
                  <div className="appointment-card-head" aria-hidden="true">
                    <span>Patient</span>
                    <span>Time</span>
                    <span>Care team</span>
                    <span>Context</span>
                    <span>Status</span>
                  </div>
                  {visibleRows.map(row => {
                    // A real triage acuity code colors the avatar (the
                    // appointments table conveys priority the same way);
                    // everyone else's tone falls back on statusTone.
                    const priorityCode = isTriageCode(row.priority) ? row.priority : null;
                    const avatarAcuity = priorityCode
                      ?? (row.statusTone === 'danger' ? 'RED' : row.statusTone === 'warning' ? 'YELLOW' : 'GREEN');
                    const sourceText = row.careTeam || row.compactMeta || row.meta || '';
                    const sourceSubtext = row.careTeamSecondary || row.careTeamLabel || 'Care team';
                    const contextText = row.location || row.room || row.meta || '';
                    const contextSubtext = row.locationSecondary || row.locationLabel || (row.room ? 'Room' : 'Location');
                    const statusText = row.statusLabel || (row.status ? titleCase(row.status) : '');
                    const activate = () => openDetail(row);
                    const countdown = (() => {
                      if (!now || !row.timeAt) return null;
                      const target = new Date(row.timeAt);
                      if (Number.isNaN(target.getTime())) return null;
                      const label = formatAppointmentTimeUntil(target, now);
                      if (!label) return null;
                      const minutesAway = (target.getTime() - now.getTime()) / 60000;
                      const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                      const usesDate = dayKey(target) !== dayKey(now);
                      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                      const isPastDay = target.getTime() < startOfToday;
                      const tone = minutesAway < 0 ? 'is-past' : minutesAway <= 30 ? 'is-soon' : '';
                      return { label, tone, usesDate, isPastDay };
                    })();
                    const displayTime = countdown?.usesDate ? countdown.label : row.time || row.date || '—';
                    const timeSubtext = countdown
                      ? (countdown.usesDate ? (countdown.isPastDay ? '' : (row.time || '')) : countdown.label)
                      : row.timeSecondary || '';
                    // Status pill tone reuses the appointment pill classes.
                    const statusPillClass = row.statusTone === 'done' ? 'status-completed'
                      : row.statusTone === 'active' ? 'status-checked-in'
                      : row.statusTone === 'ready' ? 'status-confirmed'
                      : row.statusTone === 'danger' ? 'status-no-show'
                      : row.statusTone === 'warning' ? 'status-attention'
                      : '';
                    // Under-pill cue: acuity when known, else the countdown.
                    const cue = priorityCode
                      ? PRIORITY_META[priorityCode].label
                      : countdown?.label || '';
                    return (
                      <div key={row.id}>
                        <div
                          className="ehr-appointment-row appointment-card-row"
                          data-triage={priorityCode || undefined}
                          role="button"
                          tabIndex={0}
                          onClick={activate}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}
                        >
                          <div className="ehr-appointment-identity">
                            <div className="ehr-patient-icon" style={stateTint(avatarAcuity)}>
                              {row.photoUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={row.photoUrl} alt="" className="ehr-patient-icon-photo" />
                                : initials(row.title)}
                            </div>
                            <div className="ehr-appointment-main appointment-card-patient">
                              <button type="button" className="print-visible" onClick={(event) => { event.stopPropagation(); activate(); }}>
                                {row.title}
                              </button>
                              <p>{row.subtitle}</p>
                            </div>
                          </div>

                          <div className="ehr-appointment-time">
                            <strong>{displayTime}</strong>
                            <span className={countdown?.tone || ''}>{timeSubtext}</span>
                          </div>

                          <div className="appointment-card-provider">
                            <strong>{sourceText || 'Unassigned'}</strong>
                            <span>{sourceSubtext}</span>
                          </div>

                          <div className="ehr-appointment-department">
                            <strong>{contextText || '—'}</strong>
                            <span>{contextText ? contextSubtext : ''}</span>
                          </div>

                          <div className="appointment-card-status">
                            <span className={`appointment-status-pill ${statusPillClass}`.trim()}>{statusText || '—'}</span>
                            <small>{row.statusSecondary || cue}</small>
                          </div>
                        </div>
                        {row.detail}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}

          {footerContent && (
            <div className="ehr-care-footer">
              {footerContent}
            </div>
          )}

          {/* Children.toArray drops null/false conditionals, so a dashboard
              whose panels are all closed doesn't render an empty card. */}
          {Children.toArray(children).length > 0 && (
            <div data-tour="station-body" className={`ehr-worklist-panel ehr-care-workflow ${hideRowList ? 'ehr-care-workflow--bare' : ''} ${effectiveView === 'calendar' ? 'is-calendar' : ''}`}>
              {children}
            </div>
          )}
        </section>

        {effectiveView === 'dashboard' && (
        <aside className="ehr-right-rail" data-tour="side-cards">
          <div className="ehr-side-card">
            <div className="ehr-side-card-head">
              <ClipboardList className="w-5 h-5" />
              <h2>{metricsTitle}</h2>
            </div>
            {metrics.map(metric => (
              <button
                key={metric.label}
                type="button"
                className={`${metric.tone === 'danger' ? 'danger' : metric.tone === 'warning' ? 'warning' : ''} ${metric.active ? 'active' : ''}`.trim()}
                onClick={metric.onClick || (metric.href ? () => router.push(metric.href as string) : undefined)}
              >
                <span>{metric.label}</span>
                <b>{metric.value}</b>
              </button>
            ))}
            {metricsActions?.map(action => (
              <button
                key={action.label}
                type="button"
                className="ehr-side-card-icon-row"
                onClick={action.onClick}
              >
                <span>
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </span>
              </button>
            ))}
          </div>
          {/* "Who moved where, just now" — the station equivalent of the
              clinician's "Awaiting review". Rendered here so every dashboard
              built on this shell gets it without wiring it seven times; the
              card picks its own title and slice from the signed-in role and
              renders nothing for roles that have no feed configured. Sits
              BELOW the metrics: counts are the anchor a station reads first,
              the feed is what it scans afterwards. */}
          <ProgressFeedCard />

          {showMissionCard && missionTitle && missionDescription && (
            <div className="ehr-side-card ehr-mission-card">
              <div className="ehr-side-card-head ehr-mission-head">
                <Stethoscope className="w-5 h-5" />
                <h2>{missionTitle}</h2>
              </div>
              <p>{missionDescription}</p>
            </div>
          )}
        </aside>
        )}
      </div>

      {openRow && (
        <>
          <button
            type="button"
            className="appointment-detail-backdrop"
            aria-label="Close details"
            onClick={() => setOpenRow(null)}
          />
          <aside className="appointment-detail-sidebar" role="dialog" aria-modal="true" aria-label="Details">
            <div className="appointment-detail-sidebar__header">
              <div className="appointment-detail-sidebar__title">
                <h2>{openRow.title}</h2>
                {openRow.subtitle && <p>{openRow.subtitle}</p>}
              </div>
              {/* Close sits on the right so the title (and everything under it)
                  shares the body's left edge. Time and status stay in the Visit
                  Information rows only. */}
              <div className="appointment-detail-sidebar__header-icons">
                <button type="button" className="appointment-detail-sidebar__close" onClick={() => setOpenRow(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>

            {openRow.popupDetail ? (
              <div className="appointment-detail-sidebar__body" role="tabpanel">
                {openRow.popupDetail}
              </div>
            ) : (
              // The Financial tab is intentionally not offered: no role's data
              // layer feeds it yet, so every field rendered the same "—" /
              // "Not started" placeholders no matter who opened the slider —
              // that read as a broken feature, not an empty one. Visit
              // Information renders unconditionally instead. `detailTab` and
              // the 'financial' branch below are left in place (rather than
              // deleted) so wiring real billing data back in is a small diff,
              // not a rebuild — `detailTab` just never becomes 'financial'
              // without a control that sets it.
              <div className="appointment-detail-sidebar__body" role="tabpanel">
                {(detailTab === 'visit'
                  ? [
                      { label: 'Time', value: detailPair(openRow.time || openRow.compactMeta, openRow.timeSecondary) },
                      { label: 'Reason', value: openRow.subtitle },
                      // Raw triage codes (YELLOW/RED/GREEN) read like debug
                      // output — surface the clinical label instead.
                      { label: 'Priority', value: isTriageCode(openRow.priority) ? PRIORITY_META[openRow.priority].label : openRow.priority },
                      { label: 'Status', value: detailPair(openRow.statusLabel || (openRow.status ? titleCase(openRow.status) : undefined), openRow.statusSecondary) },
                      { label: 'Room', value: openRow.room },
                      { label: openRow.careTeamLabel || 'Care team', value: openRow.careTeamSecondary ? `${openRow.careTeam || 'Unassigned'} · ${openRow.careTeamSecondary}` : openRow.careTeam },
                      { label: openRow.locationLabel || 'Context', value: detailPair(openRow.location, openRow.locationSecondary) },
                      { label: 'Details', value: openRow.meta },
                    ]
                  : [
                      { label: 'Balance', value: '—' },
                      { label: 'Charge', value: 'Not started' },
                      { label: 'Payment Responsibility', value: 'Not recorded' },
                      { label: 'Insurance', value: 'Not recorded' },
                      { label: 'Claim Status', value: 'Not started' },
                    ]
                ).filter((item): item is { label: string; value: string } => Boolean(item.value))
                  .map(item => (
                    <div className="appointment-detail-row" key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
              </div>
            )}

            <EhrWorkItemProgress
              status={openRow.statusLabel || (openRow.status ? titleCase(openRow.status) : undefined)}
              owner={openRow.careTeam}
              waiting={openRow.time || openRow.timeSecondary}
              nextAction={openRow.actionLabel}
            />

            <div className="appointment-detail-sidebar__actions">
              {openRow.actionLabel && openRow.onAction && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { openRow.onAction?.(); setOpenRow(null); }}>
                  {openRow.actionLabel}
                </button>
              )}
              {openRow.secondaryActionLabel && openRow.onSecondaryAction && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { openRow.onSecondaryAction?.(); setOpenRow(null); }}>
                  {openRow.secondaryActionLabel}
                </button>
              )}
              {(openRow.extraActions ?? []).map(action => (
                <button
                  key={action.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={action.tone === 'danger' ? { color: 'var(--color-danger)', borderColor: 'var(--color-danger)' } : undefined}
                  onClick={() => { action.onClick(); setOpenRow(null); }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
