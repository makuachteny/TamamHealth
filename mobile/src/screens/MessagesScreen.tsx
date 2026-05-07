import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform,
  TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import * as api from '../lib/api';
import type { Message } from '../lib/types';

const DEPARTMENTS = [
  { key: 'opd', label: 'General / OPD', icon: 'medical-outline' },
  { key: 'internal', label: 'Internal Medicine', icon: 'heart-outline' },
  { key: 'obs', label: 'Obstetrics & Gynaecology', icon: 'woman-outline' },
  { key: 'paeds', label: 'Paediatrics', icon: 'happy-outline' },
  { key: 'surgery', label: 'Surgery', icon: 'cut-outline' },
  { key: 'lab', label: 'Laboratory', icon: 'flask-outline' },
  { key: 'pharmacy', label: 'Pharmacy', icon: 'medkit-outline' },
  { key: 'dental', label: 'Dental', icon: 'happy-outline' },
  { key: 'emergency', label: 'Emergency', icon: 'alert-circle-outline' },
];

export default function MessagesScreen() {
  const { patient } = useAuth();
  const { newMessages, addMessage } = useStore();
  const [seedMessages, setSeedMessages] = useState<Message[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const load = async () => { setSeedMessages(await api.getMessages()); };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const allMessages = [...seedMessages, ...newMessages];

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
            <Text style={styles.heading}>Messages</Text>
            <Text style={styles.sub}>{allMessages.length} message{allMessages.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={styles.composeBtn} onPress={() => setShowCompose(true)} activeOpacity={0.7}>
            <Icon name="create-outline" size={16} color="#FFF" />
            <Text style={styles.composeBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {allMessages.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyCircle}>
              <Icon name="chatbubbles-outline" size={40} color={colors.cream300} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySub}>Start a conversation with your care team</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCompose(true)}>
              <Icon name="create-outline" size={16} color="#FFF" />
              <Text style={styles.emptyBtnText}>Send a Message</Text>
            </TouchableOpacity>
          </View>
        )}

        {allMessages.map((m) => {
          const isPatient = m.fromDoctorName === `${patient?.firstName} ${patient?.surname}`;
          return (
            <View key={m._id} style={[styles.card, isPatient && styles.patientCard]}>
              {/* Header */}
              <View style={styles.msgHeader}>
                <View style={[styles.avatar, isPatient && { backgroundColor: colors.gold }]}>
                  <Text style={[styles.avatarText, isPatient && { color: colors.navy }]}>
                    {isPatient ? 'You' : m.fromDoctorName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sender}>{isPatient ? 'You' : m.fromDoctorName}</Text>
                  <View style={styles.facilityRow}>
                    <Icon name="business-outline" size={10} color={colors.textTertiary} />
                    <Text style={styles.facility}>{m.fromHospitalName}</Text>
                  </View>
                </View>
                <Text style={styles.time}>
                  {new Date(m.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              {/* Subject */}
              <Text style={styles.subject}>{m.subject}</Text>

              {/* Body */}
              <Text style={styles.body}>{m.body}</Text>

              {/* Status */}
              <View style={styles.msgFooter}>
                <Icon
                  name={m.status === 'delivered' ? 'checkmark-done' : m.status === 'sent' ? 'checkmark' : 'time-outline'}
                  size={14}
                  color={m.status === 'delivered' ? colors.green : colors.textTertiary}
                />
                <Text style={styles.statusText}>
                  {m.status === 'delivered' ? 'Delivered' : m.status === 'sent' ? 'Sent' : 'Pending'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <ComposeModal
        visible={showCompose}
        onClose={() => setShowCompose(false)}
        onSend={(msg) => {
          addMessage(msg);
          setShowCompose(false);
          Alert.alert('Message Sent', 'Your message has been sent. A healthcare provider will respond shortly.');
        }}
        patient={patient}
      />
    </>
  );
}

// ---- Compose Modal ----

function ComposeModal({ visible, onClose, onSend, patient }: {
  visible: boolean;
  onClose: () => void;
  onSend: (msg: Message) => void;
  patient: { firstName: string; surname: string } | null;
}) {
  const [dept, setDept] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const reset = () => { setDept(''); setSubject(''); setBody(''); };

  const handleSend = () => {
    if (!dept) { Alert.alert('Select Department', 'Choose which department to message.'); return; }
    if (!subject.trim()) { Alert.alert('Subject Required', 'Enter a subject for your message.'); return; }
    if (!body.trim()) { Alert.alert('Message Required', 'Write your message.'); return; }

    const deptLabel = DEPARTMENTS.find((d) => d.key === dept)?.label || dept;
    const msg: Message = {
      _id: `msg-new-${Date.now()}`,
      patientId: 'pat-00001',
      fromDoctorName: `${patient?.firstName} ${patient?.surname}`,
      fromHospitalName: 'Juba Teaching Hospital',
      subject: `[${deptLabel}] ${subject.trim()}`,
      body: body.trim(),
      sentAt: new Date().toISOString(),
      status: 'sent',
    };
    onSend(msg);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={cm.container}>
        <View style={cm.header}>
          <TouchableOpacity onPress={() => { onClose(); reset(); }}>
            <Text style={cm.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={cm.headerTitle}>New Message</Text>
          <TouchableOpacity onPress={handleSend} disabled={!dept || !subject.trim() || !body.trim()}>
            <View style={[cm.sendBtn, (!dept || !subject.trim() || !body.trim()) && cm.sendDisabled]}>
              <Icon name="send" size={14} color="#FFF" />
              <Text style={cm.sendText}>Send</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={cm.body} showsVerticalScrollIndicator={false}>
          {/* Department picker */}
          <Text style={cm.label}>To: Department</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cm.deptScroll}>
            <View style={cm.deptRow}>
              {DEPARTMENTS.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[cm.deptChip, dept === d.key && cm.deptActive]}
                  onPress={() => setDept(d.key)}
                >
                  <Icon name={d.icon as any} size={14} color={dept === d.key ? '#FFF' : colors.textSecondary} />
                  <Text style={[cm.deptText, dept === d.key && cm.deptTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Facility (read only) */}
          <View style={cm.facilityRow}>
            <Icon name="business-outline" size={14} color={colors.textTertiary} />
            <Text style={cm.facilityText}>Juba Teaching Hospital</Text>
          </View>

          {/* Subject */}
          <Text style={cm.label}>Subject</Text>
          <TextInput
            style={cm.input}
            placeholder="e.g. Question about my medication"
            placeholderTextColor={colors.textTertiary}
            value={subject}
            onChangeText={setSubject}
          />

          {/* Quick subjects */}
          <View style={cm.quickRow}>
            {['Follow-up question', 'Prescription refill', 'Lab results inquiry', 'Appointment request'].map((s) => (
              <TouchableOpacity key={s} style={cm.quickChip} onPress={() => setSubject(s)}>
                <Text style={cm.quickText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Message body */}
          <Text style={cm.label}>Message</Text>
          <TextInput
            style={cm.textArea}
            placeholder="Write your message here..."
            placeholderTextColor={colors.textTertiary}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
          />

          <Text style={cm.hint}>
            A healthcare provider will respond within 24 hours during working days.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---- Styles ----

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  composeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.teal, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
  },
  composeBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.cream100, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md },
  emptySub: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: spacing.xs },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.teal, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.full, marginTop: spacing.lg,
  },
  emptyBtnText: { color: '#FFF', fontSize: fontSize.sm, fontWeight: '700' },

  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cream200,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 }, android: { elevation: 1 } }),
  },
  patientCard: { borderLeftWidth: 3, borderLeftColor: colors.gold },
  msgHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  sender: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  facilityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  facility: { fontSize: 10, color: colors.textTertiary },
  time: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  subject: { fontSize: fontSize.md, fontWeight: '700', color: colors.navy, marginBottom: spacing.xs },
  body: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 21 },
  msgFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cream100,
  },
  statusText: { fontSize: 10, color: colors.textTertiary, fontWeight: '500' },
});

const cm = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.cream200,
  },
  cancelText: { fontSize: fontSize.md, color: colors.textSecondary },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.teal, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  body: { flex: 1, padding: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm, marginTop: spacing.md },
  deptScroll: { marginBottom: spacing.sm },
  deptRow: { flexDirection: 'row', gap: spacing.xs },
  deptChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
  },
  deptActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  deptText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  deptTextActive: { color: '#FFF', fontWeight: '600' },
  facilityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cream100, padding: spacing.sm, borderRadius: radius.sm,
  },
  facilityText: { fontSize: fontSize.sm, color: colors.textSecondary },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.textPrimary,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  quickChip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  quickText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  textArea: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.textPrimary,
    height: 140,
  },
  hint: { fontSize: 11, color: colors.textTertiary, marginTop: spacing.sm, fontStyle: 'italic', textAlign: 'center' },
});
