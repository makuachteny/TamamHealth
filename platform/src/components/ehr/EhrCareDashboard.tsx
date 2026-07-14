'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ClipboardCheck, ClipboardList, Search, Stethoscope, X, type LucideIcon } from '@/components/icons/lucide';
import EhrMiniCalendar, { formatDateTitle, startOfMonth, toIsoDate } from '@/components/ehr/EhrMiniCalendar';
import { initials, stateColor } from '@/lib/patient-utils';

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
  meta?: string;
  compactMeta?: string;
  status?: string;
  statusTone?: 'scheduled' | 'ready' | 'active' | 'done' | 'warning' | 'danger';
  priority?: string;
  room?: string;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  detail?: ReactNode;
  date?: string;
};

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function EhrCareDashboard({
  title,
  greetingName,
  dateLabel,
  tabs,
  activeTab,
  onTabChange,
  searchValue,
  searchPlaceholder = 'Search queue',
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
  chartTitle = 'Activity',
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
  /** Explicit left-rail chart. When omitted, a compact bar chart is
   *  auto-derived from this dashboard's own tabs/filters/metrics. */
  chart?: ReactNode;
  chartTitle?: string;
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
  const openDetail = (row: EhrCareDashboardRow) => { setDetailTab('visit'); setOpenRow(row); };
  const rowEventDates = useMemo(() => rows.map(row => row.date).filter((date): date is string => Boolean(date)), [rows]);
  const eventDates = calendarEventDates || rowEventDates;
  // A compact left-rail bar chart matching the Clinical Officer "Day statistics"
  // widget, auto-derived from whichever of this dashboard's own data is richest:
  // its status tabs, else its filters, else its metrics. Non-numeric ("45 min")
  // and total ("All") entries are dropped.
  const autoChartSeries = useMemo(() => {
    const toSeries = (items: { label: string; count?: number; value?: number | string }[]) =>
      items
        .filter(it => !['all', 'view all'].includes((it.label || '').trim().toLowerCase()))
        .map(it => ({ label: it.label, value: Number(it.count ?? it.value) }))
        .filter((it): it is { label: string; value: number } => Number.isFinite(it.value));
    const fromTabs = toSeries(tabs.filter(tab => tab.key !== 'all'));
    if (fromTabs.length) return fromTabs;
    const fromFilters = toSeries(filters);
    if (fromFilters.length) return fromFilters;
    return toSeries(metrics);
  }, [tabs, filters, metrics]);
  const visibleRows = useMemo(() => {
    if (!showCalendar || effectiveView !== 'calendar' || rowEventDates.length === 0) return rows;
    return rows.filter(row => row.date === selectedDate);
  }, [effectiveView, rowEventDates.length, rows, selectedDate, showCalendar]);
  const selectedDateLabel = showCalendar ? formatDateTitle(selectedDate) : dateLabel;
  // The dashboard's primary action (first entry) is promoted to the header's
  // top-left slot as the Clinical Officer-style "+" CTA; the rest split into
  // the right-hand action row and then the left-rail action list.
  const primaryAction = actions[0];
  const headerActions = actions.slice(1, 4);
  const railActions = actions.slice(4);
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
          {showChart && (chart ?? <CareStatsChart title={chartTitle} series={autoChartSeries} />)}
          <div className="ehr-filter-group">
            <div className="ehr-care-search">
              <Search className="w-4 h-4" />
              <input
                type="search"
                value={searchValue ?? ''}
                placeholder={searchPlaceholder}
                onChange={(event) => onSearchChange?.(event.target.value)}
              />
            </div>
          </div>
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
          {railActions.length > 0 && (
            <div className="ehr-filter-group">
              {railActions.map(action => (
                <button
                  key={action.label}
                  type="button"
                  className={`ehr-care-rail-action ${action.active ? 'active' : ''}`}
                  onClick={action.onClick}
                >
                  <action.icon className="w-4 h-4" />
                  <span>{action.label}</span>
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

          <div className="ehr-appointment-list ehr-care-list">
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
                    <p>{row.subtitle}{row.room ? ` · ${row.room}` : ''}</p>
                  </div>
                  <div className="ehr-appointment-time">
                    <strong>{row.time || row.compactMeta || '—'}</strong>
                    {(row.priority || row.status) && <span>{row.priority || (row.status ? titleCase(row.status) : '')}</span>}
                  </div>
                </div>
                {row.detail}
              </div>
            ))}
          </div>

          {footerContent && (
            <div className="ehr-care-footer">
              {footerContent}
            </div>
          )}

          {children && (
            <>
              <div className={`ehr-worklist-panel ehr-care-workflow ${effectiveView === 'calendar' ? 'is-calendar' : ''}`}>
                {children}
              </div>
            </>
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
                  {openRow.status && <span>{titleCase(openRow.status)}</span>}
                  {openRow.priority && <span>{openRow.priority}</span>}
                </div>
              )}
            </div>

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
                    { label: 'Status', value: openRow.status ? titleCase(openRow.status) : undefined },
                    { label: 'Room', value: openRow.room },
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
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

/* ─── Care stats chart (left rail) ───
   Compact single-series bar chart mirroring the Clinical Officer "Day
   statistics" widget (same ehr-day-stats styling and geometry), but generic:
   it renders whatever category series the dashboard supplies (queue by status,
   screenings by class, counties by KPI, …). Bar colour comes from the shared
   --viz-inpatient token so dark mode swaps a validated step. */
function CareStatsChart({ title, series }: { title: string; series: { label: string; value: number }[] }) {
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const peak = series.reduce((max, item) => Math.max(max, item.value), 0);
  // Even headroom so the midpoint gridline lands on a whole number.
  const yMax = Math.max(4, Math.ceil(peak / 2) * 2);
  const plotTop = 8;
  const baseline = 112;
  const plotHeight = baseline - plotTop;
  const barY = (value: number) => baseline - (value / yMax) * plotHeight;
  const ticks = [0, yMax / 2, yMax];
  const plotLeft = 20;
  const plotRight = 212;
  const slot = (plotRight - plotLeft) / Math.max(series.length, 1);
  const barWidth = Math.min(18, slot * 0.55);

  return (
    <div className="ehr-day-stats">
      <div className="ehr-day-stats-head">
        <h3>{title}</h3>
      </div>
      {total === 0 ? (
        <p className="ehr-day-stats-empty">No activity yet.</p>
      ) : (
        <svg viewBox="0 0 216 132" role="img" aria-label={`${title}: ${series.map(item => `${item.value} ${item.label}`).join(', ')}`}>
          {ticks.map(tick => (
            <g key={tick}>
              <line x1={20} x2={212} y1={barY(tick)} y2={barY(tick)} stroke="var(--ehr-border)" strokeWidth={1} />
              <text x={16} y={barY(tick) + 2.5} textAnchor="end" fontSize={8} fill="var(--ehr-muted)">{tick}</text>
            </g>
          ))}
          {series.map((item, index) => {
            const center = plotLeft + slot * index + slot / 2;
            const short = item.label.length > 7 ? `${item.label.slice(0, 6)}…` : item.label;
            return (
              <g key={item.label}>
                {item.value > 0 && (
                  <rect
                    className="ehr-day-stats-bar"
                    x={center - barWidth / 2}
                    y={barY(item.value)}
                    width={barWidth}
                    height={baseline - barY(item.value)}
                    rx={2}
                    fill="var(--viz-inpatient)"
                  >
                    <title>{`${item.label}: ${item.value}`}</title>
                  </rect>
                )}
                <text x={center} y={126} textAnchor="middle" fontSize={7} fill="var(--ehr-muted)">{short}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
