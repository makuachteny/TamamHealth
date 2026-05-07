import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform,
  TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import Badge from '../components/Badge';
import { useStore } from '../lib/store';
import * as api from '../lib/api';
import type { Appointment } from '../lib/types';

const DEPARTMENTS = ['General / OPD', 'Internal Medicine', 'Obstetrics & Gynaecology', 'Paediatrics', 'Surgery', 'Laboratory', 'Pharmacy', 'Dental', 'Eye Clinic', 'Nutrition'];
const TYPES = ['Consultation', 'Follow-up', 'Lab Work', 'Check-up', 'Vaccination', 'Specialist Referral'];
const TIME_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'];

const STATUS_MAP: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  confirmed: { variant: 'info', label: 'Confirmed' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  pending: { variant: 'warning', label: 'Pending' },
};

export default function AppointmentsScreen() {
  const [seedApts, setSeedApts] = useState<Appointment[]>([]);
  const { newAppointments, addAppointment } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showBooking, setShowBooking] = useState(false);

  const load = async () => { setSeedApts(await api.getAppointments()); };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const allApts = [...newAppointments, ...seedApts];
  const now = new Date();
  const upcoming = allApts.filter((a) => new Date(a.appointmentDate) >= now && a.status !== 'cancelled');
  const past = allApts.filter((a) => new Date(a.appointmentDate) < now || a.status === 'cancelled');

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Appointments</Text>
            <Text style={styles.sub}>{upcoming.length} upcoming</Text>
          </View>
          <TouchableOpacity style={styles.bookBtn} onPress={() => setShowBooking(true)} activeOpacity={0.7}>
            <Icon name="add" size={18} color="#FFF" />
            <Text style={styles.bookBtnText}>Book</Text>
          </TouchableOpacity>
        </View>

        {upcoming.length > 0 && <Text style={styles.sectionTitle}>UPCOMING</Text>}
        {upcoming.map((a) => <AptCard key={a._id} apt={a} />)}

        {upcoming.length === 0 && (
          <View style={styles.emptyCard}>
            <Icon name="calendar-outline" size={36} color={colors.cream300} />
            <Text style={styles.emptyText}>No upcoming appointments</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowBooking(true)}>
              <Text style={styles.emptyBtnText}>Book an Appointment</Text>
            </TouchableOpacity>
          </View>
        )}

        {past.length > 0 && <Text style={styles.sectionTitle}>PAST</Text>}
        {past.map((a) => <AptCard key={a._id} apt={a} isPast />)}
      </ScrollView>

      <BookingModal
        visible={showBooking}
        onClose={() => setShowBooking(false)}
        onBook={(apt) => { addAppointment(apt); setShowBooking(false); Alert.alert('Booked', 'Your appointment has been requested. You will receive a confirmation.'); }}
      />
    </>
  );
}

// ---- Booking Modal ----

