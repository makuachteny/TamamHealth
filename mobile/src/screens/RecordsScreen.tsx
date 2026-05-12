/**
 * Medical Records — real data from /api/patient-portal/records.
 *
 * Visits are grouped by `createdAt` date so the patient sees a chronological
 * history. Tap a card to reveal diagnoses, the prescriber, the hospital,
 * and (when available) the captured vital signs.
 *
 * PHI is fetched on focus and held in component state only. Cache writes go
 * through `expo-secure-store` via `useCachedFetch` -> `cacheSet`.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Platform,
} from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import SyncBadge from '../components/SyncBadge';
import { SkeletonList } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { useCachedFetch } from '../lib/use-cached-fetch';
import type { MedicalRecord } from '../lib/types';

type RecordsResponse = { records: MedicalRecord[] };

/** Stable date key (YYYY-MM-DD) so two visits on the same day group together. */
function dateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function RecordsScreen() {
  const { patient } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const cacheKey = patient ? `records.${patient.id}` : 'records.anon';
  const path = patient ? `/api/patient-portal/records?patientId=${encodeURIComponent(patient.id)}` : null;

  const { data, loading, refreshing, error, lastSyncedAt, isStale, refresh } =
    useCachedFetch<RecordsResponse, MedicalRecord[]>({
      cacheKey,
      path,
      select: (raw) => raw.records ?? [],
    });

  // Group by ISO date, then sort groups newest-first.
  const groups = useMemo(() => {
    const map = new Map<string, MedicalRecord[]>();
    for (const r of data ?? []) {
      const k = dateKey(r.createdAt);
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, recs]) => ({ key: k, label: formatDateHeading(recs[0].createdAt), records: recs }));
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Medical Records</Text>
          <Text style={styles.sub}>
            {total} visit{total !== 1 ? 's' : ''} on file
          </Text>
        </View>
        {total > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{total}</Text>
          </View>
        )}
      </View>

      <SyncBadge lastSyncedAt={lastSyncedAt} isStale={isStale} />

      {error && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={16} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isInitialLoading && <SkeletonList count={3} />}

      {!isInitialLoading && total === 0 && !error && (
        <View style={styles.emptyState}>
          <Icon name="document-text-outline" size={48} color={colors.cream300} />
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptySub}>Your medical visit history will appear here</Text>
        </View>
      )}

      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.groupHeading}>{group.label}</Text>
          {group.records.map((r) => (
            <RecordCard
              key={r._id}
              record={r}
              expanded={expanded === r._id}
              onToggle={() => setExpanded(expanded === r._id ? null : r._id)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function RecordCard({
  record,
  expanded,
  onToggle,
}: {
  record: MedicalRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onToggle} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.visitIcon}>
          <Icon
            name={
              record.visitType?.includes('Follow')
                ? 'refresh'
                : record.visitType?.includes('Annual')
                  ? 'shield-checkmark'
                  : 'medical'
            }
            size={18}
            color={colors.teal}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {record.chiefComplaint || record.visitType || 'Visit'}
          </Text>
          <Text style={styles.cardDate}>{record.visitType || 'Consultation'}</Text>
        </View>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.cream300}
        />
      </View>

      {record.diagnoses?.length > 0 && (
        <View style={styles.diagRow}>
          {record.diagnoses.map((d, i) => (
            <Badge
              key={`${record._id}-dx-${i}`}
              label={d.name}
              variant={d.severity === 'moderate' ? 'warning' : 'info'}
            />
          ))}
        </View>
      )}

      {expanded && (
        <View style={styles.expanded}>
          <DetailRow label="Diagnoses">
            {record.diagnoses?.length ? (
              record.diagnoses.map((d, i) => (
                <Text key={i} style={styles.diagItem}>
                  {d.name}
                  {d.icd11Code ? <Text style={styles.icd}> ({d.icd11Code})</Text> : null}
                </Text>
              ))
            ) : (
              <Text style={styles.detailValue}>—</Text>
            )}
          </DetailRow>
          <DetailRow label="Prescriber">
            <Text style={styles.detailValue}>{record.consultedByName || '—'}</Text>
          </DetailRow>
          <DetailRow label="Hospital">
            <Text style={styles.detailValue}>{record.facilityName || '—'}</Text>
          </DetailRow>

          {record.vitalSigns && (
            <View style={styles.vitalsSection}>
              <Text style={styles.vitalsTitle}>Vital Signs</Text>
              <View style={styles.vitalsGrid}>
                {record.vitalSigns.temperature != null && (
                  <Vital
                    label="Temperature"
                    value={`${record.vitalSigns.temperature}°C`}
                    icon="thermometer-outline"
                    warn={record.vitalSigns.temperature > 37.5}
                  />
                )}
                {record.vitalSigns.pulse != null && (
                  <Vital
                    label="Heart Rate"
                    value={`${record.vitalSigns.pulse} bpm`}
                    icon="heart-outline"
                    warn={record.vitalSigns.pulse > 100}
                  />
                )}
                {record.vitalSigns.bloodPressure && (
                  <Vital
                    label="Blood Pressure"
                    value={record.vitalSigns.bloodPressure}
                    icon="fitness-outline"
                  />
                )}
                {record.vitalSigns.respiratoryRate != null && (
                  <Vital
                    label="Respiratory"
                    value={`${record.vitalSigns.respiratoryRate} /min`}
                    icon="cloud-outline"
                  />
                )}
                {record.vitalSigns.oxygenSaturation != null && (
                  <Vital
                    label="SpO₂"
                    value={`${record.vitalSigns.oxygenSaturation}%`}
                    icon="water-outline"
                    warn={record.vitalSigns.oxygenSaturation < 95}
                  />
                )}
                {record.vitalSigns.weight != null && (
                  <Vital
                    label="Weight"
                    value={`${record.vitalSigns.weight} kg`}
                    icon="barbell-outline"
                  />
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Vital({
  label,
  value,
  icon,
  warn,
}: {
  label: string;
  value: string;
  icon: string;
  warn?: boolean;
}) {
  return (
    <View style={styles.vitalItem}>
      <Icon name={icon as React.ComponentProps<typeof Icon>['name']} size={14} color={warn ? colors.red : colors.teal} />
      <Text style={[styles.vitalValue, warn && { color: colors.red }]}>{value}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  countBadge: {
    backgroundColor: colors.teal,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

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

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySub: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs },

  group: { marginBottom: spacing.md },
  groupHeading: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF3F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  cardDate: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },

  diagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  diagItem: { fontSize: fontSize.sm, color: colors.textPrimary, marginBottom: 2 },
  icd: { fontSize: fontSize.xs, color: colors.textTertiary, fontWeight: '500' },

  expanded: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cream100,
    gap: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
  detailLabel: {
    width: 90,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  detailValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },

  vitalsSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cream100,
  },
  vitalsTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vitalItem: { alignItems: 'center', width: '30%', paddingVertical: spacing.sm },
  vitalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 4,
  },
  vitalLabel: { fontSize: 9, color: colors.textTertiary, marginTop: 2 },
});
