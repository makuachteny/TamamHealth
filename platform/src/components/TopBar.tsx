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
export default function TopBar({
  title,
  titleIcon,
  hideSearch,
  actions,
  searchTrailing,
  splitActions,
}: {
  title?: string;
  titleIcon?: ReactNode;
  hideSearch?: boolean;
  actions?: ReactNode;
  searchTrailing?: ReactNode;
  splitActions?: boolean;
}) {
  const { t } = useTranslation();
  const { currentUser, theme, toggleTheme, setSidebarOpen } = useApp();

  return (
    <>
    <header
      className="h-[52px] flex items-center justify-between px-4 sm:px-6 z-30 flex-shrink-0"
      style={{
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        borderRadius: 14,
        margin: '10px 10px 0 10px',
        boxShadow: 'var(--panel-shadow), var(--glass-highlight)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger menu - visible on mobile/tablet */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label={t('topbar.openNavMenu')}
          className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center transition-colors relative -ml-1"
          style={{ background: 'var(--overlay-subtle)' }}
        >
          <Menu className="w-6 h-6" color="var(--text-muted)" />
        </button>

        {/* Page title — fills the space the header search used to occupy. The
            search itself now lives in the platform-wide bar below this header. */}
        {title && (
          <div className="flex items-center gap-2 min-w-0">
            {titleIcon}
            <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h1>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Quick actions: announcements / notification centre */}
        <QuickActions />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'light' ? t('topbar.switchToDark') : t('topbar.switchToLight')}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          style={{ background: 'transparent', border: '1.5px solid var(--border-medium)' }}
        >
          {theme === 'light' ? (
            <Moon className="w-[20px] h-[20px]" color="var(--text-primary)" />
          ) : (
            <Sun className="w-[20px] h-[20px]" color="var(--text-primary)" />
          )}
        </button>

        {/* User pill */}
        {currentUser && (
          <div
            className="flex items-center gap-2.5 pl-1 pr-4 h-10 rounded-full flex-shrink-0"
            style={{ border: '1.5px solid var(--border-medium)', background: 'transparent' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: '#015697' }}
            >
              {currentUser.name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[13px] font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>
              {currentUser.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </span>
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
