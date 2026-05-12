/**
 * Tiny "Last synced…" pill shown on data screens when the rendered payload
 * came from the offline cache rather than a live server response.
 *
 * Mirrors the platform's offline-indicator language so the patient app and
 * staff portal feel consistent.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, radius, fontSize } from '../lib/theme';

type Props = {
  /** Millis since epoch. Null hides the badge. */
  lastSyncedAt: number | null;
  /** True if the data is from cache (renders the "offline" tone). */
  isStale: boolean;
};

function formatRelative(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}d ago`;
}

export default function SyncBadge({ lastSyncedAt, isStale }: Props) {
  if (lastSyncedAt == null) return null;
  const tone = isStale ? styles.stale : styles.fresh;
  const label = isStale
    ? `Offline — last synced ${formatRelative(lastSyncedAt)}`
    : `Synced ${formatRelative(lastSyncedAt)}`;

  return (
    <View style={[styles.pill, tone]}>
      <Icon
        name={isStale ? 'cloud-offline-outline' : 'cloud-done-outline'}
        size={11}
        color={isStale ? colors.goldDark : colors.teal}
      />
      <Text style={[styles.text, isStale ? styles.staleText : styles.freshText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  fresh: { backgroundColor: '#EBF3F0' },
  stale: { backgroundColor: '#FBF2E0' },
  text: { fontSize: fontSize.xs, fontWeight: '600' },
  freshText: { color: colors.teal },
  staleText: { color: colors.goldDark },
});
