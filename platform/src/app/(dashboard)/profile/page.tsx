'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useApp } from '@/lib/context';
import { useUsers } from '@/lib/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { Save, Shield, User as UserIcon } from '@/components/icons/lucide';

export default function ProfilePage() {
  const { currentUser } = useApp();
  const { update } = useUsers();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setForm({
      name: currentUser.name || '',
      phone: (currentUser as { phone?: string }).phone || '',
    });
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser?._id || !form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      await update(
        currentUser._id,
        { name: form.name.trim(), phone: form.phone.trim() },
        currentUser._id,
        currentUser.username,
      );
      showToast('Profile updated', 'success');
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = currentUser?.name
    ?.split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TH';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Profile" titleIcon={<UserIcon className="w-5 h-5" />} />
      <div className="tamam-page-content">
        <div className="dash-card max-w-3xl">
          <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-light)' }}>
            <span className="ehr-avatar-mark" aria-hidden="true">{initials}</span>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{currentUser?.name || 'Tamam user'}</h1>
              <p className="text-xs capitalize truncate" style={{ color: 'var(--text-muted)' }}>
                {currentUser?.role.replace(/_/g, ' ') || 'Clinical user'}
              </p>
            </div>
          </div>

          <div className="p-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Full name</span>
              <input
                value={form.name}
                onChange={event => setForm(value => ({ ...value, name: event.target.value }))}
                className="w-full"
                style={{ background: 'var(--overlay-subtle)' }}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</span>
              <input
                value={form.phone}
                onChange={event => setForm(value => ({ ...value, phone: event.target.value }))}
                className="w-full"
                style={{ background: 'var(--overlay-subtle)' }}
              />
            </label>
            <div className="sm:col-span-2 rounded-md border p-3 text-xs" style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-2 mb-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <Shield className="w-4 h-4" />
                Account
              </div>
              <p>
                Username: <span className="font-mono">{currentUser?.username || 'unknown'}</span>
                {currentUser?.hospitalName ? <> · Facility: <span>{currentUser.hospitalName}</span></> : null}
              </p>
            </div>
            <div className="sm:col-span-2">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
