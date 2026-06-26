'use client';

import {
  DuotoneMoon as Moon,
  DuotoneSun as Sun,
  DuotoneMenu as Menu,
} from '@/components/icons';
import type { ReactNode } from 'react';
import QuickActions from '@/components/QuickActions';
import GlobalSearchBar from '@/components/GlobalSearchBar';
import { useApp } from '@/lib/context';
import { useTranslation } from '@/lib/i18n/useTranslation';

// `hideSearch` suppresses the platform-wide search bar that normally sits just
// below the header (e.g. on full-screen flows that supply their own search).
// `searchTrailing` renders a compact control (e.g. a filter icon) directly
// beside the search input, distinct from `actions` which sit at the row's end.
export default function TopBar({ title, hideSearch, actions, searchTrailing, splitActions }: { title?: string; hideSearch?: boolean; actions?: ReactNode; searchTrailing?: ReactNode; splitActions?: boolean }) {
  const { t } = useTranslation();
  const { currentUser, theme, toggleTheme, setSidebarOpen } = useApp();

  // Shared icon-button style
  const iconBtn = "w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative";

  return (
    <>
    <header
      className="h-[52px] flex items-center justify-between px-4 sm:px-6 z-30 flex-shrink-0"
      style={{
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        // Connected top bar: spans flush from the sidebar's right edge to the
        // browser edge, joined by a single bottom divider (no float / rounding).
        borderBottom: '1px solid var(--glass-border)',
        borderRadius: 0,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger menu - visible on mobile/tablet */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label={t('topbar.openNavMenu')}
          className={`lg:hidden ${iconBtn} -ml-1`}
          style={{ background: 'var(--overlay-subtle)' }}
        >
          <Menu className="w-6 h-6" color="var(--text-muted)" />
        </button>

        {/* Page title — fills the space the header search used to occupy. The
            search itself now lives in the platform-wide bar below this header. */}
        {title && (
          <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Quick actions: announcements / notification centre */}
        <QuickActions />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'light' ? t('topbar.switchToDark') : t('topbar.switchToLight')}
          className={iconBtn}
          style={{ background: 'transparent' }}
        >
          {theme === 'light' ? (
            <Moon className="w-[18px] h-[18px]" color="var(--text-muted)" />
          ) : (
            <Sun className="w-[18px] h-[18px]" color="var(--text-muted)" />
          )}
        </button>

        {/* User avatar */}
        {currentUser && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{
            background: 'var(--accent-primary)',
          }}>
            {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        )}
      </div>
    </header>

    {/* Platform-wide search bar — sits directly below the header, above each
        page's greeting/title block. Single search entry point for the app. */}
    {!hideSearch && <GlobalSearchBar actions={actions} searchTrailing={searchTrailing} splitActions={splitActions} />}
    </>
  );
}
