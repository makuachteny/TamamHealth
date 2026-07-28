'use client';

/**
 * useLiveKitRoom — real-time media for a telehealth visit.
 *
 * Replaces the simulated remote participant that the provider room shipped
 * with. Both the clinician and (once it exists) the patient surface use this
 * same hook, so neither side can drift into a different connection model.
 *
 * Design notes:
 *
 *  - The caller passes a session id, never a token or a room name. The hook
 *    asks `/api/telehealth/token`, which authenticates the caller and checks
 *    they are a participant in that specific session before signing anything.
 *    Nothing here can grant access that the server did not already authorise.
 *
 *  - Tokens are short-lived (15 min). `connect()` mints a fresh one each time,
 *    and a disconnect caused by expiry is handled by reconnecting rather than
 *    by holding a long-lived credential in browser memory.
 *
 *  - Degrades honestly. If the deployment has no LiveKit server configured the
 *    server returns 503 and `status` becomes `'unconfigured'` — the UI can say
 *    so plainly instead of showing a call that will never connect. This matters
 *    because a telehealth screen that *looks* live but is not is worse than one
 *    that admits it is unavailable.
 *
 *  - Bandwidth: audio is prioritised and video is adaptive. On a 10-50 Kbps
 *    satellite link a consultation that keeps working in audio is clinically
 *    useful; one that stalls trying to hold 720p is not.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  ScreenSharePresets,
  type RemoteParticipant,
  type RemoteTrack,
} from 'livekit-client';

export type LiveKitStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unconfigured'
  | 'error';

export interface UseLiveKitRoomResult {
  room: Room | null;
  status: LiveKitStatus;
  error: string | null;
  /** A track we were asked to publish could not be opened. The call is still
   *  up — this is "your camera didn't start", not "the visit failed". */
  publishError: string | null;
  /** Remote participants currently in the room (excludes the local user). */
  remotes: RemoteParticipant[];
  /** True once at least one remote participant has joined — real presence,
   *  not a timer. This is what drives "the patient is in the waiting room". */
  remotePresent: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Attach the remote CAMERA track to an element. Screen share is separate —
   *  attaching both to one element means whichever arrives last wins, and the
   *  patient loses the clinician's face the moment a document is shared. */
  attachRemoteVideo: (el: HTMLVideoElement | null) => void;
  /** Attach the remote SCREEN SHARE track (KAN-130). */
  attachRemoteScreenShare: (el: HTMLVideoElement | null) => void;
  /** Attach the LOCAL screen share, so the sharer sees what they are sharing. */
  attachLocalScreenShare: (el: HTMLVideoElement | null) => void;
  /** True while a remote participant is sharing their screen. Drives the
   *  layout swap: share to the main tile, camera demoted to a thumbnail. */
  remoteScreenShare: boolean;
  /** True while WE are sharing. Reflects the room's actual publication, so the
   *  browser's own "Stop sharing" bar keeps the UI honest. */
  localScreenShare: boolean;
  /** Attach the LOCAL camera track to an element (the provider's self-view).
   *  Uses the published track rather than a separate getUserMedia, so the
   *  self-view always shows exactly what the far side receives. */
  attachLocalVideo: (el: HTMLVideoElement | null) => void;
  setMicEnabled: (on: boolean) => Promise<void>;
  setCameraEnabled: (on: boolean) => Promise<void>;
  setScreenShareEnabled: (on: boolean) => Promise<void>;
  /** Send a chat line over the room's data channel. */
  sendChat: (text: string) => Promise<void>;
  /** Chat lines received from remote participants. */
  chat: { id: string; from: string; text: string; at: number }[];
}

export interface UseLiveKitRoomOptions {
  /**
   * Tracks to publish as soon as the connection is up.
   *
   * Default is to publish NOTHING, which is what the clinician room wants: it
   * connects while the patient is still in the waiting room and turns the
   * camera on at admission.
   *
   * The patient side must set these, because a participant who joins with no
   * published tracks is present in the room but silent and invisible — the
   * clinician sees someone connected and hears nothing, which reads as a
   * broken call rather than as a patient who hasn't pressed unmute.
   */
  publishOnConnect?: { mic?: boolean; camera?: boolean };
}

