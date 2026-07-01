/**
 * Patient profile.
 *
 * - Pulls the authenticated `patient` from `useAuth()`.
 * - Renders real demographics: name, hospital number, gender, DOB, phone,
 *   hospital affiliation, optional registration date, optional address.
 * - Sign Out button -> `signOut()` from auth context.
 * - "Update phone" / "Update address" form is rendered DISABLED with a
 *   "Coming soon" tooltip because the platform's patient-portal API does
 *   NOT expose a profile-edit endpoint yet (see ticket #24). We deliberately
 *   ship no client-side write that would 404 against the server.
 *
 * When the platform later adds `PATCH /api/patient-portal/profile`, the only
 * change required is to wire `submitProfileEdit()` below — the form, types,
 * and validation shapes are already in place.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator,
  TextInput,
} from 'react-native';
import { Icon } from '@/components/icons';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, radius, fontFamily } from '../lib/theme';
import { useAuth } from '../lib/auth';

const HEALTH_LINKS = [
  { icon: 'flask', label: 'Lab Results', route: '/(tabs)/labs', color: '#8B5CF6' },
  { icon: 'medkit', label: 'Prescriptions', route: '/(tabs)/prescriptions', color: '#EC4899' },
  { icon: 'chatbubbles', label: 'Messages', route: '/(tabs)/messages', color: '#06B6D4' },
  { icon: 'shield-checkmark', label: 'Immunizations', route: '/(tabs)/immunizations', color: '#F59E0B' },
] as const;

const SETTINGS_LINKS = [
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'language-outline', label: 'Language' },
  { icon: 'moon-outline', label: 'Appearance' },
  { icon: 'help-circle-outline', label: 'Help & Support' },
  { icon: 'information-circle-outline', label: 'About TamamHealth' },
] as const;

/**
 * The patient-portal profile-edit endpoint does not exist yet on the
 * platform. Flip this flag to `true` once it ships AND swap the
 * `submitProfileEdit` body to actually `apiFetch(...)` the PATCH.
 */
const PROFILE_EDIT_ENABLED = false;

