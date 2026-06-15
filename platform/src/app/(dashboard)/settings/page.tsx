'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useUsers } from '@/lib/hooks/useUsers';
import { useHospitals } from '@/lib/hooks/useHospitals';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import { statesAndCounties } from '@/data/mock';
import type { UserRole } from '@/lib/db-types';
import FilterBar from '@/components/filters/FilterBar';
import SearchInput from '@/components/filters/SearchInput';
import FilterSelect from '@/components/filters/FilterSelect';
import {
  Users, Building2, Plus, Search, Edit3, KeyRound, UserX, UserCheck,
  X, Eye, EyeOff, RefreshCw, Check,
  Settings as SettingsIcon, Globe, Moon, Sun, Lock, Save, User as UserIcon,
} from '@/components/icons/lucide';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'clinical_officer', label: 'Clinical Officer' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'lab_tech', label: 'Lab Technician' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'front_desk', label: 'Medical Receptionist' },
  { value: 'government', label: 'Government Admin' },
];

const FACILITY_TYPES = [
  { value: 'national_referral', label: 'National Referral' },
  { value: 'state_hospital', label: 'State Hospital' },
  { value: 'county_hospital', label: 'County Hospital' },
];

const ALL_SERVICES = [
  'Surgery', 'Maternity', 'Pediatrics', 'Laboratory', 'X-ray', 'Ultrasound',
  'Pharmacy', 'Emergency', 'ICU', 'Cardiology', 'Orthopedics', 'Dentistry',
  'Ophthalmology', 'Physiotherapy', 'Mental Health', 'TB Treatment', 'HIV/AIDS',
];

