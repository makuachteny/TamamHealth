'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context';
import { getRoleConfig } from '@/lib/permissions';
import { uniqueAllowedNavItems, getPrimaryShortcutItems } from '@/components/ehr/ehr-navigation';
import MobileBottomSheet from '../MobileBottomSheet';

interface MobileQuickCreateSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileQuickCreateSheet({ open, onClose }: MobileQuickCreateSheetProps) {
  const { currentUser } = useApp();
  const router = useRouter();
  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : undefined;
  const allowedRoutes = useMemo(() => roleConfig?.allowedRoutes || [], [roleConfig]);
  const navItems = useMemo(
    () => uniqueAllowedNavItems(roleConfig?.navItems || [], allowedRoutes),
    [roleConfig, allowedRoutes]
  );
  const shortcuts = useMemo(() => getPrimaryShortcutItems(navItems, 4), [navItems]);

  return (
    <MobileBottomSheet open={open} onClose={onClose} title="Quick create">
      <div className="mobile-sheet-grid">
        {shortcuts.map((item) => {
          const ItemIcon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              className="mobile-sheet-grid-item"
              onClick={() => {
                onClose();
                router.push(item.href);
              }}
            >
              <span className="mobile-sheet-grid-icon"><ItemIcon className="w-4 h-4" /></span>
              <span>
                <b>{item.label}</b>
              </span>
            </button>
          );
        })}
      </div>
    </MobileBottomSheet>
  );
}
