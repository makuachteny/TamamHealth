/**
 * Prescriptions — real data from /api/patient-portal/prescriptions.
 *
 * Status pivots the layout: pending (active) lives at the top with a
 * highlighted card; dispensed history follows.
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform,
} from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import SyncBadge from '../components/SyncBadge';
import { SkeletonList } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { useCachedFetch } from '../lib/use-cached-fetch';
import type { Prescription } from '../lib/types';

type PrescriptionsResponse = { prescriptions: Prescription[] };

export default function PrescriptionsScreen() {
  const { patient } = useAuth();

  const cacheKey = patient ? `prescriptions.${patient.id}` : 'prescriptions.anon';
  const path = patient
    ? `/api/patient-portal/prescriptions?patientId=${encodeURIComponent(patient.id)}`
    : null;

  const { data, loading, refreshing, error, lastSyncedAt, isStale, refresh } =
    useCachedFetch<PrescriptionsResponse, Prescription[]>({
      cacheKey,
      path,
      select: (raw) => raw.prescriptions ?? [],
    });

  const { active, dispensed } = useMemo(() => {
    const all = data ?? [];
    return {
      active: all.filter((m) => m.status === 'pending'),
      dispensed: all.filter((m) => m.status === 'dispensed'),
    };
  }, [data]);

  const isInitialLoading = loading && data === null;
  const total = data?.length ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} />
      }
    >
      <Text style={styles.heading}>Prescriptions</Text>
      <Text style={styles.sub}>
        {total} medication{total !== 1 ? 's' : ''} — {active.length} active
      </Text>

      <SyncBadge lastSyncedAt={lastSyncedAt} isStale={isStale} />

      {error && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={16} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isInitialLoading && <SkeletonList count={3} />}

      {active.length > 0 && (
        <>
          <View style={styles.activeHeader}>
            <Icon name="alert-circle" size={16} color={colors.gold} />
            <Text style={styles.activeText}>
              {active.length} active — take as directed
            </Text>
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
                    {m.dose ? (
                      <View style={styles.dosageChip}>
                        <Text style={styles.dosageText}>{m.dose}</Text>
                      </View>
                    ) : null}
                    {m.route ? (
                      <View style={styles.dosageChip}>
                        <Text style={styles.dosageText}>{m.route}</Text>
                      </View>
                    ) : null}
                    {m.frequency ? (
                      <View style={styles.dosageChip}>
                        <Text style={styles.dosageText}>{m.frequency}</Text>
                      </View>
                    ) : null}
                  </View>
                  {m.duration ? (
                    <View style={styles.detailRow}>
                      <Icon name="time-outline" size={11} color={colors.textTertiary} />
                      <Text style={styles.detailText}>Duration: {m.duration}</Text>
                    </View>
                  ) : null}
                  {m.prescribedBy ? (
                    <View style={styles.detailRow}>
                      <Icon name="person-outline" size={11} color={colors.textTertiary} />
                      <Text style={styles.detailText}>Prescribed by: {m.prescribedBy}</Text>
                    </View>
                  ) : null}
                </View>
                <Badge label="Pending" variant="warning" />
              </View>
            </View>
          ))}
        </>
      )}

      {dispensed.length > 0 && <Text style={styles.sectionTitle}>DISPENSED</Text>}
      {dispensed.map((m) => (
        <View key={m._id} style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.rxIcon, { backgroundColor: '#E5F2EA' }]}>
              <Text style={[styles.rxText, { color: colors.green }]}>Rx</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.medName}>{m.medication}</Text>
              <View style={styles.dosageRow}>
                {m.dose ? (
                  <View style={styles.dosageChip}>
                    <Text style={styles.dosageText}>{m.dose}</Text>
                  </View>
                ) : null}
                {m.frequency ? (
                  <View style={styles.dosageChip}>
                    <Text style={styles.dosageText}>{m.frequency}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.detailRow}>
                <Icon name="checkmark-circle-outline" size={11} color={colors.green} />
                <Text style={styles.detailText}>
                  Dispensed:{' '}
                  {m.dispensedAt
                    ? new Date(m.dispensedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '—'}
                </Text>
              </View>
            </View>
            <Badge label="Dispensed" variant="success" />
          </View>
        </View>
      ))}

      {!isInitialLoading && total === 0 && !error && (
        <View style={styles.emptyState}>
          <Icon name="medkit-outline" size={48} color={colors.cream300} />
          <Text style={styles.emptyTitle}>No prescriptions</Text>
          <Text style={styles.emptySub}>
            Medications prescribed by your doctor will appear here
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.redLight,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  errorText: { fontSize: fontSize.sm, color: colors.red, flex: 1 },

  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  activeText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.goldDark },

  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cream200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  activeCard: { borderColor: '#F0E6CC', borderWidth: 1.5 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },

  rxIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FBF2E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxText: { fontSize: 14, fontWeight: '900', color: colors.goldDark },

  medName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },

  dosageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  dosageChip: {
    backgroundColor: colors.cream,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  dosageText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  detailText: { fontSize: 11, color: colors.textTertiary },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySub: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
