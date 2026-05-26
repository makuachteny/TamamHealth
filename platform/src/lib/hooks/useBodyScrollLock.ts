import { useEffect } from 'react';

/**
 * Lock body scroll while a modal/overlay is open.
 *
 * When `isOpen` is true we set `document.body.style.overflow = 'hidden'` so
 * mouse-wheel / touch scroll falls through to the modal instead of the page
 * underneath. On close we reset to `''` (the empty string — NOT `'auto'`)
 * which restores whatever value the stylesheet originally specified instead
 * of forcing `auto` on top of any global rules.
 *
 * Call once per modal, keyed on the modal's open state. Multiple concurrent
 * modals just stack: the cleanup of the last-mounted one wins, which is the
 * correct behavior because closing the topmost modal returns the user to a
 * page where the next-down modal (if any) is still rendering and will keep
 * its own lock active.
 */
export function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      // Reset to '' rather than 'auto' so we don't override any value the
      // page stylesheet set originally. If `previous` was non-empty, restore
      // it exactly so we don't clobber a parent overlay's own lock.
      document.body.style.overflow = previous || '';
    };
  }, [isOpen]);
}
