'use client';

/**
 * Settings (designs 10 + 11) — nav-driven, per-role.
 *
 * The grouped sidebar (design 10) decides what the body shows: exactly one
 * panel at a time. Every user gets their own role's personal panels (design
 * 11 sections — account, role defaults, notifications, security); users with
 * management rights additionally get the design-10 facility panels backed by
 * real functionality: the live Users & roles table, the real facility
 * settings editor, integration/sync status, and restricted actions.
 * There is no role switcher — each user sees only their own settings.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { useApp } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useUsers } from '@/lib/hooks/useUsers';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { getUserPrefs, setUserPrefs } from '@/lib/user-prefs';
import { hasLockPin, setLockPin, clearLockPin } from '@/lib/hooks/useAutoLock';
import { getRoleConfig } from '@/lib/permissions';
import {
  specForRole, getStoredRoleSettings, saveStoredRoleSettings,
  type RoleSettingsValues, type RoleSettingRow, type RoleSettingSection,
} from '@/lib/role-settings';
import { initials } from '@/lib/patient-utils';
import { FacilitySettingsView } from '@/components/settings/FacilitySettingsView';
import { getDhis2SyncLog, isDhis2Configured, type Dhis2SyncLogDoc } from '@/lib/services/dhis2-sync-log-service';
import {
  AlertTriangle, Bell, BedDouble, Building2, Check, ChevronRight, Clock, CreditCard,
  FileText, FlaskConical, KeyRound, List, Lock, Pencil, Pill, Plus, RefreshCw,
  Shield, Stethoscope, Trash2, User, Users, type LucideIcon,
} from '@/components/icons/lucide';

const SECTION_ICONS: Record<string, LucideIcon> = {
  user: User, bell: Bell, shield: Shield, steth: Stethoscope, pill: Pill,
  flask: FlaskConical, card: CreditCard, bed: BedDouble, clock: Clock,
  list: List, doc: FileText, users: Users, sync: RefreshCw, building: Building2,
};

/** Default value for a row, resolving the app-wired specials. */
function rowDefault(row: RoleSettingRow, wired: { language: string; density: string; displayName: string }): boolean | string | null {
  if (row.kind === 'toggle') return row.def;
  if (row.kind === 'select') {
    if (row.key === 'account.language') return wired.language;
    if (row.key === 'account.density') return wired.density;
    return row.def;
  }
  if (row.kind === 'text') return row.key === 'account.displayName' ? wired.displayName : row.def;
  return null;
}

/** Sidebar group heading for a role's own (non-personal) sections. */
function roleGroupTitle(role: string): string {
  if (role === 'doctor' || role === 'clinical_officer' || role === 'clinician') return 'Clinical';
  if (role === 'nurse' || role === 'midwife' || role === 'triage_nurse' || role === 'rooming_nurse') return 'Nursing';
  if (role === 'pharmacist') return 'Pharmacy';
  if (role === 'lab_tech' || role === 'radiologist') return 'Laboratory';
  return 'Workstation';
}

const PERSONAL_IDS = new Set(['account', 'notifications', 'security']);
/** Admin-spec sections replaced by real design-10 panels. */
const ADMIN_REPLACED_IDS = new Set(['facility', 'users', 'integrations']);

type NavItem = { id: string; label: string; icon: LucideIcon; badge?: string };
type NavGroup = { title: string; items: NavItem[] };

