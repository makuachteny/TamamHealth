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
  hideSearchInput,
  actions,
  titleActions,
  searchTrailing,
  splitActions,
}: {
  title?: string;
  titleIcon?: ReactNode;
  hideSearch?: boolean;
  /** Keep the actions/filter row but drop the search input (page already has
   *  the platform header search — avoids a duplicate search box). */
  hideSearchInput?: boolean;
  actions?: ReactNode;
  /** Actions rendered inline on the title row (right-aligned). Use with
   *  `hideSearch` for a clean "title + primary action" header, no search row. */
  titleActions?: ReactNode;
  searchTrailing?: ReactNode;
  splitActions?: boolean;
}) {
  // Title + search row on one line: when there's a title and a search row to
  // show it, GlobalSearchBar renders the title as the row's leading item
  // instead of TopBar stacking it in a row of its own above.
  if (title && !hideSearch && !titleActions) {
    return (
      <GlobalSearchBar
        title={title}
        titleIcon={titleIcon}
        actions={actions}
        searchTrailing={searchTrailing}
        splitActions={splitActions}
        hideInput={hideSearchInput}
      />
    );
  }

  return (
    <>
      {(title || titleActions) && (
        <div className="flex items-center gap-2 min-w-0" style={{ margin: '10px 10px 0 10px' }}>
          {titleIcon}
          {title && (
            <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h1>
          )}
          {titleActions && (
            <div className="ml-auto flex-shrink-0 flex items-center gap-2">
              {titleActions}
            </div>
          )}
        </div>
      )}

      {/* Platform-wide search bar — sits directly below the title, above each
          page's greeting/title block. Single search entry point for the app. */}
      {!hideSearch && <GlobalSearchBar actions={actions} searchTrailing={searchTrailing} splitActions={splitActions} hideInput={hideSearchInput} />}
    </>
  );
}
