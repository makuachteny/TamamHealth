'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, ChevronRight, ClipboardList, Search, Stethoscope, User, type LucideIcon } from '@/components/icons/lucide';
import EhrMiniCalendar, { formatDateTitle, startOfMonth, toIsoDate } from '@/components/ehr/EhrMiniCalendar';

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
  eyebrow,
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
  const headerSubtitle = greetingName ? title : dateLabel;

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
              {eyebrow && <p className="ehr-care-eyebrow">{eyebrow}</p>}
              <p className="ehr-care-greeting">{headerTitle}</p>
              {headerSubtitle && <p className="ehr-care-header-subtitle">{headerSubtitle}</p>}
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
                <div className={`ehr-appointment-row ehr-care-row ${row.statusTone || 'scheduled'}`} onClick={row.onClick}>
                  <div className="ehr-patient-icon">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="ehr-appointment-main">
                    <button type="button" onClick={(event) => { event.stopPropagation(); row.onClick?.(); }}>{row.title}</button>
                    <p>{row.subtitle}</p>
                    {row.meta && <small className="ehr-row-meta">{row.meta}</small>}
                    {(row.compactMeta || row.meta) && <small className="ehr-row-compact-time">{row.compactMeta || row.meta}</small>}
                    <div className="ehr-care-badges">
                      {row.status && <span className={`ehr-care-status ${row.statusTone || 'scheduled'}`}>{titleCase(row.status)}</span>}
                      {row.priority && <span>{row.priority}</span>}
                      {row.room && <span>{row.room}</span>}
                    </div>
                  </div>
                  <div className="ehr-status-menu ehr-care-row-actions" onClick={(event) => event.stopPropagation()}>
                    {row.actionLabel && row.onAction && (
                      <button type="button" className="ehr-care-action primary" onClick={row.onAction}>{row.actionLabel}</button>
                    )}
                    {row.secondaryActionLabel && row.onSecondaryAction && (
                      <button type="button" className="ehr-care-action" onClick={row.onSecondaryAction}>{row.secondaryActionLabel}</button>
                    )}
                  </div>
                </div>
                {row.detail}
              </div>
            ))}
          </div>

          {showActionStrip && (
            <div className="ehr-clinical-strip">
              {actions.map(action => (
                <button key={action.label} type="button" className={action.active ? 'primary' : ''} onClick={action.onClick}>
                  <action.icon className="w-4 h-4" />{action.label}
                </button>
              ))}
            </div>
          )}

          {footerContent && (
            <div className="ehr-care-footer">
              {footerContent}
            </div>
          )}

          {children && (
            <div className={`ehr-worklist-panel ehr-care-workflow ${effectiveView === 'calendar' ? 'is-calendar' : ''}`}>
              {children}
            </div>
          )}
        </section>

        {effectiveView === 'dashboard' && (
        <aside className="ehr-right-rail">
          <div className="ehr-side-card">
            <h2>{metricsTitle}</h2>
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
            <h2>{checklistTitle}</h2>
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
              <div className="ehr-mission-head">
                <Stethoscope className="w-5 h-5" />
                <h2>{missionTitle}</h2>
              </div>
              <p>{missionDescription}</p>
            </div>
          )}
        </aside>
        )}
      </div>
    </div>
  );
}
