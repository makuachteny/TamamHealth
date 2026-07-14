'use client';

/**
 * TelehealthVisitRoom — a Tebra-style provider video-visit experience.
 *
 * Flow: the provider enters the room → the patient waits in a virtual waiting
 * room and "knocks" → the provider admits them → the live visit runs with
 * mic / camera / screen-share / chat controls and picture-in-picture charting.
 *
 * There is no real signalling backend in this demo, so the remote (patient)
 * stream is simulated. The provider's own camera is real (getUserMedia,
 * best-effort) and Picture-in-Picture uses the browser PiP API so the call
 * keeps floating while the provider charts the note.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/context';
import { useTelehealth } from '@/lib/hooks/useTelehealth';
import { useToast } from '@/components/Toast';
import {
  Mic, MicOff, Video, MonitorSmartphone, MessageSquare,
  Users, PhoneOff, FileText, Send, LogIn, X, Signal,
} from '@/components/icons/lucide';

type Phase = 'entering' | 'waiting' | 'in_call' | 'ended';

type ChatMessage = { id: string; from: 'provider' | 'patient'; text: string; at: number };

export default function TelehealthVisitRoom({
  patientId,
  patientName,
  providerName,
  appointmentId,
  chiefComplaint,
  onLeave,
}: {
  patientId: string;
  patientName: string;
  providerName: string;
  appointmentId?: string;
  chiefComplaint?: string;
  onLeave: () => void;
}) {
  const { currentUser } = useApp();
  const { create, updateStatus } = useTelehealth();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<Phase>('entering');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const shareVideoRef = useRef<HTMLVideoElement | null>(null);

  // ── Create the telehealth session record when the provider enters ──────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) return;
      try {
        const now = new Date();
        const session = await create({
          appointmentId,
          patientId,
          patientName,
          providerId: currentUser._id,
          providerName,
          providerRole: currentUser.role,
          facilityId: currentUser.hospitalId || '',
          facilityName: currentUser.hospitalName || '',
          sessionType: 'video',
          scheduledDate: now.toISOString().slice(0, 10),
          scheduledTime: now.toTimeString().slice(0, 5),
          status: 'waiting_room',
          chiefComplaint: chiefComplaint || 'Telehealth visit',
          followUpRequired: false,
          referralRequired: false,
          patientConsentGiven: true,
          consentTimestamp: now.toISOString(),
          sessionRecorded: false,
          connectionDrops: 0,
        } as never);
        if (!cancelled && session?._id) sessionIdRef.current = session._id;
      } catch {
        // Non-fatal: the visit still runs even if the record can't be written.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Provider "enters" then the patient knocks a moment later ───────────────
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('waiting'), 900);
    const t2 = setTimeout(() => {
      setPhase(current => (current === 'waiting' ? current : current));
      setMessages(prev => [...prev, { id: `sys-${Date.now()}`, from: 'patient', text: `${patientName.split(' ')[0]} is knocking to join…`, at: Date.now() }]);
    }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [patientName]);

  // ── Call timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'in_call') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Camera control (best-effort getUserMedia) ──────────────────────────────
  const enableCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(tr => { tr.enabled = micOn; });
      if (selfVideoRef.current) {
        selfVideoRef.current.srcObject = stream;
        void selfVideoRef.current.play().catch(() => {});
      }
      setCamOn(true);
    } catch {
      showToast('Camera unavailable — continuing audio-only', 'error');
      setCamOn(false);
    }
  }, [micOn, showToast]);

  const disableCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(tr => tr.stop());
    if (localStreamRef.current) {
      const audio = localStreamRef.current.getAudioTracks();
      localStreamRef.current = audio.length ? new MediaStream(audio) : null;
    }
    if (selfVideoRef.current) selfVideoRef.current.srcObject = localStreamRef.current;
    setCamOn(false);
  }, []);

  const toggleCam = useCallback(() => { if (camOn) disableCamera(); else void enableCamera(); }, [camOn, disableCamera, enableCamera]);

  const toggleMic = useCallback(() => {
    setMicOn(on => {
      const next = !on;
      localStreamRef.current?.getAudioTracks().forEach(tr => { tr.enabled = next; });
      return next;
    });
  }, []);

  // ── Screen share (best-effort getDisplayMedia) ─────────────────────────────
  const toggleShare = useCallback(async () => {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach(tr => tr.stop());
      screenStreamRef.current = null;
      setSharing(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { setSharing(false); screenStreamRef.current = null; });
      if (shareVideoRef.current) {
        shareVideoRef.current.srcObject = stream;
        void shareVideoRef.current.play().catch(() => {});
      }
      setSharing(true);
    } catch {
      // user cancelled the picker — no-op
    }
  }, [sharing]);

  // ── Admit the patient from the waiting room ────────────────────────────────
  const admitPatient = useCallback(async () => {
    setPhase('in_call');
    setMessages(prev => [...prev, { id: `sys-${Date.now()}`, from: 'patient', text: `${patientName.split(' ')[0]} joined the visit.`, at: Date.now() }]);
    if (sessionIdRef.current) {
      try { await updateStatus(sessionIdRef.current, 'in_session', { actualStartTime: new Date().toISOString() }); } catch { /* non-fatal */ }
    }
    if (!camOn) void enableCamera();
  }, [camOn, enableCamera, patientName, updateStatus]);

  // ── Picture-in-Picture charting: float the call, open the note ─────────────
  const chartInPiP = useCallback(async () => {
    try {
      const v = selfVideoRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (v && (document as any).pictureInPictureEnabled && !(document as any).pictureInPictureElement) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (v as any).requestPictureInPicture();
      }
    } catch { /* PiP not available — fall through to opening the note */ }
    window.open(`/consultation?patientId=${encodeURIComponent(patientId)}`, '_blank');
  }, [patientId]);

  // ── End the visit ──────────────────────────────────────────────────────────
  const endVisit = useCallback(async () => {
    localStreamRef.current?.getTracks().forEach(tr => tr.stop());
    screenStreamRef.current?.getTracks().forEach(tr => tr.stop());
    if (sessionIdRef.current) {
      try {
        await updateStatus(sessionIdRef.current, 'completed', {
          actualEndTime: new Date().toISOString(),
          duration: Math.max(1, Math.round(elapsed / 60)),
        });
      } catch { /* non-fatal */ }
    }
    setPhase('ended');
    showToast('Telehealth visit ended', 'success');
    onLeave();
  }, [elapsed, onLeave, showToast, updateStatus]);

  // Cleanup any live tracks on unmount.
  useEffect(() => () => {
    localStreamRef.current?.getTracks().forEach(tr => tr.stop());
    screenStreamRef.current?.getTracks().forEach(tr => tr.stop());
  }, []);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setMessages(prev => [...prev, { id: `p-${Date.now()}`, from: 'provider', text, at: Date.now() }]);
    setDraft('');
  }, [draft]);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const patientInitials = patientName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="th-room">
      {/* Header */}
      <div className="th-room-head">
        <div className="th-room-head-left">
          <span className="th-live-dot" data-live={phase === 'in_call'} />
          <strong>{patientName}</strong>
          <span className="th-room-sub">{chiefComplaint || 'Telehealth visit'}</span>
        </div>
        <div className="th-room-head-right">
          {phase === 'in_call' && <span className="th-timer"><Signal className="w-3.5 h-3.5" color="currentColor" /> {mmss}</span>}
          <button type="button" className="th-icon-btn" aria-label="Close" onClick={endVisit}><X className="w-4 h-4" color="currentColor" /></button>
        </div>
      </div>

      {/* Stage */}
      <div className="th-stage">
        {/* Remote (patient) tile — simulated */}
        <div className="th-remote">
          {sharing ? (
            <video ref={shareVideoRef} className="th-share-video" muted playsInline />
          ) : phase === 'in_call' ? (
            <div className="th-remote-connected">
              <div className="th-avatar-lg">{patientInitials}</div>
              <p className="th-remote-name">{patientName}</p>
              <p className="th-remote-meta">Connected · camera on</p>
            </div>
          ) : (
            <div className="th-waiting">
              <LogIn className="w-10 h-10" color="currentColor" />
              <p className="th-waiting-title">Virtual waiting room</p>
              <p className="th-waiting-sub">
                {phase === 'entering' ? 'Connecting you to the visit…' : `${patientName} is waiting to be admitted.`}
              </p>
              {phase === 'waiting' && (
                <button type="button" className="th-admit-btn" onClick={admitPatient}>
                  <LogIn className="w-4 h-4" color="currentColor" /> Admit {patientName.split(' ')[0]}
                </button>
              )}
            </div>
          )}

          {/* Self view (provider) — picture-in-picture tile */}
          <div className="th-self">
            <video ref={selfVideoRef} className="th-self-video" muted playsInline data-on={camOn} />
            {!camOn && <div className="th-self-off"><Video className="w-4 h-4" color="currentColor" /> Camera off</div>}
            <span className="th-self-name">{providerName.split(' ').slice(-1)[0] || 'You'}</span>
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <aside className="th-chat">
            <div className="th-chat-head">Chat <button type="button" className="th-icon-btn" onClick={() => setChatOpen(false)}><X className="w-3.5 h-3.5" color="currentColor" /></button></div>
            <div className="th-chat-body">
              {messages.length === 0 && <p className="th-chat-empty">No messages yet.</p>}
              {messages.map(m => (
                <div key={m.id} className={`th-chat-msg ${m.from === 'provider' ? 'me' : ''}`}>
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            <div className="th-chat-input">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }} placeholder="Message the patient…" />
              <button type="button" className="th-icon-btn" onClick={sendMessage} aria-label="Send"><Send className="w-4 h-4" color="currentColor" /></button>
            </div>
          </aside>
        )}
      </div>

      {/* Controls */}
      <div className="th-controls">
        <button type="button" className={`th-ctrl ${micOn ? '' : 'off'}`} onClick={toggleMic} aria-label="Toggle microphone">
          {micOn ? <Mic className="w-5 h-5" color="currentColor" /> : <MicOff className="w-5 h-5" color="currentColor" />}<span>{micOn ? 'Mute' : 'Unmute'}</span>
        </button>
        <button type="button" className={`th-ctrl ${camOn ? '' : 'off'}`} onClick={toggleCam} aria-label="Toggle camera">
          <Video className="w-5 h-5" color="currentColor" /><span>{camOn ? 'Stop video' : 'Start video'}</span>
        </button>
        <button type="button" className={`th-ctrl ${sharing ? 'active' : ''}`} onClick={toggleShare} aria-label="Share screen">
          <MonitorSmartphone className="w-5 h-5" color="currentColor" /><span>{sharing ? 'Stop share' : 'Share'}</span>
        </button>
        <button type="button" className={`th-ctrl ${chatOpen ? 'active' : ''}`} onClick={() => setChatOpen(o => !o)} aria-label="Chat">
          <MessageSquare className="w-5 h-5" color="currentColor" /><span>Chat</span>
        </button>
        <button type="button" className="th-ctrl" onClick={chartInPiP} aria-label="Chart note">
          <FileText className="w-5 h-5" color="currentColor" /><span>Chart note</span>
        </button>
        <div className="th-ctrl th-ctrl-static" aria-hidden>
          <Users className="w-5 h-5" color="currentColor" /><span>{phase === 'in_call' ? '2' : '1'}</span>
        </div>
        <button type="button" className="th-ctrl leave" onClick={endVisit} aria-label="Leave visit">
          <PhoneOff className="w-5 h-5" color="currentColor" /><span>End visit</span>
        </button>
      </div>
    </div>
  );
}
