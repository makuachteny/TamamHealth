import { DEMO_USER_PROFILES } from './demo-users';

const DEMO_PASSWORD_SALT = 'tamamhealth-demo-password-v1';

function hashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x27d4eb2d);
  }

  const mix = `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
  return mix.replace(/[^a-z0-9]/gi, '');
}

export function getDemoPassword(username: string): string {
  const seed = hashString(`${DEMO_PASSWORD_SALT}:${username}`);
  return seed.slice(0, 12).padEnd(12, 'x');
}

export function getDemoPasswordMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const profile of DEMO_USER_PROFILES) {
    out[profile.username] = getDemoPassword(profile.username);
  }
  return out;
}
