/**
 * Patient login screen.
 *
 * Authenticates the user against /api/patient-portal/login on the platform.
 * Two lookup modes are exposed: hospital number + phone, or
 * first/last name + DOB + phone. Either resolves to the same JWT.
 *
 * Demo accounts are rendered only when EXPO_PUBLIC_DEMO_MODE !== 'false'
 * so production builds can ship without the seed-data hint.
 *
 * TODO (v2): wire `expo-local-authentication` for biometric unlock once
 * the package is added to mobile/package.json. The scaffold is in
 * `triggerBiometricUnlock` below.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { colors, spacing, radius, fontSize } from '../lib/theme';
import { useAuth } from '../lib/auth';
import TamamHealthLogo from '../components/TamamHealthLogo';

const DEMO_MODE_ENABLED = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

const DEMO_ACCOUNTS = [
  { id: 'JTH-000001', phone: '0912345678', name: 'Deng Mabior Garang' },
  { id: 'JTH-000002', phone: '0916111222', name: 'Nyabol Gatdet Koang' },
  { id: 'JTH-000003', phone: '0921333444', name: 'Achol Mayen Deng' },
];

/**
 * Stub for biometric unlock. Returns true if biometric auth succeeded.
 * Currently a no-op because expo-local-authentication is not installed —
 * see TODO at top of file.
 */
async function triggerBiometricUnlock(): Promise<boolean> {
  // Intentionally false: feature gated until the package lands.
  return false;
}

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const [tab, setTab] = useState<'id' | 'name'>('id');
  const [hospitalNumber, setHospitalNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || isLoading;

  const handleLogin = async () => {
    const phoneClean = phone.trim();
    if (!phoneClean) {
      Alert.alert('Required', 'Please enter your phone number.');
      return;
    }

    if (tab === 'id') {
      if (!hospitalNumber.trim()) {
        Alert.alert('Required', 'Please enter your Hospital ID.');
        return;
      }
    } else {
      if (!firstName.trim() || !surname.trim() || !dateOfBirth.trim()) {
        Alert.alert('Required', 'Please fill in all fields.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (tab === 'id') {
        await signIn({
          hospitalNumber: hospitalNumber.trim().toUpperCase(),
          phone: phoneClean,
        });
      } else {
        await signIn({
          firstName: firstName.trim(),
          surname: surname.trim(),
          dateOfBirth: dateOfBirth.trim(),
          phone: phoneClean,
        });
      }
      // On success, the AuthProvider flips isAuthenticated and the root
      // navigator routes us into the tab stack. Nothing to do here.
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to sign in right now. Please try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBiometric = async () => {
    const ok = await triggerBiometricUnlock();
    if (!ok) {
      Alert.alert('Unavailable', 'Biometric unlock is not enabled on this build.');
    }
  };

  const fillDemo = (id: string, demoPhone: string) => {
    setTab('id');
    setHospitalNumber(id);
    setPhone(demoPhone);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.header}>
          <TamamHealthLogo size={72} />
          <Text style={styles.title}>TamamHealth</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'id' && styles.tabActive]}
            onPress={() => setTab('id')}
            disabled={busy}
          >
            <Text style={[styles.tabText, tab === 'id' && styles.tabTextActive]}>Hospital ID</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'name' && styles.tabActive]}
            onPress={() => setTab('name')}
            disabled={busy}
          >
            <Text style={[styles.tabText, tab === 'name' && styles.tabTextActive]}>Name Lookup</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {tab === 'id' ? (
            <>
              <Text style={styles.label}>Hospital Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. JTH-000001"
                placeholderTextColor={colors.textTertiary}
                value={hospitalNumber}
                onChangeText={setHospitalNumber}
                autoCapitalize="characters"
                editable={!busy}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter first name"
                placeholderTextColor={colors.textTertiary}
                value={firstName}
                onChangeText={setFirstName}
                editable={!busy}
              />
              <Text style={styles.label}>Surname</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter surname"
                placeholderTextColor={colors.textTertiary}
                value={surname}
                onChangeText={setSurname}
                editable={!busy}
              />
              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                editable={!busy}
              />
            </>
          )}

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0912345678"
            placeholderTextColor={colors.textTertiary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!busy}
          />

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometric}
            disabled={busy}
          >
            <Text style={styles.biometricText}>Use Biometric Unlock</Text>
          </TouchableOpacity>
        </View>

        {/* Demo accounts — gated on EXPO_PUBLIC_DEMO_MODE */}
        {DEMO_MODE_ENABLED && (
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>DEMO ACCOUNTS</Text>
            {DEMO_ACCOUNTS.map((demo) => (
              <TouchableOpacity
                key={demo.id}
                style={styles.demoButton}
                onPress={() => fillDemo(demo.id, demo.phone)}
                disabled={busy}
              >
                <Text style={styles.demoName}>{demo.name}</Text>
                <Text style={styles.demoId}>{demo.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.flagStripe}>
            <View style={[styles.stripe, { backgroundColor: '#000' }]} />
            <View style={[styles.stripe, { backgroundColor: '#C44536' }]} />
            <View style={[styles.stripe, { backgroundColor: '#FFF' }]} />
            <View style={[styles.stripe, { backgroundColor: '#1B9E77' }]} />
            <View style={[styles.stripe, { backgroundColor: '#2A7A6E' }]} />
            <View style={[styles.stripe, { backgroundColor: '#E4A84B' }]} />
          </View>
          <Text style={styles.footerText}>TamamHealth Health Technologies</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, padding: spacing.lg },
  header: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xl },
  title: { fontSize: fontSize.hero, fontWeight: '800', color: colors.navy, marginTop: spacing.md },
  subtitle: { fontSize: fontSize.lg, color: colors.textSecondary, marginTop: spacing.xs },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.cream200,
    borderRadius: radius.md, padding: 3, marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.navy },
  form: {},
  label: {
    fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary,
    marginBottom: spacing.xs, marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cream300,
    borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.green, borderRadius: radius.sm,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '700' },
  biometricButton: {
    alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm,
  },
  biometricText: {
    fontSize: fontSize.sm, color: colors.teal, fontWeight: '600',
  },
  demoSection: {
    marginTop: spacing.xl, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.cream300,
  },
  demoTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textTertiary,
    letterSpacing: 1, marginBottom: spacing.sm,
  },
  demoButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.cream100, borderWidth: 1, borderColor: colors.cream300,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  demoName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  demoId: { fontSize: fontSize.xs, color: colors.textTertiary },
  footer: { alignItems: 'center', marginTop: 'auto', paddingTop: spacing.xl },
  flagStripe: { flexDirection: 'row', width: 120, height: 4, borderRadius: 2, overflow: 'hidden' },
  stripe: { flex: 1 },
  footerText: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.sm },
});
