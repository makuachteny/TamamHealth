'use client';

/**
 * A titled, collapsible block — the "Drug Info ⌃ / Pharmacy Info ⌃" chrome the
 * prescribing screen is built out of. Collapsing matters on a long form: the
 * prescriber fills the top and wants the footer actions in reach, not four
 * screens down.
 */

import type { ReactNode } from 'react';
import { ChevronDown } from '@/components/icons/lucide';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Right-aligned content in the header row (counts, small actions). */
  aside?: ReactNode;
}

export default function CollapsibleSection({
  title, open, onToggle, children, aside,
}: CollapsibleSectionProps) {
  return (
    <section className="cn-rx-block">
      <div className="cn-rx-blockhead">
        <button
          type="button"
          className="cn-rx-blocktoggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span>{title}</span>
          <ChevronDown size={15} className={open ? 'is-open' : undefined} aria-hidden />
        </button>
        {aside}
      </div>
      {open && <div className="cn-rx-blockbody">{children}</div>}
    </section>
  );
}
