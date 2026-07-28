'use client';

import type { NavItem } from '@/lib/permissions';

export default function EhrTopActions({
  items,
  navLabel,
  onOpenModule,
  badges,
}: {
  items: NavItem[];
  navLabel: (item: NavItem) => string;
  onOpenModule: (href: string) => void;
  /** href → count of open work in that module. Omitted hrefs show no badge. */
  badges?: Record<string, number>;
}) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map(item => {
        const ItemIcon = item.icon;
        const label = navLabel(item);
        const count = badges?.[item.href] ?? 0;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => onOpenModule(item.href)}
            title={count > 0 ? `${label} · ${count} waiting` : label}
            aria-label={count > 0 ? `${label}, ${count} waiting` : label}
            className="relative"
          >
            <ItemIcon className="w-5 h-5" />
            {count > 0 && (
              <span className="ehr-top-action-badge">{count > 99 ? '99+' : count}</span>
            )}
          </button>
        );
      })}
    </>
  );
}
