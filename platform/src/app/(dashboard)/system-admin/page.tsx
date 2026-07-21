'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import {
  SYSTEM_APP_DEFINITIONS,
  SYSTEM_EXTENSION_DEFINITIONS,
  SYSTEM_GLOBAL_PROPERTY_DEFINITIONS,
  SYSTEM_METADATA_DEFINITIONS,
  SYSTEM_PRIVILEGE_DEFINITIONS,
  domainLabel,
  statusLabel,
  type AdminDomain,
  type AppStatus,
} from '@/lib/admin/system-admin-registry';
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  Database,
  Eye,
  KeyRound,
  Server,
  Settings,
  ToggleLeft,
  ToggleRight,
  Users,
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

const STATUS_COLORS: Record<AppStatus, { bg: string; fg: string; icon: typeof ToggleRight }> = {
  enabled: { bg: 'var(--semantic-success-bg)', fg: 'var(--semantic-success)', icon: ToggleRight },
  disabled: { bg: 'var(--semantic-inactive-bg)', fg: 'var(--semantic-inactive)', icon: ToggleLeft },
  configurable: { bg: 'var(--semantic-warning-bg)', fg: 'var(--semantic-warning)', icon: Settings },
};

export default function SystemAdministrationPage() {
  const { currentUser } = useApp();

  const accountHref = currentUser?.role === 'super_admin'
    ? '/admin/users'
    : currentUser?.role === 'org_admin' || currentUser?.role === 'facility_administrator'
      ? '/org-admin/users'
      : '/hr';

  const visibleApps = useMemo(() => {
    if (!currentUser) return SYSTEM_APP_DEFINITIONS;
    return SYSTEM_APP_DEFINITIONS.filter(app => app.ownerRoles.includes(currentUser.role));
  }, [currentUser]);

  const adminAreas = [
    { icon: Users, title: 'Accounts', href: accountHref, desc: 'Users, providers, roles, and facility access.' },
    { icon: Settings, title: 'Configuration', href: '/facility-settings', desc: 'Visit rules, checkout gates, and system defaults.' },
    { icon: BarChart3, title: 'Reports', href: '/reports', desc: 'HMIS, disease buckets, submissions, and quality checks.' },
    { icon: Server, title: 'IT Ops', href: '/it', desc: 'Devices, sync, backups, DHIS2, and audit retention.' },
  ];

  return (
    <>
      <TopBar title="System Administration" />
      <main className="page-container page-enter">
        <section className="system-admin-overview">
          <div>
            <p className="system-admin-eyebrow">Admin console</p>
            <h1>System controls</h1>
            <span>Accounts, permissions, apps, metadata, reports, and IT operations.</span>
          </div>
          <div className="system-admin-overview-actions">
            <Link href={accountHref} className="btn btn-secondary">
              <Users className="w-4 h-4" /> Manage accounts
            </Link>
            <Link href="/facility-settings" className="btn btn-primary">
              <Settings className="w-4 h-4" /> Settings
            </Link>
          </div>
        </section>

        <section className="system-admin-areas" aria-label="System administration areas">
          {adminAreas.map(area => (
            <AdminShortcut key={area.title} icon={area.icon} title={area.title} href={area.href} desc={area.desc} />
          ))}
        </section>

        <div className="system-admin-layout">
          <section className="system-admin-panel">
            <PanelHeader icon={Building2} title="Manage Apps" count={visibleApps.length} />
            <div className="system-admin-list">
              {visibleApps.map(app => (
                <AdminRow
                  key={app.id}
                  title={app.label}
                  subtitle={app.description}
                  meta={`${app.id} · ${app.level}`}
                  domain={app.domain}
                  status={app.status}
                  href={app.route}
                />
              ))}
            </div>
          </section>

          <section className="system-admin-panel">
            <PanelHeader icon={Eye} title="Manage Extensions" count={SYSTEM_EXTENSION_DEFINITIONS.length} />
            <div className="system-admin-list">
              {SYSTEM_EXTENSION_DEFINITIONS.map(extension => (
                <AdminRow
                  key={extension.id}
                  title={extension.label}
                  subtitle={extension.description}
                  meta={`${extension.extensionPoint} · ${extension.level}`}
                  domain={extension.domain}
                  status={extension.status}
                  href={extension.route}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="system-admin-layout system-admin-secondary system-admin-single">
          <section className="system-admin-panel">
            <PanelHeader icon={KeyRound} title="Roles And Privileges" count={SYSTEM_PRIVILEGE_DEFINITIONS.length} />
            <div className="system-admin-table">
              <div className="system-admin-table-head">
                <span>Privilege</span>
                <span>Roles</span>
                <span>Risk</span>
              </div>
              {SYSTEM_PRIVILEGE_DEFINITIONS.map(privilege => (
                <div key={privilege.id} className="system-admin-table-row">
                  <span>
                    <strong>{privilege.label}</strong>
                    <small>{privilege.description}</small>
                  </span>
                  <span>{privilege.roles.map(role => role.replace(/_/g, ' ')).join(', ')}</span>
                  <b className={`risk-${privilege.risk}`}>{privilege.risk.toUpperCase()}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="system-admin-panel">
            <PanelHeader icon={Database} title="Metadata Management" count={SYSTEM_METADATA_DEFINITIONS.length} />
            <div className="system-admin-list">
              {SYSTEM_METADATA_DEFINITIONS.map(metadata => (
                <AdminRow
                  key={metadata.id}
                  title={metadata.label}
                  subtitle={metadata.description}
                  meta={metadata.countLabel}
                  domain={metadata.domain}
                  status="configurable"
                  href={metadata.route}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="system-admin-layout system-admin-secondary">
          <section className="system-admin-panel">
            <PanelHeader icon={ClipboardCheck} title="Global Properties" count={SYSTEM_GLOBAL_PROPERTY_DEFINITIONS.length} />
            <div className="system-admin-list">
              {SYSTEM_GLOBAL_PROPERTY_DEFINITIONS.map(property => (
                <AdminRow
                  key={property.id}
                  title={property.label}
                  subtitle={property.description}
                  meta={`${property.id} · ${property.currentValue}`}
                  domain={property.domain}
                  status="configurable"
                  href={property.route}
                />
              ))}
            </div>
          </section>
        </div>

        <style>{`
          .system-admin-overview {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 12px;
            padding: 14px 16px;
            border: 1px solid var(--border-light);
            border-radius: 8px;
            background: var(--bg-card-solid);
            box-shadow: var(--list-row-shadow);
          }
          .system-admin-eyebrow {
            margin: 0 0 4px;
            color: var(--accent-primary);
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.07em;
            text-transform: uppercase;
          }
          .system-admin-overview h1 {
            margin: 0;
            color: var(--text-primary);
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0;
          }
          .system-admin-overview span {
            display: block;
            margin-top: 4px;
            color: var(--text-secondary);
            font-size: 13px;
          }
          .system-admin-overview-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: flex-end;
          }
          .system-admin-areas,
          .system-admin-layout {
            display: grid;
            gap: 12px;
            margin-bottom: 12px;
          }
          .system-admin-areas {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .system-admin-layout {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .system-admin-single {
            grid-template-columns: 1fr;
          }
          .system-admin-shortcut,
          .system-admin-panel {
            border: 1px solid var(--border-light);
            border-radius: 8px;
            background: var(--bg-card-solid);
            box-shadow: var(--list-row-shadow);
          }
          .system-admin-shortcut {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 78px;
            padding: 12px 14px;
            color: var(--text-primary);
            text-decoration: none;
          }
          .system-admin-shortcut:hover {
            border-color: var(--accent-border);
            background: rgba(33, 145, 208, 0.06);
          }
          .system-admin-shortcut-icon {
            display: grid;
            width: 34px;
            height: 34px;
            flex: 0 0 auto;
            place-items: center;
            border-radius: 8px;
            background: var(--accent-light);
            color: var(--accent-primary);
          }
          .system-admin-shortcut strong {
            display: block;
            color: var(--text-primary);
            font-size: 13px;
            font-weight: 800;
          }
          .system-admin-shortcut span {
            display: block;
            margin-top: 2px;
            color: var(--text-muted);
            font-size: 12px;
            line-height: 1.3;
          }
          .system-admin-panel {
            min-width: 0;
            overflow: hidden;
          }
          .system-admin-secondary .system-admin-panel {
            max-height: 420px;
          }
          .system-admin-panel-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 12px 14px;
            border-bottom: 1px solid var(--border-light);
          }
          .system-admin-panel-title {
            display: flex;
            align-items: center;
            gap: 9px;
          }
          .system-admin-panel-title h2 {
            margin: 0;
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 800;
          }
          .system-admin-panel-head b {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            min-height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            background: var(--overlay-subtle);
            color: var(--text-muted);
            font-size: 12px;
          }
          .system-admin-list {
            display: grid;
            gap: 0;
            max-height: 430px;
            overflow: auto;
          }
          .system-admin-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
            padding: 12px 14px;
            border-bottom: 1px solid var(--border-light);
          }
          .system-admin-row:last-child {
            border-bottom: 0;
          }
          .system-admin-row strong {
            display: block;
            color: var(--text-primary);
            font-size: 13px;
            font-weight: 800;
          }
          .system-admin-row p {
            margin: 3px 0 0;
            color: var(--text-secondary);
            font-size: 12px;
            line-height: 1.35;
          }
          .system-admin-row small {
            display: block;
            margin-top: 4px;
            overflow: hidden;
            color: var(--text-muted);
            font-size: 10.5px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .system-admin-row-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 6px;
          }
          .system-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-height: 24px;
            padding: 0 8px;
            border: 1px solid transparent;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            white-space: nowrap;
          }
          .system-admin-link {
            color: var(--accent-primary);
            font-size: 11px;
            font-weight: 800;
            text-decoration: none;
          }
          .system-admin-link:hover {
            text-decoration: underline;
          }
          .system-admin-table {
            max-height: 360px;
            overflow: auto;
          }
          .system-admin-table-head,
          .system-admin-table-row {
            display: grid;
            grid-template-columns: minmax(260px, 1.4fr) minmax(180px, 1fr) 90px;
            gap: 12px;
            align-items: center;
            min-width: 680px;
            padding: 10px 16px;
            border-bottom: 1px solid var(--border-light);
          }
          .system-admin-table-head {
            background: var(--overlay-subtle);
            color: var(--text-muted);
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .system-admin-table-row span {
            overflow: hidden;
            color: var(--text-secondary);
            font-size: 12px;
            text-overflow: ellipsis;
          }
          .system-admin-table-row strong,
          .system-admin-table-row small {
            display: block;
          }
          .system-admin-table-row strong {
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 800;
          }
          .system-admin-table-row small {
            margin-top: 2px;
            color: var(--text-muted);
            line-height: 1.25;
          }
          .system-admin-table-row b {
            justify-self: start;
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 10px;
          }
          .risk-low { background: var(--semantic-success-bg); color: var(--semantic-success); }
          .risk-medium { background: var(--semantic-warning-bg); color: var(--semantic-warning); }
          .risk-high { background: var(--semantic-danger-bg); color: var(--semantic-danger); }
          @media (max-width: 1100px) {
            .system-admin-areas,
            .system-admin-layout {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 720px) {
            .system-admin-overview {
              display: block;
            }
            .system-admin-overview-actions {
              justify-content: flex-start;
              margin-top: 12px;
            }
            .system-admin-areas,
            .system-admin-layout {
              grid-template-columns: 1fr;
            }
            .system-admin-row {
              grid-template-columns: 1fr;
            }
            .system-admin-row-actions {
              align-items: flex-start;
            }
          }
        `}</style>
      </main>
    </>
  );
}

function AdminShortcut({ icon: Icon, title, desc, href }: {
  icon: typeof Settings;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href} className="system-admin-shortcut">
      <span className="system-admin-shortcut-icon"><Icon className="w-4 h-4" /></span>
      <span>
        <strong>{title}</strong>
        <span>{desc}</span>
      </span>
    </Link>
  );
}

function PanelHeader({ icon: Icon, title, count }: {
  icon: typeof Settings;
  title: string;
  count: number;
}) {
  return (
    <div className="system-admin-panel-head">
      <div className="system-admin-panel-title">
        <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
        <h2>{title}</h2>
      </div>
      <b>{count}</b>
    </div>
  );
}

function AdminRow({ title, subtitle, meta, domain, status, href }: {
  title: string;
  subtitle: string;
  meta: string;
  domain: AdminDomain;
  status: AppStatus;
  href?: string;
}) {
  const domainColor = DOMAIN_COLORS[domain];
  const statusColor = STATUS_COLORS[status];
  const StatusIcon = statusColor.icon;
  return (
    <div className="system-admin-row">
      <div>
        <strong>{title}</strong>
        <p>{subtitle}</p>
        <small>{meta}</small>
      </div>
      <div className="system-admin-row-actions">
        <span className="system-pill" style={{ background: domainColor.bg, color: domainColor.fg, borderColor: domainColor.border }}>
          {domainLabel(domain)}
        </span>
        <span className="system-pill" style={{ background: statusColor.bg, color: statusColor.fg }}>
          <StatusIcon className="w-3 h-3" /> {statusLabel(status)}
        </span>
        {href && <Link className="system-admin-link" href={href}>Open</Link>}
      </div>
    </div>
  );
}
