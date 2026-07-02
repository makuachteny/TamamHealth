'use client';

import type { NavItem } from '@/lib/permissions';

export default function EhrTopActions({
  items,
  navLabel,
  onOpenModule,
}: {
  items: NavItem[];
  navLabel: (item: NavItem) => string;
  onOpenModule: (href: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map(item => {
        const ItemIcon = item.icon;
        return (
          <button key={item.href} type="button" onClick={() => onOpenModule(item.href)} title={navLabel(item)}>
            <ItemIcon className="w-5 h-5" />
          </button>
        );
      })}
    </>
  );
}
