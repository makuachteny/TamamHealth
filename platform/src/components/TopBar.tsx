'use client';

import type { ReactNode } from 'react';
import GlobalSearchBar from '@/components/GlobalSearchBar';

// `hideSearch` suppresses the platform-wide search bar that normally sits just
// below the title (e.g. on full-screen flows that supply their own search).
// `searchTrailing` renders a compact control (e.g. a filter icon) directly
// beside the search input, distinct from `actions` which sit at the row's end.
//
// This used to be a second floating chrome bar (its own glass panel, avatar
// pill, theme toggle, notifications) stacked directly under EhrTopRail — the
// platform's one true top bar, which already carries the avatar/role menu,
// notifications, and theme toggle. That duplication read as a "double
// header." TopBar is now just the page title, laid out inline in the content
// flow, plus the optional search/actions row underneath.
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
  return (
    <>
      {title && (
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0" style={{ margin: '10px 10px 0 10px' }}>
          {titleIcon}
          <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        </div>
      )}

      {/* Platform-wide search bar — sits directly below the title, above each
          page's greeting/title block. Single search entry point for the app. */}
      {!hideSearch && <GlobalSearchBar actions={actions} searchTrailing={searchTrailing} splitActions={splitActions} />}
    </>
  );
}
