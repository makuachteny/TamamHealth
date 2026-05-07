import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, RefreshControl,
} from 'react-native';
import { Icon } from '@/components/icons';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import { useAuth } from '../lib/auth';
import Card from '../components/Card';
import Badge from '../components/Badge';
import * as api from '../lib/api';
import type { MedicalRecord, LabResult, Appointment, Prescription } from '../lib/types';

const QUICK_ACTIONS = [
  { key: 'records', icon: 'document-text', label: 'Records', color: '#3B82F6', route: '/(tabs)/records' },
  { key: 'labs', icon: 'flask', label: 'Lab Results', color: '#8B5CF6', route: '/(tabs)/labs' },
  { key: 'prescriptions', icon: 'medkit', label: 'Medications', color: '#EC4899', route: '/(tabs)/prescriptions' },
  { key: 'appointments', icon: 'calendar', label: 'Visits', color: colors.gold, route: '/(tabs)/appointments' },
  { key: 'billing', icon: 'wallet', label: 'Billing', color: colors.green, route: '/(tabs)/billing' },
  { key: 'messages', icon: 'chatbubbles', label: 'Messages', color: '#06B6D4', route: '/(tabs)/messages' },
];

export default function HomeScreen() {
  const { patient } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [meds, setMeds] = useState<Prescription[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const [r, l, a, m] = await Promise.all([
      api.getMedicalRecords(),
      api.getLabResults(),
      api.getAppointments(),
      api.getPrescriptions(),
    ]);
    setRecords(r);
    setLabs(l);
    setAppointments(a);
    setMeds(m);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const latest = records[0];
  const pendingLabs = labs.filter((l) => l.status !== 'completed');
  const activeMeds = meds.filter((m) => m.status === 'pending');
  const upcoming = appointments.filter(
    (a) => new Date(a.appointmentDate) >= new Date() && a.status !== 'cancelled'
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      {/* Welcome */}
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeLeft}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{patient?.firstName}</Text>
        </View>
        <View style={styles.welcomeIcon}>
          <Icon name="heart" size={24} color={colors.green} />
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBox value={records.length} label="Visits" color={colors.teal} bg="#EBF3F0" />
        <StatBox value={pendingLabs.length} label="Pending" color={colors.goldDark} bg="#FBF2E0" />
        <StatBox value={activeMeds.length} label="Active Rx" color="#EC4899" bg="#FDF2F8" />
        <StatBox value={upcoming.length} label="Upcoming" color={colors.green} bg="#E5F2EA" />
      </View>

      {/* Quick Actions */}
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.tile}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.tileIcon, { backgroundColor: item.color + '12' }]}>
              <Icon name={item.icon as any} size={22} color={item.color} />
            </View>
            <Text style={styles.tileLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Latest Vitals */}
      {latest?.vitalSigns && (
        <Card title="Latest Vitals">
          <View style={styles.vitalsGrid}>
            {latest.vitalSigns.temperature != null && <VitalChip label="Temp" value={`${latest.vitalSigns.temperature}°C`} icon="thermometer-outline" />}
            {latest.vitalSigns.pulse != null && <VitalChip label="Pulse" value={`${latest.vitalSigns.pulse} bpm`} icon="heart-outline" />}
            {latest.vitalSigns.bloodPressure && <VitalChip label="BP" value={latest.vitalSigns.bloodPressure} icon="fitness-outline" />}
            {latest.vitalSigns.oxygenSaturation != null && <VitalChip label="SpO₂" value={`${latest.vitalSigns.oxygenSaturation}%`} icon="water-outline" />}
            {latest.vitalSigns.weight != null && <VitalChip label="Weight" value={`${latest.vitalSigns.weight} kg`} icon="barbell-outline" />}
          </View>
        </Card>
      )}

      {/* Upcoming Appointments */}
      <Card title="Upcoming Appointments">
        {upcoming.length === 0 ? (
          <Text style={styles.empty}>No upcoming appointments</Text>
        ) : (
          upcoming.map((apt) => (
            <View key={apt._id} style={styles.listItem}>
              <View style={styles.aptDate}>
                <Text style={styles.aptDay}>{new Date(apt.appointmentDate).getDate()}</Text>
                <Text style={styles.aptMonth}>{new Date(apt.appointmentDate).toLocaleString('default', { month: 'short' })}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.listTitle}>{apt.appointmentType}</Text>
                <Text style={styles.listSub}>{apt.appointmentTime} — {apt.providerName}</Text>
              </View>
              <Badge label={apt.status} variant="info" />
            </View>
          ))
        )}
      </Card>

      {/* Recent Lab Results */}
      <Card title="Recent Lab Results">
        {labs.slice(0, 3).map((lab) => (
          <View key={lab._id} style={styles.listItem}>
            <View style={[styles.labDot, { backgroundColor: lab.status === 'completed' ? (lab.abnormal ? colors.red : colors.green) : colors.gold }]} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.listTitle}>{lab.testName}</Text>
              <Text style={styles.listSub}>
                {lab.status === 'completed' ? lab.result || 'See results' : 'Awaiting results'}
              </Text>
            </View>
            <Badge
              label={lab.critical ? 'CRITICAL' : lab.abnormal ? 'Abnormal' : lab.status === 'completed' ? 'Normal' : 'Pending'}
              variant={lab.critical ? 'danger' : lab.abnormal ? 'warning' : lab.status === 'completed' ? 'success' : 'default'}
            />
          </View>
        ))}
      </Card>

      {/* Health tip */}
      <View style={styles.tipCard}>
        <Icon name="bulb" size={18} color={colors.gold} />
        <Text style={styles.tipText}>
          Stay hydrated — aim for 2-3 litres of clean water daily in South Sudan's climate.
        </Text>
      </View>
    </ScrollView>
  );
}

function StatBox({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statNumber, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function VitalChip({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.vitalChip}>
      <Icon name={icon as any} size={14} color={colors.teal} />
      <View>
        <Text style={styles.vitalValue}>{value}</Text>
        <Text style={styles.vitalLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },

  welcomeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.cream200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  welcomeLeft: { flex: 1 },
  greeting: { fontSize: fontSize.sm, color: colors.textSecondary },
  name: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.navy },
  welcomeIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E5F2EA', alignItems: 'center', justifyContent: 'center',
  },

  statsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  statCard: { flex: 1, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tile: {
    width: '31%', backgroundColor: colors.white, borderRadius: radius.md,
    alignItems: 'center', paddingVertical: 14, borderWidth: 1, borderColor: colors.cream200,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileLabel: { fontSize: 10, fontWeight: '600', color: colors.textPrimary },

  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vitalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cream, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full,
  },
  vitalValue: { fontSize: 13, fontWeight: '700', color: colors.navy },
  vitalLabel: { fontSize: 9, color: colors.textTertiary },

  listItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.cream100,
  },
  listTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  listSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },

  aptDate: {
    width: 42, height: 46, borderRadius: 8, backgroundColor: '#EBF3F0',
    alignItems: 'center', justifyContent: 'center',
  },
  aptDay: { fontSize: 16, fontWeight: '800', color: colors.teal },
  aptMonth: { fontSize: 9, fontWeight: '600', color: colors.teal, textTransform: 'uppercase' },

  labDot: { width: 8, height: 8, borderRadius: 4 },

  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#FFFCF5', borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: '#F0E6CC',
  },
  tipText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 17 },

  empty: { fontSize: fontSize.sm, color: colors.textTertiary, fontStyle: 'italic', paddingVertical: spacing.sm },
});
