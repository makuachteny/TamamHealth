'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context';
import { useToast } from '@/components/Toast';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePlatformConfig } from '@/lib/hooks/usePlatformConfig';
import { getAllUsers } from '@/lib/services/user-service';
import { getRecentAuditLogs } from '@/lib/services/audit-service';
import {
  getVisibleAnnouncements, createAnnouncement, canPostAnnouncements,
} from '@/lib/services/announcement-service';
import type { UserDoc, AuditLogDoc, AnnouncementDoc, AnnouncementPriority } from '@/lib/db-types';
import { SaPage, SaCard, SaStatusDot, SaPill, SaTable, formatWhen } from '@/components/admin/sa-ui';
import EhrListHeader, { LIST_STAT_COLORS } from '@/components/ehr/EhrListHeader';
import { Send, Building2, Users, ShieldCheck, Megaphone, ClipboardList } from '@/components/icons/lucide';

const SUPPORT_ACTION_RE = /support|impersonat|emergency|break/i;

type SectionId = 'tenants' | 'users' | 'access' | 'announcements' | 'tickets';

export default function AdminSupportPage() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { organizations, loading: orgsLoading } = useOrganizations();
  const { hospitals, loading: hospitalsLoading } = useHospitals();
  const { config } = usePlatformConfig();

  const [users, setUsers] = useState<UserDoc[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementDoc[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [orgQuery, setOrgQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPriority, setAnnPriority] = useState<AnnouncementPriority>('normal');
  const [annOrgId, setAnnOrgId] = useState('');
  const [annPosting, setAnnPosting] = useState(false);

  // Section switching is in-page state only — the URL never changes — since
  // this page bundles five genuinely separate support topics (tenant lookup,
  // user lookup, access policy, announcements, tickets) rather than one list.
  const [activeSection, setActiveSection] = useState<SectionId>('tenants');

  useEffect(() => {
    getAllUsers().then(setUsers).catch(() => setUsers([])).finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    getRecentAuditLogs(500).then(setAuditLogs).catch(() => setAuditLogs([]));
  }, []);

  const loadAnnouncements = useCallback(() => {
    if (!currentUser) return;
    setAnnouncementsLoading(true);
    getVisibleAnnouncements(
      { role: currentUser.role },
      { userId: currentUser._id, role: currentUser.role, hospitalId: currentUser.hospitalId }
    )
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]))
      .finally(() => setAnnouncementsLoading(false));
  }, [currentUser]);

  useEffect(() => { loadAnnouncements(); }, [loadAnnouncements]);

  useEffect(() => {
    if (!annOrgId && organizations.length > 0) setAnnOrgId(organizations[0]._id);
  }, [organizations, annOrgId]);

  const orgById = useMemo(() => {
    const map: Record<string, typeof organizations[number]> = {};
    for (const o of organizations) map[o._id] = o;
    return map;
  }, [organizations]);

  const lastActivityByOrg = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of auditLogs) {
      if (!log.orgId) continue;
      if (!map[log.orgId]) map[log.orgId] = log.createdAt;
    }
    return map;
  }, [auditLogs]);

  const filteredOrgs = useMemo(() => {
    const q = orgQuery.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(o =>
      o.name.toLowerCase().includes(q) ||
      o.slug.toLowerCase().includes(q) ||
      o.contactEmail.toLowerCase().includes(q)
    );
  }, [organizations, orgQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    const base = !q ? users : users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
    return base.slice(0, 50);
  }, [users, userQuery]);

  const supportEvents = useMemo(
    () => auditLogs.filter(l => SUPPORT_ACTION_RE.test(l.action)).slice(0, 25),
    [auditLogs]
  );

  const policies = config?.superAdminPolicies;

  const handlePostAnnouncement = async () => {
    if (!currentUser || !annTitle.trim() || !annBody.trim() || !annOrgId) return;
    setAnnPosting(true);
    try {
      await createAnnouncement({
        title: annTitle,
        body: annBody,
        audience: 'organization',
        priority: annPriority,
        authorId: currentUser._id,
        authorName: currentUser.name,
        orgId: annOrgId,
      });
      setAnnTitle('');
      setAnnBody('');
      setAnnPriority('normal');
      loadAnnouncements();
      showToast('Announcement posted.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to post announcement.', 'error');
    } finally {
      setAnnPosting(false);
    }
  };

  const priorityTone = (p: AnnouncementPriority) => p === 'urgent' ? 'danger' as const : p === 'important' ? 'warn' as const : 'muted' as const;

  const sections: { id: SectionId; label: string; icon: typeof Building2; count: number }[] = [
    { id: 'tenants', label: 'Tenant lookup', icon: Building2, count: organizations.length },
    { id: 'users', label: 'User lookup', icon: Users, count: users.length },
    { id: 'access', label: 'Support access', icon: ShieldCheck, count: supportEvents.length },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, count: announcements.length },
    { id: 'tickets', label: 'Ticket queue', icon: ClipboardList, count: 0 },
  ];

  return (
    <SaPage>
      <div className="saside-shell">
        <nav className="saside-nav" aria-label="Support operations sections">
          <span className="saside-nav-title">Support Operations</span>
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                className={`saside-nav-item${activeSection === s.id ? ' is-active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <Icon className="w-4 h-4" />
                <span>{s.label}</span>
                <b>{s.count}</b>
              </button>
            );
          })}
        </nav>

        <div className="saside-content">
          {activeSection === 'tenants' && (
            <SaCard>
              <EhrListHeader
                title="Tenant lookup & diagnostics"
                stats={[{ label: 'Showing', value: `${filteredOrgs.length} of ${organizations.length}`, color: LIST_STAT_COLORS.muted }]}
                search={{ value: orgQuery, onChange: setOrgQuery, placeholder: 'Search organizations by name, slug, or contact email', ariaLabel: 'Search organizations' }}
              />
              <SaTable
                columns={['Organization', 'Status', 'Plan', 'Users', 'Facilities', 'Last activity', '']}
                empty={orgsLoading ? 'Loading organizations…' : 'No organizations match this search.'}
                minWidth={860}
              >
                {filteredOrgs.map(org => {
                  const userCount = users.filter(u => u.orgId === org._id).length;
                  const facilityCount = hospitals.filter(h => h.orgId === org._id).length;
                  return (
                    <tr key={org._id}>
                      <td>
                        <strong>{org.name}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{org.contactEmail}</div>
                      </td>
                      <td>
                        <SaPill tone={org.subscriptionStatus === 'active' ? 'ok' : org.subscriptionStatus === 'trial' ? 'info' : 'danger'}>
                          {org.subscriptionStatus}
                        </SaPill>
                      </td>
                      <td>{org.subscriptionPlan}</td>
                      <td className="sa-num">{usersLoading ? '…' : userCount}</td>
                      <td className="sa-num">{hospitalsLoading ? '…' : facilityCount}</td>
                      <td>{formatWhen(lastActivityByOrg[org._id])}</td>
                      <td>
                        <Link href="/admin/organizations" className="sa-btn">Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </SaTable>
            </SaCard>
          )}

          {activeSection === 'users' && (
            <SaCard>
              <EhrListHeader
                title="User lookup"
                stats={[{ label: 'Showing', value: `up to 50 of ${users.length}`, color: LIST_STAT_COLORS.muted }]}
                search={{ value: userQuery, onChange: setUserQuery, placeholder: 'Search users by name, username, or phone', ariaLabel: 'Search users' }}
              />
              <SaTable
                columns={['User', 'Role', 'Organization', 'Facility', 'Status']}
                empty={usersLoading ? 'Loading users…' : 'No users match this search.'}
                minWidth={720}
              >
                {filteredUsers.map(u => (
                  <tr key={u._id}>
                    <td>
                      <strong>{u.name}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{u.username}</div>
                    </td>
                    <td>{u.role.replace(/_/g, ' ')}</td>
                    <td>{u.orgId ? (orgById[u.orgId]?.name || u.orgId) : '—'}</td>
                    <td>{u.hospitalName || '—'}</td>
                    <td><SaPill tone={u.isActive ? 'ok' : 'muted'}>{u.isActive ? 'Active' : 'Inactive'}</SaPill></td>
                  </tr>
                ))}
              </SaTable>
            </SaCard>
          )}

          {activeSection === 'access' && (
            <SaCard title="Support access & impersonation">
              {!policies ? (
                <p className="sa-empty">Loading policy configuration…</p>
              ) : (
                <div className="sa-kv">
                  <div className="sa-kv-row">
                    <span>Support access requires ticket</span>
                    <SaStatusDot tone={policies.supportAccessRequiresTicket ? 'ok' : 'warn'} label={policies.supportAccessRequiresTicket ? 'Required' : 'Not required'} />
                  </div>
                  <div className="sa-kv-row">
                    <span>Impersonation</span>
                    <SaStatusDot
                      tone={policies.impersonationEnabled ? 'warn' : 'muted'}
                      label={policies.impersonationEnabled ? `Enabled · max ${policies.impersonationMaxMinutes}m` : 'Disabled'}
                    />
                  </div>
                  <div className="sa-kv-row">
                    <span>Emergency access</span>
                    <SaStatusDot
                      tone={policies.emergencyAccessEnabled ? 'warn' : 'muted'}
                      label={policies.emergencyAccessEnabled ? `Enabled · review within ${policies.emergencyAccessReviewHours}h` : 'Disabled'}
                    />
                  </div>
                </div>
              )}

              <div style={{ margin: '4px 0 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Support session audit trail
              </div>
              <SaTable
                columns={['When', 'User', 'Action', 'Result']}
                empty="No support-access events recorded."
                minWidth={620}
              >
                {supportEvents.map(log => (
                  <tr key={log._id}>
                    <td>{formatWhen(log.createdAt)}</td>
                    <td>{log.username || '—'}</td>
                    <td>{log.action}</td>
                    <td><SaPill tone={log.success ? 'ok' : 'danger'}>{log.success ? 'Success' : 'Failed'}</SaPill></td>
                  </tr>
                ))}
              </SaTable>
            </SaCard>
          )}

          {activeSection === 'announcements' && (
            <SaCard title="Announcements">
              {announcementsLoading ? (
                <p className="sa-empty">Loading announcements…</p>
              ) : announcements.length === 0 ? (
                <p className="sa-empty">No announcements are currently visible.</p>
              ) : (
                <div className="sa-kv" style={{ marginBottom: 4 }}>
                  {announcements.slice(0, 10).map(a => (
                    <div key={a._id} className="sa-kv-row" style={{ alignItems: 'flex-start' }}>
                      <span>
                        <strong style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 700 }}>{a.title}</strong>
                        <span style={{ display: 'block', marginTop: 2, color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'inherit' }}>
                          {a.audience} · {formatWhen(a.createdAt)}
                        </span>
                      </span>
                      <SaPill tone={priorityTone(a.priority)}>{a.priority}</SaPill>
                    </div>
                  ))}
                </div>
              )}

              {currentUser && canPostAnnouncements(currentUser.role) && (
                <div style={{ paddingBlock: 12, borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Announcement title"
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    style={{ height: 32, padding: '0 10px', border: '1px solid var(--ehr-border)', borderRadius: 8, fontSize: 12.5 }}
                  />
                  <textarea
                    placeholder="Message"
                    value={annBody}
                    onChange={e => setAnnBody(e.target.value)}
                    rows={2}
                    style={{ padding: '8px 10px', border: '1px solid var(--ehr-border)', borderRadius: 8, fontSize: 12.5, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      value={annOrgId}
                      onChange={e => setAnnOrgId(e.target.value)}
                      style={{ height: 32, padding: '0 8px', border: '1px solid var(--ehr-border)', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fff' }}
                    >
                      {organizations.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                    </select>
                    <select
                      value={annPriority}
                      onChange={e => setAnnPriority(e.target.value as AnnouncementPriority)}
                      style={{ height: 32, padding: '0 8px', border: '1px solid var(--ehr-border)', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#fff' }}
                    >
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button
                      type="button"
                      className="sa-btn primary"
                      onClick={handlePostAnnouncement}
                      disabled={annPosting || !annTitle.trim() || !annBody.trim() || !annOrgId}
                      style={{ marginLeft: 'auto' }}
                    >
                      <Send className="w-3.5 h-3.5" /> {annPosting ? 'Posting…' : 'Post announcement'}
                    </button>
                  </div>
                </div>
              )}
            </SaCard>
          )}

          {activeSection === 'tickets' && (
            <SaCard title="Ticket queue">
              <p className="sa-empty">No ticket store is configured — support tickets are tracked in your external helpdesk.</p>
            </SaCard>
          )}
        </div>
      </div>

      <style jsx>{`
        .saside-shell {
          display: flex;
          flex: 1;
          min-height: 0;
          gap: 14px;
        }
        .saside-nav {
          display: flex;
          flex-direction: column;
          flex: 0 0 220px;
          min-width: 0;
          gap: 2px;
          padding: 8px;
          border: 1px solid var(--ehr-border);
          border-radius: 12px;
          background: #fff;
          overflow-y: auto;
          align-self: flex-start;
        }
        .saside-nav-title {
          padding: 6px 10px 4px;
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .saside-nav-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 10px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }
        .saside-nav-item:hover {
          background: var(--overlay-subtle, rgba(0, 0, 0, 0.04));
        }
        .saside-nav-item.is-active {
          background: var(--accent-primary);
          color: #fff;
        }
        .saside-nav-item span {
          flex: 1;
          min-width: 0;
        }
        .saside-nav-item b {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.08);
          font-size: 10px;
          font-weight: 800;
        }
        .saside-nav-item.is-active b {
          background: rgba(255, 255, 255, 0.22);
        }
        .saside-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          gap: 14px;
        }
        @media (max-width: 860px) {
          .saside-shell {
            flex-direction: column;
          }
          .saside-nav {
            flex-direction: row;
            flex: 0 0 auto;
            overflow-x: auto;
          }
          .saside-nav-title {
            display: none;
          }
          .saside-nav-item {
            flex: 0 0 auto;
            white-space: nowrap;
          }
        }
      `}</style>
    </SaPage>
  );
}