export default function ProfileScreen() {
  const { patient, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const openEdit = () => {
    if (!patient) return;
    setPhoneDraft(patient.phone ?? '');
    setAddressDraft(patient.address ?? '');
    setEditing(true);
  };

  const submitProfileEdit = async () => {
    if (!PROFILE_EDIT_ENABLED) {
      // Defensive — the button is disabled, but if it's somehow tapped, do
      // not even attempt a request to a route that doesn't exist.
      Alert.alert(
        'Coming soon',
        'Profile editing isn’t available yet. Please contact your clinic to update phone or address.'
      );
      return;
    }
    setSubmitting(true);
    try {
      // FUTURE: when the platform adds PATCH /api/patient-portal/profile,
      // the call would look like:
      //
      //   await apiFetch('/api/patient-portal/profile', {
      //     method: 'PATCH',
      //     body: JSON.stringify({ phone: phoneDraft, address: addressDraft }),
      //   });
      //
      // The server's response is canonical (server-wins); refresh the
      // auth context's cached patient from the response and close the form.
      Alert.alert('Saved', 'Your profile has been updated.');
      setEditing(false);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading skeleton — auth is hydrating from SecureStore.
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (!patient) {
    // Should be unreachable under normal conditions (RootNavigator gates the
    // tabs on `isAuthenticated`), but render a safe fallback rather than
    // crashing if someone navigates directly to the profile route.
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>You are not signed in.</Text>
      </View>
    );
  }

  const fullName = `${patient.firstName} ${patient.surname}`.trim();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Patient card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {patient.firstName.charAt(0)}
            {patient.surname.charAt(0)}
          </Text>
        </View>
        <Text style={styles.profileName}>{fullName}</Text>
        <Text style={styles.profileHn}>{patient.hospitalNumber}</Text>

        <View style={styles.profileMeta}>
          <View style={styles.metaChip}>
            <Icon name="calendar-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{patient.dateOfBirth || '—'}</Text>
          </View>
          <View style={styles.metaChip}>
            <Icon name="male-female-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{patient.gender || '—'}</Text>
          </View>
          <View style={styles.metaChip}>
            <Icon name="call-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{patient.phone || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Demographics — read-only cards */}
      <Text style={styles.sectionTitle}>Patient Info</Text>
      <View style={styles.linksCard}>
        <InfoRow label="Hospital" value={patient.registrationHospital || '—'} />
        <InfoRow
          label="Registered"
          value={patient.registrationDate ? formatDate(patient.registrationDate) : 'Not on file'}
          last={!patient.address && !patient.email}
        />
        {patient.address ? (
          <InfoRow label="Address" value={patient.address} last={!patient.email} />
        ) : null}
        {patient.email ? <InfoRow label="Email" value={patient.email} last /> : null}
      </View>

      {/* Edit form (disabled until platform ships PATCH endpoint) */}
      <View style={styles.editHeader}>
        <Text style={styles.sectionTitle}>Update Contact</Text>
        {!PROFILE_EDIT_ENABLED && (
          <View style={styles.comingSoonPill}>
            <Icon name="time-outline" size={11} color={colors.goldDark} />
            <Text style={styles.comingSoonText}>Coming soon</Text>
          </View>
        )}
      </View>

      <View style={styles.linksCard}>
        {!editing ? (
          <TouchableOpacity
            style={[styles.linkRow, !PROFILE_EDIT_ENABLED && styles.disabledRow]}
            onPress={openEdit}
            disabled={!PROFILE_EDIT_ENABLED}
            activeOpacity={0.6}
            accessibilityState={{ disabled: !PROFILE_EDIT_ENABLED }}
            accessibilityLabel={
              PROFILE_EDIT_ENABLED
                ? 'Update phone or address'
                : 'Update contact (coming soon — feature not yet available)'
            }
          >
            <Icon name="create-outline" size={18} color={colors.textSecondary} style={{ width: 28 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkLabel}>Update phone / address</Text>
              {!PROFILE_EDIT_ENABLED && (
                <Text style={styles.helperText}>
                  Contact your clinic to update these for now.
                </Text>
              )}
            </View>
            <Icon name="chevron-forward" size={16} color={colors.cream300} />
          </TouchableOpacity>
        ) : (
          <View style={styles.formBody}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phoneDraft}
              onChangeText={setPhoneDraft}
              keyboardType="phone-pad"
              placeholder="0912345678"
              placeholderTextColor={colors.textTertiary}
              editable={PROFILE_EDIT_ENABLED && !submitting}
            />

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={addressDraft}
              onChangeText={setAddressDraft}
              placeholder="Boma, Payam, County"
              placeholderTextColor={colors.textTertiary}
              multiline
              editable={PROFILE_EDIT_ENABLED && !submitting}
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditing(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !PROFILE_EDIT_ENABLED && styles.saveBtnDisabled]}
                onPress={submitProfileEdit}
                disabled={!PROFILE_EDIT_ENABLED || submitting}
                accessibilityLabel={
                  PROFILE_EDIT_ENABLED
                    ? 'Save changes'
                    : 'Save (coming soon — feature not yet available)'
                }
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveText}>
                    {PROFILE_EDIT_ENABLED ? 'Save' : 'Save (disabled)'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Health Services */}
      <Text style={styles.sectionTitle}>Health Services</Text>
      <View style={styles.linksCard}>
        {HEALTH_LINKS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.linkRow, i < HEALTH_LINKS.length - 1 && styles.linkBorder]}
            onPress={() => router.push(item.route as never)}
            activeOpacity={0.6}
          >
            <View style={[styles.linkIcon, { backgroundColor: item.color + '12' }]}>
              <Icon
                name={item.icon as React.ComponentProps<typeof Icon>['name']}
                size={18}
                color={item.color}
              />
            </View>
            <Text style={styles.linkLabel}>{item.label}</Text>
            <Icon name="chevron-forward" size={16} color={colors.cream300} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.linksCard}>
        {SETTINGS_LINKS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.linkRow, i < SETTINGS_LINKS.length - 1 && styles.linkBorder]}
            activeOpacity={0.6}
          >
            <Icon
              name={item.icon as React.ComponentProps<typeof Icon>['name']}
              size={20}
              color={colors.textSecondary}
              style={{ width: 28 }}
            />
            <Text style={styles.linkLabel}>{item.label}</Text>
            <Icon name="chevron-forward" size={16} color={colors.cream300} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="log-out-outline" size={18} color={colors.red} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.flagStripe}>
          {['#000', '#C44536', '#FFF', '#1B9E77', '#2A7A6E', '#E4A84B'].map((c, i) => (
            <View key={i} style={[styles.stripe, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.footerText}>TamamHealth Health Technologies</Text>
        <Text style={styles.footerVersion}>v0.1.0</Text>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.linkBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },

  loadingContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { fontSize: fontSize.sm, color: colors.textSecondary },

  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cream200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.gold, fontSize: 24, fontWeight: '800' },
  profileName: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  profileHn: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 2,
    fontFamily: fontFamily.mono,
  },
  profileMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  metaText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },

  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: spacing.xs,
  },
  comingSoonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: '#FBF2E0',
    marginBottom: spacing.sm,
  },
  comingSoonText: { fontSize: 10, fontWeight: '700', color: colors.goldDark },

  linksCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cream200,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  disabledRow: { opacity: 0.55 },
  linkBorder: { borderBottomWidth: 1, borderBottomColor: colors.cream100 },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  helperText: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 2 },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  infoLabel: {
    width: 100,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },

  formBody: { padding: spacing.md, gap: spacing.sm },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.cream200,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  multiline: { height: 70, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cream300,
    alignItems: 'center',
  },
  cancelText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.green,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: colors.cream300 },
  saveText: { fontSize: fontSize.sm, fontWeight: '700', color: '#FFF' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: spacing.xl,
  },
  logoutText: { fontSize: fontSize.md, fontWeight: '700', color: colors.red },

  footer: { alignItems: 'center', marginBottom: spacing.md },
  flagStripe: {
    flexDirection: 'row',
    width: 100,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  stripe: { flex: 1 },
  footerText: { fontSize: fontSize.xs, color: colors.textTertiary },
  footerVersion: { fontSize: 9, color: colors.cream300, marginTop: 2 },
});