function BookingModal({ visible, onClose, onBook }: { visible: boolean; onClose: () => void; onBook: (apt: Appointment) => void }) {
  const [dept, setDept] = useState('');
  const [type, setType] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState(1);

  const reset = () => { setDept(''); setType(''); setDate(''); setTime(''); setReason(''); setStep(1); };

  const handleSubmit = () => {
    if (!dept || !type || !date || !time) {
      Alert.alert('Missing Fields', 'Please complete all required fields.');
      return;
    }
    const apt: Appointment = {
      _id: `apt-new-${Date.now()}`,
      patientId: 'pat-00001',
      appointmentDate: date,
      appointmentTime: time,
      appointmentType: type,
      reason: reason || type,
      status: 'pending',
      providerName: '',
      facilityName: 'Juba Teaching Hospital',
      department: dept,
      duration: 30,
    };
    onBook(apt);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={bk.container}>
        <View style={bk.header}>
          <TouchableOpacity onPress={() => { onClose(); reset(); }}>
            <Icon name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={bk.headerTitle}>Book Appointment</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={bk.body} showsVerticalScrollIndicator={false}>
          {/* Step indicator */}
          <View style={bk.steps}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={[bk.stepDot, step >= s && bk.stepDotActive]} />
            ))}
          </View>

          {step === 1 && (
            <>
              <Text style={bk.label}>Department</Text>
              <View style={bk.chipGrid}>
                {DEPARTMENTS.map((d) => (
                  <TouchableOpacity key={d} style={[bk.chip, dept === d && bk.chipActive]} onPress={() => setDept(d)}>
                    <Text style={[bk.chipText, dept === d && bk.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={bk.label}>Appointment Type</Text>
              <View style={bk.chipGrid}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[bk.chip, type === t && bk.chipActive]} onPress={() => setType(t)}>
                    <Text style={[bk.chipText, type === t && bk.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[bk.nextBtn, (!dept || !type) && bk.btnDisabled]} onPress={() => { if (dept && type) setStep(2); }} disabled={!dept || !type}>
                <Text style={bk.nextBtnText}>Next</Text>
                <Icon name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={bk.label}>Date (YYYY-MM-DD)</Text>
              <TextInput style={bk.input} placeholder="e.g. 2026-05-01" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />

              <Text style={bk.label}>Time</Text>
              <View style={bk.chipGrid}>
                {TIME_SLOTS.map((t) => (
                  <TouchableOpacity key={t} style={[bk.timeChip, time === t && bk.chipActive]} onPress={() => setTime(t)}>
                    <Text style={[bk.chipText, time === t && bk.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={bk.navRow}>
                <TouchableOpacity style={bk.backBtn} onPress={() => setStep(1)}>
                  <Icon name="arrow-back" size={16} color={colors.textSecondary} />
                  <Text style={bk.backBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[bk.nextBtn, { flex: 1 }, (!date || !time) && bk.btnDisabled]} onPress={() => { if (date && time) setStep(3); }} disabled={!date || !time}>
                  <Text style={bk.nextBtnText}>Next</Text>
                  <Icon name="arrow-forward" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={bk.label}>Reason (optional)</Text>
              <TextInput style={[bk.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Describe your symptoms or reason for visit..." value={reason} onChangeText={setReason} multiline />

              {/* Summary */}
              <View style={bk.summary}>
                <Text style={bk.summaryTitle}>Appointment Summary</Text>
                <SummaryRow icon="business-outline" label="Department" value={dept} />
                <SummaryRow icon="medical-outline" label="Type" value={type} />
                <SummaryRow icon="calendar-outline" label="Date" value={date} />
                <SummaryRow icon="time-outline" label="Time" value={time} />
                <SummaryRow icon="location-outline" label="Facility" value="Juba Teaching Hospital" />
              </View>

              <View style={bk.navRow}>
                <TouchableOpacity style={bk.backBtn} onPress={() => setStep(2)}>
                  <Icon name="arrow-back" size={16} color={colors.textSecondary} />
                  <Text style={bk.backBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[bk.submitBtn, { flex: 1 }]} onPress={handleSubmit}>
                  <Icon name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={bk.submitBtnText}>Confirm Booking</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={bk.summaryRow}>
      <Icon name={icon as any} size={14} color={colors.textTertiary} />
      <Text style={bk.summaryLabel}>{label}</Text>
      <Text style={bk.summaryValue}>{value}</Text>
    </View>
  );
}

// ---- Appointment Card (reused) ----

function AptCard({ apt, isPast }: { apt: Appointment; isPast?: boolean }) {
  const d = new Date(apt.appointmentDate);
  const status = STATUS_MAP[apt.status] || { variant: 'default' as const, label: apt.status };
  return (
    <View style={[styles.card, isPast && styles.pastCard]}>
      <View style={styles.cardRow}>
        <View style={[styles.dateBox, isPast && { backgroundColor: colors.cream200 }]}>
          <Text style={[styles.dateDay, isPast && { color: colors.textTertiary }]}>{d.getDate()}</Text>
          <Text style={[styles.dateMonth, isPast && { color: colors.textTertiary }]}>
            {d.toLocaleString('default', { month: 'short' })}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aptType, isPast && { color: colors.textSecondary }]}>{apt.appointmentType}</Text>
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
        <Badge label={status.label} variant={status.variant} />
      </View>
    </View>
  );
}

// ---- Styles ----

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.green, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
  },
  bookBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textTertiary, letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.xs },
  emptyCard: {
    alignItems: 'center', paddingVertical: 40, backgroundColor: colors.white,
    borderRadius: radius.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cream200,
  },
  emptyText: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.sm },
  emptyBtn: { marginTop: spacing.md, backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.full },
  emptyBtnText: { color: '#FFF', fontSize: fontSize.sm, fontWeight: '700' },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.cream200,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 }, android: { elevation: 1 } }),
  },
  pastCard: { opacity: 0.6 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dateBox: { width: 46, height: 50, borderRadius: 10, backgroundColor: '#EBF3F0', alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, fontWeight: '800', color: colors.teal },
  dateMonth: { fontSize: 9, fontWeight: '700', color: colors.teal, textTransform: 'uppercase' },
  aptType: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  aptReason: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: colors.textTertiary },
});

const bk = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.cream200,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  body: { flex: 1, padding: spacing.md },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.lg },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cream300 },
  stepDotActive: { backgroundColor: colors.green, width: 24 },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm, marginTop: spacing.md },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  timeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
  },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.textPrimary,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.green, paddingVertical: 14, borderRadius: radius.md, marginTop: spacing.xl,
  },
  nextBtnText: { color: '#FFF', fontSize: fontSize.md, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  navRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.cream300,
  },
  backBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.green, paddingVertical: 14, borderRadius: radius.md,
  },
  submitBtnText: { color: '#FFF', fontSize: fontSize.md, fontWeight: '700' },
  summary: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    marginTop: spacing.md, borderWidth: 1, borderColor: colors.cream200,
  },
  summaryTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textTertiary, width: 90 },
  summaryValue: { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
});
