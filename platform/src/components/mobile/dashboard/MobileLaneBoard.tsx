'use client';

import type { ReactNode } from 'react';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import type { MobileLane } from '@/lib/mobile-shell/dashboard-strategy';

interface MobileLaneBoardProps<T> {
  lanes: MobileLane<T>[];
  activeLane: string;
  onLaneChange: (key: string) => void;
  renderItem: (item: T) => ReactNode;
  emptyLabel?: string;
}

export default function MobileLaneBoard<T>({ lanes, activeLane, onLaneChange, renderItem, emptyLabel }: MobileLaneBoardProps<T>) {
  const current = lanes.find((l) => l.key === activeLane) || lanes[0];

  return (
    <div className="mobile-lane-board">
      <div className="mobile-lane-tabs">
        {lanes.map((lane) => (
          <button
            key={lane.key}
            type="button"
            className={`mobile-lane-tab ${lane.key === current?.key ? 'active' : ''}`}
            onClick={() => onLaneChange(lane.key)}
          >
            <Badge tone={lane.key === current?.key ? lane.tone : 'neutral'} size="sm">
              {lane.label}
            </Badge>
          </button>
        ))}
      </div>
      <div className="mobile-lane-items">
        {current && current.items.length > 0 ? (
          current.items.map((item, i) => <div key={i}>{renderItem(item)}</div>)
        ) : (
          <EmptyState title={emptyLabel || 'Nothing in this lane'} message="Pick another lane or check back later." />
        )}
      </div>
    </div>
  );
}
