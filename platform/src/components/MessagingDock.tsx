'use client';

// Floating staff-messaging dock — a Messenger/Intercom-style launcher that lives
// bottom-right on every dashboard screen so staff can read and reply to internal
// chat WITHOUT navigating away from their current task. It reuses the same
// `useStaffChat` data layer (and styling tokens) as the full /messages page, so
// the two stay in sync; the full page remains for power features (groups,
// reactions, presence, member management).

import { useState, useMemo, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useStaffChat } from '@/lib/hooks/useStaffChat';
import { useUsers } from '@/lib/hooks/useUsers';
import { useMessagingDock } from '@/lib/messaging-dock-context';
import { getRoleConfig } from '@/lib/permissions';
import { ROLE_LABEL } from '@/lib/role-display';
import { BRAND_PRIMARY, BRAND_SECONDARY } from '@/lib/theme-colors';
import type { ConversationDoc, UserRole } from '@/lib/db-types';
import {
  MessageSquare, Minus, Plus, Search, Send, ArrowLeft, Users as UsersIcon,
  Paperclip, X, AlertTriangle,
} from '@/components/icons/lucide';

type Attachment = { name: string; mimeType: string; base64Data: string; sizeBytes: number };

const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Available',
  busy: 'Busy',
  in_procedure: 'In Procedure',
  in_emergency: 'In Emergency',
  in_theatre: 'In Theatre',
  on_rounds: 'On Rounds',
  away: 'Away',
};
const AVAILABILITY_COLORS: Record<string, string> = {
  available:    'var(--color-success-600)',
  busy:         'var(--color-warning-600)',
  in_procedure: 'var(--accent-primary)',
  in_emergency: '#DC2626',
  in_theatre:   '#0E7490',
  on_rounds:    '#0369A1',
  away:         'var(--text-muted)',
};

const AVATAR_PALETTE = ['var(--accent-primary)', BRAND_SECONDARY, '#0EA5E9', '#0891B2', '#1D4ED8', '#0369A1', '#1E40AF', '#475569'];
const NON_MESSAGEABLE_ROLES: UserRole[] = ['super_admin', 'government'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}
function relTime(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}
function clockTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function Avatar({ name, size = 36, group }: { name: string; size?: number; group?: boolean }) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 font-bold text-white"
      style={{ width: size, height: size, borderRadius: '50%', background: group ? 'var(--accent-primary)' : colorFor(name), fontSize: size * 0.36 }}
    >
      {group ? <UsersIcon style={{ width: size * 0.5, height: size * 0.5 }} /> : initials(name)}
    </div>
  );
}

