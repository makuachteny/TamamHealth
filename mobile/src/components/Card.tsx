import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius } from '../lib/theme';

type Props = {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function Card({ title, children, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cream200,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.sm,
  },
});
