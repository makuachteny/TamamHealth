// Polyfill TextEncoder/TextDecoder for jose in jsdom
import { TextEncoder, TextDecoder } from 'util';
import crypto from 'crypto';
import timers from 'timers';

Object.assign(globalThis, { TextEncoder, TextDecoder });

// Polyfill setImmediate/clearImmediate for pouchdb-adapter-memory (memdown) in jsdom
if (typeof globalThis.setImmediate === 'undefined') {
  const timedGlobal = globalThis as typeof globalThis & {
    setImmediate: typeof timers.setImmediate;
    clearImmediate: typeof timers.clearImmediate;
  };

  timedGlobal.setImmediate = timers.setImmediate;
  timedGlobal.clearImmediate = timers.clearImmediate;
}

// Polyfill fetch for pouchdb-browser in jsdom (Node 18+ has native fetch)
if (typeof globalThis.fetch === 'undefined') {
  Object.assign(globalThis, {
    fetch: (...args: Parameters<typeof fetch>) =>
      // @ts-expect-error -- node-fetch v2 is untyped here; this is only a Jest fetch polyfill.
      import('node-fetch')
      .then(m => (m.default as typeof fetch)(...args)),
    Headers: class Headers {},
    Request: class Request {},
    Response: class Response {},
  });
}

// Polyfill structuredClone for jose v6+ in jsdom
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(val: T): T => JSON.parse(JSON.stringify(val));
}

// Polyfill Web Crypto API for jose JWT signing/verification in jsdom
Object.defineProperty(globalThis, 'crypto', {
  value: {
    ...crypto,
    subtle: crypto.webcrypto?.subtle,
    getRandomValues: (arr: Uint8Array) => crypto.randomFillSync(arr),
  },
  writable: true,
  configurable: true,
});
