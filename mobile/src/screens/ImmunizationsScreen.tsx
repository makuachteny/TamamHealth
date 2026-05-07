import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import * as api from '../lib/api';
import type { Immunization } from '../lib/types';

export default function ImmunizationsScreen() {
  const [records, setRecords] = useState<Immunization[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => { setRecords(await api.getImmunizations()); };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const completed = records.filter((r) => r.status === 'completed');
  const upcoming = records.filter((r) => r.status !== 'completed');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Immunizations</Text>
          <Text style={styles.sub}>{completed.length} completed, {upcoming.length} upcoming</Text>
        </View>
        <View style={styles.shieldIcon}>
          <Icon name="shield-checkmark" size={24} color={colors.green} />
        </View>
      </View>

      {/* Progress summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.green }]}>{completed.length}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.gold }]}>{upcoming.length}</Text>
            <Text style={styles.summaryLabel}>Upcoming</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.teal }]}>{records.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Upcoming vaccines */}
      {upcoming.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>UPCOMING</Text>
          {upcoming.map((r) => (
            <VaccineCard key={r._id} record={r} />
          ))}
        </>
      )}

      {/* Completed vaccines */}
      {completed.length > 0 && (
        <Text style={styles.sectionTitle}>COMPLETED</Text>
      )}
      {completed.map((r) => (
        <VaccineCard key={r._id} record={r} />
      ))}

      {records.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="shield-checkmark-outline" size={48} color={colors.cream300} />
          <Text style={styles.emptyTitle}>No immunization records</Text>
          <Text style={styles.emptySub}>Your vaccination history will appear here</Text>
        </View>
      )}
    </ScrollView>
  );
}

function VaccineCard({ record }: { record: Immunization }) {
  const isCompleted = record.status === 'completed';

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.vaccineIcon, { backgroundColor: isCompleted ? '#E5F2EA' : '#FBF2E0' }]}>
          <Icon
            name={isCompleted ? 'checkmark-circle' : 'time-outline'}
            size={20}
            color={isCompleted ? colors.green : colors.gold}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vaccineName}>{record.vaccine}</Text>
          <Text style={styles.doseText}>Dose {record.doseNumber}</Text>

          <View style={styles.detailsRow}>
            {record.dateGiven && (
              <View style={styles.detailChip}>
                <Icon name="calendar-outline" size={10} color={colors.textTertiary} />
                <Text style={styles.detailText}>
                  {new Date(record.dateGiven).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            )}
            {record.site && (
              <View style={styles.detailChip}>
                <Icon name="body-outline" size={10} color={colors.textTertiary} />
                <Text style={styles.detailText}>{record.site}</Text>
              </View>
            )}
          </View>

          {record.nextDueDate && (
            <View style={styles.nextDue}>
              <Icon name="arrow-forward-circle-outline" size={12} color={colors.teal} />
              <Text style={styles.nextDueText}>
                Next dose: {new Date(record.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          )}
        </View>
        <Badge label={isCompleted ? 'Done' : record.status} variant={isCompleted ? 'success' : 'warning'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  shieldIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5F2EA',
    alignItems: 'center', justifyContent: 'center',
  },

  summaryCard: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cream200,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: '500', marginTop: 2 },
  summaryDivider: { width: 1, height: 30, backgroundColor: colors.cream200 },

  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textTertiary,
    letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.xs,
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
  vaccineIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  vaccineName: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  doseText: { fontSize: fontSize.xs, color: colors.textTertiary, fontWeight: '500', marginTop: 1 },

  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  detailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.cream, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full,
  },
  detailText: { fontSize: 10, color: colors.textTertiary },

  nextDue: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  nextDueText: { fontSize: 11, color: colors.teal, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md },
  emptySub: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' },
});
