'use client';

import type { ReactNode } from 'react';

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
  void hideSearch;
  void splitActions;
  if (!actions && !searchTrailing) return null;

  return (
    <div className="tamam-page-action-strip">
      {title && (
        <div className="tamam-page-action-title">
          {titleIcon}
          <span>{title}</span>
        </div>
      )}
      <div className="tamam-page-action-controls">
        {searchTrailing && (
          <div className="tamam-page-action-search-trailing">
            {searchTrailing}
          </div>
        )}
        {actions && (
          <div className="tamam-page-action-main">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
