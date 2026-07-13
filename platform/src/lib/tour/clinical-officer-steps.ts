import type { TourStep } from './types';

// Walks a Clinical Officer through a full visit end to end: the dashboard
// they land on after login, finding a patient, then the consultation wizard
// (History -> Intake -> Examination -> Assessment -> Orders -> Plan &
// checkout). Section anchors correspond to `data-tour="consult-section-N"`
// on each SectionHeader in `consultation/page.tsx`. The wizard only reveals
// the section for its current stage, and advancing a stage requires that
// stage's data to be filled in — so a scripted tour (with no real patient
// data entered) can only ever spotlight the first stage's section; later
// stages are described narratively via the Back/Next footer (`.ehr-consult-step-nav`)
// instead of being spotlighted directly.
export const clinicalOfficerTourSteps: TourStep[] = [
  {
    id: 'welcome',
    route: '/dashboard',
    target: '.ehr-care-greeting',
    title: 'Welcome to TamamHealth',
    body: "Let's walk through a Clinical Officer's day — from your schedule to finishing a consultation. Use Back and Next anytime, or skip to explore on your own.",
    placement: 'bottom',
  },
  {
    id: 'dash-view-toggle',
    route: '/dashboard',
    target: '.ehr-clinical-dashboard-tabs .ehr-segmented',
    title: 'Dashboard & Calendar',
    body: 'Dashboard shows the day as a worklist. Calendar shows the same appointments laid out across the month.',
    placement: 'bottom',
  },
  {
    id: 'dash-calendar',
    route: '/dashboard',
    target: '.ehr-left-rail .ehr-mini-calendar',
    title: 'Jump to any day',
    body: 'Pick a date to see who is booked with you that day.',
    placement: 'right',
  },
  {
    id: 'dash-schedule',
    route: '/dashboard',
    target: '.ehr-appointment-list',
    title: 'Your schedule',
    body: 'Everyone booked with you, split into Scheduled, In Office, and Finished. Click a row to open that patient’s chart.',
    placement: 'top',
  },
  {
    id: 'dash-outstanding',
    route: '/dashboard',
    target: '.ehr-outstanding-card',
    title: 'Outstanding items',
    body: 'Referrals, lab results, and other follow-ups waiting on you — grouped here so nothing slips through.',
    placement: 'left',
  },
  {
    id: 'dash-intake',
    route: '/dashboard',
    target: '.ehr-schedule-actions button.primary',
    title: 'Send a patient to intake',
    body: 'Route a walk-in to Patient Intake to capture vitals and history before you see them.',
    placement: 'bottom',
  },
  {
    id: 'top-search',
    route: '/dashboard',
    target: '.ehr-top-search',
    title: 'Find any patient',
    body: 'Search by name, hospital number, or phone from anywhere in the app.',
    placement: 'bottom',
  },
  {
    id: 'top-modules',
    route: '/dashboard',
    target: '.ehr-top-modules',
    title: 'Switch modules',
    body: 'Jump between Patients, Consultation, Wards, Lab, Pharmacy, Referrals, and everything else you have access to.',
    placement: 'bottom',
  },
  {
    id: 'consult-history',
    route: '/consultation',
    target: '[data-tour="consult-section-0"]',
    title: 'Start with history',
    body: 'Capture the chief complaint, history of present illness, past medical history, and social/family history.',
    placement: 'bottom',
  },
  {
    id: 'consult-wizard-flow',
    route: '/consultation',
    target: '.ehr-consult-step-nav',
    title: 'The rest of the visit',
    body: 'Once history is in, Next walks you through Intake, Examination, Assessment, Orders, and Plan & checkout in order — recording vitals, exam findings, ICD-11 diagnoses, prescriptions, lab orders, and referrals along the way. Use Back anytime to revisit an earlier stage.',
    placement: 'top',
  },
  {
    id: 'finish',
    route: '/consultation',
    target: '.ehr-consult-step-nav',
    title: 'You’re ready',
    body: 'That’s the full Clinical Officer workflow, start to finish. You can replay this tour anytime from your profile menu.',
    placement: 'top',
  },
];
