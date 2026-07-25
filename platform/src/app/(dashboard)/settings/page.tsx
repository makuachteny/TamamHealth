'use client';

import RoleSettingsView from '@/components/settings/RoleSettingsView';

/**
 * Settings — per-role personal settings (design 11 "Settings by Role").
 * Every user sees only their own role's page; facility admins reach user and
 * hospital management through the links in the page's own rail
 * (/settings/manage), never inside these personal settings.
 */
export default function SettingsPage() {
  return (
    <main className="page-container page-enter">
      <RoleSettingsView />
    </main>
  );
}
