'use client';

import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  /** Pushes everything after it to the right edge — pass <FilterBar.Spacer/> inline instead for finer control. */
  className?: string;
}

/**
 * The consistent shell every filter row lives in: an elevated card with even
 * padding, gap, and wrapping. Drop search inputs, <FilterSelect/>s and
 * <FilterTabs/> inside and they line up identically on every page.
 */
export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div
      className={`card-elevated flex items-center gap-2.5 flex-wrap ${className}`}
      style={{ padding: 12, marginBottom: 16 }}
    >
      {children}
    </div>
  );
}

/** Flexible gap that pushes subsequent controls to the right. */
function Spacer() {
  return <div className="flex-1 min-w-[8px]" aria-hidden />;
}

FilterBar.Spacer = Spacer;
