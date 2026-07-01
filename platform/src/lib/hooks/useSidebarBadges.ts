'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { useDataScope } from './useDataScope';

export interface SidebarBadges {
  messages: number;
  referrals: number;
}

export function useSidebarBadges(): SidebarBadges {
  const { currentUser } = useApp();
  const scope = useDataScope();
  const [badges, setBadges] = useState<SidebarBadges>({ messages: 0, referrals: 0 });

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function load() {
      const [{ getAllMessages }, { getAllReferrals }] = await Promise.all([
        import('../services/message-service'),
        import('../services/referral-service'),
      ]);

      const [msgs, refs] = await Promise.all([
        getAllMessages(scope),
        getAllReferrals(scope),
      ]);

      if (cancelled) return;

      const unreadMessages = msgs.filter(m =>
        m.direction === 'patient_to_staff' &&
        !(m.readBy ?? []).includes(currentUser!._id)
      ).length;

      const pendingReferrals = refs.filter(r =>
        r.status === 'sent' || r.status === 'received'
      ).length;

      setBadges({ messages: unreadMessages, referrals: pendingReferrals });
    }

    load().catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser, scope]);

  return badges;
}
