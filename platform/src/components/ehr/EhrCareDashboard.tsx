'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Search, Stethoscope, X, type LucideIcon } from '@/components/icons/lucide';
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
  activeView = 'dashboard',
  onViewChange,
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
  checklist,
  showCalendar = true,
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
  activeView?: 'dashboard' | 'calendar';
  onViewChange?: (view: 'dashboard' | 'calendar') => void;
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
  checklist: EhrCareDashboardChecklistItem[];
  showCalendar?: boolean;
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
  const [internalView, setInternalView] = useState<'dashboard' | 'calendar'>(activeView);
  const effectiveView = onViewChange ? activeView : internalView;
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  // Clicking a row opens a right-side detail slider where the actions live,
  // keeping the row itself clean (avatar · time · name).
  const [openRow, setOpenRow] = useState<EhrCareDashboardRow | null>(null);
  const [detailTab, setDetailTab] = useState<'visit' | 'financial'>('visit');
  const openDetail = (row: EhrCareDashboardRow) => { setDetailTab('visit'); setOpenRow(row); };
  const rowEventDates = useMemo(() => rows.map(row => row.date).filter((date): date is string => Boolean(date)), [rows]);
  const eventDates = calendarEventDates || rowEventDates;
  const visibleRows = useMemo(() => {
    if (!showCalendar || effectiveView !== 'calendar' || rowEventDates.length === 0) return rows;
    return rows.filter(row => row.date === selectedDate);
  }, [effectiveView, rowEventDates.length, rows, selectedDate, showCalendar]);
  const setView = (view: 'dashboard' | 'calendar') => {
    setInternalView(view);
    onViewChange?.(view);
  };
  const selectedDateLabel = showCalendar ? formatDateTitle(selectedDate) : dateLabel;
  const headerActions = actions.slice(0, 3);
  const railActions = actions.slice(3);
  const headerTitle = greetingName ? `Welcome, ${greetingName}` : title;

  return (
    <div className="ehr-schedule-shell ehr-care-dashboard">
      <section className="ehr-schedule-header ehr-clinical-dashboard-header ehr-care-dashboard-header">
        <div className="ehr-clinical-dashboard-tabs">
          <div className="ehr-segmented" aria-label="Dashboard view" role="tablist">
            <button type="button" className={effectiveView === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
              <CheckCircle2 className="w-4 h-4" />Dashboard
            </button>
            <button type="button" className={effectiveView === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>
              <Calendar className="w-4 h-4" />Calendar
            </button>
          </div>
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
          <button
            type="button"
            className="ehr-today-button"
            onClick={() => {
              setSelectedDate(todayIso);
              setCalendarMonth(startOfMonth(new Date()));
            }}
          >
            Go to today
          </button>
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
          </div>
          <div className="ehr-side-card">
            <div className="ehr-side-card-head">
              <ClipboardCheck className="w-5 h-5" />
              <h2>{checklistTitle}</h2>
            </div>
            {checklistDescription && <p>{checklistDescription}</p>}
            {checklist.map(item => (
              <button key={item.label} type="button" onClick={item.onClick || (item.href ? () => router.push(item.href as string) : undefined)}>
                <span>{item.label}</span>
                {item.done ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
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