export function useLiveKitRoom(
  sessionId: string | null,
  /**
   * Patient-portal bearer token.
   *
   * Staff authenticate to `/api/telehealth/token` by cookie, so they pass
   * nothing. The patient portal keeps its JWT in sessionStorage and
   * authenticates by `Authorization: Bearer`, so the patient join surface must
   * hand it in — without this the patient's token request arrives unauthenticated
   * and the server correctly refuses it.
   */
  authToken?: string | null,
  options?: UseLiveKitRoomOptions,
): UseLiveKitRoomResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<LiveKitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<RemoteParticipant[]>([]);
  const [chat, setChat] = useState<UseLiveKitRoomResult['chat']>([]);

  const [publishError, setPublishError] = useState<string | null>(null);
  const [remoteScreenShare, setRemoteScreenShare] = useState(false);
  const [localScreenShare, setLocalScreenShare] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const remoteShareElRef = useRef<HTMLVideoElement | null>(null);
  const localShareElRef = useRef<HTMLVideoElement | null>(null);

  // Held in a ref, not a dependency: callers pass this inline, so depending on
  // it would rebuild `connect` every render and retrigger the connect effect.
  // Seeded at mount and refreshed in an effect — writing it during render is
  // what the refs lint rule (correctly) objects to. This hook's effect is
  // registered before the caller's connect effect, so the ref is current by
  // the time anything reads it.
  const publishRef = useRef(options?.publishOnConnect);
  useEffect(() => {
    publishRef.current = options?.publishOnConnect;
  });

  const syncRemotes = useCallback((r: Room) => {
    setRemotes(Array.from(r.remoteParticipants.values()));
  }, []);

  const disconnect = useCallback(() => {
    const r = roomRef.current;
    if (!r) return;
    void r.disconnect();
    roomRef.current = null;
    setRoom(null);
    setRemotes([]);
    setStatus('disconnected');
  }, []);

  const connect = useCallback(async () => {
    if (!sessionId || roomRef.current) return;
    setStatus('connecting');
    setError(null);
    setPublishError(null);

    try {
      const res = await fetch('/api/telehealth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ sessionId }),
      });

      if (res.status === 503) {
        // No LiveKit server on this deployment — say so rather than pretending.
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Telehealth video is not configured on this deployment.');
        setStatus('unconfigured');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Could not join the visit (${res.status}).`);
        setStatus('error');
        return;
      }

      const { token, url } = (await res.json()) as { token: string; url: string };

      const r = new Room({
        // Adaptive stream + dynacast keep bitrate down on constrained links by
        // only sending what the far side is actually rendering.
        adaptiveStream: true,
        dynacast: true,
      });

      r.on(RoomEvent.ParticipantConnected, () => syncRemotes(r));
      r.on(RoomEvent.ParticipantDisconnected, () => syncRemotes(r));

      r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          // Routed by SOURCE, not just kind. Both arrive as video tracks, and
          // attaching them to one element means the last to arrive wins —
          // the patient would lose the clinician's face the moment a document
          // is shared, which is the opposite of what sharing is for.
          if (track.source === Track.Source.ScreenShare) {
            setRemoteScreenShare(true);
            if (remoteShareElRef.current) track.attach(remoteShareElRef.current);
          } else if (remoteVideoElRef.current) {
            track.attach(remoteVideoElRef.current);
          }
        }
        if (track.kind === Track.Kind.Audio) {
          // Audio needs an element to actually play; attach() creates one.
          track.attach();
        }
        syncRemotes(r);
      });

      r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.source === Track.Source.ScreenShare) setRemoteScreenShare(false);
        track.detach();
        syncRemotes(r);
      });

      r.on(RoomEvent.DataReceived, (payload: Uint8Array, participant) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload)) as { text?: string };
          const text = typeof msg.text === 'string' ? msg.text.trim() : '';
          if (!text) return;
          setChat(prev => [...prev, {
            id: `lk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            from: participant?.identity || 'remote',
            text,
            at: Date.now(),
          }]);
        } catch { /* non-JSON payload — not ours, ignore */ }
      });

      r.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.source === Track.Source.Camera && pub.track && localVideoElRef.current) {
          pub.track.attach(localVideoElRef.current);
        }
        if (pub.source === Track.Source.ScreenShare && pub.track) {
          setLocalScreenShare(true);
          if (localShareElRef.current) pub.track.attach(localShareElRef.current);
        }
      });

      // The browser's own "Stop sharing" bar ends the track without telling
      // the app. Without this the UI keeps claiming to share a screen the far
      // side stopped receiving — the clinician talks through a document the
      // patient can no longer see.
      r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) setLocalScreenShare(false);
      });

      r.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Reconnecting) setStatus('reconnecting');
        else if (state === ConnectionState.Connected) setStatus('connected');
        else if (state === ConnectionState.Disconnected) setStatus('disconnected');
      });

      r.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setRoom(null);
        setRemotes([]);
        setStatus('disconnected');
      });

      await r.connect(url, token);
      roomRef.current = r;
      setRoom(r);
      syncRemotes(r);
      setStatus('connected');

      // Publish the requested tracks. A failure here is NOT a failed call —
      // the patient is in the room and can still hear the clinician — so it
      // records a separate, narrower error instead of tearing the room down.
      // Audio is attempted first and independently of video: on a denied
      // camera or a device with none, a working audio consultation is the
      // clinically useful outcome and must not be lost to the same catch.
      const publish = publishRef.current;
      if (publish?.mic) {
        try {
          await r.localParticipant.setMicrophoneEnabled(true);
        } catch {
          setPublishError('We could not turn your microphone on. Check your browser permissions.');
        }
      }
      if (publish?.camera) {
        try {
          await r.localParticipant.setCameraEnabled(true);
        } catch {
          setPublishError('We could not turn your camera on — continuing with audio only.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to the visit.');
      setStatus('error');
    }
  }, [sessionId, authToken, syncRemotes]);

  // Tear the connection down on unmount so a navigated-away tab does not hold
  // a live media session (and a live PHI stream) open.
  useEffect(() => () => {
    const r = roomRef.current;
    if (r) void r.disconnect();
    roomRef.current = null;
  }, []);

  const attachRemoteVideo = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoElRef.current = el;
    const r = roomRef.current;
    if (!r || !el) return;
    for (const p of r.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        // Camera only — a screen share must not land in the camera tile.
        if (pub.track && pub.kind === Track.Kind.Video && pub.source !== Track.Source.ScreenShare) {
          pub.track.attach(el);
        }
      }
    }
  }, []);

  const attachRemoteScreenShare = useCallback((el: HTMLVideoElement | null) => {
    remoteShareElRef.current = el;
    const r = roomRef.current;
    if (!r || !el) return;
    // Attach an already-running share: the element mounts only once the layout
    // swaps to it, which is AFTER the track was subscribed, so waiting for the
    // subscribe event alone would leave the tile permanently blank.
    for (const p of r.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        if (pub.track && pub.source === Track.Source.ScreenShare) pub.track.attach(el);
      }
    }
  }, []);

  const attachLocalScreenShare = useCallback((el: HTMLVideoElement | null) => {
    localShareElRef.current = el;
    const r = roomRef.current;
    if (!r || !el) return;
    for (const pub of r.localParticipant.videoTrackPublications.values()) {
      if (pub.source === Track.Source.ScreenShare && pub.track) pub.track.attach(el);
    }
  }, []);

  const attachLocalVideo = useCallback((el: HTMLVideoElement | null) => {
    localVideoElRef.current = el;
    const r = roomRef.current;
    if (!r || !el) return;
    for (const pub of r.localParticipant.videoTrackPublications.values()) {
      // Skip the screen-share publication — the self-view shows the camera.
      if (pub.source === Track.Source.Camera && pub.track) pub.track.attach(el);
    }
  }, []);

  const setMicEnabled = useCallback(async (on: boolean) => {
    await roomRef.current?.localParticipant.setMicrophoneEnabled(on);
  }, []);

  const setCameraEnabled = useCallback(async (on: boolean) => {
    await roomRef.current?.localParticipant.setCameraEnabled(on);
  }, []);

  const setScreenShareEnabled = useCallback(async (on: boolean) => {
    // Capped deliberately. An uncapped share runs at the display's native
    // resolution and frame rate, which on a VSAT link starves the audio the
    // consultation actually depends on — the clinician ends up with a crisp
    // document and a patient who cannot hear them.
    //
    // 720p/5fps with a `detail` content hint is tuned for what gets shared
    // here: lab reports, X-rays, medication lists. Legible text matters;
    // smooth motion does not.
    await roomRef.current?.localParticipant.setScreenShareEnabled(on, {
      resolution: ScreenSharePresets.h720fps5.resolution,
      contentHint: 'detail',
      // Screen audio is off: it would capture whatever else is playing on the
      // clinician's machine and send it into a consultation.
      audio: false,
    });
  }, []);

  const sendChat = useCallback(async (text: string) => {
    const r = roomRef.current;
    if (!r || !text.trim()) return;
    const payload = new TextEncoder().encode(JSON.stringify({ text }));
    // Reliable delivery: a dropped clinical message is not acceptable, and
    // chat volume is far too low for the latency cost to matter.
    await r.localParticipant.publishData(payload, { reliable: true });
  }, []);

  return {
    room,
    status,
    error,
    publishError,
    remotes,
    remotePresent: remotes.length > 0,
    connect,
    disconnect,
    attachRemoteVideo,
    attachRemoteScreenShare,
    attachLocalScreenShare,
    attachLocalVideo,
    remoteScreenShare,
    localScreenShare,
    setMicEnabled,
    setCameraEnabled,
    setScreenShareEnabled,
    sendChat,
    chat,
  };
}