const states = Object.keys(statesAndCounties);

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const specials = '!@#$%&*';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += specials[Math.floor(Math.random() * specials.length)];
  pw += Math.floor(Math.random() * 90 + 10);
  return pw;
}

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser, theme, toggleTheme } = useApp();
  const { users, loading: usersLoading, create: createUser, update: updateUser, resetPassword, deactivate } = useUsers();
  const { hospitals, loading: hospitalsLoading, create: createHospital, reload: reloadHospitals } = useHospitals();
  const { canManageUsers } = usePermissions();
  const { locale, setLocale } = useTranslation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'preferences' | 'users' | 'hospitals'>('preferences');

  // ── My account / preferences ──
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showSelfPw, setShowSelfPw] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setProfileForm({ name: currentUser.name || '', phone: (currentUser as { phone?: string }).phone || '' });
    }
  }, [currentUser]);

  const handleSaveProfile = async () => {
    if (!currentUser?._id || !profileForm.name.trim()) { showToast('Name is required', 'error'); return; }
    setProfileSaving(true);
    try {
      await updateUser(currentUser._id, { name: profileForm.name.trim(), phone: profileForm.phone.trim() }, currentUser._id, currentUser.username);
      showToast('Profile updated', 'success');
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangeOwnPassword = async () => {
    if (!currentUser?._id) return;
    if (pwForm.next.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (pwForm.next !== pwForm.confirm) { showToast('Passwords do not match', 'error'); return; }
    setPwSaving(true);
    try {
      await resetPassword(currentUser._id, pwForm.next);
      setPwForm({ next: '', confirm: '' });
      showToast('Password changed', 'success');
    } catch {
      showToast('Failed to change password', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterHospital, setFilterHospital] = useState<string>('all');
  const [filterFacilityType, setFilterFacilityType] = useState<string>('all');

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: '', username: '', password: '', role: 'doctor' as UserRole,
    hospitalId: '', hospitalName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [userFormLoading, setUserFormLoading] = useState(false);

  // Reset password state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Hospital form state
  const [showHospitalForm, setShowHospitalForm] = useState(false);
  const [hospitalForm, setHospitalForm] = useState({
    name: '', facilityType: 'county_hospital' as 'national_referral' | 'state_hospital' | 'county_hospital',
    state: '', town: '',
    totalBeds: 0, icuBeds: 0, maternityBeds: 0, pediatricBeds: 0,
    doctors: 0, clinicalOfficers: 0, nurses: 0, labTechnicians: 0, pharmacists: 0,
    hasElectricity: false, electricityHours: 0, hasGenerator: false, hasSolar: false,
    hasInternet: false, internetType: '', hasAmbulance: false, emergency24hr: false,
    services: [] as string[],
    lat: 0, lng: 0,
  });
  const [hospitalFormLoading, setHospitalFormLoading] = useState(false);

  // Access control
  useEffect(() => {
    if (currentUser && currentUser.role !== 'government') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const matchHosp = filterHospital === 'all' || u.hospitalId === filterHospital;
      return matchSearch && matchRole && matchHosp;
    });
  }, [users, search, filterRole, filterHospital]);

  if (!currentUser || currentUser.role !== 'government') return null;

  const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;

  // ─── User Handlers ────────────────────────────────────────
  const openCreateUser = () => {
    setEditingUser(null);
    const pw = generatePassword();
    setUserForm({ name: '', username: '', password: pw, role: 'doctor', hospitalId: '', hospitalName: '' });
    setShowPassword(true);
    setShowUserForm(true);
  };

  const openEditUser = (userId: string) => {
    const u = users.find(x => x._id === userId);
    if (!u) return;
    setEditingUser(userId);
    setUserForm({
      name: u.name, username: u.username, password: '',
      role: u.role, hospitalId: u.hospitalId || '', hospitalName: u.hospitalName || '',
    });
    setShowUserForm(true);
  };

  const handleUserSubmit = async () => {
    setUserFormLoading(true);
    try {
      if (editingUser) {
        await updateUser(editingUser, {
          name: userForm.name,
          role: userForm.role,
          hospitalId: userForm.role !== 'government' ? userForm.hospitalId : undefined,
          hospitalName: userForm.role !== 'government' ? userForm.hospitalName : undefined,
        }, currentUser._id, currentUser.username);
        showToast('User updated successfully', 'success');
      } else {
        await createUser({
          name: userForm.name,
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          hospitalId: userForm.role !== 'government' ? userForm.hospitalId : undefined,
          hospitalName: userForm.role !== 'government' ? userForm.hospitalName : undefined,
        }, currentUser._id, currentUser.username);
        showToast('User created successfully', 'success');
      }
      setShowUserForm(false);
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e.message || 'Failed to save user', 'error');
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !newPassword) return;
    try {
      await resetPassword(resetUserId, newPassword, currentUser._id, currentUser.username);
      showToast('Password reset successfully', 'success');
      setResetUserId(null);
      setNewPassword('');
    } catch {
      showToast('Failed to reset password', 'error');
    }
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await deactivate(userId, currentUser._id, currentUser.username);
        showToast('User deactivated', 'success');
      } else {
        await updateUser(userId, { isActive: true }, currentUser._id, currentUser.username);
        showToast('User activated', 'success');
      }
    } catch {
      showToast('Failed to update user status', 'error');
    }
  };

  // ─── Hospital Handlers ────────────────────────────────────
  const openCreateHospital = () => {
    setHospitalForm({
      name: '', facilityType: 'county_hospital', state: '', town: '',
      totalBeds: 0, icuBeds: 0, maternityBeds: 0, pediatricBeds: 0,
      doctors: 0, clinicalOfficers: 0, nurses: 0, labTechnicians: 0, pharmacists: 0,
      hasElectricity: false, electricityHours: 0, hasGenerator: false, hasSolar: false,
      hasInternet: false, internetType: '', hasAmbulance: false, emergency24hr: false,
      services: [], lat: 0, lng: 0,
    });
    setShowHospitalForm(true);
  };

  const handleHospitalSubmit = async () => {
    if (!hospitalForm.name || !hospitalForm.state) {
      showToast('Hospital name and state are required', 'error');
      return;
    }
    setHospitalFormLoading(true);
    try {
      await createHospital(hospitalForm, currentUser._id, currentUser.username);
      showToast('Hospital created successfully', 'success');
      setShowHospitalForm(false);
      await reloadHospitals();
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e.message || 'Failed to create hospital', 'error');
    } finally {
      setHospitalFormLoading(false);
    }
  };

  const toggleService = (svc: string) => {
    setHospitalForm(prev => ({
      ...prev,
      services: prev.services.includes(svc)
        ? prev.services.filter(s => s !== svc)
        : [...prev.services, svc],
    }));
  };

  const handleHospitalSelect = (hospId: string) => {
    const h = hospitals.find(x => x._id === hospId);
    setUserForm(prev => ({ ...prev, hospitalId: hospId, hospitalName: h?.name || '' }));
  };

  // ─── Styles ─────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--card-bg)', border: '1px solid var(--border-light)',
    borderRadius: '16px', overflow: 'hidden',
  };
  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg)', border: '1px solid var(--border-light)',
    borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)',
    fontSize: '14px', width: '100%', outline: 'none',
  };
  const selectStyle: React.CSSProperties = {
    ...inputStyle, appearance: 'none' as const, paddingRight: '36px',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238A9E9A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
  };
  const btnPrimary: React.CSSProperties = {
    background: 'var(--accent-primary)', color: 'white',
    border: 'none', borderRadius: '10px', padding: '10px 20px',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '8px',
  };
  const btnSecondary: React.CSSProperties = {
    background: 'var(--input-bg)', color: 'var(--text-primary)',
    border: '1px solid var(--border-light)', borderRadius: '10px', padding: '10px 20px',
    fontSize: '14px', fontWeight: 500, cursor: 'pointer',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block',
  };
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  };
  const modalStyle: React.CSSProperties = {
    background: 'var(--card-bg)', border: '1px solid var(--border-light)',
    borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh',
    overflow: 'auto', padding: '28px',
  };

  return (
    <>
      <TopBar title="Settings" />
      <main className="page-container space-y-6 page-enter">

        {/* Tab bar */}
        <div className="flex gap-2" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0' }}>
          {[
            { key: 'preferences' as const, label: 'Preferences', icon: SettingsIcon },
            ...(canManageUsers ? [
              { key: 'users' as const, label: 'User Management', icon: Users },
              { key: 'hospitals' as const, label: 'Hospital Management', icon: Building2 },
            ] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); setFilterFacilityType('all'); }}
              className="flex items-center gap-2 px-5 py-3 font-medium text-sm transition-colors"
              style={{
                color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-1px',
                background: 'transparent', border: 'none', borderBottomStyle: 'solid',
                borderBottomWidth: '2px',
                borderBottomColor: activeTab === tab.key ? 'var(--accent-primary)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ PREFERENCES TAB (all users) ═══════════════ */}
        {activeTab === 'preferences' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Appearance */}
            <div className="dash-card">
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}><Sun className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /></div>
                <h3 className="font-semibold text-sm">Appearance</h3>
              </div>
              <div className="p-5">
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Theme</p>
                <div className="flex gap-2">
                  {[
                    { v: 'light' as const, label: 'Light', Icon: Sun },
                    { v: 'dark' as const, label: 'Dark', Icon: Moon },
                  ].map(opt => {
                    const active = theme === opt.v;
                    return (
                      <button
                        key={opt.v}
                        onClick={() => { if (theme !== opt.v) toggleTheme(); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                        style={active
                          ? { background: 'var(--accent-light)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' }
                          : { background: 'var(--overlay-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
                      >
                        <opt.Icon className="w-4 h-4" /> {opt.label}
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Language */}
            <div className="dash-card">
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}><Globe className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /></div>
                <h3 className="font-semibold text-sm">Language</h3>
              </div>
              <div className="p-5">
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Display language</p>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as typeof locale)}
                  className="w-full"
                  style={{ background: 'var(--overlay-subtle)' }}
                  aria-label="Display language"
                >
                  {SUPPORTED_LOCALES.map(l => (
                    <option key={l.code} value={l.code}>{l.nativeName || l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* My profile */}
            <div className="dash-card">
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}><UserIcon className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /></div>
                <h3 className="font-semibold text-sm">My profile</h3>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Full name</label>
                  <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} className="w-full" style={{ background: 'var(--overlay-subtle)' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                  <input value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} className="w-full" style={{ background: 'var(--overlay-subtle)' }} />
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Role: <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{currentUser?.role}</span>
                  {currentUser?.username && <> · Username: <span className="font-mono">{currentUser.username}</span></>}
                </div>
                <button onClick={handleSaveProfile} disabled={profileSaving} className="btn btn-primary btn-sm">
                  <Save className="w-4 h-4" /> {profileSaving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </div>

            {/* Security — change my password */}
            <div className="dash-card">
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)' }}>
                <div className="icon-box-sm" style={{ background: 'var(--accent-light)' }}><Lock className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} /></div>
                <h3 className="font-semibold text-sm">Security</h3>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>New password</label>
                  <div className="relative">
                    <input
                      type={showSelfPw ? 'text' : 'password'}
                      value={pwForm.next}
                      onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                      className="w-full pr-9"
                      style={{ background: 'var(--overlay-subtle)' }}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowSelfPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                      {showSelfPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
                  <input
                    type={showSelfPw ? 'text' : 'password'}
                    value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                    className="w-full"
                    style={{ background: 'var(--overlay-subtle)' }}
                    autoComplete="new-password"
                  />
                </div>
                <button onClick={handleChangeOwnPassword} disabled={pwSaving || !pwForm.next} className="btn btn-secondary btn-sm">
                  <KeyRound className="w-4 h-4" /> {pwSaving ? 'Updating…' : 'Change password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ USER MANAGEMENT TAB ═══════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1" style={{ minWidth: '200px', maxWidth: '360px' }}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text" placeholder="Search users..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '36px' }}
                />
              </div>
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={selectStyle}>
                <option value="all">All Roles</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select value={filterHospital} onChange={e => setFilterHospital(e.target.value)} style={{ ...selectStyle, maxWidth: '220px' }}>
                <option value="all">All Hospitals</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
              <div className="flex-1" />
              <button onClick={openCreateUser} style={btnPrimary}>
                <Plus className="w-4 h-4" /> Add User
              </button>
            </div>

            {/* Users table */}
            <div style={card}>
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                      {['Name', 'Username', 'Role', 'Hospital', 'Status', 'Created', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3" style={{
                          fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading users...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No users found</td></tr>
                    ) : filteredUsers.map(u => (
                      <tr key={u._id} style={{ borderBottom: '1px solid var(--border-light)' }}
                          className="hover:bg-[rgba(0,119,215,0.03)] transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--input-bg)', color: 'var(--text-secondary)' }}>{u.username}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                            background: u.role === 'government' ? 'rgba(0,119,215,0.12)' : 'rgba(0,119,215,0.12)',
                            color: u.role === 'government' ? 'var(--accent-primary)' : 'var(--accent-primary)',
                          }}>{roleLabel(u.role)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {u.hospitalName || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full" style={{ background: u.isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                            <span style={{ color: u.isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{u.isActive ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditUser(u._id)} title="Edit"
                              className="p-1.5 rounded-lg hover:bg-[rgba(0,119,215,0.1)] transition-colors" style={{ color: 'var(--text-muted)' }}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setResetUserId(u._id); setNewPassword(generatePassword()); setShowNewPassword(true); }} title="Reset Password"
                              className="p-1.5 rounded-lg hover:bg-[rgba(252,211,77,0.15)] transition-colors" style={{ color: 'var(--text-muted)' }}>
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleToggleActive(u._id, u.isActive)} title={u.isActive ? 'Deactivate' : 'Activate'}
                              className="p-1.5 rounded-lg transition-colors" style={{
                                color: u.isActive ? 'var(--color-danger)' : 'var(--accent-primary)',
                              }}>
                              {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ HOSPITAL MANAGEMENT TAB ═══════════════ */}
        {activeTab === 'hospitals' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <FilterBar>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search hospitals..."
                aria-label="Search hospitals"
              />
              <FilterSelect
                value={filterFacilityType}
                onChange={setFilterFacilityType}
                options={[
                  { value: 'all', label: 'All Types' },
                  ...FACILITY_TYPES,
                ]}
                aria-label="Filter by facility type"
              />
              <FilterBar.Spacer />
              <button onClick={openCreateHospital} style={btnPrimary}>
                <Plus className="w-4 h-4" /> Add Hospital
              </button>
            </FilterBar>

            {/* Hospitals table */}
            <div style={card}>
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                      {['Name', 'State', 'Type', 'Beds', 'Staff', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3" style={{
                          fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hospitalsLoading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading hospitals...</td></tr>
                    ) : hospitals.filter(h => {
                      const q = search.toLowerCase();
                      const matchSearch = !q || h.name.toLowerCase().includes(q) || h.state.toLowerCase().includes(q);
                      const matchType = filterFacilityType === 'all' || h.facilityType === filterFacilityType;
                      return matchSearch && matchType;
                    }).map(h => (
                      <tr key={h._id} style={{ borderBottom: '1px solid var(--border-light)' }}
                          className="hover:bg-[rgba(0,119,215,0.03)] transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{h.state}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                            background: h.facilityType === 'national_referral' ? 'rgba(0,119,215,0.12)' : h.facilityType === 'state_hospital' ? 'rgba(0,119,215,0.12)' : 'rgba(0,119,215,0.12)',
                            color: h.facilityType === 'national_referral' ? 'var(--accent-primary)' : h.facilityType === 'state_hospital' ? 'var(--accent-primary)' : 'var(--accent-primary)',
                          }}>
                            {FACILITY_TYPES.find(f => f.value === h.facilityType)?.label || h.facilityType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{h.totalBeds}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {h.doctors + h.nurses + h.clinicalOfficers + h.labTechnicians + h.pharmacists}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            <span className="w-2 h-2 rounded-full" style={{
                              background: h.syncStatus === 'online' ? 'var(--accent-primary)' : h.syncStatus === 'syncing' ? 'var(--color-warning)' : 'var(--text-muted)',
                            }} />
                            <span style={{
                              color: h.syncStatus === 'online' ? 'var(--accent-primary)' : h.syncStatus === 'syncing' ? 'var(--color-warning)' : 'var(--text-muted)',
                            }}>{h.syncStatus === 'online' ? 'Online' : h.syncStatus === 'syncing' ? 'Syncing' : 'Offline'}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════ CREATE/EDIT USER MODAL ═══════════════ */}
      {showUserForm && (
        <div style={overlayStyle} onClick={() => setShowUserForm(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingUser ? 'Edit User' : 'Create New User'}
              </h3>
              <button onClick={() => setShowUserForm(false)} className="p-1 rounded-lg hover:bg-[rgba(100,116,139,0.1)]" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label style={labelStyle}>Full Name</label>
                <input type="text" value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Dr. Mary Ayen" style={inputStyle} />
              </div>

              {!editingUser && (
                <div>
                  <label style={labelStyle}>Username</label>
                  <input type="text" value={userForm.username}
                    onChange={e => setUserForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                    placeholder="e.g. mary.ayen" style={inputStyle} />
                </div>
              )}

              {!editingUser && (
                <div>
                  <label style={labelStyle}>Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={userForm.password}
                        onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                        style={inputStyle}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button type="button" onClick={() => setUserForm(p => ({ ...p, password: generatePassword() }))}
                      style={btnSecondary} className="flex items-center gap-1.5 whitespace-nowrap">
                      <RefreshCw className="w-3.5 h-3.5" /> Generate
                    </button>
                  </div>
                  {showPassword && userForm.password && (
                    <div className="mt-2 p-3 rounded-lg" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Share this password with the staff member:</p>
                      <p className="text-sm font-mono font-bold mt-1" style={{ color: 'var(--text-primary)', userSelect: 'all' }}>{userForm.password}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>Role</label>
                <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value as UserRole }))} style={selectStyle}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {userForm.role !== 'government' && (
                <div>
                  <label style={labelStyle}>Hospital</label>
                  <select value={userForm.hospitalId} onChange={e => handleHospitalSelect(e.target.value)} style={selectStyle}>
                    <option value="">Select a hospital...</option>
                    {hospitals.map(h => <option key={h._id} value={h._id}>{h.name} — {h.state}</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                <button onClick={() => setShowUserForm(false)} style={btnSecondary}>Cancel</button>
                <button onClick={handleUserSubmit} disabled={userFormLoading} style={{
                  ...btnPrimary, opacity: userFormLoading ? 0.6 : 1,
                }}>
                  {userFormLoading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RESET PASSWORD MODAL ═══════════════ */}
      {resetUserId && (
        <div style={overlayStyle} onClick={() => setResetUserId(null)}>
          <div style={{ ...modalStyle, maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Reset Password</h3>
              <button onClick={() => setResetUserId(null)} className="p-1 rounded-lg hover:bg-[rgba(100,116,139,0.1)]" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Set a new password for <strong>{users.find(u => u._id === resetUserId)?.name}</strong>
            </p>
            <div>
              <label style={labelStyle}>New Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => setNewPassword(generatePassword())}
                  style={btnSecondary} className="flex items-center gap-1.5 whitespace-nowrap">
                  <RefreshCw className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
              {showNewPassword && newPassword && (
                <div className="mt-2 p-3 rounded-lg" style={{ background: 'rgba(252,211,77,0.1)', border: '1px solid rgba(252,211,77,0.2)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Share this with the user:</p>
                  <p className="text-sm font-mono font-bold mt-1" style={{ color: 'var(--text-primary)', userSelect: 'all' }}>{newPassword}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
              <button onClick={() => setResetUserId(null)} style={btnSecondary}>Cancel</button>
              <button onClick={handleResetPassword} style={btnPrimary}>
                <KeyRound className="w-4 h-4" /> Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CREATE HOSPITAL MODAL ═══════════════ */}
      {showHospitalForm && (
        <div style={overlayStyle} onClick={() => setShowHospitalForm(false)}>
          <div style={{ ...modalStyle, maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add New Hospital</h3>
              <button onClick={() => setShowHospitalForm(false)} className="p-1 rounded-lg hover:bg-[rgba(100,116,139,0.1)]" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Basic Info */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>Basic Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label style={labelStyle}>Hospital Name</label>
                    <input type="text" value={hospitalForm.name}
                      onChange={e => setHospitalForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Rumbek State Hospital" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Facility Type</label>
                    <select value={hospitalForm.facilityType}
                      onChange={e => setHospitalForm(p => ({ ...p, facilityType: e.target.value as typeof p.facilityType }))}
                      style={selectStyle}>
                      {FACILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <select value={hospitalForm.state}
                      onChange={e => setHospitalForm(p => ({ ...p, state: e.target.value }))}
                      style={selectStyle}>
                      <option value="">Select state...</option>
                      {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Town</label>
                    <input type="text" value={hospitalForm.town}
                      onChange={e => setHospitalForm(p => ({ ...p, town: e.target.value }))}
                      placeholder="e.g. Rumbek" style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Beds */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>Bed Capacity</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'totalBeds', label: 'Total Beds' },
                    { key: 'icuBeds', label: 'ICU Beds' },
                    { key: 'maternityBeds', label: 'Maternity' },
                    { key: 'pediatricBeds', label: 'Pediatric' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type="number" min="0"
                        value={hospitalForm[f.key as keyof typeof hospitalForm] as number}
                        onChange={e => setHospitalForm(p => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))}
                        style={inputStyle} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>Staff Numbers</h4>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { key: 'doctors', label: 'Doctors' },
                    { key: 'clinicalOfficers', label: 'Clinical Off.' },
                    { key: 'nurses', label: 'Nurses' },
                    { key: 'labTechnicians', label: 'Lab Techs' },
                    { key: 'pharmacists', label: 'Pharmacists' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type="number" min="0"
                        value={hospitalForm[f.key as keyof typeof hospitalForm] as number}
                        onChange={e => setHospitalForm(p => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))}
                        style={inputStyle} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Infrastructure */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>Infrastructure</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { key: 'hasElectricity', label: 'Has Electricity' },
                    { key: 'hasGenerator', label: 'Has Generator' },
                    { key: 'hasSolar', label: 'Has Solar' },
                    { key: 'hasInternet', label: 'Has Internet' },
                    { key: 'hasAmbulance', label: 'Has Ambulance' },
                    { key: 'emergency24hr', label: '24hr Emergency' },
                  ].map(f => (
                    <label key={f.key} className="flex items-center gap-3 cursor-pointer text-sm" style={{ color: 'var(--text-primary)' }}>
                      <input type="checkbox"
                        checked={hospitalForm[f.key as keyof typeof hospitalForm] as boolean}
                        onChange={e => setHospitalForm(p => ({ ...p, [f.key]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-[#3b82f6]"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
                {hospitalForm.hasElectricity && (
                  <div className="mt-3" style={{ maxWidth: '200px' }}>
                    <label style={labelStyle}>Electricity Hours/Day</label>
                    <input type="number" min="0" max="24"
                      value={hospitalForm.electricityHours}
                      onChange={e => setHospitalForm(p => ({ ...p, electricityHours: parseInt(e.target.value) || 0 }))}
                      style={inputStyle} />
                  </div>
                )}
                {hospitalForm.hasInternet && (
                  <div className="mt-3" style={{ maxWidth: '300px' }}>
                    <label style={labelStyle}>Internet Type</label>
                    <input type="text" value={hospitalForm.internetType}
                      onChange={e => setHospitalForm(p => ({ ...p, internetType: e.target.value }))}
                      placeholder="e.g. 4G Mobile, Satellite" style={inputStyle} />
                  </div>
                )}
              </div>

              {/* Services */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>Services Offered</h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_SERVICES.map(svc => (
                    <button key={svc} type="button" onClick={() => toggleService(svc)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                      style={{
                        background: hospitalForm.services.includes(svc) ? 'rgba(0,119,215,0.15)' : 'var(--input-bg)',
                        color: hospitalForm.services.includes(svc) ? 'var(--accent-primary)' : 'var(--text-muted)',
                        border: `1px solid ${hospitalForm.services.includes(svc) ? 'rgba(0,119,215,0.3)' : 'var(--border-light)'}`,
                      }}>
                      {hospitalForm.services.includes(svc) && <Check className="w-3 h-3 inline mr-1" />}
                      {svc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-primary)' }}>Location Coordinates</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Latitude</label>
                    <input type="number" step="0.0001"
                      value={hospitalForm.lat}
                      onChange={e => setHospitalForm(p => ({ ...p, lat: parseFloat(e.target.value) || 0 }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Longitude</label>
                    <input type="number" step="0.0001"
                      value={hospitalForm.lng}
                      onChange={e => setHospitalForm(p => ({ ...p, lng: parseFloat(e.target.value) || 0 }))}
                      style={inputStyle} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                <button onClick={() => setShowHospitalForm(false)} style={btnSecondary}>Cancel</button>
                <button onClick={handleHospitalSubmit} disabled={hospitalFormLoading} style={{
                  ...btnPrimary, opacity: hospitalFormLoading ? 0.6 : 1,
                }}>
                  {hospitalFormLoading ? 'Creating...' : 'Create Hospital'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
