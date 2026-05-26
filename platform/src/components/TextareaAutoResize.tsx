'use client';

import { useEffect } from 'react';

/**
 * Global textarea auto-resize: listens for input events on all textareas
 * and adjusts their height to fit content. Also allows manual resize via drag.
 * This is a fallback for browsers that don't support CSS `field-sizing: content`.
 */
export default function TextareaAutoResize() {
  useEffect(() => {
    function handleInput(e: Event) {
      const target = e.target;
      if (target instanceof HTMLTextAreaElement) {
        // Skip if the textarea explicitly opts out
        if (target.dataset.noAutoresize) return;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
      }
    }

    document.addEventListener('input', handleInput, { passive: true });
    return () => document.removeEventListener('input', handleInput);
  }, []);

  return null;
}