export default function MessagingDock() {
  const pathname = usePathname();
  const chat = useStaffChat();
  const { users } = useUsers();
  const {
    currentUser, conversations, messages, activeId, setActiveId,
    activeConversation, send, startDM,
  } = chat;

  const { open, openDock, closeDock, pendingDM, clearPendingDM } = useMessagingDock();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [convSearch, setConvSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [phiWarning, setPhiWarning] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [availability, setAvailability] = useState<string>('available');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Conversations the user has opened in this session — used to clear the unread
  // dot locally as soon as they're read (the conversation doc has no per-user
  // read cursor, so this mirrors the read action client-side).
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const threadRef = useRef<HTMLDivElement>(null);

  const meId = currentUser?._id || '';
  const meName = currentUser?.name || '';

  const roleLabelFor = (id: string) => {
    const u = users.find(x => x._id === id);
    return u ? (ROLE_LABEL[u.role] || '') : '';
  };

  const convTitle = (c: ConversationDoc): string => {
    if (c.kind === 'group') return c.name || 'Group chat';
    const i = c.participantIds.findIndex(id => id !== meId);
    return c.participantNames?.[i] || c.participantNames?.[0] || 'Direct message';
  };

  const isUnread = (c: ConversationDoc) =>
    !!c.lastMessageFromName && c.lastMessageFromName !== meName && c._id !== activeId && !seen.has(c._id);

  const filteredConvs = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    const list = q
      ? conversations.filter(c => convTitle(c).toLowerCase().includes(q) || (c.lastMessagePreview || '').toLowerCase().includes(q))
      : conversations;
    return [...list].sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, convSearch, meId]);

  const unreadCount = useMemo(() => conversations.filter(isUnread).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, activeId, seen, meName]);

  const messageableStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return users
      .filter(u => u.type === 'user' && u._id !== meId && !NON_MESSAGEABLE_ROLES.includes(u.role))
      .filter(u => !q || u.name.toLowerCase().includes(q) || (ROLE_LABEL[u.role] || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, meId, staffSearch]);

  // Auto-scroll the thread to the newest message.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeId, open]);

  // Mark a conversation seen locally when opened.
  useEffect(() => {
    if (activeId) setSeen(prev => (prev.has(activeId) ? prev : new Set(prev).add(activeId)));
  }, [activeId]);

  // A caller requested a DM with a specific person (e.g. a "Message" button on a
  // staff profile) — open that thread, then clear the request.
  useEffect(() => {
    if (!open || !pendingDM) return;
    (async () => { await startDM({ id: pendingDM.id, name: pendingDM.name }); setView('list'); clearPendingDM(); })();
  }, [open, pendingDM, startDM, clearPendingDM]);

  // The full /messages page already provides the whole experience — don't stack
  // the dock on top of it. Require an authenticated staff user whose role has
  // messaging access (same gating as the /messages route).
  const canMessage = !!currentUser && !!getRoleConfig(currentUser.role)?.allowedRoutes?.includes('/messages');
  if (!canMessage || pathname === '/messages') return null;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body && attachments.length === 0) return;
    if (attachments.length > 0 && !phiWarning) {
      setPhiWarning(true);
      return;
    }
    setDraft('');
    setAttachments([]);
    setPhiWarning(false);
    await send(body, undefined, attachments.length > 0 ? attachments : undefined, attachments.length > 0);
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
      if (file.size > 5 * 1024 * 1024) return; // 5MB max
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const base64Data = dataUrl.split(',')[1] || '';
        setAttachments(prev => [...prev, { name: file.name, mimeType: file.type, base64Data, sizeBytes: file.size }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openConversation = (id: string) => { setActiveId(id); setView('list'); };

  // ─────────────────────────── Collapsed launcher ───────────────────────────
  if (!open) {
    return (
      <button
        onClick={openDock}
        aria-label="Open messages"
        className="fixed z-[60] flex items-center justify-center rounded-full text-white shadow-lg transition-transform"
        style={{ right: 20, bottom: 20, width: 56, height: 56, background: 'var(--accent-primary)', boxShadow: 'var(--card-shadow-lg)' }}
      >
        <MessageSquare className="w-6 h-6" color="#FFFFFF" />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center text-[10px] font-bold text-white rounded-full"
            style={{ top: -2, right: -2, minWidth: 20, height: 20, padding: '0 5px', background: 'var(--color-danger)', border: '2px solid var(--bg-card-solid)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  const inThread = !!activeConversation && view === 'list';

  // ─────────────────────────── Expanded panel ───────────────────────────
  return (
    <div
      className="fixed z-[60] flex flex-col overflow-hidden"
      style={{
        right: 20, bottom: 20, width: 372, height: 540, maxHeight: 'calc(100vh - 40px)', maxWidth: 'calc(100vw - 40px)',
        borderRadius: 'var(--card-radius)', border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg-strong)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: 'var(--panel-shadow), var(--glass-highlight)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        {inThread ? (
          <>
            <button onClick={() => setActiveId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-[var(--overlay-subtle)]" style={{ color: 'var(--text-muted)' }} aria-label="Back">
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
            <Avatar name={convTitle(activeConversation!)} size={30} group={activeConversation!.kind === 'group'} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{convTitle(activeConversation!)}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {activeConversation!.kind === 'group' ? `${activeConversation!.participantIds.length} members` : roleLabelFor(activeConversation!.participantIds.find(id => id !== meId) || '')}
              </p>
            </div>
          </>
        ) : view === 'new' ? (
          <>
            <button onClick={() => { setView('list'); setStaffSearch(''); }} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-[var(--overlay-subtle)]" style={{ color: 'var(--text-muted)' }} aria-label="Back">
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
            <h2 className="text-[14px] font-bold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>New message</h2>
          </>
        ) : (
          <>
            <MessageSquare className="w-[18px] h-[18px] flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <h2 className="text-[14px] font-bold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>Messages</h2>
            {/* Availability status dot + picker */}
            <div className="relative">
              <button
                onClick={() => setShowAvailability(v => !v)}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-[var(--overlay-subtle)]"
                title={`Status: ${AVAILABILITY_LABELS[availability]}`}
              >
                <span className="w-3 h-3 rounded-full" style={{ background: AVAILABILITY_COLORS[availability] || 'var(--color-success-600)' }} />
              </button>
              {showAvailability && (
                <div className="absolute right-0 top-full mt-1 z-50 py-1 rounded-xl shadow-xl min-w-[160px]" style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-light)' }}>
                  {Object.entries(AVAILABILITY_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setAvailability(key); setShowAvailability(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--overlay-subtle)]"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: AVAILABILITY_COLORS[key] }} />
                      <span className="text-[12px]" style={{ color: availability === key ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: availability === key ? 600 : 400 }}>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { setView('new'); }} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }} aria-label="New message" title="New message">
              <Plus className="w-4 h-4" />
            </button>
          </>
        )}
        <button onClick={closeDock} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-[var(--overlay-subtle)]" style={{ color: 'var(--text-muted)' }} aria-label="Minimize" title="Minimize">
          <Minus className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Body */}
      {inThread ? (
        // ── Thread ──
        <>
          <div ref={threadRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ minHeight: 0, background: 'var(--bg-app)' }}>
            {messages.length === 0 ? (
              <p className="text-center text-[12px] py-8" style={{ color: 'var(--text-muted)' }}>No messages yet. Say hello 👋</p>
            ) : messages.map(m => {
              const mine = m.fromDoctorId === meId;
              if (m.deleted) {
                return (
                  <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[11px] italic px-3 py-1.5 rounded-2xl" style={{ color: 'var(--text-muted)', background: 'var(--bg-card-solid)', border: '1px solid var(--border-light)' }}>This message was deleted</span>
                  </div>
                );
              }
              return (
                <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[78%]">
                    {!mine && activeConversation!.kind === 'group' && (
                      <p className="text-[10px] font-semibold mb-0.5 ml-1" style={{ color: 'var(--text-muted)' }}>{m.fromDoctorName}</p>
                    )}
                    <div
                      className="px-3 py-2 text-[13px] leading-snug"
                      style={{
                        borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: mine ? 'var(--accent-primary)' : 'var(--bg-card-solid)',
                        color: mine ? '#fff' : 'var(--text-primary)',
                        border: mine ? 'none' : '1px solid var(--border-light)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.body}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {m.attachments.map((att, ai) => {
                            const isImage = att.mimeType.startsWith('image/');
                            return (
                              <div key={ai}>
                                {isImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={`data:${att.mimeType};base64,${att.base64Data}`} alt={att.name} className="max-w-full rounded-lg" style={{ maxHeight: 160, objectFit: 'cover' }} />
                                ) : (
                                  <a
                                    href={`data:${att.mimeType};base64,${att.base64Data}`}
                                    download={att.name}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                                    style={{ background: mine ? 'rgba(255,255,255,0.15)' : 'var(--overlay-subtle)', color: mine ? '#fff' : 'var(--text-secondary)' }}
                                  >
                                    <Paperclip className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{att.name}</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                          {m.phiAcknowledged && (
                            <p className="text-[10px] italic" style={{ color: mine ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>PHI — confidential</p>
                          )}
                        </div>
                      )}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${mine ? 'text-right mr-1' : 'ml-1'}`} style={{ color: 'var(--text-muted)' }}>
                      {clockTime(m.sentAt || m.createdAt)}{m.editedAt ? ' · edited' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Composer */}
          <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--glass-border)' }}>
            {/* PHI Warning */}
            {phiWarning && (
              <div className="mx-2.5 mt-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)' }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning-600)' }} />
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    This message may contain patient-identifiable information (PHI). Only share with authorized staff. Do you confirm?
                  </p>
                </div>
                <div className="flex gap-2 mt-2 justify-end">
                  <button onClick={() => setPhiWarning(false)} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: 'var(--overlay-subtle)', color: 'var(--text-muted)' }}>Cancel</button>
                  <button
                    onClick={async () => {
                      const body = draft.trim();
                      setDraft('');
                      setAttachments([]);
                      setPhiWarning(false);
                      await send(body, undefined, attachments.length > 0 ? attachments : undefined, true);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg font-semibold text-white"
                    style={{ background: 'var(--color-warning)' }}
                  >
                    Confirm &amp; Send
                  </button>
                </div>
              </div>
            )}
            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-2.5 pt-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                    <Paperclip className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="truncate max-w-[80px]" style={{ color: 'var(--text-secondary)' }}>{att.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="flex-shrink-0" style={{ color: 'var(--color-danger)' }}><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 p-2.5">
              {/* File attach button */}
              <label className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-[var(--overlay-subtle)]" title="Attach file (PDF, JPG, PNG · 5 MB max)" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                <Paperclip className="w-4 h-4" />
                <input ref={fileInputRef} type="file" className="sr-only" accept=".pdf,image/jpeg,image/png,image/webp" multiple onChange={handleFileAttach} />
              </label>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message…"
                rows={1}
                className="flex-1 resize-none text-[13px] px-3 py-2 rounded-2xl"
                style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: "var(--font-platform)", maxHeight: 96, outline: 'none' }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() && attachments.length === 0}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-opacity disabled:opacity-40"
                style={{ background: 'var(--accent-primary)' }}
                aria-label="Send"
              >
                <Send className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </>
      ) : view === 'new' ? (
        // ── New-message staff picker ──
        <>
          <div className="px-3 pt-2.5 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                placeholder="Search staff…"
                className="w-full text-[13px] pl-9 pr-3 py-2 rounded-xl"
                style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: "var(--font-platform)", outline: 'none' }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ minHeight: 0 }}>
            {messageableStaff.length === 0 ? (
              <p className="text-center text-[12px] py-8" style={{ color: 'var(--text-muted)' }}>No staff found</p>
            ) : messageableStaff.map(u => (
              <button
                key={u._id}
                onClick={async () => { await startDM({ id: u._id, name: u.name }); setView('list'); setStaffSearch(''); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors hover:bg-[var(--overlay-subtle)] text-left"
              >
                <Avatar name={u.name} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{ROLE_LABEL[u.role] || ''}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        // ── Conversation list ──
        <>
          <div className="px-3 pt-2.5 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full text-[13px] pl-9 pr-3 py-2 rounded-xl"
                style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: "var(--font-platform)", outline: 'none' }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ minHeight: 0 }}>
            {filteredConvs.length === 0 ? (
              <div className="text-center px-4 py-10">
                <p className="text-[12px] mb-2" style={{ color: 'var(--text-muted)' }}>No conversations yet.</p>
                <button onClick={() => setView('new')} className="text-[12px] font-semibold" style={{ color: 'var(--accent-primary)' }}>Start a new message</button>
              </div>
            ) : filteredConvs.map(c => {
              const unread = isUnread(c);
              return (
                <button
                  key={c._id}
                  onClick={() => openConversation(c._id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors hover:bg-[var(--overlay-subtle)] text-left"
                >
                  <Avatar name={convTitle(c)} size={38} group={c.kind === 'group'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{convTitle(c)}</span>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{relTime(c.lastMessageAt)}</span>
                    </div>
                    <p className="text-[12px] truncate mt-0.5" style={{ color: unread ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: unread ? 600 : 400 }}>
                      {c.lastMessagePreview || 'No messages yet'}
                    </p>
                  </div>
                  {unread && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-danger)' }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
