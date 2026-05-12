/**
 * Static loading skeletons for data-heavy screens.
 *
 * No animation libraries — react-native-reanimated is installed but the
 * subtlety isn't worth the import surface. A flat shimmer-tone block reads
 * as "loading" without the perf cost of a 60fps loop.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { colors, spacing, radius } from '../lib/theme';

type LineProps = { width?: DimensionValue; height?: number; style?: ViewStyle };

export function SkeletonLine({ width = '100%', height = 12, style }: LineProps) {
  return (
    <View
      style={[
        styles.line,
        { width, height, borderRadius: height / 2 },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonLine width="60%" height={14} />
          <SkeletonLine width="40%" height={10} />
        </View>
      </View>
      <SkeletonLine height={10} style={{ marginTop: spacing.sm }} />
      <SkeletonLine width="80%" height={10} style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { backgroundColor: colors.cream200 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cream200,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cream200,
  },
});
