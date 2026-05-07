import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSize } from '../lib/theme';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default';

const variantColors: Record<Variant, { bg: string; text: string }> = {
  success: { bg: '#E5F2EA', text: colors.green },
  warning: { bg: '#FBF2E0', text: colors.goldDark },
  danger: { bg: colors.redLight, text: colors.red },
  info: { bg: '#EBF3F0', text: colors.teal },
  default: { bg: colors.cream200, text: colors.textSecondary },
};

export default function Badge({ label, variant = 'default' }: { label: string; variant?: Variant }) {
  const c = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fontSize.xs, fontWeight: '600' },
});