export default function RoleSettingsView() {
  const router = useRouter();
  const { currentUser, isOnline, syncPaused, lastSync } = useApp();
  const { showToast } = useToast();
  const { canManageUsers, canAccess } = usePermissions();
  const { users, update: updateUser } = useUsers();
  const { locale, setLocale } = useTranslation();

  const spec = useMemo(() => (currentUser ? specForRole(currentUser.role) : null), [currentUser]);
  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;

  const wired = useMemo(() => ({
    language: SUPPORTED_LOCALES.find(l => l.code === locale)?.nativeName
      || SUPPORTED_LOCALES.find(l => l.code === locale)?.name || 'English',
    density: getUserPrefs().density === 'compact' ? 'Compact' : 'Comfortable',
    displayName: currentUser?.name || '',
  }), [locale, currentUser?.name]);

  // Baseline = stored values over defaults; draft = what's on screen.
  const buildBaseline = useMemo(() => {
    if (!spec || !currentUser) return {} as RoleSettingsValues;
    const stored = getStoredRoleSettings(currentUser._id);
    const map: RoleSettingsValues = {};
    for (const section of spec.sections) {
      for (const row of section.rows) {
        if (row.kind !== 'toggle' && row.kind !== 'select' && row.kind !== 'text') continue;
        const def = rowDefault(row, wired);
        const isWiredRow = row.key === 'account.language' || row.key === 'account.density' || row.key === 'account.displayName';
        map[row.key] = (!isWiredRow && stored[row.key] !== undefined ? stored[row.key] : def) as boolean | string;
      }
    }
    return map;
  }, [spec, currentUser, wired]);

  const [draft, setDraft] = useState<RoleSettingsValues>({});
  const [baseline, setBaseline] = useState<RoleSettingsValues>({});
  useEffect(() => { setDraft(buildBaseline); setBaseline(buildBaseline); }, [buildBaseline]);

  const dirty = useMemo(
    () => Object.keys(draft).some(key => draft[key] !== baseline[key]),
    [draft, baseline],
  );

  const [activePanel, setActivePanel] = useState<string>('account');
  const [saving, setSaving] = useState(false);

  // ── Password + PIN popups (real account actions) ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinForm, setPinForm] = useState({ next: '', confirm: '' });
  const [pinIsSet, setPinIsSet] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);
  useEffect(() => { setPinIsSet(hasLockPin()); }, [pinOpen]);

  // ── Integration status (real: DHIS2 push log + offline sync state) ──
  const [dhis2Log, setDhis2Log] = useState<Dhis2SyncLogDoc | null>(null);
  useEffect(() => {
    let cancelled = false;
    getDhis2SyncLog().then(log => { if (!cancelled) setDhis2Log(log); });
    return () => { cancelled = true; };
  }, []);

  const showFacility = canAccess('/facility-settings');
  const isAdminSpec = useMemo(
    () => Boolean(spec?.sections.some(section => section.id === 'clinical' && section.title === 'Clinical policy')),
    [spec],
  );

  const navGroups = useMemo<NavGroup[]>(() => {
    if (!spec || !currentUser) return [];
    const bySection = (id: string): NavItem | null => {
      const section = spec.sections.find(s => s.id === id);
      return section ? { id: section.id, label: section.title, icon: SECTION_ICONS[section.icon] || User } : null;
    };
    const personal: NavItem[] = ['account', 'notifications', 'security']
      .map(bySection).filter((item): item is NavItem => !!item);
    const groups: NavGroup[] = [{ title: 'My settings', items: personal }];

    const roleItems = spec.sections
      .filter(section => !PERSONAL_IDS.has(section.id) && !(isAdminSpec && ADMIN_REPLACED_IDS.has(section.id)))
      .filter(section => !(isAdminSpec && (section.id === 'clinical' || section.id === 'reporting')))
      .map(section => ({ id: section.id, label: section.title, icon: SECTION_ICONS[section.icon] || User }));
    if (roleItems.length > 0) groups.push({ title: roleGroupTitle(currentUser.role), items: roleItems });

    if (isAdminSpec || showFacility || canManageUsers) {
      const facilityItems: NavItem[] = [];
      if (showFacility) facilityItems.push({ id: 'facility-editor', label: 'Facility settings', icon: Building2 });
      const clinical = spec.sections.find(s => s.id === 'clinical');
      if (isAdminSpec && clinical) facilityItems.push({ id: 'clinical', label: clinical.title, icon: Stethoscope });
      const reporting = spec.sections.find(s => s.id === 'reporting');
      if (isAdminSpec && reporting) facilityItems.push({ id: 'reporting', label: reporting.title, icon: FileText });
      if (facilityItems.length > 0) groups.push({ title: 'Facility', items: facilityItems });

      if (canManageUsers) {
        groups.push({
          title: 'People & access',
          items: [
            { id: 'users-roles', label: 'Users & roles', icon: Users, badge: users.length ? String(users.length) : undefined },
            { id: 'manage-link', label: 'User & hospital management', icon: KeyRound },
          ],
        });
      }
      if (isAdminSpec) {
        groups.push({
          title: 'System',
          items: [
            { id: 'integrations-live', label: 'Integrations & sync', icon: RefreshCw },
            { id: 'restricted', label: 'Restricted actions', icon: AlertTriangle },
          ],
        });
      }
    }
    return groups;
  }, [spec, currentUser, isAdminSpec, showFacility, canManageUsers, users.length]);

  if (!currentUser || !spec) return null;

  const identityRows = [
    { label: 'Role', value: roleConfig?.label || spec.title },
    { label: 'Facility', value: currentUser.hospitalName || 'All facilities' },
    { label: 'Username', value: currentUser.username },
  ];

  const setValue = (key: string, value: boolean | string) => setDraft(prev => ({ ...prev, [key]: value }));
  const handleDiscard = () => setDraft(baseline);

  const handleSave = async () => {
    setSaving(true);
    try {
      const langName = draft['account.language'];
      const langCode = SUPPORTED_LOCALES.find(l => l.nativeName === langName || l.name === langName)?.code;
      if (langCode && langCode !== locale) setLocale(langCode);

      const density = draft['account.density'] === 'Compact' ? 'compact' : 'comfortable';
      if (density !== getUserPrefs().density) setUserPrefs({ density });

      const nextName = String(draft['account.displayName'] || '').trim();
      if (nextName && nextName !== currentUser.name) {
        await updateUser(currentUser._id, { name: nextName }, currentUser._id, currentUser.username);
      }

      saveStoredRoleSettings(currentUser._id, draft);
      setBaseline(draft);
      showToast('Settings saved', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.current) { showToast('Enter your current password', 'error'); return; }
    if (pwForm.next.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (pwForm.next !== pwForm.confirm) { showToast('Passwords do not match', 'error'); return; }
    setPwSaving(true);
    try {
      const { apiFetch } = await import('@/lib/api-fetch');
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(body.error || 'Failed to change password', 'error'); return; }
      setPwForm({ current: '', next: '', confirm: '' });
      setPwOpen(false);
      showToast('Password changed', 'success');
    } catch {
      showToast('Failed to change password — check your connection', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (!/^\d{4,6}$/.test(pinForm.next)) { showToast('PIN must be 4–6 digits', 'error'); return; }
    if (pinForm.next !== pinForm.confirm) { showToast('PINs do not match', 'error'); return; }
    setPinSaving(true);
    try {
      await setLockPin(pinForm.next);
      setPinIsSet(true);
      setPinForm({ next: '', confirm: '' });
      setPinOpen(false);
      showToast('Screen-lock PIN set', 'success');
    } finally {
      setPinSaving(false);
    }
  };

  const handleNav = (id: string) => {
    if (id === 'manage-link') { router.push('/settings/manage'); return; }
    setActivePanel(id);
  };

  const renderControl = (row: RoleSettingRow): ReactNode => {
    if (row.kind === 'toggle') {
      const on = Boolean(draft[row.key]);
      return (
        <button
          type="button"
          className={`ehr-set-toggle ${on ? 'is-on' : ''}`.trim()}
          role="switch"
          aria-checked={on}
          aria-label={row.label}
          onClick={() => setValue(row.key, !on)}
        >
          <b>{on ? 'On' : 'Off'}</b>
          <span><i /></span>
        </button>
      );
    }
    if (row.kind === 'select') {
      const options = row.key === 'account.language'
        ? SUPPORTED_LOCALES.map(l => l.nativeName || l.name)
        : row.options;
      const value = String(draft[row.key] ?? row.def);
      return (
        <select
          className="ehr-set-select"
          value={value}
          aria-label={row.label}
          onChange={event => setValue(row.key, event.target.value)}
        >
          {(options.includes(value) ? options : [value, ...options]).map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }
    if (row.kind === 'text') {
      return (
        <input
          className="ehr-set-input"
          value={String(draft[row.key] ?? '')}
          aria-label={row.label}
          onChange={event => setValue(row.key, event.target.value)}
        />
      );
    }
    if (row.kind === 'action') {
      return (
        <button
          type="button"
          className="ehr-queue-action-pill"
          onClick={() => (row.action === 'password' ? setPwOpen(true) : setPinOpen(true))}
        >
          {row.action === 'pin' && pinIsSet ? 'Change PIN' : row.buttonLabel}
        </button>
      );
    }
    return (
      <span className="ehr-set-locked">
        <Lock /> {row.value}
      </span>
    );
  };

  const renderSection = (section: RoleSettingSection) => {
    const Icon = SECTION_ICONS[section.icon] || User;
    return (
      <section key={section.id} className="ehr-set-section">
        <div className="ehr-set-section-head">
          <span><Icon /></span>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <h3>{section.title}</h3>
            <small>{section.note}</small>
          </div>
        </div>
        {section.rows.map(row => (
          <div key={`${section.id}-${row.label}`} className="ehr-set-row">
            <div className="ehr-set-row-label">
              <b>{row.label}</b>
              <span>{row.hint}</span>
            </div>
            {renderControl(row)}
          </div>
        ))}
      </section>
    );
  };

  // ── Users & roles panel (real accounts; full editing lives in /settings/manage) ──
  const renderUsersPanel = () => (
    <section className="ehr-set-section">
      <div className="ehr-set-section-head">
        <span><Users /></span>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <h3>Users &amp; roles</h3>
          <small>{users.filter(u => u.isActive).length} active · {users.filter(u => !u.isActive).length} inactive</small>
        </div>
        <button type="button" className="ehr-set-btn primary" style={{ minHeight: 30, padding: '0 13px', fontSize: 12 }} onClick={() => router.push('/settings/manage')}>
          <Plus /> Invite user
        </button>
      </div>
      <div className="ehr-set-users-scroll">
        <div className="ehr-set-users-head" aria-hidden="true">
          {['User', 'Role', 'Facility', 'Status', 'Action'].map(head => <span key={head}>{head}</span>)}
        </div>
        {users.map(user => {
          const userSpec = specForRole(user.role);
          return (
            <div key={user._id} className="ehr-set-user-row">
              <div className="ehr-set-user-id">
                <span style={{ background: userSpec.accent }}>{initials(user.name)}</span>
                <div>
                  <b>{user.name}</b>
                  <small>{user.username}</small>
                </div>
              </div>
              <span className="ehr-set-user-role">{getRoleConfig(user.role)?.label || user.role}</span>
              <span className="ehr-set-user-dept">{user.hospitalName || '—'}</span>
              <span>
                <i className={`ehr-set-user-status ${user.isActive ? 'is-active' : 'is-off'}`.trim()}>
                  {user.isActive ? 'Active' : 'Suspended'}
                </i>
              </span>
              <span className="ehr-set-user-actions">
                <button type="button" className="ehr-queue-action" title="Edit in user management" onClick={() => router.push('/settings/manage')}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" className="ehr-queue-action" title="Reset password in user management" onClick={() => router.push('/settings/manage')}>
                  <KeyRound className="w-4 h-4" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );

  // ── Integrations & sync panel (real status where the app has it) ──
  const renderIntegrationsPanel = () => {
    const lastPush = dhis2Log?.lastPush;
    const dhis2Status = !isDhis2Configured()
      ? { label: 'Not set up', tone: 'neutral', detail: 'Set NEXT_PUBLIC_DHIS2_BASE_URL to enable national reporting.' }
      : lastPush?.status === 'pushed'
        ? { label: 'Connected', tone: 'green', detail: `HMIS + IDSR datasets. Last push ${dhis2Log?.lastSyncedAt ? new Date(dhis2Log.lastSyncedAt).toLocaleString() : '—'}.` }
        : lastPush?.status === 'failed'
          ? { label: 'Error', tone: 'red', detail: lastPush.message || 'Last push failed — retry from Facility Sync.' }
          : { label: 'Pending', tone: 'yellow', detail: 'Configured — no push recorded yet on this device.' };
    const replicationStatus = syncPaused
      ? { label: 'Pending', tone: 'yellow', detail: 'Sync paused on this device.' }
      : isOnline
        ? { label: 'Connected', tone: 'green', detail: `Offline-first queue. Last sync ${lastSync ? new Date(lastSync).toLocaleString() : '—'}.` }
        : { label: 'Error', tone: 'red', detail: 'Offline — changes queue locally until connectivity returns.' };
    const cells = [
      { name: 'DHIS2 national reporting', ...dhis2Status },
      { name: 'Country node replication', ...replicationStatus },
      {
        name: 'm-Gurush mobile money',
        label: draft['int.mgurush'] ? 'Connected' : 'Not set up', tone: draft['int.mgurush'] ? 'green' : 'neutral',
        detail: draft['int.mgurush'] ? 'Payment confirmations posted to billing.' : 'Enable in Integrations policy to post confirmations.',
      },
      {
        name: 'SMS gateway',
        label: draft['int.sms'] ? 'Pending' : 'Not set up', tone: draft['int.sms'] ? 'yellow' : 'neutral',
        detail: draft['int.sms'] ? 'Sender ID awaiting regulator approval.' : 'No sender ID requested.',
      },
    ];
    const integrationsSection = spec.sections.find(s => s.id === 'integrations');
    return (
      <>
        <section className="ehr-set-section">
          <div className="ehr-set-section-head">
            <span><RefreshCw /></span>
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <h3>Integrations &amp; offline sync</h3>
              <small>Live status on this device</small>
            </div>
          </div>
          <div className="ehr-set-integrations">
            {cells.map(cell => (
              <div key={cell.name}>
                <i className="ehr-set-int-pill" data-tone={cell.tone}>{cell.label}</i>
                <b>{cell.name}</b>
                <p>{cell.detail}</p>
              </div>
            ))}
          </div>
        </section>
        {integrationsSection && renderSection(integrationsSection)}
      </>
    );
  };

  // ── Restricted actions (danger zone) ──
  const renderRestrictedPanel = () => (
    <section className="ehr-set-section ehr-set-danger">
      <div className="ehr-set-section-head">
        <span><AlertTriangle /></span>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <h3>Restricted actions</h3>
          <small>Audited — changes here affect the whole facility</small>
        </div>
      </div>
      {[
        {
          label: 'Merge duplicate patient records',
          hint: 'Review suspected duplicates in the patient registry. Merges are audited and cannot be undone.',
          action: 'Review patients',
          onClick: () => router.push('/patients'),
        },
        {
          label: 'Export the full patient database',
          hint: 'Requires facility admin plus a Ministry authorisation code.',
          action: 'Request export',
          onClick: () => showToast('Full export requires a Ministry authorisation code.', 'error'),
        },
        {
          label: 'Reset settings on this device',
          hint: 'Restores every preference on this page to its default. Facility data is untouched.',
          action: 'Reset',
          onClick: () => {
            if (!window.confirm('Reset all settings on this device to their defaults?')) return;
            saveStoredRoleSettings(currentUser._id, {});
            window.location.reload();
          },
        },
      ].map(row => (
        <div key={row.label} className="ehr-set-row">
          <div className="ehr-set-row-label">
            <b>{row.label}</b>
            <span>{row.hint}</span>
          </div>
          <button type="button" className="ehr-set-danger-btn" onClick={row.onClick}>{row.action}</button>
        </div>
      ))}
    </section>
  );

  const renderPanel = (): ReactNode => {
    if (activePanel === 'facility-editor') {
      return (
        <section className="ehr-set-section ehr-set-embed">
          <FacilitySettingsView embedded />
        </section>
      );
    }
    if (activePanel === 'users-roles') return renderUsersPanel();
    if (activePanel === 'integrations-live') return renderIntegrationsPanel();
    if (activePanel === 'restricted') return renderRestrictedPanel();
    const section = spec.sections.find(s => s.id === activePanel) || spec.sections[0];
    return (
      <>
        {section.id === 'account' && (
          <div className="ehr-set-scope-grid">
            <div className="ehr-set-scope">
              <b>{spec.subtitle}</b>
              <p>{spec.scope}</p>
            </div>
            <div className="ehr-set-chips">
              <span>You control</span>
              <div>
                {spec.chips.map(chip => <span key={chip}>{chip}</span>)}
              </div>
            </div>
          </div>
        )}
        {renderSection(section)}
      </>
    );
  };

  const userInitials = initials(currentUser.name || spec.title);

  return (
    <div className="ehr-schedule-shell ehr-set-shell">
      {/* ── Page header: breadcrumb + role chip · saved state + actions ── */}
      <section className="ehr-set-header">
        <div className="ehr-set-header-left">
          <h1>Settings</h1>
          <ChevronRight className="w-3.5 h-3.5" />
          <span
            className="ehr-set-role-chip"
            style={{ background: 'rgba(33,145,208,0.10)', color: 'var(--tb-blue-800, #015697)' }}
          >
            <i style={{ background: spec.accent }}>{userInitials}</i>
            {spec.title}
          </span>
        </div>
        <div className="ehr-set-header-actions">
          <span className={`ehr-set-saved ${dirty ? 'is-dirty' : ''}`.trim()}>
            <i /> {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button type="button" className="ehr-set-btn" disabled={!dirty || saving} onClick={handleDiscard}>
            Discard
          </button>
          <button type="button" className="ehr-set-btn primary" disabled={!dirty || saving} onClick={() => void handleSave()}>
            <Check /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className="ehr-set-grid">
        {/* ── Left rail: identity + grouped nav (drives the body) ── */}
        <aside className="ehr-set-rail">
          <div className="ehr-set-identity">
            <div className="ehr-set-identity-body">
              <div className="ehr-set-identity-head">
                <span style={{ background: spec.accent }}>{userInitials}</span>
                <div style={{ minWidth: 0 }}>
                  <b>{currentUser.name}</b>
                  <small>{currentUser.username}{currentUser.hospitalName ? ` · ${currentUser.hospitalName}` : ''}</small>
                </div>
              </div>
              <div className="ehr-set-identity-rows">
                {identityRows.map(row => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <b title={row.value}>{row.value}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <nav className="ehr-set-nav" aria-label="Settings sections">
            {navGroups.map(group => (
              <div key={group.title} className="ehr-set-nav-group">
                <span className="ehr-set-nav-group-title">{group.title}</span>
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={activePanel === item.id ? 'active' : undefined}
                      onClick={() => handleNav(item.id)}
                    >
                      <Icon />
                      <em>{item.label}</em>
                      {item.badge ? <b className="is-badge">{item.badge}</b> : item.id === 'manage-link' ? <b><ChevronRight className="w-3 h-3" /></b> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Right: exactly the panel the sidebar selected ── */}
        <main className="ehr-set-main">
          {renderPanel()}
        </main>
      </section>

      {/* ── Change password popup ── */}
      {pwOpen && (
        <Modal onClose={() => setPwOpen(false)} width={420}>
          <div className="ehr-handoff-modal" role="dialog" aria-modal="true" aria-label="Change password">
            <div className="ehr-handoff-head">
              <div className="ehr-handoff-head-title">
                <KeyRound />
                <div>
                  <h2>Change password</h2>
                  <p>{currentUser.name}</p>
                </div>
              </div>
              <div className="ehr-handoff-head-actions">
                <button type="button" className="ehr-handoff-close" aria-label="Close" onClick={() => setPwOpen(false)}>✕</button>
              </div>
            </div>
            <div className="ehr-handoff-body">
              <div>
                <label className="ehr-handoff-label">Current password</label>
                <input type="password" className="ehr-handoff-input" autoComplete="current-password"
                  value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
              </div>
              <div>
                <label className="ehr-handoff-label">New password</label>
                <input type="password" className="ehr-handoff-input" autoComplete="new-password"
                  value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} />
              </div>
              <div>
                <label className="ehr-handoff-label">Confirm new password</label>
                <input type="password" className="ehr-handoff-input" autoComplete="new-password"
                  value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
              </div>
              <button type="button" className="ehr-handoff-btn primary" disabled={pwSaving || !pwForm.current || !pwForm.next}
                onClick={() => void handleChangePassword()}>
                {pwSaving ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Screen-lock PIN popup ── */}
      {pinOpen && (
        <Modal onClose={() => setPinOpen(false)} width={420}>
          <div className="ehr-handoff-modal" role="dialog" aria-modal="true" aria-label="Screen-lock PIN">
            <div className="ehr-handoff-head">
              <div className="ehr-handoff-head-title">
                <Lock />
                <div>
                  <h2>Screen-lock PIN</h2>
                  <p>{pinIsSet ? 'PIN is active on this device' : 'Quick unlock on this shared device'}</p>
                </div>
              </div>
              <div className="ehr-handoff-head-actions">
                {pinIsSet && (
                  <button
                    type="button"
                    className="ehr-handoff-btn sm"
                    onClick={() => { clearLockPin(); setPinIsSet(false); setPinForm({ next: '', confirm: '' }); showToast('Screen-lock PIN removed', 'success'); }}
                  >
                    <Trash2 /> Remove
                  </button>
                )}
                <button type="button" className="ehr-handoff-close" aria-label="Close" onClick={() => setPinOpen(false)}>✕</button>
              </div>
            </div>
            <div className="ehr-handoff-body">
              <div>
                <label className="ehr-handoff-label">{pinIsSet ? 'New PIN' : 'PIN'} (4–6 digits)</label>
                <input type="password" inputMode="numeric" maxLength={6} className="ehr-handoff-input" autoComplete="off"
                  value={pinForm.next} onChange={e => setPinForm(p => ({ ...p, next: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div>
                <label className="ehr-handoff-label">Confirm PIN</label>
                <input type="password" inputMode="numeric" maxLength={6} className="ehr-handoff-input" autoComplete="off"
                  value={pinForm.confirm} onChange={e => setPinForm(p => ({ ...p, confirm: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <button type="button" className="ehr-handoff-btn primary" disabled={pinSaving || !pinForm.next}
                onClick={() => void handleSetPin()}>
                {pinSaving ? 'Saving…' : pinIsSet ? 'Update PIN' : 'Set PIN'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
