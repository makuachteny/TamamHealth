import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Platform,
} from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import * as api from '../lib/api';
import type { MedicalRecord } from '../lib/types';

export default function RecordsScreen() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => { setRecords(await api.getMedicalRecords()); };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Medical Records</Text>
          <Text style={styles.sub}>{records.length} visit{records.length !== 1 ? 's' : ''} on file</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{records.length}</Text>
        </View>
      </View>

      {records.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="document-text-outline" size={48} color={colors.cream300} />
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptySub}>Your medical visit history will appear here</Text>
        </View>
      )}

      {records.map((r) => (
        <TouchableOpacity
          key={r._id}
          onPress={() => setExpanded(expanded === r._id ? null : r._id)}
          activeOpacity={0.7}
          style={styles.card}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.visitIcon}>
              <Icon
                name={r.visitType?.includes('Follow') ? 'refresh' : r.visitType?.includes('Annual') ? 'shield-checkmark' : 'medical'}
                size={18}
                color={colors.teal}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{r.chiefComplaint || r.visitType || 'Visit'}</Text>
              <Text style={styles.cardDate}>
                {new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <Icon name={expanded === r._id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.cream300} />
          </View>

          {/* Facility + Doctor */}
          <View style={styles.metaRow}>
            {r.facilityName && (
              <View style={styles.metaChip}>
                <Icon name="business-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.metaText}>{r.facilityName}</Text>
              </View>
            )}
            {r.consultedByName && (
              <View style={styles.metaChip}>
                <Icon name="person-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.metaText}>{r.consultedByName}</Text>
              </View>
            )}
          </View>

          {/* Diagnoses */}
          {r.diagnoses?.length > 0 && (
            <View style={styles.diagRow}>
              {r.diagnoses.map((d, i) => (
                <Badge key={i} label={d.name} variant={d.severity === 'moderate' ? 'warning' : 'info'} />
              ))}
            </View>
          )}

          {/* Expanded vitals */}
          {expanded === r._id && r.vitalSigns && (
            <View style={styles.vitalsSection}>
              <Text style={styles.vitalsTitle}>Vital Signs</Text>
              <View style={styles.vitalsGrid}>
                {r.vitalSigns.temperature != null && <Vital label="Temperature" value={`${r.vitalSigns.temperature}°C`} icon="thermometer-outline" warn={r.vitalSigns.temperature > 37.5} />}
                {r.vitalSigns.pulse != null && <Vital label="Heart Rate" value={`${r.vitalSigns.pulse} bpm`} icon="heart-outline" warn={r.vitalSigns.pulse > 100} />}
                {r.vitalSigns.bloodPressure && <Vital label="Blood Pressure" value={r.vitalSigns.bloodPressure} icon="fitness-outline" />}
                {r.vitalSigns.respiratoryRate != null && <Vital label="Respiratory Rate" value={`${r.vitalSigns.respiratoryRate} /min`} icon="cloud-outline" />}
                {r.vitalSigns.oxygenSaturation != null && <Vital label="Oxygen Sat." value={`${r.vitalSigns.oxygenSaturation}%`} icon="water-outline" warn={r.vitalSigns.oxygenSaturation < 95} />}
                {r.vitalSigns.weight != null && <Vital label="Weight" value={`${r.vitalSigns.weight} kg`} icon="barbell-outline" />}
              </View>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Vital({ label, value, icon, warn }: { label: string; value: string; icon: string; warn?: boolean }) {
  return (
    <View style={styles.vitalItem}>
      <Icon name={icon as any} size={14} color={warn ? colors.red : colors.teal} />
      <Text style={[styles.vitalValue, warn && { color: colors.red }]}>{value}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  countBadge: { backgroundColor: colors.teal, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md },
  emptySub: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs },

  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.cream200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visitIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EBF3F0', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  cardDate: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  metaText: { fontSize: 10, color: colors.textTertiary, fontWeight: '500' },

  diagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },

  vitalsSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cream100 },
  vitalsTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  vitalItem: { alignItems: 'center', width: '30%', paddingVertical: spacing.sm },
  vitalValue: { fontSize: 14, fontWeight: '700', color: colors.navy, marginTop: 4 },
  vitalLabel: { fontSize: 9, color: colors.textTertiary, marginTop: 2 },
});
