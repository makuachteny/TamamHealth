'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Max width of the dialog in px. Default 600. */
  width?: number;
  /** Vertical alignment of the dialog. Default 'center'. */
  align?: 'center' | 'top';
  /**
   * Layout variant. 'dialog' (default) is the centered popup; 'drawer' slides
   * in as a full-height panel anchored to the right edge of the screen.
   */
  variant?: 'dialog' | 'drawer';
  /** When true, clicking the backdrop does not close the modal. Default false. */
  disableBackdropClose?: boolean;
  /** id of the element labelling the dialog (for a11y). */
  labelledBy?: string;
}

/**
 * Centered, portal-rendered modal.
 *
 * Renders into <body> so its backdrop sits above the entire app — including the
 * sidebar — instead of being trapped inside the dashboard content area's
 * stacking context (which previously left the sidebar "popping" above the dim).
 * Use this for every popup so behaviour is consistent everywhere.
 *
 * Handles: Esc-to-close, backdrop-click-to-close, body scroll lock, focus,
 * and the shared fade/slide animations defined in globals.css.
 */
export default function Modal({
  onClose,
  children,
  width = 600,
  align = 'center',
  variant = 'dialog',
  disableBackdropClose = false,
  labelledBy,
}: ModalProps) {
  const isDrawer = variant === 'drawer';
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Portals require the DOM — only render after mount (also keeps SSR happy).
  useEffect(() => { setMounted(true); }, []);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Move focus into the dialog for keyboard users.
  useEffect(() => { if (mounted) dialogRef.current?.focus(); }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-portal-backdrop"
      onClick={disableBackdropClose ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: isDrawer ? 'stretch' : align === 'top' ? 'flex-start' : 'center',
        justifyContent: isDrawer ? 'flex-end' : 'center',
        padding: isDrawer ? 0 : 16,
        background: 'rgba(15, 31, 29, 0.70)',
        animation: 'modalFadeIn 0.2s ease-out',
        overflowY: isDrawer ? 'hidden' : 'auto',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: isDrawer ? '100vh' : 'calc(100vh - 32px)',
          height: isDrawer ? '100vh' : undefined,
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
          margin: isDrawer ? 0 : align === 'top' ? '24px 0' : 0,
          animation: isDrawer ? 'modalSlideInRight 0.28s ease-out' : 'modalSlideUp 0.25s ease-out',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
