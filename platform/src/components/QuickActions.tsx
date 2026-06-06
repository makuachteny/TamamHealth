'use client';

/**
 * TopBar quick-actions cluster:
 *   [ + ]  — dropdown: Schedule appointment · Add availability
 *   [ 📣 ] — Announcements panel (compose + list)
 *   [ Messages ] — jump to the messaging inbox
 *
 * Shown globally in the TopBar. "Schedule appointment" deep-links to the
 * appointments page with ?new=1 so its booking form opens automatically.
 */
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, Clock, Megaphone, MessageSquare } from '@/components/icons/lucide';
import AvailabilityModal from '@/components/AvailabilityModal';
import AnnouncementsPanel from '@/components/AnnouncementsPanel';

export default function QuickActions() {
  const router = useRouter();
  const [plusOpen, setPlusOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [unread, setUnread] = useState(0);

  const plusRef = useRef<HTMLDivElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false);
      if (announceRef.current && !announceRef.current.contains(e.target as Node)) setAnnounceOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const iconBtn = 'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative';

  return (
    <div className="flex items-center gap-1.5">
      {/* + quick-create dropdown */}
      <div className="relative" ref={plusRef}>
        <button
          onClick={() => { setPlusOpen(o => !o); setAnnounceOpen(false); }}
          aria-label="Quick create"
          aria-expanded={plusOpen}
          className={iconBtn}
          style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', color: 'var(--accent-primary)' }}
        >
          <Plus className="w-5 h-5" />
        </button>
        {plusOpen && (
          <div
            className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50 py-1"
            style={{ width: 230, background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', boxShadow: '0 16px 48px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.06)' }}
          >
            <MenuItem icon={<Calendar className="w-4 h-4" />} label="Schedule appointment" onClick={() => { setPlusOpen(false); router.push('/appointments?new=1'); }} />
            <MenuItem icon={<Clock className="w-4 h-4" />} label="Add availability" onClick={() => { setPlusOpen(false); setShowAvailability(true); }} />
          </div>
        )}
      </div>

      {/* Announcements */}
      <div className="relative" ref={announceRef}>
        <button
          onClick={() => { setAnnounceOpen(o => !o); setPlusOpen(false); }}
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

      {/* Messages */}
      <button
        onClick={() => router.push('/messages')}
        className="btn btn-primary btn-sm hidden sm:inline-flex"
        style={{ gap: 6 }}
      >
        <MessageSquare className="w-4 h-4" /> Messages
      </button>
      <button
        onClick={() => router.push('/messages')}
        aria-label="Messages"
        className={`sm:hidden ${iconBtn}`}
        style={{ background: 'var(--accent-primary)', color: '#fff' }}
      >
        <MessageSquare className="w-[20px] h-[20px]" />
      </button>

      {showAvailability && <AvailabilityModal onClose={() => setShowAvailability(false)} />}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--overlay-subtle)]"
      style={{ color: 'var(--text-primary)' }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      {label}
    </button>
  );
}
