import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import * as api from '../lib/api';
import type { LabResult } from '../lib/types';

export default function LabsScreen() {
  const [results, setResults] = useState<LabResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => { setResults(await api.getLabResults()); };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const pending = results.filter((r) => r.status !== 'completed');
  const completed = results.filter((r) => r.status === 'completed');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      <Text style={styles.heading}>Lab Results</Text>
      <Text style={styles.sub}>{results.length} test{results.length !== 1 ? 's' : ''} — {pending.length} pending</Text>

      {/* Pending banner */}
      {pending.length > 0 && (
        <View style={styles.pendingBanner}>
          <Icon name="hourglass-outline" size={18} color={colors.goldDark} />
          <Text style={styles.pendingText}>{pending.length} result{pending.length !== 1 ? 's' : ''} pending</Text>
        </View>
      )}

      {/* Pending results */}
      {pending.map((r) => (
        <View key={r._id} style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.gold }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.testName}>{r.testName}</Text>
              <View style={styles.detailRow}>
                <Icon name="eyedrop-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.detailText}>Specimen: {r.specimen}</Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="time-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.detailText}>Ordered: {new Date(r.orderedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </View>
            </View>
            <Badge label={r.status === 'in_progress' ? 'Processing' : 'Pending'} variant="warning" />
          </View>
        </View>
      ))}

      {/* Completed results */}
      {completed.length > 0 && (
        <Text style={styles.sectionTitle}>COMPLETED</Text>
      )}
      {completed.map((r) => (
        <View key={r._id} style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.statusDot, { backgroundColor: r.abnormal ? colors.red : colors.green }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.testName}>{r.testName}</Text>
              {/* Result value — highlighted */}
              <View style={styles.resultBox}>
                <Text style={[styles.resultValue, r.abnormal && { color: colors.red }]}>
                  {r.result}
                </Text>
                {r.unit ? <Text style={styles.resultUnit}>{r.unit}</Text> : null}
              </View>
              {/* Reference range */}
              {r.referenceRange ? (
                <View style={styles.detailRow}>
                  <Icon name="analytics-outline" size={11} color={colors.textTertiary} />
                  <Text style={styles.detailText}>Reference: {r.referenceRange}</Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Icon name="checkmark-circle-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.detailText}>
                  Completed: {new Date(r.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>
            <Badge
              label={r.critical ? 'CRITICAL' : r.abnormal ? 'Abnormal' : 'Normal'}
              variant={r.critical ? 'danger' : r.abnormal ? 'warning' : 'success'}
            />
          </View>
        </View>
      ))}

      {results.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="flask-outline" size={48} color={colors.cream300} />
          <Text style={styles.emptyTitle}>No lab results</Text>
          <Text style={styles.emptySub}>Lab results ordered by your doctor will appear here</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#FBF2E0', borderRadius: radius.sm, padding: spacing.sm,
    marginBottom: spacing.md, borderWidth: 1, borderColor: '#F0E6CC',
  },
  pendingText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.goldDark },

  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textTertiary,
    letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.cream200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  testName: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },

  resultBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4, marginBottom: 2 },
  resultValue: { fontSize: 16, fontWeight: '800', color: colors.green },
  resultUnit: { fontSize: fontSize.xs, color: colors.textTertiary },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  detailText: { fontSize: 11, color: colors.textTertiary },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md },
  emptySub: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' },
});
