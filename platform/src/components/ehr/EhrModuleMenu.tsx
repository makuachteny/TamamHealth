'use client';

import type { NavItem } from '@/lib/permissions';

export default function EhrModuleMenu({
  groups,
  roleLabel,
  pathname,
  navLabel,
  onOpenModule,
}: {
  groups: { section: string | null; items: NavItem[] }[];
  roleLabel: string;
  pathname: string | null;
  navLabel: (item: NavItem) => string;
  onOpenModule: (href: string) => void;
}) {
  return (
    <div className="ehr-module-menu" role="menu">
      <div className="ehr-module-menu-head">
        <strong>Tamam modules</strong>
        <span>{roleLabel}</span>
      </div>
      <div className="ehr-module-menu-scroll">
        {groups.map((group, groupIndex) => (
          <section key={`${group.section || 'main'}-${groupIndex}`}>
            {group.section && <p>{group.section}</p>}
            {group.items.map(item => {
              const ItemIcon = item.icon;
              const active = !!item.href && (pathname === item.href || pathname?.startsWith(item.href + '/'));
              return (
                <button
                  key={item.href || item.label}
                  type="button"
                  role="menuitem"
                  className={active ? 'active' : ''}
                  onClick={() => onOpenModule(item.href)}
                >
                  <ItemIcon className="w-4 h-4" color="currentColor" />
                  <span>{navLabel(item)}</span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

