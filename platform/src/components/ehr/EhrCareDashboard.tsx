'use client';

import { Children, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ClipboardCheck, ClipboardList, Pencil, Search, Stethoscope, X, type LucideIcon } from '@/components/icons/lucide';
import EhrMiniCalendar, { formatDateTitle, startOfMonth, toIsoDate } from '@/components/ehr/EhrMiniCalendar';
import EhrDayStatsChart, { type DayStatsItem } from '@/components/ehr/EhrDayStatsChart';
import { initials, stateColor } from '@/lib/patient-utils';
import { formatTimeUntil } from '@/lib/format-utils';

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

export type EhrCareDashboardChecklistItem = {
  label: string;
  done?: boolean;
  href?: string;
  onClick?: () => void;
};

export type EhrCareDashboardRow = {
  id: string;
  title: string;
  subtitle: string;
  /** Bold standalone time (e.g. "08:20") shown in its own column, matching
   *  the clinical-officer appointment row. Omit for rows with no clock time
   *  (e.g. a plain registry entry) and the column collapses away. */
  time?: string;
  /** Full ISO timestamp behind `time`. When set, the time column also shows a
   *  live "in 2h 15m" / "20m ago" countdown under the clock time, so a row's
   *  urgency reads at a glance. Omit for rows whose time isn't a real moment. */
  timeAt?: string;
  meta?: string;
  compactMeta?: string;
  careTeam?: string;
  careTeamLabel?: string;
  location?: string;
  locationLabel?: string;
  status?: string;
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

function statusClass(value?: string): string {
  if (!value) return '';
  return `status-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

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
  checklist,
  showCalendar = true,
  chart,
  chartTitle = 'Day statistics',
  chartSeriesNames = ['Open', 'Completed'],
  showChart = true,
  calendarEventDates,
  metricsTitle = 'Today',
  checklistTitle = 'Workflow',
  checklistDescription,
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
  checklist: EhrCareDashboardChecklistItem[];
  showCalendar?: boolean;
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
  checklistTitle?: string;
  checklistDescription?: string;
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
    series: row.chartSeries ?? (row.statusTone === 'done' ? 1 : 0),
  })), [rows]);
  const visibleRows = useMemo(() => {
    if (!showCalendar || effectiveView !== 'calendar' || rowEventDates.length === 0) return rows;
    return rows.filter(row => row.date === selectedDate);
  }, [effectiveView, rowEventDates.length, rows, selectedDate, showCalendar]);
  // Only render the columns this role actually fills. Lab/pharmacy/radiology
  // never set careTeam or location, and rendering them anyway gave every row a
  // wall of "Unassigned · —". The list keeps one shared grid so values still
  // line up down the page, it just drops the columns nobody populated.
  const columns = useMemo(() => ({
    time: visibleRows.some(row => row.time || row.compactMeta),
    team: visibleRows.some(row => row.careTeam),
    location: visibleRows.some(row => row.location || row.room),
    status: visibleRows.some(row => row.statusLabel || row.status || row.priority),
  }), [visibleRows]);
  // Live clock for the time column's "in 2h 15m" countdown. Starts null so the
  // server-rendered markup and the first client render match, then ticks every
  // 30s — only while some visible row actually carries a `timeAt`.
  const hasCountdown = useMemo(() => visibleRows.some(row => !!row.timeAt), [visibleRows]);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!hasCountdown) { setNow(null); return; }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [hasCountdown]);
  const rowTemplate = useMemo(() => {
    const value = [columns.time, columns.team, columns.location, columns.status].filter(Boolean).length;
    return `42px minmax(220px, 1.8fr) ${'minmax(112px, 1fr) '.repeat(value)}${showRowOpenAction ? '44px' : ''}`.trim();
  }, [columns, showRowOpenAction]);
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

        <div className="ehr-schedule-actions">
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
            <div className="ehr-rail-search">
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
            <EhrDayStatsChart
              items={chartItems}
              seriesNames={chartSeriesNames}
              selectedDate={selectedDate}
              todayIso={todayIso}
              title={chartTitle}
            />
          ))}
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

        <section className="ehr-center-panel">
          <div className="ehr-daybar">
            <div>
              <h2>{centerTitle || selectedDateLabel}</h2>
              <p className="ehr-care-subtitle">
                {centerSubtitle || `${visibleRows.length} active item${visibleRows.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="ehr-day-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={activeTab === tab.key ? 'active' : ''}
                  onClick={() => onTabChange(tab.key)}
                >
                  {tab.label}{typeof tab.count === 'number' ? ` ${tab.count}` : ''}
                </button>
              ))}
            </div>
          </div>

          {!hideRowList && (
          <div className="ehr-appointment-list ehr-care-list" style={{ '--care-cols': rowTemplate } as CSSProperties}>
            {visibleRows.length === 0 ? (
              <div className="ehr-empty-state">
                <ClipboardList className="w-8 h-8" />
                <strong>{emptyTitle}</strong>
                {emptyActionLabel && onEmptyAction && (
                  <button type="button" onClick={onEmptyAction}>{emptyActionLabel}</button>
                )}
              </div>
            ) : visibleRows.map(row => (
              <div key={row.id}>
                <div
                  className={`ehr-appointment-row ehr-care-row ${row.statusTone || 'scheduled'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => (row.onClick ? row.onClick() : openDetail(row))}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); row.onClick ? row.onClick() : openDetail(row); } }}
                >
                  <div className="ehr-patient-icon" style={{ background: stateColor(row.statusTone === 'danger' ? 'red' : row.statusTone === 'warning' ? 'yellow' : row.priority), color: '#fff' }}>{initials(row.title)}</div>
                  <div className="ehr-appointment-main">
                    <button type="button" onClick={(event) => { event.stopPropagation(); row.onClick ? row.onClick() : openDetail(row); }}>{row.title}</button>
                    <p>{row.subtitle}{row.room && !columns.location ? ` · ${row.room}` : ''}</p>
                  </div>
                  {columns.time && (
                    <div className="ehr-appointment-time">
                      <strong>{row.time || row.compactMeta || '—'}</strong>
                      {(() => {
                        if (!now || !row.timeAt) return null;
                        const label = formatTimeUntil(row.timeAt, now);
                        if (!label) return null;
                        const minutesAway = (new Date(row.timeAt).getTime() - now.getTime()) / 60000;
                        // Overdue reads muted (it's history); the next half hour
                        // reads amber so the row about to be due stands out.
                        const tone = minutesAway < 0 ? 'is-past' : minutesAway <= 30 ? 'is-soon' : '';
                        return <span className={`ehr-appointment-countdown ${tone}`.trim()}>{label}</span>;
                      })()}
                    </div>
                  )}
                  {columns.team && (
                    <div className="ehr-care-row-team">
                      <strong>{row.careTeam || 'Unassigned'}</strong>
                    </div>
                  )}
                  {columns.location && (
                    <div className="ehr-care-row-location">
                      {(row.location || row.room)
                        ? <b className="ehr-department-pill">{row.location || row.room}</b>
                        : <b className="ehr-care-row-blank">—</b>}
                    </div>
                  )}
                  {columns.status && (
                    <div className="ehr-care-row-status">
                      {(row.statusLabel || row.priority || row.status) ? (
                        <b className={`ehr-appointment-status ${statusClass(row.statusLabel || row.status || row.priority)}`.trim()}>
                          {row.statusLabel || row.priority || (row.status ? titleCase(row.status) : '')}
                        </b>
                      ) : (
                        <b className="ehr-care-row-blank">—</b>
                      )}
                    </div>
                  )}
                  {showRowOpenAction && (
                  <div className="ehr-care-row-open">
                    <button
                      type="button"
                      className="ehr-queue-action"
                      title="Open"
                      aria-label={`Open ${row.title}`}
                      onClick={(event) => { event.stopPropagation(); row.onClick ? row.onClick() : openDetail(row); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                </div>
                {row.detail}
              </div>
            ))}
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
            <div className={`ehr-worklist-panel ehr-care-workflow ${hideRowList ? 'ehr-care-workflow--bare' : ''} ${effectiveView === 'calendar' ? 'is-calendar' : ''}`}>
              {children}
            </div>
          )}
        </section>

        {effectiveView === 'dashboard' && (
        <aside className="ehr-right-rail">
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
          <div className="ehr-side-card">
            <div className="ehr-side-card-head">
              <ClipboardCheck className="w-5 h-5" />
              <h2>{checklistTitle}</h2>
            </div>
            {checklistDescription && <p>{checklistDescription}</p>}
            {checklist.map(item => (
              <label key={item.label} onClick={item.onClick || (item.href ? () => router.push(item.href as string) : undefined)}>
                <input type="checkbox" checked={!!item.done} readOnly />
                {item.label}
              </label>
            ))}
          </div>
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
              <button type="button" className="appointment-detail-sidebar__back" onClick={() => setOpenRow(null)} aria-label="Close">
                <ChevronLeft size={22} />
              </button>
              <div className="appointment-detail-sidebar__title">
                <h2>{openRow.title}</h2>
                {(openRow.time || openRow.compactMeta) && (
                  <p className="appointment-detail-sidebar__time">{openRow.time || openRow.compactMeta}</p>
                )}
                {openRow.subtitle && <p>{openRow.subtitle}</p>}
              </div>
              <button type="button" className="appointment-detail-sidebar__close" onClick={() => setOpenRow(null)} aria-label="Close">
                <X size={16} />
              </button>
              {(openRow.status || openRow.priority) && (
                <div className="appointment-detail-sidebar__status">
                  {(openRow.statusLabel || openRow.status) && <span>{openRow.statusLabel || titleCase(openRow.status || '')}</span>}
                  {openRow.priority && <span>{openRow.priority}</span>}
                </div>
              )}
            </div>

            {openRow.popupDetail ? (
              <div className="appointment-detail-sidebar__body" role="tabpanel">
                {openRow.popupDetail}
              </div>
            ) : (
              <>
                <div className="appointment-detail-sidebar__tabs" role="tablist" aria-label="Detail sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={detailTab === 'visit'}
                    className={detailTab === 'visit' ? 'active' : undefined}
                    onClick={() => setDetailTab('visit')}
                  >
                    Visit Information
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={detailTab === 'financial'}
                    className={detailTab === 'financial' ? 'active' : undefined}
                    onClick={() => setDetailTab('financial')}
                  >
                    Financial Information
                  </button>
                </div>

                <div className="appointment-detail-sidebar__body" role="tabpanel">
                  {(detailTab === 'visit'
                    ? [
                        { label: 'Time', value: openRow.time || openRow.compactMeta },
                        { label: 'Reason', value: openRow.subtitle },
                        { label: 'Priority', value: openRow.priority },
                        { label: 'Status', value: openRow.statusLabel || (openRow.status ? titleCase(openRow.status) : undefined) },
                        { label: 'Room', value: openRow.room },
                        { label: openRow.careTeamLabel || 'Care team', value: openRow.careTeam },
                        { label: openRow.locationLabel || 'Location', value: openRow.location },
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
              </>
            )}

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

