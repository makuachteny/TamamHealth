import type { UserRole } from '@/lib/db-types';
import { getRoleConfig } from '@/lib/permissions';
import type { TourDefinition, TourStep } from './types';

// Builds a start-to-finish orientation tour for any role that doesn't have a
// hand-authored tour of its own. It walks the shared shell — the home
// dashboard, global search, the module switcher, and the profile actions — and
// then steps into the role's own primary pages, so every user gets a coherent
// walkthrough of their workspace end to end.
//
// It relies only on anchors that exist for every role:
//   .ehr-care-greeting  – greeting line on the dashboards (falls back to centre)
//   .ehr-top-search / .ehr-top-modules / .ehr-top-actions – the shared top rail
//   #main-content       – the page frame, always present
// Steps that just describe a freshly-opened page use an empty `target`, which
// the engine renders as a centred card over that page (no fragile per-page
// selector needed).
export function buildGenericTour(role: UserRole): TourDefinition {
  const config = getRoleConfig(role);
  const home = config.defaultDashboard || '/dashboard';
  const label = config.label || 'your';
  const nav = (config.navItems || []).filter(item => item.href && item.href !== home);
  const primary = nav[0];
  const secondary = nav[1];
  const moduleNames = nav.slice(0, 4).map(item => item.label).join(', ');

  const steps: TourStep[] = [
    {
      id: 'welcome',
      route: home,
      target: '.ehr-care-greeting',
      title: 'Welcome to TamamHealth',
      body: `A quick tour of your ${label} workspace — from where your day starts to the tools you'll use most. Use Back and Next, or skip anytime.`,
      placement: 'bottom',
    },
    {
      id: 'home',
      route: home,
      target: '',
      title: 'Your home dashboard',
      body: `This is your ${label} home — the day's work laid out so you can see what needs attention first.`,
    },
    {
      id: 'search',
      route: home,
      target: '.ehr-top-search',
      title: 'Find any patient',
      body: 'Search by name, hospital number, or phone from anywhere in the app.',
      placement: 'bottom',
    },
    {
      id: 'modules',
      route: home,
      target: '.ehr-top-modules',
      title: 'Switch modules',
      body: moduleNames
        ? `Jump between ${moduleNames}, and everything else you have access to.`
        : 'Jump between every module you have access to.',
      placement: 'bottom',
    },
  ];

  if (primary) {
    steps.push({
      id: 'primary-page',
      route: primary.href,
      target: '',
      title: primary.label,
      body: `${primary.label} is where you'll spend much of your day. You can open it anytime from the module switcher.`,
    });
  }
  if (secondary) {
    steps.push({
      id: 'secondary-page',
      route: secondary.href,
      target: '',
      title: secondary.label,
      body: `${secondary.label} is one tap away whenever you need it.`,
    });
  }

  steps.push({
    id: 'finish',
    route: home,
    target: '.ehr-top-actions',
    title: "You're all set",
    body: 'That’s the tour. You can replay it anytime from your profile menu — look for “Take a tour.”',
    placement: 'left',
  });

  return { key: `role-tour-${role}`, steps };
}
