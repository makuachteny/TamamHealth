/**
 * Pre-visit device check — camera/microphone diagnosis and recovery advice.
 *
 * Separated from the join page so the failure classification is testable. The
 * whole value of this step is telling a patient *which* problem they have; a
 * generic "could not access your camera" leaves them with nothing to do, and
 * the visit is lost to something a sentence of instruction would have fixed.
 *
 * `getUserMedia` errors are classified by `name`, which is specified and
 * stable, rather than by message text, which is not.
 */

export type DeviceFailure =
  | 'denied'        // user (or policy) refused the permission prompt
  | 'not_found'     // no such device attached
  | 'in_use'        // another app holds the device
  | 'insecure'      // page is not a secure context — API unavailable
  | 'unsupported'   // browser has no getUserMedia at all
  | 'unknown';

export interface DeviceCheckResult {
  ok: boolean;
  /** Live stream when ok — the caller owns it and must stop its tracks. */
  stream: MediaStream | null;
  failure: DeviceFailure | null;
  /** What went wrong, in the patient's terms. */
  message: string;
  /** What to actually do about it. Empty when ok. */
  remedy: string;
}

/** Rough browser family, only as precise as the remedies need. */
export type BrowserFamily = 'chrome' | 'safari' | 'firefox' | 'other';

export function detectBrowser(ua: string): BrowserFamily {
  const s = ua.toLowerCase();
  // Order matters: Chrome's UA contains "safari", and Edge/Opera contain
  // "chrome". Testing for the more specific strings first keeps Edge and Opera
  // on the Chrome instructions, which are correct for them.
  if (s.includes('firefox') || s.includes('fxios')) return 'firefox';
  if (s.includes('chrome') || s.includes('crios') || s.includes('chromium') || s.includes('edg')) return 'chrome';
  if (s.includes('safari')) return 'safari';
  return 'other';
}

/** Where the permission toggle lives in each browser. */
function permissionRemedy(browser: BrowserFamily): string {
  switch (browser) {
    case 'chrome':
      return 'Tap the camera icon in the address bar (or open Settings → Privacy and security → Site settings → Camera), allow this site, then reload the page.';
    case 'safari':
      return 'Open Settings → Safari → Camera & Microphone and set this site to Allow, then reload the page. On a Mac: Safari → Settings for This Website.';
    case 'firefox':
      return 'Click the padlock in the address bar, clear the blocked Camera/Microphone permission, then reload the page.';
    default:
      return 'Open your browser settings, allow camera and microphone access for this site, then reload the page.';
  }
}

function classify(err: unknown): DeviceFailure {
  const name = (err as { name?: string })?.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'not_found';
    case 'NotReadableError':
    case 'AbortError':
      return 'in_use';
    default:
      return 'unknown';
  }
}

export function describeFailure(
  failure: DeviceFailure,
  browser: BrowserFamily,
  wantVideo: boolean,
): { message: string; remedy: string } {
  const device = wantVideo ? 'camera and microphone' : 'microphone';
  switch (failure) {
    case 'denied':
      return {
        message: `Your browser is blocking access to your ${device}.`,
        remedy: permissionRemedy(browser),
      };
    case 'not_found':
      return {
        message: wantVideo
          ? 'We could not find a camera on this device.'
          : 'We could not find a microphone on this device.',
        remedy: wantVideo
          ? 'You can still join the visit with audio only — your clinician will hear you but not see you.'
          : 'Connect a headset or use a device with a microphone, or call your clinic to arrange a phone consultation.',
      };
    case 'in_use':
      return {
        message: `Another app is already using your ${device}.`,
        remedy: 'Close any other video call, camera or recording app, then try again.',
      };
    case 'insecure':
      return {
        message: 'Video calls need a secure (https) connection.',
        remedy: 'Open this page using the https:// link your clinic sent you.',
      };
    case 'unsupported':
      return {
        message: 'This browser cannot make video calls.',
        remedy: 'Try Chrome or Safari, or call your clinic to arrange a phone consultation.',
      };
    default:
      return {
        message: `We could not start your ${device}.`,
        remedy: 'Try again, or restart your browser. If it keeps failing you can join with audio only.',
      };
  }
}

/**
 * Ask for the devices and report precisely what happened.
 *
 * On success the caller receives a live stream and owns it — it must call
 * `stopStream` before joining, so the camera indicator light does not stay on
 * and LiveKit can acquire the device itself.
 */
export async function runDeviceCheck(
  { video, userAgent }: { video: boolean; userAgent?: string },
): Promise<DeviceCheckResult> {
  const browser = detectBrowser(userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''));

  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!md || typeof md.getUserMedia !== 'function') {
    // A non-secure context is the overwhelmingly common cause of a missing
    // mediaDevices, and it has a different remedy from an old browser, so the
    // two are distinguished rather than collapsed into "unsupported".
    const insecure = typeof window !== 'undefined' && !window.isSecureContext;
    const failure: DeviceFailure = insecure ? 'insecure' : 'unsupported';
    return { ok: false, stream: null, failure, ...describeFailure(failure, browser, video) };
  }

  try {
    const stream = await md.getUserMedia({ audio: true, video });
    return { ok: true, stream, failure: null, message: '', remedy: '' };
  } catch (err) {
    const failure = classify(err);
    return { ok: false, stream: null, failure, ...describeFailure(failure, browser, video) };
  }
}

/** Release a device-check stream. Safe to call with null. */
export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach(t => t.stop());
}
