'use client';

import { useEffect, useState, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  Users, Plus, MoreVertical, KeyRound,
  UserX, X, Eye, EyeOff, ChevronDown, AlertCircle,
  Copy, Check, RefreshCw, ShieldCheck,
} from '@/components/icons/lucide';

/**
 * Generate a strong, readable temporary password. Avoids look-alike
 * characters (0/O, 1/l/I) so it can be relayed verbally or on paper without
 * ambiguity. The user must change it at first login (mustChangePassword).
 */
function generateTempPassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const out: string[] = [];
  const rand = (n: number) =>
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(1))[0] % n
      : Math.floor(Math.random() * n);
  for (let i = 0; i < length; i++) out.push(alphabet[rand(alphabet.length)]);
  return out.join('');
}

const MIN_PASSWORD_LENGTH = 8;
import type { UserDoc, HospitalDoc, UserRole } from '@/lib/db-types';
import type { DataScope } from '@/lib/services/data-scope';

export default function OrgUsersPage() {
  const { currentUser, globalSearch } = useApp();
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [hospitals, setHospitals] = useState<HospitalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Create form state
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('doctor');
  const [formHospitalId, setFormHospitalId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset password state
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Credential hand-off panel — shown after create/reset so the admin can copy
  // the temporary password to give to the new user.
  const [handoff, setHandoff] = useState<{ username: string; password: string; kind: 'created' | 'reset' } | null>(null);
  const [copied, setCopied] = useState(false);

  const brandColor = currentUser?.branding?.primaryColor || '#3b82f6';

  const loadData = useCallback(async () => {
    if (!currentUser?.orgId) return;
    try {
      const scope: DataScope = { orgId: currentUser.orgId, role: currentUser.role as UserRole };
      const [{ getAllUsers }, { getAllHospitals }, { getAvailableRoles }] = await Promise.all([
        import('@/lib/services/user-service'),
        import('@/lib/services/hospital-service'),
        import('@/lib/permissions'),
      ]);

      const [u, h] = await Promise.all([
        getAllUsers(scope),
        getAllHospitals(scope),
      ]);

      setUsers(u);
      setHospitals(h);

      // Determine org type to get available roles
      if (currentUser.organization) {
        const roles = getAvailableRoles(currentUser.organization.orgType);
        // Org admin can't assign super_admin
        setAvailableRoles(roles.filter(r => r !== 'super_admin'));
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  const ROLES_WITHOUT_HOSPITAL: UserRole[] = ['super_admin', 'org_admin', 'government'];
  const needsHospital = !ROLES_WITHOUT_HOSPITAL.includes(formRole);

  const handleCreate = async () => {
    setError('');
    if (!formUsername.trim() || !formPassword.trim() || !formName.trim()) {
      setError(t('orgUsers.errorRequiredFields'));
      return;
    }
    if (needsHospital && !formHospitalId) {
      setError(t('orgUsers.errorSelectHospital'));
      return;
    }
    if (formPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('orgUsers.errorPasswordLength'));
      return;
    }

    setCreating(true);
    try {
      const { createUser } = await import('@/lib/services/user-service');
      const selectedHospital = hospitals.find(h => h._id === formHospitalId);
      const newUsername = formUsername.trim().toLowerCase();
      const tempPassword = formPassword;
      await createUser(
        {
          username: newUsername,
          password: tempPassword,
          name: formName.trim(),
          role: formRole,
          hospitalId: needsHospital ? formHospitalId : undefined,
          hospitalName: needsHospital ? selectedHospital?.name : undefined,
          orgId: currentUser?.orgId,
        },
        currentUser?._id,
        currentUser?.username
      );
      setShowCreateModal(false);
      // Surface the credentials so the admin can hand them off. The new user
      // will be forced to change this temporary password at first login.
      setHandoff({ username: newUsername, password: tempPassword, kind: 'created' });
      setFormUsername('');
      setFormPassword('');
      setFormName('');
      setFormRole('doctor');
      setFormHospitalId('');
      await loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || t('orgUsers.errorCreateFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const { deactivateUser } = await import('@/lib/services/user-service');
      await deactivateUser(userId, currentUser?._id, currentUser?.username);
      setSuccess(t('orgUsers.successUserDeactivated'));
      setActionMenu(null);
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || t('orgUsers.errorDeactivateFailed'));
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleResetPassword = async () => {
    if (!showResetModal || !resetPassword.trim()) return;
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('orgUsers.errorPasswordLength'));
      return;
    }
    setResetting(true);
    try {
      const { resetPassword: resetPw } = await import('@/lib/services/user-service');
      const targetUser = users.find(u => u._id === showResetModal);
      const tempPassword = resetPassword;
      await resetPw(showResetModal, tempPassword, currentUser?._id, currentUser?.username);
      setShowResetModal(null);
      setResetPassword('');
      if (targetUser) {
        setHandoff({ username: targetUser.username, password: tempPassword, kind: 'reset' });
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || t('orgUsers.errorResetFailed'));
    } finally {
      setResetting(false);
    }
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      super_admin: t('orgUsers.roleSuperAdmin'),
      org_admin: t('orgUsers.roleOrgAdmin'),
      doctor: t('orgUsers.roleDoctor'),
      clinical_officer: t('orgUsers.roleClinicalOfficer'),
      nurse: t('orgUsers.roleNurse'),
      lab_tech: t('orgUsers.roleLabTech'),
      pharmacist: t('orgUsers.rolePharmacist'),
      front_desk: t('orgUsers.roleFrontDesk'),
      government: t('orgUsers.roleGovernment'),
      data_entry_clerk: t('orgUsers.roleDataEntryClerk'),
      medical_superintendent: t('orgUsers.roleMedicalSuperintendent'),
      hrio: t('orgUsers.roleHrio'),
      nutritionist: t('orgUsers.roleNutritionist'),
      radiologist: t('orgUsers.roleRadiologist'),
      hospital_manager: t('orgUsers.roleHospitalManager'),
      medical_biller: t('orgUsers.roleMedicalBiller'),
    };
    return map[role] || role;
  };

  const roleColor = (role: string) => {
    const map: Record<string, string> = {
      super_admin: 'var(--color-danger)',
      org_admin: '#7C3AED',
      doctor: 'var(--accent-primary)',
      clinical_officer: '#8B5CF6',
      nurse: '#EC4899',
      lab_tech: '#06B6D4',
      pharmacist: 'var(--color-warning)',
      front_desk: '#3B82F6',
      government: 'var(--accent-primary)',
      data_entry_clerk: '#0891B2',
      medical_superintendent: '#1E40AF',
      hrio: '#0F766E',
      nutritionist: '#EA580C',
      radiologist: '#7C3AED',
      hospital_manager: '#1E3A8A',
      medical_biller: '#3b82f6',
    };
    return map[role] || '#6B7280';
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterStatus === 'active' && !u.isActive) return false;
    if (filterStatus === 'inactive' && u.isActive) return false;
    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      if (
        !u.name.toLowerCase().includes(q) &&
        !u.username.toLowerCase().includes(q) &&
        !u.role.toLowerCase().includes(q) &&
        !(u.hospitalName || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={t('orgUsers.pageTitle')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: brandColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={t('orgUsers.pageTitle')} />

      <div className="page-container page-enter">
        {/* Success/Error banners */}
        {success && (
          <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)', border: '1px solid var(--accent-border)' }}>
            {success}
          </div>
        )}
        {error && !showCreateModal && !showResetModal && (
          <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(229,46,66,0.2)' }}>
            {error}
          </div>
        )}

        <PageHeader
          icon={Users}
          title={t('orgUsers.heading')}
          subtitle={t('orgUsers.subtitle', { count: users.length })}
          actions={
            <button
              onClick={() => { setError(''); setShowCreateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: brandColor }}
            >
              <Plus className="w-4 h-4" />
              {t('orgUsers.createUser')}
            </button>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">{t('orgUsers.allRoles')}</option>
              {availableRoles.map(r => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">{t('orgUsers.allStatus')}</option>
              <option value="active">{t('orgUsers.statusActive')}</option>
              <option value="inactive">{t('orgUsers.statusInactive')}</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {t('orgUsers.showingCount', { shown: filteredUsers.length, total: users.length })}
          </span>
        </div>

        {/* Users Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgUsers.colName')}</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgUsers.colUsername')}</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgUsers.colRole')}</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgUsers.colHospital')}</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgUsers.colStatus')}</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>{t('orgUsers.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    {t('orgUsers.noUsersFound')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: roleColor(user.role) }}
                        >
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: `${roleColor(user.role)}15`,
                          color: roleColor(user.role),
                        }}
                      >
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {user.hospitalName || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: user.isActive ? 'rgba(59, 130, 246,0.1)' : 'rgba(229,46,66,0.1)',
                          color: user.isActive ? 'var(--accent-primary)' : 'var(--color-danger)',
                        }}
                      >
                        {user.isActive ? t('orgUsers.statusActive') : t('orgUsers.statusInactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right relative">
                      <button
                        onClick={() => setActionMenu(actionMenu === user._id ? null : user._id)}
                        className="p-1.5 rounded-lg hover:opacity-80 transition-all"
                        style={{ background: 'var(--overlay-subtle)' }}
                      >
                        <MoreVertical className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      </button>

                      {actionMenu === user._id && (
                        <div
                          className="absolute right-4 top-full mt-1 z-50 rounded-lg shadow-xl py-1 min-w-[160px]"
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <button
                            onClick={() => {
                              setError('');
                              setShowResetModal(user._id);
                              setResetPassword('');
                              setActionMenu(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:opacity-80"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <KeyRound className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
                            {t('orgUsers.resetPassword')}
                          </button>
                          {user.isActive && user._id !== currentUser?._id && (
                            <button
                              onClick={() => handleDeactivate(user._id)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:opacity-80"
                              style={{ color: 'var(--color-danger)' }}
                            >
                              <UserX className="w-3.5 h-3.5" />
                              {t('orgUsers.deactivate')}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg mx-4 rounded-xl shadow-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('orgUsers.createNewUser')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:opacity-80">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(229,46,66,0.2)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgUsers.fieldFullName')}</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={t('orgUsers.fullNamePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgUsers.fieldUsername')}</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={e => setFormUsername(e.target.value)}
                  placeholder={t('orgUsers.usernamePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgUsers.fieldPassword')}</label>
                  <button
                    type="button"
                    onClick={() => { setFormPassword(generateTempPassword()); setShowPassword(true); }}
                    className="flex items-center gap-1 text-xs font-semibold"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    <RefreshCw className="w-3 h-3" /> Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder={t('orgUsers.passwordPlaceholder')}
                    className="w-full px-3 py-2 pr-10 rounded-lg text-sm"
                    style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    ) : (
                      <Eye className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <ShieldCheck className="w-3 h-3" /> Temporary — the user must set their own password at first login.
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgUsers.fieldRole')}</label>
                <div className="relative">
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm"
                    style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Hospital (conditional) */}
              {needsHospital && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('orgUsers.fieldAssignedHospital')}</label>
                  <div className="relative">
                    <select
                      value={formHospitalId}
                      onChange={e => setFormHospitalId(e.target.value)}
                      className="w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm"
                      style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    >
                      <option value="">{t('orgUsers.selectHospitalOption')}</option>
                      {hospitals.map(h => (
                        <option key={h._id} value={h._id}>{h.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
              >
                {t('action.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: brandColor }}
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {t('orgUsers.createUser')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credential hand-off panel — shown after create or reset */}
      {handoff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setHandoff(null); setCopied(false); }}
        >
          <div
            className="w-full max-w-md mx-4 rounded-xl shadow-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {handoff.kind === 'created' ? 'User created' : 'Password reset'}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Share these credentials securely. The user must change the password at first login.
                </p>
              </div>
            </div>

            <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Username</span>
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{handoff.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Temporary password</span>
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{handoff.password}</span>
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`Username: ${handoff.username}\nTemporary password: ${handoff.password}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch { /* clipboard unavailable — user can read the values above */ }
              }}
              className="btn btn-secondary w-full justify-center mb-2"
            >
              {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy credentials</>}
            </button>
            <button
              onClick={() => { setHandoff(null); setCopied(false); }}
              className="btn btn-primary w-full justify-center"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowResetModal(null)}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-xl shadow-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('orgUsers.resetPassword')}</h2>
              </div>
              <button onClick={() => setShowResetModal(null)} className="p-1">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2 rounded-lg text-xs" style={{ background: 'rgba(229,46,66,0.1)', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}

            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              {t('orgUsers.resetPasswordPrompt')} <strong style={{ color: 'var(--text-primary)' }}>{users.find(u => u._id === showResetModal)?.username}</strong>
            </p>

            <div className="flex justify-end mb-1.5">
              <button
                type="button"
                onClick={() => { setResetPassword(generateTempPassword()); setShowPassword(true); }}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--accent-text)' }}
              >
                <RefreshCw className="w-3 h-3" /> Generate
              </button>
            </div>
            <div className="relative mb-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                placeholder={t('orgUsers.newPasswordPlaceholder')}
                className="w-full px-3 py-2 pr-10 rounded-lg text-sm"
                style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <Eye className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                )}
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetModal(null)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
              >
                {t('action.cancel')}
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--color-warning)' }}
              >
                {resetting ? t('orgUsers.resetting') : t('orgUsers.resetPassword')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close action menu */}
      {actionMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
      )}
    </div>
  );
}
