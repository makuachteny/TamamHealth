'use client';

/**
 * Patient-facing telehealth join screen.
 *
 * This is the surface the `joinUrl` on a session points at, and it is what
 * makes consent first-party. Until it existed, the only consent record a visit
 * could carry was the clinician's attestation that they had asked — honest,
 * but still the clinician speaking. Here the patient affirms it themselves and
 * the record is stamped `patient_portal`.
 *
 * Flow: summary → consent → device check → in visit. Each step is a gate, and
 * the order is deliberate — a patient decides whether to consent knowing who
 * they are about to see, and nothing touches the camera until after they have.
 *
 * Deliberate choices:
 *
 *  - It lives OUTSIDE `(dashboard)`. A patient must never be routed through
 *    the staff shell, which assumes a staff session and renders clinical
 *    navigation.
 *
 *  - The URL carries only a session id, never a token (see lib/telehealth-room.ts).
 *    So this page requires a patient-portal sign-in and hands that JWT to
 *    `/api/telehealth/token`, which re-checks that this patient belongs to
 *    this visit before minting media credentials.
 *
 *  - Consent is recorded BEFORE any media connects. A patient who declines
 *    never publishes camera or microphone at all, rather than joining and
 *    being asked afterwards.
 *
 *  - Every gate this page applies is also applied server-side. The join window
 *    shown here is advisory; /api/telehealth/token enforces it. A page that is
 *    the only thing standing between a patient and a consultation is not a
 *    control.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLiveKitRoom } from '@/lib/hooks/useLiveKitRoom';
import {
  runDeviceCheck,
  stopStream,
  type DeviceCheckResult,
} from '@/lib/telehealth-device-check';

const PATIENT_PORTAL_SESSION_KEY = 'tamamhealth-patient-portal-session';

type Phase =
  | 'checking'
  | 'signed_out'
  | 'unavailable'
  | 'summary'
  | 'consent'
  | 'devices'
  // 'joining' falls through to the live view, which renders its own
  // connecting / reconnecting / failed states from `mediaStatus`.
  | 'joining'
  | 'left';

interface VisitSummary {
  sessionId: string;
  status: string;
  sessionType: string;
  providerName: string;
  providerRole: string;
  facilityName: string;
  scheduledDate: string;
  scheduledTime: string;
  chiefComplaint: string;
  consentGiven: boolean;
  consentMethod?: string;
  consentWithdrawnAt?: string;
  consentPolicy: { version: string; text: string[] };
  waitingSince?: string;
  admittedAt?: string;
  admittedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  joinWindow: {
    open: boolean;
    reason: 'open' | 'too_early' | 'too_late' | 'unscheduled';
    message: string;
    opensAt: string | null;
    closesAt: string | null;
  };
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PATIENT_PORTAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token || null;
  } catch {
    return null;
  }
}

export default function PatientTelehealthJoinPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? null;

  const [phase, setPhase] = useState<Phase>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [visit, setVisit] = useState<VisitSummary | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Device check
  const [check, setCheck] = useState<DeviceCheckResult | null>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewElRef = useRef<HTMLVideoElement | null>(null);

  // Media only starts once consent is recorded and devices are confirmed — the
  // hook is given a session id only at that point, so nothing can connect
  // beforehand.
  const [armedSessionId, setArmedSessionId] = useState<string | null>(null);
  const {
    status: mediaStatus,
    error: mediaError,
    publishError,
    remotePresent,
    connect,
    disconnect,
    attachRemoteVideo,
    attachRemoteScreenShare,
    attachLocalVideo,
    remoteScreenShare,
    setMicEnabled,
    setCameraEnabled,
  } = useLiveKitRoom(armedSessionId, token, {
    // Nothing is published until the clinician admits them (KAN-128). The
    // patient joins the room so their PRESENCE signals arrival, but a waiting
    // room that streams your camera and microphone to a clinician still with
    // the previous patient is not a waiting room. Media starts at admission.
    publishOnConnect: undefined,
  });

  // Control state reflects what we asked LiveKit to publish. Seeded at join
  // time from the audio-only choice rather than mirrored from it by an effect,
  // because after joining the patient may toggle the camera freely and the
  // pre-visit choice must stop overriding them.
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);

  // ── Load the visit ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = readToken();
    setToken(t);
    if (!t) { setPhase('signed_out'); return; }
    if (!sessionId) { setPhase('unavailable'); setError('This link is missing a visit reference.'); return; }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/telehealth/visit/${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || 'We could not open this visit.');
          setPhase(res.status === 401 ? 'signed_out' : 'unavailable');
          return;
        }
        setVisit(body as VisitSummary);
        setPhase('summary');
      } catch {
        if (!cancelled) {
          setError('We could not reach the clinic. Check your connection and try again.');
          setPhase('unavailable');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ── Connect once armed ────────────────────────────────────────────────────
  useEffect(() => {
    if (!armedSessionId || mediaStatus !== 'idle') return;
    void connect();
  }, [armedSessionId, mediaStatus, connect]);

  // No effect mirrors `mediaStatus` into `phase`: once the room is armed the
  // live view IS the view, and it renders the connecting / reconnecting /
  // failed states itself. Copying connection state into a second variable
  // would just create two sources of truth that can disagree.

  // ── Poll the server for the clinician's decision ──────────────────────────
  // The patient's status must reflect the SERVER, never this page's own guess.
  // Polling rather than a data-channel message because a message sent while
  // the patient is reconnecting is simply lost, and they would wait forever
  // for an admission that already happened. Ten seconds is slow enough to be
  // cheap on a metered link and fast enough that nobody notices.
  useEffect(() => {
    if (!armedSessionId || !token) return;
    if (visit?.admittedAt || visit?.rejectedAt) return; // decided — stop polling

    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/telehealth/visit/${encodeURIComponent(armedSessionId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const next = await res.json() as VisitSummary;
        if (!cancelled) setVisit(next);
      } catch {
        // A failed poll is not worth surfacing — the next one is 10s away and
        // the connection banner already covers a genuinely dead link.
      }
    }, 10_000);

    return () => { cancelled = true; clearInterval(id); };
  }, [armedSessionId, token, visit?.admittedAt, visit?.rejectedAt]);

  // Admission is what starts the patient's camera and microphone.
  const admitted = Boolean(visit?.admittedAt);

  // Wait time comes from the server's arrival stamp, so a reload does not
  // reset it to zero and understate exactly the longest waits.
  //
  // Computed in the effect rather than during render: `Date.now()` in a render
  // body is impure, and a component that reads the clock while rendering gives
  // a different answer every time React chooses to re-run it.
  const [waitingMinutes, setWaitingMinutes] = useState(0);
  useEffect(() => {
    const since = visit?.waitingSince;
    if (!since || admitted) return;
    const compute = () => setWaitingMinutes(
      Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 60_000)),
    );
    compute();
    const id = setInterval(compute, 30_000);
    return () => clearInterval(id);
  }, [visit?.waitingSince, admitted]);
  const publishedRef = useRef(false);
  useEffect(() => {
    if (!admitted || mediaStatus !== 'connected' || publishedRef.current) return;
    publishedRef.current = true;
    void setMicEnabled(true).catch(() => {});
    if (!audioOnly) void setCameraEnabled(true).catch(() => {});
  }, [admitted, audioOnly, mediaStatus, setCameraEnabled, setMicEnabled]);

  // Release the preview stream on unmount — otherwise the camera light stays
  // on after the patient navigates away.
  useEffect(() => () => { stopStream(previewStreamRef.current); }, []);

  // ── Device check ──────────────────────────────────────────────────────────
  const testDevices = useCallback(async (wantVideo: boolean) => {
    setBusy(true);
    stopStream(previewStreamRef.current);
    previewStreamRef.current = null;
    const result = await runDeviceCheck({ video: wantVideo });
    previewStreamRef.current = result.stream;
    if (result.stream && previewElRef.current) {
      previewElRef.current.srcObject = result.stream;
    }
    setCheck(result);
    setBusy(false);
  }, []);

  // Entering the device step runs the check immediately, so the patient sees
  // themselves rather than a button asking them to prove their camera works.
  // Driven from the transition rather than an effect on `phase` — the check
  // opens the camera, which is a side effect of the patient advancing, not of
  // the component rendering.
  const goToDevices = useCallback(() => {
    setPhase('devices');
    void testDevices(!audioOnly);
  }, [audioOnly, testDevices]);

  // ── Consent ───────────────────────────────────────────────────────────────
  const giveConsent = useCallback(async () => {
    if (!sessionId || !token || !consentChecked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/telehealth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // The version we actually displayed. If the policy changed while this
        // page was open the server refuses (409) rather than recording consent
        // to text the patient never saw.
        body: JSON.stringify({
          sessionId,
          consented: true,
          policyVersion: visit?.consentPolicy?.version,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Could not record your consent (${res.status}).`);
      }
      goToDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record your consent.');
    } finally {
      setBusy(false);
    }
  }, [consentChecked, goToDevices, sessionId, token, visit?.consentPolicy?.version]);

  const joinVisit = useCallback(async () => {
    if (!sessionId || !token) return;
    // Hand the devices to LiveKit — it opens them itself, and two holders of
    // the same camera is exactly the 'in_use' failure this page warns about.
    stopStream(previewStreamRef.current);
    previewStreamRef.current = null;
    setMicOn(true);
    setCamOn(!audioOnly);

    // Announce arrival BEFORE connecting media. This is what puts the session
    // into `waiting_room` with a recorded arrival time, so the clinician sees
    // a real patient waiting rather than inferring it from a media connection.
    try {
      const res = await fetch('/api/telehealth/waiting-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error || 'Could not join the waiting room.');
        setPhase('unavailable');
        return;
      }
      const b = await res.json();
      setVisit(v => (v ? { ...v, waitingSince: b.waitingSince, status: b.status } : v));
    } catch {
      setError('We could not reach the clinic. Check your connection and try again.');
      setPhase('unavailable');
      return;
    }

    setPhase('joining');
    setArmedSessionId(sessionId);
  }, [audioOnly, sessionId, token]);

  const leave = useCallback(() => {
    disconnect();
    setPhase('left');
  }, [disconnect]);

  const toggleMic = useCallback(() => {
    setMicOn(on => { void setMicEnabled(!on).catch(() => {}); return !on; });
  }, [setMicEnabled]);

  const toggleCam = useCallback(() => {
    setCamOn(on => { void setCameraEnabled(!on).catch(() => {}); return !on; });
  }, [setCameraEnabled]);

  const shell = (children: React.ReactNode) => (
    <main className="th-join"><div className="th-join-card">{children}</div></main>
  );

  // ── Not signed in ─────────────────────────────────────────────────────────
  if (phase === 'signed_out') {
    return shell(
      <>
        <h1 className="th-join-title">Join your video visit</h1>
        <p className="th-join-body">
          Please sign in to your patient portal first. The link you followed
          identifies the visit but does not sign you in — that keeps your
          appointment private if the link is ever forwarded or seen by
          someone else.
        </p>
        {error && <p className="th-join-error" role="alert">{error}</p>}
        <a className="th-join-btn" href="/patient-portal">Sign in to continue</a>
      </>,
    );
  }

  if (phase === 'checking') {
    return shell(
      <>
        <h1 className="th-join-title">Opening your visit…</h1>
        <p className="th-join-body">One moment.</p>
      </>,
    );
  }

  if (phase === 'unavailable') {
    return shell(
      <>
        <h1 className="th-join-title">This visit isn&apos;t available</h1>
        <p className="th-join-body">{error || 'We could not open this visit.'}</p>
        <a className="th-join-btn" href="/patient-portal">Back to my portal</a>
      </>,
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (phase === 'summary' && visit) {
    const w = visit.joinWindow;
    return shell(
      <>
        <h1 className="th-join-title">Your video visit</h1>
        <dl className="th-join-summary">
          <div><dt>Clinician</dt><dd>{visit.providerName}</dd></div>
          <div><dt>Clinic</dt><dd>{visit.facilityName}</dd></div>
          <div><dt>Date</dt><dd>{visit.scheduledDate}</dd></div>
          <div><dt>Time</dt><dd>{visit.scheduledTime}</dd></div>
          <div><dt>Reason</dt><dd>{visit.chiefComplaint}</dd></div>
        </dl>

        {/* The window verdict is stated with its actual times — a disabled
            button with no explanation is the thing this replaces. */}
        <p className={w.open ? 'th-join-body' : 'th-join-error'} role={w.open ? undefined : 'alert'}>
          {w.message}
        </p>

        <div className="th-join-actions">
          <a className="th-join-btn th-join-btn--ghost" href="/patient-portal">Not now</a>
          <button
            type="button"
            className="th-join-btn"
            disabled={!w.open}
            aria-disabled={!w.open}
            onClick={() => { if (visit.consentGiven) goToDevices(); else setPhase('consent'); }}
          >
            {visit.consentGiven ? 'Continue' : 'Continue to consent'}
          </button>
        </div>
      </>,
    );
  }

  // ── Consent gate ──────────────────────────────────────────────────────────
  if (phase === 'consent') {
    return shell(
      <>
        <h1 className="th-join-title">Before you join</h1>
        {/* Rendered from the server's versioned policy, never a string baked
            into this page — the version recorded against the consent has to be
            the version the patient actually read. */}
        {visit?.consentPolicy?.text.map((para, i) => (
          <p className="th-join-body" key={i}>{para}</p>
        ))}

        <label className="th-join-consent">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={e => setConsentChecked(e.target.checked)}
          />
          <span>I understand and I consent to this video consultation.</span>
        </label>
        {/* Shown, not hidden — the patient can see which version they agreed
            to, and it matches what the record stores. */}
        {visit?.consentPolicy?.version && (
          <p className="th-join-policy-version">
            Consent policy version {visit.consentPolicy.version}
          </p>
        )}

        {error && <p className="th-join-error" role="alert">{error}</p>}

        <div className="th-join-actions">
          <a className="th-join-btn th-join-btn--ghost" href="/patient-portal">Not now</a>
          <button
            type="button"
            className="th-join-btn"
            onClick={giveConsent}
            disabled={!consentChecked || busy}
          >
            {busy ? 'Saving…' : 'I consent'}
          </button>
        </div>
      </>,
    );
  }

  // ── Device check ──────────────────────────────────────────────────────────
  if (phase === 'devices') {
    const canJoin = Boolean(check?.ok) || audioOnly;
    return shell(
      <>
        <h1 className="th-join-title">Check your camera and microphone</h1>

        {!audioOnly && (
          <video
            ref={previewElRef}
            className="th-join-preview"
            autoPlay
            playsInline
            muted
            aria-label="Preview of your camera"
          />
        )}

        {check && !check.ok && (
          <div className="th-join-error" role="alert">
            <strong>{check.message}</strong>
            <span>{check.remedy}</span>
          </div>
        )}

        {check?.ok && !audioOnly && (
          <p className="th-join-body">
            If you can see yourself above, your camera and microphone are working.
          </p>
        )}

        {/* Audio-only stays available on every failure path — a consultation
            that keeps working in audio is clinically useful, and on the
            bandwidth this deployment targets it is often the better call. */}
        <label className="th-join-consent">
          <input
            type="checkbox"
            checked={audioOnly}
            onChange={e => {
              const next = e.target.checked;
              setAudioOnly(next);
              setCheck(null);
              void testDevices(!next);
            }}
          />
          <span>Join with audio only (no camera)</span>
        </label>

        <div className="th-join-actions">
          <button
            type="button"
            className="th-join-btn th-join-btn--ghost"
            onClick={() => void testDevices(!audioOnly)}
            disabled={busy}
          >
            {busy ? 'Checking…' : 'Test again'}
          </button>
          <button
            type="button"
            className="th-join-btn"
            onClick={joinVisit}
            disabled={!canJoin || busy}
            aria-disabled={!canJoin || busy}
          >
            Join visit
          </button>
        </div>
      </>,
    );
  }

  // ── Turned away ───────────────────────────────────────────────────────────
  // Takes priority over the live view: a rejected patient must never be left
  // sitting in a waiting room that will never open.
  if (visit?.rejectedAt) {
    return shell(
      <>
        <h1 className="th-join-title">This visit can&apos;t go ahead</h1>
        <p className="th-join-body">
          {visit.rejectionReason || 'Your clinician is unable to see you now.'}
        </p>
        <p className="th-join-body">
          Nothing is wrong with your account, and this does not count as a
          missed appointment.
        </p>
        <a className="th-join-btn" href="/patient-portal">Back to my portal</a>
      </>,
    );
  }

  // ── Left ──────────────────────────────────────────────────────────────────
  if (phase === 'left') {
    return shell(
      <>
        <h1 className="th-join-title">You have left the visit</h1>
        <p className="th-join-body">
          If you left by mistake you can rejoin from the same link. Otherwise
          your clinic will be in touch.
        </p>
        <a className="th-join-btn" href="/patient-portal">Back to my portal</a>
      </>,
    );
  }

  // ── In the visit ──────────────────────────────────────────────────────────
  return (
    <main className="th-join th-join--live">
      <div className="th-join-stage">
        {/* When the clinician shares a screen it takes the main tile and their
            camera is demoted to a thumbnail — a shared X-ray or medication
            list is the thing being discussed, so it gets the space. */}
        {remoteScreenShare ? (
          <>
            <video ref={attachRemoteScreenShare} className="th-join-remote th-join-remote--share" autoPlay playsInline />
            <video ref={attachRemoteVideo} className="th-join-pip" autoPlay playsInline />
          </>
        ) : (
          <video ref={attachRemoteVideo} className="th-join-remote" autoPlay playsInline />
        )}
        {/* Until the clinician admits them, the patient is in the waiting
            room regardless of whether media has connected — admission is a
            server fact, not a media one. */}
        {!admitted && (
          <div className="th-join-waiting">
            {mediaStatus === 'connecting' ? (
              <>
                <p className="th-join-title">Connecting you to the visit…</p>
                <p className="th-join-body">This can take a few seconds.</p>
              </>
            ) : (
              <>
                <p className="th-join-title">Waiting for {visit?.providerName || 'your clinician'}…</p>
                <p className="th-join-body">
                  They have been told you are here. Please keep this page open.
                </p>
                {/* Honest elapsed time from the server's record of arrival —
                    never a progress bar that advances on its own. */}
                {visit?.waitingSince && (
                  <p className="th-join-body">
                    You have been waiting {waitingMinutes} min. Your camera and
                    microphone stay off until your clinician lets you in.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {admitted && !remotePresent && (
          <div className="th-join-waiting">
            <p className="th-join-title">Reconnecting to your clinician…</p>
            <p className="th-join-body">Please keep this page open.</p>
          </div>
        )}
        {(mediaStatus === 'unconfigured' || mediaStatus === 'error') && (
          <div className="th-join-banner" role="alert">
            <strong>We can&apos;t start the video right now.</strong>
            {mediaError && <span>{mediaError}</span>}
            <span>Please contact your clinic — they may call you instead.</span>
          </div>
        )}
        {/* A track that failed to open is reported separately from a failed
            call, because the visit is still running. */}
        {publishError && mediaStatus === 'connected' && (
          <div className="th-join-banner" role="status">{publishError}</div>
        )}
        {mediaStatus === 'reconnecting' && (
          <div className="th-join-banner" role="status">Reconnecting…</div>
        )}
        <video ref={attachLocalVideo} className="th-join-self" autoPlay playsInline muted />
      </div>

      <div className="th-join-controls">
        <button type="button" className="th-join-ctl" onClick={toggleMic} aria-pressed={micOn}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button type="button" className="th-join-ctl" onClick={toggleCam} aria-pressed={camOn}>
          {camOn ? 'Camera off' : 'Camera on'}
        </button>
        <button type="button" className="th-join-ctl th-join-ctl--leave" onClick={leave}>
          Leave visit
        </button>
      </div>
    </main>
  );
}
