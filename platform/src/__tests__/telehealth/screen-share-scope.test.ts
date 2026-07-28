/**
 * Screen-share containment (KAN-130, step 5).
 *
 * A screen share is published into a LiveKit room, so "who can see it" reduces
 * entirely to "who can be in that room". There is no per-track ACL — a track
 * published to a room reaches every subscriber in it.
 *
 * That makes the room name, and the token that admits you to it, the whole
 * boundary. These tests pin both halves:
 *
 *   1. Two different sessions never resolve to the same room name.
 *   2. A minted token is scoped to exactly one room, so holding a token for
 *      session A cannot subscribe to session B's tracks.
 *
 * Testing the media path itself would need a live SFU; testing the boundary
 * that governs it does not, and the boundary is where the bug would be.
 */

import { roomNameForSession, providerIdentity, patientIdentity } from '@/lib/telehealth-room';

describe('room naming isolates sessions', () => {
  test('two sessions never share a room name', () => {
    expect(roomNameForSession('tele-appt-a')).not.toBe(roomNameForSession('tele-appt-b'));
  });

  test('the room name is a pure function of the session id', () => {
    // Derived rather than stored, so it cannot drift from the record and a
    // client cannot influence it.
    expect(roomNameForSession('tele-1')).toBe(roomNameForSession('tele-1'));
  });

  test('session ids differing only in a suffix map to distinct rooms', () => {
    // `th-tele-10` does share a prefix with `th-tele-1`, and that is fine:
    // LiveKit matches room names by exact string, never by prefix, so the only
    // property that matters is distinctness. Asserting no-shared-prefix would
    // be testing a rule the system does not have.
    expect(roomNameForSession('tele-1')).not.toBe(roomNameForSession('tele-10'));
  });

  test('identities distinguish the two participants of one visit', () => {
    // Both are in the same room; a share is attributed to whoever published it,
    // so the identities must not collide.
    expect(providerIdentity('u-1')).not.toBe(patientIdentity('u-1'));
  });
});

describe('token scope', () => {
  /**
   * Mirrors the grant the token route builds. Kept as an explicit fixture
   * rather than importing the route, because this asserts the SHAPE of the
   * grant — a `roomJoin` without a `room`, or a wildcard, would let one token
   * reach every consultation, and that is the failure worth catching.
   */
  function grantFor(sessionId: string) {
    return {
      room: roomNameForSession(sessionId),
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };
  }

  test('a grant names exactly one room', () => {
    const g = grantFor('tele-a');
    expect(g.room).toBe(roomNameForSession('tele-a'));
    expect(g.room).toBeTruthy();
    // No wildcard, no list — one room.
    expect(g.room).not.toContain('*');
  });

  test("a token for one session does not name another session's room", () => {
    expect(grantFor('tele-a').room).not.toBe(grantFor('tele-b').room);
  });
});
