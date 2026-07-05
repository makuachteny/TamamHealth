'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Bell, BellOff, AlertTriangle, ArrowRightLeft, FlaskConical, Calendar, ClipboardCheck, Pill, X } from '@/components/icons/lucide';
import { useNotifications, getNotificationAlertPref, setNotificationAlertPref, type NotificationItem } from '@/lib/hooks/useNotifications';

// Per-source colour + icon + label so a glance tells you where each
// notification comes from. Every source gets a distinct hue (appointments
// use the deep-accent blue so they don't read the same as referrals).
const META: Record<NotificationItem['type'], { icon: typeof Bell; color: string; bg: string; label: string }> = {
  alert: { icon: AlertTriangle, color: 'var(--color-danger)', bg: 'rgba(196, 69, 54, 0.12)', label: 'Surveillance' },
  referral: { icon: ArrowRightLeft, color: 'var(--tb-blue-700)', bg: 'rgba(33, 145, 208, 0.12)', label: 'Referrals' },
  lab: { icon: FlaskConical, color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.10)', label: 'Lab' },
  appointment: { icon: Calendar, color: 'var(--tb-blue-800)', bg: 'rgba(1, 86, 151, 0.10)', label: 'Schedule' },
  intake: { icon: ClipboardCheck, color: 'var(--color-success)', bg: 'rgba(5, 150, 105, 0.10)', label: 'Intake' },
  prescription: { icon: Pill, color: 'var(--color-warning)', bg: 'rgba(217, 119, 6, 0.12)', label: 'Pharmacy' },
};

function relTime(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { items, loading } = useNotifications();
  // Sound-alert preference: 'sound' chimes when new notifications arrive,
  // 'muted' keeps the badge silent. Persisted per device.
  const [alertPref, setAlertPref] = useState(getNotificationAlertPref);
  const toggleAlertPref = () => {
    const next = alertPref === 'sound' ? 'muted' : 'sound';
    setAlertPref(next);
    setNotificationAlertPref(next);
  };

  return (
    <Modal onClose={onClose} width={520} align="top">
      <div className="card-elevated" style={{ background: 'var(--bg-card-solid)', borderRadius: 16, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
            {items.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>{items.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAlertPref}
              aria-label={alertPref === 'sound' ? 'Mute notification sounds' : 'Enable notification sounds'}
              title={alertPref === 'sound' ? 'Sound on — new notifications chime. Click to mute.' : 'Muted — click to chime on new notifications.'}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{
                background: alertPref === 'sound' ? 'var(--accent-light)' : 'var(--overlay-subtle)',
                color: alertPref === 'sound' ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              {alertPref === 'sound'
                ? <Bell className="w-4 h-4" style={{ stroke: 'currentColor' }} />
                : <BellOff className="w-4 h-4" style={{ stroke: 'currentColor' }} />}
              {alertPref === 'sound' ? 'Sound on' : 'Muted'}
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <Bell className="w-10 h-10 mx-auto mb-2" style={{ opacity: 0.35 }} />
              <p className="text-sm">You&apos;re all caught up — no notifications.</p>
            </div>
          ) : (
            <div>
              {items.map(n => {
                const m = META[n.type];
                const Icon = m.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => { onClose(); router.push(n.href); }}
                    className="w-full text-left flex items-start gap-3 px-5 py-3 border-b transition-colors hover:bg-[var(--overlay-subtle)]"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: m.bg, color: m.color }}>
                      {/* The icon set hardcodes a stroke attribute, so the colour
                          must be forced via the stroke property. */}
                      <Icon className="w-4 h-4" style={{ stroke: m.color, color: m.color }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
                      <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>{n.subtitle}</div>
                    </div>
                    <span className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{relTime(n.time)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
