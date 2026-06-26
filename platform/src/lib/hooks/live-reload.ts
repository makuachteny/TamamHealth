/**
 * Coalesces a burst of PouchDB `changes` events into far fewer reloads.
 *
 * Leading-edge: the first change runs `fn` immediately, so a single save still
 * updates the UI instantly. Any further changes within `ms` are collapsed into
 * one trailing reload — which prevents the re-render storm that happens when a
 * sync replicates many documents at once.
 */
export function makeCoalescer(fn: () => void, ms = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  return {
    trigger() {
      if (timer) { pending = true; return; }
      fn();
      timer = setTimeout(() => {
        timer = undefined;
        if (pending) { pending = false; fn(); }
      }, ms);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = false;
    },
  };
}
