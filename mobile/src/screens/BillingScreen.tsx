import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform,
  TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import { useCachedFetch } from '../lib/use-cached-fetch';
import SyncBadge from '../components/SyncBadge';
import type { BillingSummary, Payment } from '../lib/types';

function ssp(amount: number) { return `SSP ${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`; }

const PAYMENT_METHODS = [
  { key: 'mpesa', label: 'M-Pesa', icon: 'phone-portrait-outline', color: '#4CAF50' },
  { key: 'airtel', label: 'Airtel Money', icon: 'phone-portrait-outline', color: '#E53935' },
  { key: 'cash', label: 'Cash', icon: 'cash-outline', color: colors.gold },
  { key: 'card', label: 'Card', icon: 'card-outline', color: '#3B82F6' },
  { key: 'bank', label: 'Bank Transfer', icon: 'business-outline', color: colors.teal },
];

export default function BillingScreen() {
  const { patient } = useAuth();
  const { newPayments, addPayment } = useStore();
  const [showPayment, setShowPayment] = useState(false);

  // Real billing summary from the platform. Cache namespace is per-patient
  // (sign-out clears it via clearAllCachedPhi), so the previous person on
  // this device can't see the next person's ledger.
  const cacheKey = patient ? `billing.${patient.id}` : 'billing.anon';
  const path = patient
    ? `/api/patient-portal/billing?patientId=${encodeURIComponent(patient.id)}`
    : null;

  const { data, refreshing, error, lastSyncedAt, isStale, refresh } =
    useCachedFetch<BillingSummary, BillingSummary>({
      cacheKey,
      path,
      select: (raw) => raw,
    });

  const allPayments = [...newPayments, ...(data?.payments || [])];
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
  const totalBilled = data?.summary?.totalBilled || 0;
  const outstanding = totalBilled - totalPaid;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} />}
      >
        <Text style={styles.heading}>Billing & Payments</Text>

        <SyncBadge lastSyncedAt={lastSyncedAt} isStale={isStale} />

        {error && (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle" size={16} color={colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Balance banner */}
        <View style={styles.balanceBanner}>
          <View style={styles.balanceTop}>
            <Icon name="wallet" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={styles.balanceLabel}>Outstanding Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>{ssp(Math.max(0, outstanding))}</Text>
          {outstanding > 0 && (
            <TouchableOpacity style={styles.payNowBtn} onPress={() => setShowPayment(true)} activeOpacity={0.8}>
              <Icon name="card-outline" size={16} color={colors.navy} />
              <Text style={styles.payNowText}>Pay Now</Text>
            </TouchableOpacity>
          )}
          {outstanding <= 0 && (
            <View style={styles.paidBadge}>
              <Icon name="checkmark-circle" size={14} color={colors.green} />
              <Text style={styles.paidText}>All paid</Text>
            </View>
          )}
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <KPI label="Billed" value={ssp(totalBilled)} color={colors.navy} icon="receipt-outline" />
          <KPI label="Paid" value={ssp(totalPaid)} color={colors.green} icon="checkmark-circle-outline" />
          <KPI label="Due" value={ssp(Math.max(0, outstanding))} color={outstanding > 0 ? colors.red : colors.green} icon="time-outline" />
        </View>

        {/* Charges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CHARGES</Text>
          </View>
          {data?.charges?.map((c) => (
            <View key={c._id} style={styles.lineItem}>
              <View style={styles.lineLeft}>
                <View style={[styles.lineDot, { backgroundColor: c.status === 'approved' ? colors.green : colors.gold }]} />
                <View>
                  <Text style={styles.lineDesc}>{c.description}</Text>
                  <Text style={styles.lineDate}>{new Date(c.serviceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
              </View>
              <Text style={styles.lineAmount}>{ssp(c.billedAmount)}</Text>
            </View>
          ))}
        </View>

        {/* Payments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PAYMENTS</Text>
          </View>
          {allPayments.length === 0 && <Text style={styles.emptyText}>No payments yet</Text>}
          {allPayments.map((p) => (
            <View key={p._id} style={styles.lineItem}>
              <View style={styles.lineLeft}>
                <View style={styles.payIcon}>
                  <Icon
                    name={p.method.includes('Pesa') ? 'phone-portrait-outline' : p.method === 'Cash' ? 'cash-outline' : 'card-outline'}
                    size={14} color={colors.green}
                  />
                </View>
                <View>
                  <Text style={styles.lineDesc}>{p.method}</Text>
                  <Text style={styles.lineDate}>
                    {new Date(p.processedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {p.reference ? ` — ${p.reference}` : ''}
                  </Text>
                </View>
              </View>
              <Text style={[styles.lineAmount, { color: colors.green }]}>-{ssp(p.amount)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <PaymentModal
        visible={showPayment}
        outstanding={outstanding}
        onClose={() => setShowPayment(false)}
        onPay={(pay) => { addPayment(pay); setShowPayment(false); Alert.alert('Payment Submitted', `Your ${pay.method} payment of ${ssp(pay.amount)} has been submitted.`); }}
      />
    </>
  );
}

// ---- Payment Modal ----

function PaymentModal({ visible, outstanding, onClose, onPay }: {
  visible: boolean; outstanding: number; onClose: () => void; onPay: (p: Payment) => void;
}) {
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [phoneNum, setPhoneNum] = useState('');

  const reset = () => { setMethod(''); setAmount(''); setPhoneNum(''); };

  const handleSubmit = () => {
    const num = parseFloat(amount);
    if (!method) { Alert.alert('Select Method', 'Choose a payment method.'); return; }
    if (!num || num <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    if ((method === 'mpesa' || method === 'airtel') && !phoneNum.trim()) {
      Alert.alert('Phone Required', 'Enter your mobile money phone number.'); return;
    }

    const methodLabel = PAYMENT_METHODS.find((m) => m.key === method)?.label || method;
    const pay: Payment = {
      _id: `pay-new-${Date.now()}`,
      amount: num,
      method: methodLabel,
      status: 'posted',
      processedAt: new Date().toISOString(),
      reference: method === 'mpesa' || method === 'airtel' ? `MM-${Date.now().toString(36).toUpperCase()}` : undefined,
    };
    onPay(pay);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={pm.container}>
        <View style={pm.header}>
          <TouchableOpacity onPress={() => { onClose(); reset(); }}>
            <Icon name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={pm.headerTitle}>Make Payment</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={pm.body} showsVerticalScrollIndicator={false}>
          {/* Outstanding */}
          <View style={pm.outstandingBox}>
            <Text style={pm.outstandingLabel}>Amount Due</Text>
            <Text style={pm.outstandingValue}>{ssp(outstanding)}</Text>
          </View>

          {/* Amount input */}
          <Text style={pm.label}>Payment Amount (SSP)</Text>
          <TextInput
            style={pm.input}
            placeholder={outstanding.toString()}
            placeholderTextColor={colors.textTertiary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          {/* Quick amounts */}
          <View style={pm.quickRow}>
            {[outstanding, Math.round(outstanding / 2), 1000, 5000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4).map((v) => (
              <TouchableOpacity key={v} style={pm.quickChip} onPress={() => setAmount(v.toString())}>
                <Text style={pm.quickText}>{ssp(v)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment method */}
          <Text style={pm.label}>Payment Method</Text>
          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[pm.methodCard, method === m.key && pm.methodActive]}
              onPress={() => setMethod(m.key)}
              activeOpacity={0.6}
            >
              <View style={[pm.methodIcon, { backgroundColor: m.color + '15' }]}>
                <Icon name={m.icon as any} size={20} color={m.color} />
              </View>
              <Text style={pm.methodLabel}>{m.label}</Text>
              <View style={[pm.radio, method === m.key && pm.radioActive]}>
                {method === m.key && <View style={pm.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}

          {/* Phone for mobile money */}
          {(method === 'mpesa' || method === 'airtel') && (
            <>
              <Text style={pm.label}>Mobile Money Number</Text>
              <TextInput
                style={pm.input}
                placeholder="e.g. 0912345678"
                placeholderTextColor={colors.textTertiary}
                value={phoneNum}
                onChangeText={setPhoneNum}
                keyboardType="phone-pad"
              />
              <Text style={pm.hint}>You will receive a payment prompt on this number</Text>
            </>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[pm.submitBtn, (!method || !amount) && pm.btnDisabled]}
            onPress={handleSubmit}
            disabled={!method || !amount}
          >
            <Icon name="checkmark-circle" size={18} color="#FFF" />
            <Text style={pm.submitText}>
              {amount ? `Pay ${ssp(parseFloat(amount) || 0)}` : 'Pay'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function KPI({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={styles.kpiCard}>
      <Icon name={icon as any} size={16} color={color} />
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ---- Styles ----

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },
  heading: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy, marginBottom: spacing.md },
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
  balanceBanner: {
    backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md,
    ...Platform.select({ ios: { shadowColor: colors.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }, android: { elevation: 6 } }),
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  balanceLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.6)' },
  balanceAmount: { fontSize: 36, fontWeight: '900', color: colors.gold, letterSpacing: -1 },
  payNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm,
    backgroundColor: colors.gold, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.full,
  },
  payNowText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  paidText: { fontSize: 13, color: colors.green, fontWeight: '600' },
  kpiRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.cream200, gap: 2 },
  kpiValue: { fontSize: 13, fontWeight: '800' },
  kpiLabel: { fontSize: 9, color: colors.textTertiary, fontWeight: '500' },
  section: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cream200 },
  sectionHeader: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.8 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.cream100 },
  lineLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  lineDot: { width: 6, height: 6, borderRadius: 3 },
  lineDesc: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  lineDate: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  lineAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.navy },
  payIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#E5F2EA', alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: fontSize.sm, color: colors.textTertiary, fontStyle: 'italic', paddingVertical: 8 },
});

const pm = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.cream200,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  body: { flex: 1, padding: spacing.md },
  outstandingBox: {
    backgroundColor: colors.navy, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg,
  },
  outstandingLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  outstandingValue: { fontSize: 28, fontWeight: '800', color: colors.gold },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm, marginTop: spacing.md },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary,
  },
  quickRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  quickChip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  quickText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.cream300,
    borderRadius: radius.md, padding: 12, marginBottom: spacing.xs,
  },
  methodActive: { borderColor: colors.green, backgroundColor: '#F0FBF7' },
  methodIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.cream300, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  hint: { fontSize: 11, color: colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: radius.md, marginTop: spacing.xl, marginBottom: spacing.xxl,
  },
  submitText: { color: '#FFF', fontSize: fontSize.lg, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});
