'use client';

/**
 * TopBar quick-actions cluster:
 *   [ 📣 ] — Announcements panel (compose + list); doubles as the notification
 *            centre, with an unread badge. Direct messaging lives in the sidebar.
 *
 * Shown globally in the TopBar. Scheduling/availability now lives in the
 * sidebar "Schedule" tab rather than a header quick-create menu.
 */
import { useState, useRef, useEffect } from 'react';
import { Megaphone, Bell } from '@/components/icons/lucide';
import AnnouncementsPanel from '@/components/AnnouncementsPanel';
import NotificationsPanel from '@/components/NotificationsPanel';
import { useNotifications } from '@/lib/hooks/useNotifications';

export default function QuickActions() {
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { count: notifCount } = useNotifications();

  const announceRef = useRef<HTMLDivElement>(null);

  // Close the panel on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (announceRef.current && !announceRef.current.contains(e.target as Node)) setAnnounceOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const iconBtn = 'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative';

  return (
    <div className="flex items-center gap-1.5">
      {/* Notifications */}
      <button
        onClick={() => setNotifOpen(true)}
        aria-label={notifCount > 0 ? `Notifications (${notifCount} unread)` : 'Notifications'}
        title="Notifications"
        className={iconBtn}
        style={{ background: 'transparent' }}
      >
        <Bell className="w-[22px] h-[22px]" />
        {notifCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: 'var(--color-danger, #C44536)' }}>
            {notifCount > 9 ? '9+' : notifCount}
          </span>
        )}
      </button>
      {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}

      {/* Announcements */}
      <div className="relative" ref={announceRef}>
        <button
          onClick={() => setAnnounceOpen(o => !o)}
          aria-label="Announcements"
          aria-expanded={announceOpen}
          title="Announcements"
          className={iconBtn}
          style={{ background: 'transparent' }}
        >
          <Megaphone className="w-[22px] h-[22px]" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full" aria-hidden="true" style={{ background: 'var(--accent-primary)', boxShadow: '0 0 4px var(--accent-light)' }} />
          )}
        </button>
        {announceOpen && (
          <AnnouncementsPanel onClose={() => setAnnounceOpen(false)} onUnreadChange={setUnread} />
        )}
      </div>
    </div>
  );
}
