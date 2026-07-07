'use client';

import { useRouter } from 'next/navigation';
import type { MobileOutstandingItem } from '@/lib/mobile-shell/dashboard-strategy';

interface MobileOutstandingListProps {
  items: MobileOutstandingItem[];
}

export default function MobileOutstandingList({ items }: MobileOutstandingListProps) {
  const router = useRouter();

  return (
    <div className="mobile-outstanding-card">
      <h3 className="mobile-outstanding-title">Outstanding items</h3>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="mobile-outstanding-row"
          onClick={() => item.href && router.push(item.href)}
        >
          <span>{item.label}</span>
          <b className={item.count > 0 ? 'mobile-outstanding-count-alert' : ''}>{item.count}</b>
        </button>
      ))}
    </div>
  );
}
