'use client';

/**
 * TelehealthVisitRoom — a Tebra-style provider video-visit experience.
 *
 * Flow: the provider enters the room → the patient waits in a virtual waiting
 * room and "knocks" → the provider admits them → the live visit runs with
 * mic / camera / screen-share / chat controls and picture-in-picture charting.
 *
 * Media is real: the room connects to LiveKit via `useLiveKitRoom`, which
 * mints a short-lived token from /api/telehealth/token after the server has
 * checked this clinician is the assigned provider for this session. Patient
 * presence, video, screen share and chat are all live — the waiting room
 * reflects an actual participant joining, not a timer.
 *
 * If the deployment has no LiveKit server configured the room says so plainly
 * rather than showing a call that will never connect.
 *
 * Picture-in-Picture uses the browser PiP API so the call keeps floating while
 * the provider charts the note.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/context';
import { useTelehealth } from '@/lib/hooks/useTelehealth';
import { useLiveKitRoom } from '@/lib/hooks/useLiveKitRoom';
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
  const { currentUser } = useAuth();
  const { sessions, create, updateStatus, recordConsent, reload: reloadSessions } = useTelehealth();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<Phase>('entering');
  // Consent is NOT assumed. The session record previously hardcoded
  // `patientConsentGiven: true` with a timestamp, which fabricated an
  // affirmative consent record for a patient who was never asked — worse than
  // recording nothing, because it looks like evidence of compliance.
  //
  // Until a patient-side capture exists (patient portal / mobile join), the
  // clinician attests to verbal consent explicitly and that attestation is
  // stored against their user id.
  const [consentAttested, setConsentAttested] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const [sessionId, setSessionId] = useState<string | null>(null);
  // Real media. Everything that used to be simulated — remote video, patient
  // presence, chat — now comes from here. Keyed on the session id, so it only
  // connects once the session record exists.
  const {
    status: mediaStatus,
    error: mediaError,
    remotePresent,
    connect: connectRoom,
    disconnect: disconnectRoom,
    attachRemoteVideo,
    attachLocalVideo,
    attachLocalScreenShare,
    localScreenShare,
    setMicEnabled,
    setCameraEnabled,
    setScreenShareEnabled,
    sendChat,
    chat: remoteChat,
  } = useLiveKitRoom(sessionId);
  const sessionIdRef = useRef<string | null>(null);

  // The live session document. `sessions` is backed by the PouchDB change
  // feed, so when the patient consents from the portal this updates without
  // the clinician reloading — which matters, because the consent they are
  // waiting for arrives from another device.
  const session = sessions.find(s => s._id === sessionId) || null;

  // What the record actually says about consent, in the clinician's terms.
  // Derived rather than stored: a second copy of consent state in component
  // state is exactly how a UI ends up disagreeing with the record it gates on.
  const consentState: {
    kind: 'none' | 'patient' | 'attested' | 'written' | 'withdrawn';
    label: string;
  } = (() => {
    if (!session) return { kind: 'none', label: 'Consent not yet recorded.' };
    if (session.consentWithdrawnAt && !session.patientConsentGiven) {
      return {
        kind: 'withdrawn',
        label: `${patientName.split(' ')[0]} withdrew consent at ${new Date(session.consentWithdrawnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      };
    }
    if (!session.patientConsentGiven) return { kind: 'none', label: 'Consent not yet recorded.' };
    const at = session.consentTimestamp
      ? new Date(session.consentTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;
    switch (session.consentMethod) {
      case 'patient_portal':
        return {
          kind: 'patient',
          label: `${patientName.split(' ')[0]} accepted consent${at ? ` at ${at}` : ''}` +
            `${session.consentPolicyVersion ? ` (policy ${session.consentPolicyVersion})` : ''}.`,
        };
      case 'provider_attested_verbal':
        return {
          kind: 'attested',
          label: `Verbal consent attested by ${session.consentAttestedByName || 'a clinician'}${at ? ` at ${at}` : ''}.`,
        };
      case 'written':
        return { kind: 'written', label: `Written consent on file${at ? `, recorded at ${at}` : ''}.` };
      default:
        // Consent flagged true with no method — historical documents only.
        // Reported as unknown provenance rather than dressed up as patient-given.
        return { kind: 'none', label: 'Consent recorded, but its basis is unknown.' };
    }
  })();

  // The patient has already consented themselves — no attestation needed, and
  // asking for one would invite a clinician to attest over a real record.
  const hasValidConsent = Boolean(session?.patientConsentGiven);
  // After an explicit withdrawal, a provider attestation must NOT be able to
  // override it. Attestation is a legitimate fallback for a patient who cannot
  // use the portal; it is not a way around a patient who said no.
  const canAttest = consentState.kind === 'none';
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);

  // ── Create the telehealth session record when the provider enters ──────────
  // Appointment-backed sessions converge on one document server-side: the id is
  // derived from the appointment, so a refresh, a remount, or a second
  // clinician all resolve to the SAME session and room (KAN-126). This ref only
  // guards the in-process double-invocation React StrictMode performs in dev —
  // without it a walk-in visit, which has no appointment to key on and is
  // deliberately exempt from the uniqueness rule, would mint two records.
  const sessionCreateStarted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) return;
      if (sessionCreateStarted.current) return;
      sessionCreateStarted.current = true;
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
          // Recorded as NOT consented at creation. It becomes true only when
          // the clinician explicitly attests (see recordConsentAttestation),
          // which also stamps the method and who attested.
          patientConsentGiven: false,
          sessionRecorded: false,
          connectionDrops: 0,
        } as never);
        if (!cancelled && session?._id) {
          sessionIdRef.current = session._id;
          setSessionId(session._id);
        }
      } catch {
        // Non-fatal: the visit still runs even if the record can't be written.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect to the room as soon as the session record exists ───────────────
  useEffect(() => {
    if (!sessionId || mediaStatus !== 'idle') return;
    void connectRoom();
  }, [sessionId, mediaStatus, connectRoom]);

  // ── Real patient presence ──────────────────────────────────────────────────
  // Previously a pair of setTimeouts pretended the patient "knocked" after 3.2s
  // whether or not anyone was there. This reflects an actual participant
  // joining the LiveKit room.
  useEffect(() => {
    if (mediaStatus === 'connected' && phase === 'entering') setPhase('waiting');
  }, [mediaStatus, phase]);

  useEffect(() => {
    if (!remotePresent || phase !== 'waiting') return;
    setMessages(prev => (
      prev.some(m => m.id === 'sys-knock')
        ? prev
        : [...prev, { id: 'sys-knock', from: 'patient', text: `${patientName.split(' ')[0]} has joined the waiting room.`, at: Date.now() }]
    ));
  }, [remotePresent, patientName, phase]);

  // If the patient drops mid-visit, say so instead of showing a frozen tile.
  useEffect(() => {
    if (phase === 'in_call' && !remotePresent) {
      setMessages(prev => [...prev, { id: `sys-drop-${Date.now()}`, from: 'patient', text: `${patientName.split(' ')[0]} disconnected — waiting for them to rejoin…`, at: Date.now() }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remotePresent]);

  // Merge chat arriving over the room's data channel into the transcript.
  useEffect(() => {
    if (remoteChat.length === 0) return;
    setMessages(prev => {
      const known = new Set(prev.map(m => m.id));
      const incoming = remoteChat
        .filter(c => !known.has(c.id))
        .map(c => ({ id: c.id, from: 'patient' as const, text: c.text, at: c.at }));
      return incoming.length ? [...prev, ...incoming] : prev;
    });
  }, [remoteChat]);

  // ── How long the patient has actually been waiting ─────────────────────────
  // Anchored to the server's `waitingSince`, so it survives this screen being
  // reopened and does not restart at zero when the clinician navigates back —
  // which would hide exactly the long waits worth seeing. `tick` only forces a
  // re-render; the value is always recomputed from the stored timestamp.
  // Computed in the effect, not during render — `Date.now()` in a render body
  // is impure and yields a different answer every time React re-runs it.
  const [waitingMinutes, setWaitingMinutes] = useState(0);
  useEffect(() => {
    const since = session?.waitingSince;
    if (phase !== 'waiting' || !since) return;
    const compute = () => setWaitingMinutes(
      Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 60_000)),
    );
    compute();
    const id = setInterval(compute, 30_000);
    return () => clearInterval(id);
  }, [phase, session?.waitingSince]);

  // ── Call timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'in_call') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Media controls ─────────────────────────────────────────────────────────
  // These publish to the room rather than opening a private local stream, so
  // the patient actually receives what the provider turns on. Previously the
  // camera and screen share existed only in the provider's own browser.
  const enableCamera = useCallback(async () => {
    try {
      await setCameraEnabled(true);
      setCamOn(true);
    } catch {
      showToast('Camera unavailable — continuing audio-only', 'error');
      setCamOn(false);
    }
  }, [setCameraEnabled, showToast]);

  const disableCamera = useCallback(() => {
    void setCameraEnabled(false).catch(() => {});
    setCamOn(false);
  }, [setCameraEnabled]);

  const toggleCam = useCallback(() => { if (camOn) disableCamera(); else void enableCamera(); }, [camOn, disableCamera, enableCamera]);

  const toggleMic = useCallback(() => {
    setMicOn(on => {
      const next = !on;
      void setMicEnabled(next).catch(() => {});
      return next;
    });
  }, [setMicEnabled]);

  const toggleShare = useCallback(async () => {
    try {
      await setScreenShareEnabled(!localScreenShare);
    } catch {
      // Cancelling the picker rejects with NotAllowedError. That is a normal
      // outcome, not a failure — no toast. State is not touched here at all:
      // `localScreenShare` follows the room's actual publication, so a
      // cancelled picker simply never flips it.
    }
  }, [localScreenShare, setScreenShareEnabled]);

  // ── Admit the patient from the waiting room ────────────────────────────────
  // Gated on consent. The clinician must attest they have asked the patient
  // before the visit starts; that attestation is written against their user id
  // rather than assumed at session creation.
  const admitPatient = useCallback(async () => {
    if (consentState.kind === 'withdrawn') {
      showToast('This patient withdrew consent. They must consent again before the visit can start.', 'error');
      return;
    }
    if (!hasValidConsent && !consentAttested) {
      showToast('Confirm the patient has consented to a telehealth visit before admitting them.', 'error');
      return;
    }

    if (sessionIdRef.current) {
      // Record the attestation BEFORE the status change, so a session can
      // never be `in_session` without a consent record behind it. Skipped
      // entirely when the patient already consented from the portal — a
      // clinician attestation layered over a real patient act would replace
      // first-party evidence with second-hand.
      if (!hasValidConsent) {
        try {
          await recordConsent(sessionIdRef.current, {
            method: 'provider_attested_verbal',
            attestedBy: currentUser?._id,
            attestedByName: currentUser?.name || currentUser?.username,
          });
        } catch {
          // Consent could not be written, so admission must not proceed —
          // the server would refuse it anyway, and starting the visit here
          // would put the UI ahead of the record.
          showToast('Could not record consent — the visit cannot start yet.', 'error');
          return;
        }
      }

      try {
        // Routed through the service so the admission is stamped with who let
        // the patient in and when, and audited — an admission nobody is
        // recorded as having made is the same gap the consent work closed.
        const { admitFromWaitingRoom } = await import('@/lib/services/telehealth-service');
        await admitFromWaitingRoom(sessionIdRef.current, {
          admittedBy: currentUser?._id || '',
          admittedByName: currentUser?.name || currentUser?.username,
        });
        await reloadSessions();
      } catch (err) {
        // The service refuses admission without consent. That refusal is the
        // point of the gate, so it is shown rather than swallowed — a generic
        // failure would just make the clinician press the button again.
        showToast(
          err instanceof Error && err.name === 'ConsentRequiredError'
            ? err.message
            : 'Could not start the visit. Please try again.',
          'error',
        );
        return;
      }
    }

    setPhase('in_call');
    setMessages(prev => [...prev, { id: `sys-${Date.now()}`, from: 'patient', text: `${patientName.split(' ')[0]} joined the visit.`, at: Date.now() }]);
    if (!camOn) void enableCamera();
  }, [camOn, consentAttested, consentState.kind, currentUser, enableCamera, hasValidConsent, patientName, recordConsent, reloadSessions, showToast]);

  // ── Turn the patient away ──────────────────────────────────────────────────
  // The other half of a real waiting room. Without it a clinician who cannot
  // take the visit has only "end visit", which leaves the patient watching a
  // spinner until a sweep job eventually closes the session — and records it
  // against them rather than explaining anything.
  const rejectPatient = useCallback(async () => {
    const reason = window.prompt(
      `Why can't ${patientName.split(' ')[0]} be seen now? This is shown to them.`,
      'The clinician is unavailable — please rebook or call the facility.',
    );
    // Cancelled the prompt, or cleared it: do nothing rather than turning the
    // patient away with an empty explanation.
    if (!reason?.trim()) return;

    if (!sessionIdRef.current) return;
    try {
      const { rejectFromWaitingRoom } = await import('@/lib/services/telehealth-service');
      await rejectFromWaitingRoom(sessionIdRef.current, {
        rejectedBy: currentUser?._id || '',
        rejectedByName: currentUser?.name || currentUser?.username,
        reason: reason.trim(),
      });
      await reloadSessions();
    } catch {
      showToast('Could not record that. Please try again.', 'error');
      return;
    }
    disconnectRoom();
    setPhase('ended');
    showToast(`${patientName.split(' ')[0]} was told the visit cannot go ahead.`, 'success');
    onLeave();
  }, [currentUser, disconnectRoom, onLeave, patientName, reloadSessions, showToast]);

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
    disconnectRoom();
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
  }, [disconnectRoom, elapsed, onLeave, showToast, updateStatus]);

  // The hook tears its own connection down on unmount, which stops every
  // published track — no separate stream bookkeeping to leak here.

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    // Publish to the room so the patient receives it. This was local component
    // state before — messages were never sent anywhere.
    void sendChat(text).catch(() => {
      showToast('Message could not be delivered', 'error');
    });
    setMessages(prev => [...prev, { id: `p-${Date.now()}`, from: 'provider', text, at: Date.now() }]);
    setDraft('');
  }, [draft, sendChat, showToast]);

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
        {/* Connection problems are stated plainly rather than left to look like
            a patient who simply hasn't joined. A room that appears live but
            isn't is the failure mode this whole change exists to remove. */}
        {(mediaStatus === 'unconfigured' || mediaStatus === 'error') && (
          <div className="th-media-banner" role="alert">
            <strong>
              {mediaStatus === 'unconfigured'
                ? 'Video is not configured on this deployment.'
                : 'Could not connect to the video service.'}
            </strong>
            {mediaError && <span>{mediaError}</span>}
            <span>The visit record is still being kept — continue by phone if needed.</span>
          </div>
        )}

        {/* Remote (patient) tile — live LiveKit track */}
        <div className="th-remote">
          {localScreenShare ? (
            /* The clinician's own share preview. This element previously had a
               ref that nothing ever attached a track to, so the provider saw a
               blank tile while sharing and could not tell what the patient was
               getting. */
            <video ref={attachLocalScreenShare} className="th-share-video" autoPlay muted playsInline />
          ) : phase === 'in_call' ? (
            <div className="th-remote-connected">
              {/* Real remote track. The avatar sits behind it and shows through
                  when the patient has no camera on — common on low bandwidth. */}
              <video
                ref={attachRemoteVideo}
                className="th-remote-video"
                data-on={remotePresent}
                autoPlay
                playsInline
              />
              <div className="th-avatar-lg">{patientInitials}</div>
              <p className="th-remote-name">{patientName}</p>
              <p className="th-remote-meta">
                {mediaStatus === 'reconnecting'
                  ? 'Reconnecting…'
                  : remotePresent ? 'Connected' : 'Waiting for patient to rejoin…'}
              </p>
            </div>
          ) : (
            <div className="th-waiting">
              <LogIn className="w-10 h-10" color="currentColor" />
              <p className="th-waiting-title">Virtual waiting room</p>
              <p className="th-waiting-sub">
                {phase === 'entering'
                  ? 'Connecting you to the visit…'
                  : session?.waitingSince
                    // Measured from the patient's recorded arrival, not from
                    // when this screen opened — the clinician needs to know
                    // how long the patient has actually been kept waiting.
                    ? `${patientName} has been waiting ${waitingMinutes} min.`
                    : `Waiting for ${patientName.split(' ')[0]} to arrive…`}
              </p>
              {phase === 'waiting' && (
                <>
                  {/* Consent state and its basis, always stated. The clinician
                      should never have to guess whether the box they are about
                      to tick is duplicating a record the patient already made. */}
                  <p className="th-consent-state" data-kind={consentState.kind}>
                    {consentState.label}
                  </p>

                  {/* The attestation path remains available for a patient who
                      cannot use the portal — a legitimate fallback. It is
                      hidden once real consent exists, and after a withdrawal,
                      so it cannot be used to overwrite either. */}
                  {canAttest && (
                    <>
                      <label className="th-consent">
                        <input
                          type="checkbox"
                          checked={consentAttested}
                          onChange={e => setConsentAttested(e.target.checked)}
                          aria-describedby="th-consent-help"
                        />
                        <span>
                          I have explained this is a telehealth visit and{' '}
                          <strong>{patientName.split(' ')[0]} has given verbal consent</strong>.
                        </span>
                      </label>
                      <p id="th-consent-help" className="th-consent-help">
                        Recorded as verbal consent attested by {currentUser?.name || currentUser?.username || 'you'}.
                      </p>
                    </>
                  )}

                  {consentState.kind === 'withdrawn' && (
                    <p className="th-consent-help">
                      You cannot attest consent on their behalf after a withdrawal.
                      Ask them to consent again from their portal, or arrange an
                      in-person appointment.
                    </p>
                  )}

                  <div className="th-waiting-actions">
                    <button
                      type="button"
                      className="th-admit-btn"
                      onClick={admitPatient}
                      disabled={!hasValidConsent && !consentAttested}
                      aria-disabled={!hasValidConsent && !consentAttested}
                    >
                      <LogIn className="w-4 h-4" color="currentColor" /> Admit {patientName.split(' ')[0]}
                    </button>
                    <button
                      type="button"
                      className="th-reject-btn"
                      onClick={rejectPatient}
                    >
                      Can&apos;t see them now
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Self view (provider) — picture-in-picture tile */}
          <div className="th-self">
            <video
              ref={(el) => { selfVideoRef.current = el; attachLocalVideo(el); }}
              className="th-self-video"
              muted
              playsInline
              data-on={camOn}
            />
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
        <button type="button" className={`th-ctrl ${localScreenShare ? 'active' : ''}`} onClick={toggleShare} aria-label="Share screen">
          <MonitorSmartphone className="w-5 h-5" color="currentColor" /><span>{localScreenShare ? 'Stop share' : 'Share'}</span>
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
