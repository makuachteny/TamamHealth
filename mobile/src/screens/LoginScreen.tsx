import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { colors, spacing, radius, fontSize } from '../lib/theme';
import { useAuth } from '../lib/auth';
import TamamHealthLogo from '../components/TamamHealthLogo';

export default function LoginScreen() {
  const { setBypass } = useAuth();
  const [tab, setTab] = useState<'id' | 'name'>('id');
  const [hospitalNumber, setHospitalNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter your phone number.');
      return;
    }
    setLoading(true);

    // Simulate a brief delay then bypass auth with demo patient
    await new Promise((r) => setTimeout(r, 400));

    // Validate against demo accounts
    const demos = [
      { id: 'JTH-000001', phone: '0912345678' },
      { id: 'JTH-000002', phone: '0916111222' },
      { id: 'JTH-000003', phone: '0921333444' },
    ];

    const phoneClean = phone.trim().replace(/\s/g, '');

    if (tab === 'id') {
      const match = demos.find(
        (d) => d.id === hospitalNumber.trim().toUpperCase() && d.phone === phoneClean
      );
      if (!match) {
        Alert.alert('Login Failed', 'No matching patient found. Check your Hospital ID and phone number.');
        setLoading(false);
        return;
      }
    } else {
      // For name lookup, accept any combo in demo mode
      if (!firstName.trim() || !surname.trim() || !dateOfBirth.trim()) {
        Alert.alert('Required', 'Please fill in all fields.');
        setLoading(false);
        return;
      }
    }

    setBypass(true);
    setLoading(false);
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
          >
            <Text style={[styles.tabText, tab === 'id' && styles.tabTextActive]}>Hospital ID</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'name' && styles.tabActive]}
            onPress={() => setTab('name')}
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
              />
              <Text style={styles.label}>Surname</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter surname"
                placeholderTextColor={colors.textTertiary}
                value={surname}
                onChangeText={setSurname}
              />
              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
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
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Demo accounts */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>DEMO ACCOUNTS</Text>
          {[
            { id: 'JTH-000001', phone: '0912345678', name: 'Deng Mabior Garang' },
            { id: 'JTH-000002', phone: '0916111222', name: 'Nyabol Gatdet Koang' },
            { id: 'JTH-000003', phone: '0921333444', name: 'Achol Mayen Deng' },
          ].map((demo) => (
            <TouchableOpacity
              key={demo.id}
              style={styles.demoButton}
              onPress={() => fillDemo(demo.id, demo.phone)}
            >
              <Text style={styles.demoName}>{demo.name}</Text>
              <Text style={styles.demoId}>{demo.id}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
