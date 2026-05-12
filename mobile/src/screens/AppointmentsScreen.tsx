/**
 * Appointments — real data from /api/patient-portal/appointments.
 *
 * Read-only against clinical data. Tapping a row expands an inline detail
 * panel; no booking from this view (booking lives on the staff side until
 * the patient-initiated booking endpoint ships).
 *
 * Data flow:
 *   useFocusEffect -> apiFetch (server-wins) -> cache write-through.
 *   On network failure, falls back to `cacheGet`.
 *   Component state only — never persists PHI to plain AsyncStorage.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform, TouchableOpacity,
} from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import SyncBadge from '../components/SyncBadge';
import { SkeletonList } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { useCachedFetch } from '../lib/use-cached-fetch';
import type { Appointment } from '../lib/types';

const STATUS_MAP: Record<
  string,
  { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }
> = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  confirmed: { variant: 'info', label: 'Confirmed' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  pending: { variant: 'warning', label: 'Pending' },
};

type AppointmentsResponse = { appointments: Appointment[] };

export default function AppointmentsScreen() {
  const { patient } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cacheKey = patient ? `appointments.${patient.id}` : 'appointments.anon';
  const path = patient ? `/api/patient-portal/appointments?patientId=${encodeURIComponent(patient.id)}` : null;

  const { data, loading, refreshing, error, lastSyncedAt, isStale, refresh } =
    useCachedFetch<AppointmentsResponse, Appointment[]>({
      cacheKey,
      path,
      select: (raw) => raw.appointments ?? [],
    });

  const { upcoming, past } = useMemo(() => {
    const all = data ?? [];
    const now = new Date();
    return {
      upcoming: all.filter((a) => new Date(a.appointmentDate) >= now && a.status !== 'cancelled'),
      past: all.filter((a) => new Date(a.appointmentDate) < now || a.status === 'cancelled'),
    };
  }, [data]);

  const isInitialLoading = loading && data === null;

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
          <Text style={styles.heading}>Appointments</Text>
          <Text style={styles.sub}>{upcoming.length} upcoming</Text>
        </View>
      </View>

      <SyncBadge lastSyncedAt={lastSyncedAt} isStale={isStale} />

      {error && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={16} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isInitialLoading ? (
        <SkeletonList count={3} />
      ) : (
        <>
          {upcoming.length > 0 && <Text style={styles.sectionTitle}>UPCOMING</Text>}
          {upcoming.map((a) => (
            <AptCard
              key={a._id}
              apt={a}
              expanded={expandedId === a._id}
              onToggle={() => setExpandedId(expandedId === a._id ? null : a._id)}
            />
          ))}

          {upcoming.length === 0 && !error && (
            <View style={styles.emptyCard}>
              <Icon name="calendar-outline" size={36} color={colors.cream300} />
              <Text style={styles.emptyText}>No upcoming appointments</Text>
              <Text style={styles.emptySub}>
                When your care team schedules a visit, you&apos;ll see it here.
              </Text>
            </View>
          )}

          {past.length > 0 && <Text style={styles.sectionTitle}>PAST</Text>}
          {past.map((a) => (
            <AptCard
              key={a._id}
              apt={a}
              isPast
              expanded={expandedId === a._id}
              onToggle={() => setExpandedId(expandedId === a._id ? null : a._id)}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function AptCard({
  apt,
  isPast,
  expanded,
  onToggle,
}: {
  apt: Appointment;
  isPast?: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const d = new Date(apt.appointmentDate);
  const status = STATUS_MAP[apt.status] || { variant: 'default' as const, label: apt.status };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggle}
      style={[styles.card, isPast && styles.pastCard]}
    >
      <View style={styles.cardRow}>
        <View style={[styles.dateBox, isPast && { backgroundColor: colors.cream200 }]}>
          <Text style={[styles.dateDay, isPast && { color: colors.textTertiary }]}>{d.getDate()}</Text>
          <Text style={[styles.dateMonth, isPast && { color: colors.textTertiary }]}>
            {d.toLocaleString('default', { month: 'short' })}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aptType, isPast && { color: colors.textSecondary }]}>
            {apt.appointmentType}
          </Text>
          <Text style={styles.aptReason}>{apt.reason}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Icon name="time-outline" size={11} color={colors.textTertiary} />
              <Text style={styles.metaText}>{apt.appointmentTime}</Text>
            </View>
            {apt.department && (
              <View style={styles.metaItem}>
                <Icon name="business-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.metaText}>{apt.department}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.rightCol}>
          <Badge label={status.label} variant={status.variant} />
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.cream300}
            style={{ marginTop: 6 }}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.detailPanel}>
          <DetailRow label="Provider" value={apt.providerName || '—'} />
          <DetailRow label="Facility" value={apt.facilityName || '—'} />
          <DetailRow label="Department" value={apt.department || '—'} />
          <DetailRow label="Duration" value={apt.duration ? `${apt.duration} min` : '—'} />
          <DetailRow
            label="Date"
            value={`${d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${apt.appointmentTime}`}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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

  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

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

  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cream200,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptySub: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
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
  pastCard: { opacity: 0.7 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rightCol: { alignItems: 'flex-end' },
  dateBox: {
    width: 46,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#EBF3F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 18, fontWeight: '800', color: colors.teal },
  dateMonth: { fontSize: 9, fontWeight: '700', color: colors.teal, textTransform: 'uppercase' },
  aptType: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  aptReason: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: colors.textTertiary },

  detailPanel: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cream100,
    gap: 6,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
  detailLabel: {
    width: 90,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  detailValue: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
});
