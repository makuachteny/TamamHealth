'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useOrganizations } from '@/lib/hooks/useOrganizations';
import type { UserDoc, UserRole } from '@/lib/db-types';
import {
  Users, Search, UserX, UserCheck, Shield, Filter
} from '@/components/icons/lucide';

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  doctor: 'Doctor',
  clinical_officer: 'Clinical Officer',
  nurse: 'Nurse',
  midwife: 'Midwife',
  lab_tech: 'Lab Technician',
  pharmacist: 'Pharmacist',
  front_desk: 'Medical Receptionist',
  cashier: 'Cashier',
  government: 'Government',
  county_health_director: 'County Health Director',
  data_entry_clerk: 'Data Entry Clerk',
  medical_superintendent: 'Medical Superintendent',
  hrio: 'Health Records Officer',
  nutritionist: 'Nutritionist',
  radiologist: 'Radiologist',
  hospital_manager: 'Hospital Manager',
  medical_biller: 'Medical Biller',
  central_registration_clerk: 'Registration Clerk',
  clinic_clerk: 'Clinic Clerk',
  triage_nurse: 'Triage Nurse',
  rooming_nurse: 'Rooming Nurse',
  clinician: 'Clinician',
  records_hmis_officer: 'Records / HMIS Officer',
  facility_administrator: 'Facility Administrator',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'var(--accent-primary)',
  org_admin: 'var(--accent-primary)',
  doctor: 'var(--accent-primary)',
  clinical_officer: 'var(--accent-primary)',
  nurse: 'var(--accent-primary)',
  lab_tech: 'var(--accent-primary)',
  pharmacist: 'var(--accent-primary)',
  front_desk: 'var(--accent-primary)',
  government: 'var(--accent-primary)',
  data_entry_clerk: 'var(--accent-primary)',
  medical_superintendent: 'var(--accent-primary)',
  hrio: 'var(--accent-primary)',
  nutritionist: 'var(--color-success)',
  radiologist: 'var(--accent-primary)',
  hospital_manager: 'var(--accent-primary)',
  medical_biller: 'var(--accent-primary)',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const roleLabel = (role: string) => t(`adminUsers.role_${role}`);
  const { currentUser } = useApp();
  const { organizations } = useOrganizations();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterOrg, setFilterOrg] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Access control
  useEffect(() => {
    if (currentUser && currentUser.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { getAllUsers } = await import('@/lib/services/user-service');
        const data = await getAllUsers();
        setUsers(data);
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.hospitalName || '').toLowerCase().includes(q);
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const matchOrg = filterOrg === 'all' || u.orgId === filterOrg;
      return matchSearch && matchRole && matchOrg;
    });
  }, [users, search, filterRole, filterOrg]);

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    if (!currentUser) return;
    try {
      if (currentlyActive) {
        const { deactivateUser } = await import('@/lib/services/user-service');
        await deactivateUser(userId, currentUser._id, currentUser.username);
      } else {
        const { updateUser } = await import('@/lib/services/user-service');
        await updateUser(userId, { isActive: true }, currentUser._id, currentUser.username);
      }
      // Update the row in place — refetching the entire user list after every
      // toggle is wasteful and causes flicker. The service has already
      // persisted the change at this point.
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: !currentlyActive } : u));
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentUser || currentUser.role !== 'super_admin') return null;

  const orgNameMap: Record<string, string> = {};
  organizations.forEach(o => { orgNameMap[o._id] = o.name; });

  // Role stats
  const roleCounts: Record<string, number> = {};
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1; });

  const inputStyle: React.CSSProperties = {
    background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)',
    borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)',
    fontSize: '14px', width: '100%', outline: 'none',
  };
  const selectStyle: React.CSSProperties = {
    ...inputStyle, appearance: 'none' as const, paddingRight: '36px',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238A9E9A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
  };

  return (
    <>
      <TopBar title={t('adminUsers.title')} />
      <main className="page-container page-enter">

        {/* Header stats */}
        <div className="kpi-grid mb-6">
          {[
            { label: t('adminUsers.statTotalUsers'), value: users.length, icon: Users, color: 'var(--accent-primary)', bg: 'var(--accent-light)' },
            { label: t('adminUsers.statActiveUsers'), value: users.filter(u => u.isActive).length, icon: UserCheck, color: 'var(--color-success)', bg: '#05966915' },
            { label: t('adminUsers.statInactiveUsers'), value: users.filter(u => !u.isActive).length, icon: UserX, color: 'var(--color-danger)', bg: '#EF444415' },
            { label: t('adminUsers.statAdminUsers'), value: users.filter(u => u.role === 'super_admin' || u.role === 'org_admin').length, icon: Shield, color: '#7C3AED', bg: '#7C3AED15' },
          ].map(stat => (
            <div key={stat.label} className="kpi">
              <div className="kpi__icon" style={{ background: stat.bg }}>
                <stat.icon style={{ color: stat.color }} />
              </div>
              <div className="kpi__body">
                <div className="kpi__value">{stat.value}</div>
                <div className="kpi__label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1" style={{ minWidth: '200px', maxWidth: '360px' }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text" placeholder={t('adminUsers.searchPlaceholder')}
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...selectStyle, width: 'auto', minWidth: '180px' }}>
            <option value="all">{t('adminUsers.allRoles')}</option>
            {Object.keys(ROLE_LABELS).map((value) => (
              <option key={value} value={value}>{roleLabel(value)} ({roleCounts[value] || 0})</option>
            ))}
          </select>
          <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={{ ...selectStyle, width: 'auto', minWidth: '200px' }}>
            <option value="all">{t('adminUsers.allOrganizations')}</option>
            {organizations.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ color: 'var(--text-muted)', background: 'var(--overlay-subtle)' }}>
            <Filter className="w-3.5 h-3.5" />
            {filteredUsers.length} of {users.length}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    t('adminUsers.colName'), t('adminUsers.colUsername'), t('adminUsers.colRole'),
                    t('adminUsers.colOrganization'), t('adminUsers.colHospital'), t('adminUsers.colStatus'),
                    t('adminUsers.colActions'),
                  ].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('adminUsers.loadingUsers')}</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{t('adminUsers.noUsersFound')}</td></tr>
                ) : filteredUsers.map(u => {
                  const roleColor = ROLE_COLORS[u.role] || '#6B7280';
                  const isExpanded = expandedId === u._id;
                  return (
                    <Fragment key={u._id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : u._id)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-light)' }}
                      className="transition-colors cursor-pointer hover:bg-[var(--overlay-subtle)]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: roleColor }}>
                            {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-sm font-medium" style={{ color: u.isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)' }}>{u.username}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                          background: `${roleColor}18`,
                          color: roleColor,
                        }}>{roleLabel(u.role)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {u.orgId ? (orgNameMap[u.orgId] || u.orgId) : '--'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {u.hospitalName || '--'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full" style={{ background: u.isActive ? 'var(--color-success)' : 'var(--text-muted)' }} />
                          <span style={{ color: u.isActive ? 'var(--color-success)' : 'var(--text-muted)' }}>{u.isActive ? t('adminUsers.statusActive') : t('adminUsers.statusInactive')}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(u._id, u.isActive); }}
                          title={u.isActive ? t('adminUsers.deactivate') : t('adminUsers.activate')}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: u.isActive ? 'var(--color-danger)' : 'var(--color-success)' }}
                        >
                          {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--overlay-subtle)' }}>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('adminUsers.colRole')}: </span><span style={{ color: 'var(--text-primary)' }}>{roleLabel(u.role)}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Department: </span><span style={{ color: 'var(--text-primary)' }}>{u.department || '--'}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Specialty: </span><span style={{ color: 'var(--text-primary)' }}>{u.specialty || '--'}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Phone: </span><span style={{ color: 'var(--text-primary)' }}>{u.phone || '--'}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('adminUsers.colOrganization')}: </span><span style={{ color: 'var(--text-primary)' }}>{u.orgId ? (orgNameMap[u.orgId] || u.orgId) : '--'}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>{t('adminUsers.colHospital')}: </span><span style={{ color: 'var(--text-primary)' }}>{u.hospitalName || '--'}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Created: </span><span style={{ color: 'var(--text-primary)' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '--'}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>User ID: </span><code style={{ color: 'var(--text-secondary)' }}>{u._id}</code></div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="mt-6 rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>{t('adminUsers.roleDistribution')}</p>
          <div className="flex flex-wrap gap-3">
            {Object.keys(ROLE_LABELS).map((role) => {
              const count = roleCounts[role] || 0;
              if (count === 0) return null;
              const color = ROLE_COLORS[role] || '#6B7280';
              return (
                <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{roleLabel(role)}</span>
                  <span className="text-xs font-bold" style={{ color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
