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
import { Megaphone, Bell, Calendar } from '@/components/icons/lucide';
import AnnouncementsPanel from '@/components/AnnouncementsPanel';
import NotificationsPanel from '@/components/NotificationsPanel';
import TasksPanel from '@/components/TasksPanel';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { useTasks } from '@/lib/hooks/useTasks';

export default function QuickActions() {
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { count: notifCount } = useNotifications();
  const { open: openTasks } = useTasks();

  const announceRef = useRef<HTMLDivElement>(null);

  // Close the panel on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (announceRef.current && !announceRef.current.contains(e.target as Node)) setAnnounceOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const iconBtn = 'w-10 h-10 rounded-full flex items-center justify-center transition-colors relative flex-shrink-0';
  const iconBtnStyle = {
    background: 'transparent',
    border: '1.5px solid var(--border-medium)',
  };

  return (
    <div className="flex items-center gap-2">
      {/* My Tasks */}
      <button
        onClick={() => setTasksOpen(true)}
        aria-label={openTasks.length > 0 ? `My tasks (${openTasks.length} open)` : 'My tasks'}
        title="My tasks"
        className={iconBtn}
        style={iconBtnStyle}
      >
        <Calendar className="w-[20px] h-[20px]" color="var(--text-primary)" />
        {openTasks.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--accent-primary)' }}>
            {openTasks.length > 99 ? '99+' : openTasks.length}
          </span>
        )}
      </button>
      {tasksOpen && <TasksPanel onClose={() => setTasksOpen(false)} />}

      {/* Notifications */}
      <button
        onClick={() => setNotifOpen(true)}
        aria-label={notifCount > 0 ? `Notifications (${notifCount} unread)` : 'Notifications'}
        title="Notifications"
        className={iconBtn}
        style={iconBtnStyle}
      >
        <Bell className="w-[20px] h-[20px]" color="var(--text-primary)" />
        {notifCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#E05A3A' }}>
            {notifCount > 99 ? '99+' : `${notifCount}+`}
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
          style={iconBtnStyle}
        >
          <Megaphone className="w-[20px] h-[20px]" color="var(--text-primary)" />
          {unread > 0 && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white" aria-hidden="true" style={{ background: '#E05A3A' }} />
          )}
        </button>
        {announceOpen && (
          <AnnouncementsPanel onClose={() => setAnnounceOpen(false)} onUnreadChange={setUnread} />
        )}
      </div>
    </div>
  );
}
