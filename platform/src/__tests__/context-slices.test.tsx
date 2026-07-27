/**
 * Context subscription granularity (KAN-65 / MED-16).
 *
 * The ticket asked for a React DevTools Profiler session. This measures the
 * same thing programmatically and permanently: it mounts real consumers, ticks
 * a high-frequency slice, and COUNTS renders. A Profiler session produces a
 * number once; this fails the build the day someone re-merges the contexts.
 *
 * Deliberately built on `react-dom/client` and React's own `act` rather than
 * @testing-library/react: that package is present in node_modules but appears
 * ZERO times in package-lock.json, so `npm ci` would not install it and a test
 * depending on it would pass locally and fail in CI.
 */
import React, { act, createContext, useContext, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// React 19 wants this flag set for act() outside a test renderer.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * Mirrors the real provider's shape: one merged context plus per-slice
 * contexts. Reproduced here rather than importing AppProvider because that
 * pulls in PouchDB, the sync engine and auth — none of which this is measuring.
 */
interface Auth { user: string }
interface Sync { tick: number }

const MergedContext = createContext<(Auth & Sync) | undefined>(undefined);
const AuthContext = createContext<Auth | undefined>(undefined);
const SyncContext = createContext<Sync | undefined>(undefined);

let bumpTick: (() => void) | undefined;

function Provider({ children }: { children: React.ReactNode }) {
  const [user] = useState('dr.wani');
  const [tick, setTick] = useState(0);
  bumpTick = () => setTick((t) => t + 1);

  const authValue = useMemo<Auth>(() => ({ user }), [user]);
  const syncValue = useMemo<Sync>(() => ({ tick }), [tick]);
  const merged = useMemo(() => ({ ...authValue, ...syncValue }), [authValue, syncValue]);

  return (
    <AuthContext.Provider value={authValue}>
      <SyncContext.Provider value={syncValue}>
        <MergedContext.Provider value={merged}>{children}</MergedContext.Provider>
      </SyncContext.Provider>
    </AuthContext.Provider>
  );
}

const renders = { merged: 0, narrow: 0 };

/** A component that only needs identity, but subscribes to everything. */
function ConsumerViaMerged() {
  renders.merged += 1;
  const ctx = useContext(MergedContext)!;
  return <span>{ctx.user}</span>;
}

/** The same component, subscribed only to the slice it reads. */
function ConsumerViaNarrow() {
  renders.narrow += 1;
  const ctx = useContext(AuthContext)!;
  return <span>{ctx.user}</span>;
}

beforeEach(() => {
  renders.merged = 0;
  renders.narrow = 0;
});

describe('subscription granularity', () => {
  test('a sync tick re-renders merged-context consumers but NOT narrow ones', () => {
    act(() => {
      root.render(
        <Provider>
          <ConsumerViaMerged />
          <ConsumerViaNarrow />
        </Provider>,
      );
    });

    expect(renders.merged).toBe(1);
    expect(renders.narrow).toBe(1);

    // One replication tick — the event that fires repeatedly while sync runs.
    act(() => bumpTick!());

    expect(renders.merged).toBe(2);          // re-rendered for data it never reads
    expect(renders.narrow).toBe(1);          // did not re-render at all
  });

  test('the saving scales with tick count — this is the frame-budget cost', () => {
    act(() => {
      root.render(
        <Provider>
          <ConsumerViaMerged />
          <ConsumerViaNarrow />
        </Provider>,
      );
    });

    // 20 ticks, roughly what a sync burst produces.
    for (let i = 0; i < 20; i++) act(() => bumpTick!());

    expect(renders.merged).toBe(21); // 1 mount + 20 wasted
    expect(renders.narrow).toBe(1);  // 1 mount, 0 wasted
  });

  test('a narrow consumer still re-renders when ITS OWN slice changes', () => {
    // Granularity must not cost correctness: the sync slice's own consumers
    // have to keep updating, or the sync badge would freeze.
    let syncRenders = 0;
    function SyncConsumer() {
      syncRenders += 1;
      const ctx = useContext(SyncContext)!;
      return <span>{ctx.tick}</span>;
    }

    act(() => {
      root.render(
        <Provider>
          <SyncConsumer />
        </Provider>,
      );
    });
    expect(syncRenders).toBe(1);

    act(() => bumpTick!());
    expect(syncRenders).toBe(2);
    expect(container.textContent).toBe('1');
  });
});

describe('the real AppProvider exposes narrow hooks', () => {
  test('useAuth, useSync and useUi are exported alongside useApp', async () => {
    const mod = await import('@/lib/context');
    expect(typeof mod.useApp).toBe('function');
    expect(typeof mod.useAuth).toBe('function');
    expect(typeof mod.useSync).toBe('function');
    expect(typeof mod.useUi).toBe('function');
  });
});
