'use client';

/**
 * OpenmrsChartShell — the visual shell for the OpenMRS O3-style patient
 * chart. Owns the left nav rail, the right action icon rail + slide-in
 * workspace drawer, and the scrolling main column that hosts the sticky
 * header/vitals slots plus the (unmodified) tab content.
 *
 * Tab content itself is NOT touched here — callers pass it in as `children`
 * and it renders inside `.omrs-content` exactly as it did before this shell
 * existed.
 *
 * Stage 2: the right-rail drawer now renders real, functional workspace
 * panels (src/components/ehr/chart/panels/**) instead of placeholders. The
 * panels reuse existing hooks/services/modals — this shell just threads the
 * patient/current-user/permission/router context they need down to them.
 */

import { useState } from 'react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  ShoppingCart, Edit3, ClipboardCheck, FileText, Users, X, Maximize2,
} from '@/components/icons/lucide';
import type { PatientDoc } from '@/lib/db-types';
import OrderBasketPanel from './panels/OrderBasketPanel';
import VisitNotePanel from './panels/VisitNotePanel';
import TaskListPanel from './panels/TaskListPanel';
import ClinicalFormsPanel from './panels/ClinicalFormsPanel';
import PatientListsPanel from './panels/PatientListsPanel';
import type { ChartPanelRouter, ChartPanelUser } from './panels/types';
import './openmrs-chart.css';

export interface OmrsRailItem {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
}

interface DrawerPanelDef {
  id: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
}

// Right-rail workspace panels — icon + title only; the actual body is
// resolved per-id in renderPanelBody() below.
const DRAWER_PANELS: DrawerPanelDef[] = [
  { id: 'order-basket', title: 'Order basket', icon: ShoppingCart },
  { id: 'visit-note', title: 'Visit note', icon: Edit3 },
  { id: 'task-list', title: 'Task list', icon: ClipboardCheck },
  { id: 'clinical-forms', title: 'Clinical forms', icon: FileText },
  { id: 'patient-lists', title: 'Patient lists', icon: Users },
];

interface OpenmrsChartShellProps {
  activeTab: string;
  setActiveTab: (id: string) => void;
  /** Primary OpenMRS-mapped rail items, already permission-filtered. */
  railItems: OmrsRailItem[];
  /** Existing tabs that don't have an OpenMRS-rail slot — surfaced under a
   *  "More" section at the bottom of the rail so nothing becomes unreachable. */
  moreItems: OmrsRailItem[];
  header: ReactNode;
  vitalsBand?: ReactNode;
  children: ReactNode;

  // ── Stage 2: context the right-drawer workspace panels need ──
  patient: PatientDoc;
  currentUser: ChartPanelUser | null | undefined;
  canPrescribe: boolean;
  canOrderLabs: boolean;
  canConsult: boolean;
  router: ChartPanelRouter;
  onOpenPrescribeModal: () => void;
  onOpenOrderLabModal: () => void;
  onNoteSaved?: () => void;
}

export default function OpenmrsChartShell({
  activeTab, setActiveTab, railItems, moreItems, header, vitalsBand, children,
  patient, currentUser, canPrescribe, canOrderLabs, canConsult, router,
  onOpenPrescribeModal, onOpenOrderLabModal, onNoteSaved,
}: OpenmrsChartShellProps) {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const activePanel = DRAWER_PANELS.find(p => p.id === openPanel) || null;

  const togglePanel = (id: string) => {
    setOpenPanel(prev => (prev === id ? null : id));
  };
  const closeDrawer = () => setOpenPanel(null);

  const goToRecallTab = () => {
    setActiveTab('recall');
    closeDrawer();
  };

  const renderPanelBody = (id: string) => {
    switch (id) {
      case 'order-basket':
        return (
          <OrderBasketPanel
            patient={patient}
            canPrescribe={canPrescribe}
            canOrderLabs={canOrderLabs}
            onAddDrugOrder={() => { onOpenPrescribeModal(); closeDrawer(); }}
            onAddLabOrder={() => { onOpenOrderLabModal(); closeDrawer(); }}
            onClose={closeDrawer}
          />
        );
      case 'visit-note':
        return (
          <VisitNotePanel
            patient={patient}
            currentUser={currentUser}
            canConsult={canConsult}
            onClose={closeDrawer}
            onSaved={onNoteSaved}
          />
        );
      case 'task-list':
        return (
          <TaskListPanel
            patient={patient}
            currentUser={currentUser}
            onClose={closeDrawer}
            onGoToRecall={goToRecallTab}
          />
        );
      case 'clinical-forms':
        return (
          <ClinicalFormsPanel
            patient={patient}
            router={router}
            canConsult={canConsult}
            onClose={closeDrawer}
          />
        );
      case 'patient-lists':
        return (
          <PatientListsPanel
            currentUser={currentUser}
            router={router}
            onClose={closeDrawer}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="omrs-root">
      {/* ══ Left vertical nav rail ══ */}
      <nav className="omrs-left-rail no-print" aria-label="Patient chart sections">
        {railItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? 'omrs-rail-item is-active' : 'omrs-rail-item'}
              onClick={() => setActiveTab(item.id)}
              onMouseDown={e => e.preventDefault()}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            >
              <item.icon className="w-4 h-4" />
              <span className="omrs-rail-label">{item.label}</span>
            </button>
          );
        })}

        {moreItems.length > 0 && (
          <>
            <div className="omrs-rail-divider" />
            <div className="omrs-rail-section-label">More</div>
            {moreItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={isActive ? 'omrs-rail-item is-active' : 'omrs-rail-item'}
                  onClick={() => setActiveTab(item.id)}
                  onMouseDown={e => e.preventDefault()}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="omrs-rail-label">{item.label}</span>
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* ══ Main column: sticky header/vitals + scrolling tab content ══ */}
      <div className="omrs-main-col">
        <div className="omrs-sticky-zone no-print">
          {header}
          {vitalsBand}
        </div>
        <div className="omrs-content">
          {children}
        </div>
      </div>

      {/* ══ Right action icon rail ══ */}
      <aside className="omrs-right-rail no-print" aria-label="Chart workspace panels">
        {DRAWER_PANELS.map(panel => (
          <button
            key={panel.id}
            type="button"
            className={openPanel === panel.id ? 'omrs-right-rail-btn is-active' : 'omrs-right-rail-btn'}
            onClick={() => togglePanel(panel.id)}
            title={panel.title}
            aria-pressed={openPanel === panel.id}
          >
            <panel.icon className="w-4 h-4" />
          </button>
        ))}
      </aside>

      {/* ══ Slide-in workspace drawer ══ */}
      {activePanel && (
        <>
          <div className="omrs-drawer-backdrop no-print" onClick={closeDrawer} />
          <div className="omrs-drawer no-print" role="dialog" aria-label={activePanel.title}>
            <div className="omrs-drawer-header">
              <span className="omrs-drawer-title">{activePanel.title}</span>
              <div className="omrs-drawer-controls">
                <button type="button" title="Maximize" aria-label="Maximize panel">
                  <Maximize2 />
                </button>
                <button type="button" title="Close" aria-label="Close panel" onClick={closeDrawer}>
                  <X />
                </button>
              </div>
            </div>
            {renderPanelBody(activePanel.id)}
          </div>
        </>
      )}
    </div>
  );
}
