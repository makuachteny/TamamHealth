'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import ItOperationsPanel from '@/components/admin/ItOperationsPanel';
import {
  SYSTEM_ADMIN_SECTIONS_META,
  systemAdminSectionCount,
  systemAdminSectionMatchCount,
  useSystemAdminConfig,
  SystemAdminSectionContent,
  SystemAdminEditorModal,
  SystemAdminStyles,
  SearchGroup,
  EmptyRow,
  type SystemAdminSectionId,
} from '@/components/settings/SystemAdminSections';
import {
  BarChart3, Search, Server, Settings, Users, X,
} from '@/components/icons/lucide';

type PageSectionId = 'itops' | SystemAdminSectionId;

export default function SystemAdministrationPage() {
  const { currentUser } = useApp();
  const data = useSystemAdminConfig(true);

  const [activeSection, setActiveSection] = useState<PageSectionId>('apps');
  const [search, setSearch] = useState('');

  const accountHref = currentUser?.role === 'super_admin'
    ? '/admin/users'
    : currentUser?.role === 'org_admin'
      ? '/org-admin/users'
      : '/hr';

  const shortcuts = [
    { icon: Users, title: 'Accounts', href: accountHref, desc: 'Users, providers, roles, and facility access.' },
    { icon: Settings, title: 'Configuration', href: '/facility-settings', desc: 'Visit rules, checkout gates, and system defaults.' },
    { icon: BarChart3, title: 'Reports', href: '/reports', desc: 'HMIS, disease buckets, submissions, and quality checks.' },
  ].filter(s => data.canOpen(s.href));

  // Runnable jobs count — the IT console (sync, backups, data stores,
  // integrations) is hosted here rather than as a separate module page.
  const sections: { id: PageSectionId; label: string; icon: typeof Settings; count: number }[] = [
    { id: 'itops', label: 'IT Operations', icon: Server, count: 3 },
    ...SYSTEM_ADMIN_SECTIONS_META.map(m => ({ id: m.id as PageSectionId, label: m.label, icon: m.icon, count: systemAdminSectionCount(m.id, data) })),
  ];

  const brandColor = currentUser?.branding?.primaryColor || 'var(--accent-primary)';
  const q = search.trim();

  if (data.loading) {
    return (
      <main className="page-container flex items-center justify-center page-enter">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }} />
      </main>
    );
  }

  const activeMeta = sections.find(s => s.id === activeSection)!;

  return (
    <main className="page-container page-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div className="sysadm-shell">
        {/* ── Sidebar ── */}
        <nav className="sysadm-sidebar" aria-label="System administration sections">
          <div className="sysadm-sidebar-head">
            <p className="sysadm-eyebrow">Admin console</p>
            <h1>System Administration</h1>
          </div>

          <div className="sysadm-shortcuts">
            {shortcuts.map(s => (
              <Link key={s.title} href={s.href} className="sysadm-shortcut">
                <span className="sysadm-shortcut-icon"><s.icon className="w-4 h-4" /></span>
                <span className="sysadm-shortcut-text">
                  <strong>{s.title}</strong>
                  <small>{s.desc}</small>
                </span>
              </Link>
            ))}
          </div>

          <div className="sysadm-sidebar-divider" />

          <div className="sysadm-sidebar-list">
            {sections.map(s => {
              const Icon = s.icon;
              const isActive = !q && activeSection === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`sysadm-sidebar-item${isActive ? ' is-active' : ''}`}
                  onClick={() => { setActiveSection(s.id); setSearch(''); }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{s.label}</span>
                  <b>{s.count}</b>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ── */}
        <section className="sysadm-content">
          <div className="sysadm-content-head">
            <div className="sysadm-search">
              <Search className="w-4 h-4" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search apps, extensions, privileges, metadata, properties…"
                aria-label="Search system administration"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {!q && <h2 className="sysadm-content-title">{activeMeta.label} <b>{activeMeta.count}</b></h2>}
          </div>

          <div className="sysadm-content-body">
            {q ? (
              <>
                {SYSTEM_ADMIN_SECTIONS_META.map(m => (
                  <SearchGroup key={m.id} title={m.label} count={systemAdminSectionMatchCount(m.id, data, q)}>
                    <SystemAdminSectionContent sectionId={m.id} data={data} filter={q} />
                  </SearchGroup>
                ))}
                {SYSTEM_ADMIN_SECTIONS_META.every(m => systemAdminSectionMatchCount(m.id, data, q) === 0) && (
                  <EmptyRow text={`No matches for "${q}".`} />
                )}
              </>
            ) : activeSection === 'itops' ? (
              <ItOperationsPanel embedded />
            ) : (
              <SystemAdminSectionContent sectionId={activeSection} data={data} />
            )}
          </div>
        </section>
      </div>

      <SystemAdminEditorModal data={data} />
      <SystemAdminStyles />
    </main>
  );
}
