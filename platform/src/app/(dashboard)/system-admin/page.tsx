'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import PortalModal from '@/components/Modal';
import { isPathAllowed } from '@/lib/role-routes';
import {
  SYSTEM_APP_DEFINITIONS,
  SYSTEM_EXTENSION_DEFINITIONS,
  SYSTEM_GLOBAL_PROPERTY_DEFINITIONS,
  SYSTEM_METADATA_DEFINITIONS,
  SYSTEM_PRIVILEGE_DEFINITIONS,
  domainLabel,
  type AdminDomain,
  type SystemAppDefinition,
  type SystemExtensionDefinition,
} from '@/lib/admin/system-admin-registry';
import type { SystemConfigDoc } from '@/lib/services/system-config-service';
import {
  BarChart3, Building2, ChevronRight, ClipboardCheck, ClipboardList, Database,
  KeyRound, Layers, Search, Server, Settings, Users, X, Pencil,
} from '@/components/icons/lucide';

const DOMAIN_COLORS: Record<AdminDomain, { bg: string; fg: string; border: string }> = {
  clinical: { bg: 'var(--semantic-success-bg)', fg: 'var(--semantic-success)', border: 'var(--semantic-success-border)' },
  registration: { bg: 'var(--semantic-active-bg)', fg: 'var(--semantic-active)', border: 'var(--semantic-active-border)' },
  operations: { bg: 'var(--semantic-neutral-bg)', fg: 'var(--semantic-neutral)', border: 'var(--semantic-neutral-border)' },
  billing: { bg: 'var(--semantic-warning-bg)', fg: 'var(--semantic-warning)', border: 'var(--semantic-warning-border)' },
  reporting: { bg: 'var(--semantic-request-bg)', fg: 'var(--semantic-request)', border: 'var(--semantic-request-border)' },
  it: { bg: 'var(--semantic-it-bg)', fg: 'var(--semantic-it)', border: 'var(--semantic-it-border)' },
  security: { bg: 'var(--semantic-danger-bg)', fg: 'var(--semantic-danger)', border: 'var(--semantic-danger-border)' },
  metadata: { bg: 'var(--semantic-neutral-bg)', fg: 'var(--semantic-neutral)', border: 'var(--semantic-neutral-border)' },
};

/** Pages that are genuinely where a "configurable" app/extension gets
 *  configured — safe to deep-link a "Configure" action straight to. Anything
 *  else routes to where the item merely *appears*, so a real inline editor
 *  is offered instead of a misleading "Configure" link. */
const REAL_SETTINGS_ROUTES = new Set(['/facility-settings', '/it', '/admin/users', '/org-admin/users', '/reports']);

/** Curated subset of the privilege matrix that specifically governs patient
 *  record actions (create/edit/merge/void), surfaced as its own sidebar
 *  section per the redesign brief — the full matrix stays intact under
 *  "Roles & Privileges". */
const PATIENT_RECORD_PRIVILEGE_IDS = new Set([
  'Create Visit',
  'Create Retrospective Visit',
  'Edit Patient Demographics',
  'Merge Patients',
  'Mark Patient Dead',
  'Delete Patient',
]);

type SectionId = 'apps' | 'extensions' | 'privileges' | 'patientActions' | 'metadata' | 'properties';

interface EditTarget {
  id: string;
  label: string;
  description: string;
  value: string;
}

