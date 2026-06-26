'use client';

import { FacilitySettingsView } from '@/components/settings/FacilitySettingsView';

// Standalone /facility-settings route — full page layout. The same view is
// embedded in the main Settings page (Settings → Facility tab).
export default function FacilitySettingsPage() {
  return <FacilitySettingsView />;
}
