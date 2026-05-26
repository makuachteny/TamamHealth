'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Keyboard } from '@/components/icons/lucide';

const SHORTCUTS = [
  { keys: ['Alt', 'N'], altKeys: ['Ctrl', 'N'], description: 'New patient', action: '/patients/new' },
  { keys: ['Alt', 'S'], altKeys: ['/'], description: 'Focus search', action: 'focus-search' },
  { keys: ['Alt', 'D'], description: 'Go to Dashboard', action: '/dashboard' },
  { keys: ['Alt', 'P'], description: 'Go to Patients', action: '/patients' },
  { keys: ['Alt', 'R'], description: 'Go to Referrals', action: '/referrals' },
  { keys: ['Alt', 'M'], description: 'Go to Messages', action: '/messages' },
  { keys: ['?'], description: 'Show keyboard shortcuts', action: 'show-help' },
];

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const isInputFocused = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;

    // Allow ? and / only when not in an input
    if (isInputFocused) return;

    // ? → show help
    if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    // / → focus search
    if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[data-global-search]');
      if (searchInput) {
        searchInput.focus();
      }
      return;
    }

    // Alt+key or Ctrl+key shortcuts
    if (e.altKey || e.ctrlKey) {
      const key = e.key.toLowerCase();

      if (key === 'n') {
        e.preventDefault();
        router.push('/patients/new');
        return;
      }
      if (e.altKey && key === 's') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[data-global-search]');
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }
      if (e.altKey && key === 'd') {
        e.preventDefault();
        router.push('/dashboard');
        return;
      }
      if (e.altKey && key === 'p') {
        e.preventDefault();
        router.push('/patients');
        return;
      }
      if (e.altKey && key === 'r') {
        e.preventDefault();
        router.push('/referrals');
        return;
      }
      if (e.altKey && key === 'm') {
        e.preventDefault();
        router.push('/messages');
        return;
      }
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.6)' }}
      onClick={() => setShowHelp(false)}
    >
      <div
        className="w-full max-w-md mx-4 overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-panel)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--table-row-border)' }}
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Keyboard Shortcuts
            </span>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-5 py-3">
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: i < SHORTCUTS.length - 1 ? '1px solid var(--table-row-border)' : 'none' }}
            >
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1.5">
                {shortcut.keys.map((key, j) => (
                  <span key={j}>
                    <kbd
                      className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-mono font-medium"
                      style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)',
                        minWidth: '24px',
                      }}
                    >
                      {key}
                    </kbd>
                    {j < shortcut.keys.length - 1 && (
                      <span className="text-xs mx-0.5" style={{ color: 'var(--text-muted)' }}>+</span>
                    )}
                  </span>
                ))}
                {shortcut.altKeys && (
                  <>
                    <span className="text-xs mx-1" style={{ color: 'var(--text-muted)' }}>or</span>
                    {shortcut.altKeys.map((key, j) => (
                      <span key={j}>
                        <kbd
                          className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-mono font-medium"
                          style={{
                            background: 'var(--overlay-subtle)',
                            border: '1px solid var(--border-medium)',
                            color: 'var(--text-primary)',
                            minWidth: '24px',
                          }}
                        >
                          {key}
                        </kbd>
                        {j < (shortcut.altKeys?.length ?? 0) - 1 && (
                          <span className="text-xs mx-0.5" style={{ color: 'var(--text-muted)' }}>+</span>
                        )}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3" style={{ borderTop: '1px solid var(--table-row-border)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Press <kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-medium)' }}>?</kbd> to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  );
}