function matches(query: string, ...fields: string[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some(f => (f || '').toLowerCase().includes(q));
}

export default function SystemAdministrationPage() {
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const orgId = currentUser?.orgId || '';

  const [config, setConfig] = useState<SystemConfigDoc | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>('apps');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orgId) { setLoadingConfig(false); return; }
      setLoadingConfig(true);
      try {
        const { getSystemConfig } = await import('@/lib/services/system-config-service');
        const doc = await getSystemConfig(orgId);
        if (!cancelled) setConfig(doc);
      } catch (err) {
        console.error('Failed to load system configuration:', err);
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  const appOverrides = config?.appOverrides || {};
  const extensionOverrides = config?.extensionOverrides || {};
  const propertyOverrides = config?.propertyOverrides || {};

  const accountHref = currentUser?.role === 'super_admin'
    ? '/admin/users'
    : currentUser?.role === 'org_admin'
      ? '/org-admin/users'
      : '/hr';

  // Every Open/Configure/shortcut link is gated against this role's real
  // allowed-route table — a row whose module the current role can't enter
  // (e.g. a facility-level page an org admin doesn't have) just loses its
  // navigation action instead of linking somewhere that would bounce/403.
  const canOpen = (route?: string): route is string =>
    !!route && !!currentUser && isPathAllowed(currentUser.role, route);

  const visibleApps = useMemo(() => {
    if (!currentUser) return SYSTEM_APP_DEFINITIONS;
    return SYSTEM_APP_DEFINITIONS.filter(app => app.ownerRoles.includes(currentUser.role));
  }, [currentUser]);

  const patientRecordPrivileges = useMemo(
    () => SYSTEM_PRIVILEGE_DEFINITIONS.filter(p => PATIENT_RECORD_PRIVILEGE_IDS.has(p.id)),
    [],
  );

  const q = search.trim();

  const filteredApps = useMemo(() => visibleApps.filter(a => matches(q, a.label, a.description)), [visibleApps, q]);
  const filteredExtensions = useMemo(() => SYSTEM_EXTENSION_DEFINITIONS.filter(e => matches(q, e.label, e.description)), [q]);
  const filteredPrivileges = useMemo(() => SYSTEM_PRIVILEGE_DEFINITIONS.filter(p => matches(q, p.label, p.description)), [q]);
  const filteredPatientPrivileges = useMemo(() => patientRecordPrivileges.filter(p => matches(q, p.label, p.description)), [patientRecordPrivileges, q]);
  const filteredMetadata = useMemo(() => SYSTEM_METADATA_DEFINITIONS.filter(m => matches(q, m.label, m.description)), [q]);
  const filteredProperties = useMemo(() => SYSTEM_GLOBAL_PROPERTY_DEFINITIONS.filter(p => matches(q, p.label, p.description)), [q]);

  const sections: { id: SectionId; label: string; icon: typeof Settings; count: number }[] = [
    { id: 'apps', label: 'Manage Apps', icon: Building2, count: visibleApps.length },
    { id: 'extensions', label: 'Manage Extensions', icon: Layers, count: SYSTEM_EXTENSION_DEFINITIONS.length },
    { id: 'privileges', label: 'Roles & Privileges', icon: KeyRound, count: SYSTEM_PRIVILEGE_DEFINITIONS.length },
    { id: 'patientActions', label: 'Patient Record Actions', icon: ClipboardList, count: patientRecordPrivileges.length },
    { id: 'metadata', label: 'Metadata Management', icon: Database, count: SYSTEM_METADATA_DEFINITIONS.length },
    { id: 'properties', label: 'Global Properties', icon: ClipboardCheck, count: SYSTEM_GLOBAL_PROPERTY_DEFINITIONS.length },
  ];

  const shortcuts = [
    { icon: Users, title: 'Accounts', href: accountHref, desc: 'Users, providers, roles, and facility access.' },
    { icon: Settings, title: 'Configuration', href: '/facility-settings', desc: 'Visit rules, checkout gates, and system defaults.' },
    { icon: BarChart3, title: 'Reports', href: '/reports', desc: 'HMIS, disease buckets, submissions, and quality checks.' },
    { icon: Server, title: 'IT Ops', href: '/it', desc: 'Devices, sync, backups, DHIS2, and audit retention.' },
  ].filter(s => canOpen(s.href));

  // ── Mutations ──────────────────────────────────────────────────────────
  const toggleApp = async (app: SystemAppDefinition, next: boolean) => {
    if (!orgId || !currentUser) { showToast('No organization on this account.', 'error'); return; }
    setBusyId(app.id);
    setConfig(prev => prev ? { ...prev, appOverrides: { ...prev.appOverrides, [app.id]: next } } : prev);
    try {
      const { setAppEnabled } = await import('@/lib/services/system-config-service');
      await setAppEnabled(orgId, app.id, next, currentUser._id, currentUser.username);
      showToast(`${app.label} ${next ? 'enabled' : 'disabled'}.`, 'success');
    } catch (err) {
      console.error(err);
      setConfig(prev => prev ? { ...prev, appOverrides: { ...prev.appOverrides, [app.id]: !next } } : prev);
      showToast(`Failed to update ${app.label}.`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleExtension = async (ext: SystemExtensionDefinition, next: boolean) => {
    if (!orgId || !currentUser) { showToast('No organization on this account.', 'error'); return; }
    setBusyId(ext.id);
    setConfig(prev => prev ? { ...prev, extensionOverrides: { ...prev.extensionOverrides, [ext.id]: next } } : prev);
    try {
      const { setExtensionEnabled } = await import('@/lib/services/system-config-service');
      await setExtensionEnabled(orgId, ext.id, next, currentUser._id, currentUser.username);
      showToast(`${ext.label} ${next ? 'enabled' : 'disabled'}.`, 'success');
    } catch (err) {
      console.error(err);
      setConfig(prev => prev ? { ...prev, extensionOverrides: { ...prev.extensionOverrides, [ext.id]: !next } } : prev);
      showToast(`Failed to update ${ext.label}.`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openEditor = (target: EditTarget) => {
    setEditing(target);
    setDraftValue(target.value);
  };

  const saveEditor = async () => {
    if (!editing) return;
    if (!orgId || !currentUser) { showToast('No organization on this account.', 'error'); return; }
    setSaving(true);
    try {
      const { setPropertyValue } = await import('@/lib/services/system-config-service');
      await setPropertyValue(orgId, editing.id, draftValue, currentUser._id, currentUser.username);
      setConfig(prev => prev ? { ...prev, propertyOverrides: { ...prev.propertyOverrides, [editing.id]: draftValue } } : prev);
      showToast(`${editing.label} saved.`, 'success');
      setEditing(null);
    } catch (err) {
      console.error(err);
      showToast(`Failed to save ${editing.label}.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Row action clusters ──────────────────────────────────────────────
  function AppExtActions({ id, label, status, route, enabled, kind }: {
    id: string; label: string; status: SystemAppDefinition['status']; route?: string;
    enabled: boolean; kind: 'app' | 'extension';
  }) {
    const isConfigurable = status === 'configurable';
    const hasRealSettingsRoute = !!route && REAL_SETTINGS_ROUTES.has(route) && canOpen(route);
    const openAllowed = canOpen(route);
    const busy = busyId === id;

    return (
      <div className="sysadm-row-actions">
        <span
          className="sysadm-pill"
          style={isConfigurable
            ? { background: 'var(--semantic-warning-bg)', color: 'var(--semantic-warning)' }
            : { background: enabled ? 'var(--semantic-success-bg)' : 'var(--semantic-inactive-bg)', color: enabled ? 'var(--semantic-success)' : 'var(--semantic-inactive)' }}
        >
          {isConfigurable ? 'Configurable' : enabled ? 'Enabled' : 'Disabled'}
        </span>

        {isConfigurable ? (
          hasRealSettingsRoute ? (
            <Link href={route!} className="sysadm-action-btn">
              <Settings className="w-3 h-3" /> Configure
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="sysadm-action-btn"
                onClick={() => openEditor({
                  id,
                  label,
                  description: 'Free-text configuration note — there is no dedicated settings page for this item yet.',
                  value: propertyOverrides[id] ?? '',
                })}
              >
                <Pencil className="w-3 h-3" /> Configure
              </button>
              {openAllowed && (
                <Link href={route!} className="sysadm-open-link">
                  Open <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </>
          )
        ) : (
          <>
            <Toggle checked={enabled} disabled={busy} label={`Toggle ${label}`} onChange={(next) => kind === 'app' ? toggleApp(SYSTEM_APP_DEFINITIONS.find(a => a.id === id)!, next) : toggleExtension(SYSTEM_EXTENSION_DEFINITIONS.find(e => e.id === id)!, next)} />
            {openAllowed && (
              <Link href={route!} className="sysadm-open-link">
                Open <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Section renderers ─────────────────────────────────────────────────
  const renderApps = (list: SystemAppDefinition[]) => (
    <div className="sysadm-list">
      {list.length === 0 && <EmptyRow text="No apps match your search." />}
      {list.map(app => (
        <ItemRow
          key={app.id}
          title={app.label}
          description={app.description}
          meta={`${app.id} · ${app.level}`}
          domain={app.domain}
          actions={
            <AppExtActions
              id={app.id}
              label={app.label}
              status={app.status}
              route={app.route}
              enabled={appOverrides[app.id] ?? app.status === 'enabled'}
              kind="app"
            />
          }
        />
      ))}
    </div>
  );

  const renderExtensions = (list: SystemExtensionDefinition[]) => (
    <div className="sysadm-list">
      {list.length === 0 && <EmptyRow text="No extensions match your search." />}
      {list.map(ext => (
        <ItemRow
          key={ext.id}
          title={ext.label}
          description={ext.description}
          meta={`${ext.extensionPoint} · ${ext.level}`}
          domain={ext.domain}
          actions={
            <AppExtActions
              id={ext.id}
              label={ext.label}
              status={ext.status}
              route={ext.route}
              enabled={extensionOverrides[ext.id] ?? ext.status === 'enabled'}
              kind="extension"
            />
          }
        />
      ))}
    </div>
  );

  const renderPrivileges = (list: typeof SYSTEM_PRIVILEGE_DEFINITIONS) => (
    <div className="sysadm-table">
      <div className="sysadm-table-head">
        <span>Privilege</span>
        <span>Roles</span>
        <span>Risk</span>
      </div>
      {list.length === 0 && <EmptyRow text="No privileges match your search." />}
      {list.map(privilege => (
        <div key={privilege.id} className="sysadm-table-row">
          <span className="sysadm-table-cell-main">
            <strong>{privilege.label}</strong>
            <small>{privilege.description}</small>
          </span>
          <span className="sysadm-table-roles">{privilege.roles.map(role => role.replace(/_/g, ' ')).join(', ')}</span>
          <b className={`risk-${privilege.risk}`}>{privilege.risk.toUpperCase()}</b>
        </div>
      ))}
    </div>
  );

  const renderMetadata = (list: typeof SYSTEM_METADATA_DEFINITIONS) => (
    <div className="sysadm-list">
      {list.length === 0 && <EmptyRow text="No metadata definitions match your search." />}
      {list.map(m => (
        <ItemRow
          key={m.id}
          title={m.label}
          description={m.description}
          meta={m.countLabel}
          domain={m.domain}
          actions={
            <div className="sysadm-row-actions">
              {canOpen(m.route) && (
                <Link href={m.route!} className="sysadm-action-btn">
                  Open <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          }
        />
      ))}
    </div>
  );

  const renderProperties = (list: typeof SYSTEM_GLOBAL_PROPERTY_DEFINITIONS) => (
    <div className="sysadm-list">
      {list.length === 0 && <EmptyRow text="No global properties match your search." />}
      {list.map(p => {
        const effectiveValue = propertyOverrides[p.id] ?? p.currentValue;
        const isOverridden = propertyOverrides[p.id] !== undefined && propertyOverrides[p.id] !== p.currentValue;
        return (
          <ItemRow
            key={p.id}
            title={p.label}
            description={p.description}
            meta={`${p.id}${isOverridden ? ' · customized' : ''}`}
            domain={p.domain}
            valueLine={effectiveValue}
            actions={
              <div className="sysadm-row-actions">
                {p.route && p.route !== '/system-admin' && canOpen(p.route) && (
                  <Link href={p.route} className="sysadm-open-link" title="Related settings">
                    Related <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                <button
                  type="button"
                  className="sysadm-action-btn"
                  onClick={() => openEditor({ id: p.id, label: p.label, description: p.description, value: effectiveValue })}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            }
          />
        );
      })}
    </div>
  );

  const brandColor = currentUser?.branding?.primaryColor || 'var(--accent-primary)';

  if (loadingConfig) {
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
                <ChevronRight className="w-3.5 h-3.5 sysadm-shortcut-go" />
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
                <SearchGroup title="Manage Apps" count={filteredApps.length}>{renderApps(filteredApps)}</SearchGroup>
                <SearchGroup title="Manage Extensions" count={filteredExtensions.length}>{renderExtensions(filteredExtensions)}</SearchGroup>
                <SearchGroup title="Roles & Privileges" count={filteredPrivileges.length}>{renderPrivileges(filteredPrivileges)}</SearchGroup>
                <SearchGroup title="Patient Record Actions" count={filteredPatientPrivileges.length}>{renderPrivileges(filteredPatientPrivileges)}</SearchGroup>
                <SearchGroup title="Metadata Management" count={filteredMetadata.length}>{renderMetadata(filteredMetadata)}</SearchGroup>
                <SearchGroup title="Global Properties" count={filteredProperties.length}>{renderProperties(filteredProperties)}</SearchGroup>
                {[filteredApps, filteredExtensions, filteredPrivileges, filteredPatientPrivileges, filteredMetadata, filteredProperties].every(l => l.length === 0) && (
                  <EmptyRow text={`No matches for "${q}".`} />
                )}
              </>
            ) : (
              <>
                {activeSection === 'apps' && renderApps(visibleApps)}
                {activeSection === 'extensions' && renderExtensions(SYSTEM_EXTENSION_DEFINITIONS)}
                {activeSection === 'privileges' && renderPrivileges(SYSTEM_PRIVILEGE_DEFINITIONS)}
                {activeSection === 'patientActions' && renderPrivileges(patientRecordPrivileges)}
                {activeSection === 'metadata' && renderMetadata(SYSTEM_METADATA_DEFINITIONS)}
                {activeSection === 'properties' && renderProperties(SYSTEM_GLOBAL_PROPERTY_DEFINITIONS)}
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── Inline editor (global properties + no-real-settings-page items) ── */}
      {editing && (
        <PortalModal onClose={() => (saving ? null : setEditing(null))} width={480}>
          <div className="sysadm-modal">
            <div className="sysadm-modal-head">
              <div>
                <h2>{editing.label}</h2>
                <p>{editing.description}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" disabled={saving}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="sysadm-modal-label" htmlFor="sysadm-edit-value">Current value</label>
            <textarea
              id="sysadm-edit-value"
              value={draftValue}
              onChange={e => setDraftValue(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="sysadm-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveEditor} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </PortalModal>
      )}

      <style>{`
        .sysadm-shell {
          display: flex;
          flex: 1;
          min-height: 0;
          gap: 14px;
        }
        .sysadm-sidebar {
          display: flex;
          flex-direction: column;
          flex: 0 0 280px;
          min-width: 0;
          overflow-y: auto;
          border: 1px solid var(--border-light);
          border-radius: 8px;
          background: var(--bg-card-solid);
          box-shadow: var(--list-row-shadow);
        }
        .sysadm-sidebar-head {
          padding: 14px 16px 10px;
        }
        .sysadm-eyebrow {
          margin: 0 0 4px;
          color: var(--accent-primary);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .sysadm-sidebar-head h1 {
          margin: 0;
          color: var(--text-primary);
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0;
        }
        .sysadm-shortcuts {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 4px 8px;
        }
        .sysadm-shortcut {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px;
          border-radius: 8px;
          color: var(--text-primary);
          text-decoration: none;
        }
        .sysadm-shortcut:hover {
          background: rgba(33, 145, 208, 0.06);
        }
        .sysadm-shortcut-icon {
          display: grid;
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 7px;
          background: var(--accent-light);
          color: var(--accent-primary);
        }
        .sysadm-shortcut-text {
          min-width: 0;
          flex: 1;
        }
        .sysadm-shortcut-text strong {
          display: block;
          font-size: 12.5px;
          font-weight: 700;
        }
        .sysadm-shortcut-text small {
          display: block;
          margin-top: 1px;
          overflow: hidden;
          color: var(--text-muted);
          font-size: 10.5px;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sysadm-shortcut-go {
          flex: 0 0 auto;
          color: var(--text-muted);
        }
        .sysadm-sidebar-divider {
          margin: 6px 12px;
          border-top: 1px solid var(--border-light);
        }
        .sysadm-sidebar-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 4px 8px 10px;
        }
        .sysadm-sidebar-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 8px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }
        .sysadm-sidebar-item:hover {
          background: var(--overlay-subtle);
        }
        .sysadm-sidebar-item.is-active {
          background: var(--accent-primary);
          color: #fff;
        }
        .sysadm-sidebar-item span {
          flex: 1;
          min-width: 0;
        }
        .sysadm-sidebar-item b {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: rgba(0,0,0,0.08);
          font-size: 11px;
          font-weight: 800;
        }
        .sysadm-sidebar-item.is-active b {
          background: rgba(255,255,255,0.22);
        }
        .sysadm-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          min-height: 0;
          border: 1px solid var(--border-light);
          border-radius: 8px;
          background: var(--bg-card-solid);
          box-shadow: var(--list-row-shadow);
          overflow: hidden;
        }
        .sysadm-content-head {
          flex: 0 0 auto;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-light);
        }
        .sysadm-content-title {
          margin: 10px 0 0;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
          font-size: 15px;
          font-weight: 800;
        }
        .sysadm-content-title b {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 22px;
          padding: 0 7px;
          border-radius: 999px;
          background: var(--overlay-subtle);
          color: var(--text-muted);
          font-size: 11px;
        }
        .sysadm-search {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          padding: 0 12px;
          border: 1px solid var(--border-light);
          border-radius: 999px;
          background: var(--bg-card-solid);
          color: var(--text-muted);
        }
        .sysadm-search input {
          flex: 1;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text-primary);
          font-size: 13px;
        }
        .sysadm-search button {
          display: flex;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
        }
        .sysadm-content-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 4px 16px 16px;
        }
        .sysadm-search-group {
          margin-top: 14px;
        }
        .sysadm-search-group-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .sysadm-list {
          display: flex;
          flex-direction: column;
        }
        .sysadm-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 4px;
          border-bottom: 1px solid var(--border-light);
        }
        .sysadm-list .sysadm-row:last-child {
          border-bottom: 0;
        }
        .sysadm-row-main {
          min-width: 0;
          flex: 1 1 auto;
        }
        .sysadm-row-main strong {
          display: block;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 800;
        }
        .sysadm-row-main p {
          margin: 3px 0 0;
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.4;
        }
        .sysadm-row-main small {
          display: block;
          margin-top: 4px;
          color: var(--text-muted);
          font-size: 10.5px;
          font-weight: 700;
        }
        .sysadm-row-value {
          display: block;
          margin-top: 5px;
          color: var(--accent-primary);
          font-size: 12px;
          font-weight: 700;
        }
        .sysadm-row-actions {
          display: flex;
          flex-wrap: nowrap;
          flex: 0 0 auto;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        .sysadm-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }
        .sysadm-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 30px;
          padding: 0 12px;
          border: 1px solid var(--accent-primary);
          border-radius: 999px;
          background: var(--accent-primary);
          color: #fff;
          font-size: 11.5px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }
        .sysadm-open-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--accent-primary);
          font-size: 11.5px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }
        .sysadm-open-link:hover {
          text-decoration: underline;
        }
        .sysadm-toggle {
          position: relative;
          width: 38px;
          height: 22px;
          flex: 0 0 auto;
          border: 1px solid var(--border-light);
          border-radius: 999px;
          background: var(--overlay-medium);
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .sysadm-toggle[data-on="true"] {
          border-color: var(--accent-primary);
          background: var(--accent-primary);
        }
        .sysadm-toggle:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .sysadm-toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
          transition: transform 0.15s ease;
        }
        .sysadm-toggle[data-on="true"] .sysadm-toggle-thumb {
          transform: translateX(16px);
        }
        .sysadm-table {
          display: flex;
          flex-direction: column;
        }
        .sysadm-table-head,
        .sysadm-table-row {
          display: grid;
          grid-template-columns: minmax(240px, 1.6fr) minmax(180px, 1fr) 90px;
          gap: 14px;
          align-items: center;
          padding: 10px 4px;
          border-bottom: 1px solid var(--border-light);
        }
        .sysadm-table-head {
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .sysadm-table-cell-main strong {
          display: block;
          color: var(--text-primary);
          font-size: 12.5px;
          font-weight: 800;
        }
        .sysadm-table-cell-main small {
          display: block;
          margin-top: 2px;
          color: var(--text-muted);
          font-size: 11.5px;
          line-height: 1.3;
        }
        .sysadm-table-roles {
          overflow: hidden;
          color: var(--text-secondary);
          font-size: 12px;
          text-overflow: ellipsis;
          text-transform: capitalize;
        }
        .sysadm-table-row b {
          justify-self: start;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
        }
        .risk-low { background: var(--semantic-success-bg); color: var(--semantic-success); }
        .risk-medium { background: var(--semantic-warning-bg); color: var(--semantic-warning); }
        .risk-high { background: var(--semantic-danger-bg); color: var(--semantic-danger); }
        .sysadm-empty {
          padding: 32px 8px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
        .sysadm-modal {
          padding: 18px;
        }
        .sysadm-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .sysadm-modal-head h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: 16px;
          font-weight: 800;
        }
        .sysadm-modal-head p {
          margin: 4px 0 0;
          color: var(--text-secondary);
          font-size: 12.5px;
          line-height: 1.4;
        }
        .sysadm-modal-head button {
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          flex-shrink: 0;
        }
        .sysadm-modal-label {
          display: block;
          margin-bottom: 6px;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sysadm-modal textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-light);
          border-radius: 8px;
          background: var(--overlay-subtle);
          color: var(--text-primary);
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
        }
        .sysadm-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }
        @media (max-width: 1024px) {
          .sysadm-shell {
            flex-direction: column;
          }
          .sysadm-sidebar {
            flex: 0 0 auto;
            max-height: none;
            overflow: visible;
          }
          .sysadm-sidebar-head {
            padding: 12px 14px 8px;
          }
          .sysadm-shortcuts {
            flex-direction: row;
            overflow-x: auto;
            padding: 4px 8px;
          }
          .sysadm-shortcut {
            flex: 0 0 auto;
            min-width: 160px;
          }
          .sysadm-sidebar-divider {
            display: none;
          }
          .sysadm-sidebar-list {
            flex-direction: row;
            overflow-x: auto;
            padding: 8px;
          }
          .sysadm-sidebar-item {
            flex: 0 0 auto;
            border: 1px solid var(--border-light);
            border-radius: 999px;
          }
          .sysadm-sidebar-item.is-active {
            border-color: var(--accent-primary);
          }
        }
        @media (max-width: 640px) {
          .sysadm-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .sysadm-row-actions {
            flex-wrap: wrap;
          }
          .sysadm-table-head,
          .sysadm-table-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function ItemRow({ title, description, meta, domain, actions, valueLine }: {
  title: string;
  description: string;
  meta?: string;
  domain: AdminDomain;
  actions: ReactNode;
  valueLine?: string;
}) {
  const domainColor = DOMAIN_COLORS[domain];
  return (
    <div className="sysadm-row">
      <div className="sysadm-row-main">
        <strong>{title}</strong>
        <p>{description}</p>
        {valueLine && <span className="sysadm-row-value">{valueLine}</span>}
        {meta && <small>{meta}</small>}
      </div>
      <div className="sysadm-row-actions">
        <span className="sysadm-pill" style={{ background: domainColor.bg, color: domainColor.fg, borderColor: domainColor.border }}>
          {domainLabel(domain)}
        </span>
        {actions}
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="sysadm-empty">{text}</div>;
}

function SearchGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="sysadm-search-group">
      <div className="sysadm-search-group-head">
        <span>{title}</span>
        <b>{count}</b>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, disabled, onChange, label }: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-on={checked ? 'true' : 'false'}
      onClick={() => onChange(!checked)}
      className="sysadm-toggle"
    >
      <span className="sysadm-toggle-thumb" />
    </button>
  );
}
