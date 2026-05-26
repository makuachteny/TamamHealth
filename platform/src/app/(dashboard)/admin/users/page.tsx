'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
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
  lab_tech: 'Lab Technician',
  pharmacist: 'Pharmacist',
  front_desk: 'Front Desk',
  government: 'Government',
  boma_health_worker: 'Boma Health Worker',
  payam_supervisor: 'Payam Supervisor',
  data_entry_clerk: 'Data Entry Clerk',
  medical_superintendent: 'Medical Superintendent',
  hrio: 'Health Records Officer',
  community_health_volunteer: 'Community Health Volunteer',
  nutritionist: 'Nutritionist',
  radiologist: 'Radiologist',
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
  boma_health_worker: 'var(--color-success)',
  payam_supervisor: 'var(--color-success)',
  data_entry_clerk: 'var(--accent-primary)',
  medical_superintendent: 'var(--accent-primary)',
  hrio: 'var(--accent-primary)',
  community_health_volunteer: 'var(--color-success)',
  nutritionist: 'var(--color-success)',
  radiologist: 'var(--accent-primary)',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { organizations } = useOrganizations();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterOrg, setFilterOrg] = useState<string>('all');

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
      <TopBar title="Cross-Org Users" />
      <main className="page-container page-enter">

        {/* Header stats */}
        <div className="kpi-grid mb-6">
          {[
            { label: 'Total Users', value: users.length, icon: Users, color: '#2563EB', bg: '#2563EB15' },
            { label: 'Active Users', value: users.filter(u => u.isActive).length, icon: UserCheck, color: 'var(--color-success)', bg: '#05966915' },
            { label: 'Inactive Users', value: users.filter(u => !u.isActive).length, icon: UserX, color: 'var(--color-danger)', bg: '#EF444415' },
            { label: 'Admin Users', value: users.filter(u => u.role === 'super_admin' || u.role === 'org_admin').length, icon: Shield, color: '#7C3AED', bg: '#7C3AED15' },
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
              type="text" placeholder="Search by name, username, or hospital..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '36px' }}
            />
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...selectStyle, width: 'auto', minWidth: '180px' }}>
            <option value="all">All Roles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label} ({roleCounts[value] || 0})</option>
            ))}
          </select>
          <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={{ ...selectStyle, width: 'auto', minWidth: '200px' }}>
            <option value="all">All Organizations</option>
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
                  {['Name', 'Username', 'Role', 'Organization', 'Hospital', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No users found</td></tr>
                ) : filteredUsers.map(u => {
                  const roleColor = ROLE_COLORS[u.role] || '#6B7280';
                  return (
                    <tr key={u._id} style={{ borderBottom: '1px solid var(--border-light)' }} className="transition-colors">
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
                        }}>{ROLE_LABELS[u.role] || u.role}</span>
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
                          <span style={{ color: u.isActive ? 'var(--color-success)' : 'var(--text-muted)' }}>{u.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(u._id, u.isActive)}
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: u.isActive ? 'var(--color-danger)' : 'var(--color-success)' }}
                        >
                          {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="mt-6 rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Role Distribution</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ROLE_LABELS).map(([role, label]) => {
              const count = roleCounts[role] || 0;
              if (count === 0) return null;
              const color = ROLE_COLORS[role] || '#6B7280';
              return (
                <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
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
