import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import * as api from '../lib/api';
import type { Prescription } from '../lib/types';

export default function PrescriptionsScreen() {
  const [meds, setMeds] = useState<Prescription[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => { setMeds(await api.getPrescriptions()); };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const active = meds.filter((m) => m.status === 'pending');
  const dispensed = meds.filter((m) => m.status === 'dispensed');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      <Text style={styles.heading}>Prescriptions</Text>
      <Text style={styles.sub}>{meds.length} medication{meds.length !== 1 ? 's' : ''} — {active.length} active</Text>

      {/* Active medications */}
      {active.length > 0 && (
        <>
          <View style={styles.activeHeader}>
            <Icon name="alert-circle" size={16} color={colors.gold} />
            <Text style={styles.activeText}>{active.length} active — take as directed</Text>
          </View>
          {active.map((m) => (
            <View key={m._id} style={[styles.card, styles.activeCard]}>
              <View style={styles.cardRow}>
                <View style={styles.rxIcon}>
                  <Text style={styles.rxText}>Rx</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{m.medication}</Text>
                  <View style={styles.dosageRow}>
                    <View style={styles.dosageChip}><Text style={styles.dosageText}>{m.dose}</Text></View>
                    <View style={styles.dosageChip}><Text style={styles.dosageText}>{m.route}</Text></View>
                    <View style={styles.dosageChip}><Text style={styles.dosageText}>{m.frequency}</Text></View>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="time-outline" size={11} color={colors.textTertiary} />
                    <Text style={styles.detailText}>Duration: {m.duration}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="person-outline" size={11} color={colors.textTertiary} />
                    <Text style={styles.detailText}>Prescribed by: {m.prescribedBy}</Text>
                  </View>
                </View>
                <Badge label="Active" variant="warning" />
              </View>
            </View>
          ))}
        </>
      )}

      {/* Dispensed medications */}
      {dispensed.length > 0 && (
        <Text style={styles.sectionTitle}>DISPENSED</Text>
      )}
      {dispensed.map((m) => (
        <View key={m._id} style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.rxIcon, { backgroundColor: '#E5F2EA' }]}>
              <Text style={[styles.rxText, { color: colors.green }]}>Rx</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.medName}>{m.medication}</Text>
              <View style={styles.dosageRow}>
                <View style={styles.dosageChip}><Text style={styles.dosageText}>{m.dose}</Text></View>
                <View style={styles.dosageChip}><Text style={styles.dosageText}>{m.frequency}</Text></View>
              </View>
              <View style={styles.detailRow}>
                <Icon name="checkmark-circle-outline" size={11} color={colors.green} />
                <Text style={styles.detailText}>
                  Dispensed: {m.dispensedAt ? new Date(m.dispensedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </Text>
              </View>
            </View>
            <Badge label="Dispensed" variant="success" />
          </View>
        </View>
      ))}

      {meds.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="medkit-outline" size={48} color={colors.cream300} />
          <Text style={styles.emptyTitle}>No prescriptions</Text>
          <Text style={styles.emptySub}>Medications prescribed by your doctor will appear here</Text>
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

  activeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: spacing.sm,
  },
  activeText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.goldDark },

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
  activeCard: { borderColor: '#F0E6CC', borderWidth: 1.5 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },

  rxIcon: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: '#FBF2E0',
    alignItems: 'center', justifyContent: 'center',
  },
  rxText: { fontSize: 14, fontWeight: '900', color: colors.goldDark },

  medName: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },

  dosageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  dosageChip: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  dosageText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  detailText: { fontSize: 11, color: colors.textTertiary },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md },
  emptySub: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' },
});
